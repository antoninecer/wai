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
        throw err;
    }
}

// --- Pomocné: vytvořit "blocked" placeholder aury (šedá) ---
function makeBlockedAura(reason, httpStatus) {
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

// --- Pomocné: normalizace URL (odstranění hashe) ---
function normalizeUrl(u) {
    try {
        return new URL(u).href.split('#')[0];
    } catch (e) {
        return String(u || '').split('#')[0];
    }
}

// --- Pomocné: z absolutní URL udělej "pathKey" (pathname + search) stejně jako ukládáš do pages.url ---
function toPathKey(absoluteUrl) {
    const u = new URL(absoluteUrl);
    return u.pathname + u.search;
}

// --- Pomocné: vytvoř "aura pro link" z již známé cílové stránky (z tabulky pages) ---
function makeKnownTargetLinkAura(targetPageRow) {
    const circle = targetPageRow.page_aura_circle || { color: 'grey', intent: 'Cíl nemá uloženou auru.' };
    const star = targetPageRow.page_aura_star || {
        stability: { value: 50, saturation: 25 },
        flow: { value: 50, saturation: 25 },
        will: { value: 50, saturation: 25 },
        relation: { value: 50, saturation: 25 },
        voice: { value: 50, saturation: 25 },
        meaning: { value: 50, saturation: 25 },
        integrity: { value: 50, saturation: 25 },
    };

    // Do link aury přibalíme i trochu kontextu pro tooltip (nevadí, je to jsonb)
    const contentMap = targetPageRow.content_map || {};
    const keyTopics = Array.isArray(contentMap.key_topics) ? contentMap.key_topics : [];

    return {
        circle: circle,
        star: star,
        target: {
            title: targetPageRow.title || '',
            url: targetPageRow.url || '',
            key_topics: keyTopics.slice(0, 8),
            blocked: !!contentMap.blocked,
            blocked_http_status: contentMap.blocked_http_status || null,
            blocked_reason: contentMap.blocked_reason || null
        }
    };
}

// --- Hlavní smyčka Workera ---
async function main() {
    await redisClient.connect();
    console.log('Redis connected.');

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
            await new Promise(resolve => setTimeout(resolve, 3000));
        }
    }
}

