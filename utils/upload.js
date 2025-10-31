// utils/upload.js
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// 上传文件保存路径
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

// multer 配置
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    const name = `${Date.now()}-${Math.random().toString(36).substr(2, 5)}${ext}`;
    cb(null, name);
  }
});

const upload = multer({ storage });

module.exports = {
  upload,
  uploadDir
};
