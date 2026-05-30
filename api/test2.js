// 逐步排查：仅加载核心依赖
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const app = express();
app.get('/api/test2', (req, res) => {
  res.json({ ok: true, modules: ['express','cors','jwt','bcryptjs','multer','fs','path'] });
});
module.exports = app;