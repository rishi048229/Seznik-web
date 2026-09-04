/** Shared admin analytics helpers (used by server.js + vite dev middleware). */

const IST_TZ = 'Asia/Kolkata';

/** Mirrors backend/src/constants/apiFeatureCatalog.ts — keep in sync. */
export const API_FEATURE_CATALOG = [
  { id: 'auth', sectionName: 'Auth & Onboarding', routePrefix: '/api/auth', path: '/onboarding', iconName: 'ShieldCheck' },
  { id: 'products', sectionName: 'Products & Inventory', routePrefix: '/api/products', path: '/products', iconName: 'Package' },
  { id: 'categories', sectionName: 'Categories & Tax', routePrefix: '/api/categories', path: '/categories', iconName: 'Layers' },
  { id: 'sales', sectionName: 'POS Billing & Invoices', routePrefix: '/api/sales', path: '/pos-lite', iconName: 'ShoppingBag' },
  { id: 'customers', sectionName: 'Customer CRM', routePrefix: '/api/customers', path: '/customers', iconName: 'Users' },
  { id: 'credits', sectionName: 'Credit Ledger', routePrefix: '/api/credits', path: '/credits', iconName: 'CreditCard' },
  { id: 'purchases', sectionName: 'Purchases & Stock In', routePrefix: '/api/purchases', path: '/purchases', iconName: 'Truck' },
  { id: 'suppliers', sectionName: 'Suppliers', routePrefix: '/api/suppliers', path: '/suppliers', iconName: 'Building' },
  { id: 'expenses', sectionName: 'Expenses', routePrefix: '/api/expenses', path: '/expenses', iconName: 'Receipt' },
  { id: 'reports', sectionName: 'Sales & Tax Reports', routePrefix: '/api/reports', path: '/reports', iconName: 'BarChart3' },
  { id: 'tokens', sectionName: 'Counter Tokens', routePrefix: '/api/tokens', path: '/tokens', iconName: 'Ticket' },
  { id: 'token-types', sectionName: 'Token Types', routePrefix: '/api/token-types', path: '/tokens', iconName: 'Tags' },
  { id: 'settings', sectionName: 'Store Settings', routePrefix: '/api/settings', path: '/settings', iconName: 'Settings' },
  { id: 'feedback', sectionName: 'In-app Feedback', routePrefix: '/api/feedback', path: '/feedback', iconName: 'MessageSquare' },
  { id: 'restaurant-tables', sectionName: 'Table Floor Plan', routePrefix: '/api/restaurant-tables', path: '/tables', iconName: 'LayoutGrid' },
  { id: 'kot-orders', sectionName: 'Kitchen Order Tickets', routePrefix: '/api/kot-orders', path: '/kot', iconName: 'ChefHat' },
  { id: 'locations', sectionName: 'Multi-store Locations', routePrefix: '/api/locations', path: '/stores', iconName: 'Store' },
  { id: 'notifications', sectionName: 'Push Notifications', routePrefix: '/api/notifications', path: '/settings', iconName: 'Bell' },
  { id: 'public-receipts', sectionName: 'Public Invoice Links', routePrefix: '/api/public/receipt', path: '/invoice', iconName: 'FileText' },
];

export const BUSINESS_PROFILE_LABELS = {
  restaurant_cafe: 'Restaurant & Cafe',
  online_store: 'Online Store',
  retail_shop: 'Retail Shop',
  unknown: 'Unspecified',
};

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

/** Same windows as getTimeIntervals, but keyed on ApiUsageBucket."bucketStart". */
export function getBucketTimeIntervals(timeRange = 'all') {
  const intervals = getTimeIntervals(timeRange);
  const swap = (sql) => (sql || '').replace(/"createdAt"/g, '"bucketStart"');
  return {
    ...intervals,
    currentFilter: swap(intervals.currentFilter),
    prevFilter: swap(intervals.prevFilter),
    currentClause: swap(intervals.currentClause),
    prevClause: swap(intervals.prevClause),
  };
}

