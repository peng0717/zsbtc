const express = require('express');
const router = express.Router();
const { get, all, run, getNow } = require('../db');
const { authMiddleware, requireAdmin } = require('../app-middleware');

// POST /api/borrows
router.post('/', authMiddleware, async (req, res) => {
  let { device_id, device_name, qty, purpose, expect_return, type } = req.body;
  const q = qty ? parseInt(qty) : 1;
  if (q <= 0) {
    return res.json({ success: false, message: '借用数量必须大于0' });
  }

  // 同时只能借1台设备（pending 不占用名额，允许在审批期间提交其他申请）
  const activeBorrows = await get(
    "SELECT COUNT(*) as count FROM borrow_records WHERE user_id = ? AND status IN ('approved', 'borrowed')",
    [req.user.id]
  );
  if (activeBorrows && activeBorrows.count >= 1) {
    return res.json({ success: false, message: '当前有未归还的设备，请先归还后再借' });
  }

  let device = null;
  if (device_id) {
    device = await get('SELECT * FROM devices WHERE id = ?', [device_id]);
  } else if (device_name) {
    const devices = await all(
      "SELECT * FROM devices WHERE name LIKE ? AND status = 'normal'",
      [`%${device_name}%`]
    );
    if (devices.length === 0) {
      return res.json({ success: false, message: '未找到匹配的设备' });
    }
    if (devices.length > 1) {
      return res.json({ success: false, data: devices, message: '找到多个匹配设备，请选择' });
    }
    device = devices[0];
    device_id = device.id;
  }

  if (!device) {
    return res.json({ success: false, message: '请选择设备' });
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

  // 校验预计归还日期必须是未来时间
  if (expect_return && expect_return < now.substring(0, 10)) {
    return res.json({ success: false, message: '预计归还日期不能早于今天' });
  }

  const initialStatus = 'pending';

  const insertResult = await run(
    "INSERT INTO borrow_records (device_id, device_name, user_id, username, qty, purpose, borrow_date, expect_return, status, type, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'borrow', ?)",
    [device_id, device.name, req.user.id, user.username, q, purpose || '', now, expect_return || '', initialStatus, now]
  );

  try {
    await run('UPDATE devices SET available = available - ? WHERE id = ?', [q, device_id]);
  } catch (e) {
    await run('DELETE FROM borrow_records WHERE id = ?', [insertResult.lastInsertRowid]);
    console.error('扣减库存失败，已回滚借用记录:', e);
    return res.json({ success: false, message: '系统错误，请稍后重试' });
  }

  return res.json({ success: true, message: '借用申请已提交，请等待审批' });
});

// GET /api/borrows
router.get('/', authMiddleware, async (req, res) => {
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

  // 逾期筛选
  if (req.query.overdue === 'true') {
    conditions.push("br.status IN ('borrowed', 'approved')");
    conditions.push("br.expect_return IS NOT NULL AND br.expect_return != ''");
    conditions.push("br.expect_return < ?");
    params.push(getNow());
  }

  if (conditions.length > 0) {
    sql += ' WHERE ' + conditions.join(' AND ');
  }

  sql += ' ORDER BY br.id DESC';

  const records = await all(sql, params);

  // 附加逾期标记
  const now = getNow();
  const enriched = records.map(r => ({
    ...r,
    is_overdue: !!(r.status === 'borrowed' || r.status === 'approved') && r.expect_return && r.expect_return < now
  }));

  return res.json({ success: true, data: enriched });
});

// PUT /api/borrows/:id/approve
router.put('/:id/approve', authMiddleware, requireAdmin, async (req, res) => {
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
router.put('/:id/reject', authMiddleware, requireAdmin, async (req, res) => {
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
router.put('/:id/confirm', authMiddleware, async (req, res) => {
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
router.put('/:id/return', authMiddleware, requireAdmin, async (req, res) => {
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

// DELETE /api/borrows/:id
router.delete('/:id', authMiddleware, async (req, res) => {
  const record = await get('SELECT * FROM borrow_records WHERE id = ?', [req.params.id]);
  if (!record) {
    return res.json({ success: false, message: '记录不存在' });
  }
  if (req.user.role !== '管理员' && record.user_id !== req.user.id) {
    return res.json({ success: false, message: '无权删除此记录' });
  }
  if (record.status === 'approved' || record.status === 'borrowed') {
    await run('UPDATE devices SET available = available + ? WHERE id = ?', [record.qty, record.device_id]);
  }
  await run('DELETE FROM borrow_records WHERE id = ?', [req.params.id]);
  return res.json({ success: true, message: '删除成功' });
});

// POST /api/borrows/admin（管理员辅助登记）
router.post('/admin', authMiddleware, requireAdmin, async (req, res) => {
  const { username, device_id, device_name, qty, purpose, expect_return, type } = req.body;
  if (!username) {
    return res.json({ success: false, message: '请输入学工号' });
  }
  const q = qty ? parseInt(qty) : 1;
  if (q <= 0) {
    return res.json({ success: false, message: '借用数量必须大于0' });
  }

  const user = await get("SELECT id, username, name, role FROM users WHERE username = ? AND status = 'active'", [username]);
  if (!user) {
    return res.json({ success: false, message: '用户不存在或已被禁用' });
  }

  // 检查该用户是否有未归还的设备（管理员辅助登记时也需提醒）
  const activeBorrows = await get(
    "SELECT COUNT(*) as count FROM borrow_records WHERE user_id = ? AND status IN ('approved', 'borrowed')",
    [user.id]
  );
  if (activeBorrows && activeBorrows.count >= 1) {
    return res.json({ success: false, message: '该用户当前有未归还的设备，请先归还后再借' });
  }

  let device = null;
  if (device_id) {
    device = await get('SELECT * FROM devices WHERE id = ?', [device_id]);
  } else if (device_name) {
    const devices = await all(
      "SELECT * FROM devices WHERE name LIKE ? AND status = 'normal'",
      [`%${device_name}%`]
    );
    if (devices.length === 0) {
      return res.json({ success: false, message: '未找到匹配的设备' });
    }
    if (devices.length > 1) {
      return res.json({ success: false, data: devices, message: '找到多个匹配设备，请选择' });
    }
    device = devices[0];
  }
  if (!device) {
    return res.json({ success: false, message: '请选择设备' });
  }
  if (device.status !== 'normal') {
    return res.json({ success: false, message: '该设备当前不可借用' });
  }
  if (device.available < q) {
    return res.json({ success: false, message: '可借数量不足' });
  }

  const now = getNow();
  const borrowType = type || 'borrow';

  // 校验预计归还日期必须是未来时间
  if (expect_return && expect_return < now.substring(0, 10)) {
    return res.json({ success: false, message: '预计归还日期不能早于今天' });
  }

  await run(
    "INSERT INTO borrow_records (device_id, device_name, user_id, username, qty, purpose, borrow_date, expect_return, status, type, approver, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'approved', ?, ?, ?)",
    [device.id, device.name, user.id, user.username, q, purpose || '', now, expect_return || '', borrowType, req.user.username, now]
  );

  await run('UPDATE devices SET available = available - ? WHERE id = ?', [q, device.id]);

  return res.json({ success: true, message: '登记成功，已自动审批' });
});

// GET /api/borrows/summary - 个人借用摘要
router.get('/summary', authMiddleware, async (req, res) => {
  const now = getNow();
  const userId = req.user.id;

  const borrowing = await get(
    "SELECT COUNT(*) as count FROM borrow_records WHERE user_id = ? AND status IN ('approved', 'borrowed')",
    [userId]
  );

  const toReturn = await get(
    "SELECT COUNT(*) as count FROM borrow_records WHERE user_id = ? AND status IN ('approved', 'borrowed') AND expect_return IS NOT NULL AND expect_return != '' AND expect_return < ?",
    [userId, now]
  );

  const overdue = await get(
    "SELECT COUNT(*) as count FROM borrow_records WHERE user_id = ? AND status IN ('approved', 'borrowed') AND expect_return IS NOT NULL AND expect_return != '' AND expect_return < ?",
    [userId, now]
  );

  res.json({
    success: true,
    data: {
      borrowing: borrowing.count,
      toReturn: toReturn.count,
      overdue: overdue.count
    }
  });
});

module.exports = router;