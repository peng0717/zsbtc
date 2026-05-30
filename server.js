const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
// multer 在 Vercel serverless 不可用（无持久磁盘），本地开发时取消注释
let multer = null;
try { multer = require('multer'); } catch (e) { console.log('multer 不可用（Vercel 环境）'); }
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'sbjies_secret_key_2026';
const UPLOAD_DIR = path.join(__dirname, 'uploads');

// ========== Turso HTTP REST API ==========
const TURSO_URL = process.env.TURSO_URL || 'libsql://sbjies-peng0717.aws-ap-northeast-1.turso.io';
const TURSO_TOKEN = process.env.TURSO_TOKEN || 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE3ODAxNTI0NjIsImlkIjoiMDE5ZTc5M2QtOTMwMS03YWNhLTg4MDktNmVlY2MwNTcxYjA1IiwicmlkIjoiMjFhMTY4OTItMGI1Yi00ODFlLThmMzItMDRmMGU0Y2IxOTNkIn0.3J784PczoTPxjuldkPNkJ1Ae0RsNpZUrFQT_Au4q0l1PZsBIym5uy5GbskzT2dE1Rz1RIs7MMapeUJNCALHiCg';
const TURSO_HTTP = TURSO_URL.replace('libsql://', 'https://');

async function tursoFetch(sql, params = []) {
  const body = {
    requests: [
      { type: 'execute', stmt: { sql, args: params.map(v => {
        if (typeof v === 'number') {
          if (Number.isInteger(v)) return { type: 'integer', value: String(v) };
          return { type: 'float', value: v };
        }
        if (v === null || v === undefined) return { type: 'null' };
        return { type: 'text', value: String(v) };
      }) } },
      { type: 'close' }
    ]
  };
  const res = await fetch(`${TURSO_HTTP}/v2/pipeline`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${TURSO_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  const result = data.results[0];
  if (result.type === 'error') throw new Error(result.error.message);
  const r = result.response.result;
  // 转换为兼容 @libsql/client 的格式
  return {
    rows: (r.rows || []).map(row => {
      const obj = {};
      (r.cols || r.columns || []).forEach((col, i) => {
        obj[col.name || col] = row[i]?.value ?? null;
      });
      return obj;
    }),
    rowsAffected: r.rows_read || 0,
    lastInsertRowid: r.last_insert_rowid ? String(r.last_insert_rowid) : null
  };
}

async function run(sql, params = []) {
  return await tursoFetch(sql, params);
}

async function get(sql, params = []) {
  const result = await tursoFetch(sql, params);
  return result.rows[0] || null;
}

async function all(sql, params = []) {
  const result = await tursoFetch(sql, params);
  return result.rows;
}

function getNow() {
  const now = new Date();
  const beijing = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  return beijing.toISOString().replace('T', ' ').substring(0, 19);
}

// ========== 数据库初始化 ==========
async function initDB() {
  // users 表
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

  // devices 表
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

  // borrow_records 表
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
    console.log('已创建示例设备');
  }
}

// 确保上传目录存在（Vercel环境跳过）
try { if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR); } catch(e) { console.log('上传目录跳过（Vercel环境下正常）'); }

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

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(UPLOAD_DIR));

// ========== JWT 中间件 ==========
function authMiddleware(req, res, next) {
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

// GET /api/health（不依赖数据库）
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'OK', time: getNow(), env: process.env.VERCEL ? 'vercel' : 'local' });
});

// ========== 认证 API ==========

// POST /api/auth/login
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.json({ success: false, message: '学工号和密码不能为空' });
  }
  const user = await get('SELECT * FROM users WHERE username = ?', [username]);
  if (!user) {
    return res.json({ success: false, message: '学工号不存在' });
  }
  if (user.status === 'disabled') {
    return res.json({ success: false, message: '该账号已被禁用，请联系管理员' });
  }
  if (!bcrypt.compareSync(password, user.password)) {
    return res.json({ success: false, message: '密码错误' });
  }
  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
  return res.json({
    success: true,
    data: {
      token,
      user: { id: user.id, username: user.username, name: user.name, role: user.role }
    }
  });
});

