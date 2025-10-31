const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const dbModule = require('../db');
const { bots, BotController } = require('../telegramService');

// list
router.get('/', (req, res) => {
  res.json(dbModule.getRobots());
});

// create
router.post('/', (req, res) => {
  const { name, token, rate_limit } = req.body;
  const id = uuidv4();
  dbModule.insertRobot({ id, name, token, enabled: 1, rate_limit: rate_limit || null });
  res.status(201).json({ id });
});

// update
router.put('/:id', (req, res) => {
  const id = req.params.id;
  const existing = dbModule.getRobotById(id);
  if (!existing) return res.status(404).send('not found');
  const { name, token, enabled, rate_limit } = req.body;
  dbModule.updateRobot({ id, name: name || existing.name, token: token || existing.token, enabled: typeof enabled === 'boolean' ? enabled : existing.enabled, rate_limit: rate_limit || existing.rate_limit });

  // 如果启用了机器人，则启动监听；如果禁用了机器人，则停止监听
  if (typeof enabled === 'boolean') {
    BotController.toggleBotListening(id, enabled)
      .catch(err => console.error('Error toggling bot listening state:', err));
  }

  res.sendStatus(204);
});

// delete
router.delete('/:id', async (req, res) => {
  dbModule.deleteRobot(req.params.id);
  // 控制机器人监听状态
  try {
    await BotController.toggleBotListening(id, false);
  } catch (err) {
    console.error('Error toggling bot listening state:', err);
    // 即使控制监听状态失败，也返回更新后的状态
  }
  res.sendStatus(204);
});

// set online/offline
// set online/offline
router.post('/:id/toggle', async (req, res) => {
  const id = req.params.id;
  const r = dbModule.getRobotById(id);
  if (!r) return res.status(404).send('not found');
  const enabled = req.body.enabled === true;
  dbModule.updateRobot({ id, name: r.name, token: r.token, enabled, rate_limit: r.rate_limit });

  // 控制机器人监听状态
  try {
    await BotController.toggleBotListening(id, enabled);
  } catch (err) {
    console.error('Error toggling bot listening state:', err);
    // 即使控制监听状态失败，也返回更新后的状态
  }

  res.json({ id, enabled });
});

module.exports = router;