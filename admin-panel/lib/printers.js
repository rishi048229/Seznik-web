import { getTimeIntervals, applyTableAlias } from '../analyticsShared.js';

let tableEnsured = false;

export async function ensurePrinterLogTable(pool) {
  if (tableEnsured) return;
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "PrinterLog" (
        "id" TEXT PRIMARY KEY,
        "userId" TEXT NOT NULL,
        "printerName" TEXT NOT NULL,
        "deviceAddress" TEXT,
        "platform" TEXT NOT NULL DEFAULT 'web',
        "connectionType" TEXT DEFAULT 'bluetooth',
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS "PrinterLog_userId_idx" ON "PrinterLog"("userId");
      CREATE INDEX IF NOT EXISTS "PrinterLog_printerName_idx" ON "PrinterLog"("printerName");
      CREATE INDEX IF NOT EXISTS "PrinterLog_createdAt_idx" ON "PrinterLog"("createdAt");
      CREATE INDEX IF NOT EXISTS "PrinterLog_platform_idx" ON "PrinterLog"("platform");
    `);
    tableEnsured = true;
  } catch (err) {
    console.warn('ensurePrinterLogTable check failed:', err?.message);
  }
}

export async function getPrinterSummary(pool, { timeRange = 'all' } = {}) {
  await ensurePrinterLogTable(pool);
  const intervals = getTimeIntervals(timeRange);
  const whereClause = `WHERE ${intervals.currentFilter}`;

  const query = `
    SELECT 
      "printerName",
      COUNT(*)::int AS "totalConnections",
      COUNT(DISTINCT "userId")::int AS "uniqueUsersCount",
      COUNT(*) FILTER (WHERE "platform" = 'web')::int AS "webCount",
      COUNT(*) FILTER (WHERE "platform" = 'mobile')::int AS "mobileCount",
      MIN("createdAt") AS "firstSeenAt",
      MAX("createdAt") AS "lastConnectedAt"
    FROM "PrinterLog"
    ${whereClause}
    GROUP BY "printerName"
    ORDER BY "totalConnections" DESC, "lastConnectedAt" DESC
  `;

  const { rows } = await pool.query(query);

  let totalConnections = 0;
  let webConnections = 0;
  let mobileConnections = 0;
  const userSet = new Set();

  for (const r of rows) {
    totalConnections += Number(r.totalConnections || 0);
    webConnections += Number(r.webCount || 0);
    mobileConnections += Number(r.mobileCount || 0);
  }

  // Get distinct total unique users across all printers in the window
  const distinctUsersRes = await pool.query(`
    SELECT COUNT(DISTINCT "userId")::int AS "distinctUsers"
    FROM "PrinterLog"
    ${whereClause}
  `);
  const uniqueUsers = Number(distinctUsersRes.rows[0]?.distinctUsers || 0);

  const topPrinter = rows.length > 0 ? rows[0].printerName : null;
  const topPrinterConnections = rows.length > 0 ? Number(rows[0].totalConnections) : 0;

  return {
    metrics: {
      totalConnections,
      uniquePrinters: rows.length,
      uniqueUsers,
      webConnections,
      mobileConnections,
      topPrinter,
      topPrinterConnections,
      timeRange,
    },
    printers: rows.map((r) => ({
      printerName: r.printerName,
      totalConnections: Number(r.totalConnections || 0),
      uniqueUsersCount: Number(r.uniqueUsersCount || 0),
      webCount: Number(r.webCount || 0),
      mobileCount: Number(r.mobileCount || 0),
      firstSeenAt: r.firstSeenAt ? new Date(r.firstSeenAt).toISOString() : null,
      lastConnectedAt: r.lastConnectedAt ? new Date(r.lastConnectedAt).toISOString() : null,
    })),
  };
}

export async function getPrinterUserLogs(pool, { search, platform, printerName, timeRange = 'all', page = 1, limit = 50 } = {}) {
  await ensurePrinterLogTable(pool);
  const intervals = getTimeIntervals(timeRange);
  const timeFilter = applyTableAlias(intervals.currentFilter, 'p');

  const conditions = [timeFilter];
  const params = [];

  if (platform && platform !== 'all') {
    params.push(platform);
    conditions.push(`p."platform" = $${params.length}`);
  }

  if (printerName && printerName.trim()) {
    params.push(printerName.trim());
    conditions.push(`p."printerName" = $${params.length}`);
  }

  if (search && search.trim()) {
    params.push(`%${search.trim()}%`);
    const idx = params.length;
    conditions.push(`(
      p."printerName" ILIKE $${idx} OR
      COALESCE(u."displayName", '') ILIKE $${idx} OR
      COALESCE(u."businessName", '') ILIKE $${idx} OR
      COALESCE(u.email, '') ILIKE $${idx} OR
      COALESCE(u.phone, '') ILIKE $${idx} OR
      COALESCE(p."deviceAddress", '') ILIKE $${idx}
    )`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Count query
  const countQuery = `
    SELECT COUNT(*)::int AS "total"
    FROM "PrinterLog" p
    LEFT JOIN "User" u ON p."userId" = u.id
    ${whereClause}
  `;
  const countRes = await pool.query(countQuery, params);
  const total = Number(countRes.rows[0]?.total || 0);

  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.min(2000, Math.max(1, Number(limit) || 50));
  const offset = (safePage - 1) * safeLimit;

  params.push(safeLimit);
  const limitIdx = params.length;
  params.push(offset);
  const offsetIdx = params.length;

  const logsQuery = `
    SELECT 
      p.id,
      p."userId",
      p."printerName",
      p."deviceAddress",
      p."platform",
      p."connectionType",
      p."createdAt",
      u."displayName" AS "userName",
      u."businessName",
      u.email AS "userEmail",
      u.phone AS "userPhone",
      u."businessType",
      u.plan AS "userPlan"
    FROM "PrinterLog" p
    LEFT JOIN "User" u ON p."userId" = u.id
    ${whereClause}
    ORDER BY p."createdAt" DESC
    LIMIT $${limitIdx} OFFSET $${offsetIdx}
  `;

  const { rows } = await pool.query(logsQuery, params);

  return {
    logs: rows.map((r) => ({
      id: r.id,
      userId: r.userId,
      userName: r.userName || 'Unnamed User',
      businessName: r.businessName || null,
      userEmail: r.userEmail || null,
      userPhone: r.userPhone || null,
      businessType: r.businessType || 'unknown',
      userPlan: r.userPlan || 'free',
      printerName: r.printerName,
      deviceAddress: r.deviceAddress || null,
      platform: r.platform || 'web',
      connectionType: r.connectionType || 'bluetooth',
      createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : new Date().toISOString(),
    })),
    pagination: {
      total,
      page: safePage,
      limit: safeLimit,
      totalPages: Math.ceil(total / safeLimit) || 1,
    },
  };
}
