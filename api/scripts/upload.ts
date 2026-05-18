import type { VercelRequest, VercelResponse } from '@vercel/node';

const WORKER_BASE =
  process.env.TOWN_WORKER_BASE ||
  'https://botc-town.1239372199.workers.dev';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  try {
    const resp = await fetch(`${WORKER_BASE}/scripts/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body ?? {}),
    });
    const text = await resp.text();
    res.status(resp.status).setHeader('Content-Type', 'application/json').send(text);
  } catch (e: any) {
    res
      .status(502)
      .json({ ok: false, error: `上游服务不可用: ${e?.message || 'unknown error'}` });
  }
}