// POST /api/auth/register
app.post('/api/auth/register', async (req, res) => {
  const { username, name, password, phone, role } = req.body;
  if (!username || !name || !password) {
    return res.json({ success: false, message: '学工号、姓名和密码不能为空' });
  }
  if (password.length < 6) {
    return res.json({ success: false, message: '密码长度不能少于6位' });
  }
  const exist = await get('SELECT id FROM users WHERE username = ?', [username]);
  if (exist) {
    return res.json({ success: false, message: '该学工号已被注册' });
  }
  const hash = bcrypt.hashSync(password, 10);
  const now = getNow();
  const userRole = role === '教师' ? '教师' : '学生';
  await run(
    'INSERT INTO users (username, password, name, phone, role, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [username, hash, name, phone || null, userRole, 'active', now]
  );
  return res.json({ success: true, message: '注册成功，请登录' });
});

// GET /api/auth/me
app.get('/api/auth/me', authMiddleware, async (req, res) => {
  const user = await get('SELECT id, username, name, role, phone, status FROM users WHERE id = ?', [req.user.id]);
  if (!user) {
    return res.json({ success: false, message: '用户不存在' });
  }
  return res.json({ success: true, data: user });
});

// PUT /api/auth/profile
app.put('/api/auth/profile', authMiddleware, async (req, res) => {
  const { name, phone, password } = req.body;
  if (!name) {
    return res.json({ success: false, message: '姓名不能为空' });
  }
  if (password) {
    const hash = bcrypt.hashSync(password, 10);
    await run('UPDATE users SET name = ?, phone = ?, password = ? WHERE id = ?', [name, phone || null, hash, req.user.id]);
  } else {
    await run('UPDATE users SET name = ?, phone = ? WHERE id = ?', [name, phone || null, req.user.id]);
  }
  const user = await get('SELECT id, username, name, role, phone, status FROM users WHERE id = ?', [req.user.id]);
  return res.json({ success: true, message: '修改成功', data: user });
});

// ========== 用户管理 API（管理员）==========

// GET /api/users
app.get('/api/users', authMiddleware, requireAdmin, async (req, res) => {
  const users = await all('SELECT id, username, name, role, phone, status, created_at FROM users ORDER BY id');
  return res.json({ success: true, data: users });
});

// POST /api/users
app.post('/api/users', authMiddleware, requireAdmin, async (req, res) => {
  const { username, name, role, phone } = req.body;
  if (!username || !name) {
    return res.json({ success: false, message: '学工号和姓名不能为空' });
  }
  const exist = await get('SELECT id FROM users WHERE username = ?', [username]);
  if (exist) {
    return res.json({ success: false, message: '该学工号已存在' });
  }
  const hash = bcrypt.hashSync('123456', 10);
  const now = getNow();
  await run(
    'INSERT INTO users (username, password, name, role, phone, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [username, hash, name, role || '学生', phone || '', 'active', now]
  );
  return res.json({ success: true, message: '添加成功' });
});

// PUT /api/users/:id
app.put('/api/users/:id', authMiddleware, requireAdmin, async (req, res) => {
  const { name, role, phone } = req.body;
  const user = await get('SELECT id FROM users WHERE id = ?', [req.params.id]);
  if (!user) {
    return res.json({ success: false, message: '用户不存在' });
  }
  await run('UPDATE users SET name = ?, role = ?, phone = ? WHERE id = ?', [name, role, phone || '', req.params.id]);
  return res.json({ success: true, message: '编辑成功' });
});

// PATCH /api/users/:id/disable
app.patch('/api/users/:id/disable', authMiddleware, requireAdmin, async (req, res) => {
  const user = await get('SELECT id FROM users WHERE id = ?', [req.params.id]);
  if (!user) {
    return res.json({ success: false, message: '用户不存在' });
  }
  await run("UPDATE users SET status = 'disabled' WHERE id = ?", [req.params.id]);
  return res.json({ success: true, message: '已禁用' });
});

