const express = require('express');
const app = express();

// Simple keep-alive server
app.get('/', (req, res) => {
    res.json({
        status: 'Bot is alive!',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

app.get('/ping', (req, res) => {
    res.send('pong');
});

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
    console.log(`Keep-alive server is running on port ${PORT}`);
});

module.exports = server;