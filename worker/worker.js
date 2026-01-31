const { createClient } = require('redis');
const { Pool } = require('pg');
const axios = require('axios');
const cheerio = require('cheerio');

// --- Připojení ---
const redisClient = createClient({ url: process.env.REDIS_URL });
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const ANALYSIS_QUEUE_NAME = 'analysis_queue';
const PROCESSED_SET_NAME = 'processed_urls'; // Sada pro sledování již zpracovaných nebo zařazených URL

// --- Pomocné: safe parse job z Redis fronty (JSON nebo plain URL) ---
function parseJobElement(raw) {
    if (typeof raw !== 'string') {
        return { url: String(raw || ''), interests: '', exclusions: '' };
    }
    const trimmed = raw.trim();
    if (!trimmed) return { url: '', interests: '', exclusions: '' };

    // Pokud to vypadá jako JSON, zkus parse
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
        try {
            const job = JSON.parse(trimmed);
            if (typeof job === 'string') return { url: job, interests: '', exclusions: '' };
            return {
                url: job.url || '',
                interests: job.interests || '',
                exclusions: job.exclusions || '',
                localData: job.localData || null
            };
        } catch (e) {
            // spadne to? ber jako URL
            return { url: trimmed, interests: '', exclusions: '' };
        }
    }

    // Jinak ber jako URL string
    return { url: trimmed, interests: '', exclusions: '' };
}

// --- Pomocné: fetch HTML s jedním slušným fallbackem (bez obcházení) ---
async function fetchHtmlWithFallback(url) {
    // 1) základní pokus – náš bot UA
    try {
        const res = await axios.get(url, {
            headers: {
                'User-Agent': 'WAI-Bot/1.0',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            },
            timeout: 15000,
            maxRedirects: 5,
            validateStatus: () => true
        });
        return res;
    } catch (err) {
        // síťová chyba
        throw err;
    }
}

// --- Pomocné: vytvořit "blocked" placeholder aury (šedá) ---
function makeBlockedAura(reason, httpStatus) {
    // Nejde o soud, ale o hranici poznání.
    const intent = `Nelze předběžně prozkoumat (${httpStatus || 'N/A'}): ${reason}`;
    return {
        circle: { color: 'grey', intent },
        star: {
            stability: { value: 50, saturation: 15 },
            flow: { value: 50, saturation: 15 },
            will: { value: 50, saturation: 15 },
            relation: { value: 50, saturation: 15 },
            voice: { value: 50, saturation: 15 },
            meaning: { value: 50, saturation: 15 },
            integrity: { value: 50, saturation: 15 },
        },
        relevance: 0
    };
}

// --- Pomocné: vytvořit minimální content_map pro blocked ---
function makeBlockedContentMap(url, httpStatus, reason) {
    return {
        title: '',
        meta_description: '',
        headings: [],
        key_topics: [],
        blocked: true,
        blocked_http_status: httpStatus || null,
        blocked_reason: reason || null,
        blocked_url: url
    };
}

// --- Hlavní smyčka Workera ---
async function main() {
    await redisClient.connect();
    console.log('Redis connected.');

    // Pool se připojuje lazy, ale test připojení je v pohodě
    await pool.query('SELECT 1');
    console.log('Postgres connected.');

    console.log('Worker is connected and ready.');

    while (true) {
        let response = null;

        try {
            response = await redisClient.brPop(ANALYSIS_QUEUE_NAME, 0);
            const raw = response?.element;

            const job = parseJobElement(raw);
            const urlToAnalyze = job.url;
            const userInterests = job.interests || '';
            const userExclusions = job.exclusions || '';

            if (!urlToAnalyze) {
                console.warn('[JOB SKIP] Empty URL in queue element.');
                continue;
            }

            console.log(`[JOB START] Analyzing: ${urlToAnalyze} (interests: ${userInterests.substring(0, 50)}...)`);
            await processUrl(urlToAnalyze, userInterests, userExclusions);
            console.log(`[JOB SUCCESS] Finished: ${urlToAnalyze}`);

        } catch (err) {
            console.error('[WORKER LOOP ERROR]', err?.message || err);

            // Pokud se něco pokazí, malá pauza, aby se worker netočil v panice
            await new Promise(resolve => setTimeout(resolve, 3000));
        }
    }
}

