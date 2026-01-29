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

            // Zde bude logika pro analýzu
            // 1. Stáhnout HTML
            // 2. Naparsovat odkazy pomocí Cheerio
            // 3. Pro každý odkaz provést povrchovou analýzu
            // 4. Vytvořit finální objekt Aura Map
            // 5. Uložit výsledek do PostgreSQL

            console.log(`[${new Date().toISOString()}] Mock analysis finished for ${urlToAnalyze}. Saving to DB...`);
            
            // Dočasné: Uložení placeholder dat, abychom viděli, že to funguje
            const mockAuraMap = {
                star: { stability: { value: 50, saturation: 50 } },
                circle: { color: 'gray', intent: 'Analyzed by Worker' },
                summary: `This is a mock analysis for ${urlToAnalyze}`,
                links: []
            };

            await pool.query('INSERT INTO websites (url, aura_map) VALUES ($1, $2) ON CONFLICT (url) DO UPDATE SET aura_map = $2, updated_at = CURRENT_TIMESTAMP', [urlToAnalyze, mockAuraMap]);
            
            console.log(`[${new Date().toISOString()}] Successfully saved analysis for ${urlToAnalyze}`);

        } catch (err) {
            console.error('An error occurred in the worker loop:', err);
            // Počkáme chvíli před dalším pokusem, abychom nezahltili logy v případě trvalé chyby
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
    }
}

main();
