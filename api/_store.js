// Dùng chung bởi api/submit.js và api/status.js.
import { ROSTER, BRANCHES, normalizeName, canonicalName } from '../public/roster.js';

const URL = process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
export const KEY = 'ksat:v1:responses';
export const HISTORY_KEY = 'ksat:v1:history';

/**
 * Boundary duy nhất gọi Upstash REST. Có thể patch trong test để mock
 * mà không cần credential thật (xem tests/verify.mjs).
 */
export async function upstashFetch(command) {
  if (!URL || !TOKEN) {
    const missing = [!URL && 'UPSTASH_REDIS_REST_URL', !TOKEN && 'UPSTASH_REDIS_REST_TOKEN']
      .filter(Boolean).join(', ');
    throw new Error(`Thiếu biến môi trường: ${missing}`);
  }
  const res = await fetch(URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(command),
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { throw new Error(`Upstash trả response không phải JSON: ${text.slice(0, 120)}`); }
  if (!res.ok || json.error) throw new Error(json.error ?? `Upstash HTTP ${res.status}`);
  return json.result;
}

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

export function validateSubmission(input) {
  const name = canonicalName(input?.fullName);
  if (!name) return { error: 'Vui lòng chọn họ tên đúng trong danh sách.' };
  const aspiration = Number(input?.aspiration);
  if (![1, 2, 3, 4, 5].includes(aspiration)) return { error: 'Nguyện vọng không hợp lệ.' };
  let branch = null;
  let otherText = null;
  if (aspiration === 2 || aspiration === 3) {
    branch = input?.branch ?? null;
    if (!BRANCHES.includes(branch)) return { error: 'Vui lòng chọn một bưu cục.' };
  }
  if (aspiration === 5) {
    otherText = String(input?.otherText ?? '').trim();
    if (!otherText || otherText.length > 1000) return { error: 'Vui lòng ghi rõ nguyện vọng (tối đa 1000 ký tự).' };
  }
  return {
    value: {
      fullName: name,
      aspiration,
      branch,
      otherText,
      submittedAt: new Date().toISOString(),
    },
  };
}

/** Shared handler cho phép test gọi trực tiếp với mock boundary. */
export async function handleSubmit(req, res, deps = {}) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Chỉ hỗ trợ POST' });

  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 16384) return json(res, 413, { error: 'Payload quá lớn' });
  }
  let input;
  try { input = JSON.parse(raw || '{}'); } catch { return json(res, 400, { error: 'JSON không hợp lệ' }); }

  const checked = validateSubmission(input);
  if (checked.error) return json(res, 400, { error: checked.error });
  const record = checked.value;
  const field = normalizeName(record.fullName);

  const call = deps.upstashFetch ?? upstashFetch;
  try {
    // Cho phép gửi lại nhiều lần: ghi đè kết quả mới, nhưng lưu bản cũ vào
    // danh sách lịch sử riêng (không xóa dữ liệu cũ).
    const existingRaw = await call(['HGET', KEY, field]);
    if (existingRaw) {
      await call(['LPUSH', `${HISTORY_KEY}:${field}`, existingRaw]);
    }
    await call(['HSET', KEY, field, JSON.stringify(record)]);
    return json(res, 200, {
      ok: true,
      updated: Boolean(existingRaw),
      fullName: record.fullName,
    });
  } catch (err) {
    console.error('submit error:', err.message);
    return json(res, 503, { error: 'Dịch vụ lưu trữ tạm thời không sẵn sàng' });
  }
}
