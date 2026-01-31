const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const { createClient } = require('redis');

const app = express();
app.use(cors());
const port = process.env.PORT || 3000;
app.use(express.json());

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const redisClient = createClient({ url: process.env.REDIS_URL });
redisClient.on('error', (err) => console.log('Redis Client Error', err));
redisClient.connect();

const ANALYSIS_QUEUE_NAME = 'analysis_queue';

function generatePreliminaryAura(localData) {
    let stability = 100;
    if (localData.h1Count > 1) stability -= 20;
    if (!localData.title) stability -= 10;
    
    let trust = 50;
    if (localData.text.includes('kontakt') || localData.text.includes('contact')) trust += 20;

    const circleColor = stability > 70 ? 'green' : 'yellow';

    return {
        star: {
            stability: { value: stability, saturation: 40 },
            relation: { value: trust, saturation: 40 },
            meaning: { value: 50, saturation: 40 }
        },
        circle: {
            color: circleColor,
            intent: 'Předběžná analýza na základě struktury stránky.'
        },
        content_map: {
            title: localData.title,
            headings: [],
            key_topics: []
        },
        links: []
    };
}

app.post('/analyze', async (req, res) => {
    const { url, force_recrawl = false, localData } = req.body;
    if (!url) return res.status(400).json({ error: 'URL is required' });

    try {
        const pageUrl = new URL(url);
        const domainName = pageUrl.hostname;
        const pagePath = pageUrl.pathname + pageUrl.search;

        if (force_recrawl) {
            console.log(`[FORCE RECRAWL] Request for ${url}`);
            // Non-blocking call to clean up and queue
            cleanupAndQueue(req.body);
            return res.json({ status: 'analyzing_forced', message: 'Forced re-analysis initiated.' });
        }
        
        // --- Fast Path with Local Data ---
        if (localData) {
            const preliminaryAura = generatePreliminaryAura(localData);
            // Non-blocking call to queue deep analysis
            queueAnalysis(req.body);
            return res.json({
                status: 'preliminary',
                domainAura: { color: 'grey', intent: 'Unknown' },
                pageAura: preliminaryAura
            });
        }

        // --- Standard Polling / Cache Check ---
        const { rows: [page] } = await pool.query(
            `SELECT p.*, d.overall_aura_circle as domain_aura, 
             (SELECT json_agg(l.*) FROM links l WHERE l.source_page_id = p.id) as links
             FROM pages p JOIN domains d ON p.domain_id = d.id 
             WHERE d.domain_name = $1 AND p.url = $2`, [domainName, pagePath]
        );

        if (page) {
            return res.json({
                status: 'completed',
                domainAura: page.domain_aura,
                pageAura: {
                    star: page.page_aura_star,
                    circle: page.page_aura_circle,
                    content_map: page.content_map,
                    links: page.links || []
                }
            });
        } else {
            // Not found, analysis is likely in progress
            const { rows: [domain] } = await pool.query('SELECT * FROM domains WHERE domain_name = $1', [domainName]);
            return res.json({ 
                status: domain ? 'analyzing_page' : 'analyzing_domain',
                domainAura: domain ? domain.overall_aura_circle : null
            });
        }

    } catch (err) {
        console.error('[API ERROR]', err.stack);
        res.status(500).json({ error: 'Internal server error' });
    }
});

async function queueAnalysis(jobData) {
    const jobString = JSON.stringify(jobData);
    await redisClient.lPush(ANALYSIS_QUEUE_NAME, jobString);
    console.log(`[QUEUE] Added job for ${jobData.url}`);
}

async function cleanupAndQueue(jobData) {
    const { url } = jobData;
    const pageUrl = new URL(url);
    const domainName = pageUrl.hostname;
    const pagePath = pageUrl.pathname + pageUrl.search;
    
    const client = await pool.connect();
    try {
        const { rows: [page] } = await client.query('SELECT p.id FROM pages p JOIN domains d ON p.domain_id = d.id WHERE d.domain_name = $1 AND p.url = $2', [domainName, pagePath]);
        if (page) {
            await client.query('DELETE FROM links WHERE source_page_id = $1', [page.id]);
            await client.query('DELETE FROM page_topics WHERE page_id = $1', [page.id]);
            await client.query('DELETE FROM pages WHERE id = $1', [page.id]);
        }
    } catch(e) {
        console.error('[CLEANUP FAILED]', e);
    } finally {
        client.release();
    }
    await queueAnalysis(jobData);
}

app.listen(port, () => {
  console.log(`API listening on port ${port}`);
});
