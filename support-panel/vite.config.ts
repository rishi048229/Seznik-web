import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import pg from 'pg';
import { pgConnectionString, pgSslConfig } from './lib/pgSsl.js';
import {
  authenticateSupportAgent,
  getSupportAgentById,
} from './lib/supportAgents.js';
import {
  createSupportSessionToken,
  getSupportSession,
  supportSessionCookieHeader,
  clearSupportSessionCookieHeader,
  isSecureRequest,
} from './lib/supportAuth.js';
import {
  issueCustomerAccessCode,
  listAccessCodes,
  lookupAccessCode,
} from './lib/accessCodes.js';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  for (const key of ['ADMIN_SESSION_SECRET', 'SUPPORT_SESSION_SECRET', 'DATABASE_URL'] as const) {
    if (env[key] && !process.env[key]) process.env[key] = env[key];
  }

  const dbUrl =
    env.DATABASE_URL ||
    process.env.DATABASE_URL ||
    '';

  const pool = dbUrl
    ? new pg.Pool({
        connectionString: pgConnectionString(dbUrl),
        ssl: pgSslConfig(dbUrl),
        max: 1,
        idleTimeoutMillis: 5000,
        connectionTimeoutMillis: 30000,
        allowExitOnIdle: true,
        keepAlive: true,
        keepAliveInitialDelayMillis: 10000,
      })
    : null;

  if (pool) {
    pool.on('error', (err) => {
      console.error('Support DB pool error:', err?.message || err);
    });
  }

  return {
    server: {
      port: 5174,
    },
    plugins: [
      react(),
      {
        name: 'support-dev-api-middleware',
        configureServer(server) {
          server.middlewares.use(async (req, res, next) => {
            const parsedUrl = new URL(req.url || '/', 'http://localhost');
            const pathname = parsedUrl.pathname;

            const send = (status: number, body: unknown) => {
              res.statusCode = status;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify(body));
            };

            const readBody = () =>
              new Promise<Record<string, unknown>>((resolve, reject) => {
                let body = '';
                req.on('data', (chunk) => {
                  body += chunk;
                });
                req.on('end', () => {
                  try {
                    resolve(body ? JSON.parse(body) : {});
                  } catch (err) {
                    reject(err);
                  }
                });
              });

            if (!pathname.startsWith('/api/support')) {
              next();
              return;
            }

            if (!pool) {
              send(500, { error: 'DATABASE_URL is not set' });
              return;
            }

            const requireAgent = async () => {
              const session = getSupportSession(req);
              if (!session) {
                send(401, { error: 'Unauthorized' });
                return null;
              }
              const agent = await getSupportAgentById(pool, session.agentId);
              if (!agent) {
                send(401, { error: 'Unauthorized' });
                return null;
              }
              if (agent.isDisabled) {
                res.setHeader('Set-Cookie', clearSupportSessionCookieHeader(isSecureRequest(req)));
                send(403, { error: 'Access disabled. Contact an administrator.' });
                return null;
              }
              return agent;
            };

            try {
              if (pathname === '/api/support/login' && req.method === 'POST') {
                const payload = await readBody();
                const agent = await authenticateSupportAgent(
                  pool,
                  String(payload.username || ''),
                  String(payload.password || '')
                );
                const token = createSupportSessionToken(agent.id);
                res.setHeader('Set-Cookie', supportSessionCookieHeader(token, isSecureRequest(req)));
                send(200, { success: true, agent });
                return;
              }

              if (pathname === '/api/support/logout' && req.method === 'POST') {
                res.setHeader('Set-Cookie', clearSupportSessionCookieHeader(isSecureRequest(req)));
                send(200, { success: true });
                return;
              }

              if (pathname === '/api/support/me' && req.method === 'GET') {
                const agent = await requireAgent();
                if (!agent) return;
                send(200, { agent });
                return;
              }

              if (pathname === '/api/support/access-codes/issue' && req.method === 'POST') {
                const agent = await requireAgent();
                if (!agent) return;
                const payload = await readBody();
                const record = await (async () => {
                  let lastErr: unknown;
                  for (let attempt = 0; attempt <= 2; attempt++) {
                    try {
                      return await issueCustomerAccessCode(pool, {
                        ...payload,
                        createdBy: agent.username,
                      });
                    } catch (err) {
                      lastErr = err;
                      const message = String((err as Error)?.message || err || '').toLowerCase();
                      const transient =
                        message.includes('connection terminated') ||
                        message.includes('connection timeout') ||
                        message.includes('econnreset') ||
                        message.includes('econnrefused');
                      if (!transient || attempt === 2) throw err;
                      console.warn(`Support DB transient error (attempt ${attempt + 1}/3):`, (err as Error)?.message || err);
                      await new Promise((r) => setTimeout(r, 250 * (attempt + 1)));
                    }
                  }
                  throw lastErr;
                })();
                send(200, { success: true, record });
                return;
              }

              if ((pathname === '/api/support/access-codes/search' || pathname === '/api/support/access-codes/lookup') && req.method === 'GET') {
                const agent = await requireAgent();
                if (!agent) return;
                const code = parsedUrl.searchParams.get('code') || parsedUrl.searchParams.get('q') || '';
                const result = await lookupAccessCode(pool, code);
                send(200, result);
                return;
              }

              if (pathname === '/api/support/access-codes' && req.method === 'GET') {
                const agent = await requireAgent();
                if (!agent) return;
                const result = await listAccessCodes(pool, {
                  page: parsedUrl.searchParams.get('page') || undefined,
                  limit: parsedUrl.searchParams.get('limit') || undefined,
                  search: parsedUrl.searchParams.get('search') || undefined,
                  createdBy: agent.username,
                  customerOnly: true,
                });
                send(200, result);
                return;
              }

              send(404, { error: `Unknown support route: ${req.method} ${pathname}` });
            } catch (err: any) {
              console.error('Support API error:', err?.message || err);
              send(err?.statusCode || 500, { error: err?.message || 'Request failed' });
            }
          });
        },
      },
    ],
  };
});
