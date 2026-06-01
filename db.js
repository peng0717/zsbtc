// ========== Turso HTTP REST API ==========
const TURSO_URL = (process.env.TURSO_URL || 'libsql://sbjies-peng0717.aws-ap-northeast-1.turso.io').replace(/^\uFEFF/, '');
const TURSO_TOKEN = (process.env.TURSO_TOKEN || '').replace(/^\uFEFF/, '');
const TURSO_HTTP = TURSO_URL.replace('libsql://', 'https://');

async function tursoFetch(sql, params = []) {
  if (!TURSO_TOKEN) throw new Error('TURSO_TOKEN not configured');
  const body = {
    requests: [
      { type: 'execute', stmt: { sql, args: params.map(v => {
        if (typeof v === 'number') {
          if (Number.isInteger(v)) return { type: 'integer', value: String(v) };
          return { type: 'float', value: v };
        }
        if (v === null || v === undefined) return { type: 'null' };
        return { type: 'text', value: String(v) };
      }) } },
      { type: 'close' }
    ]
  };
  const res = await fetch(`${TURSO_HTTP}/v2/pipeline`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${TURSO_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  const result = data.results[0];
  if (result.type === 'error') throw new Error(result.error.message);
  const r = result.response.result;
  return {
    rows: (r.rows || []).map(row => {
      const obj = {};
      (r.cols || r.columns || []).forEach((col, i) => {
        obj[col.name || col] = row[i]?.value ?? null;
      });
      return obj;
    }),
    rowsAffected: r.rows_read || 0,
    lastInsertRowid: r.last_insert_rowid ? String(r.last_insert_rowid) : null
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

module.exports = { run, get, all, getNow };