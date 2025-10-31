const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const dataDir = process.env.DATA_DIR || './data';
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const dbPath = path.join(dataDir, 'bot_queue.db');
const db = new Database(dbPath);

// 初始化表
db.exec(`
CREATE TABLE IF NOT EXISTS robots (
  id TEXT PRIMARY KEY,
  name TEXT,
  token TEXT,
  enabled INTEGER DEFAULT 1,
  rate_limit REAL,
  created_at INTEGER
);

CREATE TABLE IF NOT EXISTS queue (
  id TEXT PRIMARY KEY,
  bot_id TEXT,
  type TEXT,
  payload TEXT,
  attempts INTEGER DEFAULT 0,
  next_try_at INTEGER DEFAULT 0,
  last_error TEXT,
  status TEXT DEFAULT 'created',
  max_attempts INTEGER DEFAULT 5,
  created_at INTEGER
);

CREATE TABLE IF NOT EXISTS message_map (
  id TEXT PRIMARY KEY,              -- 本地消息ID (uuid 或自定义)
  bot_id TEXT NOT NULL,
  chat_id TEXT NOT NULL,
  tg_message_id INTEGER,
  type TEXT,
  status TEXT DEFAULT 'sent',
  created_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_message_map_bot_chat ON message_map(bot_id, chat_id);

`);

module.exports = {
  db,
  insertRobot: (robot) => {
    const stmt = db.prepare(`INSERT INTO robots (id,name,token,enabled,rate_limit,created_at) VALUES (?,?,?,?,?,?)`);
    stmt.run(robot.id, robot.name, robot.token, robot.enabled ? 1 : 0, robot.rate_limit || null, Date.now());
  },
  getRobots: () => db.prepare(`SELECT * FROM robots`).all(),
  getRobotById: (id) => db.prepare(`SELECT * FROM robots WHERE id = ?`).get(id),
  updateRobot: (r) => db.prepare(`UPDATE robots SET name=?,token=?,enabled=?,rate_limit=? WHERE id=?`).run(r.name, r.token, r.enabled ? 1 : 0, r.rate_limit || null, r.id),
  deleteRobot: (id) => db.prepare(`DELETE FROM robots WHERE id = ?`).run(id),
  pushQueue: (item) => db.prepare(`INSERT INTO queue (id,bot_id,type,payload,attempts,next_try_at,created_at,max_attempts) VALUES (?,?,?,?,?,?,?,?)`).run(item.id, item.bot_id, item.type, item.payload, item.attempts || 0, item.next_try_at || 0, Date.now(), item.max_attempts),
  popDueItems: (limit) => db.prepare(`SELECT * FROM queue WHERE next_try_at <= ? and status = 'created' ORDER BY created_at LIMIT ?`).all(Date.now(), limit),
  removeQueueItem: (id) => db.prepare(`DELETE FROM queue WHERE id = ?`).run(id),
  updateQueueItem: (id, attempts, next_try_at, last_error) => {
    const stmt = db.prepare(`UPDATE queue SET attempts=?, next_try_at=?, last_error=? WHERE id=?`);
    stmt.run(attempts, next_try_at, last_error, id);
  },
  // 新增方法：标记任务为失败（达到最大重试次数）
  markAsFailed: (id, last_error) => {
    const stmt = db.prepare(`UPDATE queue SET last_error=?, status='failed' WHERE id=?`);
    stmt.run(last_error, id);
  }
};