// PATCH /api/users/:id/enable
app.patch('/api/users/:id/enable', authMiddleware, requireAdmin, async (req, res) => {
  const user = await get('SELECT id FROM users WHERE id = ?', [req.params.id]);
  if (!user) {
    return res.json({ success: false, message: '用户不存在' });
  }
  await run("UPDATE users SET status = 'active' WHERE id = ?", [req.params.id]);
  return res.json({ success: true, message: '已启用' });
});

// ========== 设备管理 API ==========

// GET /api/devices
app.get('/api/devices', async (req, res) => {
  const { status } = req.query;
  let sql = 'SELECT * FROM devices';
  let params = [];
  if (status) {
    sql += ' WHERE status = ?';
    params = [status];
  }
  sql += ' ORDER BY id DESC';
  const devices = await all(sql, params);
  return res.json({ success: true, data: devices });
});

// POST /api/devices
app.post('/api/devices', authMiddleware, requireAdmin, async (req, res) => {
  const { name, model, category, total, description, image } = req.body;
  if (!name) {
    return res.json({ success: false, message: '设备名称不能为空' });
  }
  const t = total ? parseInt(total) : 1;
  const now = getNow();
  await run(
    'INSERT INTO devices (name, model, category, total, available, description, image, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [name, model || '', category || '', t, t, description || '', image || '', 'normal', now]
  );
  return res.json({ success: true, message: '添加成功' });
});

// PUT /api/devices/:id
app.put('/api/devices/:id', authMiddleware, requireAdmin, async (req, res) => {
  const { name, model, category, total, description, image } = req.body;
  const device = await get('SELECT * FROM devices WHERE id = ?', [req.params.id]);
  if (!device) {
    return res.json({ success: false, message: '设备不存在' });
  }
  const t = total ? parseInt(total) : device.total;
  const newAvailable = Math.max(0, device.available + (t - device.total));
  await run(
    'UPDATE devices SET name = ?, model = ?, category = ?, total = ?, available = ?, description = ?, image = ? WHERE id = ?',
    [name, model || '', category || '', t, newAvailable, description || '', image || '', req.params.id]
  );
  return res.json({ success: true, message: '编辑成功' });
});

// PATCH /api/devices/:id/retire
app.patch('/api/devices/:id/retire', authMiddleware, requireAdmin, async (req, res) => {
  const device = await get('SELECT id FROM devices WHERE id = ?', [req.params.id]);
  if (!device) {
    return res.json({ success: false, message: '设备不存在' });
  }
  await run("UPDATE devices SET status = 'retired' WHERE id = ?", [req.params.id]);
  return res.json({ success: true, message: '已下架' });
});

// PATCH /api/devices/:id/maintenance
app.patch('/api/devices/:id/maintenance', authMiddleware, requireAdmin, async (req, res) => {
  const device = await get('SELECT id FROM devices WHERE id = ?', [req.params.id]);
  if (!device) {
    return res.json({ success: false, message: '设备不存在' });
  }
  await run("UPDATE devices SET status = 'maintenance' WHERE id = ?", [req.params.id]);
  return res.json({ success: true, message: '已设为维修中' });
});

// PATCH /api/devices/:id/normal
app.patch('/api/devices/:id/normal', authMiddleware, requireAdmin, async (req, res) => {
  const device = await get('SELECT id FROM devices WHERE id = ?', [req.params.id]);
  if (!device) {
    return res.json({ success: false, message: '设备不存在' });
  }
  await run("UPDATE devices SET status = 'normal' WHERE id = ?", [req.params.id]);
  return res.json({ success: true, message: '已恢复' });
});

