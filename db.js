// ========== Turso 数据库连接（libSQL 客户端）==========
const { createClient } = require('@libsql/client');

const TURSO_URL = (process.env.TURSO_URL || '').replace(/^\uFEFF/, '');
const TURSO_TOKEN = (process.env.TURSO_TOKEN || '').replace(/^\uFEFF/, '');

let client = null;
let clientError = null;
let initAttempted = false;

function getClient() {
  if (initAttempted) {
    if (clientError) throw clientError;
    return client;
  }
  initAttempted = true;

  if (!TURSO_URL) {
    clientError = new Error('TURSO_URL 环境变量未配置');
    throw clientError;
  }
  if (!TURSO_TOKEN) {
    clientError = new Error('TURSO_TOKEN 环境变量未配置');
    throw clientError;
  }
  try {
    client = createClient({
      url: TURSO_URL,
      authToken: TURSO_TOKEN
    });
  } catch (e) {
    clientError = new Error(`Turso 客户端初始化失败: ${e.message}`);
    throw clientError;
  }
  return client;
}

async function tursoFetch(sql, params = []) {
  const c = getClient();
  const rs = await c.execute({ sql, args: params });
  return {
    rows: rs.rows.map(row => {
      const obj = {};
      for (const key of Object.keys(row)) {
        obj[key] = row[key];
      }
      return obj;
    }),
    rowsAffected: rs.rowsAffected || rs.rows.length,
    lastInsertRowid: rs.lastInsertRowid ? String(rs.lastInsertRowid) : null
  };
}

async function run(sql, params = []) {
  return await tursoFetch(sql, params);
}

async function get(sql, params = []) {
  const result = await tursoFetch(sql, params);
  return result.rows[0] || null;
}

async function all(sql, params = []) {
  const result = await tursoFetch(sql, params);
  return result.rows;
}

function getNow() {
  const now = new Date();
  const beijing = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  return beijing.toISOString().replace('T', ' ').substring(0, 19);
}

async function auditLog({ userId, username, action, targetType, targetId, detail }) {
  const now = getNow();
  await run(
    'INSERT INTO audit_logs (user_id, username, action, target_type, target_id, detail, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [userId || null, username || '', action, targetType || '', targetId || null, detail || '', now]
  );
}

module.exports = { run, get, all, getNow, auditLog };