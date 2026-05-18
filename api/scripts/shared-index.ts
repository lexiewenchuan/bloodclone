import type { VercelRequest, VercelResponse } from '@vercel/node';

const WORKER_BASE =
  process.env.TOWN_WORKER_BASE ||
  'https://botc-town.1239372199.workers.dev';

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  try {
    const resp = await fetch(`${WORKER_BASE}/scripts/shared-index`);
    const text = await resp.text();
    res.status(resp.status).setHeader('Content-Type', 'application/json').send(text);
  } catch (e: any) {
    res
      .status(502)
      .json({ ok: false, error: `上游服务不可用: ${e?.message || 'unknown error'}` });
  }
}

