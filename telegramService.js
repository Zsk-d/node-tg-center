const TelegramBot = require('node-telegram-bot-api');
const { HttpsProxyAgent } = require('https-proxy-agent');
const { getRobotById, db, getMessageMap } = require('./db');

// 新增：代理地址
const PROXY_URL = process.env.PROXY_URL;
let proxyAgent = null
if (PROXY_URL) {
    proxyAgent = new HttpsProxyAgent(PROXY_URL);
}

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
        enabled: !!robotRecord.enabled,
        listening: false,        // 添加监听状态标志
        handlersSetup: false     // 添加处理器设置标志
    };
    bots.set(robotRecord.id, bot);
    return bot;
}

async function sendMessage(botRecord, chatId, text, format, options = {}) {
    const bot = getOrCreateBot(botRecord, parseFloat(process.env.DEFAULT_RATE_LIMIT || 1));
    if (!bot._meta.enabled) throw new Error('bot offline');

    if (!bot._meta.limiter.tryRemove()) throw new Error('rate_limited');
    const sendOptions = {
        parse_mode: format ? format : 'MarkdownV2', // or 'Markdown' if you prefer old syntax
        ...options,
    };

    return await bot.sendMessage(chatId, text, sendOptions);
}

async function sendPhoto(botRecord, chatId, bufferOrUrl, options = {}) {
    const bot = getOrCreateBot(botRecord, parseFloat(process.env.DEFAULT_RATE_LIMIT || 1));
    if (!bot._meta.enabled) throw new Error('bot offline');
    if (!bot._meta.limiter.tryRemove()) throw new Error('rate_limited');

    const sendOptions = {
        parse_mode: 'MarkdownV2', // or 'Markdown' if you prefer old syntax
        ...options,
    };
    return await bot.sendPhoto(chatId, bufferOrUrl, sendOptions);
}

