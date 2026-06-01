const express = require('express');
const router = express.Router();
const { get, all, run, getNow } = require('../db');
const { authMiddleware, requireAdmin } = require('../middleware');

// GET /api/devices/search
router.get('/search', async (req, res) => {
  const { keyword } = req.query;
  if (!keyword) {
    return res.json({ success: false, message: '请输入搜索关键词' });
  }
  const devices = await all(
    "SELECT * FROM devices WHERE name LIKE ? AND status = 'normal' ORDER BY id DESC LIMIT 20",
    [`%${keyword}%`]
  );
  return res.json({ success: true, data: devices });
});

// GET /api/devices
router.get('/', async (req, res) => {
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
router.post('/', authMiddleware, requireAdmin, async (req, res) => {
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
router.put('/:id', authMiddleware, requireAdmin, async (req, res) => {
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
router.patch('/:id/retire', authMiddleware, requireAdmin, async (req, res) => {
  const device = await get('SELECT id FROM devices WHERE id = ?', [req.params.id]);
  if (!device) {
    return res.json({ success: false, message: '设备不存在' });
  }
  await run("UPDATE devices SET status = 'retired' WHERE id = ?", [req.params.id]);
  return res.json({ success: true, message: '已下架' });
});

// PATCH /api/devices/:id/maintenance
router.patch('/:id/maintenance', authMiddleware, requireAdmin, async (req, res) => {
  const device = await get('SELECT id FROM devices WHERE id = ?', [req.params.id]);
  if (!device) {
    return res.json({ success: false, message: '设备不存在' });
  }
  await run("UPDATE devices SET status = 'maintenance' WHERE id = ?", [req.params.id]);
  return res.json({ success: true, message: '已设为维修中' });
});

// PATCH /api/devices/:id/normal
router.patch('/:id/normal', authMiddleware, requireAdmin, async (req, res) => {
  const device = await get('SELECT id FROM devices WHERE id = ?', [req.params.id]);
  if (!device) {
    return res.json({ success: false, message: '设备不存在' });
  }
  await run("UPDATE devices SET status = 'normal' WHERE id = ?", [req.params.id]);
  return res.json({ success: true, message: '已恢复' });
});

// DELETE /api/devices/:id (软删除)
router.delete('/:id', authMiddleware, requireAdmin, async (req, res) => {
  const device = await get('SELECT * FROM devices WHERE id = ?', [req.params.id]);
  if (!device) {
    return res.json({ success: false, message: '设备不存在' });
  }
  await run("UPDATE devices SET status = 'disabled' WHERE id = ?", [req.params.id]);
  return res.json({ success: true, message: '已删除' });
});

module.exports = router;