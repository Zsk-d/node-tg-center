// routes/sendFile.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { getOrCreateBot, getRobotById } = require('../telegramService');

// 上传临时存储目录
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

// multer 配置
const upload = multer({ dest: uploadDir });

// POST /api/sendFile
// 参数:
//   botId: 使用的机器人ID
//   chatId: 频道/群组ID
//   caption: 可选，文字说明
//   format: 可选，'md' / 'html'
//   file: multipart/form-data 文件
router.post('/', upload.single('file'), async (req, res) => {
    try {
        const { botId, chatId, caption = '', format = 'md' } = req.body;
        if (!req.file) return res.status(400).json({ ok: false, error: 'No file uploaded' });

        const robotRecord = await getRobotById(botId);
        if (!robotRecord || !robotRecord.enabled) {
            return res.status(400).json({ ok: false, error: 'Bot not found or disabled' });
        }

        const bot = getOrCreateBot(robotRecord);

        // parse_mode
        const parse_mode = format === 'html' ? 'HTML' : 'MarkdownV2';

        // 发送文件（这里用 sendDocument，可改成 sendPhoto / sendVideo）
        const result = await bot.sendDocument(chatId, req.file.path, {
            caption,
            parse_mode,
        }, {
            filename: req.file.originalname,
        });

        // 删除临时文件
        fs.unlink(req.file.path, () => { });

        res.json({ ok: true, result });
    } catch (err) {
        console.error('sendFile error', err);
        res.status(500).json({ ok: false, error: err.message });
    }
});

module.exports = router;
