import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import pg from 'pg';
import { statSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import {
  getTimeIntervals,
  computeRealTopFeatures,
  buildMetricsResponse,
  mapUserRows,
  getUsersWhereClause,
  applyTableAlias,
  metricsSalesQuery,
} from './analyticsShared.js';
import {
  credentialsMatch,
  createSessionToken,
  getSessionUser,
  getAdminUserId,
  isSecureRequest,
  sessionCookieHeader,
  clearSessionCookieHeader,
} from './lib/adminAuth.js';
import { pgConnectionString, pgSslConfig } from './lib/pgSsl.js';

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  for (const key of ['ADMIN_USER_ID', 'ADMIN_PASSWORD', 'ADMIN_SESSION_SECRET', 'DATABASE_URL'] as const) {
    if (env[key] && !process.env[key]) process.env[key] = env[key];
  }
  const dbUrl =
    env.DATABASE_URL ||
    process.env.DATABASE_URL ||
    'postgresql://postgres:SeznikPass2026!@seznik-pos-db-dev.cgt6m60qe16b.us-east-1.rds.amazonaws.com:5432/postgres?schema=public';

  const pool = new pg.Pool({
    connectionString: pgConnectionString(dbUrl),
    ssl: pgSslConfig(dbUrl),
    connectionTimeoutMillis: 10000,
  });

  return {
    plugins: [
      react(),
      {
        name: 'admin-dev-api-middleware',
        configureServer(server) {
          server.middlewares.use(async (req, res, next) => {
            const parsedUrl = new URL(req.url || '/', 'http://localhost');
            const pathname = parsedUrl.pathname;
            const timeRange = parsedUrl.searchParams.get('timeRange') || 'all';
            const intervals = getTimeIntervals(timeRange);
            const send = (status: number, body: unknown) => {
              res.statusCode = status;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify(body));
            };
            const readBody = () => new Promise<Record<string, unknown>>((resolve, reject) => {
              let body = '';
              req.on('data', (chunk) => { body += chunk; });
              req.on('end', () => {
                try { resolve(body ? JSON.parse(body) : {}); }
                catch (err) { reject(err); }
              });
            });

            if (pathname === '/api/admin/login' && req.method === 'POST') {
              try {
                const payload = await readBody();
                const userId = String(payload.userId || '').trim();
                const password = String(payload.password || '');
                if (!credentialsMatch(userId, password)) {
                  send(401, { error: 'Invalid user ID or password' });
                  return;
                }
                const token = createSessionToken(getAdminUserId());
                res.setHeader('Set-Cookie', sessionCookieHeader(token, isSecureRequest(req)));
                send(200, { success: true, userId: getAdminUserId() });
              } catch {
                send(400, { error: 'Invalid login payload' });
              }
              return;
            }

            if (pathname === '/api/admin/logout' && req.method === 'POST') {
              res.setHeader('Set-Cookie', clearSessionCookieHeader(isSecureRequest(req)));
              send(200, { success: true });
              return;
            }

            if (pathname === '/api/admin/me' && req.method === 'GET') {
              const session = getSessionUser(req);
              if (!session) {
                send(401, { error: 'Unauthorized' });
                return;
              }
              send(200, { userId: session.userId });
              return;
            }

            if (pathname.startsWith('/api/admin') && !getSessionUser(req)) {
              send(401, { error: 'Unauthorized' });
              return;
            }

            // 1. GET /api/admin/users
            if (pathname === '/api/admin/users') {
              try {
                const usersTimeRange = parsedUrl.searchParams.get('timeRange') || 'all';
                const whereClause = getUsersWhereClause(usersTimeRange);
                const result = await pool.query(`
                  SELECT 
                    u.id, 
                    u.uid, 
                    u.email, 
                    u.phone, 
                    u."displayName", 
                    u."businessName", 
                    u.plan, 
                    u.role, 
                    u."emailVerified", 
                    u."onboardingCompleted", 
                    COALESCE(u."isBanned", false) as "isBanned",
                    u."banReason",
                    u."bannedAt",
                    u."createdAt", 
                    u."updatedAt"
                  FROM "User" u
                  ${whereClause}
                  ORDER BY u."createdAt" DESC
                `);

                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify(mapUserRows(result.rows)));
                return;
              } catch (err: any) {
                console.error('DB error on /api/admin/users:', err.message);
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: err.message || 'Failed to fetch users from database' }));
                return;
              }
            }

            // 1b. POST /api/admin/users/:id/ban or POST /api/admin/users/ban
            const banMatch = pathname.match(/^\/api\/admin\/users\/(.+)\/ban$/);
            if ((banMatch || pathname === '/api/admin/users/ban') && req.method === 'POST') {
              let body = '';
              req.on('data', (chunk) => { body += chunk; });
              req.on('end', async () => {
                try {
                  const payload = body ? JSON.parse(body) : {};
                  const targetId = banMatch ? decodeURIComponent(banMatch[1]) : payload.userId;
                  const reason = payload.reason || 'Account suspended by system administrator';

                  if (!targetId) {
                    res.statusCode = 400;
                    res.end(JSON.stringify({ error: 'User ID is required' }));
                    return;
                  }

                  const updateRes = await pool.query(
                    `UPDATE "User" 
                     SET "isBanned" = true, "banReason" = $1, "bannedAt" = CURRENT_TIMESTAMP 
                     WHERE id = $2 OR uid = $2
                     RETURNING id, email, "displayName", "isBanned", "banReason", "bannedAt"`,
                    [reason, targetId]
                  );

                  if (updateRes.rowCount === 0) {
                    res.statusCode = 404;
                    res.end(JSON.stringify({ error: 'User not found' }));
                    return;
                  }

                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({
                    success: true,
                    message: 'User banned successfully',
                    user: updateRes.rows[0],
                  }));
                } catch (err: any) {
                  console.error('DB error on ban user:', err.message);
                  res.statusCode = 500;
                  res.end(JSON.stringify({ error: err.message || 'Failed to ban user' }));
                }
              });
              return;
            }

            // 1c. POST /api/admin/users/:id/unban or POST /api/admin/users/unban
            const unbanMatch = pathname.match(/^\/api\/admin\/users\/(.+)\/unban$/);
            if ((unbanMatch || pathname === '/api/admin/users/unban') && req.method === 'POST') {
              let body = '';
              req.on('data', (chunk) => { body += chunk; });
              req.on('end', async () => {
                try {
                  const payload = body ? JSON.parse(body) : {};
                  const targetId = unbanMatch ? decodeURIComponent(unbanMatch[1]) : payload.userId;

                  if (!targetId) {
                    res.statusCode = 400;
                    res.end(JSON.stringify({ error: 'User ID is required' }));
                    return;
                  }

                  const updateRes = await pool.query(
                    `UPDATE "User" 
                     SET "isBanned" = false, "banReason" = NULL, "bannedAt" = NULL 
                     WHERE id = $1 OR uid = $1
                     RETURNING id, email, "displayName", "isBanned", "banReason", "bannedAt"`,
                    [targetId]
                  );

                  if (updateRes.rowCount === 0) {
                    res.statusCode = 404;
                    res.end(JSON.stringify({ error: 'User not found' }));
                    return;
                  }

                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({
                    success: true,
                    message: 'User unbanned successfully',
                    user: updateRes.rows[0],
                  }));
                } catch (err: any) {
                  console.error('DB error on unban user:', err.message);
                  res.statusCode = 500;
                  res.end(JSON.stringify({ error: err.message || 'Failed to unban user' }));
                }
              });
              return;
            }

            // 2. GET /api/admin/metrics
            if (pathname === '/api/admin/metrics') {
              try {
                const metricsTimeRange = parsedUrl.searchParams.get('timeRange') || 'all';
                const metricsIntervals = getTimeIntervals(metricsTimeRange);
                const userRes = await pool.query(`
                  SELECT 
                    COUNT(*)::int as total_users, 
                    COUNT(*) FILTER (WHERE "emailVerified" = true)::int as verified_count,
                    COUNT(*) FILTER (WHERE ${metricsIntervals.currentFilter})::int as users_in_window,
                    COUNT(*) FILTER (WHERE ${metricsIntervals.prevFilter})::int as users_prev_window
                  FROM "User"
                `);

                const salesRes = await pool.query(metricsSalesQuery(metricsIntervals));
                const productRes = await pool.query('SELECT COUNT(*)::int as count FROM "Product"');
                const topFeatures = await computeRealTopFeatures(pool, metricsTimeRange);

                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify(
                  buildMetricsResponse({
                    userRes,
                    salesRes,
                    productRes,
                    topFeatures,
                    timeRange: metricsTimeRange,
                    intervals: metricsIntervals,
                  })
                ));
                return;
              } catch (err: any) {
                console.error('DB error on /api/admin/metrics:', err.message);
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: err.message || 'Failed to fetch metrics from database' }));
                return;
              }
            }

            // 3. GET /api/admin/sections
            if (pathname === '/api/admin/sections') {
              try {
                const topFeatures = await computeRealTopFeatures(pool, timeRange);
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify(topFeatures));
                return;
              } catch (err: any) {
                console.error('DB error on /api/admin/sections:', err.message);
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: err.message || 'Failed to fetch sections from database' }));
                return;
              }
            }

            // 4. GET /api/admin/heatmap
            if (pathname === '/api/admin/heatmap') {
              try {
                const daysParam = parseInt(parsedUrl.searchParams.get('days') || '', 10);
                const dayCountOverride = Number.isFinite(daysParam) && daysParam > 0 ? daysParam : undefined;
                const analyticsPath = resolve(process.cwd(), 'analyticsShared.js');
                const mtime = statSync(analyticsPath).mtimeMs;
                const analytics = await import(`${pathToFileURL(analyticsPath).href}?mtime=${mtime}`);
                const heatmapData = await analytics.computeRealHeatmapData(pool, timeRange, dayCountOverride);
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify(heatmapData));
                return;
              } catch (err: any) {
                console.error('DB error on /api/admin/heatmap:', err.message);
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: err.message || 'Failed to fetch heatmap from database' }));
                return;
              }
            }

            // 5. GET /api/admin/devices
            if (pathname === '/api/admin/devices') {
              try {
                const salesRes = await pool.query(`
                  SELECT 
                    COUNT(*) FILTER (WHERE (${intervals.currentFilter}) AND platform = 'mobile')::int as mobile_sales_window,
                    COUNT(*) FILTER (WHERE (${intervals.currentFilter}) AND (platform = 'web' OR platform IS NULL))::int as web_sales_window
                  FROM "Sale"
                `);

                const row = salesRes.rows[0] || {};
                const mobileCount = row.mobile_sales_window || 0;
                const webCount = row.web_sales_window || 0;
                const totalInvoices = mobileCount + webCount;

                const desktopPercent = totalInvoices > 0 ? Math.round((webCount / totalInvoices) * 100) : 100;
                const mobilePercent = totalInvoices > 0 ? Math.round((mobileCount / totalInvoices) * 100) : 0;

                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({
                  desktopCount: webCount,
                  desktopPercent,
                  mobileCount,
                  mobilePercent,
                  totalInvoices,
                }));
                return;
              } catch (err: any) {
                console.error('DB error on /api/admin/devices:', err.message);
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: err.message || 'Failed to fetch device breakdown from database' }));
                return;
              }
            }

            // 6. GET /api/admin/invoices
            if (pathname === '/api/admin/invoices') {
              const platform = parsedUrl.searchParams.get('platform') || 'all';
              const limit = Math.min(200, parseInt(parsedUrl.searchParams.get('limit') || '50', 10));

              try {
                let whereConditions: string[] = [];
                if (timeRange !== 'all') {
                  whereConditions.push(`(${applyTableAlias(intervals.currentFilter, 's')})`);
                }
                if (platform === 'mobile') {
                  whereConditions.push(`s.platform = 'mobile'`);
                } else if (platform === 'web') {
                  whereConditions.push(`(s.platform = 'web' OR s.platform IS NULL)`);
                }

                const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
                const query = `
                  SELECT 
                    s.id,
                    s."invoiceNumber",
                    COALESCE(s.platform, 'web') as platform,
                    s."grandTotal",
                    s."subtotal",
                    s."totalTax",
                    s."totalDiscount",
                    s."paymentMethod",
                    s."isQuickBill",
                    s."createdAt",
                    s."userId",
                    u."displayName" as "userName",
                    u.email as "userEmail",
                    c.name as "customerName",
                    c.phone as "customerPhone"
                  FROM "Sale" s
                  LEFT JOIN "User" u ON s."userId" = u.id
                  LEFT JOIN "Customer" c ON s."customerId" = c.id
                  ${whereClause}
                  ORDER BY s."createdAt" DESC
                  LIMIT $1
                `;

                const result = await pool.query(query, [limit]);
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify(result.rows));
                return;
              } catch (err: any) {
                console.error('DB error on /api/admin/invoices:', err.message);
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: err.message || 'Failed to fetch invoices from database' }));
                return;
              }
            }

            // 7. GET /api/admin/health
            if (pathname === '/api/admin/health') {
              try {
                const startTime = Date.now();
                await pool.query('SELECT 1');
                const dbLatencyMs = Date.now() - startTime;

                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({
                  status: 'healthy',
                  timestamp: new Date().toISOString(),
                  uptimeSeconds: Math.floor(process.uptime()),
                  database: {
                    status: 'connected',
                    latencyMs: dbLatencyMs,
                  },
                  environment: process.env.NODE_ENV || 'development',
                  memoryUsageMb: Math.round((process.memoryUsage().rss / 1024 / 1024) * 100) / 100,
                }));
                return;
              } catch (err: any) {
                console.error('DB error on /api/admin/health:', err.message);
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({
                  status: 'unhealthy',
                  timestamp: new Date().toISOString(),
                  database: {
                    status: 'disconnected',
                    error: err.message || 'Database ping failed',
                  },
                }));
                return;
              }
            }

            // 8. GET /api/admin/products
            if (pathname === '/api/admin/products') {
              const limit = Math.min(200, parseInt(parsedUrl.searchParams.get('limit') || '100', 10));
              try {
                const query = `
                  SELECT 
                    p.id,
                    p.name,
                    p.sku,
                    p."sellingPrice",
                    p."createdAt",
                    COALESCE(c.name, 'General') as "categoryName"
                  FROM "Product" p
                  LEFT JOIN "Category" c ON p."categoryId" = c.id
                  ORDER BY p."createdAt" DESC
                  LIMIT $1
                `;
                const result = await pool.query(query, [limit]);
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify(result.rows));
                return;
              } catch (err: any) {
                console.error('DB error on /api/admin/products:', err.message);
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: err.message || 'Failed to fetch products from database' }));
                return;
              }
            }

            // 9. GET /api/admin/feedback
            if (pathname === '/api/admin/feedback') {
              try {
                const analyticsPath = resolve(process.cwd(), 'analyticsShared.js');
                const mtime = statSync(analyticsPath).mtimeMs;
                const analytics = await import(`${pathToFileURL(analyticsPath).href}?mtime=${mtime}`);
                const queryParams = Object.fromEntries(parsedUrl.searchParams.entries());
                const { countSql, dataSql, params, page, limit } = analytics.buildFeedbackQuery(queryParams);
                const countParams = params.slice(0, params.length - 2);
                const [countRes, dataRes] = await Promise.all([
                  pool.query<{ total: number }>(String(countSql), countParams),
                  pool.query(String(dataSql), params),
                ]);
                const total = Number((countRes.rows[0] as { total?: number } | undefined)?.total) || 0;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({
                  items: analytics.mapFeedbackRows(dataRes.rows),
                  page,
                  limit,
                  total,
                  totalPages: Math.max(1, Math.ceil(total / limit)),
                }));
                return;
              } catch (err: any) {
                console.error('DB error on /api/admin/feedback:', err.message);
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: err.message || 'Failed to fetch feedback from database' }));
                return;
              }
            }

            next();
          });
        },
      },
    ],
  };
});
