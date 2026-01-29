const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const { createClient } = require('redis');

const app = express();
app.use(cors());
const port = process.env.PORT || 3000;
app.use(express.json());

// --- Připojení ---
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const redisClient = createClient({ url: process.env.REDIS_URL });
redisClient.on('error', (err) => console.log('Redis Client Error', err));
redisClient.connect();

const ANALYSIS_QUEUE_NAME = 'analysis_queue';
const PROCESSED_SET_NAME = 'processed_urls';
const REVALIDATION_INTERVAL_DAYS = 30;

// --- Endpointy ---
app.get('/', (req, res) => res.send('Web Aura Index API is running!'));

app.post('/analyze', async (req, res) => {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'URL is required' });

    try {
        const pageUrl = new URL(url);
        const domainName = pageUrl.hostname;
        const pagePath = pageUrl.pathname + pageUrl.search;

        const { rows: [domain] } = await pool.query('SELECT * FROM domains WHERE domain_name = $1', [domainName]);

        if (domain) {
            // Zkontrolujeme stáří záznamu
            const ageInDays = (new Date() - new Date(domain.last_analyzed)) / (1000 * 60 * 60 * 24);
            if (ageInDays > REVALIDATION_INTERVAL_DAYS) {
                console.log(`[DATA STALE] Domain ${domainName} is older than ${REVALIDATION_INTERVAL_DAYS} days. Queueing for re-analysis.`);
                await queueAnalysis(url);
            }

            // Najdeme data pro konkrétní stránku
            const { rows: [page] } = await pool.query('SELECT * FROM pages WHERE domain_id = $1 AND url = $2', [domain.id, pagePath]);
            if (page) {
                const { rows: links } = await pool.query('SELECT target_url, link_text, link_aura_circle FROM links WHERE source_page_id = $1', [page.id]);
                
                // Sestavíme odpověď
                const responsePayload = {
                    status: 'completed',
                    domainAura: domain.overall_aura_circle,
                    pageAura: {
                        star: page.page_aura_star,
                        circle: page.page_aura_circle,
                        content_map: page.content_map,
                        links: links.map(l => ({
                            url: l.target_url,
                            text: l.link_text,
                            aura: { circle: l.link_aura_circle }
                        }))
                    }
                };
                return res.json(responsePayload);
            }
        }

        // Pokud doména nebo stránka neexistuje, zařadíme do fronty
        console.log(`[DATA NOT FOUND] No data for ${url}. Queueing for analysis.`);
        await queueAnalysis(url);
        res.json({
            status: 'analyzing_domain',
            message: 'Domain analysis initiated. Check back later for full Aura map.'
        });

    } catch (err) {
        console.error('[API ERROR] Database or Redis error', err.stack);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// --- Pomocné funkce ---
async function queueAnalysis(url) {
    // Přidáme URL do sady, abychom věděli, že je ve frontě, a zabránili duplicitám
    const isMember = await redisClient.sIsMember(PROCESSED_SET_NAME, url);
    if (!isMember) {
        await redisClient.sAdd(PROCESSED_SET_NAME, url);
        await redisClient.lPush(ANALYSIS_QUEUE_NAME, url);
    }
}

app.listen(port, () => {
  console.log(`API listening at http://localhost:${port}`);
});
