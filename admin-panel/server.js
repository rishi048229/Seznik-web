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
  computeTotalApiCalls,
  computeBusinessProfiles,
  computeSectionsSummary,
  ensureSeznikUserColumn,
} from './analyticsShared.js';
import { pgConnectionString, pgSslConfig } from './lib/pgSsl.js';
import {
  generateAccessCodes,
  listAccessCodes,
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
  connectionString: pgConnectionString(dbUrl),
  ssl: pgSslConfig(dbUrl),
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
    const [topFeatures, apiCalls] = await Promise.all([
      computeRealTopFeatures(pool, timeRange),
      computeTotalApiCalls(pool, timeRange),
    ]);

    res.json(
      buildMetricsResponse({
        userRes,
        salesRes,
        productRes,
        topFeatures,
        timeRange,
        intervals,
        apiCalls,
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

// POST /api/admin/users/:id/seznik
app.post('/api/admin/users/:id/seznik', async (req, res) => {
  const targetId = req.params.id;
  const seznikUser = Boolean(req.body?.seznikUser);

  try {
    await ensureSeznikUserColumn(pool);
    const updateRes = await pool.query(
      `UPDATE "User"
       SET "seznikUser" = $1
       WHERE id = $2 OR uid = $2
       RETURNING id, email, "displayName", "seznikUser"`,
      [seznikUser, targetId]
    );

    if (updateRes.rowCount === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      success: true,
      message: seznikUser ? 'Marked as Seznik user' : 'Marked as Non-Seznik user',
      user: updateRes.rows[0],
    });
  } catch (err) {
    console.error('Error updating seznikUser:', err);
    res.status(500).json({ error: 'Failed to update Seznik flag' });
  }
});

// GET /api/admin/sections
app.get('/api/admin/sections', async (req, res) => {
  const timeRange = req.query.timeRange || 'all';
  try {
    const topFeatures = await computeRealTopFeatures(pool, timeRange);
    res.json(topFeatures);
  } catch (err) {
    console.error('Error in /api/admin/sections:', err);
    res.status(500).json({ error: 'Failed to fetch sections' });
  }
});

// GET /api/admin/sections/summary
app.get('/api/admin/sections/summary', async (req, res) => {
  const timeRange = req.query.timeRange || 'all';
  try {
    const summary = await computeSectionsSummary(pool, timeRange);
    res.json(summary);
  } catch (err) {
    console.error('Error in /api/admin/sections/summary:', err);
    res.status(500).json({ error: 'Failed to fetch sections summary' });
  }
});

// GET /api/admin/profiles — business-type overview cards
app.get('/api/admin/profiles', async (req, res) => {
  const timeRange = req.query.timeRange || 'all';
  try {
    const profiles = await computeBusinessProfiles(pool, timeRange);
    res.json(profiles);
  } catch (err) {
    console.error('Error in /api/admin/profiles:', err);
    res.status(500).json({ error: 'Failed to fetch business profiles' });
  }
});

// GET /api/admin/profiles/:businessType/sections
app.get('/api/admin/profiles/:businessType/sections', async (req, res) => {
  const timeRange = req.query.timeRange || 'all';
  const businessType = String(req.params.businessType || '').trim();
  const allowed = ['restaurant_cafe', 'online_store', 'retail_shop', 'unknown'];
  if (!allowed.includes(businessType)) {
    return res.status(400).json({ error: 'Invalid business type' });
  }
  try {
    const sections = await computeRealTopFeatures(pool, timeRange, businessType);
    res.json(sections);
  } catch (err) {
    console.error('Error in /api/admin/profiles/:businessType/sections:', err);
    res.status(500).json({ error: 'Failed to fetch profile sections' });
  }
});

// GET /api/admin/heatmap
app.get('/api/admin/heatmap', async (req, res) => {
  const timeRange = req.query.timeRange || 'all';
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
  const timeRange = req.query.timeRange || 'all';
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
  const timeRange = req.query.timeRange || 'all';
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

// POST /api/admin/access-codes/generate
app.post('/api/admin/access-codes/generate', async (req, res) => {
  try {
    const result = await generateAccessCodes(pool, {
      count: req.body?.count,
      note: req.body?.note,
      createdBy: 'admin',
    });
    res.json(result);
  } catch (err) {
    console.error('Error generating access codes:', err);
    res.status(err?.statusCode || 500).json({ error: err?.message || 'Failed to generate codes' });
  }
});

// GET /api/admin/access-codes/batches
app.get('/api/admin/access-codes/batches', async (req, res) => {
  try {
    const result = await listAccessCodeBatches(pool, {
      page: req.query.page,
      limit: req.query.limit,
    });
    res.json(result);
  } catch (err) {
    console.error('Error listing access code batches:', err);
    res.status(500).json({ error: 'Failed to list batches' });
  }
});

// GET /api/admin/access-codes/issuers
app.get('/api/admin/access-codes/issuers', async (req, res) => {
  try {
    const result = await listAccessCodeIssuers(pool);
    res.json(result);
  } catch (err) {
    console.error('Error listing access code issuers:', err);
    res.status(500).json({ error: 'Failed to list issuers' });
  }
});

// GET /api/admin/access-codes/batch/:batchId
app.get('/api/admin/access-codes/batch/:batchId', async (req, res) => {
  try {
    const result = await getAccessCodesByBatch(pool, req.params.batchId);
    res.json(result);
  } catch (err) {
    console.error('Error fetching batch codes:', err);
    res.status(err?.statusCode || 500).json({ error: err?.message || 'Failed to fetch batch' });
  }
});

// GET /api/admin/access-codes
app.get('/api/admin/access-codes', async (req, res) => {
  try {
    const result = await listAccessCodes(pool, {
      page: req.query.page,
      limit: req.query.limit,
      batchId: req.query.batchId,
      search: req.query.search,
      createdBy: req.query.createdBy,
      customerOnly: req.query.customerOnly === '1' || req.query.customerOnly === 'true',
    });
    res.json(result);
  } catch (err) {
    console.error('Error listing access codes:', err);
    res.status(500).json({ error: 'Failed to list codes' });
  }
});

// GET /api/admin/support-agents
app.get('/api/admin/support-agents', async (req, res) => {
  try {
    const items = await listSupportAgents(pool);
    res.json({ items });
  } catch (err) {
    console.error('Error listing support agents:', err);
    res.status(500).json({ error: 'Failed to list support agents' });
  }
});

// POST /api/admin/support-agents
app.post('/api/admin/support-agents', async (req, res) => {
  try {
    const result = await createSupportAgent(pool, req.body || {}, 'admin');
    res.json(result);
  } catch (err) {
    console.error('Error creating support agent:', err);
    res.status(err?.statusCode || 500).json({ error: err?.message || 'Failed to create support agent' });
  }
});

// POST /api/admin/support-agents/:id/disable
app.post('/api/admin/support-agents/:id/disable', async (req, res) => {
  try {
    const agent = await setSupportAgentDisabled(pool, req.params.id, true);
    res.json({ success: true, agent });
  } catch (err) {
    console.error('Error disabling support agent:', err);
    res.status(err?.statusCode || 500).json({ error: err?.message || 'Failed to disable' });
  }
});

// POST /api/admin/support-agents/:id/enable
app.post('/api/admin/support-agents/:id/enable', async (req, res) => {
  try {
    const agent = await setSupportAgentDisabled(pool, req.params.id, false);
    res.json({ success: true, agent });
  } catch (err) {
    console.error('Error enabling support agent:', err);
    res.status(err?.statusCode || 500).json({ error: err?.message || 'Failed to enable' });
  }
});

// POST /api/admin/support-agents/:id/reset-password
app.post('/api/admin/support-agents/:id/reset-password', async (req, res) => {
  try {
    const result = await resetSupportAgentPassword(pool, req.params.id, req.body?.password);
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('Error resetting support agent password:', err);
    res.status(err?.statusCode || 500).json({ error: err?.message || 'Failed to reset password' });
  }
});

// DELETE /api/admin/support-agents/:id
app.delete('/api/admin/support-agents/:id', async (req, res) => {
  try {
    const result = await revokeSupportAgent(pool, req.params.id);
    res.json(result);
  } catch (err) {
    console.error('Error revoking support agent:', err);
    res.status(err?.statusCode || 500).json({ error: err?.message || 'Failed to revoke' });
  }
});

// POST /api/support/login
app.post('/api/support/login', async (req, res) => {
  try {
    const agent = await authenticateSupportAgent(pool, req.body?.username, req.body?.password);
    const token = createSupportSessionToken(agent.id);
    res.setHeader('Set-Cookie', supportSessionCookieHeader(token, isSupportSecureRequest(req)));
    res.json({ success: true, agent });
  } catch (err) {
    console.error('Error on support login:', err);
    res.status(err?.statusCode || 500).json({ error: err?.message || 'Login failed' });
  }
});

app.post('/api/support/logout', (req, res) => {
  res.setHeader('Set-Cookie', clearSupportSessionCookieHeader(isSupportSecureRequest(req)));
  res.json({ success: true });
});

app.get('/api/support/me', async (req, res) => {
  try {
    const session = getSupportSession(req);
    if (!session) return res.status(401).json({ error: 'Unauthorized' });
    const agent = await getSupportAgentById(pool, session.agentId);
    if (!agent) return res.status(401).json({ error: 'Unauthorized' });
    if (agent.isDisabled) {
      res.setHeader('Set-Cookie', clearSupportSessionCookieHeader(isSupportSecureRequest(req)));
      return res.status(403).json({ error: 'Access disabled. Contact an administrator.' });
    }
    res.json({ agent });
  } catch (err) {
    console.error('Error on support me:', err);
    res.status(500).json({ error: 'Failed to load session' });
  }
});

// POST /api/support/access-codes/issue
app.post('/api/support/access-codes/issue', async (req, res) => {
  try {
    const session = getSupportSession(req);
    if (!session) return res.status(401).json({ error: 'Unauthorized' });
    const agent = await getSupportAgentById(pool, session.agentId);
    if (!agent) return res.status(401).json({ error: 'Unauthorized' });
    if (agent.isDisabled) {
      res.setHeader('Set-Cookie', clearSupportSessionCookieHeader(isSupportSecureRequest(req)));
      return res.status(403).json({ error: 'Access disabled. Contact an administrator.' });
    }
    const record = await issueCustomerAccessCode(pool, {
      ...req.body,
      createdBy: agent.username,
    });
    res.json({ success: true, record });
  } catch (err) {
    console.error('Error issuing customer access code:', err);
    res.status(err?.statusCode || 500).json({ error: err?.message || 'Failed to issue code' });
  }
});

// GET /api/support/access-codes
app.get('/api/support/access-codes', async (req, res) => {
  try {
    const session = getSupportSession(req);
    if (!session) return res.status(401).json({ error: 'Unauthorized' });
    const agent = await getSupportAgentById(pool, session.agentId);
    if (!agent) return res.status(401).json({ error: 'Unauthorized' });
    if (agent.isDisabled) {
      res.setHeader('Set-Cookie', clearSupportSessionCookieHeader(isSupportSecureRequest(req)));
      return res.status(403).json({ error: 'Access disabled. Contact an administrator.' });
    }
    const result = await listAccessCodes(pool, {
      page: req.query.page,
      limit: req.query.limit,
      search: req.query.search,
      createdBy: agent.username,
      customerOnly: true,
    });
    res.json(result);
  } catch (err) {
    console.error('Error listing support access codes:', err);
    res.status(500).json({ error: 'Failed to list codes' });
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
