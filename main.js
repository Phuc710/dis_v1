require('dotenv').config();

const { Player } = require('discord-player');
const { Client, GatewayIntentBits } = require('discord.js');
const { YoutubeiExtractor } = require('discord-player-youtubei');
const express = require('express');

global.client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.MessageContent,
    ],
    disableMentions: 'everyone',
});

client.config = require('./config');

const player = new Player(client, client.config.opt.discordPlayer);
player.extractors.register(YoutubeiExtractor, {});

// Tạo Express server cho keep-alive
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// Routes
app.get('/', (req, res) => {
    res.json({
        status: '🎵 Discord Music Bot is Running!',
        uptime: Math.floor(process.uptime()),
        memory: process.memoryUsage(),
        timestamp: new Date().toISOString(),
        bot: {
            username: client.user ? client.user.username : 'Not logged in',
            guilds: client.guilds ? client.guilds.cache.size : 0,
            ready: client.isReady()
        }
    });
});

app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        uptime: Math.floor(process.uptime()),
        memory: process.memoryUsage(),
        bot_ready: client.isReady(),
        timestamp: new Date().toISOString()
    });
});

app.get('/stats', (req, res) => {
    if (!client.isReady()) {
        return res.status(503).json({
            error: 'Bot is not ready yet',
            status: 'loading'
        });
    }

    res.json({
        guilds: client.guilds.cache.size,
        users: client.users.cache.size,
        channels: client.channels.cache.size,
        commands: client.commands ? client.commands.size : 0,
        uptime: Math.floor(process.uptime()),
        memory: process.memoryUsage(),
        ping: client.ws.ping,
        timestamp: new Date().toISOString()
    });
});

// Keep-alive endpoint for UptimeRobot hoặc cron jobs
app.get('/ping', (req, res) => {
    res.send('pong');
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🌐 Keep-alive server running on port ${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/health`);
    console.log(`📈 Stats: http://localhost:${PORT}/stats`);
});

// Load bot
console.clear();
require('./loader');

client.login(client.config.app.token).catch(async (e) => {
    if (e.message === 'An invalid token was provided.') {
        require('./process_tools').throwConfigError('app', 'token', '\n\t   ❌ Invalid Token Provided! ❌ \n\tChange the token in the config file\n');
    } else {
        console.error('❌ An error occurred while trying to login to the bot! ❌ \n', e);
    }
});

// Handle process termination
process.on('SIGINT', () => {
    console.log('🛑 Shutting down gracefully...');
    client.destroy();
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('🛑 Shutting down gracefully...');
    client.destroy();
    process.exit(0);
});