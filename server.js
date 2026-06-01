const express = require('express');
require('express-async-errors');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const helmet = require('helmet');
const pino = require('pino');
const rateLimit = require('express-rate-limit');

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });
const { run, get, all, getNow } = require('./db');
const bcrypt = require('bcryptjs');
const { requestLogger, globalErrorHandler, notFoundHandler } = require('./middleware');

const app = express();
const PORT = process.env.PORT || 3001;
const UPLOAD_DIR = path.join(__dirname, 'uploads');

// ========== 确保上传目录存在 ==========
try { if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR); } catch(e) { console.log('上传目录跳过（Vercel环境下正常）'); }

// multer 在 Vercel serverless 不可用
const multer = null;
let upload = null;
if (multer) {
  const storage = multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname);
      cb(null, Date.now() + '-' + Math.round(Math.random() * 1e9) + ext);
    }
  });
  upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });
}

// ========== 频率限制 ==========
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: '尝试次数过多，请15分钟后重试' }
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: '注册频率过高，请1小时后重试' }
});

// ========== 中间件注册 ==========
app.use(helmet());
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:3000'];
app.use(cors({
  origin: function(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));
app.use(express.json());
app.use('/uploads', express.static(UPLOAD_DIR));
app.use(requestLogger);

// ========== 健康检查（不依赖数据库）==========
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'OK', time: getNow(), env: process.env.VERCEL ? 'vercel' : 'local' });
});

// ========== 路由挂载 ==========
app.use('/api/auth', loginLimiter, require('./routes/auth'));
app.use('/api/auth/register', registerLimiter);
app.use('/api/devices', require('./routes/devices'));
app.use('/api/borrows', require('./routes/borrows'));
app.use('/api', require('./routes/admin'));

// ========== 文件上传 ==========
if (upload) {
  const { authMiddleware } = require('./middleware');
  app.post('/api/upload', authMiddleware, upload.single('image'), (req, res) => {
    if (!req.file) return res.json({ success: false, message: '请选择图片' });
    const url = `/uploads/${req.file.filename}`;
    return res.json({ success: true, data: { url } });
  });
}

// ========== 数据库初始化 ==========
async function initDB() {
  await run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT DEFAULT '学生',
    phone TEXT,
    status TEXT DEFAULT 'active',
    created_at TEXT NOT NULL
  )`);

  await run(`CREATE TABLE IF NOT EXISTS devices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    model TEXT,
    category TEXT,
    total INTEGER DEFAULT 1,
    available INTEGER DEFAULT 1,
    description TEXT,
    image TEXT,
    status TEXT DEFAULT 'normal',
    created_at TEXT NOT NULL
  )`);

  await run(`CREATE TABLE IF NOT EXISTS borrow_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id INTEGER NOT NULL,
    device_name TEXT,
    user_id INTEGER NOT NULL,
    username TEXT,
    qty INTEGER DEFAULT 1,
    purpose TEXT,
    borrow_date TEXT NOT NULL,
    expect_return TEXT,
    actual_return TEXT,
    status TEXT DEFAULT 'pending',
    type TEXT DEFAULT 'borrow',
    approver TEXT,
    reject_reason TEXT,
    created_at TEXT NOT NULL
  )`);

  // 种子数据：管理员
  const admin = await get('SELECT * FROM users WHERE username = ?', ['23160129']);
  if (!admin) {
    const hash = bcrypt.hashSync('100311', 10);
    await run(
      'INSERT INTO users (username, password, name, role, status, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      ['23160129', hash, '管理员', '管理员', 'active', getNow()]
    );
    console.log('已创建初始管理员: 23160129');
  }

  // 种子数据：示例设备
  const devices = await all('SELECT * FROM devices');
  if (devices.length === 0) {
    const now = getNow();
    await run(
      'INSERT INTO devices (name, model, category, total, available, description, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      ['投影仪', 'EPSON CB-X51', '电子设备', 3, 3, '便携式投影仪，适合教室使用', 'normal', now]
    );
    await run(
      'INSERT INTO devices (name, model, category, total, available, description, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      ['笔记本电脑', 'ThinkPad X1 Carbon', '电子设备', 5, 5, '轻薄办公本', 'normal', now]
    );
    logger.info('已创建示例设备');
  }
}

initDB().catch(err => {
  console.error('数据库初始化失败:', err);
  if (!process.env.VERCEL) process.exit(1);
});

// ========== 全局错误处理 ==========
app.use(globalErrorHandler);

// ========== 404 处理（必须在所有路由之后）==========
app.use(notFoundHandler);

// ========== 启动 ==========
if (!process.env.VERCEL) {
  app.listen(PORT, '0.0.0.0', () => {
    logger.info(`掌上设备通后端已启动（Turso云端数据库）: http://localhost:${PORT}`);
  });
} else {
  logger.info('Vercel serverless 模式已就绪');
}

module.exports = app;