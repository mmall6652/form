import { ROSTER, normalizeName } from '../public/roster.js';
import { KEY, upstashFetch } from './_store.js';

export async function handleStatus(req, res, deps = {}) {
  const expected = process.env.ADMIN_TOKEN;
  const supplied = String(req.headers?.authorization ?? '').replace(/^Bearer\s+/i, '');
  if (!expected || supplied !== expected) {
    res.statusCode = 401;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.end(JSON.stringify({ error: 'Không có quyền xem trạng thái' }));
  }

  const call = deps.upstashFetch ?? upstashFetch;
  try {
    const raw = await call(['HGETALL', KEY]);
    const map = new Map();
    if (Array.isArray(raw)) {
      for (let i = 0; i + 1 < raw.length; i += 2) {
        try { map.set(normalizeName(raw[i]).toLowerCase(), JSON.parse(raw[i + 1])); } catch { /* bỏ record hỏng */ }
      }
    }
    const rows = ROSTER.map((name) => {
      const rec = map.get(normalizeName(name).toLowerCase());
      return {
        fullName: name,
        submitted: Boolean(rec),
        aspiration: rec?.aspiration ?? null,
        branch: rec?.branch ?? null,
        otherText: rec?.otherText ?? null,
        submittedAt: rec?.submittedAt ?? null,
      };
    });
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.end(JSON.stringify({ total: rows.length, done: rows.filter((r) => r.submitted).length, rows }));
  } catch (err) {
    console.error('status error:', err.message);
    res.statusCode = 503;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.end(JSON.stringify({ error: 'Dịch vụ lưu trữ tạm thời không sẵn sàng' }));
  }
}
