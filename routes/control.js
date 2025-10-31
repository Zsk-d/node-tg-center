const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const { getLogger } = require('../utils/logger');
const logger = getLogger(__filename);

// 上传临时存储目录
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

// multer 配置
const upload = multer({ dest: uploadDir });

const max_attempts = process.env.DEFAULT_MAX_ATTEMPTS

function pushToQueue(botId, type, payload, maxAttempts = max_attempts) {
  const id = uuidv4();
  let data = { id, bot_id: botId, type, payload: JSON.stringify(payload), attempts: 0, next_try_at: 0, max_attempts: maxAttempts }
  db.pushQueue(data);
  logger.info(`queued message ${JSON.stringify(data)}`);
  return id;
}

// 发送消息
router.post('/send', (req, res) => {
  // body: { botId, chatId, text, options?, base64_photo? }
  const body = req.body;
  if (!body.botId || !body.chatId) return res.status(400).send('missing botId/chatId');
  const id = pushToQueue(body.botId, 'send', body);
  res.json({ queued: true, id });
});

// 编辑
router.post('/edit', (req, res) => {
  // body: { botId, chatId, messageId, text }
  const id = pushToQueue(req.body.botId, 'edit', req.body);
  res.json({ queued: true, id });
});

// 删除
router.post('/delete', (req, res) => {
  const id = pushToQueue(req.body.botId, 'delete', req.body);
  res.json({ queued: true, id });
});

// 置顶
router.post('/pin', (req, res) => {
  const id = pushToQueue(req.body.botId, 'pin', req.body);
  res.json({ queued: true, id });
});

// 取消置顶
router.post('/unpin', (req, res) => {
  const id = pushToQueue(req.body.botId, 'unpin', req.body);
  res.json({ queued: true, id });
});

// 回复
router.post('/reply', (req, res) => {
  const id = pushToQueue(req.body.botId, 'reply', req.body);
  res.json({ queued: true, id });
});

/**
 * 表情回应
 * Reaction emoji. Currently, it can be one of "❤", "👍", "👎", "🔥", "🥰", "👏", "😁", "🤔", "🤯", "😱", "🤬", "😢", 
 * "🎉", "🤩", "🤮", "💩", "🙏", "👌", "🕊", "🤡", "🥱", "🥴", "😍", "🐳", "❤‍🔥", "🌚", "🌭", "💯", "🤣", "⚡", "🍌",
 * "🏆", "💔", "🤨", "😐", "🍓", "🍾", "💋", "🖕", "😈", "😴", "😭", "🤓", "👻", "👨‍💻", "👀",
 * "🎃", "🙈", "😇", "😨", "🤝", "✍", "🤗", "🫡", "🎅", "🎄", "☃", "💅", "🤪", "🗿", "🆒", "💘", "🙉", 
 * "🦄", "😘", "💊", "🙊", "😎", "👾", "🤷‍♂", "🤷", "🤷‍♀", "😡"
 */
router.post('/react', (req, res) => {
  // body: { messageId, emoji }
  const body = req.body;
  if (!body.messageId || !body.emoji) return res.status(400).json({ error: 'missing localId/emoji' });
  const id = pushToQueue(req.body.botId, 'react', body); // botId 会在处理时从 message_map 中获取
  res.json({ queued: true, id });
});

// POST /api/control/sendFile
router.post('/sendfile', upload.single('file'), async (req, res) => {
  try {
    const { botId, chatId, text = '', format = 'md' } = req.body;
    if (!req.file) return res.status(400).json({ ok: false, error: 'No file uploaded' });

    const payload = {
      filePath: req.file.path,
      originalName: req.file.originalname,
      text,
      format,
      chatId
    };

    // 加入消息队列
    const queueId = await pushToQueue(botId, 'file', payload);

    res.json({ ok: true, queueId });
  } catch (err) {
    logger.error('sendFile queue error' + err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * 通过本地消息id获取tg消息发送数据
 */
router.get('/msg', (req, res) => {
  let messageId = req.query.messageId
  const msg = db.getMessageMap(messageId)
  msg.res = JSON.parse(msg.res)
  res.json({ ok: true, data: msg });
});

module.exports = router;