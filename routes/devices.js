const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const { get, all, run, getNow } = require('../db');
const { authMiddleware, requireAdmin } = require('../app-middleware');
const { auditLog } = require('../db');

// GET /api/devices/search
router.get('/search', authMiddleware, async (req, res) => {
  const { keyword } = req.query;
  if (!keyword) {
    return res.json({ success: false, message: '请输入搜索关键词' });
  }
  const devices = await all(
    "SELECT * FROM devices WHERE name LIKE ? AND status != 'deleted' ORDER BY id DESC LIMIT 20",
    [`%${keyword}%`]
  );
  return res.json({ success: true, data: devices });
});

// GET /api/devices
router.get('/', authMiddleware, async (req, res) => {
  const { status } = req.query;
  let sql = 'SELECT * FROM devices';
  let params = [];
  if (status) {
    sql += ' WHERE status = ?';
    params = [status];
  } else {
    sql += " WHERE status != 'deleted'";
  }
  sql += ' ORDER BY id DESC';
  const devices = await all(sql, params);
  return res.json({ success: true, data: devices });
});

// POST /api/devices
router.post('/', authMiddleware, requireAdmin, async (req, res) => {
  const { name, model, category, total, description, image, qr_code, qr_codes } = req.body;
  if (!name) {
    return res.json({ success: false, message: '设备名称不能为空' });
  }
  const t = Math.max(1, parseInt(total) || 1);
  const now = getNow();
  // 优先使用 qr_codes（逗号分隔的多二维码），其次 qr_code，最后为空自动生成
  let finalQrCode = qr_codes || qr_code || '';

  if (finalQrCode) {
    // 使用前端传入的 qr_codes/qr_code
    const result = await run(
      'INSERT INTO devices (name, model, category, total, available, description, image, qr_code, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [name, model || '', category || '', t, t, description || '', image || '', finalQrCode, 'normal', now]
    );
    const deviceId = result.lastInsertRowid;
    await auditLog({
      userId: req.user.id, username: req.user.username,
      action: '添加设备', targetType: 'device', targetId: parseInt(deviceId),
      detail: `添加设备 ${name}，数量: ${t}，分类: ${category || ''}`
    });
    return res.json({ success: true, message: '添加成功', data: { id: deviceId, qr_code: finalQrCode } });
  }

  // 未传 qr_code 时自动生成
  const result = await run(
    'INSERT INTO devices (name, model, category, total, available, description, image, qr_code, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [name, model || '', category || '', t, t, description || '', image || '', '', 'normal', now]
  );
  const deviceId = result.lastInsertRowid;
  finalQrCode = Buffer.from(`DEV-${deviceId}-${Date.now()}`).toString('base64');
  await run('UPDATE devices SET qr_code = ? WHERE id = ?', [finalQrCode, deviceId]);
  await auditLog({
    userId: req.user.id, username: req.user.username,
    action: '添加设备', targetType: 'device', targetId: parseInt(deviceId),
    detail: `添加设备 ${name}，数量: ${t}，分类: ${category || ''}`
  });
  return res.json({ success: true, message: '添加成功', data: { id: deviceId, qr_code: finalQrCode } });
});

// POST /api/devices/qr-generate
router.post('/qr-generate', authMiddleware, requireAdmin, async (req, res) => {
  const { deviceName } = req.body;
  const qrCode = 'DEV-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).substring(2, 8).toUpperCase();
  return res.json({ success: true, data: { qr_code: qrCode } });
});

