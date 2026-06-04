const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const { get, run, getNow } = require('../db');
const { authMiddleware, validatePassword } = require('../app-middleware');

const JWT_SECRET = process.env.JWT_SECRET;

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: '注册频率过高，请1小时后重试' }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
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
  if (!JWT_SECRET) return res.status(500).json({ success: false, message: 'JWT_SECRET 未配置' });
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
router.post('/register', registerLimiter, async (req, res) => {
  const { username, name, password, phone, role } = req.body;
  if (!username || !name || !password) {
    return res.json({ success: false, message: '学工号、姓名和密码不能为空' });
  }

  // 字段长度校验
  if (username.length > 30 || name.length > 50) {
    return res.json({ success: false, message: '学工号或姓名过长' });
  }
  if (phone && phone.length > 20) {
    return res.json({ success: false, message: '手机号格式不正确' });
  }

  // 密码复杂度校验
  const pwdError = validatePassword(password);
  if (pwdError) {
    return res.json({ success: false, message: pwdError });
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
router.get('/me', authMiddleware, async (req, res) => {
  const user = await get('SELECT id, username, name, role, phone, status FROM users WHERE id = ?', [req.user.id]);
  if (!user) {
    return res.json({ success: false, message: '用户不存在' });
  }
  return res.json({ success: true, data: user });
});

// PUT /api/auth/profile
router.put('/profile', authMiddleware, async (req, res) => {
  const { name, phone, password } = req.body;
  if (!name) {
    return res.json({ success: false, message: '姓名不能为空' });
  }

  if (password) {
    // 密码复杂度校验
    const pwdError = validatePassword(password);
    if (pwdError) {
      return res.json({ success: false, message: pwdError });
    }
    const hash = bcrypt.hashSync(password, 10);
    await run('UPDATE users SET name = ?, phone = ?, password = ? WHERE id = ?', [name, phone || null, hash, req.user.id]);
  } else {
    await run('UPDATE users SET name = ?, phone = ? WHERE id = ?', [name, phone || null, req.user.id]);
  }
  const user = await get('SELECT id, username, name, role, phone, status FROM users WHERE id = ?', [req.user.id]);
  return res.json({ success: true, message: '修改成功', data: user });
});

// POST /api/auth/logout
router.post('/logout', authMiddleware, async (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader.split(' ')[1];
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  await run('INSERT INTO blacklisted_tokens (token_hash) VALUES (?)', [tokenHash]);
  return res.json({ success: true, message: '已退出登录' });
});

// POST /api/auth/reset-password
router.post('/reset-password', authMiddleware, requireAdmin, async (req, res) => {
  const { user_id, new_password } = req.body;
  if (!user_id || !new_password) {
    return res.json({ success: false, message: '缺少参数' });
  }
  if (new_password.length < 6) {
    return res.json({ success: false, message: '密码至少6位' });
  }
  const user = await get('SELECT id, username FROM users WHERE id = ?', [user_id]);
  if (!user) {
    return res.json({ success: false, message: '用户不存在' });
  }
  const hash = crypto.createHash('sha256').update(new_password).digest('hex');
  await run('UPDATE users SET password = ? WHERE id = ?', [hash, user_id]);
  return res.json({ success: true, message: '密码重置成功' });
});

module.exports = router;