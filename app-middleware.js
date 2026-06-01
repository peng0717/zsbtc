const jwt = require('jsonwebtoken');
const pino = require('pino');
const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

const JWT_SECRET = process.env.JWT_SECRET;

// ========== JWT 认证中间件 ==========
function authMiddleware(req, res, next) {
  if (!JWT_SECRET) return res.status(500).json({ success: false, message: 'JWT_SECRET 未配置' });
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: '未登录' });
  }
  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = { id: decoded.id, username: decoded.username, role: decoded.role };
    next();
  } catch (e) {
    return res.status(401).json({ success: false, message: 'token已过期，请重新登录' });
  }
}

function requireAdmin(req, res, next) {
  if (req.user.role !== '管理员') {
    return res.status(403).json({ success: false, message: '无管理员权限' });
  }
  next();
}

// ========== 密码复杂度校验 ==========
function validatePassword(password) {
  if (!password || password.length < 8) {
    return '密码长度不能少于8位';
  }
  if (!/[a-z]/.test(password)) {
    return '密码必须包含小写字母';
  }
  if (!/[A-Z]/.test(password)) {
    return '密码必须包含大写字母';
  }
  if (!/[0-9]/.test(password)) {
    return '密码必须包含数字';
  }
  return null;
}

// ========== 请求日志中间件 ==========
function requestLogger(req, res, next) {
  const start = Date.now();
  res.on('finish', () => {
    logger.info({ method: req.method, path: req.path, status: res.statusCode, ms: Date.now() - start }, 'request');
  });
  next();
}

// ========== 全局错误处理 ==========
function globalErrorHandler(err, req, res, next) {
  logger.error({ err }, 'API错误');
  const isDev = !process.env.VERCEL && process.env.NODE_ENV !== 'production';
  const statusCode = err.status || err.statusCode || 500;
  res.status(statusCode).json({
    code: statusCode,
    message: isDev ? err.message : '服务器内部错误，请稍后重试'
  });
}

// ========== 404 处理 ==========
function notFoundHandler(req, res) {
  res.status(404).json({ code: 404, message: '请求的资源不存在' });
}

module.exports = {
  authMiddleware,
  requireAdmin,
  validatePassword,
  requestLogger,
  globalErrorHandler,
  notFoundHandler
};