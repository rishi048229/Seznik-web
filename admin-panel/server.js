import express from 'express';
import cors from 'cors';
import pg from 'pg';
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
} from './analyticsShared.js';

if (typeof process.loadEnvFile === 'function') {
  try {
    process.loadEnvFile();
  } catch {}
}

const app = express();
const PORT = process.env.ADMIN_PORT || 5005;

// PostgreSQL Connection Pool using database connection string
const dbUrl = process.env.DATABASE_URL || 'postgresql://postgres:SeznikPass2026!@seznik-pos-db-dev.cgt6m60qe16b.us-east-1.rds.amazonaws.com:5432/postgres?schema=public';
const pool = new pg.Pool({
  connectionString: dbUrl,
  ssl: dbUrl.includes('rds.amazonaws.com') ? { rejectUnauthorized: false } : undefined,
});

app.use(cors());
app.use(express.json());

// GET /api/admin/metrics - Real DB Stats
app.get('/api/admin/metrics', async (req, res) => {
  const timeRange = req.query.timeRange || 'all';
  const intervals = getTimeIntervals(timeRange);

  try {
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

    res.json(
      buildMetricsResponse({
        userRes,
        salesRes,
        productRes,
        topFeatures,
        timeRange,
        intervals,
      })
    );
  } catch (err) {
    console.error('Error in /api/admin/metrics:', err);
    res.status(500).json({ error: 'Failed to fetch metrics' });
  }
});

// GET /api/admin/users
app.get('/api/admin/users', async (req, res) => {
  const timeRange = req.query.timeRange || 'all';
  const whereClause = getUsersWhereClause(timeRange);

  try {
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

    res.json(mapUserRows(result.rows));
  } catch (err) {
    console.error('Error in /api/admin/users:', err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// POST /api/admin/users/:id/ban
app.post('/api/admin/users/:id/ban', async (req, res) => {
  const targetId = req.params.id;
  const reason = req.body?.reason || 'Account suspended by system administrator';

  try {
    const updateRes = await pool.query(
      `UPDATE "User" 
       SET "isBanned" = true, "banReason" = $1, "bannedAt" = CURRENT_TIMESTAMP 
       WHERE id = $2 OR uid = $2
       RETURNING id, email, "displayName", "isBanned", "banReason", "bannedAt"`,
      [reason, targetId]
    );

    if (updateRes.rowCount === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      success: true,
      message: 'User banned successfully',
      user: updateRes.rows[0],
    });
  } catch (err) {
    console.error('Error banning user:', err);
    res.status(500).json({ error: 'Failed to ban user' });
  }
});

// POST /api/admin/users/:id/unban
app.post('/api/admin/users/:id/unban', async (req, res) => {
  const targetId = req.params.id;

  try {
    const updateRes = await pool.query(
      `UPDATE "User" 
       SET "isBanned" = false, "banReason" = NULL, "bannedAt" = NULL 
       WHERE id = $1 OR uid = $1
       RETURNING id, email, "displayName", "isBanned", "banReason", "bannedAt"`,
      [targetId]
    );

    if (updateRes.rowCount === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      success: true,
      message: 'User unbanned successfully',
      user: updateRes.rows[0],
    });
  } catch (err) {
    console.error('Error unbanning user:', err);
    res.status(500).json({ error: 'Failed to unban user' });
  }
});

// GET /api/admin/sections
app.get('/api/admin/sections', async (req, res) => {
  const timeRange = req.query.timeRange || '24h';
  try {
    const topFeatures = await computeRealTopFeatures(pool, timeRange);
    res.json(topFeatures);
  } catch (err) {
    console.error('Error in /api/admin/sections:', err);
    res.status(500).json({ error: 'Failed to fetch sections' });
  }
});

// GET /api/admin/heatmap
app.get('/api/admin/heatmap', async (req, res) => {
  const timeRange = req.query.timeRange || '24h';
  const daysParam = parseInt(req.query.days, 10);
  const dayCountOverride = Number.isFinite(daysParam) && daysParam > 0 ? daysParam : undefined;
  try {
    const heatmapData = await computeRealHeatmapData(pool, timeRange, dayCountOverride);
    res.json(heatmapData);
  } catch (err) {
    console.error('Error in /api/admin/heatmap:', err);
    res.status(500).json({ error: 'Failed to fetch heatmap' });
  }
});

// GET /api/admin/devices
app.get('/api/admin/devices', async (req, res) => {
  const timeRange = req.query.timeRange || '24h';
  const intervals = getTimeIntervals(timeRange);

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

    res.json({
      desktopCount: webCount,
      desktopPercent,
      mobileCount,
      mobilePercent,
      totalInvoices,
    });
  } catch (err) {
    console.error('Error in /api/admin/devices:', err);
    res.status(500).json({ error: 'Failed to fetch devices' });
  }
});

// GET /api/admin/invoices - Invoices list with platform filter
app.get('/api/admin/invoices', async (req, res) => {
  const timeRange = req.query.timeRange || '24h';
  const platform = req.query.platform || 'all'; // 'all' | 'mobile' | 'web'
  const limit = Math.min(100, parseInt(req.query.limit || '50', 10));
  const intervals = getTimeIntervals(timeRange);

  try {
    let whereConditions = [];
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
    res.json(result.rows);
  } catch (err) {
    console.error('Error in /api/admin/invoices:', err);
    res.status(500).json({ error: 'Failed to fetch invoices' });
  }
});

// GET /api/admin/products
app.get('/api/admin/products', async (req, res) => {
  const limit = Math.min(200, parseInt(req.query.limit || '100', 10));
  try {
    const result = await pool.query(`
      SELECT 
        p.id,
        p.name,
        COALESCE(p.barcode, p.sku, 'N/A') as sku,
        p."sellingPrice",
        COALESCE(c.name, 'General') as "categoryName",
        p."createdAt"
      FROM "Product" p
      LEFT JOIN "Category" c ON p."categoryId" = c.id
      ORDER BY p."createdAt" DESC
      LIMIT $1
    `, [limit]);
    res.json(result.rows);
  } catch (err) {
    console.error('Error in /api/admin/products:', err);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// GET /api/admin/feedback
app.get('/api/admin/feedback', async (req, res) => {
  try {
    const { countSql, dataSql, params, page, limit } = buildFeedbackQuery(req.query);
    const countParams = params.slice(0, params.length - 2);
    const [countRes, dataRes] = await Promise.all([
      pool.query(countSql, countParams),
      pool.query(dataSql, params),
    ]);
    const total = countRes.rows[0]?.total || 0;
    res.json({
      items: mapFeedbackRows(dataRes.rows),
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch (err) {
    console.error('Error in /api/admin/feedback:', err);
    res.status(500).json({ error: 'Failed to fetch feedback' });
  }
});

// GET /api/admin/health - Server & Database health check
app.get('/api/admin/health', async (req, res) => {
  try {
    const startTime = Date.now();
    await pool.query('SELECT 1');
    const dbLatencyMs = Date.now() - startTime;

    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      database: {
        status: 'connected',
        latencyMs: dbLatencyMs,
      },
      environment: process.env.NODE_ENV || 'production',
      memoryUsageMb: Math.round((process.memoryUsage().rss / 1024 / 1024) * 100) / 100,
      port: PORT,
    });
  } catch (err) {
    res.status(500).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      database: {
        status: 'disconnected',
        error: err instanceof Error ? err.message : 'Database ping failed',
      },
    });
  }
});

app.listen(PORT, () => {
  console.log(`[Seznik Admin Backend] Listening on port ${PORT}`);
});