// --- Logika zpracování jedné URL ---
async function processUrl(url, interests, exclusions) {
    const client = await pool.connect();

    // Proměnné, které potřebujeme i při blocked
    let pageUrl;
    let domainName;
    let domainId;
    let pathKey;

    try {
        // Parse URL hned (ať víme doménu i při 403)
        pageUrl = new URL(url);
        domainName = pageUrl.hostname;
        pathKey = pageUrl.pathname + pageUrl.search;

        // --- Pokus o stažení HTML ---
        const res = await fetchHtmlWithFallback(url);
        const status = res?.status;

        // Pokud je to 403 (nebo velmi podobné "tvrdé NE"), uložíme blocked placeholder a končíme.
        // (401 může znamenat login wall, 403 typicky bot-protection / forbidden.)
        if (status === 401 || status === 403) {
            const reason = status === 401 ? 'Vyžaduje přihlášení nebo autorizaci' : 'Forbidden / bot protection';
            const blockedAura = makeBlockedAura(reason, status);
            const blockedContentMap = makeBlockedContentMap(url, status, reason);

            await client.query('BEGIN');

            // 1) doména
            let { rows: [domain] } = await client.query(
                'INSERT INTO domains (domain_name, last_analyzed) VALUES ($1, CURRENT_TIMESTAMP) ' +
                'ON CONFLICT (domain_name) DO UPDATE SET last_analyzed = CURRENT_TIMESTAMP ' +
                'RETURNING id',
                [domainName]
            );
            if (!domain) {
                ({ rows: [domain] } = await client.query('SELECT id FROM domains WHERE domain_name = $1', [domainName]));
            }
            domainId = domain.id;

            // 2) stránka – uložíme placeholder auru + content_map s blocked informací
            const { rows: [page] } = await client.query(
                `INSERT INTO pages (domain_id, url, title, meta_description, page_aura_circle, page_aura_star, content_map)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)
                 ON CONFLICT (domain_id, url) DO UPDATE SET
                   title = EXCLUDED.title,
                   meta_description = EXCLUDED.meta_description,
                   page_aura_circle = EXCLUDED.page_aura_circle,
                   page_aura_star = EXCLUDED.page_aura_star,
                   content_map = EXCLUDED.content_map,
                   last_scraped = CURRENT_TIMESTAMP
                 RETURNING id`,
                [
                    domainId,
                    pathKey,
                    '',
                    '',
                    blockedAura.circle,
                    blockedAura.star,
                    blockedContentMap
                ]
            );

            // 3) vyčistit případná stará témata/odkazy pro tuhle stránku
            if (page?.id) {
                await client.query('DELETE FROM page_topics WHERE page_id = $1', [page.id]);
                await client.query('DELETE FROM links WHERE source_page_id = $1', [page.id]);
            }

            await client.query('COMMIT');

            console.log(`[BLOCKED] Stored placeholder for ${url} (HTTP ${status}).`);

            // Agregovaná aura domény se může aktualizovat i s blocked stránkou (záleží na tobě).
            // Zde ji aktualizujeme, aby doména mohla být "grey", pokud je vše blokované.
            await updateDomainAura(domainId);

            return;
        }

        // Pokud není 2xx, ale není to 401/403, rozhodneme co dál:
        // - 429/5xx/timeout: necháme vyhodit chybu a případné retry vyřeší vyšší logika (zatím jen log).
        // - 404: uložíme jako blocked "not found" (aby se to necyklilo).
        if (status === 404) {
            const reason = 'Stránka neexistuje (404 Not Found)';
            const blockedAura = makeBlockedAura(reason, status);
            const blockedContentMap = makeBlockedContentMap(url, status, reason);

            await client.query('BEGIN');

            let { rows: [domain] } = await client.query(
                'INSERT INTO domains (domain_name, last_analyzed) VALUES ($1, CURRENT_TIMESTAMP) ' +
                'ON CONFLICT (domain_name) DO UPDATE SET last_analyzed = CURRENT_TIMESTAMP ' +
                'RETURNING id',
                [domainName]
            );
            if (!domain) {
                ({ rows: [domain] } = await client.query('SELECT id FROM domains WHERE domain_name = $1', [domainName]));
            }
            domainId = domain.id;

            const { rows: [page] } = await client.query(
                `INSERT INTO pages (domain_id, url, title, meta_description, page_aura_circle, page_aura_star, content_map)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)
                 ON CONFLICT (domain_id, url) DO UPDATE SET
                   title = EXCLUDED.title,
                   meta_description = EXCLUDED.meta_description,
                   page_aura_circle = EXCLUDED.page_aura_circle,
                   page_aura_star = EXCLUDED.page_aura_star,
                   content_map = EXCLUDED.content_map,
                   last_scraped = CURRENT_TIMESTAMP
                 RETURNING id`,
                [domainId, pathKey, '', '', blockedAura.circle, blockedAura.star, blockedContentMap]
            );

            if (page?.id) {
                await client.query('DELETE FROM page_topics WHERE page_id = $1', [page.id]);
                await client.query('DELETE FROM links WHERE source_page_id = $1', [page.id]);
            }

            await client.query('COMMIT');

            console.log(`[NOT FOUND] Stored placeholder for ${url} (HTTP 404).`);
            await updateDomainAura(domainId);
            return;
        }

        if (status < 200 || status >= 300) {
            // Pro 429 a 5xx je typicky lepší neukládat "blocked", ale spíš retry/backoff.
            // Zatím jen vyhodíme chybu (ať je to vidět v logu a neuloží se zavádějící aura).
            throw new Error(`HTTP ${status} while fetching ${url}`);
        }

        // --- Máme HTML, pokračujeme standardní cestou ---
        const html = res.data;
        const $ = cheerio.load(html);

        // --- Extrakce Sémantické Mapy ---
        const contentMap = extractContentMap($);

        // --- Analýza Aury Stránky ---
        const pageAura = generatePageAura(contentMap, interests, exclusions);

        // Generování slovního vysvětlení
        const explanationText = generateExplanation(pageAura, contentMap);

        // Přiřazení finálního vysvětlení k objektu kruhu
        pageAura.circle.intent = explanationText;

        // --- Zahájení databázové transakce ---
        await client.query('BEGIN');

        // 1. Najít nebo vytvořit záznam pro doménu
        let { rows: [domain] } = await client.query(
            'INSERT INTO domains (domain_name, last_analyzed) VALUES ($1, CURRENT_TIMESTAMP) ' +
            'ON CONFLICT (domain_name) DO UPDATE SET last_analyzed = CURRENT_TIMESTAMP ' +
            'RETURNING id',
            [domainName]
        );
        if (!domain) {
            ({ rows: [domain] } = await client.query('SELECT id FROM domains WHERE domain_name = $1', [domainName]));
        }
        domainId = domain.id;

        // 2. Vytvořit nebo aktualizovat záznam pro stránku
        const { rows: [page] } = await client.query(
            `INSERT INTO pages (domain_id, url, title, meta_description, page_aura_circle, page_aura_star, content_map)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             ON CONFLICT (domain_id, url) DO UPDATE SET
               title = EXCLUDED.title,
               meta_description = EXCLUDED.meta_description,
               page_aura_circle = EXCLUDED.page_aura_circle,
               page_aura_star = EXCLUDED.page_aura_star,
               content_map = EXCLUDED.content_map,
               last_scraped = CURRENT_TIMESTAMP
             RETURNING id`,
            [domainId, pathKey, contentMap.title, contentMap.meta_description, pageAura.circle, pageAura.star, contentMap]
        );
        const pageId = page.id;

        // 3. Zpracovat a uložit témata (klíčová slova)
        await client.query('DELETE FROM page_topics WHERE page_id = $1', [pageId]); // Smazat stará témata
        if (contentMap.key_topics && contentMap.key_topics.length > 0) {
            const topicValues = contentMap.key_topics
                .map(topic => `(${pageId}, '${topic.replace(/'/g, "''")}')`)
                .join(',');
            await client.query(`INSERT INTO page_topics (page_id, topic) VALUES ${topicValues} ON CONFLICT DO NOTHING`);
        }

        // 4. Zpracovat a uložit odkazy a zařadit nové interní URL do fronty
        await client.query('DELETE FROM links WHERE source_page_id = $1', [pageId]); // Smazat staré odkazy
        const links = extractLinks($, pageUrl);

        for (const link of links) {
            const linkAura = generateLinkAura(link.url);
            await client.query(
                'INSERT INTO links (source_page_id, target_url, link_text, link_aura_circle) VALUES ($1, $2, $3, $4)',
                [pageId, link.url, link.text, linkAura]
            );

            // Pokud je odkaz interní a ještě nebyl zpracován, přidej ho do fronty
            if (link.isInternal) {
                const normalizedUrl = link.url.split('#')[0];
                const isMember = await redisClient.sIsMember(PROCESSED_SET_NAME, normalizedUrl);

                if (!isMember) {
                    await redisClient.sAdd(PROCESSED_SET_NAME, normalizedUrl);

                    // DŮLEŽITÉ: do fronty posíláme vždy JSON, aby worker nikdy nespadl na JSON.parse
                    const crawlJob = JSON.stringify({
                        url: normalizedUrl,
                        interests: interests || '',
                        exclusions: exclusions || ''
                    });

                    await redisClient.lPush(ANALYSIS_QUEUE_NAME, crawlJob);
                }
            }
        }

        // --- Ukončení transakce ---
        await client.query('COMMIT');

        // --- Aktualizace Agregované Aury Domény ---
        await updateDomainAura(domainId);

    } catch (err) {
        // rollback jen pokud běží transakce
        try {
            await client.query('ROLLBACK');
        } catch (rollbackErr) {
            // ignore rollback error
        }

        console.error(`[PROCESS ERROR] Error processing ${url}:`, err?.message || err);
        throw err;

    } finally {
        client.release();
    }
}

