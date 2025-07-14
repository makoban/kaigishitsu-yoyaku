const express = require('express');
const app = express();
const port = parseInt(process.env.PORT) || 8080;

app.get('/getApiKey', (req, res) => res.json({ apiKey: process.env.API_KEY || 'not set' }));
app.get('/', (req, res) => res.send('Running'));

app.listen(port, () => console.log(`Port ${port}`));
module.exports = app;
