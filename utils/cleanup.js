// utils/cleanup.js
const { db } = require('../db');
const CLEAR_MSG_MAP_INTERVAL = process.env.CLEAR_MSG_MAP_INTERVAL || 3600;

async function cleanupOldMessageMaps() {
    console.log('开始清理消息发送记录');

    const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();

    const sql = `DELETE FROM message_map WHERE created_at < ?`;
    const result = db.prepare(sql).run(twelveHoursAgo);

    console.log(`[Cleanup] Deleted ${result.changes} old message_map records`);
}

function startCleanupScheduler() {
    cleanupOldMessageMaps()
    setInterval(() => {
        cleanupOldMessageMaps().catch(err => {
            console.error('[Cleanup Error]', err);
        });
    }, CLEAR_MSG_MAP_INTERVAL * 1000);

    console.log('[Cleanup] Scheduler started (runs every 1h)');
}

module.exports = {
    startCleanupScheduler,
};
