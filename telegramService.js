const TelegramBot = require('node-telegram-bot-api');
const { HttpsProxyAgent } = require('https-proxy-agent');
const { getRobotById, db } = require('./db');

// 新增：代理地址
const PROXY_URL = process.env.PROXY_URL || 'http://127.0.0.1:10809';
const proxyAgent = new HttpsProxyAgent(PROXY_URL);

// 保持已创建的 bot 实例
const bots = new Map();

// per-bot token-bucket 简易实现
class RateLimiter {
    constructor(permitsPerSec) {
        this.permits = permitsPerSec || 1; // 每秒允许的操作数
        this.maxPermits = this.permits;
        this.available = this.permits;
        setInterval(() => {
            this.available = Math.min(this.maxPermits, this.available + this.permits);
        }, 1000);
    }

    tryRemove() {
        if (this.available >= 1) {
            this.available -= 1;
            return true;
        }
        return false;
    }
}

function getOrCreateBot(robotRecord, defaultRate) {
    if (!robotRecord || !robotRecord.token) throw new Error('invalid robot');
    if (bots.has(robotRecord.id)) return bots.get(robotRecord.id);
    const bot = new TelegramBot(robotRecord.token, {
        polling: false,
        request: {
            agent: proxyAgent
        }
    });
    bot._meta = {
        id: robotRecord.id,
        limiter: new RateLimiter(robotRecord.rate_limit || defaultRate || 1),
        enabled: !!robotRecord.enabled
    };
    bots.set(robotRecord.id, bot);
    return bot;
}

async function sendMessage(botRecord, chatId, text, options = {}) {
    const bot = getOrCreateBot(botRecord, parseFloat(process.env.DEFAULT_RATE_LIMIT || 1));
    if (!bot._meta.enabled) throw new Error('bot offline');

    if (!bot._meta.limiter.tryRemove()) throw new Error('rate_limited');

    return await bot.sendMessage(chatId, text, options);
}

async function sendPhoto(botRecord, chatId, bufferOrUrl, options = {}) {
    const bot = getOrCreateBot(botRecord, parseFloat(process.env.DEFAULT_RATE_LIMIT || 1));
    if (!bot._meta.enabled) throw new Error('bot offline');
    if (!bot._meta.limiter.tryRemove()) throw new Error('rate_limited');

    return await bot.sendPhoto(chatId, bufferOrUrl, options);
}

async function editMessage(botRecord, chatId, messageId, text, options = {}) {
    const bot = getOrCreateBot(botRecord, parseFloat(process.env.DEFAULT_RATE_LIMIT || 1));
    if (!bot._meta.enabled) throw new Error('bot offline');
    if (!bot._meta.limiter.tryRemove()) throw new Error('rate_limited');

    return bot.editMessageText(text, Object.assign({ chat_id: chatId, message_id: messageId }, options));
}

async function deleteMessage(botRecord, chatId, messageId) {
    const bot = getOrCreateBot(botRecord, parseFloat(process.env.DEFAULT_RATE_LIMIT || 1));
    if (!bot._meta.enabled) throw new Error('bot offline');
    if (!bot._meta.limiter.tryRemove()) throw new Error('rate_limited');

    return bot.deleteMessage(chatId, messageId);
}

async function pinMessage(botRecord, chatId, messageId, options = {}) {
    const bot = getOrCreateBot(botRecord, parseFloat(process.env.DEFAULT_RATE_LIMIT || 1));
    if (!bot._meta.enabled) throw new Error('bot offline');
    if (!bot._meta.limiter.tryRemove()) throw new Error('rate_limited');

    return bot.pinChatMessage(chatId, messageId, options);
}

// 根据本地消息ID获取映射
function getMessageMap(localId) {
    return db.prepare('SELECT * FROM message_map WHERE id=?').get(localId);
}

async function editUsMessage(localId, newText) {
    const map = getMessageMap(localId);
    if (!map) throw new Error(`message not found: ${localId}`);
    const bot = getOrCreateBot(await getRobotById(map.bot_id));
    return await bot.editMessageText(newText, { chat_id: map.chat_id, message_id: map.tg_message_id });
}

async function deleteUsMessage(localId) {
    const map = getMessageMap(localId);
    if (!map) throw new Error(`message not found: ${localId}`);
    const bot = getOrCreateBot(await getRobotById(map.bot_id));
    return await bot.deleteMessage(map.chat_id, map.tg_message_id);
}

async function pinUsMessage(localId) {
    const map = getMessageMap(localId);
    if (!map) throw new Error(`message not found: ${localId}`);
    const bot = getOrCreateBot(await getRobotById(map.bot_id));
    return await bot.pinChatMessage(map.chat_id, map.tg_message_id);
}

async function unpinUsMessage(localId) {
    const map = getMessageMap(localId);
    if (!map) throw new Error(`message not found: ${localId}`);
    const bot = getOrCreateBot(await getRobotById(map.bot_id));
    return await bot.unpinChatMessage(map.chat_id, { message_id: map.tg_message_id });
}

async function replyToUsMessage(localId, text) {
    const map = getMessageMap(localId);
    if (!map) throw new Error(`message not found: ${localId}`);
    const bot = getOrCreateBot(await getRobotById(map.bot_id));
    return await bot.sendMessage(map.chat_id, text, { reply_to_message_id: map.tg_message_id });
}


module.exports = {
    getOrCreateBot,
    sendMessage,
    sendPhoto,
    editMessage,
    deleteMessage,
    pinMessage,
    editUsMessage,
    deleteUsMessage,
    pinUsMessage,
    unpinUsMessage,
    replyToUsMessage
};