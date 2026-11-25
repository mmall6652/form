// Server verify local: serve public/ + route /api/* tới handlers thật.
// Upstash được mock tại boundary (upstashFetch) — không cần credential.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { handleSubmit } from '../api/_store.js';
import { handleStatus } from '../api/status.js';
import { handleHistory } from '../api/history.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT ?? 3100);
const ADMIN_TOKEN = process.env.ADMIN_TOKEN ?? 'test-admin-token';
process.env.ADMIN_TOKEN = ADMIN_TOKEN;

const hash = new Map(); // mô phỏng Redis hash
const lists = new Map(); // mô phỏng Redis list (lịch sử)
const mockFetch = async (cmd) => {
  const [op, key, field, value] = cmd;
  if (op === 'HGET') return hash.has(field) ? hash.get(field) : null;
  if (op === 'HSETNX') {
    if (hash.has(field)) return 0;
    hash.set(field, value);
    return 1;
  }
  if (op === 'HSET') {
    hash.set(field, value);
    return 1;
  }
  if (op === 'LPUSH') {
    const list = lists.get(key) ?? [];
    list.unshift(field);
    lists.set(key, list);
    return list.length;
  }
  if (op === 'KEYS') return [...lists.keys()].filter((k) => k.includes(':history:'));
  if (op === 'LRANGE') return lists.get(key)?.slice(Number(field), Number(value) === -1 ? undefined : Number(value) + 1) ?? [];
  if (op === 'HGETALL') {
    const out = [];
    for (const [k, v] of hash) out.push(k, v);
    return out;
  }
  if (op === 'HDEL') { return hash.delete(field) ? 1 : 0; }
  throw new Error(`mock unsupported: ${op}`);
};

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml' };

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  if (url.pathname === '/__reset' && req.method === 'POST') {
    hash.clear();
    lists.clear();
    res.statusCode = 200; return res.end(JSON.stringify({ ok: true }));
  }
  if (url.pathname === '/api/submit') {
    return handleSubmit(req, res, { upstashFetch: mockFetch });
  }
  if (url.pathname === '/api/status') {
    return handleStatus(req, res, { upstashFetch: mockFetch });
  }
  if (url.pathname === '/api/history') {
    return handleHistory(req, res, { upstashFetch: mockFetch });
  }
  // static
  const rel = url.pathname === '/' ? '/index.html' : url.pathname;
  const file = path.join(ROOT, 'public', path.normalize(rel).replace(/^(\.\.(\/|\\|$))+/, ''));
  if (!file.startsWith(path.join(ROOT, 'public'))) {
    res.statusCode = 403; return res.end('forbidden');
  }
  fs.readFile(file, (err, buf) => {
    if (err) { res.statusCode = 404; return res.end('not found'); }
    res.setHeader('Content-Type', MIME[path.extname(file)] ?? 'application/octet-stream');
    res.end(buf);
  });
});

server.listen(PORT, () => console.log(`verify server on http://localhost:${PORT} (admin token: ${ADMIN_TOKEN})`));
