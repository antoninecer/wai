const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
const port = process.env.PORT || 3000;

app.use(express.json());

app.get('/', (req, res) => {
  res.send('Web Aura Index API is running!');
});

app.listen(port, () => {
  console.log(`API listening at http://localhost:${port}`);
});
