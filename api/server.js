const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const { createClient } = require('redis');
const crypto = require('crypto');

const app = express();
app.use(cors());
app.use(express.json());

const port = process.env.PORT || 3000;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const redisClient = createClient({ url: process.env.REDIS_URL });

redisClient.on('error', (err) => console.log('Redis Client Error', err));

const ANALYSIS_QUEUE_NAME = 'analysis_queue';

// TTL pro deduplikaci jobů (sekundy). 10 minut = rozumné proti "polling storm".
const QUEUE_DEDUPE_TTL_SEC = 600;

function hashUrl(url) {
    return crypto.createHash('sha1').update(url).digest('hex');
}

function generatePreliminaryAura(localData) {
    let stability = 100;
    if (localData.h1Count > 1) stability -= 20;
    if (!localData.title) stability -= 10;

    let trust = 50;
    if ((localData.text || '').includes('kontakt') || (localData.text || '').includes('contact')) trust += 20;

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

// Deduplikovaná fronta: stejnou URL nepřidá opakovaně během TTL.
// ZÁMĚRNĚ neposíláme do fronty localData (může být obrovské a worker ho nepotřebuje).
async function queueAnalysis(jobData, opts = {}) {
    const force = opts.force === true;

    if (!jobData || !jobData.url) return;

    const minimalJob = {
        url: jobData.url,
        interests: jobData.interests || '',
        exclusions: jobData.exclusions || ''
    };

    const dedupeKey = `wai:queue:${hashUrl(minimalJob.url)}`;

    if (force) {
        await redisClient.del(dedupeKey);
    }

    // SET NX s TTL: pokud už klíč existuje, job nepřidáme
    const setRes = await redisClient.set(dedupeKey, '1', { NX: true, EX: QUEUE_DEDUPE_TTL_SEC });
    if (setRes !== 'OK') {
        console.log(`[QUEUE SKIP] Duplicate within TTL for ${minimalJob.url}`);
        return;
    }

    await redisClient.lPush(ANALYSIS_QUEUE_NAME, JSON.stringify(minimalJob));
    console.log(`[QUEUE] Added job for ${minimalJob.url}`);
}

async function cleanupAndQueue(jobData) {
    const { url } = jobData;
    const pageUrl = new URL(url);
    const domainName = pageUrl.hostname;
    const pagePath = pageUrl.pathname + pageUrl.search;

    const client = await pool.connect();
    try {
        const { rows: [page] } = await client.query(
            'SELECT p.id FROM pages p JOIN domains d ON p.domain_id = d.id WHERE d.domain_name = $1 AND p.url = $2',
            [domainName, pagePath]
        );

        if (page) {
            await client.query('DELETE FROM links WHERE source_page_id = $1', [page.id]);
            await client.query('DELETE FROM page_topics WHERE page_id = $1', [page.id]);
            await client.query('DELETE FROM pages WHERE id = $1', [page.id]);
        }
    } catch (e) {
        console.error('[CLEANUP FAILED]', e);
    } finally {
        client.release();
    }

    // vynutit enqueue i když už to v TTL okně bylo
    await queueAnalysis(jobData, { force: true });
}

/**
 * NOVÉ: Link preview s volitelným "safe enqueue".
 *
 * Body:
 * {
 *   "url": "https://rightdone.eu/about.php",
 *   "queueIfMissing": true,
 *   "interests": "...",      // volitelné
 *   "exclusions": "..."      // volitelné
 * }
 *
 * Odpovědi:
 * - { status: "known", pageAura: {...} }
 * - { status: "queued", message: "...", domain, path }
 * - { status: "unknown", ... } (když queueIfMissing=false)
 */
app.post('/link-preview', async (req, res) => {
    const { url, queueIfMissing = false, interests = '', exclusions = '' } = req.body || {};
    if (!url) return res.status(400).json({ error: 'URL is required' });

    try {
        const u = new URL(url);

        // základní bezpečnost: jen http/https
        if (u.protocol !== 'http:' && u.protocol !== 'https:') {
            return res.status(400).json({ error: 'Only http/https URLs are supported' });
        }

        const domainName = u.hostname;
        const pagePath = u.pathname + u.search;

        const { rows: [page] } = await pool.query(
            `SELECT p.page_aura_star, p.page_aura_circle, p.content_map
             FROM pages p
             JOIN domains d ON p.domain_id = d.id
             WHERE d.domain_name = $1 AND p.url = $2`,
            [domainName, pagePath]
        );

        if (page) {
            const contentMap = page.content_map || {};
            const blocked = !!contentMap.blocked;

            return res.json({
                status: 'known',
                url,
                domain: domainName,
                path: pagePath,
                blocked,
                pageAura: {
                    star: page.page_aura_star,
                    circle: page.page_aura_circle,
                    content_map: contentMap
                }
            });
        }

        // není v DB → podle nastavení buď jen řekneme unknown, nebo bezpečně enqueue
        if (queueIfMissing) {
            // používáme tvou deduplikovanou queue
            queueAnalysis({ url, interests, exclusions });

            return res.json({
                status: 'queued',
                url,
                domain: domainName,
                path: pagePath,
                message: 'Cíl nebyl v databázi – zařazuji bezpečně do analýzy.'
            });
        }

        return res.json({
            status: 'unknown',
            url,
            domain: domainName,
            path: pagePath
        });

    } catch (err) {
        console.error('[LINK PREVIEW ERROR]', err.stack);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/analyze', async (req, res) => {
    const { url, force_recrawl = false, localData } = req.body;
    if (!url) return res.status(400).json({ error: 'URL is required' });

    try {
        const pageUrl = new URL(url);
        const domainName = pageUrl.hostname;
        const pagePath = pageUrl.pathname + pageUrl.search;

        if (force_recrawl) {
            console.log(`[FORCE RECRAWL] Request for ${url}`);
            // Non-blocking cleanup + queue
            cleanupAndQueue(req.body);
            return res.json({ status: 'analyzing_forced', message: 'Forced re-analysis initiated.' });
        }

        // --- Fast Path with Local Data ---
        // DŮLEŽITÉ: localData může přijít opakovaně při každém otevření/pollingu.
        // Proto i tady používáme dedupe (jinak vzniká queue storm).
        if (localData) {
            const preliminaryAura = generatePreliminaryAura(localData);

            // Non-blocking call to queue deep analysis (dedupe uvnitř)
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
             WHERE d.domain_name = $1 AND p.url = $2`,
            [domainName, pagePath]
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
        }

        // Not found, analysis is likely in progress (nequeueujeme tady znovu)
        const { rows: [domain] } = await pool.query('SELECT * FROM domains WHERE domain_name = $1', [domainName]);

        return res.json({
            status: domain ? 'analyzing_page' : 'analyzing_domain',
            domainAura: domain ? domain.overall_aura_circle : null
        });

    } catch (err) {
        console.error('[API ERROR]', err.stack);
        res.status(500).json({ error: 'Internal server error' });
    }
});

async function init() {
    await redisClient.connect();
    console.log('Redis connected.');

    // jen sanity check
    await pool.query('SELECT 1');
    console.log('Postgres connected.');

    app.listen(port, () => {
        console.log(`API listening on port ${port}`);
    });
}

init().catch((e) => {
    console.error('[INIT FAILED]', e);
    process.exit(1);
});
