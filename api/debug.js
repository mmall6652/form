// Chẩn đoán cấu hình — CHỈ trả true/false, KHÔNG trả giá trị biến.
export default function handler(req, res) {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify({
    hasUpstashUrl: Boolean(process.env.UPSTASH_REDIS_REST_URL),
    hasUpstashToken: Boolean(process.env.UPSTASH_REDIS_REST_TOKEN),
    hasAdminToken: Boolean(process.env.ADMIN_TOKEN),
    upstashUrlHost: safeHost(process.env.UPSTASH_REDIS_REST_URL),
  }));
}

function safeHost(value) {
  if (!value) return null;
  try { return new URL(value).host; } catch { return 'invalid-url'; }
}
