require('dotenv').config();

try {
    require('sodium-native');
    console.log('✅ Using sodium-native for encryption');
} catch {
    try {
        require('tweetnacl');
        console.log('✅ Using tweetnacl for encryption');
    } catch {
        console.log('⚠️ No compatible encryption library found');
    }
}

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

const player = new Player(client, {
    skipFFmpeg: false,
    connectionTimeout: 30_000,
    leaveOnEnd: client.config.opt.leaveOnEnd,
    leaveOnEmpty: client.config.opt.leaveOnEmpty,
    leaveOnEmptyCooldown: client.config.opt.leaveOnEmptyCooldown,
    leaveOnEndCooldown: client.config.opt.leaveOnEndCooldown,
    bufferingTimeout: 10000, // Tăng timeout
    ytdlOptions: {
        quality: 'highestaudio',
        filter: 'audioonly',
        highWaterMark: 1 << 25,
        dlChunkSize: 0,
        requestOptions: {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        },
        // Thêm options cho Việt Nam
        format: 'audioonly',
        noPlaylist: true
    }
});

// IMPROVED ERROR HANDLING - THÊM ĐOẠN NÀY
player.events.on('error', (queue, error) => {
    console.error(`[PLAYER ERROR]: ${error.message}`);
    console.error(`[ERROR DETAILS]: ${error.stack}`);
    
    // Xử lý các lỗi thường gặp
    if (error.message.includes('Video unavailable')) {
        console.log('🚫 Video không khả dụng - có thể bị chặn khu vực hoặc riêng tư');
    } else if (error.message.includes('Sign in to confirm your age')) {
        console.log('🔞 Nội dung bị hạn chế độ tuổi');
    } else if (error.message.includes('This video is not available')) {
        console.log('📹 Video không khả dụng tại khu vực của bạn');
    }
    
    // Thử skip nếu có bài khác
    if (queue && queue.tracks && queue.tracks.size > 0) {
        console.log('🔄 Đang thử chuyển bài tiếp theo...');
        try {
            queue.node.skip();
        } catch (skipError) {
            console.error('❌ Không thể skip:', skipError.message);
        }
    }
});

player.events.on('playerError', (queue, error) => {
    console.error(`[PLAYER AUDIO ERROR]: ${error.message}`);
    console.error(`[AUDIO ERROR DETAILS]: ${error.stack}`);
    
    // Thử skip khi gặp lỗi audio
    if (queue && queue.tracks && queue.tracks.size > 0) {
        console.log('🔄 Lỗi audio, đang thử skip...');
        try {
            queue.node.skip();
        } catch (skipError) {
            console.error('❌ Không thể skip:', skipError.message);
        }
    }
});

// Thêm debug logs
player.events.on('audioTrackAdd', (queue, track) => {
    console.log(`✅ Đã thêm bài: ${track.title} - ${track.author}`);
    console.log(`🔗 Nguồn: ${track.source} | URL: ${track.url}`);
});

player.events.on('playerStart', (queue, track) => {
    console.log(`🎵 Đang phát: ${track.title} - ${track.author}`);
});

player.events.on('playerSkip', (queue, track) => {
    console.log(`⏭️ Đã skip: ${track.title} - ${track.author}`);
});

player.events.on('disconnect', (queue) => {
    console.log('🔌 Bot đã rời khỏi voice channel');
});

player.events.on('emptyQueue', (queue) => {
    console.log('📭 Queue đã hết bài');
});

try {
    player.extractors.register(YoutubeiExtractor, {
        authentication: process.env.YOUTUBE_COOKIE || undefined,
        streamOptions: {
            useClient: ['ANDROID', 'WEB']
        }
    });
    console.log('✅ YoutubeiExtractor registered successfully');
} catch (error) {
    console.error('❌ Failed to register YoutubeiExtractor:', error.message);
}

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

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
        },
        encryption: {
            sodium: (() => { try { require('sodium-native'); return true; } catch { return false; } })(),
            tweetnacl: (() => { try { require('tweetnacl'); return true; } catch { return false; } })()
        }
    });
});

app.get('/health', (req, res) => {
    const health = {
        status: 'healthy',
        uptime: Math.floor(process.uptime()),
        memory: process.memoryUsage(),
        bot_ready: client.isReady(),
        bot_status: client.isReady() ? 'online' : 'connecting',
        guilds: client.isReady() ? client.guilds.cache.size : 0,
        timestamp: new Date().toISOString(),
        version: '8.0.0'
    };
    
    if (!client.isReady()) {
        return res.status(503).json({
            ...health,
            status: 'unhealthy',
            error: 'Bot is not ready'
        });
    }
    
    res.json(health);
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

app.get('/ping', (req, res) => {
    res.send('pong');
});

setInterval(() => {
    if (process.env.NODE_ENV === 'production' && process.env.RENDER_EXTERNAL_HOSTNAME) {
        const https = require('https');
        const url = `https://${process.env.RENDER_EXTERNAL_HOSTNAME}/health`;
        
        https.get(url, (res) => {
            console.log(`Self-ping successful: ${res.statusCode}`);
        }).on('error', (err) => {
            console.error('Self-ping failed:', err.message);
        });
    }
}, 840000);

setInterval(() => {
    const memUsage = process.memoryUsage();
    const memUsageMB = {
        rss: Math.round(memUsage.rss / 1024 / 1024),
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
        external: Math.round(memUsage.external / 1024 / 1024)
    };
    
    console.log(`Memory usage: ${memUsageMB.heapUsed}MB / ${memUsageMB.heapTotal}MB`);
    
    if (memUsageMB.heapUsed > 400) {
        console.warn('⚠️ High memory usage detected');
    }
}, 300000);

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🌐 Keep-alive server running on port ${PORT}`);
    console.log(`🔊 Health check: http://localhost:${PORT}/health`);
    console.log(`📈 Stats: http://localhost:${PORT}/stats`);
});

console.clear();
require('./loader');

client.login(client.config.app.token).catch(async (e) => {
    if (e.message === 'An invalid token was provided.') {
        require('./process_tools').throwConfigError('app', 'token', '\n\t   ❌ Invalid Token Provided! ❌ \n\tChange the token in the config file\n');
    } else {
        console.error('❌ An error occurred while trying to login to the bot! ❌ \n', e);
    }
});

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

process.on('unhandledRejection', (error) => {
    console.error('Unhandled promise rejection:', error);
});

process.on('uncaughtException', (error) => {
    console.error('Uncaught exception:', error);
    if (!error.message.includes('encryption')) {
        process.exit(1);
    }
});