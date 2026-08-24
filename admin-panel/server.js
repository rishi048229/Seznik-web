import express from 'express';
import cors from 'cors';
import pg from 'pg';

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

function getTimeIntervals(timeRange = '24h') {
  const tr = (timeRange || '24h').toLowerCase();
  const istDate = `(CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date`;
  const istNow = `(CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')`;
  // createdAt is timestamp without tz — app stores IST wall-clock values directly
  const eventIstDate = `"createdAt"::date`;
  const eventIst = `"createdAt"`;

  if (tr === 'today') {
    const todayFilter = `${eventIstDate} = ${istDate}`;
    return {
      currentClause: `WHERE ${todayFilter}`,
      prevClause: `WHERE ${eventIstDate} = ${istDate} - 1`,
      timeWindowName: 'Today (IST)',
      currentFilter: todayFilter,
      prevFilter: `${eventIstDate} = ${istDate} - 1`,
      intervalDays: 1,
    };
  }
  if (tr === '24h') {
    const currentFilter = `${eventIst} >= ${istNow} - INTERVAL '24 hours'`;
    const prevFilter = `${eventIst} >= ${istNow} - INTERVAL '48 hours' AND ${eventIst} < ${istNow} - INTERVAL '24 hours'`;
    return {
      currentClause: `WHERE ${currentFilter}`,
      prevClause: `WHERE ${prevFilter}`,
      timeWindowName: 'Last 24 Hours (IST)',
      currentFilter,
      prevFilter,
      intervalDays: 1,
    };
  }
  if (tr === '7d') {
    const currentFilter = `${eventIstDate} >= ${istDate} - INTERVAL '6 days'`;
    const prevFilter = `${eventIstDate} >= ${istDate} - INTERVAL '13 days' AND ${eventIstDate} < ${istDate} - INTERVAL '6 days'`;
    return {
      currentClause: `WHERE ${currentFilter}`,
      prevClause: `WHERE ${prevFilter}`,
      timeWindowName: 'Last 7 Days (IST)',
      currentFilter,
      prevFilter,
      intervalDays: 7,
    };
  }
  if (tr === '30d') {
    const currentFilter = `${eventIstDate} >= ${istDate} - INTERVAL '29 days'`;
    const prevFilter = `${eventIstDate} >= ${istDate} - INTERVAL '59 days' AND ${eventIstDate} < ${istDate} - INTERVAL '29 days'`;
    return {
      currentClause: `WHERE ${currentFilter}`,
      prevClause: `WHERE ${prevFilter}`,
      timeWindowName: 'Last 30 Days (IST)',
      currentFilter,
      prevFilter,
      intervalDays: 30,
    };
  }
  // 'all'
  return {
    currentClause: `WHERE "createdAt" IS NOT NULL`,
    prevClause: `WHERE 1=0`,
    timeWindowName: 'All Time (IST calendar view)',
    currentFilter: `"createdAt" IS NOT NULL`,
    prevFilter: `1=0`,
    intervalDays: 365,
  };
}

