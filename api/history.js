import { HISTORY_KEY, upstashFetch } from './_store.js';
import { normalizeName } from '../public/roster.js';

export async function handleHistory(req, res, deps = {}) {
  const expected = process.env.ADMIN_TOKEN;
  const supplied = String(req.headers?.authorization ?? '').replace(/^Bearer\s+/i, '');
  if (!expected || supplied !== expected) {
    res.statusCode = 401;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.end(JSON.stringify({ error: 'Không có quyền xem lịch sử' }));
  }
  const call = deps.upstashFetch ?? upstashFetch;
  try {
    const raw = await call(['KEYS', `${HISTORY_KEY}:*`]);
    const keys = Array.isArray(raw) ? raw : [];
    const result = {};
    const prefix = `${HISTORY_KEY}:`;
    for (const key of keys) {
      const entries = await call(['LRANGE', key, 0, -1]);
      const name = key.startsWith(prefix) ? key.slice(prefix.length) : key;
      result[normalizeName(name)] = (Array.isArray(entries) ? entries : []).map((v) => {
        try { return JSON.parse(v); } catch { return { raw: v }; }
      });
    }
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.end(JSON.stringify(result));
  } catch (err) {
    console.error('history error:', err.message);
    res.statusCode = 503;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.end(JSON.stringify({ error: 'Dịch vụ lưu trữ tạm thời không sẵn sàng' }));
  }
}

export default function handler(req, res) {
  return handleHistory(req, res);
}
