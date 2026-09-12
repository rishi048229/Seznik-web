import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import pg from 'pg';
import { statSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import {
  getTimeIntervals,
  mapUserRows,
  getUsersWhereClause,
  applyTableAlias,
  computeSectionsSummary,
  ensureSeznikUserColumn,
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
import {
  generateAccessCodes,
  listAccessCodes,
  lookupAccessCode,
  listAccessCodeBatches,
  getAccessCodesByBatch,
  issueCustomerAccessCode,
  listAccessCodeIssuers,
} from './lib/accessCodes.js';
import {
  listSupportAgents,
  createSupportAgent,
  setSupportAgentDisabled,
  revokeSupportAgent,
  resetSupportAgentPassword,
  authenticateSupportAgent,
  getSupportAgentById,
} from './lib/supportAgents.js';
import {
  createSupportSessionToken,
  getSupportSession,
  supportSessionCookieHeader,
  clearSupportSessionCookieHeader,
  isSecureRequest as isSupportSecureRequest,
} from './lib/supportAuth.js';
import {
  getPrinterSummary,
  getPrinterUserLogs,
} from './lib/printers.js';

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
    max: 1,
    idleTimeoutMillis: 5000,
    connectionTimeoutMillis: 30000,
    allowExitOnIdle: true,
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000,
  });
  pool.on('error', (err) => {
    console.error('Admin DB pool error:', err?.message || err);
  });

  const isTransientDbError = (err: unknown) => {
    const message = String((err as Error)?.message || err || '').toLowerCase();
    return (
      message.includes('connection terminated') ||
      message.includes('connection timeout') ||
      message.includes('timeout expired') ||
      message.includes('econnreset') ||
      message.includes('econnrefused') ||
      message.includes('not queryable')
    );
  };

  const withDbRetry = async <T,>(fn: () => Promise<T>, retries = 2): Promise<T> => {
    let lastErr: unknown;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await fn();
      } catch (err) {
        lastErr = err;
        if (!isTransientDbError(err) || attempt === retries) throw err;
        console.warn(`Admin DB transient error (attempt ${attempt + 1}/${retries + 1}):`, (err as Error)?.message || err);
        await new Promise((r) => setTimeout(r, 250 * (attempt + 1)));
      }
    }
    throw lastErr;
  };

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
                await ensureSeznikUserColumn(pool);
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
                    u."businessType",
                    u.plan, 
                    u.role, 
                    u."emailVerified", 
                    u."onboardingCompleted", 
                    COALESCE(u."isBanned", false) as "isBanned",
                    u."banReason",
                    u."bannedAt",
                    COALESCE(u."seznikUser", false) as "seznikUser",
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

            // 1d. POST /api/admin/users/:id/seznik
            const seznikMatch = pathname.match(/^\/api\/admin\/users\/(.+)\/seznik$/);
            if (seznikMatch && req.method === 'POST') {
              try {
                const payload = await readBody();
                const targetId = decodeURIComponent(seznikMatch[1]);
                const seznikUser = Boolean(payload.seznikUser);
                await ensureSeznikUserColumn(pool);
                const updateRes = await pool.query(
                  `UPDATE "User"
                   SET "seznikUser" = $1
                   WHERE id = $2 OR uid = $2
                   RETURNING id, email, "displayName", "seznikUser"`,
                  [seznikUser, targetId]
                );
                if (updateRes.rowCount === 0) {
                  send(404, { error: 'User not found' });
                  return;
                }
                send(200, {
                  success: true,
                  message: seznikUser ? 'Marked as Seznik user' : 'Marked as Non-Seznik user',
                  user: updateRes.rows[0],
                });
              } catch (err: any) {
                console.error('DB error on seznik flag:', err.message);
                send(500, { error: err.message || 'Failed to update Seznik flag' });
              }
              return;
            }

            // 2. GET /api/admin/metrics
            if (pathname === '/api/admin/metrics') {
              try {
                const analyticsPath = resolve(process.cwd(), 'analyticsShared.js');
                const mtime = statSync(analyticsPath).mtimeMs;
                const analytics = await import(`${pathToFileURL(analyticsPath).href}?mtime=${mtime}`);
                const metricsTimeRange = parsedUrl.searchParams.get('timeRange') || 'all';
                const metricsIntervals = analytics.getTimeIntervals(metricsTimeRange);
                const userRes = await pool.query(`
                  SELECT 
                    COUNT(*)::int as total_users, 
                    COUNT(*) FILTER (WHERE "emailVerified" = true)::int as verified_count,
                    COUNT(*) FILTER (WHERE ${metricsIntervals.currentFilter})::int as users_in_window,
                    COUNT(*) FILTER (WHERE ${metricsIntervals.prevFilter})::int as users_prev_window
                  FROM "User"
                `);

                const salesRes = await pool.query(analytics.metricsSalesQuery(metricsIntervals));
                const productRes = await pool.query('SELECT COUNT(*)::int as count FROM "Product"');
                const [topFeatures, apiCalls] = await Promise.all([
                  analytics.computeRealTopFeatures(pool, metricsTimeRange),
                  analytics.computeTotalApiCalls(pool, metricsTimeRange),
                ]);

                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify(
                  analytics.buildMetricsResponse({
                    userRes,
                    salesRes,
                    productRes,
                    topFeatures,
                    timeRange: metricsTimeRange,
                    intervals: metricsIntervals,
                    apiCalls,
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
                const analyticsPath = resolve(process.cwd(), 'analyticsShared.js');
                const mtime = statSync(analyticsPath).mtimeMs;
                const analytics = await import(`${pathToFileURL(analyticsPath).href}?mtime=${mtime}`);
                const topFeatures = await analytics.computeRealTopFeatures(pool, timeRange);
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

            // 3a. GET /api/admin/sections/summary
            if (pathname === '/api/admin/sections/summary') {
              try {
                const summary = await computeSectionsSummary(pool, timeRange);
                send(200, summary);
                return;
              } catch (err: any) {
                console.error('DB error on /api/admin/sections/summary:', err.message);
                send(500, { error: err.message || 'Failed to fetch sections summary' });
                return;
              }
            }

            // 3b. GET /api/admin/profiles
            if (pathname === '/api/admin/profiles') {
              try {
                const analyticsPath = resolve(process.cwd(), 'analyticsShared.js');
                const mtime = statSync(analyticsPath).mtimeMs;
                const analytics = await import(`${pathToFileURL(analyticsPath).href}?mtime=${mtime}`);
                const profiles = await analytics.computeBusinessProfiles(pool, timeRange);
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify(profiles));
                return;
              } catch (err: any) {
                console.error('DB error on /api/admin/profiles:', err.message);
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: err.message || 'Failed to fetch business profiles' }));
                return;
              }
            }

            // 3c. GET /api/admin/profiles/:businessType/sections
            const profileSectionsMatch = pathname.match(/^\/api\/admin\/profiles\/([^/]+)\/sections$/);
            if (profileSectionsMatch) {
              try {
                const businessType = decodeURIComponent(profileSectionsMatch[1]);
                const allowed = ['restaurant_cafe', 'online_store', 'retail_shop', 'unknown'];
                if (!allowed.includes(businessType)) {
                  res.statusCode = 400;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ error: 'Invalid business type' }));
                  return;
                }
                const analyticsPath = resolve(process.cwd(), 'analyticsShared.js');
                const mtime = statSync(analyticsPath).mtimeMs;
                const analytics = await import(`${pathToFileURL(analyticsPath).href}?mtime=${mtime}`);
                const sections = await analytics.computeRealTopFeatures(pool, timeRange, businessType);
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify(sections));
                return;
              } catch (err: any) {
                console.error('DB error on /api/admin/profiles/:type/sections:', err.message);
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: err.message || 'Failed to fetch profile sections' }));
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

            // 10. Access codes — generate / list / batches
            if (pathname === '/api/admin/access-codes/generate' && req.method === 'POST') {
              try {
                const payload = await readBody();
                const session = getSessionUser(req);
                const result = await generateAccessCodes(pool, {
                  count: payload.count,
                  note: payload.note,
                  createdBy: session?.userId || getAdminUserId(),
                });
                send(200, result);
              } catch (err: any) {
                console.error('DB error on generate access codes:', err.message);
                send(err?.statusCode || 500, { error: err?.message || 'Failed to generate codes' });
              }
              return;
            }

            if (pathname === '/api/admin/access-codes/batches' && req.method === 'GET') {
              try {
                const result = await listAccessCodeBatches(pool, {
                  page: parsedUrl.searchParams.get('page') || undefined,
                  limit: parsedUrl.searchParams.get('limit') || undefined,
                });
                send(200, result);
              } catch (err: any) {
                console.error('DB error on access-code batches:', err.message);
                send(500, { error: err?.message || 'Failed to list batches' });
              }
              return;
            }

            if (pathname === '/api/admin/access-codes/issuers' && req.method === 'GET') {
              try {
                const result = await listAccessCodeIssuers(pool);
                send(200, result);
              } catch (err: any) {
                console.error('DB error on access-code issuers:', err.message);
                send(500, { error: err?.message || 'Failed to list issuers' });
              }
              return;
            }

            const batchCodesMatch = pathname.match(/^\/api\/admin\/access-codes\/batch\/([^/]+)$/);
            if (batchCodesMatch && req.method === 'GET') {
              try {
                const result = await getAccessCodesByBatch(pool, decodeURIComponent(batchCodesMatch[1]));
                send(200, result);
              } catch (err: any) {
                console.error('DB error on access-code batch:', err.message);
                send(err?.statusCode || 500, { error: err?.message || 'Failed to fetch batch' });
              }
              return;
            }

            if ((pathname === '/api/admin/access-codes/search' || pathname === '/api/admin/access-codes/lookup') && req.method === 'GET') {
              try {
                const code = parsedUrl.searchParams.get('code') || parsedUrl.searchParams.get('q') || '';
                const result = await lookupAccessCode(pool, code);
                send(200, result);
              } catch (err: any) {
                console.error('DB error on access-code search:', err.message);
                send(err?.statusCode || 500, { error: err?.message || 'Failed to search access code' });
              }
              return;
            }

            if (pathname === '/api/admin/access-codes' && req.method === 'GET') {
              try {
                const result = await listAccessCodes(pool, {
                  page: parsedUrl.searchParams.get('page') || undefined,
                  limit: parsedUrl.searchParams.get('limit') || undefined,
                  batchId: parsedUrl.searchParams.get('batchId') || undefined,
                  search: parsedUrl.searchParams.get('search') || undefined,
                  createdBy: parsedUrl.searchParams.get('createdBy') || undefined,
                  customerOnly:
                    parsedUrl.searchParams.get('customerOnly') === '1' ||
                    parsedUrl.searchParams.get('customerOnly') === 'true',
                });
                send(200, result);
              } catch (err: any) {
                console.error('DB error on access-codes list:', err.message);
                send(500, { error: err?.message || 'Failed to list codes' });
              }
              return;
            }

            // 11. Support agents CRUD
            if (pathname === '/api/admin/support-agents' && req.method === 'GET') {
              try {
                const items = await listSupportAgents(pool);
                send(200, { items });
              } catch (err: any) {
                send(500, { error: err?.message || 'Failed to list support agents' });
              }
              return;
            }

            if (pathname === '/api/admin/support-agents' && req.method === 'POST') {
              try {
                const payload = await readBody();
                const session = getSessionUser(req);
                const result = await createSupportAgent(pool, payload, session?.userId || getAdminUserId());
                send(200, result);
              } catch (err: any) {
                send(err?.statusCode || 500, { error: err?.message || 'Failed to create support agent' });
              }
              return;
            }

            const supportDisableMatch = pathname.match(/^\/api\/admin\/support-agents\/([^/]+)\/disable$/);
            if (supportDisableMatch && req.method === 'POST') {
              try {
                const agent = await setSupportAgentDisabled(pool, decodeURIComponent(supportDisableMatch[1]), true);
                send(200, { success: true, agent });
              } catch (err: any) {
                send(err?.statusCode || 500, { error: err?.message || 'Failed to disable' });
              }
              return;
            }

            const supportEnableMatch = pathname.match(/^\/api\/admin\/support-agents\/([^/]+)\/enable$/);
            if (supportEnableMatch && req.method === 'POST') {
              try {
                const agent = await setSupportAgentDisabled(pool, decodeURIComponent(supportEnableMatch[1]), false);
                send(200, { success: true, agent });
              } catch (err: any) {
                send(err?.statusCode || 500, { error: err?.message || 'Failed to enable' });
              }
              return;
            }

            const supportResetMatch = pathname.match(/^\/api\/admin\/support-agents\/([^/]+)\/reset-password$/);
            if (supportResetMatch && req.method === 'POST') {
              try {
                const payload = await readBody();
                const result = await resetSupportAgentPassword(
                  pool,
                  decodeURIComponent(supportResetMatch[1]),
                  typeof payload.password === 'string' ? payload.password : undefined
                );
                send(200, { success: true, ...result });
              } catch (err: any) {
                send(err?.statusCode || 500, { error: err?.message || 'Failed to reset password' });
              }
              return;
            }

            const supportRevokeMatch = pathname.match(/^\/api\/admin\/support-agents\/([^/]+)$/);
            if (supportRevokeMatch && req.method === 'DELETE') {
              try {
                const result = await revokeSupportAgent(pool, decodeURIComponent(supportRevokeMatch[1]));
                send(200, result);
              } catch (err: any) {
                send(err?.statusCode || 500, { error: err?.message || 'Failed to revoke' });
              }
              return;
            }

            // Printer Analytics
            if (pathname === '/api/admin/printers/summary' && req.method === 'GET') {
              try {
                const timeRange = parsedUrl.searchParams.get('timeRange') || 'all';
                const result = await withDbRetry(() => getPrinterSummary(pool, { timeRange }));
                send(200, result);
              } catch (err: any) {
                console.error('Error fetching printer summary:', err);
                send(500, { error: err?.message || 'Failed to fetch printer summary' });
              }
              return;
            }

            if (pathname === '/api/admin/printers/user-logs' && req.method === 'GET') {
              try {
                const result = await withDbRetry(() => getPrinterUserLogs(pool, {
                  search: parsedUrl.searchParams.get('search') || undefined,
                  platform: parsedUrl.searchParams.get('platform') || undefined,
                  printerName: parsedUrl.searchParams.get('printerName') || undefined,
                  timeRange: parsedUrl.searchParams.get('timeRange') || 'all',
                  page: Number(parsedUrl.searchParams.get('page')) || 1,
                  limit: Number(parsedUrl.searchParams.get('limit')) || 50,
                }));
                send(200, result);
              } catch (err: any) {
                console.error('Error fetching printer user logs:', err);
                send(500, { error: err?.message || 'Failed to fetch printer logs' });
              }
              return;
            }

            // 12. Support portal auth (public)
            if (pathname === '/api/support/login' && req.method === 'POST') {
              try {
                const payload = await readBody();
                const agent = await authenticateSupportAgent(pool, String(payload.username || ''), String(payload.password || ''));
                const token = createSupportSessionToken(agent.id);
                res.setHeader('Set-Cookie', supportSessionCookieHeader(token, isSupportSecureRequest(req)));
                send(200, { success: true, agent });
              } catch (err: any) {
                send(err?.statusCode || 500, { error: err?.message || 'Login failed' });
              }
              return;
            }

            if (pathname === '/api/support/logout' && req.method === 'POST') {
              res.setHeader('Set-Cookie', clearSupportSessionCookieHeader(isSupportSecureRequest(req)));
              send(200, { success: true });
              return;
            }

            if (pathname === '/api/support/me' && req.method === 'GET') {
              try {
                const session = getSupportSession(req);
                if (!session) {
                  send(401, { error: 'Unauthorized' });
                  return;
                }
                const agent = await getSupportAgentById(pool, session.agentId);
                if (!agent) {
                  send(401, { error: 'Unauthorized' });
                  return;
                }
                if (agent.isDisabled) {
                  res.setHeader('Set-Cookie', clearSupportSessionCookieHeader(isSupportSecureRequest(req)));
                  send(403, { error: 'Access disabled. Contact an administrator.' });
                  return;
                }
                send(200, { agent });
              } catch (err: any) {
                send(500, { error: err?.message || 'Failed to load session' });
              }
              return;
            }

            if (pathname === '/api/support/access-codes/issue' && req.method === 'POST') {
              try {
                const session = getSupportSession(req);
                if (!session) {
                  send(401, { error: 'Unauthorized' });
                  return;
                }
                const agent = await getSupportAgentById(pool, session.agentId);
                if (!agent) {
                  send(401, { error: 'Unauthorized' });
                  return;
                }
                if (agent.isDisabled) {
                  res.setHeader('Set-Cookie', clearSupportSessionCookieHeader(isSupportSecureRequest(req)));
                  send(403, { error: 'Access disabled. Contact an administrator.' });
                  return;
                }
                const payload = await readBody();
                const record = await withDbRetry(() =>
                  issueCustomerAccessCode(pool, {
                    ...payload,
                    createdBy: agent.username,
                  })
                );
                send(200, { success: true, record });
              } catch (err: any) {
                send(err?.statusCode || 500, { error: err?.message || 'Failed to issue code' });
              }
              return;
            }

            if ((pathname === '/api/support/access-codes/search' || pathname === '/api/support/access-codes/lookup') && req.method === 'GET') {
              try {
                const session = getSupportSession(req);
                if (!session) {
                  send(401, { error: 'Unauthorized' });
                  return;
                }
                const agent = await getSupportAgentById(pool, session.agentId);
                if (!agent) {
                  send(401, { error: 'Unauthorized' });
                  return;
                }
                if (agent.isDisabled) {
                  res.setHeader('Set-Cookie', clearSupportSessionCookieHeader(isSupportSecureRequest(req)));
                  send(403, { error: 'Access disabled. Contact an administrator.' });
                  return;
                }
                const code = parsedUrl.searchParams.get('code') || parsedUrl.searchParams.get('q') || '';
                const result = await lookupAccessCode(pool, code);
                send(200, result);
              } catch (err: any) {
                console.error('DB error on support access-code search:', err.message);
                send(err?.statusCode || 500, { error: err?.message || 'Failed to search access code' });
              }
              return;
            }

            if (pathname === '/api/support/access-codes' && req.method === 'GET') {
              try {
                const session = getSupportSession(req);
                if (!session) {
                  send(401, { error: 'Unauthorized' });
                  return;
                }
                const agent = await getSupportAgentById(pool, session.agentId);
                if (!agent) {
                  send(401, { error: 'Unauthorized' });
                  return;
                }
                if (agent.isDisabled) {
                  res.setHeader('Set-Cookie', clearSupportSessionCookieHeader(isSupportSecureRequest(req)));
                  send(403, { error: 'Access disabled. Contact an administrator.' });
                  return;
                }
                const result = await listAccessCodes(pool, {
                  page: parsedUrl.searchParams.get('page') || undefined,
                  limit: parsedUrl.searchParams.get('limit') || undefined,
                  search: parsedUrl.searchParams.get('search') || undefined,
                  createdBy: agent.username,
                  customerOnly: true,
                });
                send(200, result);
              } catch (err: any) {
                send(500, { error: err?.message || 'Failed to list codes' });
              }
              return;
            }

            next();
          });
        },
      },
    ],
  };
});