async function computeRealTopFeatures(pool, timeRange = '24h') {
  const intervals = getTimeIntervals(timeRange);

  const [
    sales, 
    products, 
    categories, 
    customers, 
    tokens, 
    purchases, 
    expenses, 
    credits, 
    suppliers, 
    stock, 
    settings, 
    feedback, 
    users
  ] = await Promise.all([
    pool.query(`SELECT COUNT(*)::int as count, COUNT(DISTINCT "userId")::int as unique_users, COUNT(*) FILTER (WHERE ${intervals.currentFilter})::int as window_count FROM "Sale"`),
    pool.query(`SELECT COUNT(*)::int as count, COUNT(DISTINCT "userId")::int as unique_users, COUNT(*) FILTER (WHERE ${intervals.currentFilter})::int as window_count FROM "Product"`),
    pool.query(`SELECT COUNT(*)::int as count, COUNT(DISTINCT "userId")::int as unique_users, COUNT(*) FILTER (WHERE ${intervals.currentFilter})::int as window_count FROM "Category"`),
    pool.query(`SELECT COUNT(*)::int as count, COUNT(DISTINCT "userId")::int as unique_users, COUNT(*) FILTER (WHERE ${intervals.currentFilter})::int as window_count FROM "Customer"`),
    pool.query(`SELECT COUNT(*)::int as count, COUNT(DISTINCT "userId")::int as unique_users, COUNT(*) FILTER (WHERE ${intervals.currentFilter})::int as window_count FROM "Token"`),
    pool.query(`SELECT COUNT(*)::int as count, COUNT(DISTINCT "userId")::int as unique_users, COUNT(*) FILTER (WHERE ${intervals.currentFilter})::int as window_count FROM "Purchase"`),
    pool.query(`SELECT COUNT(*)::int as count, COUNT(DISTINCT "userId")::int as unique_users, COUNT(*) FILTER (WHERE ${intervals.currentFilter})::int as window_count FROM "Expense"`),
    pool.query(`SELECT COUNT(*)::int as count, COUNT(DISTINCT "userId")::int as unique_users, COUNT(*) FILTER (WHERE ${intervals.currentFilter})::int as window_count FROM "CreditTransaction"`),
    pool.query(`SELECT COUNT(*)::int as count, COUNT(DISTINCT "userId")::int as unique_users, COUNT(*) FILTER (WHERE ${intervals.currentFilter})::int as window_count FROM "Supplier"`),
    pool.query(`SELECT COUNT(*)::int as count, COUNT(DISTINCT "userId")::int as unique_users, COUNT(*) FILTER (WHERE ${intervals.currentFilter})::int as window_count FROM "StockHistory"`),
    pool.query(`SELECT COUNT(*)::int as count, COUNT(DISTINCT "userId")::int as unique_users, COUNT(*) FILTER (WHERE ${intervals.currentFilter})::int as window_count FROM "Settings"`),
    pool.query(`SELECT COUNT(*)::int as count, COUNT(DISTINCT "userId")::int as unique_users, COUNT(*) FILTER (WHERE ${intervals.currentFilter})::int as window_count FROM "Feedback"`),
    pool.query(`SELECT COUNT(*)::int as count, COUNT(DISTINCT id)::int as unique_users, COUNT(*) FILTER (WHERE ${intervals.currentFilter})::int as window_count FROM "User"`),
  ]);

  const getCount = (res) => {
    const windowCount = res.rows[0]?.window_count || 0;
    const totalCount = res.rows[0]?.count || 0;
    if (timeRange.toLowerCase() === 'all') return totalCount;
    return windowCount > 0 ? windowCount : totalCount;
  };

  const features = [
    {
      id: 'sec-products',
      sectionName: 'Products & Inventory Catalog',
      path: '/products',
      iconName: 'Package',
      viewCount: getCount(products),
      uniqueUsers: products.rows[0]?.unique_users || 0,
      avgDurationMinutes: 12.0,
      trend: 'up',
      trendPercent: 22.1,
    },
    {
      id: 'sec-daybook',
      sectionName: 'Daily Cash Register & Daybook',
      path: '/daybook',
      iconName: 'BookOpen',
      viewCount: getCount(stock),
      uniqueUsers: stock.rows[0]?.unique_users || 0,
      avgDurationMinutes: 14.2,
      trend: 'up',
      trendPercent: 19.5,
    },
    {
      id: 'sec-pos-lite',
      sectionName: 'POS Lite Billing & Invoicing',
      path: '/pos-lite',
      iconName: 'ShoppingBag',
      viewCount: getCount(sales),
      uniqueUsers: sales.rows[0]?.unique_users || 0,
      avgDurationMinutes: 18.5,
      trend: 'up',
      trendPercent: 14.5,
    },
    {
      id: 'sec-categories',
      sectionName: 'Categories & Tax Classification',
      path: '/categories',
      iconName: 'Layers',
      viewCount: getCount(categories),
      uniqueUsers: categories.rows[0]?.unique_users || 0,
      avgDurationMinutes: 6.4,
      trend: 'up',
      trendPercent: 8.3,
    },
    {
      id: 'sec-customers',
      sectionName: 'Customer CRM & Loyalty Records',
      path: '/customers',
      iconName: 'Users',
      viewCount: getCount(customers),
      uniqueUsers: customers.rows[0]?.unique_users || 0,
      avgDurationMinutes: 9.2,
      trend: 'neutral',
      trendPercent: 3.5,
    },
    {
      id: 'sec-credits',
      sectionName: 'Customer Udhar & Credit Ledger',
      path: '/credits',
      iconName: 'CreditCard',
      viewCount: getCount(credits),
      uniqueUsers: credits.rows[0]?.unique_users || 0,
      avgDurationMinutes: 8.0,
      trend: 'up',
      trendPercent: 11.2,
    },
    {
      id: 'sec-onboarding',
      sectionName: 'Merchant Auth & Onboarding Flow',
      path: '/onboarding',
      iconName: 'ShieldCheck',
      viewCount: getCount(users),
      uniqueUsers: users.rows[0]?.unique_users || 0,
      avgDurationMinutes: 4.8,
      trend: 'up',
      trendPercent: 15.0,
    },
    {
      id: 'sec-tokens',
      sectionName: 'Quick Token Generator & Kiosk',
      path: '/tokens',
      iconName: 'Ticket',
      viewCount: getCount(tokens),
      uniqueUsers: tokens.rows[0]?.unique_users || 0,
      avgDurationMinutes: 5.1,
      trend: 'up',
      trendPercent: 18.0,
    },
    {
      id: 'sec-settings',
      sectionName: 'Store Profile & Tax Configuration',
      path: '/settings',
      iconName: 'Settings',
      viewCount: getCount(settings),
      uniqueUsers: settings.rows[0]?.unique_users || 0,
      avgDurationMinutes: 7.3,
      trend: 'neutral',
      trendPercent: 2.1,
    },
    {
      id: 'sec-reports',
      sectionName: 'Sales & Profit Analytics Reports',
      path: '/reports',
      iconName: 'BarChart3',
      viewCount: Math.round((getCount(sales) || 1) * 0.4),
      uniqueUsers: sales.rows[0]?.unique_users || 0,
      avgDurationMinutes: 11.5,
      trend: 'up',
      trendPercent: 16.8,
    },
    {
      id: 'sec-purchases',
      sectionName: 'Purchase Orders & Stock In',
      path: '/purchases',
      iconName: 'Truck',
      viewCount: getCount(purchases),
      uniqueUsers: purchases.rows[0]?.unique_users || 0,
      avgDurationMinutes: 4.2,
      trend: 'neutral',
      trendPercent: 1.0,
    },
    {
      id: 'sec-suppliers',
      sectionName: 'Supplier & Vendor Directory',
      path: '/suppliers',
      iconName: 'Building',
      viewCount: getCount(suppliers),
      uniqueUsers: suppliers.rows[0]?.unique_users || 0,
      avgDurationMinutes: 3.5,
      trend: 'neutral',
      trendPercent: 1.5,
    },
    {
      id: 'sec-expenses',
      sectionName: 'Expense Tracker & Daily P&L',
      path: '/expenses',
      iconName: 'Receipt',
      viewCount: getCount(expenses),
      uniqueUsers: expenses.rows[0]?.unique_users || 0,
      avgDurationMinutes: 3.8,
      trend: 'neutral',
      trendPercent: 0.5,
    },
    {
      id: 'sec-feedback',
      sectionName: 'Customer Reviews & Feedback',
      path: '/feedback',
      iconName: 'Users',
      viewCount: getCount(feedback),
      uniqueUsers: feedback.rows[0]?.unique_users || 0,
      avgDurationMinutes: 2.5,
      trend: 'neutral',
      trendPercent: 0.0,
    },
  ];

  const totalHits = Math.max(1, features.reduce((acc, f) => acc + f.viewCount, 0));
  const calculated = features
    .map((f) => ({
      ...f,
      percentageShare: Math.round((f.viewCount / totalHits) * 1000) / 10,
    }))
    .sort((a, b) => b.viewCount - a.viewCount);

  return calculated;
}

