import {
  getTimeIntervals,
  computeRealTopFeatures,
  computeRealHeatmapData,
  buildMetricsResponse,
  mapUserRows,
  getUsersWhereClause,
  applyTableAlias,
  metricsSalesQuery,
} from '../../analyticsShared.js';
import { getPool, sendJson, readJsonBody } from '../../lib/adminDb.js';

function pathSegments(req) {
  const raw = req.query.path;
  if (Array.isArray(raw)) return raw.filter(Boolean);
  if (typeof raw === 'string' && raw.length > 0) return raw.split('/').filter(Boolean);
  return [];
}

export default async function handler(req, res) {
  const segments = pathSegments(req);
  const route = segments.join('/');
  const method = req.method || 'GET';
  const query = req.query || {};

  try {
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
      const topFeatures = await computeRealTopFeatures(pool, timeRange);
      return sendJson(res, 200, buildMetricsResponse({
        userRes,
        salesRes,
        productRes,
        topFeatures,
        timeRange,
        intervals,
      }));
    }

    if (method === 'GET' && route === 'users') {
      const timeRange = query.timeRange || 'all';
      const whereClause = getUsersWhereClause(timeRange);
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

    if (method === 'GET' && route === 'sections') {
      const timeRange = query.timeRange || '24h';
      const topFeatures = await computeRealTopFeatures(pool, timeRange);
      return sendJson(res, 200, topFeatures);
    }

    if (method === 'GET' && route === 'heatmap') {
      const timeRange = query.timeRange || '24h';
      const daysParam = parseInt(query.days, 10);
      const dayCountOverride = Number.isFinite(daysParam) && daysParam > 0 ? daysParam : undefined;
      const heatmapData = await computeRealHeatmapData(pool, timeRange, dayCountOverride);
      return sendJson(res, 200, heatmapData);
    }

    if (method === 'GET' && route === 'devices') {
      const timeRange = query.timeRange || '24h';
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
      const timeRange = query.timeRange || '24h';
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

    return sendJson(res, 404, { error: `Unknown admin route: ${method} /api/admin/${route}` });
  } catch (err) {
    console.error(`Admin API error on /${route}:`, err);
    const message = err instanceof Error ? err.message : 'Request failed';
    if (message === 'DATABASE_URL is not set') {
      return sendJson(res, 500, { error: 'DATABASE_URL is not set on Vercel' });
    }
    return sendJson(res, 500, { error: message });
  }
}