// PUT /api/devices/:id
router.put('/:id', authMiddleware, requireAdmin, async (req, res) => {
  const { name, model, category, total, description, image, qr_codes } = req.body;
  const device = await get('SELECT * FROM devices WHERE id = ?', [req.params.id]);
  if (!device) {
    return res.json({ success: false, message: '设备不存在' });
  }
  const t = total != null && total !== '' ? Math.max(0, parseInt(total) || 0) : device.total;
  const newTotal = Math.max(0, t);
  const newAvailable = Math.max(0, Math.min(newTotal, device.available + (newTotal - device.total)));
  const finalQrCode = qr_codes !== undefined ? qr_codes : device.qr_code;
  await run(
    'UPDATE devices SET name = ?, model = ?, category = ?, total = ?, available = ?, description = ?, image = ?, qr_code = ? WHERE id = ?',
    [name, model || '', category || '', t, newAvailable, description || '', image || '', finalQrCode, req.params.id]
  );
  await auditLog({
    userId: req.user.id, username: req.user.username,
    action: '编辑设备', targetType: 'device', targetId: parseInt(req.params.id),
    detail: `编辑设备 #${req.params.id}，名称: ${name}，总数: ${t}`
  });
  return res.json({ success: true, message: '编辑成功' });
});

// PATCH /api/devices/:id/retire
router.patch('/:id/retire', authMiddleware, requireAdmin, async (req, res) => {
  const device = await get('SELECT id, name FROM devices WHERE id = ?', [req.params.id]);
  if (!device) {
    return res.json({ success: false, message: '设备不存在' });
  }
  await run("UPDATE devices SET status = 'retired' WHERE id = ?", [req.params.id]);
  await auditLog({
    userId: req.user.id, username: req.user.username,
    action: '下架设备', targetType: 'device', targetId: parseInt(req.params.id),
    detail: `下架设备 ${device.name}`
  });
  return res.json({ success: true, message: '已下架' });
});

// PATCH /api/devices/:id/maintenance
router.patch('/:id/maintenance', authMiddleware, requireAdmin, async (req, res) => {
  const device = await get('SELECT id, name FROM devices WHERE id = ?', [req.params.id]);
  if (!device) {
    return res.json({ success: false, message: '设备不存在' });
  }
  await run("UPDATE devices SET status = 'maintenance' WHERE id = ?", [req.params.id]);
  await auditLog({
    userId: req.user.id, username: req.user.username,
    action: '设备报修', targetType: 'device', targetId: parseInt(req.params.id),
    detail: `设备 ${device.name} 设为维修中`
  });
  return res.json({ success: true, message: '已设为维修中' });
});

// PATCH /api/devices/:id/normal
router.patch('/:id/normal', authMiddleware, requireAdmin, async (req, res) => {
  const device = await get('SELECT id, name FROM devices WHERE id = ?', [req.params.id]);
  if (!device) {
    return res.json({ success: false, message: '设备不存在' });
  }
  await run("UPDATE devices SET status = 'normal' WHERE id = ?", [req.params.id]);
  await auditLog({
    userId: req.user.id, username: req.user.username,
    action: '恢复设备', targetType: 'device', targetId: parseInt(req.params.id),
    detail: `恢复设备 ${device.name} 为正常`
  });
  return res.json({ success: true, message: '已恢复' });
});

// GET /api/devices/by-qr/:qrCode
router.get('/by-qr/:qrCode', authMiddleware, async (req, res) => {
  const device = await get('SELECT * FROM devices WHERE qr_code LIKE ? AND status != ?', [`%${req.params.qrCode}%`, 'deleted']);
  if (!device) {
    return res.json({ success: false, message: '设备不存在或已删除' });
  }
  return res.json({ success: true, data: device });
});

// DELETE /api/devices/:id (软删除)
router.delete('/:id', authMiddleware, requireAdmin, async (req, res) => {
  const device = await get('SELECT * FROM devices WHERE id = ?', [req.params.id]);
  if (!device) {
    return res.json({ success: false, message: '设备不存在' });
  }
  await run("UPDATE devices SET status = 'deleted' WHERE id = ?", [req.params.id]);
  await auditLog({
    userId: req.user.id, username: req.user.username,
    action: '删除设备', targetType: 'device', targetId: parseInt(req.params.id),
    detail: `删除设备 ${device.name}`
  });
  return res.json({ success: true, message: '已删除' });
});

module.exports = router;