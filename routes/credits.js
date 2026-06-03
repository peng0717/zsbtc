const express = require('express');
const router = express.Router();
const { get, all, run, getNow } = require('../db');
const { authMiddleware, requireAdmin } = require('../app-middleware');

// GET /api/credits/mine — 查看自己的信用分和记录
router.get('/mine', authMiddleware, async (req, res) => {
  const user = await get('SELECT credit_score FROM users WHERE id = ?', [req.user.id]);
  const records = await all(
    'SELECT * FROM credit_records WHERE user_id = ? ORDER BY id DESC LIMIT 50',
    [req.user.id]
  );
  return res.json({
    success: true,
    data: {
      score: (user && user.credit_score != null) ? user.credit_score : 100,
      records
    }
  });
});

// GET /api/credits/:userId — 管理员查看某用户信用记录
router.get('/:userId', authMiddleware, requireAdmin, async (req, res) => {
  const user = await get(
    'SELECT id, username, name, credit_score FROM users WHERE id = ?',
    [req.params.userId]
  );
  if (!user) {
    return res.json({ success: false, message: '用户不存在' });
  }
  const records = await all(
    'SELECT * FROM credit_records WHERE user_id = ? ORDER BY id DESC LIMIT 100',
    [req.params.userId]
  );
  return res.json({
    success: true,
    data: {
      user: { id: user.id, username: user.username, name: user.name, credit_score: user.credit_score != null ? user.credit_score : 100 },
      records
    }
  });
});

// POST /api/credits/manual — 管理员手动加减分
router.post('/manual', authMiddleware, requireAdmin, async (req, res) => {
  const { user_id, change_amount, reason } = req.body;
  if (!user_id || !change_amount || !reason) {
    return res.json({ success: false, message: '用户ID、变动分数和原因不能为空' });
  }

  const amount = parseInt(change_amount);
  if (isNaN(amount) || amount === 0) {
    return res.json({ success: false, message: '变动分数必须为非零整数' });
  }

  const user = await get('SELECT id FROM users WHERE id = ?', [user_id]);
  if (!user) {
    return res.json({ success: false, message: '用户不存在' });
  }

  const now = getNow();
  await run(
    'INSERT INTO credit_records (user_id, change_amount, reason, created_at) VALUES (?, ?, ?, ?)',
    [user_id, amount, reason, now]
  );
  await run('UPDATE users SET credit_score = credit_score + ? WHERE id = ?', [amount, user_id]);

  return res.json({ success: true, message: '操作成功' });
});

module.exports = router;
