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
    const { url, force_recrawl = false } = req.body;
    if (!url) return res.status(400).json({ error: 'URL is required' });

    try {
        const pageUrl = new URL(url);
        const domainName = pageUrl.hostname;
        const pagePath = pageUrl.pathname + pageUrl.search;
        
        // --- VYNUCENÁ RE-ANALÝZA ---
        if (force_recrawl) {
            console.log(`[FORCE RECRAWL] Request received for ${url}`);
            const client = await pool.connect();
            try {
                await client.query('BEGIN');
                const { rows: [page] } = await client.query('SELECT p.id, d.id as domain_id FROM pages p JOIN domains d ON p.domain_id = d.id WHERE d.domain_name = $1 AND p.url = $2', [domainName, pagePath]);
                if (page) {
                    // Smažeme staré odkazy a témata navázané na stránku
                    await client.query('DELETE FROM links WHERE source_page_id = $1', [page.id]);
                    await client.query('DELETE FROM page_topics WHERE page_id = $1', [page.id]);
                    // Smažeme samotnou stránku
                    await client.query('DELETE FROM pages WHERE id = $1', [page.id]);
                    console.log(`[FORCE RECRAWL] Deleted old page data for page ID ${page.id}`);
                }
                await client.query('COMMIT');
            } catch (e) {
                await client.query('ROLLBACK');
                console.error('[FORCE RECRAWL] Error during DB cleanup, rolling back.', e);
            } finally {
                client.release();
            }
            
            // Zařadíme úkol a vrátíme status, že analýza běží
            await queueAnalysis(req.body); 
            return res.json({ status: 'analyzing_forced', message: 'Forced re-analysis initiated.' });
        }
        
        // --- STANDARDNÍ ZPRACOVÁNÍ S CACHE ---
        const { rows: [domain] } = await pool.query('SELECT * FROM domains WHERE domain_name = $1', [domainName]);
        if (domain) {
            const { rows: [page] } = await pool.query(
                `SELECT p.*,
                 (SELECT json_agg(json_build_object('url', l.target_url, 'text', l.link_text, 'aura', l.link_aura_circle)) FROM links l WHERE l.source_page_id = p.id) as links
                 FROM pages p WHERE p.domain_id = $1 AND p.url = $2`, [domain.id, pagePath]
            );

            if (page) {
                // "Samoopravný" mechanismus: Pokud jsou data evidentně stará, vrátíme je, ale na pozadí spustíme re-analýzu
                if (page.page_aura_circle && page.page_aura_circle.intent === 'Vypočteno workerem') {
                    console.log(`[DATA STALE] Stale 'intent' found for ${url}. Returning data and queueing re-analysis.`);
                    // Na pozadí pošleme požadavek na re-analýzu
                    queueAnalysis({ ...req.body, force_recrawl: true }); 
                }

                // Máme čerstvá data, vrátíme je
                 return res.json({
                    status: 'completed',
                    domainAura: domain.overall_aura_circle,
                    pageAura: {
                        star: page.page_aura_star,
                        circle: page.page_aura_circle,
                        content_map: page.content_map,
                        links: page.links || []
                    }
                });
            } else {
                await queueAnalysis(req.body);
                return res.json({ status: 'analyzing_page', domainAura: domain.overall_aura_circle });
            }
                await queueAnalysis(req.body);
                return res.json({ status: 'analyzing_page', domainAura: domain.overall_aura_circle });
            }
        }

        // Pokud doména neexistuje
        await queueAnalysis(req.body);
        res.json({ status: 'analyzing_domain', message: 'Domain analysis initiated.' });

    } catch (err) {
        console.error('[API ERROR]', err.stack);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Upravená funkce pro zařazení úkolu do fronty
async function queueAnalysis(jobData) {
    const url = jobData.url;
    const isMember = await redisClient.sIsMember(PROCESSED_SET_NAME, url);
    // Pokud není ve frontě NEBO pokud je to vynucená reanalýza, přidáme.
    // (Při force_recrawl jsme starý záznam smazali, takže je to bezpečné)
    if (!isMember || jobData.force_recrawl) {
        await redisClient.sAdd(PROCESSED_SET_NAME, url);
        // Do fronty vložíme celý objekt, nejen URL
        await redisClient.lPush(ANALYSIS_QUEUE_NAME, JSON.stringify(jobData));
    }
}

app.listen(port, () => {
  console.log(`API listening at http://localhost:${port}`);
});
