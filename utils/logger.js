const path = require('path');
const fs = require('fs');

// 创建日志目录
const logsDir = path.join('logs');
fs.mkdirSync(logsDir, { recursive: true });

// 存储当前日志文件信息
let currentLogDate = getDateStr();
let logFiles = {};

// 获取当前日期字符串 (YYYY-MM-DD)
function getDateStr() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

// 初始化日志文件
function initLogFiles() {
    const dateStr = getDateStr();
    const logLevelList = ['debug', 'info', 'warn', 'error'];
    logFiles = {};
    
    for (const level of logLevelList) {
        const fileName = `tg-center-${level}-${dateStr}.log`;
        logFiles[level] = path.join(logsDir, fileName);
    }
}

// 检查是否需要切换到新日期的日志文件
function checkDateRoll() {
    const today = getDateStr();
    if (today !== currentLogDate) {
        currentLogDate = today;
        initLogFiles();
    }
}

// 初始化日志文件
initLogFiles();

// 每小时检查一次日期变化
setInterval(checkDateRoll, 60 * 60 * 1000); // 每小时检查一次

const logLevelList = ['debug', 'info', 'warn', 'error'];

const getLogger = (jsFile, consoleLevel = 'debug') => {
    const fileName = path.basename(jsFile);

    const log = (level, message, ...args) => {
        // 检查日期变化
        checkDateRoll();
        
        const time = new Date().toLocaleString();
        const formatted = `[${time}] [${level.toUpperCase()}] [${fileName}]: ${message} ${args && args.length > 0 ? ('[' + args.join(', ') + ']') : ''}`;
        
        try {
            fs.appendFileSync(logFiles[level], formatted + '\n');
        } catch (err) {
            // 如果写入文件失败，至少输出到控制台
            console.error('Failed to write to log file:', err);
        }
        
        if (logLevelList.slice(logLevelList.indexOf(consoleLevel)).indexOf(level) > -1) {
            console.log(formatted);
        }
    };

    return {
        info: (msg, ...args) => log('info', msg, ...args),
        debug: (msg, ...args) => log('debug', msg, ...args),
        warn: (msg, ...args) => log('warn', msg, ...args),
        error: (msg, ...args) => log('error', msg, ...args),
    };
};

module.exports = { getLogger };