require('dotenv').config();
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
const { requestLogger, globalErrorHandler, notFoundHandler } = require('./app-middleware');

const app = express();
const PORT = process.env.PORT || 3001;
const UPLOAD_DIR = path.join(__dirname, 'uploads');

// ========== 确保上传目录存在 ==========
try { if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR); } catch(e) { console.log('上传目录跳过（Vercel环境下正常）'); }

// multer 文件上传
let upload = null;
try {
  const multer = require('multer');
  const storage = multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname);
      cb(null, Date.now() + '-' + Math.round(Math.random() * 1e9) + ext);
    }
  });
  upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });
} catch (e) {
  console.warn('multer 不可用（Vercel 环境下正常），上传功能将不可用');
}

// ========== 频率限制 ==========
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: '尝试次数过多，请15分钟后重试' }
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
app.use('/api/devices', require('./routes/devices'));
app.use('/api/borrows', require('./routes/borrows'));
app.use('/api', require('./routes/admin'));
app.use('/api', require('./routes/export'));
// ========== 文件上传 ==========
const { authMiddleware } = require('./app-middleware');
if (upload) {
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
    qr_code TEXT,
    status TEXT DEFAULT 'normal',
    created_at TEXT NOT NULL
  )`);

  // 为已有数据库补充 qr_code 字段
  try { await run('ALTER TABLE devices ADD COLUMN qr_code TEXT'); } catch (_) {}

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

  // 黑名单 token 表（JWT 吊销）
  await run(`CREATE TABLE IF NOT EXISTS blacklisted_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token_hash TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // 种子数据：管理员（从环境变量读取，未配置则跳过）
  const seedStudentId = process.env.ADMIN_SEED_STUDENT_ID;
  const seedPassword = process.env.ADMIN_SEED_PASSWORD;
  if (seedStudentId && seedPassword) {
    const admin = await get('SELECT * FROM users WHERE username = ?', [seedStudentId]);
    if (!admin) {
      const hash = bcrypt.hashSync(seedPassword, 10);
      await run(
        'INSERT INTO users (username, password, name, role, status, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        [seedStudentId, hash, '管理员', '管理员', 'active', getNow()]
      );
      console.log(`已创建初始管理员: ${seedStudentId}`);
    }
  } else {
    console.warn('⚠️  未配置 ADMIN_SEED_STUDENT_ID 或 ADMIN_SEED_PASSWORD，跳过管理员种子数据创建');
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

const dbInitPromise = initDB().catch(err => {
  console.error('数据库初始化失败:', err);
  if (!process.env.VERCEL) process.exit(1);
});

// ========== 确保数据库初始化完成后才处理请求 ==========
app.use(async (req, res, next) => {
  try { await dbInitPromise; } catch (_) { /* initDB 错误已在上方记录 */ }
  next();
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