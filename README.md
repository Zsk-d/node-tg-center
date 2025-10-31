# Node Telegram Center 使用和开发文档

## 项目概述

Node Telegram Center 是一个基于 Node.js 的 Telegram 机器人管理系统，提供了统一的接口来管理多个 Telegram 机器人，并支持消息发送、编辑、删除、置顶等操作。系统采用队列机制处理消息发送，确保即使在高负载情况下也能稳定运行。

## 功能特性

1. 多机器人管理
2. 消息队列处理机制
3. 支持发送文本、图片、文件等
4. 消息编辑、删除、置顶等操作
5. 速率限制控制
6. RESTful API 接口
7. 简单的 Web 管理界面
8. 自动清理过期数据

## 系统架构

```
graph TD
    A[客户端] --> B[REST API]
    B --> C[认证中间件]
    C --> D[路由处理器]
    D --> E[数据库]
    D --> F[消息队列]
    F --> G[队列处理器]
    G --> H[Telegram API]
    H --> I[Telegram 服务器]
```

## 安装和配置

### 环境要求

- Node.js 14.x 或更高版本
- npm 或 yarn 包管理器

### 安装步骤

1. 克隆项目代码：
```bash
git clone <项目地址>
cd node-tg-center
```

2. 安装依赖：
```bash
npm install
```

3. 配置环境变量：
创建 `.env` 文件并配置以下参数：
```
API_TOKEN=my-secret-token     # API 访问令牌
PORT=3000                     # 服务端口
PROXY_URL=http://127.0.0.1:10809  # Telegram 代理地址
DATA_DIR=./data               # 数据库存储目录
CLEAR_MSG_MAP_INTERVAL=3600   # 清理消息映射间隔（秒）
```

4. 启动服务：
```bash
npm start
```

## API 接口文档

### 认证

所有 `/api/control` 路径下的接口都需要在请求头中添加认证信息：

```
Authorization: my-secret-token
# 或
Auth: my-secret-token
```

### 机器人管理接口

#### 获取机器人列表
```
GET /api/robots
```

返回示例：
```json
[
  {
    "id": "uuid",
    "name": "机器人名称",
    "token": "机器人Token",
    "enabled": 1,
    "rate_limit": 1.0,
    "created_at": 1678901234567
  }
]
```

#### 创建机器人
```
POST /api/robots
Content-Type: application/json

{
  "name": "机器人名称",
  "token": "机器人Token",
  "rate_limit": 1.0
}
```

#### 更新机器人
```
PUT /api/robots/:id
Content-Type: application/json

{
  "name": "新名称",
  "token": "新Token",
  "enabled": true,
  "rate_limit": 2.0
}
```

#### 删除机器人
```
DELETE /api/robots/:id
```

#### 启用/禁用机器人
```
POST /api/robots/:id/toggle
Content-Type: application/json

{
  "enabled": true
}
```

### 消息控制接口

#### 发送消息
```
POST /api/control/send
Content-Type: application/json

{
  "botId": "机器人ID",
  "chatId": "聊天ID或频道名",
  "text": "消息内容",
  "options": {
    "parse_mode": "MarkdownV2"
  }
}
```

发送带图片的消息：
```json
{
  "botId": "机器人ID",
  "chatId": "聊天ID",
  "text": "消息内容",
  "base64_photo": "图片的base64编码"
}
```

#### 编辑消息
```
POST /api/control/edit
Content-Type: application/json

{
  "botId": "机器人ID",
  "chatId": "聊天ID",
  "messageId": "消息ID",
  "text": "新消息内容"
}
```

#### 删除消息
```
POST /api/control/delete
Content-Type: application/json

{
  "botId": "机器人ID",
  "chatId": "聊天ID",
  "messageId": "消息ID"
}
```

#### 置顶消息
```
POST /api/control/pin
Content-Type: application/json

{
  "botId": "机器人ID",
  "chatId": "聊天ID",
  "messageId": "消息ID"
}
```

