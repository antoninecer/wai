const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const { createClient } = require('redis');

const app = express();
app.use(cors());
const port = process.env.PORT || 3000;

app.use(express.json());

// Nastavení připojení k PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Nastavení připojení k Redis
const redisClient = createClient({
  url: process.env.REDIS_URL
});
redisClient.on('error', (err) => console.log('Redis Client Error', err));
redisClient.connect();

app.get('/', (req, res) => {
  res.send('Web Aura Index API is running!');
});

// Upravený endpoint pro příjem dat z pluginu
app.post('/analyze', async (req, res) => {
  const { url } = req.body;
  console.log(`Received analysis request for URL: ${url}`);

  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  try {
    const result = await pool.query('SELECT aura_map FROM websites WHERE url = $1', [url]);

    if (result.rows.length > 0) {
      // Záznam nalezen, vracíme mapu aury
      console.log(`Aura map found for ${url}.`);
      res.json({
        status: 'completed',
        auraMap: result.rows[0].aura_map,
      });
    } else {
      // Záznam nenalezen, přidáme úkol do fronty v Redisu
      console.log(`No aura map found for ${url}. Queueing for analysis.`);
      await redisClient.lPush('analysis_queue', url);
      
      res.json({
        status: 'analyzing_domain',
        message: 'Domain analysis initiated. Check back later for full Aura map.'
      });
    }
  } catch (err) {
    console.error('Database or Redis error', err.stack);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(port, () => {
  console.log(`API listening at http://localhost:${port}`);
});