// DELETE /api/devices/:id  (软删除)
app.delete('/api/devices/:id', authMiddleware, requireAdmin, async (req, res) => {
  const device = await get('SELECT * FROM devices WHERE id = ?', [req.params.id]);
  if (!device) {
    return res.json({ success: false, message: '设备不存在' });
  }
  await run("UPDATE devices SET status = 'disabled' WHERE id = ?", [req.params.id]);
  return res.json({ success: true, message: '已删除' });
});

// ========== 借用管理 API ==========

// POST /api/borrows
app.post('/api/borrows', authMiddleware, async (req, res) => {
  const { device_id, qty, purpose, expect_return, type } = req.body;
  if (!device_id) {
    return res.json({ success: false, message: '请选择设备' });
  }
  const q = qty ? parseInt(qty) : 1;
  if (q <= 0) {
    return res.json({ success: false, message: '借用数量必须大于0' });
  }
  const device = await get('SELECT * FROM devices WHERE id = ?', [device_id]);
  if (!device) {
    return res.json({ success: false, message: '设备不存在' });
  }
  if (device.status !== 'normal') {
    return res.json({ success: false, message: '该设备当前不可借用' });
  }

  const borrowType = type || 'borrow';
  const now = getNow();
  const user = await get('SELECT username, name FROM users WHERE id = ?', [req.user.id]);

  // 预约模式
  if (borrowType === 'reserve') {
    await run(
      "INSERT INTO borrow_records (device_id, device_name, user_id, username, qty, purpose, borrow_date, expect_return, status, type, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'reserved', 'reserve', ?)",
      [device_id, device.name, req.user.id, user.username, q, purpose || '', now, expect_return || '', now]
    );
    return res.json({ success: true, message: '预约申请已提交' });
  }

  // 直接借用模式
  if (device.available < q) {
    return res.json({ success: false, message: '可借数量不足' });
  }

  await run(
    "INSERT INTO borrow_records (device_id, device_name, user_id, username, qty, purpose, borrow_date, expect_return, status, type, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'borrow', ?)",
    [device_id, device.name, req.user.id, user.username, q, purpose || '', now, expect_return || '', now]
  );

  await run('UPDATE devices SET available = available - ? WHERE id = ?', [q, device_id]);

  return res.json({ success: true, message: '借用申请已提交，请等待审批' });
});

// GET /api/borrows
app.get('/api/borrows', authMiddleware, async (req, res) => {
  let sql = 'SELECT br.*, u.name AS borrower_name FROM borrow_records br LEFT JOIN users u ON br.user_id = u.id';
  let params = [];
  let conditions = [];

  if (req.user.role !== '管理员') {
    conditions.push('br.user_id = ?');
    params.push(req.user.id);
  } else if (req.query.user_id) {
    conditions.push('br.user_id = ?');
    params.push(req.query.user_id);
  }

  if (req.query.status) {
    conditions.push('br.status = ?');
    params.push(req.query.status);
  }

  if (req.query.type) {
    conditions.push('br.type = ?');
    params.push(req.query.type);
  }

  if (conditions.length > 0) {
    sql += ' WHERE ' + conditions.join(' AND ');
  }

  sql += ' ORDER BY br.id DESC';

  const records = await all(sql, params);
  return res.json({ success: true, data: records });
});

// PUT /api/borrows/:id/approve
app.put('/api/borrows/:id/approve', authMiddleware, requireAdmin, async (req, res) => {
  const record = await get('SELECT * FROM borrow_records WHERE id = ?', [req.params.id]);
  if (!record) {
    return res.json({ success: false, message: '记录不存在' });
  }
  if (record.status !== 'pending' && record.status !== 'reserved') {
    return res.json({ success: false, message: '该记录当前状态不可审批' });
  }
  await run("UPDATE borrow_records SET status = 'approved', approver = ? WHERE id = ?", [req.user.username, req.params.id]);
  return res.json({ success: true, message: '审批通过' });
});