#### 取消置顶消息
```
POST /api/control/unpin
Content-Type: application/json

{
  "botId": "机器人ID",
  "chatId": "聊天ID",
  "messageId": "消息ID"
}
```

#### 回复消息
```
POST /api/control/reply
Content-Type: application/json

{
  "botId": "机器人ID",
  "chatId": "聊天ID",
  "replyTo": "要回复的消息ID",
  "text": "回复内容"
}
```

#### 发送文件
```
POST /api/control/sendfile
Content-Type: multipart/form-data

file: 文件内容
botId: 机器人ID
chatId: 聊天ID
caption: 文件说明（可选）
format: 解析模式，md 或 html（可选，默认为 md）
```

### 系统状态接口

#### 获取系统状态
```
GET /api/system/status
```

返回示例：
```json
{
  "memory": {
    "rss": "25.12",
    "heapUsed": "12.34",
    "heapTotal": "18.56"
  },
  "cpu": {
    "user": "123.45",
    "system": "67.89"
  },
  "uptime": "1234.5"
}
```

## Web 管理界面

访问 `http://localhost:3000` 可以打开简单的 Web 管理界面，可以：
- 查看所有机器人
- 添加新机器人
- 启用/禁用机器人
- 测试发送消息

## 开发指南

### 项目结构

```
.
├── middleware/          # 中间件
│   └── auth.js         # 认证中间件
├── public/             # 静态资源
│   └── admin.html      # 管理界面
├── routes/             # 路由
│   ├── control.js      # 消息控制路由
│   ├── robots.js       # 机器人管理路由
│   └── system.js       # 系统状态路由
├── utils/              # 工具函数
│   ├── cleanup.js      # 数据清理工具
│   └── upload.js       # 文件上传工具
├── db.js               # 数据库操作
├── queueProcessor.js   # 队列处理器
├── server.js           # 服务入口
├── telegramService.js  # Telegram 服务封装
└── package.json        # 项目配置
```

### 核心模块说明

#### 数据库模块 (db.js)

使用 better-sqlite3 作为数据库，包含三个主要表：
- `robots`: 存储机器人信息
- `queue`: 存储消息队列
- `message_map`: 存储消息映射关系

#### 队列处理器 (queueProcessor.js)

负责从队列中取出任务并执行，具有以下特性：
- 批量处理任务
- 失败重试机制（指数退避）
- 速率限制控制

#### Telegram 服务 (telegramService.js)

封装了 Telegram Bot API 的调用，包括：
- 消息发送、编辑、删除
- 消息置顶/取消置顶
- 文件发送
- 速率限制控制

### 添加新功能

如需添加新功能，可以按照以下步骤：

1. 在 `routes/control.js` 中添加新的路由
2. 在 [telegramService.js](file://c:\A-PC\DEV\node-tg-center\telegramService.js) 中实现相应的 Telegram API 调用
3. 如果需要，在 [queueProcessor.js](file://c:\A-PC\DEV\node-tg-center\queueProcessor.js) 中添加相应的处理逻辑

### 速率限制

系统支持对每个机器人设置速率限制（每秒消息数），可以通过机器人管理接口设置 `rate_limit` 参数。

## 部署建议

1. 建议在生产环境中使用 PM2 等进程管理工具
2. 配置合适的代理以访问 Telegram API
3. 定期备份数据库文件
4. 监控系统资源使用情况

## 故障排除

### 常见问题

1. **无法连接 Telegram**：检查代理设置是否正确
2. **速率限制错误**：降低 `rate_limit` 设置
3. **认证失败**：确认请求头中的 `Authorization` 字段是否正确

### 日志查看

系统会将操作日志输出到控制台，可以通过查看日志来排查问题。

## 贡献指南

欢迎提交 Issue 和 Pull Request 来改进项目。在提交代码前，请确保：

1. 代码风格一致
2. 添加必要的注释
3. 通过所有测试