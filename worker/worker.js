const { createClient } = require('redis');
const { Pool } = require('pg');
const axios = require('axios');
const cheerio = require('cheerio');

// Nastavení připojení
const redisClient = createClient({ url: process.env.REDIS_URL });
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const ANALYSIS_QUEUE_NAME = 'analysis_queue';

async function main() {
    await redisClient.connect();
    console.log('Worker connected to Redis.');
    await pool.connect();
    console.log('Worker connected to PostgreSQL.');

    console.log('Worker is ready and waiting for jobs...');

    while (true) {
        try {
            // Čekání na úkol ve frontě (blokující operace)
            const response = await redisClient.brPop(ANALYSIS_QUEUE_NAME, 0);
            const urlToAnalyze = response.element;
            
            console.log(`[${new Date().toISOString()}] Received job: Analyze ${urlToAnalyze}`);

            // Skutečná analýza
            const { data: html } = await axios.get(urlToAnalyze);
            const $ = cheerio.load(html);

            const links = [];
            $('a').each((i, element) => {
                const href = $(element).attr('href');
                if (href && !href.startsWith('#')) {
                    try {
                        const absoluteUrl = new URL(href, urlToAnalyze).href;
                        links.push({
                            url: absoluteUrl,
                            text: $(element).text().trim(),
                            aura: getMockAuraForLink(absoluteUrl) 
                        });
                    } catch (e) {
                        console.log(`Skipping invalid URL: ${href}`);
                    }
                }
            });

            console.log(`[${new Date().toISOString()}] Found ${links.length} links on ${urlToAnalyze}. Saving to DB...`);
            
            // Finální objekt pro uložení
            const auraMap = {
                star: { stability: { value: 85, saturation: 90 } }, // Příklad statické aury pro hlavní stránku
                circle: { color: 'blue', intent: 'Analyzed by Worker' },
                summary: `Successfully analyzed. Found ${links.length} links.`,
                links: links
            };

            await pool.query('INSERT INTO websites (url, aura_map) VALUES ($1, $2) ON CONFLICT (url) DO UPDATE SET aura_map = $2, updated_at = CURRENT_TIMESTAMP', [urlToAnalyze, auraMap]);
            
            console.log(`[${new Date().toISOString()}] Successfully saved analysis for ${urlToAnalyze}`);

        } catch (err) {
            console.error(`An error occurred while analyzing ${err.config?.url || 'URL'}:`, err.message);
            // Počkáme chvíli před dalším pokusem
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
    }
}

// Funkce pro generování dočasné aury pro odkaz
function getMockAuraForLink(url) {
    const colors = ['red', 'orange', 'yellow', 'green', 'blue', 'indigo', 'white'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];
    return {
        circle: { color: randomColor }
    };
}

main();