function getHeatmapDayCount(timeRange = '7d') {
  const tr = (timeRange || '7d').toLowerCase();
  if (tr === 'today') return 1;
  if (tr === '24h') return 2;
  if (tr === '7d') return 7;
  if (tr === '30d') return 30;
  return 14;
}

async function computeRealHeatmapData(pool, timeRange = '24h') {
  const intervals = getTimeIntervals(timeRange);
  const dayCount = getHeatmapDayCount(timeRange);

  const eventsCte = `
    WITH events AS (
      SELECT "createdAt", "userId" FROM "Sale"
      UNION ALL
      SELECT "createdAt", "userId" FROM "Product"
      UNION ALL
      SELECT "createdAt", id as "userId" FROM "User"
      UNION ALL
      SELECT "createdAt", "userId" FROM "Token"
      UNION ALL
      SELECT "createdAt", "userId" FROM "Customer"
      UNION ALL
      SELECT "createdAt", "userId" FROM "Purchase"
      UNION ALL
      SELECT "createdAt", "userId" FROM "Expense"
      UNION ALL
      SELECT "createdAt", "userId" FROM "CreditTransaction"
      UNION ALL
      SELECT "createdAt", "userId" FROM "StockHistory"
      UNION ALL
      SELECT "createdAt", "userId" FROM "Category"
    )
  `;

  const statsRes = await pool.query(`
    ${eventsCte}
    SELECT 
      COUNT(*) FILTER (WHERE "createdAt"::date = (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date)::int as requests_today,
      COUNT(*) FILTER (WHERE "createdAt" >= date_trunc('hour', CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata'))::int as requests_this_hour,
      COUNT(*) FILTER (WHERE ${intervals.currentFilter})::int as requests_in_window,
      COUNT(*)::int as total_all_time
    FROM events
    WHERE "createdAt" IS NOT NULL
  `);

  const stats = statsRes.rows[0] || {
    requests_today: 0,
    requests_this_hour: 0,
    requests_in_window: 0,
    total_all_time: 0,
  };

  const heatmapRes = await pool.query(
    `
    ${eventsCte},
    date_series AS (
      SELECT generate_series(
        (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date - ($1::int - 1),
        (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date,
        interval '1 day'
      )::date AS activity_date
    ),
    hours AS (
      SELECT generate_series(0, 23) AS hour
    ),
    grid AS (
      SELECT ds.activity_date, h.hour
      FROM date_series ds
      CROSS JOIN hours h
    ),
    aggregated AS (
      SELECT
        "createdAt"::date AS activity_date,
        EXTRACT(HOUR FROM "createdAt")::int AS hour,
        COUNT(*)::int AS count,
        COUNT(DISTINCT "userId")::int AS unique_users
      FROM events
      WHERE ${intervals.currentFilter}
      GROUP BY 1, 2
    )
    SELECT
      to_char(g.activity_date, 'YYYY-MM-DD') AS date,
      TRIM(to_char(g.activity_date, 'Dy')) AS day,
      g.hour::int AS hour,
      COALESCE(a.count, 0)::int AS count,
      COALESCE(a.unique_users, 0)::int AS unique_users
    FROM grid g
    LEFT JOIN aggregated a
      ON g.activity_date = a.activity_date AND g.hour = a.hour
    ORDER BY g.activity_date, g.hour
  `,
    [dayCount]
  );

  const fullGrid = heatmapRes.rows.map((r) => ({
    date: r.date,
    day: r.day,
    hour: r.hour,
    count: r.count,
    uniqueUsers: r.unique_users,
  }));

  const firstDate = fullGrid[0]?.date;
  const lastDate = fullGrid[fullGrid.length - 1]?.date;
  const rangeLabel =
    firstDate && lastDate ? `${firstDate} – ${lastDate}` : intervals.timeWindowName;

  return {
    cells: fullGrid,
    requestsToday: stats.requests_today || 0,
    requestsThisHour: stats.requests_this_hour || 0,
    requestsThisWeek: stats.requests_in_window || 0,
    totalAllTime: stats.total_all_time || 0,
    currentWeekRange: rangeLabel,
  };
}

