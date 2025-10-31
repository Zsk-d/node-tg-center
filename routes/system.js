const express = require('express');
const router = express.Router();

/**
 * 获取系统状态
 */
router.get('/status', (req, res) => {
  const mem = process.memoryUsage();
  const cpu = process.cpuUsage();
  res.json({
    ok: true, data: {
      memory: {
        rss: (mem.rss / 1024 / 1024).toFixed(2),
        heapUsed: (mem.heapUsed / 1024 / 1024).toFixed(2),
        heapTotal: (mem.heapTotal / 1024 / 1024).toFixed(2),
      },
      cpu: {
        user: (cpu.user / 1000).toFixed(2),
        system: (cpu.system / 1000).toFixed(2),
      },
      uptime: process.uptime().toFixed(1),
    }
  });
});

module.exports = router;