require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const robotsRouter = require('./routes/robots');
const controlRouter = require('./routes/control');
const { startProcessor } = require('./queueProcessor');
const dbModule = require('./db');
const authMiddleware = require('./middleware/auth');

const API_TOKEN = process.env.API_TOKEN || 'my-secret-token';

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use('/api/control', authMiddleware(API_TOKEN));

app.use('/api/robots', robotsRouter);
app.use('/api/control', controlRouter);

// admin static page
app.use('/', express.static(path.join(__dirname, 'public')));

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`server started on ${port}`);
  // 启动队列处理器
  startProcessor(3000);
});