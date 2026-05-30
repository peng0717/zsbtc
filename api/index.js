const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const app = express();
app.use(cors());
app.use(express.json());
app.get('/api/health', (req, res) => {
  const token = jwt.sign({ test: 1 }, 'test', { expiresIn: '1h' });
  res.json({ success: true, message: 'OK cors+jwt', token_preview: token.slice(0, 20) });
});
module.exports = app;