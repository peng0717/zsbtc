const express = require('express');
const app = express();
app.get('/api/test1', (req, res) => res.json({ ok: 1, mods: 'express' }));
module.exports = app;