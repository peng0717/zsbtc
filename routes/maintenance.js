const express = require('express');
const router = express.Router();
const { get, all, run, getNow } = require('../db');
const { authMiddleware, requireAdmin } = require('../app-middleware');

// POST /api/maintenance/plans — 创建维护计划
router.post('/plans', authMiddleware, requireAdmin, async (req, res) => {
  const { device_id, plan_name, frequency_days, description } = req.body;
  if (!device_id || !plan_name || !frequency_days) {
    return res.json({ success: false, message: '设备ID、计划名和周期不能为空' });
  }

  const device = await get('SELECT id FROM devices WHERE id = ?', [device_id]);
  if (!device) {
    return res.json({ success: false, message: '设备不存在' });
  }

  const now = getNow();
  // 计算下次维护时间：now + frequency_days
  const nextDate = new Date();
  nextDate.setDate(nextDate.getDate() + parseInt(frequency_days));
  const nextMaintainAt = nextDate.toISOString().replace('T', ' ').substring(0, 19);

  const result = await run(
    'INSERT INTO maintenance_plans (device_id, plan_name, frequency_days, description, next_maintain_at, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [device_id, plan_name, frequency_days, description || '', nextMaintainAt, 'active', now]
  );

  return res.json({ success: true, message: '维护计划已创建', data: { id: result.lastInsertRowid } });
});

// GET /api/maintenance/plans — 获取维护计划列表
router.get('/plans', authMiddleware, requireAdmin, async (req, res) => {
  let sql = `SELECT mp.*, d.name AS device_name
             FROM maintenance_plans mp
             LEFT JOIN devices d ON mp.device_id = d.id`;
  let params = [];

  if (req.query.status) {
    sql += ' WHERE mp.status = ?';
    params.push(req.query.status);
  }

  sql += ' ORDER BY mp.id DESC';

  const plans = await all(sql, params);
  return res.json({ success: true, data: plans });
});

// PUT /api/maintenance/plans/:id — 编辑维护计划
router.put('/plans/:id', authMiddleware, requireAdmin, async (req, res) => {
  const plan = await get('SELECT * FROM maintenance_plans WHERE id = ?', [req.params.id]);
  if (!plan) {
    return res.json({ success: false, message: '维护计划不存在' });
  }

  const { plan_name, frequency_days, description, status } = req.body;

  // 如果修改了 frequency_days，重新计算 next_maintain_at
  let nextMaintainAt = plan.next_maintain_at;
  if (frequency_days && parseInt(frequency_days) !== plan.frequency_days && plan.last_maintained_at) {
    const lastDate = new Date(plan.last_maintained_at.replace(' ', 'T') + 'Z');
    lastDate.setDate(lastDate.getDate() + parseInt(frequency_days));
    nextMaintainAt = lastDate.toISOString().replace('T', ' ').substring(0, 19);
  }

  await run(
    'UPDATE maintenance_plans SET plan_name = ?, frequency_days = ?, description = ?, status = ?, next_maintain_at = ? WHERE id = ?',
    [
      plan_name || plan.plan_name,
      frequency_days ? parseInt(frequency_days) : plan.frequency_days,
      description !== undefined ? description : plan.description,
      status || plan.status,
      nextMaintainAt,
      req.params.id
    ]
  );

  return res.json({ success: true, message: '更新成功' });
});

// DELETE /api/maintenance/plans/:id — 删除维护计划
router.delete('/plans/:id', authMiddleware, requireAdmin, async (req, res) => {
  const plan = await get('SELECT id FROM maintenance_plans WHERE id = ?', [req.params.id]);
  if (!plan) {
    return res.json({ success: false, message: '维护计划不存在' });
  }
  await run('DELETE FROM maintenance_plans WHERE id = ?', [req.params.id]);
  return res.json({ success: true, message: '已删除' });
});

// POST /api/maintenance/logs — 记录维护日志
router.post('/logs', authMiddleware, requireAdmin, async (req, res) => {
  const { plan_id, device_id, result } = req.body;
  if (!device_id) {
    return res.json({ success: false, message: '设备ID不能为空' });
  }

  const now = getNow();
  await run(
    'INSERT INTO maintenance_logs (plan_id, device_id, handler_id, result, created_at) VALUES (?, ?, ?, ?, ?)',
    [plan_id || null, device_id, req.user.id, result || '', now]
  );

  // 更新维护计划
  if (plan_id) {
    const plan = await get('SELECT * FROM maintenance_plans WHERE id = ?', [plan_id]);
    if (plan) {
      const lastDate = new Date(now.replace(' ', 'T') + 'Z');
      lastDate.setDate(lastDate.getDate() + plan.frequency_days);
      const nextMaintainAt = lastDate.toISOString().replace('T', ' ').substring(0, 19);
      await run(
        'UPDATE maintenance_plans SET last_maintained_at = ?, next_maintain_at = ? WHERE id = ?',
        [now, nextMaintainAt, plan_id]
      );
    }
  }

  return res.json({ success: true, message: '维护日志已记录' });
});

// GET /api/maintenance/logs — 查看维护日志
router.get('/logs', authMiddleware, requireAdmin, async (req, res) => {
  let sql = `SELECT ml.*, d.name AS device_name, u.name AS handler_name
             FROM maintenance_logs ml
             LEFT JOIN devices d ON ml.device_id = d.id
             LEFT JOIN users u ON ml.handler_id = u.id`;
  let params = [];

  if (req.query.device_id) {
    sql += ' WHERE ml.device_id = ?';
    params.push(req.query.device_id);
  }

  sql += ' ORDER BY ml.id DESC LIMIT 100';

  const logs = await all(sql, params);
  return res.json({ success: true, data: logs });
});

module.exports = router;
