const { db, popDueItems, removeQueueItem, updateQueueItem, getRobotById, markAsFailed } = require('./db');
const { sendMessage, sendPhoto, editMessage, deleteMessage, pinMessage, editUsMessage, pinUsMessage, unpinUsMessage, sendfile, sendReaction } = require('./telegramService');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');

const MAX_BATCH = 10; // 每次拉取的任务数
const DEFAULT_MAX_ATTEMPTS = process.env.DEFAULT_MAX_ATTEMPTS || 5; // 默认最大重试次数

let processing = false;

const { getLogger } = require('./utils/logger');
const logger = getLogger(__filename);

/**
 * 转义消息文字
 * @param {*} payload 
 */
function parseText(text) {
    return text.replace(/([_*\[\]()~>#+\-=|{}.!\\])/g, '\\$1');
}

async function processQueueOnce() {
    const items = popDueItems(MAX_BATCH);
    for (const item of items) {
        const payload = JSON.parse(item.payload);
        const botRecord = db.prepare('SELECT * FROM robots WHERE id=?').get(item.bot_id);
        if (!botRecord) {
            // 没有机器人，丢弃
            logger.error(`任务[${item.id}] 无法找到机器人，已忽略`);
            removeQueueItem(item.id);
            continue;
        }
        // 检查是否启用
        if (!botRecord.enabled) {
            // removeQueueItem(item.id);
            continue;
        }

        // 检查是否达到最大重试次数
        const maxAttempts = item.max_attempts || DEFAULT_MAX_ATTEMPTS;
        if (item.attempts >= maxAttempts) {
            markAsFailed(item.id, item.last_error || '达到最大重试次数');
            logger.error(`任务[${item.id}]已达到最大重试次数，已标记为失败`);
            continue;
        }
        if (payload.text) {
            payload.text = parseText(payload.text)
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
            } if (item.type === 'file') {
                const { filePath, originalName, text, format } = JSON.parse(item.payload);
                sendRes = await sendfile(botRecord,
                    payload.chatId,
                    filePath,
                    { caption: text, parse_mode: format === 'html' ? 'HTML' : 'MarkdownV2' },
                    { filename: originalName }
                );

                // 发送完成后删除临时文件
                fs.unlink(filePath, () => { });
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
            } else if (item.type === 'react') {
                // 处理表情回应
                await sendReaction(payload.messageId, payload.emoji);
            }

            // 成功则删除队列项
            removeQueueItem(item.id);
            // 日志: 已处理消息
            logger.info(`queued message ${item.id} handled`);
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
            // 重试策略：增加 attempts，指数回退
            const attempts = (item.attempts || 0) + 1;
            const backoffMs = Math.min(60_000, Math.pow(2, attempts) * 1000);
            const nextTry = Date.now() + backoffMs;
            
            // 更新队列项，记录错误信息
            updateQueueItem(item.id, attempts, nextTry, err.message || err.toString());

            logger.error(`queued message ${item.id} failed: ${err && err.message}`);
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