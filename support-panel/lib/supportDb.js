import pg from 'pg';
import { pgConnectionString, pgSslConfig } from './pgSsl.js';

let pool;

function isTransientDbError(err) {
  const message = String(err?.message || err || '').toLowerCase();
  return (
    message.includes('connection terminated') ||
    message.includes('connection timeout') ||
    message.includes('timeout expired') ||
    message.includes('econnreset') ||
    message.includes('econnrefused') ||
    message.includes('not queryable') ||
    message.includes('client has encountered a connection error') ||
    err?.code === 'ETIMEDOUT' ||
    err?.code === 'ECONNRESET' ||
    err?.code === '57P01' || // admin_shutdown
    err?.code === '57P03' // cannot_connect_now
  );
}

async function resetPool() {
  const old = pool;
  pool = null;
  if (!old) return;
  try {
    await old.end();
  } catch {
    // ignore — connection may already be dead
  }
}

function createPool(dbUrl) {
  const next = new pg.Pool({
    connectionString: pgConnectionString(dbUrl),
    ssl: pgSslConfig(dbUrl),
    // Serverless: keep the pool tiny and recycle idle clients quickly.
    max: 1,
    idleTimeoutMillis: 5000,
    connectionTimeoutMillis: 30000,
    allowExitOnIdle: true,
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000,
  });

  next.on('error', (err) => {
    console.error('Support DB pool error:', err?.message || err);
    if (pool === next) pool = null;
  });

  return next;
}

export function getPool() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    throw new Error('DATABASE_URL is not set');
  }

  if (!pool) {
    pool = createPool(dbUrl);
  }

  return pool;
}

/** Run a DB operation; on transient connection errors, rebuild the pool and retry. */
export async function withDbRetry(fn, { retries = 2 } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn(getPool());
    } catch (err) {
      lastErr = err;
      if (!isTransientDbError(err) || attempt === retries) throw err;
      console.warn(
        `Support DB transient error (attempt ${attempt + 1}/${retries + 1}):`,
        err?.message || err
      );
      await resetPool();
      await new Promise((r) => setTimeout(r, 250 * (attempt + 1)));
    }
  }
  throw lastErr;
}

export function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

export async function readJsonBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString();
  return raw ? JSON.parse(raw) : {};
}