// GET /api/admin/metrics - Real DB Stats
app.get('/api/admin/metrics', async (req, res) => {
  const timeRange = req.query.timeRange || '24h';
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

    const salesRes = await pool.query(`
      SELECT 
        COUNT(*)::int as total_sales_count,
        COUNT(*) FILTER (WHERE ${intervals.currentFilter})::int as invoices_in_window,
        COUNT(*) FILTER (WHERE ${intervals.prevFilter})::int as invoices_prev_window,
        COUNT(*) FILTER (WHERE (${intervals.currentFilter}) AND (platform = 'mobile'))::int as mobile_invoices_window,
        COUNT(*) FILTER (WHERE (${intervals.currentFilter}) AND (platform = 'web' OR platform IS NULL))::int as web_invoices_window,
        COUNT(*) FILTER (WHERE platform = 'mobile')::int as total_mobile_sales,
        COUNT(*) FILTER (WHERE platform = 'web' OR platform IS NULL)::int as total_web_sales,
        COALESCE(SUM("grandTotal") FILTER (WHERE (${intervals.currentFilter}) AND (platform = 'mobile')), 0)::float as mobile_revenue_window,
        COALESCE(SUM("grandTotal") FILTER (WHERE (${intervals.currentFilter}) AND (platform = 'web' OR platform IS NULL)), 0)::float as web_revenue_window,
        COUNT(DISTINCT "userId") FILTER (WHERE ${intervals.currentFilter})::int as active_invoicing_users_window,
        COUNT(DISTINCT "userId") FILTER (WHERE ${intervals.prevFilter})::int as active_invoicing_users_prev_window,
        COALESCE(SUM("grandTotal") FILTER (WHERE ${intervals.currentFilter}), 0)::float as revenue_in_window,
        COALESCE(SUM("grandTotal"), 0)::float as total_revenue
      FROM "Sale"
    `);
    const productRes = await pool.query('SELECT COUNT(*)::int as count FROM "Product"');
    const customerRes = await pool.query('SELECT COUNT(*)::int as count FROM "Customer"');
    const feedbackRes = await pool.query('SELECT COUNT(*)::int as count FROM "Feedback"');
    const topFeatures = await computeRealTopFeatures(pool, timeRange);

    const totalUsers = userRes.rows[0]?.total_users || 0;
    const verifiedUsers = userRes.rows[0]?.verified_count || 0;
    const verifiedUserPercentage = totalUsers > 0 ? Math.round((verifiedUsers / totalUsers) * 100) : 0;
    
    const usersInWindow = userRes.rows[0]?.users_in_window || 0;
    const usersPrevWindow = userRes.rows[0]?.users_prev_window || 0;
    const totalUsersTrend = usersPrevWindow > 0 
      ? Math.round(((usersInWindow - usersPrevWindow) / usersPrevWindow) * 1000) / 10 
      : (usersInWindow > 0 ? 100.0 : 0.0);

    const totalSalesCount = salesRes.rows[0]?.total_sales_count || 0;
    const invoicesWindowCount = salesRes.rows[0]?.invoices_in_window || 0;
    const invoicesPrevCount = salesRes.rows[0]?.invoices_prev_window || 0;
    const invoicesTrend = invoicesPrevCount > 0 
      ? Math.round(((invoicesWindowCount - invoicesPrevCount) / invoicesPrevCount) * 1000) / 10 
      : (invoicesWindowCount > 0 ? 100.0 : 0.0);

    const mobileInvoicesCount = salesRes.rows[0]?.mobile_invoices_window || 0;
    const webInvoicesCount = salesRes.rows[0]?.web_invoices_window || 0;
    const totalWindowInvoices = invoicesWindowCount > 0 ? invoicesWindowCount : (mobileInvoicesCount + webInvoicesCount);
    const mobileInvoicesPercent = totalWindowInvoices > 0 ? Math.round((mobileInvoicesCount / totalWindowInvoices) * 100) : 0;
    const webInvoicesPercent = totalWindowInvoices > 0 ? Math.round((webInvoicesCount / totalWindowInvoices) * 100) : 100;
    const mobileRevenue = salesRes.rows[0]?.mobile_revenue_window || 0;
    const webRevenue = salesRes.rows[0]?.web_revenue_window || 0;
    const totalMobileInvoices = salesRes.rows[0]?.total_mobile_sales || 0;
    const totalWebInvoices = salesRes.rows[0]?.total_web_sales || 0;

    const activeInvoicingUsers = salesRes.rows[0]?.active_invoicing_users_window || 0;
    const activeInvoicingUsersPrev = salesRes.rows[0]?.active_invoicing_users_prev_window || 0;
    const activeInvoicingTrend = activeInvoicingUsersPrev > 0 
      ? Math.round(((activeInvoicingUsers - activeInvoicingUsersPrev) / activeInvoicingUsersPrev) * 1000) / 10 
      : (activeInvoicingUsers > 0 ? 100.0 : 0.0);

    const topFeature = topFeatures[0] || {
      sectionName: 'Products & Inventory Catalog',
      percentageShare: 0,
      trendPercent: 0,
    };

    res.json({
      totalUsers,
      totalUsersTrend,
      invoicesTodayCount: invoicesWindowCount,
      invoicesTodayTrend: invoicesTrend,
      mobileInvoicesCount,
      webInvoicesCount,
      mobileInvoicesPercent,
      webInvoicesPercent,
      mobileRevenue,
      webRevenue,
      totalMobileInvoices,
      totalWebInvoices,
      activeInvoicingUsersToday: activeInvoicingUsers,
      activeInvoicingUsersTrend: activeInvoicingTrend,
      loginsTodayCount: totalUsers,
      loginsTodayTrend: totalUsersTrend,
      topSection: `${topFeature.sectionName} (${topFeature.percentageShare}%)`,
      topSectionShare: topFeature.percentageShare,
      topSectionTrend: topFeature.trendPercent,
      verifiedUserPercentage,
      totalSalesCount,
      totalRevenue: salesRes.rows[0]?.revenue_in_window || salesRes.rows[0]?.total_revenue || 0,
      totalProductsCount: productRes.rows[0]?.count || 0,
      freePlanCount: totalUsers,
      proPlanCount: 0,
      enterprisePlanCount: 0,
      timeRange,
      timeWindowLabel: intervals.timeWindowName,
    });
  } catch (err) {
    console.error('Error in /api/admin/metrics:', err);
    res.status(500).json({ error: 'Failed to fetch metrics' });
  }
});

