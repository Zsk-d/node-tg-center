// utils/cleanup.js
const { db } = require('../db');

const { getLogger } = require('../utils/logger');
const logger = getLogger(__filename);

const CLEAR_MSG_MAP_INTERVAL = process.env.CLEAR_MSG_MAP_INTERVAL || 3600;
const CLEAR_MSG_MAP_PREF_TIME_DAYS = process.env.CLEAR_MSG_MAP_PREF_TIME_DAYS || 3;

/**
 * 清理过期的消息映射
 */
async function cleanupOldMessageMaps() {
    const twelveHoursAgo = new Date(Date.now() - CLEAR_MSG_MAP_PREF_TIME_DAYS * 24 * 60 * 60 * 1000).getTime();

    const sql = `DELETE FROM message_map WHERE created_at < ?`;
    const result = db.prepare(sql).run(twelveHoursAgo);

    logger.info(`[Cleanup] Deleted ${result.changes} old message_map records`);
}

/**
 * 定时清理过期的消息映射
 */
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
