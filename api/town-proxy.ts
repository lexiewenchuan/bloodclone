import type { VercelRequest, VercelResponse } from '@vercel/node';

const WORKER_BASE =
  process.env.TOWN_WORKER_BASE ||
  'https://botc-town.1239372199.workers.dev';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 由 vercel.json 重写 /api/town/:path -> /api/town-proxy，path 会出现在 query
  const path = req.query.path;
  const suffix = Array.isArray(path) ? path.join('/') : String(path ?? '').trim();
  // 把原始请求的 query（townId、userId、hostToken 等）原样转发给 Worker，否则 GET /town/me 等会 400
  const restQuery = { ...req.query };
  delete restQuery.path;
  const queryString = new URLSearchParams();
  for (const [k, v] of Object.entries(restQuery)) {
    if (v === undefined) continue;
    queryString.set(k, Array.isArray(v) ? v[0] : String(v));
  }
  const qs = queryString.toString();
  const targetUrl = `${WORKER_BASE}/town/${suffix}${qs ? `?${qs}` : ''}`;

  const init: RequestInit = {
    method: req.method,
    headers: { 'Content-Type': 'application/json' },
  };

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    init.body = JSON.stringify(req.body ?? {});
  }

  try {
    const resp = await fetch(targetUrl, init);
    const text = await resp.text();
    res.status(resp.status).setHeader('Content-Type', 'application/json').send(text);
  } catch (e: any) {
    res
      .status(502)
      .json({ error: `上游服务不可用: ${e?.message || 'unknown error'}` });
  }
}