async function editMessage(botRecord, chatId, messageId, text, options = {}) {
    const bot = getOrCreateBot(botRecord, parseFloat(process.env.DEFAULT_RATE_LIMIT || 1));
    if (!bot._meta.enabled) throw new Error('bot offline');
    if (!bot._meta.limiter.tryRemove()) throw new Error('rate_limited');

    const sendOptions = {
        parse_mode: 'MarkdownV2', // or 'Markdown' if you prefer old syntax
        ...options,
    };
    return bot.editMessageText(text, Object.assign({ chat_id: chatId, message_id: messageId }, sendOptions));
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

async function editUsMessage(localId, newText) {
    const map = getMessageMap(localId);
    if (!map) throw new Error(`message not found: ${localId}`);
    const bot = getOrCreateBot(await getRobotById(map.bot_id));

    const sendOptions = {
        parse_mode: 'MarkdownV2', // or 'Markdown' if you prefer old syntax
        ...options,
    };
    return await bot.editMessageText(newText, { chat_id: map.chat_id, message_id: map.tg_message_id, ...sendOptions });
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

    const sendOptions = {
        parse_mode: 'MarkdownV2', // or 'Markdown' if you prefer old syntax
        ...options,
    };
    return await bot.sendMessage(map.chat_id, text, { reply_to_message_id: map.tg_message_id, ...sendOptions });
}

async function sendfile(botRecord, chatid, filePath, msgOption, sendOption) {
    const bot = getOrCreateBot(botRecord, parseFloat(process.env.DEFAULT_RATE_LIMIT || 1));
    return await bot.sendDocument(chatid, filePath, msgOption, sendOption);
}

// 添加表情回应功能
async function sendReaction(localId, emoji) {
    const map = getMessageMap(localId);
    if (!map) throw new Error(`message not found: ${localId}`);
    const bot = getOrCreateBot(await getRobotById(map.bot_id));

    return await bot.setMessageReaction(map.chat_id, map.tg_message_id, { reaction: [{ emoji, type: 'emoji' }] });
}

// 工具类：用于控制机器人监听状态
class BotController {
    static async startBotListening(bot) {
        if (!bot._meta.listening) {
            try {
                // 添加消息监听处理器（仅在尚未设置时）
                if (!bot._meta.handlersSetup) {
                    this.setupMessageHandlers(bot);
                    bot._meta.handlersSetup = true;
                }

                await bot.startPolling();
                bot._meta.listening = true;
                console.log(`Bot ${bot._meta.id} started listening`);
            } catch (error) {
                console.error(`Error starting bot ${bot._meta.id}:`, error);
                throw error;
            }
        }
    }

    static async stopBotListening(bot) {
        if (bot._meta.listening) {
            try {
                await bot.stopPolling();
                bot._meta.listening = false;
                console.log(`Bot ${bot._meta.id} stopped listening`);
            } catch (error) {
                console.error(`Error stopping bot ${bot._meta.id}:`, error);
                throw error;
            }
        }
    }

    static async toggleBotListening(robotId, enabled) {
        const bot = getOrCreateBot(await getRobotById(robotId));
        if (bot) {
            if (enabled) {
                await this.startBotListening(bot);
            } else {
                await this.stopBotListening(bot);
            }
        } else {
            console.log(`Bot ${robotId} not found in cache`);
        }
    }

    // 设置消息处理器
    static setupMessageHandlers(bot) {
        // 文本消息处理示例
        bot.on('message', async (msg) => {
            const chatId = msg.chat.id;
            const text = msg.text || '';

            console.log(`Received message from ${chatId}: ${text}`);

            // 示例：处理 /start 命令
            if (text === '/start') {
                try {
                    await bot.sendMessage(chatId, '欢迎使用本机器人！请输入 /help 查看帮助信息。');
                } catch (error) {
                    console.error('Error sending welcome message:', error);
                }
                return;
            }

            // 示例：处理 /help 命令
            if (text === '/help') {
                try {
                    await bot.sendMessage(chatId, '这是帮助信息：\n- 使用 /start 开始\n- 使用 /help 查看帮助\n- 发送任何其他消息进行测试');
                } catch (error) {
                    console.error('Error sending help message:', error);
                }
                return;
            }

            // 默认回复
            try {
                await bot.sendMessage(chatId, `您发送了: "${text}"\n这是一条自动回复。`);
            } catch (error) {
                console.error('Error sending auto reply:', error);
            }
        });

        // 处理回调查询（按钮点击等）
        bot.on('callback_query', async (callbackQuery) => {
            const chatId = callbackQuery.message.chat.id;
            const data = callbackQuery.data;

            console.log(`Callback query from ${chatId}: ${data}`);

            try {
                // 回答应答
                await bot.answerCallbackQuery(callbackQuery.id, {
                    text: `您点击了: ${data}`
                });

                // 可以根据data值执行不同的操作
                if (data === 'help') {
                    await bot.sendMessage(chatId, '这是通过按钮获取的帮助信息');
                }
            } catch (error) {
                console.error('Error handling callback query:', error);
            }
        });

        // 处理机器人被添加到群组的情况
        bot.on('new_chat_members', async (msg) => {
            const chatId = msg.chat.id;
            const newMembers = msg.new_chat_members;

            const botInfo = await bot.getMe();
            const isBotAdded = newMembers.some(member => member.id === botInfo.id);

            if (isBotAdded) {
                try {
                    await bot.sendMessage(chatId, '谢谢添加我到群组！请使用 /help 查看我的功能。');
                } catch (error) {
                    console.error('Error sending group welcome message:', error);
                }
            }
        });

        // 频道消息处理 - 新增
        bot.on('channel_post', async (msg) => {
            const channelId = msg.chat.id;
            const text = msg.text || '';

            console.log(`Received channel post from ${channelId}: ${text}`);

            // 在这里添加处理频道消息的逻辑
            // 注意：频道消息不能直接回复，需要使用 sendMesssage 等方法发送到特定聊天
            try {
                // 示例：记录频道消息内容
                console.log(`Channel ${channelId} posted: ${text}`);

            } catch (error) {
                console.error('Error handling channel post:', error);
            }
        });
    }

    // 示例：发送带有按钮的消息
    static async sendInteractiveMessage(bot, chatId, text) {
        try {
            await bot.sendMessage(chatId, text, {
                reply_markup: {
                    inline_keyboard: [
                        [
                            { text: '帮助', callback_data: 'help' },
                            { text: '更多信息', callback_data: 'more_info' }
                        ]
                    ]
                }
            });
        } catch (error) {
            console.error('Error sending interactive message:', error);
        }
    }
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
    replyToUsMessage,
    sendfile,
    sendReaction,
    BotController
};