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