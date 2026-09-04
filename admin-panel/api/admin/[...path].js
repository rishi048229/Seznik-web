import {
  getTimeIntervals,
  computeRealTopFeatures,
  computeRealHeatmapData,
  buildMetricsResponse,
  mapUserRows,
  getUsersWhereClause,
  applyTableAlias,
  metricsSalesQuery,
  buildFeedbackQuery,
  mapFeedbackRows,
  computeTotalApiCalls,
  computeBusinessProfiles,
  computeSectionsSummary,
  ensureSeznikUserColumn,
} from '../../analyticsShared.js';
import { getPool, sendJson, readJsonBody } from '../../lib/adminDb.js';
import {
  credentialsMatch,
  createSessionToken,
  getSessionUser,
  getAdminUserId,
  isSecureRequest,
  sessionCookieHeader,
  clearSessionCookieHeader,
} from '../../lib/adminAuth.js';
import {
  generateAccessCodes,
  listAccessCodes,
  listAccessCodeBatches,
  getAccessCodesByBatch,
  listAccessCodeIssuers,
} from '../../lib/accessCodes.js';
import {
  listSupportAgents,
  createSupportAgent,
  setSupportAgentDisabled,
  revokeSupportAgent,
} from '../../lib/supportAgents.js';

function pathSegments(req) {
  const rawUrl = req.url || '';
  const pathname = new URL(rawUrl, 'http://localhost').pathname;
  const trimmed = pathname.replace(/^\/api\/admin\/?/, '');
  if (trimmed) return trimmed.split('/').filter(Boolean);

  const raw = req.query?.path;
  if (Array.isArray(raw)) return raw.filter(Boolean);
  if (typeof raw === 'string' && raw.length > 0) return raw.split('/').filter(Boolean);
  return [];
}