// PUT /api/borrows/:id/reject
app.put('/api/borrows/:id/reject', authMiddleware, requireAdmin, async (req, res) => {
  const { reason } = req.body;
  const record = await get('SELECT * FROM borrow_records WHERE id = ?', [req.params.id]);
  if (!record) {
    return res.json({ success: false, message: '记录不存在' });
  }
  if (record.status !== 'pending' && record.status !== 'reserved') {
    return res.json({ success: false, message: '该记录当前状态不可审批' });
  }
  await run("UPDATE borrow_records SET status = 'rejected', reject_reason = ?, approver = ? WHERE id = ?",
    [reason || '', req.user.username, req.params.id]);

  if (record.type !== 'reserve') {
    await run('UPDATE devices SET available = available + ? WHERE id = ?', [record.qty, record.device_id]);
  }

  return res.json({ success: true, message: '已拒绝' });
});

// PUT /api/borrows/:id/confirm
app.put('/api/borrows/:id/confirm', authMiddleware, async (req, res) => {
  const record = await get('SELECT * FROM borrow_records WHERE id = ?', [req.params.id]);
  if (!record) {
    return res.json({ success: false, message: '记录不存在' });
  }
  if (record.type !== 'reserve' || record.status !== 'approved') {
    return res.json({ success: false, message: '该记录当前状态不可确认取用' });
  }
  if (record.user_id !== req.user.id && req.user.role !== '管理员') {
    return res.json({ success: false, message: '无权操作此记录' });
  }
  const device = await get('SELECT * FROM devices WHERE id = ?', [record.device_id]);
  if (!device || device.available < record.qty) {
    return res.json({ success: false, message: '当前库存不足，无法取用' });
  }
  await run('UPDATE devices SET available = available - ? WHERE id = ?', [record.qty, record.device_id]);
  await run("UPDATE borrow_records SET status = 'borrowed' WHERE id = ?", [req.params.id]);
  return res.json({ success: true, message: '确认取用成功' });
});

// PUT /api/borrows/:id/return
app.put('/api/borrows/:id/return', authMiddleware, requireAdmin, async (req, res) => {
  const record = await get('SELECT * FROM borrow_records WHERE id = ?', [req.params.id]);
  if (!record) {
    return res.json({ success: false, message: '记录不存在' });
  }
  if (record.status !== 'approved' && record.status !== 'borrowed') {
    return res.json({ success: false, message: '该记录当前状态不可归还' });
  }
  const now = getNow();
  await run("UPDATE borrow_records SET status = 'returned', actual_return = ? WHERE id = ?", [now, req.params.id]);
  await run('UPDATE devices SET available = available + ? WHERE id = ?', [record.qty, record.device_id]);

  return res.json({ success: true, message: '归还成功' });
});

// ========== 文件上传 ==========

// POST /api/upload
if (upload) {
app.post('/api/upload', authMiddleware, upload.single('image'), (req, res) => {
  if (!req.file) return res.json({ success: false, message: '请选择图片' });
  const url = `/uploads/${req.file.filename}`;
  return res.json({ success: true, data: { url } });
});
}

// ========== 启动 ==========
// Vercel serverless: 暂不初始化，排查崩溃原因
let dbReady = Promise.resolve();
// let dbReady = initDB();
// dbReady.catch(err => {
//   console.error('数据库初始化失败:', err);
//   if (!process.env.VERCEL) process.exit(1);
// });

// 数据库就绪中间件（health 端点除外）
app.use('/api', (req, res, next) => {
  if (req.path === '/health') return next();
  dbReady.then(() => next()).catch(() => {
    res.status(503).json({ success: false, message: '服务初始化中，请稍后重试' });
  });
});

// Vercel serverless 不监听端口；本地开发时监听
if (!process.env.VERCEL) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`掌上设备通后端已启动（Turso云端数据库）: http://localhost:${PORT}`);
    console.log(`局域网访问: http://192.168.0.100:${PORT}`);
  });
} else {
  console.log('Vercel serverless 模式已就绪');
}

module.exports = app;