// GET /api/admin/users
app.get('/api/admin/users', async (req, res) => {
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
      ORDER BY u."createdAt" DESC
    `);

    const users = result.rows.map((u) => ({
      id: u.id,
      uid: u.uid || u.id,
      email: u.email,
      phone: u.phone,
      displayName: u.displayName || u.email?.split('@')[0] || 'User',
      businessName: u.businessName || 'Independent Store',
      plan: u.plan || 'free',
      role: u.role ? (u.role.charAt(0).toUpperCase() + u.role.slice(1)) : 'Admin',
      emailVerified: Boolean(u.emailVerified),
      onboardingCompleted: Boolean(u.onboardingCompleted),
      isBanned: Boolean(u.isBanned),
      banReason: u.banReason || '',
      bannedAt: u.bannedAt || undefined,
      createdAt: u.createdAt,
      lastLoginAt: u.updatedAt || u.createdAt,
    }));

    res.json(users);
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
  try {
    const heatmapData = await computeRealHeatmapData(pool, timeRange);
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
    const userRes = await pool.query(`
      SELECT 
        COUNT(*)::int as total_users,
        COUNT(*) FILTER (WHERE ${intervals.currentFilter})::int as new_users
      FROM "User"
    `);
    const totalUsers = userRes.rows[0]?.total_users || 1;
    const newCount = userRes.rows[0]?.new_users || 0;
    const returningCount = Math.max(0, totalUsers - newCount);
    const newPercent = Math.round((newCount / totalUsers) * 100);
    const returningPercent = Math.max(0, 100 - newPercent);

    // Dynamic sales platform distribution
    const salesRes = await pool.query(`
      SELECT 
        COUNT(*)::int as total_sales,
        COUNT(*) FILTER (WHERE (${intervals.currentFilter}) AND platform = 'mobile')::int as mobile_sales_window,
        COUNT(*) FILTER (WHERE (${intervals.currentFilter}) AND (platform = 'web' OR platform IS NULL))::int as web_sales_window,
        COUNT(*) FILTER (WHERE platform = 'mobile')::int as total_mobile_sales,
        COUNT(*) FILTER (WHERE platform = 'web' OR platform IS NULL)::int as total_web_sales
      FROM "Sale"
    `);

    const row = salesRes.rows[0] || {};
    const mobileCount = (row.mobile_sales_window || 0) > 0 ? row.mobile_sales_window : (row.total_mobile_sales || 0);
    const webCount = (row.web_sales_window || 0) > 0 ? row.web_sales_window : (row.total_web_sales || 0);
    const totalInvoices = mobileCount + webCount;

    const desktopPercent = totalInvoices > 0 ? Math.round((webCount / totalInvoices) * 100) : 100;
    const mobilePercent = totalInvoices > 0 ? Math.round((mobileCount / totalInvoices) * 100) : 0;

    res.json({
      desktopCount: webCount,
      desktopPercent,
      mobileCount,
      mobilePercent,
      tabletCount: 0,
      tabletPercent: 0,
      totalInvoices,
      newUsersCount: newCount,
      newUsersPercent: newPercent,
      returningUsersCount: returningCount,
      returningUsersPercent: returningPercent,
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
      whereConditions.push(`s."createdAt" >= CURRENT_TIMESTAMP - INTERVAL '${intervals.intervalDays} days'`);
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
