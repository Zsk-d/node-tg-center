// middleware/auth.js
module.exports = function(requiredToken) {
  return function(req, res, next) {
    const authHeader = req.headers['auth'] || req.headers['authorization'];
    
    if (!authHeader || authHeader !== requiredToken) {
      return res.status(401).json({ ok: false, error: 'Unauthorized' });
    }

    next(); // 验证通过，继续执行下一个中间件/路由
  };
};