// --- Funkce pro Agregaci Aury Domény ---
async function updateDomainAura(domainId) {
    try {
        const { rows: pages } = await pool.query('SELECT page_aura_circle FROM pages WHERE domain_id = $1', [domainId]);
        if (pages.length === 0) return;

        const colorCounts = pages.reduce((acc, page) => {
            const color = page.page_aura_circle?.color;
            if (color) acc[color] = (acc[color] || 0) + 1;
            return acc;
        }, {});

        const entries = Object.entries(colorCounts);
        if (entries.length === 0) return;

        // Najdeme nejčastější barvu
        const dominantColor = entries.sort((a, b) => b[1] - a[1])[0][0];

        const domainAuraCircle = { color: dominantColor, intent: `Aggregated from ${pages.length} pages` };

        await pool.query('UPDATE domains SET overall_aura_circle = $1 WHERE id = $2', [domainAuraCircle, domainId]);
        console.log(`[DOMAIN AURA] Updated for domain ID ${domainId} to ${dominantColor}.`);
    } catch (err) {
        console.error(`[DOMAIN AURA ERROR] Could not update domain aura for ID ${domainId}:`, err?.message || err);
    }
}

// --- Pomocné funkce ---

function extractContentMap($) {
    const title = $('title').text().trim();
    const meta_description = $('meta[name="description"]').attr('content') || '';
    const headings = [];
    $('h1, h2, h3').each((i, el) => {
        headings.push({ level: $(el).prop('tagName').toLowerCase(), text: $(el).text().trim() });
    });

    // Jazykově agnostická extrakce klíčových témat
    const keywordsMeta = $('meta[name="keywords"]').attr('content');
    let key_topics = [];
    if (keywordsMeta) {
        key_topics = keywordsMeta.split(',').map(k => k.trim().toLowerCase()).filter(k => k);
    } else {
        const textCorpus = headings.map(h => h.text).join(' ') + ' ' + title;
        const words = textCorpus.toLowerCase().match(/\b(\w{4,})\b/g) || [];
        const freq = words.reduce((acc, word) => {
            acc[word] = (acc[word] || 0) + 1;
            return acc;
        }, {});
        key_topics = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 5).map(e => e[0]);
    }

    return { title, meta_description, headings, key_topics };
}

