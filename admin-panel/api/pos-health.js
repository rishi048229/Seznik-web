import { getSessionUser } from '../lib/adminAuth.js';

export default async function handler(req, res) {
  if (!getSessionUser(req)) {
    res.statusCode = 401;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      status: 'unhealthy',
      error: 'Unauthorized',
      database: { status: 'disconnected', error: 'Sign in required' },
    }));
    return;
  }

  const base = (process.env.POS_API_URL || process.env.VITE_API_URL || '').replace(/\/$/, '');
  if (!base) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      status: 'unhealthy',
      error: 'POS_API_URL is not set on Vercel',
      database: { status: 'disconnected', error: 'POS backend URL missing' },
    }));
    return;
  }

  const url = `${base.endsWith('/api') ? base : `${base}/api`}/health`;
  const start = Date.now();

  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
    const data = await response.json().catch(() => ({}));
    res.statusCode = response.ok ? 200 : 502;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      ...data,
      status: data.status || (response.ok ? 'healthy' : 'unhealthy'),
      timestamp: data.timestamp || new Date().toISOString(),
      serverLatencyMs: Date.now() - start,
    }));
  } catch (err) {
    res.statusCode = 502;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      serverLatencyMs: Date.now() - start,
      error: err instanceof Error ? err.message : 'POS backend unreachable',
      database: { status: 'disconnected', error: 'Could not reach POS server' },
    }));
  }
}
