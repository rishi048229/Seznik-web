/** Shared admin analytics helpers (used by server.js + vite dev middleware). */

const IST_TZ = 'Asia/Kolkata';

/**
 * Prisma DateTime is TIMESTAMP(3) without time zone, stored in UTC.
 * Convert to IST wall-clock before taking ::date / EXTRACT(HOUR), otherwise
 * the heatmap (and "today" / "this hour" stats) stop around UTC noon and
 * never show later IST activity.
 */
const IST_NOW_SQL = `(CURRENT_TIMESTAMP AT TIME ZONE '${IST_TZ}')`;
const IST_DATE_SQL = `${IST_NOW_SQL}::date`;
const EVENT_IST_SQL = `(("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE '${IST_TZ}')`;
const EVENT_IST_DATE_SQL = `${EVENT_IST_SQL}::date`;

export function getTimeIntervals(timeRange = 'all') {
  const tr = (timeRange || 'all').toLowerCase();
  const istDate = IST_DATE_SQL;
  const istNow = IST_NOW_SQL;
  const eventIstDate = EVENT_IST_DATE_SQL;
  const eventIst = EVENT_IST_SQL;

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
  if (tr === '3d') {
    const currentFilter = `${eventIstDate} >= ${istDate} - INTERVAL '2 days'`;
    const prevFilter = `${eventIstDate} >= ${istDate} - INTERVAL '5 days' AND ${eventIstDate} < ${istDate} - INTERVAL '2 days'`;
    return {
      currentClause: `WHERE ${currentFilter}`,
      prevClause: `WHERE ${prevFilter}`,
      timeWindowName: 'Last 3 Days (IST)',
      currentFilter,
      prevFilter,
      intervalDays: 3,
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
  return {
    currentClause: `WHERE "createdAt" IS NOT NULL`,
    prevClause: `WHERE 1=0`,
    timeWindowName: 'All Time',
    currentFilter: `"createdAt" IS NOT NULL`,
    prevFilter: `1=0`,
    intervalDays: 365,
  };
}

export function applyTableAlias(filter, alias) {
  return filter.replace(/"createdAt"/g, `${alias}."createdAt"`);
}

export function getWindowCount(row, timeRange) {
  if ((timeRange || '').toLowerCase() === 'all') return row?.count || 0;
  return row?.window_count || 0;
}

export function computeTrendPercent(current, prev) {
  if (prev > 0) return Math.round(((current - prev) / prev) * 1000) / 10;
  return current > 0 ? 100.0 : 0.0;
}

export function trendDirection(percent) {
  if (percent > 0) return 'up';
  if (percent < 0) return 'down';
  return 'neutral';
}

function activityCountSql(intervals, table, userIdExpr = '"userId"') {
  return `SELECT
    COUNT(*)::int AS count,
    COUNT(DISTINCT ${userIdExpr}) FILTER (WHERE ${intervals.currentFilter})::int AS unique_users,
    COUNT(*) FILTER (WHERE ${intervals.currentFilter})::int AS window_count,
    COUNT(*) FILTER (WHERE ${intervals.prevFilter})::int AS prev_window_count
  FROM "${table}"`;
}

function featureFromQuery(res, timeRange, meta) {
  const row = res.rows[0] || {};
  const current = getWindowCount(row, timeRange);
  const prev = row.prev_window_count || 0;
  const trendPercent = computeTrendPercent(current, prev);
  return {
    ...meta,
    viewCount: current,
    uniqueUsers: row.unique_users || 0,
    trend: trendDirection(trendPercent),
    trendPercent,
  };
}

export async function computeRealTopFeatures(pool, timeRange = 'all') {
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
    users,
    dayClose,
  ] = await Promise.all([
    pool.query(activityCountSql(intervals, 'Sale')),
    pool.query(activityCountSql(intervals, 'Product')),
    pool.query(activityCountSql(intervals, 'Category')),
    pool.query(activityCountSql(intervals, 'Customer')),
    pool.query(activityCountSql(intervals, 'Token')),
    pool.query(activityCountSql(intervals, 'Purchase')),
    pool.query(activityCountSql(intervals, 'Expense')),
    pool.query(activityCountSql(intervals, 'CreditTransaction')),
    pool.query(activityCountSql(intervals, 'Supplier')),
    pool.query(activityCountSql(intervals, 'StockHistory')),
    pool.query(activityCountSql(intervals, 'Settings')),
    pool.query(activityCountSql(intervals, 'Feedback')),
    pool.query(activityCountSql(intervals, 'User', 'id')),
    pool.query(activityCountSql(intervals, 'DayClose')).catch(() => ({ rows: [{ count: 0, unique_users: 0, window_count: 0, prev_window_count: 0 }] })),
  ]);

  const features = [
    featureFromQuery(products, timeRange, { id: 'sec-products', sectionName: 'Products & Inventory Catalog', path: '/products', iconName: 'Package' }),
    featureFromQuery(stock, timeRange, { id: 'sec-daybook', sectionName: 'Daily Cash Register & Daybook', path: '/daybook', iconName: 'BookOpen' }),
    featureFromQuery(sales, timeRange, { id: 'sec-pos-lite', sectionName: 'POS Lite Billing & Invoicing', path: '/pos-lite', iconName: 'ShoppingBag' }),
    featureFromQuery(categories, timeRange, { id: 'sec-categories', sectionName: 'Categories & Tax Classification', path: '/categories', iconName: 'Layers' }),
    featureFromQuery(customers, timeRange, { id: 'sec-customers', sectionName: 'Customer CRM & Loyalty Records', path: '/customers', iconName: 'Users' }),
    featureFromQuery(credits, timeRange, { id: 'sec-credits', sectionName: 'Customer Credit Ledger', path: '/credits', iconName: 'CreditCard' }),
    featureFromQuery(users, timeRange, { id: 'sec-onboarding', sectionName: 'Merchant Auth & Onboarding Flow', path: '/onboarding', iconName: 'ShieldCheck' }),
    featureFromQuery(tokens, timeRange, { id: 'sec-tokens', sectionName: 'Quick Token Generator & Kiosk', path: '/tokens', iconName: 'Ticket' }),
    featureFromQuery(settings, timeRange, { id: 'sec-settings', sectionName: 'Store Profile & Tax Configuration', path: '/settings', iconName: 'Settings' }),
    featureFromQuery(dayClose, timeRange, { id: 'sec-reports', sectionName: 'Sales & Profit Analytics Reports', path: '/reports', iconName: 'BarChart3' }),
    featureFromQuery(purchases, timeRange, { id: 'sec-purchases', sectionName: 'Purchase Orders & Stock In', path: '/purchases', iconName: 'Truck' }),
    featureFromQuery(suppliers, timeRange, { id: 'sec-suppliers', sectionName: 'Supplier & Vendor Directory', path: '/suppliers', iconName: 'Building' }),
    featureFromQuery(expenses, timeRange, { id: 'sec-expenses', sectionName: 'Expense Tracker & Daily P&L', path: '/expenses', iconName: 'Receipt' }),
    featureFromQuery(feedback, timeRange, { id: 'sec-feedback', sectionName: 'Customer Reviews & Feedback', path: '/feedback', iconName: 'Users' }),
  ];

  const totalHits = features.reduce((acc, f) => acc + f.viewCount, 0);
  return features
    .map((f) => ({
      ...f,
      percentageShare: totalHits > 0 ? Math.round((f.viewCount / totalHits) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.viewCount - a.viewCount);
}

export function getHeatmapDayCount(timeRange = '3d') {
  const tr = (timeRange || '3d').toLowerCase();
  if (tr === 'today' || tr === '24h') return 1;
  if (tr === '3d') return 3;
  if (tr === '7d') return 7;
  if (tr === '30d') return 30;
  return 3;
}

export function getUsersWhereClause(timeRange = 'all') {
  const tr = (timeRange || 'all').toLowerCase();
  if (tr === 'all') return '';
  const intervals = getTimeIntervals(timeRange);
  return `WHERE ${applyTableAlias(intervals.currentFilter, 'u')}`;
}

export function mapUserRows(rows) {
  return rows.map((u) => ({
    id: u.id,
    uid: u.uid || u.id,
    email: u.email,
    phone: u.phone,
    displayName: u.displayName || u.email?.split('@')[0] || 'User',
    businessName: u.businessName || 'Independent Store',
    plan: u.plan || 'free',
    role: u.role ? u.role.charAt(0).toUpperCase() + u.role.slice(1) : 'Admin',
    emailVerified: Boolean(u.emailVerified),
    onboardingCompleted: Boolean(u.onboardingCompleted),
    isBanned: Boolean(u.isBanned),
    banReason: u.banReason || '',
    bannedAt: u.bannedAt || undefined,
    createdAt: u.createdAt,
    lastUpdatedAt: u.updatedAt || u.createdAt,
    lastLoginAt: u.updatedAt || u.createdAt,
  }));
}

export function buildMetricsResponse({ userRes, salesRes, productRes, topFeatures, timeRange, intervals }) {
  const isAllTime = (timeRange || '').toLowerCase() === 'all';

  const totalUsersAllTime = userRes.rows[0]?.total_users || 0;
  const verifiedUsers = userRes.rows[0]?.verified_count || 0;
  const verifiedUserPercentage = totalUsersAllTime > 0 ? Math.round((verifiedUsers / totalUsersAllTime) * 100) : 0;

  const usersInWindow = userRes.rows[0]?.users_in_window || 0;
  const usersPrevWindow = userRes.rows[0]?.users_prev_window || 0;
  const totalUsersTrend = computeTrendPercent(usersInWindow, usersPrevWindow);
  const totalUsers = isAllTime ? totalUsersAllTime : usersInWindow;

  const totalSalesCount = salesRes.rows[0]?.total_sales_count || 0;
  const invoicesWindowCount = salesRes.rows[0]?.invoices_in_window || 0;
  const invoicesPrevCount = salesRes.rows[0]?.invoices_prev_window || 0;
  const invoicesTrend = computeTrendPercent(invoicesWindowCount, invoicesPrevCount);

  const mobileInvoicesWindow = salesRes.rows[0]?.mobile_invoices_window || 0;
  const webInvoicesWindow = salesRes.rows[0]?.web_invoices_window || 0;
  const totalMobileInvoices = salesRes.rows[0]?.total_mobile_sales || 0;
  const totalWebInvoices = salesRes.rows[0]?.total_web_sales || 0;
  const totalActiveMerchants = salesRes.rows[0]?.total_active_merchants || 0;

  const activeInvoicingUsers = salesRes.rows[0]?.active_invoicing_users_window || 0;
  const activeInvoicingUsersPrev = salesRes.rows[0]?.active_invoicing_users_prev_window || 0;
  const activeInvoicingTrend = computeTrendPercent(activeInvoicingUsers, activeInvoicingUsersPrev);

  const displayInvoices = isAllTime ? totalSalesCount : invoicesWindowCount;
  const displayMobile = isAllTime ? totalMobileInvoices : mobileInvoicesWindow;
  const displayWeb = isAllTime ? totalWebInvoices : webInvoicesWindow;
  const displayMerchants = isAllTime ? totalActiveMerchants : activeInvoicingUsers;
  const invoiceDenom = displayInvoices > 0 ? displayInvoices : displayMobile + displayWeb;
  const mobileInvoicesPercent = invoiceDenom > 0 ? Math.round((displayMobile / invoiceDenom) * 100) : 0;
  const webInvoicesPercent = invoiceDenom > 0 ? Math.round((displayWeb / invoiceDenom) * 100) : 100;

  const topFeature = topFeatures[0] || {
    sectionName: 'Products & Inventory Catalog',
    percentageShare: 0,
    trendPercent: 0,
  };

  return {
    totalUsers,
    totalUsersTrend: isAllTime ? 0 : totalUsersTrend,
    invoicesTodayCount: displayInvoices,
    invoicesTodayTrend: isAllTime ? 0 : invoicesTrend,
    mobileInvoicesCount: displayMobile,
    webInvoicesCount: displayWeb,
    mobileInvoicesPercent,
    webInvoicesPercent,
    mobileRevenue: salesRes.rows[0]?.mobile_revenue_window || 0,
    webRevenue: salesRes.rows[0]?.web_revenue_window || 0,
    totalMobileInvoices,
    totalWebInvoices,
    activeInvoicingUsersToday: displayMerchants,
    activeInvoicingUsersTrend: isAllTime ? 0 : activeInvoicingTrend,
    topSection: `${topFeature.sectionName} (${topFeature.percentageShare}%)`,
    topSectionShare: topFeature.percentageShare,
    topSectionTrend: topFeature.trendPercent,
    verifiedUserPercentage,
    totalSalesCount,
    totalRevenue: isAllTime
      ? salesRes.rows[0]?.total_revenue || 0
      : salesRes.rows[0]?.revenue_in_window || salesRes.rows[0]?.total_revenue || 0,
    totalProductsCount: productRes.rows[0]?.count || 0,
    timeRange,
    timeWindowLabel: isAllTime ? 'All Time' : intervals.timeWindowName,
  };
}

export async function computeRealHeatmapData(pool, timeRange = '3d', dayCountOverride) {
  const dayCount = dayCountOverride ?? 3;

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

  const statsRes = await pool.query(
    `
    ${eventsCte}
    SELECT 
      COUNT(*) FILTER (WHERE ${EVENT_IST_DATE_SQL} = ${IST_DATE_SQL})::int as activity_today,
      COUNT(*) FILTER (WHERE ${EVENT_IST_SQL} >= date_trunc('hour', ${IST_NOW_SQL}))::int as activity_this_hour,
      COUNT(*) FILTER (WHERE ${EVENT_IST_DATE_SQL} >= ${IST_DATE_SQL} - ($1::int - 1) AND ${EVENT_IST_DATE_SQL} <= ${IST_DATE_SQL})::int as activity_in_window,
      COUNT(*)::int as total_all_time
    FROM events
    WHERE "createdAt" IS NOT NULL
  `,
    [dayCount]
  );

  const stats = statsRes.rows[0] || {
    activity_today: 0,
    activity_this_hour: 0,
    activity_in_window: 0,
    total_all_time: 0,
  };

  const heatmapRes = await pool.query(
    `
    ${eventsCte},
    date_series AS (
      SELECT generate_series(
        ${IST_DATE_SQL} - ($1::int - 1),
        ${IST_DATE_SQL},
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
        ${EVENT_IST_DATE_SQL} AS activity_date,
        EXTRACT(HOUR FROM ${EVENT_IST_SQL})::int AS hour,
        COUNT(*)::int AS count,
        COUNT(DISTINCT "userId")::int AS unique_users
      FROM events
      WHERE ${EVENT_IST_DATE_SQL} >= ${IST_DATE_SQL} - ($1::int - 1)
        AND ${EVENT_IST_DATE_SQL} <= ${IST_DATE_SQL}
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
    firstDate && lastDate ? `${firstDate} – ${lastDate}` : 'Last 3 Days (IST)';

  return {
    cells: fullGrid,
    requestsToday: stats.activity_today || 0,
    requestsThisHour: stats.activity_this_hour || 0,
    requestsThisWeek: stats.activity_in_window || 0,
    totalAllTime: stats.total_all_time || 0,
    currentWeekRange: rangeLabel,
    hoursTimezone: 'IST',
  };
}

export const METRICS_SALES_SQL = `
  SELECT 
    COUNT(*)::int as total_sales_count,
    COUNT(*) FILTER (WHERE __CURRENT__)::int as invoices_in_window,
    COUNT(*) FILTER (WHERE __PREV__)::int as invoices_prev_window,
    COUNT(*) FILTER (WHERE (__CURRENT__) AND (platform = 'mobile'))::int as mobile_invoices_window,
    COUNT(*) FILTER (WHERE (__CURRENT__) AND (platform = 'web' OR platform IS NULL))::int as web_invoices_window,
    COUNT(*) FILTER (WHERE platform = 'mobile')::int as total_mobile_sales,
    COUNT(*) FILTER (WHERE platform = 'web' OR platform IS NULL)::int as total_web_sales,
    COALESCE(SUM("grandTotal") FILTER (WHERE (__CURRENT__) AND (platform = 'mobile')), 0)::float as mobile_revenue_window,
    COALESCE(SUM("grandTotal") FILTER (WHERE (__CURRENT__) AND (platform = 'web' OR platform IS NULL)), 0)::float as web_revenue_window,
    COUNT(DISTINCT "userId") FILTER (WHERE __CURRENT__)::int as active_invoicing_users_window,
    COUNT(DISTINCT "userId") FILTER (WHERE __PREV__)::int as active_invoicing_users_prev_window,
    COUNT(DISTINCT "userId")::int as total_active_merchants,
    COALESCE(SUM("grandTotal") FILTER (WHERE __CURRENT__), 0)::float as revenue_in_window,
    COALESCE(SUM("grandTotal"), 0)::float as total_revenue
  FROM "Sale"
`;

export function metricsSalesQuery(intervals) {
  return METRICS_SALES_SQL.replace(/__CURRENT__/g, intervals.currentFilter).replace(/__PREV__/g, intervals.prevFilter);
}

export function mapFeedbackRows(rows) {
  return rows.map((row) => ({
    id: row.id,
    area: row.area,
    rating: row.rating,
    message: row.message,
    platform: row.platform,
    productId: row.productId,
    productName: row.productName,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
    displayName: row.displayName,
    phone: row.phone,
    email: row.email,
    businessName: row.businessName,
  }));
}

export function buildFeedbackQuery(query = {}) {
  const page = Math.max(1, parseInt(query.page || '1', 10) || 1);
  const limit = Math.min(200, Math.max(1, parseInt(query.limit || '50', 10) || 50));
  const offset = (page - 1) * limit;
  const platform = String(query.platform || 'all').toLowerCase();
  const productId = String(query.productId || '').trim();
  const search = String(query.search || '').trim();

  const whereConditions = [];
  const params = [];
  let paramIndex = 1;

  if (platform === 'web' || platform === 'mobile') {
    whereConditions.push(`f.platform = $${paramIndex++}`);
    params.push(platform);
  } else if (platform === 'unknown') {
    whereConditions.push(`f.platform = $${paramIndex++}`);
    params.push('unknown');
  }

  if (productId) {
    whereConditions.push(`f."productId" = $${paramIndex++}`);
    params.push(productId);
  }

  if (search) {
    whereConditions.push(`(
      COALESCE(u."displayName", '') ILIKE $${paramIndex}
      OR COALESCE(u."businessName", '') ILIKE $${paramIndex}
      OR COALESCE(u.phone, '') ILIKE $${paramIndex}
      OR COALESCE(u.email, '') ILIKE $${paramIndex}
      OR COALESCE(f.message, '') ILIKE $${paramIndex}
      OR COALESCE(f."productName", '') ILIKE $${paramIndex}
    )`);
    params.push(`%${search}%`);
    paramIndex += 1;
  }

  const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

  const countSql = `
    SELECT COUNT(*)::int AS total
    FROM "Feedback" f
    JOIN "User" u ON u.id = f."userId"
    ${whereClause}
  `;

  const dataSql = `
    SELECT
      f.id,
      f.area,
      f.rating,
      f.message,
      f.platform,
      f."productId",
      f."productName",
      f."createdAt",
      u."displayName",
      u.phone,
      u.email,
      u."businessName"
    FROM "Feedback" f
    JOIN "User" u ON u.id = f."userId"
    ${whereClause}
    ORDER BY f."createdAt" DESC
    LIMIT $${paramIndex++} OFFSET $${paramIndex++}
  `;

  params.push(limit, offset);

  return { countSql, dataSql, params, page, limit };
}
