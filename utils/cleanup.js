// utils/cleanup.js
const { db } = require('../db');

const { getLogger } = require('../utils/logger');
const logger = getLogger(__filename);

const CLEAR_MSG_MAP_INTERVAL = process.env.CLEAR_MSG_MAP_INTERVAL || 3600;

async function cleanupOldMessageMaps() {
    logger.info('开始清理消息发送记录');

    const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();

    const sql = `DELETE FROM message_map WHERE created_at < ?`;
    const result = db.prepare(sql).run(twelveHoursAgo);

    logger.info(`[Cleanup] Deleted ${result.changes} old message_map records`);
}

function startCleanupScheduler() {
    cleanupOldMessageMaps()
    setInterval(() => {
        cleanupOldMessageMaps().catch(err => {
            logger.error(`[Cleanup Error] ${err}`);
        });
    }, CLEAR_MSG_MAP_INTERVAL * 1000);

    logger.info('[Cleanup] Scheduler started (runs every 1h)');
}

module.exports = {
    startCleanupScheduler,
};
