require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const robotsRouter = require('./routes/robots');
const controlRouter = require('./routes/control');
const systemRouter = require('./routes/system');
const messageRouter = require('./routes/message');

const authMiddleware = require('./middleware/auth');

const { startProcessor } = require('./queueProcessor');
const { startCleanupScheduler } = require('./utils/cleanup');

const { getLogger } = require('./utils/logger');
const logger = getLogger(__filename);

const API_TOKEN = process.env.API_TOKEN || 'token';
const API_USER = process.env.API_USER || 'user';
const env = process.env.PROFILE || 'dev';

const basicAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Basic ')) {
    res.setHeader('WWW-Authenticate', 'Basic realm="Access to static files"');
    return res.status(401).send('Authentication required.');
  }

  const base64Credentials = authHeader.split(' ')[1];
  const credentials = Buffer.from(base64Credentials, 'base64').toString('ascii');
  const [username, password] = credentials.split(':');

  // 这里使用与API相同的token作为密码，用户名可以任意
  if (username === API_USER && password === API_TOKEN) {
    return next();
  }

  res.setHeader('WWW-Authenticate', 'Basic realm="Access to static files"');
  return res.status(401).send('Authentication failed.');
};


const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use('/api/robots', authMiddleware(API_TOKEN), robotsRouter);
app.use('/api/control', authMiddleware(API_TOKEN), controlRouter);
app.use('/api/system', authMiddleware(API_TOKEN), systemRouter);
app.use('/api/system', authMiddleware(API_TOKEN), messageRouter);

// admin static page
app.use('/', express.static(path.join(__dirname, 'public')));


const port = process.env.PORT || 3000;
app.listen(port, () => {
  logger.info(`server started on ${port}`);
  // 启动队列处理器
  startProcessor(3000);
  // 启动清理定时任务
  startCleanupScheduler();
});