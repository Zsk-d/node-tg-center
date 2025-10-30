const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../db');

function pushToQueue(botId, type, payload) {
  const id = uuidv4();
  db.pushQueue({ id, bot_id: botId, type, payload: JSON.stringify(payload), attempts: 0, next_try_at: 0 });
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

module.exports = router;