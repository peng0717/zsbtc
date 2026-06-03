const express = require('express');
const router = express.Router();
const { get, all, run, getNow } = require('../db');
const { authMiddleware, requireAdmin } = require('../app-middleware');

// POST /api/repairs — 用户提交报修
router.post('/', authMiddleware, async (req, res) => {
  const { device_id, issue_type, description, images } = req.body;
  if (!device_id || !issue_type || !description) {
    return res.json({ success: false, message: '设备ID、故障类型和描述不能为空' });
  }

  const device = await get('SELECT * FROM devices WHERE id = ?', [device_id]);
  if (!device) {
    return res.json({ success: false, message: '设备不存在' });
  }

  // 同一设备同一用户不能有 pending 状态的重复报修
  const dup = await get(
    "SELECT id FROM repair_reports WHERE device_id = ? AND user_id = ? AND status = 'pending'",
    [device_id, req.user.id]
  );
  if (dup) {
    return res.json({ success: false, message: '该设备已有待处理的报修记录' });
  }

  const now = getNow();
  const result = await run(
    'INSERT INTO repair_reports (device_id, user_id, issue_type, description, images, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [device_id, req.user.id, issue_type, description, images || '', 'pending', now, now]
  );

  // 主动报修：信用加5分（通过 credits 逻辑）
  try {
    const creditsRouter = require('./credits');
    // 直接写 credit_records
    await run(
      'INSERT INTO credit_records (user_id, change_amount, reason, created_at) VALUES (?, ?, ?, ?)',
      [req.user.id, 5, '主动报修', now]
    );
    await run('UPDATE users SET credit_score = credit_score + 5 WHERE id = ?', [req.user.id]);
  } catch (e) {
    // 信用表可能尚未创建，忽略
  }

  return res.json({ success: true, message: '报修提交成功', data: { id: result.lastInsertRowid } });
});

// GET /api/repairs — 管理员查看报修列表
router.get('/', authMiddleware, requireAdmin, async (req, res) => {
  let sql = `SELECT rr.*, d.name AS device_name, u.name AS user_name, u.username AS user_username
             FROM repair_reports rr
             LEFT JOIN devices d ON rr.device_id = d.id
             LEFT JOIN users u ON rr.user_id = u.id`;
  let params = [];

  if (req.query.status) {
    sql += ' WHERE rr.status = ?';
    params.push(req.query.status);
  }

  sql += ' ORDER BY rr.id DESC';

  const records = await all(sql, params);
  return res.json({ success: true, data: records });
});

// GET /api/repairs/mine — 用户查看自己的报修记录
router.get('/mine', authMiddleware, async (req, res) => {
  const records = await all(
    `SELECT rr.*, d.name AS device_name
     FROM repair_reports rr
     LEFT JOIN devices d ON rr.device_id = d.id
     WHERE rr.user_id = ?
     ORDER BY rr.id DESC`,
    [req.user.id]
  );
  return res.json({ success: true, data: records });
});

// PUT /api/repairs/:id — 管理员处理报修
router.put('/:id', authMiddleware, requireAdmin, async (req, res) => {
  const { status, handle_remark } = req.body;
  if (!status) {
    return res.json({ success: false, message: '状态不能为空' });
  }

  const record = await get('SELECT * FROM repair_reports WHERE id = ?', [req.params.id]);
  if (!record) {
    return res.json({ success: false, message: '报修记录不存在' });
  }

  const now = getNow();
  await run(
    'UPDATE repair_reports SET status = ?, handle_remark = ?, handler_id = ?, updated_at = ? WHERE id = ?',
    [status, handle_remark || '', req.user.id, now, req.params.id]
  );

  // 如果状态改为 completed，自动将设备状态恢复为 normal
  if (status === 'completed') {
    await run("UPDATE devices SET status = 'normal' WHERE id = ?", [record.device_id]);

    // 设备损坏：扣 20 分
    try {
      await run(
        'INSERT INTO credit_records (user_id, change_amount, reason, created_at) VALUES (?, ?, ?, ?)',
        [record.user_id, -20, '设备损坏', now]
      );
      await run('UPDATE users SET credit_score = credit_score - 20 WHERE id = ?', [record.user_id]);
    } catch (e) {
      // 信用表可能尚未创建，忽略
    }
  }

  return res.json({ success: true, message: '处理成功' });
});

module.exports = router;