function extractLinks($, pageUrl) {
    const links = [];
    const uniqueUrls = new Set();
    $('a[href]').each((i, element) => {
        const href = $(element).attr('href');
        if (href && !href.startsWith('#') && !href.startsWith('mailto:') && !href.startsWith('tel:')) {
            try {
                const absoluteUrl = new URL(href, pageUrl.href).href;
                if (!uniqueUrls.has(absoluteUrl)) {
                    uniqueUrls.add(absoluteUrl);
                    links.push({
                        url: absoluteUrl,
                        text: $(element).text().trim(),
                        isInternal: new URL(absoluteUrl).hostname === pageUrl.hostname
                    });
                }
            } catch (e) {
                /* Ignorovat neplatné URL */
            }
        }
    });
    return links;
}

function generateExplanation(pageAura, contentMap) {
    const reasons = [];
    const { star, relevance } = pageAura;
    const { stability, relation: trust, meaning } = star;

    // --- Personalizace ---
    if (relevance === 1) {
        reasons.push('Stránka se dobře shoduje s vašimi zájmy.');
    } else if (relevance === -1) {
        reasons.push('Upozornění: Obsah se může shodovat s tématy, která jste vyloučili.');
    }

    // Hodnocení Stability
    if (stability?.value > 90) {
        reasons.push('Stránka je technicky a strukturálně velmi dobře postavena.');
    } else if (stability?.value < 60) {
        reasons.push('Technická stabilita má rezervy, což může ovlivnit zážitek.');
    }

    // Hodnocení Důvěry (Vztahu)
    if (trust?.value > 70) {
        reasons.push('Vysoká míra důvěryhodnosti díky přítomnosti klíčových signálů.');
    } else if (trust?.value < 40) {
        reasons.push('Důvěryhodnost je nižší, mohou chybět transparentní informace.');
    }

    // Hodnocení Smyslu
    if (meaning?.value > 80) {
        reasons.push('Obsah je tematicky silně zaměřený a jasný.');
    } else if (meaning?.value < 40) {
        reasons.push('Tematické zaměření stránky není zcela zřejmé.');
    }

    // Doplňující postřehy z obsahu
    if (contentMap.headings?.filter(h => h.level === 'h1').length > 1) {
        reasons.push('Struktura obsahu by mohla být přehlednější (bylo nalezeno více hlavních nadpisů H1).');
    }
    if (!contentMap.title) {
        reasons.push('Chybějící titulek stránky znesnadňuje orientaci.');
    }

    if (reasons.length === 0) {
        return 'Stránka se jeví jako vyvážená bez výrazných pozitivních či negativních signálů.';
    }

    return reasons.join(' ');
}