// --- Logika zpracování jedné URL ---
async function processUrl(url, interests, exclusions) {
    const client = await pool.connect();

    let pageUrl;
    let domainName;
    let domainId;
    let pathKey;

    try {
        pageUrl = new URL(url);
        domainName = pageUrl.hostname;
        pathKey = pageUrl.pathname + pageUrl.search;

        // --- Pokus o stažení HTML ---
        const res = await fetchHtmlWithFallback(url);
        const status = res?.status;

        // 401/403 → uložit placeholder a skončit
        if (status === 401 || status === 403) {
            const reason = status === 401 ? 'Vyžaduje přihlášení nebo autorizaci' : 'Forbidden / bot protection';
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

            if (page?.id) {
                await client.query('DELETE FROM page_topics WHERE page_id = $1', [page.id]);
                await client.query('DELETE FROM links WHERE source_page_id = $1', [page.id]);
            }

            await client.query('COMMIT');

            console.log(`[BLOCKED] Stored placeholder for ${url} (HTTP ${status}).`);
            await updateDomainAura(domainId);
            return;
        }

        // 404 → uložit placeholder a skončit (ať se to netočí)
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
            throw new Error(`HTTP ${status} while fetching ${url}`);
        }

        // --- Máme HTML, pokračujeme standardní cestou ---
        const html = res.data;
        const $ = cheerio.load(html);

        const contentMap = extractContentMap($);
        const pageAura = generatePageAura(contentMap, interests, exclusions);
        const explanationText = generateExplanation(pageAura, contentMap);
        pageAura.circle.intent = explanationText;

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

        // 2) stránka
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

        // 3) témata
        await client.query('DELETE FROM page_topics WHERE page_id = $1', [pageId]);
        if (contentMap.key_topics && contentMap.key_topics.length > 0) {
            const topicValues = contentMap.key_topics
                .map(topic => `(${pageId}, '${topic.replace(/'/g, "''")}')`)
                .join(',');
            await client.query(`INSERT INTO page_topics (page_id, topic) VALUES ${topicValues} ON CONFLICT DO NOTHING`);
        }

        // 4) odkazy
        await client.query('DELETE FROM links WHERE source_page_id = $1', [pageId]);
        const links = extractLinks($, pageUrl);

        // --- NOVÉ: připravíme batch lookup pro interní cíle, které už DB zná ---
        const internalTargets = [];
        const absToPathKey = new Map(); // absUrl -> pathKey (pro pages.url)
        for (const link of links) {
            if (!link.isInternal) continue;
            const abs = normalizeUrl(link.url);
            try {
                const pk = toPathKey(abs);
                absToPathKey.set(abs, pk);
                internalTargets.push(pk);
            } catch (_) {}
        }

        let knownTargetsByPathKey = new Map(); // pathKey -> row z pages
        if (internalTargets.length > 0) {
            // deduplikace
            const uniqueTargets = Array.from(new Set(internalTargets));
            // Jedním dotazem zjistíme, co už DB zná
            const { rows } = await client.query(
                `SELECT url, title, page_aura_circle, page_aura_star, content_map
                 FROM pages
                 WHERE domain_id = $1 AND url = ANY($2::text[])`,
                [domainId, uniqueTargets]
            );
            knownTargetsByPathKey = new Map(rows.map(r => [r.url, r]));
        }

        for (const link of links) {
            const absUrl = normalizeUrl(link.url);

            // a) pokud interní a máme cílovou stránku v DB, uložíme link auru z ní
            let linkAuraObject = null;
            if (link.isInternal) {
                const pk = absToPathKey.get(absUrl);
                if (pk && knownTargetsByPathKey.has(pk)) {
                    const targetRow = knownTargetsByPathKey.get(pk);
                    linkAuraObject = makeKnownTargetLinkAura(targetRow);
                }
            }

            // b) fallback odhad
            if (!linkAuraObject) {
                linkAuraObject = generateLinkAura(absUrl, domainName);
            }

            await client.query(
                'INSERT INTO links (source_page_id, target_url, link_text, link_aura_circle) VALUES ($1, $2, $3, $4)',
                [pageId, absUrl, link.text, linkAuraObject]
            );

            // c) enqueue interní URL (jen pokud ještě nebylo viděno)
            if (link.isInternal) {
                const normalizedUrl = absUrl;
                const isMember = await redisClient.sIsMember(PROCESSED_SET_NAME, normalizedUrl);

                if (!isMember) {
                    await redisClient.sAdd(PROCESSED_SET_NAME, normalizedUrl);

                    const crawlJob = JSON.stringify({
                        url: normalizedUrl,
                        interests: interests || '',
                        exclusions: exclusions || ''
                    });

                    await redisClient.lPush(ANALYSIS_QUEUE_NAME, crawlJob);
                }
            }
        }

        await client.query('COMMIT');

        await updateDomainAura(domainId);

    } catch (err) {
        try { await client.query('ROLLBACK'); } catch (_) {}
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
                const normalized = normalizeUrl(absoluteUrl);
                if (!uniqueUrls.has(normalized)) {
                    uniqueUrls.add(normalized);
                    links.push({
                        url: normalized,
                        text: $(element).text().trim(),
                        isInternal: new URL(normalized).hostname === pageUrl.hostname
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

    if (relevance === 1) {
        reasons.push('Stránka se dobře shoduje s vašimi zájmy.');
    } else if (relevance === -1) {
        reasons.push('Upozornění: Obsah se může shodovat s tématy, která jste vyloučili.');
    }

    if (stability?.value > 90) {
        reasons.push('Stránka je technicky a strukturálně velmi dobře postavena.');
    } else if (stability?.value < 60) {
        reasons.push('Technická stabilita má rezervy, což může ovlivnit zážitek.');
    }

    if (trust?.value > 70) {
        reasons.push('Vysoká míra důvěryhodnosti díky přítomnosti klíčových signálů.');
    } else if (trust?.value < 40) {
        reasons.push('Důvěryhodnost je nižší, mohou chybět transparentní informace.');
    }

    if (meaning?.value > 80) {
        reasons.push('Obsah je tematicky silně zaměřený a jasný.');
    } else if (meaning?.value < 40) {
        reasons.push('Tematické zaměření stránky není zcela zřejmé.');
    }

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
    const interestKeywords = (interests || '').toLowerCase().split(',').map(k => k.trim()).filter(Boolean);
    const exclusionKeywords = (exclusions || '').toLowerCase().split(',').map(k => k.trim()).filter(Boolean);
    const pageTopics = contentMap.key_topics || [];

    let stability = 100;
    if (contentMap.headings?.filter(h => h.level === 'h1').length > 1) stability -= 20;
    if (!contentMap.title) stability -= 10;
    if (!contentMap.meta_description) stability -= 10;

    let trust = 50;
    if (pageTopics.includes('kontakt') || pageTopics.includes('contact')) trust += 20;
    if (pageTopics.includes('privacy') || pageTopics.includes('soukromí')) trust += 20;

    let meaning = 20 + (pageTopics.length * 10);

    let relevanceScore = 0;
    if (interestKeywords.some(keyword => pageTopics.includes(keyword))) {
        trust += 15;
        meaning += 20;
        relevanceScore = 1;
    }
    if (exclusionKeywords.some(keyword => pageTopics.includes(keyword))) {
        trust -= 30;
        meaning -= 20;
        relevanceScore = -1;
    }

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
            flow: { value: 50, saturation: 60 },
            will: { value: 50, saturation: 60 },
            voice: { value: 50, saturation: 60 },
            integrity: { value: 50, saturation: 60 }
        },
        circle: { color: circleColor },
        relevance: relevanceScore
    };
}

function generateLinkAura(url, currentHostname) {
    const u = new URL(url);

    let color = 'blue';
    let intent = 'Interní odkaz.';

    const isExternal = currentHostname ? (u.hostname !== currentHostname) : true;
    if (isExternal) {
        intent = 'Odkaz na externí doménu.';
        color = 'indigo';
    }

    const host = u.hostname.toLowerCase();

    if (host.includes('facebook.') || host.includes('twitter.') || host.includes('linkedin.') || host.includes('instagram.')) {
        color = 'indigo';
        intent = 'Odkaz na sociální síť.';
    } else if (u.pathname.match(/\.(zip|pdf|exe|dmg|rar|7z|tar\.gz)$/i)) {
        color = 'orange';
        intent = 'Odkaz ke stažení souboru.';
    } else if (host.includes('youtube.com') || host.includes('youtu.be') || host.includes('vimeo.com')) {
        color = 'red';
        intent = 'Odkaz na video platformu.';
    }

    return {
        circle: { color, intent },
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
