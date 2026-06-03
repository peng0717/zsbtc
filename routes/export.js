const express = require('express');
const router = express.Router();
const { all, getNow } = require('../db');
const { authMiddleware, requireAdmin } = require('../app-middleware');

function csvEscape(val) {
  if (val == null) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

function toCSV(headers, rows) {
  const bom = '\uFEFF'; // UTF-8 BOM，防止 Excel 乱码
  const headerLine = headers.map(csvEscape).join(',');
  const dataLines = rows.map(row => headers.map(h => csvEscape(row[h] ?? '')).join(','));
  return bom + [headerLine, ...dataLines].join('\n');
}

// GET /api/export/devices
router.get('/export/devices', authMiddleware, requireAdmin, async (req, res) => {
  const devices = await all('SELECT * FROM devices ORDER BY id');
  const headers = ['ID', '名称', '型号', '分类', '总数', '可借数', '状态', '二维码', '创建时间'];
  const rows = devices.map(d => ({
    ID: d.id,
    '名称': d.name,
    '型号': d.model || '',
    '分类': d.category || '',
    '总数': d.total,
    '可借数': d.available,
    '状态': d.status,
    '二维码': d.qr_code || '',
    '创建时间': d.created_at
  }));
  const csv = toCSV(headers, rows);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename=devices.csv');
  return res.send(csv);
});

// GET /api/export/borrows
router.get('/export/borrows', authMiddleware, requireAdmin, async (req, res) => {
  let sql = `SELECT br.*, u.name AS user_name FROM borrow_records br LEFT JOIN users u ON br.user_id = u.id`;
  let params = [];

  if (req.query.status) {
    sql += ' WHERE br.status = ?';
    params.push(req.query.status);
  }

  sql += ' ORDER BY br.id DESC';

  const records = await all(sql, params);
  const headers = ['ID', '用户学号', '设备名', '借用时间', '归还时间', '状态'];
  const rows = records.map(r => ({
    ID: r.id,
    '用户学号': r.username || '',
    '设备名': r.device_name || '',
    '借用时间': r.borrow_date || '',
    '归还时间': r.actual_return || '',
    '状态': r.status
  }));
  const csv = toCSV(headers, rows);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename=borrows.csv');
  return res.send(csv);
});

// GET /api/export/repairs
router.get('/export/repairs', authMiddleware, requireAdmin, async (req, res) => {
  const records = await all(
    `SELECT rr.*, d.name AS device_name, u.name AS user_name
     FROM repair_reports rr
     LEFT JOIN devices d ON rr.device_id = d.id
     LEFT JOIN users u ON rr.user_id = u.id
     ORDER BY rr.id DESC`
  );
  const headers = ['ID', '设备名', '报修人', '故障类型', '描述', '状态', '处理备注', '时间'];
  const rows = records.map(r => ({
    ID: r.id,
    '设备名': r.device_name || '',
    '报修人': r.user_name || '',
    '故障类型': r.issue_type || '',
    '描述': r.description || '',
    '状态': r.status,
    '处理备注': r.handle_remark || '',
    '时间': r.created_at || ''
  }));
  const csv = toCSV(headers, rows);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename=repairs.csv');
  return res.send(csv);
});

module.exports = router;
