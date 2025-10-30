# Telegram Bot Controller — Node.js Project
- 向指定频道/聊天发送消息（支持 base64 图片）
- 编辑消息、置顶/取消置顶（pin/unpin）、删除消息、回复消息
- 外部通过 REST JSON 接口控制（CORS 已开启）
- 使用 SQLite 保存消息队列（持久化）
- 异步队列处理（带速率限制 / 回退策略）
- 管理界面（单页 React）用于：增删改查机器人配置（key/token 等）、上下线控制、测试发送
## 使用说明

1. `npm install`
2. `npm start` 启动服务
3. 打开 `http://localhost:3000/` 即可访问管理页面
4. 通过 `/api/control` 提交 JSON 控制消息（示例在下）

### REST 示例（curl）

发送文本消息至频道：

```bash
curl -X POST http://localhost:3000/api/control/send \
  -H 'Content-Type: application/json' \
  -d '{"botId":"<bot-id>", "chatId":"@yourchannel", "text":"Hello from REST"}'
```

发送 base64 图片（body 中包含 `base64_photo` 字段）：

```bash
curl -X POST http://localhost:3000/api/control/send \
  -H 'Content-Type: application/json' \
  -d '{"botId":"<bot-id>", "chatId":"<chatId>", "text":"caption","base64_photo":"<BASE64_STRING>"}'
```