// 排查用：最小 Express 应用
const express = require('express');
const app = express();

app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'OK min' });
});

module.exports = app;