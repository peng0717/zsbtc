const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const { get, all, run, getNow } = require('../db');
const { authMiddleware, requireAdmin } = require('../app-middleware');
const { auditLog } = require('../db');

// ========== 统计看板 API ==========

// GET /api/admin/dashboard
router.get('/dashboard', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const now = getNow();
    const today = now.substring(0, 10); // YYYY-MM-DD

    // 设备总数
    const totalDevices = await get("SELECT COUNT(*) as count FROM devices WHERE status != 'deleted'");
    // 借用中数量
    const borrowedCount = await get(
      "SELECT COUNT(*) as count FROM borrow_records WHERE status IN ('approved', 'borrowed')"
    );
    // 今日借用数
    const todayBorrows = await get(
      "SELECT COUNT(*) as count FROM borrow_records WHERE borrow_date LIKE ?",
      [`${today}%`]
    );
    // 逾期数量
    const overdueCount = await get(
      "SELECT COUNT(*) as count FROM borrow_records WHERE status IN ('approved', 'borrowed') AND expect_return IS NOT NULL AND expect_return != '' AND expect_return < ?",
      [now]
    );

    return res.json({
      success: true,
      data: {
        totalDevices: totalDevices?.count || 0,
        borrowedCount: borrowedCount?.count || 0,
        todayBorrows: todayBorrows?.count || 0,
        overdueCount: overdueCount?.count || 0
      }
    });
  } catch (e) {
    return res.json({ success: false, message: '获取统计数据失败' });
  }
});

// ========== 用户管理 API ==========

// GET /api/admin/users/search
router.get('/users/search', authMiddleware, requireAdmin, async (req, res) => {
  const { keyword } = req.query;
  if (!keyword) {
    return res.json({ success: false, message: '请输入搜索关键词' });
  }
  const users = await all(
    "SELECT id, username, name, role, phone, status FROM users WHERE (username LIKE ? OR name LIKE ?) AND status = 'active' ORDER BY id LIMIT 20",
    [`%${keyword}%`, `%${keyword}%`]
  );
  return res.json({ success: true, data: users });
});

// GET /api/admin/users
router.get('/users', authMiddleware, requireAdmin, async (req, res) => {
  const users = await all('SELECT id, username, name, role, phone, status, created_at FROM users ORDER BY id DESC LIMIT 200');
  return res.json({ success: true, data: users });
});

// POST /api/admin/users
router.post('/users', authMiddleware, requireAdmin, async (req, res) => {
  const { username, name, role, phone, password } = req.body;
  if (!username || !name) {
    return res.json({ success: false, message: '学工号和姓名不能为空' });
  }
  const exist = await get('SELECT id FROM users WHERE username = ?', [username]);
  if (exist) {
    return res.json({ success: false, message: '该学工号已存在' });
  }
  
  // 如果密码为空，生成随机密码
  let finalPassword = password;
  if (!finalPassword) {
    finalPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-4);
  }
  
  const hash = bcrypt.hashSync(finalPassword, 10);
  const now = getNow();
  await run(
    'INSERT INTO users (username, password, name, role, phone, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [username, hash, name, role || '学生', phone || '', 'active', now]
  );
  
  // 获取新用户ID用于审计日志
  const newUser = await get('SELECT id FROM users WHERE username = ?', [username]);
  await auditLog({
    userId: req.user.id, username: req.user.username,
    action: '添加用户', targetType: 'user', targetId: newUser?.id,
    detail: `添加用户 ${username}（${name}），角色: ${role || '学生'}`
  });
  
  return res.json({ 
    success: true, 
    message: password ? '添加成功' : `添加成功，初始密码为：${finalPassword}（请告知用户修改）`,
    data: { generatedPassword: password ? null : finalPassword }
  });
});

// PUT /api/admin/users/:id
router.put('/users/:id', authMiddleware, requireAdmin, async (req, res) => {
  const { name, role, phone } = req.body;
  const user = await get('SELECT id FROM users WHERE id = ?', [req.params.id]);
  if (!user) {
    return res.json({ success: false, message: '用户不存在' });
  }
  if (!name || !name.trim()) {
    return res.json({ success: false, message: '姓名不能为空' });
  }
  const validRoles = ['学生', '教师', '管理员'];
  if (role && !validRoles.includes(role)) {
    return res.json({ success: false, message: '角色无效' });
  }
  const safeName = name.trim().substring(0, 50);
  const safePhone = (phone || '').substring(0, 20);
  await run('UPDATE users SET name = ?, role = ?, phone = ? WHERE id = ?', [safeName, role, safePhone, req.params.id]);
  await auditLog({
    userId: req.user.id, username: req.user.username,
    action: '编辑用户', targetType: 'user', targetId: parseInt(req.params.id),
    detail: `编辑用户 #${req.params.id}，姓名: ${safeName}，角色: ${role}`
  });
  return res.json({ success: true, message: '编辑成功' });
});

// PATCH /api/admin/users/:id/disable
router.patch('/users/:id/disable', authMiddleware, requireAdmin, async (req, res) => {
  const user = await get('SELECT id FROM users WHERE id = ?', [req.params.id]);
  if (!user) {
    return res.json({ success: false, message: '用户不存在' });
  }
  await run("UPDATE users SET status = 'disabled' WHERE id = ?", [req.params.id]);
  await auditLog({
    userId: req.user.id, username: req.user.username,
    action: '禁用用户', targetType: 'user', targetId: parseInt(req.params.id),
    detail: `禁用用户 #${req.params.id}`
  });
  return res.json({ success: true, message: '已禁用' });
});

// PATCH /api/admin/users/:id/enable
router.patch('/users/:id/enable', authMiddleware, requireAdmin, async (req, res) => {
  const user = await get('SELECT id FROM users WHERE id = ?', [req.params.id]);
  if (!user) {
    return res.json({ success: false, message: '用户不存在' });
  }
  await run("UPDATE users SET status = 'active' WHERE id = ?", [req.params.id]);
  await auditLog({
    userId: req.user.id, username: req.user.username,
    action: '启用用户', targetType: 'user', targetId: parseInt(req.params.id),
    detail: `启用用户 #${req.params.id}`
  });
  return res.json({ success: true, message: '已启用' });
});

// GET /api/admin/audit-logs
router.get('/audit-logs', authMiddleware, requireAdmin, async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize) || 20));
  const offset = (page - 1) * pageSize;

  let conditions = [];
  let params = [];

  if (req.query.action) {
    conditions.push('action LIKE ?');
    params.push(`%${req.query.action}%`);
  }
  if (req.query.username) {
    conditions.push('username = ?');
    params.push(req.query.username);
  }
  if (req.query.targetType) {
    conditions.push('target_type = ?');
    params.push(req.query.targetType);
  }

  const whereClause = conditions.length > 0 ? ' WHERE ' + conditions.join(' AND ') : '';

  const countResult = await get(
    `SELECT COUNT(*) as total FROM audit_logs${whereClause}`,
    params
  );
  const total = countResult?.total || 0;

  const logs = await all(
    `SELECT * FROM audit_logs${whereClause} ORDER BY id DESC LIMIT ? OFFSET ?`,
    [...params, pageSize, offset]
  );

  return res.json({
    success: true,
    data: logs,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize)
  });
});

module.exports = router;