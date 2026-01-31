const { createClient } = require('redis');
const { Pool } = require('pg');
const axios = require('axios');
const cheerio =require('cheerio');

// --- Připojení ---
const redisClient = createClient({ url: process.env.REDIS_URL });
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const ANALYSIS_QUEUE_NAME = 'analysis_queue';
const PROCESSED_SET_NAME = 'processed_urls'; // Sada pro sledování již zpracovaných nebo zařazených URL

// --- Hlavní smyčka Workera ---
async function main() {
    await redisClient.connect();
    await pool.connect();
    console.log('Worker is connected and ready.');

    while (true) {
        try {
            const response = await redisClient.brPop(ANALYSIS_QUEUE_NAME, 0);
            const urlToAnalyze = response.element;
            
            console.log(`[JOB START] Analyzing: ${urlToAnalyze}`);
            await processUrl(urlToAnalyze);
            console.log(`[JOB SUCCESS] Finished: ${urlToAnalyze}`);

        } catch (err) {
            console.error('[WORKER LOOP ERROR]', err);
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
    }
}

// --- Logika zpracování jedné URL ---
async function processUrl(url) {
    const client = await pool.connect();
    try {
        // Získání HTML
        const { data: html } = await axios.get(url, { headers: { 'User-Agent': 'WAI-Bot/1.0' } });
        const $ = cheerio.load(html);
        const pageUrl = new URL(url);
        const domainName = pageUrl.hostname;

        // --- Extrakce Sémantické Mapy ---
        const contentMap = extractContentMap($);

        // --- Analýza Aury Stránky ---
        const pageAura = generatePageAura(contentMap);

        // --- Zahájení databázové transakce ---
        await client.query('BEGIN');

        // 1. Najít nebo vytvořit záznam pro doménu
        let { rows: [domain] } = await client.query('INSERT INTO domains (domain_name, last_analyzed) VALUES ($1, CURRENT_TIMESTAMP) ON CONFLICT (domain_name) DO UPDATE SET last_analyzed = CURRENT_TIMESTAMP RETURNING id', [domainName]);
        if (!domain) {
            ({ rows: [domain] } = await client.query('SELECT id FROM domains WHERE domain_name = $1', [domainName]));
        }
        const domainId = domain.id;
        
        // 2. Vytvořit nebo aktualizovat záznam pro stránku
        const { rows: [page] } = await client.query(
            `INSERT INTO pages (domain_id, url, title, meta_description, page_aura_circle, page_aura_star, content_map)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             ON CONFLICT (domain_id, url) DO UPDATE SET
               title = EXCLUDED.title, meta_description = EXCLUDED.meta_description, page_aura_circle = EXCLUDED.page_aura_circle,
               page_aura_star = EXCLUDED.page_aura_star, content_map = EXCLUDED.content_map, last_scraped = CURRENT_TIMESTAMP
             RETURNING id`,
            [domainId, pageUrl.pathname + pageUrl.search, contentMap.title, contentMap.meta_description, pageAura.circle, pageAura.star, contentMap]
        );
        const pageId = page.id;

        // 3. Zpracovat a uložit témata (klíčová slova)
        await client.query('DELETE FROM page_topics WHERE page_id = $1', [pageId]); // Smazat stará témata
        if (contentMap.key_topics && contentMap.key_topics.length > 0) {
            const topicValues = contentMap.key_topics.map(topic => `(${pageId}, '${topic.replace(/'/g, "''")}')`).join(',');
            await client.query(`INSERT INTO page_topics (page_id, topic) VALUES ${topicValues} ON CONFLICT DO NOTHING`);
        }

        // 4. Zpracovat a uložit odkazy a zařadit nové interní URL do fronty
        await client.query('DELETE FROM links WHERE source_page_id = $1', [pageId]); // Smazat staré odkazy
        const links = extractLinks($, pageUrl);
        for (const link of links) {
            const linkAura = generateLinkAura(link.url);
            await client.query(
                'INSERT INTO links (source_page_id, target_url, link_text, link_aura_circle) VALUES ($1, $2, $3, $4)',
                [pageId, link.url, link.text, linkAura.circle]
            );


            // Pokud je odkaz interní a ještě nebyl zpracován, přidej ho do fronty
            if (link.isInternal) {
                const normalizedUrl = link.url.split('#')[0];
                const isMember = await redisClient.sIsMember(PROCESSED_SET_NAME, normalizedUrl);
                if (!isMember) {
                    await redisClient.sAdd(PROCESSED_SET_NAME, normalizedUrl);
                    await redisClient.lPush(ANALYSIS_QUEUE_NAME, normalizedUrl);
                }
            }
        }
        
        // --- Ukončení transakce ---
        await client.query('COMMIT');
        
        // --- Aktualizace Agregované Aury Domény ---
        await updateDomainAura(domainId);

    } catch (err) {
        await client.query('ROLLBACK');
        console.error(`[TRANSACTION ROLLBACK] Error processing ${url}:`, err.message);
        throw err; // Předat chybu dál, aby ji hlavní smyčka zachytila
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

        // Najdeme nejčastější barvu
        const dominantColor = Object.entries(colorCounts).sort((a, b) => b[1] - a[1])[0][0];
        
        const domainAuraCircle = { color: dominantColor, intent: `Aggregated from ${pages.length} pages` };

        await pool.query('UPDATE domains SET overall_aura_circle = $1 WHERE id = $2', [domainAuraCircle, domainId]);
        console.log(`[DOMAIN AURA] Updated for domain ID ${domainId} to ${dominantColor}.`);
    } catch (err) {
        console.error(`[DOMAIN AURA ERROR] Could not update domain aura for ID ${domainId}:`, err.message);
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
            } catch (e) { /* Ignorovat neplatné URL */ }
        }
    });
    return links;
}

function generatePageAura(contentMap) {
    // Vylepšená, ale stále jednoduchá, rule-based analýza
    let stability = 100;
    if (contentMap.headings.filter(h => h.level === 'h1').length > 1) stability -= 20; // Penalizace za více H1
    if (!contentMap.title) stability -= 10;
    if (!contentMap.meta_description) stability -= 10;

    let trust = 50;
    if (contentMap.key_topics.includes('kontakt') || contentMap.key_topics.includes('contact')) trust += 20;
    if (contentMap.key_topics.includes('privacy') || contentMap.key_topics.includes('soukromí')) trust += 20;
    
    let meaning = 20 + (contentMap.key_topics.length * 10);
    meaning = Math.min(meaning, 100);

    const circleColor = stability > 70 && trust > 60 ? 'green' : (stability < 50 ? 'red' : 'yellow');

    return {
        star: { 
            stability: { value: stability, saturation: 95 },
            relation: { value: trust, saturation: 90 }, // Vztah/Důvěra
            meaning: { value: meaning, saturation: 80 }  // Smysl/Kontext
            // ... ostatní cípy mohou být defaultně 50
        },
        circle: { color: circleColor, intent: 'Vypočteno workerem' }
    };
}

function generateLinkAura(url) {
    const u = new URL(url);
    let color = 'blue'; // Default pro interní/běžný odkaz
    if (u.hostname.includes('facebook.') || u.hostname.includes('twitter.') || u.hostname.includes('linkedin.')) {
        color = 'indigo'; // Sociální sítě
    } else if (u.pathname.match(/\.(zip|pdf|exe|dmg)$/)) {
        color = 'orange'; // Download
    }
    return { circle: { color: color } };
}

main();
