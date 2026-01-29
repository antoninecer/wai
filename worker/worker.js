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

        // --- Analýza Aury Stránky (dočasná) ---
        const pageAura = generateMockAura(contentMap);

        // --- Zahájení databázové transakce ---
        await client.query('BEGIN');

        // 1. Najít nebo vytvořit záznam pro doménu
        let { rows: [domain] } = await client.query('INSERT INTO domains (domain_name) VALUES ($1) ON CONFLICT (domain_name) DO NOTHING RETURNING id', [domainName]);
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
            const linkAura = generateMockAuraForLink(link.url);
            await client.query(
                'INSERT INTO links (source_page_id, target_url, link_text, link_aura_circle) VALUES ($1, $2, $3, $4)',
                [pageId, link.url, link.text, linkAura.circle]
            );

            // Pokud je odkaz interní a ještě nebyl zpracován, přidej ho do fronty
            if (link.isInternal) {
                const isMember = await redisClient.sIsMember(PROCESSED_SET_NAME, link.url);
                if (!isMember) {
                    await redisClient.sAdd(PROCESSED_SET_NAME, link.url);
                    await redisClient.lPush(ANALYSIS_QUEUE_NAME, link.url);
                }
            }
        }
        
        // --- Ukončení transakce ---
        await client.query('COMMIT');

    } catch (err) {
        await client.query('ROLLBACK');
        console.error(`[TRANSACTION ROLLBACK] Error processing ${url}:`, err.message);
        throw err; // Předat chybu dál, aby ji hlavní smyčka zachytila
    } finally {
        client.release();
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

function generateMockAura(contentMap) {
    // Simulace analýzy pro hlavní stránku
    const stability = 90 - (contentMap.headings.filter(h => h.level === 'h1').length > 1 ? 20 : 0); // penalizace za více H1
    return {
        star: { stability: { value: stability, saturation: 95 } /* ... další cípy ... */ },
        circle: { color: 'green', intent: 'Service' }
    };
}

function generateMockAuraForLink(url) {
    const colors = ['red', 'orange', 'yellow', 'green', 'blue'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];
    return { circle: { color: randomColor } };
}

main();
