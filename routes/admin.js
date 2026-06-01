const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const { get, all, run, getNow } = require('../db');
const { authMiddleware, requireAdmin } = require('../app-middleware');

// ========== 统计看板 API ==========

// GET /api/admin/dashboard
router.get('/dashboard', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const now = getNow();
    const today = now.substring(0, 10); // YYYY-MM-DD

    // 设备总数
    const totalDevices = await get('SELECT COUNT(*) as count FROM devices');
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
  const users = await all('SELECT id, username, name, role, phone, status, created_at FROM users ORDER BY id');
  return res.json({ success: true, data: users });
});

// POST /api/admin/users
router.post('/users', authMiddleware, requireAdmin, async (req, res) => {
  const { username, name, role, phone, password } = req.body;
  if (!username || !name) {
    return res.json({ success: false, message: '学工号和姓名不能为空' });
  }
  if (!password) {
    return res.json({ success: false, message: '密码为必填项' });
  }
  const exist = await get('SELECT id FROM users WHERE username = ?', [username]);
  if (exist) {
    return res.json({ success: false, message: '该学工号已存在' });
  }
  const hash = bcrypt.hashSync(password, 10);
  const now = getNow();
  await run(
    'INSERT INTO users (username, password, name, role, phone, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [username, hash, name, role || '学生', phone || '', 'active', now]
  );
  return res.json({ success: true, message: '添加成功' });
});

// PUT /api/admin/users/:id
router.put('/users/:id', authMiddleware, requireAdmin, async (req, res) => {
  const { name, role, phone } = req.body;
  const user = await get('SELECT id FROM users WHERE id = ?', [req.params.id]);
  if (!user) {
    return res.json({ success: false, message: '用户不存在' });
  }
  await run('UPDATE users SET name = ?, role = ?, phone = ? WHERE id = ?', [name, role, phone || '', req.params.id]);
  return res.json({ success: true, message: '编辑成功' });
});

// PATCH /api/admin/users/:id/disable
router.patch('/users/:id/disable', authMiddleware, requireAdmin, async (req, res) => {
  const user = await get('SELECT id FROM users WHERE id = ?', [req.params.id]);
  if (!user) {
    return res.json({ success: false, message: '用户不存在' });
  }
  await run("UPDATE users SET status = 'disabled' WHERE id = ?", [req.params.id]);
  return res.json({ success: true, message: '已禁用' });
});

// PATCH /api/admin/users/:id/enable
router.patch('/users/:id/enable', authMiddleware, requireAdmin, async (req, res) => {
  const user = await get('SELECT id FROM users WHERE id = ?', [req.params.id]);
  if (!user) {
    return res.json({ success: false, message: '用户不存在' });
  }
  await run("UPDATE users SET status = 'active' WHERE id = ?", [req.params.id]);
  return res.json({ success: true, message: '已启用' });
});

module.exports = router;