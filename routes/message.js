const express = require('express');
const router = express.Router();
const db = require('../db');

// 获取队列中的消息列表
router.get('/queue', (req, res) => {
  try {
    const { status, limit = 50, offset = 0 } = req.query;
    let query = `SELECT * FROM queue`;
    const params = [];
    
    if (status) {
      query += ` WHERE status = ?`;
      params.push(status);
    }
    
    query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), parseInt(offset));
    
    const items = db.db.prepare(query).all(...params);
    res.json({ ok: true, data: items });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 获取单个队列项详情
router.get('/queue/:id', (req, res) => {
  try {
    const item = db.db.prepare(`SELECT * FROM queue WHERE id = ?`).get(req.params.id);
    if (!item) {
      return res.status(404).json({ ok: false, error: 'Item not found' });
    }
    res.json({ ok: true, data: item });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 创建新的队列项
router.post('/queue', (req, res) => {
  try {
    const { bot_id, type, payload, max_attempts = 5 } = req.body;
    
    if (!bot_id || !type || !payload) {
      return res.status(400).json({ ok: false, error: 'Missing required fields: bot_id, type, payload' });
    }
    
    const item = {
      id: require('crypto').randomUUID(),
      bot_id,
      type,
      payload: typeof payload === 'string' ? payload : JSON.stringify(payload),
      attempts: 0,
      next_try_at: 0,
      last_error: null,
      status: 'created',
      max_attempts,
      created_at: Date.now()
    };
    
    const stmt = db.db.prepare(`INSERT INTO queue (id, bot_id, type, payload, attempts, next_try_at, last_error, status, max_attempts, created_at) 
                               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    stmt.run(
      item.id, 
      item.bot_id, 
      item.type, 
      item.payload, 
      item.attempts, 
      item.next_try_at, 
      item.last_error, 
      item.status, 
      item.max_attempts, 
      item.created_at
    );
    
    res.status(201).json({ ok: true, data: item });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 更新队列项
router.put('/queue/:id', (req, res) => {
  try {
    const { bot_id, type, payload, max_attempts, status } = req.body;
    const id = req.params.id;
    
    // 检查项目是否存在
    const existing = db.db.prepare(`SELECT * FROM queue WHERE id = ?`).get(id);
    if (!existing) {
      return res.status(404).json({ ok: false, error: 'Item not found' });
    }
    
    // 构建更新语句
    let query = `UPDATE queue SET `;
    const updates = [];
    const params = [];
    
    if (bot_id !== undefined) {
      updates.push(`bot_id = ?`);
      params.push(bot_id);
    }
    
    if (type !== undefined) {
      updates.push(`type = ?`);
      params.push(type);
    }
    
    if (payload !== undefined) {
      updates.push(`payload = ?`);
      params.push(typeof payload === 'string' ? payload : JSON.stringify(payload));
    }
    
    if (max_attempts !== undefined) {
      updates.push(`max_attempts = ?`);
      params.push(max_attempts);
    }
    
    if (status !== undefined) {
      updates.push(`status = ?`);
      params.push(status);
    }
    
    if (updates.length === 0) {
      return res.status(400).json({ ok: false, error: 'No fields to update' });
    }
    
    query += updates.join(', ') + ` WHERE id = ?`;
    params.push(id);
    
    db.db.prepare(query).run(...params);
    
    const updated = db.db.prepare(`SELECT * FROM queue WHERE id = ?`).get(id);
    res.json({ ok: true, data: updated });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 删除队列项
router.delete('/queue/:id', (req, res) => {
  try {
    const result = db.db.prepare(`DELETE FROM queue WHERE id = ?`).run(req.params.id);
    if (result.changes === 0) {
      return res.status(404).json({ ok: false, error: 'Item not found' });
    }
    res.json({ ok: true, message: 'Item deleted successfully' });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;