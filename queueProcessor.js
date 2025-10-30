const { db, popDueItems, removeQueueItem, updateQueueItem, getRobotById } = require('./db');
const { sendMessage, sendPhoto, editMessage, deleteMessage, pinMessage, editUsMessage, pinUsMessage, unpinUsMessage } = require('./telegramService');
const { v4: uuidv4 } = require('uuid');

const MAX_BATCH = 10; // 每次拉取的任务数

let processing = false;

async function processQueueOnce() {
    const items = popDueItems(MAX_BATCH);
    for (const item of items) {
        const payload = JSON.parse(item.payload);
        const botRecord = db.prepare('SELECT * FROM robots WHERE id=?').get(item.bot_id);
        if (!botRecord) {
            // 没有机器人，丢弃
            removeQueueItem(item.id);
            continue;
        }
        // 检查是否启用
        if (!botRecord.enabled) {
            // removeQueueItem(item.id);
            continue;
        }

        try {
            let sendRes = null
            if (item.type === 'send') {
                if (payload.base64_photo) {
                    const buf = Buffer.from(payload.base64_photo, 'base64');
                    sendRes = await sendPhoto(botRecord, payload.chatId, buf, { caption: payload.text });
                } else {
                    sendRes = await sendMessage(botRecord, payload.chatId, payload.text, payload.options || {});
                }
            } else if (item.type === 'edit') {
                // await editMessage(botRecord, payload.chatId, payload.messageId, payload.text, payload.options || {});
                await editUsMessage(payload.messageId, payload.text);
            } else if (item.type === 'delete') {
                await deleteMessage(botRecord, payload.chatId, payload.messageId);
            } else if (item.type === 'pin') {
                await pinUsMessage(payload.messageId);
            } else if (item.type === 'unpin') {
                await unpinUsMessage(payload.messageId);
            } else if (item.type === 'reply') {
                sendRes = await sendMessage(botRecord, payload.chatId, payload.text, Object.assign({}, payload.options || {}, { reply_to_message_id: payload.replyTo }));
            }

            // 成功则删除队列项
            removeQueueItem(item.id);
            // 保存map
            if (sendRes) {
                db.prepare(`
                        INSERT OR REPLACE INTO message_map (id, bot_id, chat_id, tg_message_id, type, status, created_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?)
                    `).run(
                    item.id, item.bot_id, payload.chatId, sendRes.message_id, 'text', 'sent', Date.now()
                );

                db.prepare('DELETE FROM queue WHERE id=?').run(item.id);
            }
        } catch (err) {
            // 简单重试策略：增加 attempts，指数回退
            const attempts = (item.attempts || 0) + 1;
            const backoffMs = Math.min(60_000, Math.pow(2, attempts) * 1000);
            const nextTry = Date.now() + backoffMs;
            updateQueueItem(item.id, attempts, nextTry);
            // log（实际项目中可替换为更完善的 logger）
            console.error('queue item failed:', item.id, err && err.message);
        }
    }
}

let polling = false;
let intervalHandle = null;

function startProcessor(intervalMs = 1000) {
    if (polling) return;
    polling = true;
    async function loop() {
        if (processing) return; // 防止并发重入
        processing = true;
        try {
            await processQueueOnce();
        } finally {
            processing = false;
        }
    }
    intervalHandle = setInterval(loop, intervalMs);
}

function stopProcessor() {
    if (!polling) return;
    clearInterval(intervalHandle);
    polling = false;
}

module.exports = { startProcessor, stopProcessor };