export default async function handler(req, res) {
  const segments = pathSegments(req);
  const route = segments.join('/');
  const method = req.method || 'GET';
  const query = req.query || {};
  const secure = isSecureRequest(req);

  try {
    if (method === 'POST' && route === 'login') {
      const payload = await readJsonBody(req);
      const userId = String(payload.userId || '').trim();
      const password = String(payload.password || '');
      if (!credentialsMatch(userId, password)) {
        return sendJson(res, 401, { error: 'Invalid user ID or password' });
      }
      const token = createSessionToken(getAdminUserId());
      res.setHeader('Set-Cookie', sessionCookieHeader(token, secure));
      return sendJson(res, 200, { success: true, userId: getAdminUserId() });
    }

    if (method === 'POST' && route === 'logout') {
      res.setHeader('Set-Cookie', clearSessionCookieHeader(secure));
      return sendJson(res, 200, { success: true });
    }

    if (method === 'GET' && route === 'me') {
      const session = getSessionUser(req);
      if (!session) return sendJson(res, 401, { error: 'Unauthorized' });
      return sendJson(res, 200, { userId: session.userId });
    }

    if (!getSessionUser(req)) {
      return sendJson(res, 401, { error: 'Unauthorized' });
    }

    const pool = getPool();

    if (method === 'GET' && route === 'health') {
      const startTime = Date.now();
      await pool.query('SELECT 1');
      return sendJson(res, 200, {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptimeSeconds: Math.floor(process.uptime()),
        database: {
          status: 'connected',
          latencyMs: Date.now() - startTime,
        },
        environment: process.env.NODE_ENV || 'production',
        memoryUsageMb: Math.round((process.memoryUsage().rss / 1024 / 1024) * 100) / 100,
      });
    }

    if (method === 'GET' && route === 'metrics') {
      const timeRange = query.timeRange || 'all';
      const intervals = getTimeIntervals(timeRange);
      const userRes = await pool.query(`
        SELECT
          COUNT(*)::int as total_users,
          COUNT(*) FILTER (WHERE "emailVerified" = true)::int as verified_count,
          COUNT(*) FILTER (WHERE ${intervals.currentFilter})::int as users_in_window,
          COUNT(*) FILTER (WHERE ${intervals.prevFilter})::int as users_prev_window
        FROM "User"
      `);
      const salesRes = await pool.query(metricsSalesQuery(intervals));
      const productRes = await pool.query('SELECT COUNT(*)::int as count FROM "Product"');
      const [topFeatures, apiCalls] = await Promise.all([
        computeRealTopFeatures(pool, timeRange),
        computeTotalApiCalls(pool, timeRange),
      ]);
      return sendJson(res, 200, buildMetricsResponse({
        userRes,
        salesRes,
        productRes,
        topFeatures,
        timeRange,
        intervals,
        apiCalls,
      }));
    }

    if (method === 'GET' && route === 'users') {
      const timeRange = query.timeRange || 'all';
      const whereClause = getUsersWhereClause(timeRange);
      await ensureSeznikUserColumn(pool);
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
      return sendJson(res, 200, mapUserRows(result.rows));
    }

    const banMatch = route.match(/^users\/(.+)\/ban$/);
    if (method === 'POST' && banMatch) {
      const targetId = decodeURIComponent(banMatch[1]);
      const payload = await readJsonBody(req);
      const reason = payload.reason || 'Account suspended by system administrator';
      const updateRes = await pool.query(
        `UPDATE "User"
         SET "isBanned" = true, "banReason" = $1, "bannedAt" = CURRENT_TIMESTAMP
         WHERE id = $2 OR uid = $2
         RETURNING id, email, "displayName", "isBanned", "banReason", "bannedAt"`,
        [reason, targetId]
      );
      if (updateRes.rowCount === 0) {
        return sendJson(res, 404, { error: 'User not found' });
      }
      return sendJson(res, 200, {
        success: true,
        message: 'User banned successfully',
        user: updateRes.rows[0],
      });
    }

    const unbanMatch = route.match(/^users\/(.+)\/unban$/);
    if (method === 'POST' && unbanMatch) {
      const targetId = decodeURIComponent(unbanMatch[1]);
      const updateRes = await pool.query(
        `UPDATE "User"
         SET "isBanned" = false, "banReason" = NULL, "bannedAt" = NULL
         WHERE id = $1 OR uid = $1
         RETURNING id, email, "displayName", "isBanned", "banReason", "bannedAt"`,
        [targetId]
      );
      if (updateRes.rowCount === 0) {
        return sendJson(res, 404, { error: 'User not found' });
      }
      return sendJson(res, 200, {
        success: true,
        message: 'User unbanned successfully',
        user: updateRes.rows[0],
      });
    }

    const seznikMatch = route.match(/^users\/(.+)\/seznik$/);
    if (method === 'POST' && seznikMatch) {
      const targetId = decodeURIComponent(seznikMatch[1]);
      const payload = await readJsonBody(req);
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
        return sendJson(res, 404, { error: 'User not found' });
      }
      return sendJson(res, 200, {
        success: true,
        message: seznikUser ? 'Marked as Seznik user' : 'Marked as Non-Seznik user',
        user: updateRes.rows[0],
      });
    }

    if (method === 'GET' && route === 'sections/summary') {
      const timeRange = query.timeRange || 'all';
      const summary = await computeSectionsSummary(pool, timeRange);
      return sendJson(res, 200, summary);
    }

    if (method === 'GET' && route === 'sections') {
      const timeRange = query.timeRange || 'all';
      const topFeatures = await computeRealTopFeatures(pool, timeRange);
      return sendJson(res, 200, topFeatures);
    }

    if (method === 'GET' && route === 'profiles') {
      const timeRange = query.timeRange || 'all';
      const profiles = await computeBusinessProfiles(pool, timeRange);
      return sendJson(res, 200, profiles);
    }

    const profileSectionsMatch = route.match(/^profiles\/([^/]+)\/sections$/);
    if (method === 'GET' && profileSectionsMatch) {
      const businessType = decodeURIComponent(profileSectionsMatch[1]);
      const allowed = ['restaurant_cafe', 'online_store', 'retail_shop', 'unknown'];
      if (!allowed.includes(businessType)) {
        return sendJson(res, 400, { error: 'Invalid business type' });
      }
      const timeRange = query.timeRange || 'all';
      const sections = await computeRealTopFeatures(pool, timeRange, businessType);
      return sendJson(res, 200, sections);
    }

    if (method === 'GET' && route === 'heatmap') {
      const timeRange = query.timeRange || 'all';
      const daysParam = parseInt(query.days, 10);
      const dayCountOverride = Number.isFinite(daysParam) && daysParam > 0 ? daysParam : undefined;
      const heatmapData = await computeRealHeatmapData(pool, timeRange, dayCountOverride);
      return sendJson(res, 200, heatmapData);
    }

    if (method === 'GET' && route === 'devices') {
      const timeRange = query.timeRange || 'all';
      const intervals = getTimeIntervals(timeRange);
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
      return sendJson(res, 200, {
        desktopCount: webCount,
        desktopPercent: totalInvoices > 0 ? Math.round((webCount / totalInvoices) * 100) : 100,
        mobileCount,
        mobilePercent: totalInvoices > 0 ? Math.round((mobileCount / totalInvoices) * 100) : 0,
        totalInvoices,
      });
    }

    if (method === 'GET' && route === 'invoices') {
      const timeRange = query.timeRange || 'all';
      const platform = query.platform || 'all';
      const limit = Math.min(200, parseInt(query.limit || '50', 10));
      const intervals = getTimeIntervals(timeRange);
      const whereConditions = [];
      if (timeRange !== 'all') {
        whereConditions.push(`(${applyTableAlias(intervals.currentFilter, 's')})`);
      }
      if (platform === 'mobile') {
        whereConditions.push(`s.platform = 'mobile'`);
      } else if (platform === 'web') {
        whereConditions.push(`(s.platform = 'web' OR s.platform IS NULL)`);
      }
      const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
      const result = await pool.query(
        `SELECT
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
        LIMIT $1`,
        [limit]
      );
      return sendJson(res, 200, result.rows);
    }

    if (method === 'GET' && route === 'products') {
      const limit = Math.min(200, parseInt(query.limit || '100', 10));
      const result = await pool.query(
        `SELECT
          p.id,
          p.name,
          COALESCE(p.barcode, p.sku, 'N/A') as sku,
          p."sellingPrice",
          COALESCE(c.name, 'General') as "categoryName",
          p."createdAt"
        FROM "Product" p
        LEFT JOIN "Category" c ON p."categoryId" = c.id
        ORDER BY p."createdAt" DESC
        LIMIT $1`,
        [limit]
      );
      return sendJson(res, 200, result.rows);
    }

    if (method === 'GET' && route === 'feedback') {
      const { countSql, dataSql, params, page, limit } = buildFeedbackQuery(query);
      const countParams = params.slice(0, params.length - 2);
      const [countRes, dataRes] = await Promise.all([
        pool.query(countSql, countParams),
        pool.query(dataSql, params),
      ]);
      const total = countRes.rows[0]?.total || 0;
      return sendJson(res, 200, {
        items: mapFeedbackRows(dataRes.rows),
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      });
    }

    if (method === 'POST' && route === 'access-codes/generate') {
      const payload = await readJsonBody(req);
      const session = getSessionUser(req);
      const result = await generateAccessCodes(pool, {
        count: payload.count,
        note: payload.note,
        createdBy: session?.userId || getAdminUserId(),
      });
      return sendJson(res, 200, result);
    }

    if (method === 'GET' && route === 'access-codes/batches') {
      const result = await listAccessCodeBatches(pool, {
        page: query.page,
        limit: query.limit,
      });
      return sendJson(res, 200, result);
    }

    const batchCodesMatch = route.match(/^access-codes\/batch\/([^/]+)$/);
    if (method === 'GET' && batchCodesMatch) {
      const result = await getAccessCodesByBatch(pool, decodeURIComponent(batchCodesMatch[1]));
      return sendJson(res, 200, result);
    }

    if (method === 'GET' && route === 'access-codes') {
      const result = await listAccessCodes(pool, {
        page: query.page,
        limit: query.limit,
        batchId: query.batchId,
        search: query.search,
        createdBy: query.createdBy,
        customerOnly: query.customerOnly === '1' || query.customerOnly === 'true',
      });
      return sendJson(res, 200, result);
    }

    if (method === 'GET' && route === 'access-codes/issuers') {
      const result = await listAccessCodeIssuers(pool);
      return sendJson(res, 200, result);
    }

    if (method === 'GET' && route === 'support-agents') {
      const agents = await listSupportAgents(pool);
      return sendJson(res, 200, { items: agents });
    }

    if (method === 'POST' && route === 'support-agents') {
      const payload = await readJsonBody(req);
      const session = getSessionUser(req);
      const result = await createSupportAgent(pool, payload, session?.userId || getAdminUserId());
      return sendJson(res, 200, result);
    }

    const supportDisableMatch = route.match(/^support-agents\/([^/]+)\/disable$/);
    if (method === 'POST' && supportDisableMatch) {
      const agent = await setSupportAgentDisabled(pool, decodeURIComponent(supportDisableMatch[1]), true);
      return sendJson(res, 200, { success: true, agent });
    }

    const supportEnableMatch = route.match(/^support-agents\/([^/]+)\/enable$/);
    if (method === 'POST' && supportEnableMatch) {
      const agent = await setSupportAgentDisabled(pool, decodeURIComponent(supportEnableMatch[1]), false);
      return sendJson(res, 200, { success: true, agent });
    }

    const supportRevokeMatch = route.match(/^support-agents\/([^/]+)$/);
    if (method === 'DELETE' && supportRevokeMatch) {
      const result = await revokeSupportAgent(pool, decodeURIComponent(supportRevokeMatch[1]));
      return sendJson(res, 200, result);
    }

    return sendJson(res, 404, { error: `Unknown admin route: ${method} /api/admin/${route}` });
  } catch (err) {
    console.error(`Admin API error on /${route}:`, err);
    const message = err instanceof Error ? err.message : 'Request failed';
    if (err?.statusCode) {
      return sendJson(res, err.statusCode, { error: message });
    }
    if (message === 'DATABASE_URL is not set') {
      return sendJson(res, 500, { error: 'DATABASE_URL is not set on Vercel' });
    }
    return sendJson(res, 500, { error: message });
  }
}