async function tableExists(pool, tableName) {
  try {
    const res = await pool.query(
      `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1 LIMIT 1`,
      [tableName]
    );
    return (res.rowCount || 0) > 0;
  } catch {
    return false;
  }
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

/**
 * Catalog-driven feature usage from ApiUsageBucket.
 * Always returns every catalog feature (zeros when no traffic).
 * @param {string|null} businessTypeFilter - when set, filter to that businessType
 */
export async function computeRealTopFeatures(pool, timeRange = 'all', businessTypeFilter = null) {
  const intervals = getBucketTimeIntervals(timeRange);
  const isAllTime = (timeRange || '').toLowerCase() === 'all';
  const hasTable = await tableExists(pool, 'ApiUsageBucket');

  const usageByFeature = new Map();

  if (hasTable) {
    const params = [];
    let typeClause = '';
    if (businessTypeFilter) {
      params.push(businessTypeFilter);
      typeClause = `AND "businessType" = $1`;
    }

    try {
      const res = await pool.query(
        `
        SELECT
          "featureKey",
          COALESCE(SUM("callCount"), 0)::int AS count,
          COALESCE(SUM("callCount") FILTER (WHERE ${intervals.currentFilter}), 0)::int AS window_count,
          COALESCE(SUM("callCount") FILTER (WHERE ${intervals.prevFilter}), 0)::int AS prev_window_count
        FROM "ApiUsageBucket"
        WHERE 1=1 ${typeClause}
        GROUP BY "featureKey"
        `,
        params
      );

      for (const row of res.rows) {
        usageByFeature.set(row.featureKey, row);
      }
    } catch (err) {
      console.warn('[analytics] ApiUsageBucket query failed, returning empty feature counts:', err.message);
    }
  }

  const features = API_FEATURE_CATALOG.map((meta) => {
    const row = usageByFeature.get(meta.id) || {};
    const current = isAllTime ? row.count || 0 : row.window_count || 0;
    const prev = row.prev_window_count || 0;
    const trendPercent = computeTrendPercent(current, prev);
    return {
      id: `sec-${meta.id}`,
      sectionName: meta.sectionName,
      path: meta.path,
      apiRoute: meta.routePrefix,
      iconName: meta.iconName,
      viewCount: current,
      uniqueUsers: 0,
      trend: trendDirection(trendPercent),
      trendPercent: isAllTime ? 0 : trendPercent,
    };
  });

  const totalHits = features.reduce((acc, f) => acc + f.viewCount, 0);
  return features
    .map((f) => ({
      ...f,
      percentageShare: totalHits > 0 ? Math.round((f.viewCount / totalHits) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.viewCount - a.viewCount);
}

export async function computeTotalApiCalls(pool, timeRange = 'all') {
  const intervals = getBucketTimeIntervals(timeRange);
  const isAllTime = (timeRange || '').toLowerCase() === 'all';
  const empty = { totalApiCalls: 0, totalApiCallsPrev: 0, totalApiCallsTrend: 0 };

  if (!(await tableExists(pool, 'ApiUsageBucket'))) return empty;

  try {
    const res = await pool.query(`
      SELECT
        COALESCE(SUM("callCount"), 0)::int AS total_all,
        COALESCE(SUM("callCount") FILTER (WHERE ${intervals.currentFilter}), 0)::int AS window_count,
        COALESCE(SUM("callCount") FILTER (WHERE ${intervals.prevFilter}), 0)::int AS prev_window_count
      FROM "ApiUsageBucket"
    `);
    const row = res.rows[0] || {};
    const current = isAllTime ? row.total_all || 0 : row.window_count || 0;
    const prev = row.prev_window_count || 0;
    return {
      totalApiCalls: current,
      totalApiCallsPrev: prev,
      totalApiCallsTrend: isAllTime ? 0 : computeTrendPercent(current, prev),
    };
  } catch {
    return empty;
  }
}

export async function computeBusinessProfiles(pool, timeRange = 'all') {
  const intervals = getBucketTimeIntervals(timeRange);
  const isAllTime = (timeRange || '').toLowerCase() === 'all';
  const profileOrder = ['restaurant_cafe', 'online_store', 'retail_shop', 'unknown'];

  const userCounts = {};
  try {
    const userRes = await pool.query(`
      SELECT
        COALESCE(NULLIF(btrim("businessType"), ''), 'unknown') AS business_type,
        COUNT(*)::int AS user_count
      FROM "User"
      GROUP BY 1
    `);
    for (const row of userRes.rows) {
      userCounts[row.business_type] = row.user_count;
    }
  } catch {
    // ignore
  }

  const usageByType = {};
  if (await tableExists(pool, 'ApiUsageBucket')) {
    try {
      const usageRes = await pool.query(`
        SELECT
          "businessType",
          COALESCE(SUM("callCount"), 0)::int AS total_all,
          COALESCE(SUM("callCount") FILTER (WHERE ${intervals.currentFilter}), 0)::int AS window_count,
          COALESCE(SUM("callCount") FILTER (WHERE ${intervals.prevFilter}), 0)::int AS prev_window_count
        FROM "ApiUsageBucket"
        GROUP BY "businessType"
      `);
      for (const row of usageRes.rows) {
        usageByType[row.businessType] = row;
      }
    } catch {
      // ignore
    }
  }

  const topFeatureByType = {};
  for (const type of profileOrder) {
    const sections = await computeRealTopFeatures(pool, timeRange, type);
    const top = sections.find((s) => s.viewCount > 0) || null;
    topFeatureByType[type] = top
      ? { id: top.id, sectionName: top.sectionName, apiRoute: top.apiRoute, viewCount: top.viewCount }
      : null;
  }

  return profileOrder
    .filter((type) => type !== 'unknown' || userCounts[type] || usageByType[type])
    .map((type) => {
      const usage = usageByType[type] || {};
      const current = isAllTime ? usage.total_all || 0 : usage.window_count || 0;
      const prev = usage.prev_window_count || 0;
      const trendPercent = isAllTime ? 0 : computeTrendPercent(current, prev);
      return {
        businessType: type,
        label: BUSINESS_PROFILE_LABELS[type] || type,
        userCount: userCounts[type] || 0,
        totalApiCalls: current,
        totalApiCallsTrend: trendPercent,
        topFeature: topFeatureByType[type],
      };
    });
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
    businessType: u.businessType || null,
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

export function buildMetricsResponse({
  userRes,
  salesRes,
  productRes,
  topFeatures,
  timeRange,
  intervals,
  apiCalls = null,
}) {
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
    sectionName: 'Products & Inventory',
    percentageShare: 0,
    trendPercent: 0,
  };

  const totalApiCalls = apiCalls?.totalApiCalls ?? topFeatures.reduce((acc, f) => acc + (f.viewCount || 0), 0);
  const totalApiCallsPrev = apiCalls?.totalApiCallsPrev ?? 0;
  const totalApiCallsTrend = apiCalls?.totalApiCallsTrend ?? (isAllTime ? 0 : computeTrendPercent(totalApiCalls, totalApiCallsPrev));

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
    totalApiCalls,
    totalApiCallsPrev,
    totalApiCallsTrend,
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
