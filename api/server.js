const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
const port = process.env.PORT || 3000;

app.use(express.json());

app.get('/', (req, res) => {
  res.send('Web Aura Index API is running!');
});

// Nový endpoint pro příjem dat z pluginu
app.post('/analyze', (req, res) => {
  const lightAnalysisData = req.body;
  console.log('Received light analysis data from plugin:', lightAnalysisData);

  // Zde by normálně probíhala kontrola databáze a Redis fronty
  // Prozatím vracíme placeholder odpověď
  res.json({
    status: 'analyzing_domain',
    message: 'Domain analysis initiated. Check back later for full Aura map.'
  });
});

app.listen(port, () => {
  console.log(`API listening at http://localhost:${port}`);
});
