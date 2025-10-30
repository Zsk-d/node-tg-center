const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const dbModule = require('../db');
const { bots } = require('../telegramService');

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
  dbModule.updateRobot({ id, name: name||existing.name, token: token||existing.token, enabled: typeof enabled === 'boolean' ? enabled : existing.enabled, rate_limit: rate_limit||existing.rate_limit });
  res.sendStatus(204);
});

// delete
router.delete('/:id', (req, res) => {
  dbModule.deleteRobot(req.params.id);
  res.sendStatus(204);
});

// set online/offline
router.post('/:id/toggle', (req, res) => {
  const id = req.params.id;
  const r = dbModule.getRobotById(id);
  if (!r) return res.status(404).send('not found');
  const enabled = req.body.enabled === true;
  dbModule.updateRobot({ id, name: r.name, token: r.token, enabled, rate_limit: r.rate_limit });
  res.json({ id, enabled });
});

module.exports = router;