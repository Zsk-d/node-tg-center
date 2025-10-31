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

function pushToQueue(botId, type, payload) {
  const id = uuidv4();
  let data = { id, bot_id: botId, type, payload: JSON.stringify(payload), attempts: 0, next_try_at: 0 }
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

// 置顶
router.post('/unpin', (req, res) => {
  const id = pushToQueue(req.body.botId, 'unpin', req.body);
  res.json({ queued: true, id });
});

// 回复
router.post('/reply', (req, res) => {
  const id = pushToQueue(req.body.botId, 'reply', req.body);
  res.json({ queued: true, id });
});


// POST /api/control/sendFile
router.post('/sendfile', upload.single('file'), async (req, res) => {
  try {
    const { botId, chatId, caption = '', format = 'md' } = req.body;
    if (!req.file) return res.status(400).json({ ok: false, error: 'No file uploaded' });

    const payload = {
      filePath: req.file.path,
      originalName: req.file.originalname,
      caption,
      format,
      chatId
    };

    // 加入消息队列
    const queueId = await pushToQueue(botId, 'file', payload);

    res.json({ ok: true, queueId });
  } catch (err) {
    console.error('sendFile queue error', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});
module.exports = router;