function generatePageAura(contentMap, interests, exclusions) {
    // Příprava uživatelských preferencí
    const interestKeywords = (interests || '').toLowerCase().split(',').map(k => k.trim()).filter(Boolean);
    const exclusionKeywords = (exclusions || '').toLowerCase().split(',').map(k => k.trim()).filter(Boolean);
    const pageTopics = contentMap.key_topics || [];

    // Vylepšená, ale stále jednoduchá, rule-based analýza
    let stability = 100;
    if (contentMap.headings?.filter(h => h.level === 'h1').length > 1) stability -= 20; // Penalizace za více H1
    if (!contentMap.title) stability -= 10;
    if (!contentMap.meta_description) stability -= 10;

    let trust = 50;
    if (pageTopics.includes('kontakt') || pageTopics.includes('contact')) trust += 20;
    if (pageTopics.includes('privacy') || pageTopics.includes('soukromí')) trust += 20;

    let meaning = 20 + (pageTopics.length * 10);

    // --- Personalizace na základě zájmů ---
    let relevanceScore = 0;
    if (interestKeywords.some(keyword => pageTopics.includes(keyword))) {
        trust += 15;
        meaning += 20;
        relevanceScore = 1; // Pozitivní relevance
    }
    if (exclusionKeywords.some(keyword => pageTopics.includes(keyword))) {
        trust -= 30;
        meaning -= 20;
        relevanceScore = -1; // Negativní relevance
    }

    // Omezení hodnot na 0-100
    trust = Math.max(0, Math.min(trust, 100));
    meaning = Math.max(0, Math.min(meaning, 100));

    const circleColor = relevanceScore === -1
        ? 'purple'
        : (stability > 70 && trust > 60 ? 'green' : (stability < 50 ? 'red' : 'yellow'));

    return {
        star: {
            stability: { value: stability, saturation: 95 },
            relation: { value: trust, saturation: 90 },
            meaning: { value: meaning, saturation: 80 },
            // doplníme ostatní cípy, ať je tvar konzistentní
            flow: { value: 50, saturation: 60 },
            will: { value: 50, saturation: 60 },
            voice: { value: 50, saturation: 60 },
            integrity: { value: 50, saturation: 60 }
        },
        circle: { color: circleColor },
        relevance: relevanceScore
    };
}

function generateLinkAura(url) {
    const u = new URL(url);
    let color = 'blue';
    let intent = 'Běžný interní odkaz.';

    if (u.hostname !== new URL(process.env.ROOT_URL || 'http://default.com').hostname) {
        intent = 'Odkaz na externí doménu.';
    }

    if (u.hostname.includes('facebook.') || u.hostname.includes('twitter.') || u.hostname.includes('linkedin.') || u.hostname.includes('instagram.')) {
        color = 'indigo';
        intent = 'Odkaz na sociální síť.';
    } else if (u.pathname.match(/\.(zip|pdf|exe|dmg|rar|tar\.gz)$/)) {
        color = 'orange';
        intent = 'Odkaz ke stažení souboru.';
    } else if (u.hostname.includes('youtube.com') || u.hostname.includes('vimeo.com')) {
        color = 'red';
        intent = 'Odkaz na video platformu.';
    }

    return {
        circle: {
            color: color,
            intent: intent
        },
        star: {
            stability: { value: 50, saturation: 50 },
            flow: { value: 50, saturation: 50 },
            will: { value: 50, saturation: 50 },
            relation: { value: 50, saturation: 50 },
            voice: { value: 50, saturation: 50 },
            meaning: { value: 50, saturation: 50 },
            integrity: { value: 50, saturation: 50 },
        }
    };
}

main();
