import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../config/db';
import { subDays, startOfDay, endOfDay, format, startOfWeek, startOfMonth, addDays, differenceInCalendarDays, subMonths } from 'date-fns';
import { getOwnerUserId } from '../utils/getOwnerUserId';
import { computeSaleGrossProfit, computeSaleCost } from '../utils/saleMetrics';
import { handleApiError } from '../utils/apiErrorHandler';

const parseDate = (d: any, defaultDate: Date) => {
  if (!d || d === 'undefined' || d === 'null') return defaultDate;
  const parsed = new Date(d as string);
  return isNaN(parsed.getTime()) ? defaultDate : parsed;
};

const parseRangeEnd = (d: any, defaultDate: Date) => endOfDay(parseDate(d, defaultDate));

const localDateKey = (date: Date) => format(date, 'yyyy-MM-dd');

const buildProductCostMap = (products: { id: string; costPrice: number }[]) => {
  const map = new Map<string, number>();
  products.forEach((p) => map.set(p.id, p.costPrice));
  return map;
};

/** Distinct, truthy productIds referenced across a batch of sales' JSON `items` arrays. */
const collectProductIds = (sales: { items: unknown }[]): string[] => {
  const ids = new Set<string>();
  for (const sale of sales) {
    const items = sale.items;
    if (!Array.isArray(items)) continue;
    for (const item of items as any[]) {
      if (item?.productId) ids.add(item.productId);
    }
  }
  return Array.from(ids);
};

// A DEFAULT trailing window applied only when the caller doesn't specify start/end — any caller
// that already passes an explicit date range is completely unaffected. Previously these endpoints
// defaulted to `new Date(0)` (literally all of history) when no range was given, so their cost
// grew without bound as a tenant's transaction history grew, forever.
const DEFAULT_REPORT_WINDOW_DAYS = 366;

// Guards every raw SQL `jsonb_array_elements(s.items)` call against a null/non-array `items`
// value (matches the JS code's own `if (Array.isArray(items))` guard it replaces) — without this,
// a malformed/empty items value would throw inside Postgres instead of just contributing nothing.
const SAFE_ITEMS_ARRAY = Prisma.sql`CASE WHEN jsonb_typeof(s.items) = 'array' THEN s.items ELSE '[]'::jsonb END`;

export const getDashboardStats = async (req: Request, res: Response) => {
  try {
    const userId = await getOwnerUserId((req as any).user.id);
    const todayStart = startOfDay(new Date());

    const [todaySales, todayReturns, recentSales, totalsRows, lowStockProducts] = await Promise.all([
      prisma.sale.findMany({
        where: { userId, createdAt: { gte: todayStart } },
        select: { grandTotal: true, totalTax: true, items: true, createdAt: true },
      }),
      prisma.saleReturn.findMany({
        where: { userId, createdAt: { gte: todayStart } },
        select: { refundAmount: true, subtotal: true, totalTax: true, items: true },
      }),
      prisma.sale.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, invoiceNumber: true, grandTotal: true, createdAt: true },
      }),
      // Customer count, product count and stock valuation were three separate round trips. Against
      // a cross-region database each one costs ~300ms of pure latency regardless of how little work
      // it does, so they're folded into a single query. NULLIF/COALESCE preserves the original
      // `costPrice || sellingPrice || 0` semantics exactly (0 is falsy in JS, so a costPrice of
      // exactly 0 fell back to sellingPrice there too).
      prisma.$queryRaw<Array<{ customerCount: number; productCount: number; stockValue: number }>>(Prisma.sql`
        SELECT
          (SELECT COUNT(*) FROM "Customer" WHERE "userId" = ${userId}) AS "customerCount",
          (SELECT COUNT(*) FROM "Product" WHERE "userId" = ${userId} AND "isActive" = true) AS "productCount",
          (SELECT COALESCE(SUM(COALESCE(NULLIF("costPrice", 0), "sellingPrice", 0) * "currentStock"), 0)
             FROM "Product" WHERE "userId" = ${userId} AND "isActive" = true) AS "stockValue"
      `),
      // Low-stock filtering is a column-to-column comparison ("currentStock <= lowStockThreshold")
      // that the Prisma client can't express — previously this pulled the WHOLE active-product
      // catalog into Node and filtered in JS. Push the comparison into SQL instead.
      prisma.$queryRaw<Array<{ id: string; name: string; currentStock: number; lowStockThreshold: number }>>(Prisma.sql`
        SELECT id, name, "currentStock", "lowStockThreshold"
        FROM "Product"
        WHERE "userId" = ${userId} AND "isActive" = true AND "currentStock" <= "lowStockThreshold"
        ORDER BY "currentStock" ASC
        LIMIT 20
      `),
    ]);

    const totalCustomers = Number(totalsRows[0]?.customerCount ?? 0);
    const totalProductCount = Number(totalsRows[0]?.productCount ?? 0);

    // Gross profit only needs cost prices for products actually sold or returned TODAY
    const todayProductIds = collectProductIds([...todaySales, ...todayReturns]);
    const todayProducts = todayProductIds.length
      ? await prisma.product.findMany({ where: { id: { in: todayProductIds }, userId }, select: { id: true, costPrice: true } })
      : [];
    const productCosts = buildProductCostMap(todayProducts);

    const grossTodayRevenue = todaySales.reduce((s, sale) => s + sale.grandTotal, 0);
    const todayReturnsRefund = todayReturns.reduce((s, ret) => s + (ret.refundAmount || 0), 0);
    const todayRevenue = Math.max(0, Math.round((grossTodayRevenue - todayReturnsRefund) * 100) / 100);

    const grossProfit = todaySales.reduce(
      (s, sale) => s + computeSaleGrossProfit(sale, productCosts),
      0
    );
    const returnedProfitDeduction = todayReturns.reduce((sum, ret) => {
      let returnedCost = 0;
      if (Array.isArray(ret.items)) {
        for (const item of ret.items as any[]) {
          const cost = productCosts.get(item?.productId) ?? 0;
          returnedCost += cost * (Number(item?.quantity) || 0);
        }
      }
      const returnedNet = (ret.subtotal || 0);
      return sum + Math.max(0, returnedNet - returnedCost);
    }, 0);

    const todayGrossProfit = Math.max(0, Math.round((grossProfit - returnedProfitDeduction) * 100) / 100);
    const totalStockValue = Number(totalsRows[0]?.stockValue ?? 0);

    res.json({
      todayRevenue,
      todayInvoices: todaySales.length,
      todayGrossProfit,
      totalCustomers,
      totalProductCount,
      totalStockValue,
      // Preserves the original behavior exactly: this was always "count of the (already
      // limit-20) low-stock list", not a true unbounded count.
      lowStockCount: lowStockProducts.length,
      lowStockProducts: lowStockProducts.map((p) => ({
        id: p.id,
        name: p.name,
        currentStock: p.currentStock,
        threshold: p.lowStockThreshold,
      })),
      recentSales: recentSales.map((s) => ({
        id: s.id,
        invoiceNumber: s.invoiceNumber,
        grandTotal: s.grandTotal,
        createdAt: s.createdAt.getTime(),
      })),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch dashboard stats' });
  }
};

// Day-bucketing stays in JS here (and in getRevenueTrend below) rather than a raw SQL
// date_trunc — the exact bucket-boundary semantics (server-local calendar days) are what the
// existing charts already rely on, and getting that subtly wrong via a DB-side timezone
// assumption is a real correctness risk this pass isn't taking. The actual "grows forever" fix
// is the default window below: a caller that never specifies a date range used to get
// literally all of history; now it gets a bounded trailing year, same as every other report.
export const getSalesReport = async (req: Request, res: Response) => {
  try {
    const userId = await getOwnerUserId((req as any).user.id);
    const { start, end } = req.query;

    const sales = await prisma.sale.findMany({
      where: {
        userId,
        createdAt: {
          gte: parseDate(start, subDays(new Date(), DEFAULT_REPORT_WINDOW_DAYS)),
          lte: parseRangeEnd(end, new Date())
        }
      }
    });

    const dayMap = new Map<string, { revenue: number; count: number }>();
    sales.forEach(sale => {
      const key = localDateKey(sale.createdAt);
      const existing = dayMap.get(key) ?? { revenue: 0, count: 0 };
      existing.revenue += sale.grandTotal;
      existing.count += 1;
      dayMap.set(key, existing);
    });

    const sortedDays = Array.from(dayMap.entries()).sort(([a], [b]) => a.localeCompare(b));

    res.json({
      labels: sortedDays.map(([key]) => key),
      revenue: sortedDays.map(([, v]) => v.revenue),
      invoiceCount: sortedDays.map(([, v]) => v.count),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch sales report' });
  }
};

export const getPLReport = async (req: Request, res: Response) => {
  try {
    const userId = await getOwnerUserId((req as any).user.id);
    const { start, end } = req.query;
    const startDate = start ? startOfDay(parseDate(start, new Date())) : startOfDay(subDays(new Date(), DEFAULT_REPORT_WINDOW_DAYS));
    const endDate = parseRangeEnd(end, new Date());

    // Fetch all sales, returns, and expenses in the window
    const [salesAgg, returnsAgg, expenseRows, salesInWindow, returnsInWindow] = await Promise.all([
      prisma.sale.aggregate({
        where: { userId, createdAt: { gte: startDate, lte: endDate } },
        _sum: { grandTotal: true, totalTax: true },
      }),
      prisma.saleReturn.aggregate({
        where: { userId, createdAt: { gte: startDate, lte: endDate } },
        _sum: { subtotal: true, totalTax: true, refundAmount: true },
      }),
      prisma.$queryRaw<Array<{ total: number }>>(Prisma.sql`
        SELECT COALESCE(SUM(amount), 0) AS total FROM "Expense"
        WHERE "userId" = ${userId} AND "expenseDate" >= ${startDate} AND "expenseDate" <= ${endDate}
      `),
      prisma.sale.findMany({
        where: { userId, createdAt: { gte: startDate, lte: endDate } },
        select: { items: true },
      }),
      prisma.saleReturn.findMany({
        where: { userId, createdAt: { gte: startDate, lte: endDate } },
        select: { items: true },
      }),
    ]);

    // Build real COGS from snapshot costPrice on each line item, falling back to
    // the live product catalog for older sales that predate snapshot storage.
    const productIdsInSales = collectProductIds(salesInWindow);
    const productIdsInReturns = collectProductIds(returnsInWindow);
    const allProductIds = Array.from(new Set([...productIdsInSales, ...productIdsInReturns]));

    const productsInWindow = allProductIds.length
      ? await prisma.product.findMany({
          where: { id: { in: allProductIds }, userId },
          select: { id: true, costPrice: true },
        })
      : [];
    const productCosts = buildProductCostMap(productsInWindow);
    const grossCost = salesInWindow.reduce(
      (sum, sale) => sum + computeSaleCost(sale, productCosts),
      0
    );

    let returnedCost = 0;
    for (const ret of returnsInWindow) {
      if (Array.isArray(ret.items)) {
        for (const item of ret.items as any[]) {
          if (item?.restock !== false) {
            const cost = productCosts.get(item?.productId) ?? (item?.costPrice || 0);
            returnedCost += cost * (Number(item?.quantity) || 0);
          }
        }
      }
    }
    const totalCost = Math.max(0, Math.round((grossCost - returnedCost) * 100) / 100);

    const grossBilled = salesAgg._sum.grandTotal ?? 0;
    const grossTax = salesAgg._sum.totalTax ?? 0;
    const returnsDeducted = returnsAgg._sum.subtotal ?? 0;
    const returnsTaxDeducted = returnsAgg._sum.totalTax ?? 0;
    const taxCollected = Math.max(0, Math.round((grossTax - returnsTaxDeducted) * 100) / 100);
    const netRevenue = Math.round((grossBilled - returnsDeducted - taxCollected) * 100) / 100;
    const grossProfit = Math.round((netRevenue - totalCost) * 100) / 100;
    const totalExpenses = Number(expenseRows[0]?.total ?? 0);
    const netProfit = Math.round((grossProfit - totalExpenses) * 100) / 100;

    res.json({
      grossBilled,
      taxCollected,
      returnsDeducted,
      returnsTaxDeducted,
      netRevenue,
      totalRevenue: grossBilled, // Retained for 100% backward compatibility
      totalCost,
      grossProfit,
      totalExpenses,
      netProfit,
      period: `${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch P&L report' });
  }
};

export const getTaxReport = async (req: Request, res: Response) => {
  try {
    const userId = await getOwnerUserId((req as any).user.id);
    const { start, end } = req.query;
    const startDate = parseDate(start, subDays(new Date(), DEFAULT_REPORT_WINDOW_DAYS));
    const endDate = parseRangeEnd(end, new Date());

    const [agg, retAgg] = await Promise.all([
      prisma.sale.aggregate({
        where: { userId, createdAt: { gte: startDate, lte: endDate } },
        _sum: { totalTax: true },
        _count: { _all: true },
      }),
      prisma.saleReturn.aggregate({
        where: { userId, createdAt: { gte: startDate, lte: endDate } },
        _sum: { totalTax: true },
        _count: { _all: true },
      }),
    ]);

    const grossTax = agg._sum.totalTax ?? 0;
    const returnedTax = retAgg._sum.totalTax ?? 0;
    const totalOutputTax = Math.max(0, Math.round((grossTax - returnedTax) * 100) / 100);

    res.json({
      totalOutputTax,
      grossOutputTax: grossTax,
      returnedOutputTax: returnedTax,
      taxableSales: agg._count._all,
      returnCount: retAgg._count._all,
      period: `${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch tax report' });
  }
};

export const getRevenueTrend = async (req: Request, res: Response) => {
  try {
    const userId = await getOwnerUserId((req as any).user.id);
    const period = (req.query.period as string) || 'month';
    const numDays = Number(req.query.days) || (period === 'monthly' ? 90 : period === 'weekly' ? 28 : period === 'month' ? 0 : 7);
    const startDate =
      period === 'month'
        ? startOfDay(startOfMonth(new Date()))
        : startOfDay(subDays(new Date(), (numDays || 7) - 1));

    const sales = await prisma.sale.findMany({
      where: { userId, createdAt: { gte: startDate } },
    });
    // Was `prisma.product.findMany({where:{userId}})` — the ENTIRE catalog, just to build a cost
    // map. `sales` here is already date-windowed (not all-time), so scope the cost lookup to only
    // the products that actually appear in that window instead of every product ever created.
    const productIdsInWindow = collectProductIds(sales);
    const products = productIdsInWindow.length
      ? await prisma.product.findMany({ where: { id: { in: productIdsInWindow }, userId }, select: { id: true, costPrice: true } })
      : [];
    const productCosts = buildProductCostMap(products);

    const bucketMap = new Map<string, { revenue: number; profit: number }>();
    const bucketKey = (date: Date): string => {
      if (period === 'weekly') return format(startOfWeek(date, { weekStartsOn: 1 }), 'yyyy-MM-dd');
      if (period === 'monthly') return format(startOfMonth(date), 'yyyy-MM');
      return localDateKey(date);
    };

    sales.forEach((sale) => {
      const key = bucketKey(sale.createdAt);
      const existing = bucketMap.get(key) ?? { revenue: 0, profit: 0 };
      existing.revenue += sale.grandTotal;
      existing.profit += computeSaleGrossProfit(sale, productCosts);
      bucketMap.set(key, existing);
    });

    const labels: string[] = [];
    const revenue: number[] = [];
    const profit: number[] = [];

    if (period === 'monthly') {
      const monthCount = Math.max(1, Math.ceil((numDays || 90) / 30));
      for (let i = monthCount - 1; i >= 0; i--) {
        const date = startOfMonth(subMonths(new Date(), i));
        const key = format(date, 'yyyy-MM');
        labels.push(format(date, 'MMM yy'));
        const data = bucketMap.get(key);
        revenue.push(data?.revenue ?? 0);
        profit.push(data?.profit ?? 0);
      }
    } else if (period === 'month') {
      const monthStart = startOfMonth(new Date());
      const dayCount = differenceInCalendarDays(new Date(), monthStart) + 1;
      for (let i = 0; i < dayCount; i++) {
        const date = addDays(monthStart, i);
        const key = localDateKey(date);
        const isToday = i === dayCount - 1;
        labels.push(isToday ? 'Today' : format(date, 'd'));
        const data = bucketMap.get(key);
        revenue.push(data?.revenue ?? 0);
        profit.push(data?.profit ?? 0);
      }
    } else if (period === 'weekly') {
      const weekCount = Math.max(1, Math.ceil(numDays / 7));
      for (let i = weekCount - 1; i >= 0; i--) {
        const date = startOfWeek(subDays(new Date(), i * 7), { weekStartsOn: 1 });
        const key = format(date, 'yyyy-MM-dd');
        labels.push(`Wk ${format(date, 'd MMM')}`);
        const data = bucketMap.get(key);
        revenue.push(data?.revenue ?? 0);
        profit.push(data?.profit ?? 0);
      }
    } else {
      for (let i = 0; i < numDays; i++) {
        const date = subDays(new Date(), numDays - 1 - i);
        const key = localDateKey(date);
        const isToday = i === numDays - 1;
        labels.push(isToday ? 'Today' : format(date, 'd MMM'));
        const data = bucketMap.get(key);
        revenue.push(data?.revenue ?? 0);
        profit.push(data?.profit ?? 0);
      }
    }

    res.json({ labels, revenue, profit });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch revenue trend' });
  }
};

export const getTopCustomers = async (req: Request, res: Response) => {
  try {
    const userId = await getOwnerUserId((req as any).user.id);
    const limit = Number(req.query.limit) || 10;

    // Groups on a real column (customerId) — no JSON involved, straightforward DB-side groupBy
    // instead of pulling every sale ever made (plus a joined customer row each) into Node.
    const grouped = await prisma.sale.groupBy({
      by: ['customerId'],
      where: { userId },
      _sum: { grandTotal: true },
      _count: { _all: true },
      _max: { createdAt: true },
      orderBy: { _sum: { grandTotal: 'desc' } },
      take: limit,
    });

    const realCustomerIds = grouped.map((g) => g.customerId).filter((id): id is string => !!id);
    const customers = realCustomerIds.length
      ? await prisma.customer.findMany({ where: { id: { in: realCustomerIds } }, select: { id: true, name: true } })
      : [];
    const nameById = new Map(customers.map((c) => [c.id, c.name]));

    const top = grouped.map((g) => ({
      id: g.customerId ?? 'walk-in',
      name: g.customerId ? nameById.get(g.customerId) || 'Walk-in Customer' : 'Walk-in Customer',
      totalSpent: g._sum.grandTotal ?? 0,
      invoiceCount: g._count._all,
      lastPurchase: g._max.createdAt ? g._max.createdAt.getTime() : 0,
    }));

    res.json(top);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch top customers' });
  }
};

export const getPaymentModeBreakdown = async (req: Request, res: Response) => {
  try {
    const userId = await getOwnerUserId((req as any).user.id);

    const grouped = await prisma.sale.groupBy({
      by: ['paymentMethod'],
      where: { userId },
      _sum: { grandTotal: true },
      _count: { _all: true },
    });

    const totalSales = grouped.reduce((sum, g) => sum + (g._sum.grandTotal ?? 0), 0);

    const modes = grouped
      .map((g) => ({
        method: g.paymentMethod,
        amount: g._sum.grandTotal ?? 0,
        count: g._count._all,
        percent: totalSales > 0 ? Math.round(((g._sum.grandTotal ?? 0) / totalSales) * 100) : 0,
      }))
      .sort((a, b) => b.amount - a.amount);

    res.json({ totalSales, modes });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch payment mode breakdown' });
  }
};

export const getProfitBreakdown = async (req: Request, res: Response) => {
  try {
    const userId = await getOwnerUserId((req as any).user.id);

    // Sale.items is a JSON column (not a normalized child table), so per-item cost aggregation
    // needs a LATERAL unnest rather than a plain Prisma groupBy — this replaces pulling every
    // sale AND the entire product catalog into Node with one aggregate row from Postgres.
    const rows = await prisma.$queryRaw<Array<{ revenue: number; tax: number; cost: number }>>(Prisma.sql`
      SELECT
        COALESCE(SUM(s."grandTotal"), 0) AS revenue,
        COALESCE(SUM(s."totalTax"), 0) AS tax,
        COALESCE(SUM(item_costs.cost), 0) AS cost
      FROM "Sale" s
      LEFT JOIN LATERAL (
        SELECT SUM(COALESCE((item->>'costPrice')::float, p."costPrice", 0) * COALESCE((item->>'quantity')::float, 0)) AS cost
        FROM jsonb_array_elements(${SAFE_ITEMS_ARRAY}) AS item
        LEFT JOIN "Product" p ON p.id = NULLIF(item->>'productId', '')
      ) item_costs ON true
      WHERE s."userId" = ${userId}
    `);

    const revenue = Number(rows[0]?.revenue ?? 0);
    const tax = Number(rows[0]?.tax ?? 0);
    const cost = Number(rows[0]?.cost ?? 0);
    const profit = revenue - tax - cost;
    const marginPercent = revenue > 0 ? Math.round((profit / revenue) * 100) : 0;

    res.json({ revenue, tax, cost, profit, marginPercent });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch profit breakdown' });
  }
};

export const getTopProducts = async (req: Request, res: Response) => {
  try {
    const userId = await getOwnerUserId((req as any).user.id);
    const limit = Number(req.query.limit) || 100;
    const { start, end } = req.query;

    const whereDateClause = (start || end)
      ? Prisma.sql`AND s."createdAt" >= ${parseDate(start, subDays(new Date(), DEFAULT_REPORT_WINDOW_DAYS))} AND s."createdAt" <= ${parseRangeEnd(end, new Date())}`
      : Prisma.empty;

    const rows = await prisma.$queryRaw<Array<{ id: string; name: string; categoryName: string | null; unitsSold: number; revenue: number }>>(Prisma.sql`
      SELECT
        COALESCE(NULLIF(item->>'productId', ''), item->>'productName') AS id,
        MAX(item->>'productName') AS name,
        MAX(c.name) AS "categoryName",
        SUM(COALESCE((item->>'quantity')::float, 0)) AS "unitsSold",
        SUM(COALESCE(
          (item->>'total')::float,
          COALESCE((item->>'sellingPrice')::float, 0) * COALESCE((item->>'quantity')::float, 0) - COALESCE((item->>'discount')::float, 0)
        )) AS revenue
      FROM "Sale" s
      CROSS JOIN LATERAL jsonb_array_elements(${SAFE_ITEMS_ARRAY}) AS item
      LEFT JOIN "Product" p ON p.id = NULLIF(item->>'productId', '')
      LEFT JOIN "Category" c ON c.id = p."categoryId"
      WHERE s."userId" = ${userId} ${whereDateClause}
      GROUP BY COALESCE(NULLIF(item->>'productId', ''), item->>'productName')
      ORDER BY revenue DESC
      LIMIT ${limit}
    `);

    res.json(rows.map((r) => ({
      id: r.id,
      name: r.name,
      categoryName: r.categoryName || 'General',
      unitsSold: Number(r.unitsSold),
      revenue: Number(r.revenue),
      averagePrice: Number(r.unitsSold) > 0 ? Math.round((Number(r.revenue) / Number(r.unitsSold)) * 100) / 100 : 0,
    })));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch top products' });
  }
};

export const getTopCategories = async (req: Request, res: Response) => {
  try {
    const userId = await getOwnerUserId((req as any).user.id);
    const limit = Number(req.query.limit) || 3;

    const rows = await prisma.$queryRaw<Array<{ name: string; revenue: number }>>(Prisma.sql`
      SELECT
        COALESCE(c.name, 'Uncategorized') AS name,
        SUM(COALESCE(
          (item->>'total')::float,
          COALESCE((item->>'sellingPrice')::float, 0) * COALESCE((item->>'quantity')::float, 0) - COALESCE((item->>'discount')::float, 0)
        )) AS revenue
      FROM "Sale" s
      CROSS JOIN LATERAL jsonb_array_elements(${SAFE_ITEMS_ARRAY}) AS item
      LEFT JOIN "Product" p ON p.id = NULLIF(item->>'productId', '')
      LEFT JOIN "Category" c ON c.id = p."categoryId"
      WHERE s."userId" = ${userId}
      GROUP BY c.name
      ORDER BY revenue DESC
    `);

    const sorted = rows.map((r) => ({ name: r.name, revenue: Number(r.revenue) }));
    const top = sorted.slice(0, limit);
    const rest = sorted.slice(limit);
    if (rest.length > 0) {
      top.push({ name: 'Other', revenue: rest.reduce((sum, c) => sum + c.revenue, 0) });
    }

    res.json(top);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch top categories' });
  }
};

export const getExpenseSummary = async (req: Request, res: Response) => {
  try {
    const userId = await getOwnerUserId((req as any).user.id);
    const now = new Date();
    const todayStart = startOfDay(now);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [todayAgg, monthAgg, allExpAgg, allSalesAgg, todayNonCreditAgg] = await Promise.all([
      prisma.expense.aggregate({ where: { userId, expenseDate: { gte: todayStart } }, _sum: { amount: true } }),
      prisma.expense.aggregate({ where: { userId, expenseDate: { gte: monthStart } }, _sum: { amount: true } }),
      prisma.expense.aggregate({ where: { userId }, _sum: { amount: true } }),
      prisma.sale.aggregate({ where: { userId }, _sum: { grandTotal: true } }),
      prisma.sale.aggregate({ where: { userId, createdAt: { gte: todayStart }, paymentMethod: { not: 'credit' } }, _sum: { grandTotal: true } }),
    ]);

    const today = todayAgg._sum.amount ?? 0;
    const thisMonth = monthAgg._sum.amount ?? 0;
    const totalExpenses = allExpAgg._sum.amount ?? 0;
    const totalRevenue = allSalesAgg._sum.grandTotal ?? 0;
    const collectionsNonCredit = todayNonCreditAgg._sum.grandTotal ?? 0;
    const net = totalRevenue - totalExpenses;

    res.json({ today, thisMonth, collectionsNonCredit, net });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch expense summary' });
  }
};

export const getDaybook = async (req: Request, res: Response) => {
  try {
    const userId = await getOwnerUserId((req as any).user.id);
    const dateParam = req.query.date as string;
    const targetDate = dateParam ? new Date(dateParam) : new Date();
    const dayStart = startOfDay(targetDate);
    const dayEnd = endOfDay(targetDate);

    const [sales, returns, expenses, purchases, purchaseReturnsAgg, creditTxns, lowStockCount] = await Promise.all([
      prisma.sale.findMany({
        where: { userId, createdAt: { gte: dayStart, lte: dayEnd } },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.saleReturn.findMany({
        where: { userId, createdAt: { gte: dayStart, lte: dayEnd } },
        include: { customer: { select: { name: true } }, sale: { select: { invoiceNumber: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.expense.findMany({
        where: { userId, expenseDate: { gte: dayStart, lte: dayEnd } },
        orderBy: { expenseDate: 'desc' },
      }),
      prisma.purchase.aggregate({
        where: { userId, createdAt: { gte: dayStart, lte: dayEnd } },
        _sum: { totalTax: true },
      }),
      prisma.purchaseReturn.aggregate({
        where: { userId, createdAt: { gte: dayStart, lte: dayEnd } },
        _sum: { totalTax: true, refundAmount: true },
      }),
      prisma.creditTransaction.findMany({
        where: { userId, createdAt: { gte: dayStart, lte: dayEnd } },
        include: { customer: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.product.count({
        where: {
          userId,
          isActive: true,
          currentStock: { lte: 10 },
        },
      }),
    ]);

    // 1. Sales breakdown & GST per product
    const modeMap = new Map<string, number>();
    let totalTax = 0;
    let nonCreditSales = 0;
    let creditSales = 0;

    const productSalesMap = new Map<string, { name: string; unitsSold: number; revenue: number }>();
    const productGstMap = new Map<string, {
      name: string;
      quantity: number;
      taxRate: number;
      taxableAmount: number;
      cgst: number;
      sgst: number;
      totalGst: number;
      totalAmount: number;
    }>();

    sales.forEach((s: any) => {
      totalTax += s.totalTax || 0;
      const method = (s.paymentMethod || 'cash').toLowerCase();
      modeMap.set(method, (modeMap.get(method) || 0) + (s.grandTotal || 0));

      if (method === 'credit') {
        creditSales += s.grandTotal || 0;
      } else {
        nonCreditSales += s.grandTotal || 0;
      }

      const items = (s.items as any[]) || [];
      items.forEach((item: any) => {
        const name = item.productName || item.name || 'Product';
        const qty = Number(item.quantity) || 1;
        const lineTotal = Number(item.total) || Number(item.price || item.sellingPrice || 0) * qty;
        const taxRate = Number(item.taxRate || item.gstRate || 0);

        let itemTax = 0;
        let taxable = lineTotal;
        if (taxRate > 0) {
          if (item.priceIncludesGst) {
            taxable = lineTotal / (1 + taxRate / 100);
            itemTax = lineTotal - taxable;
          } else {
            itemTax = (taxable * taxRate) / 100;
          }
        }

        const existing = productSalesMap.get(name) || { name, unitsSold: 0, revenue: 0 };
        existing.unitsSold += qty;
        existing.revenue += lineTotal;
        productSalesMap.set(name, existing);

        const existingGst = productGstMap.get(name) || {
          name,
          quantity: 0,
          taxRate,
          taxableAmount: 0,
          cgst: 0,
          sgst: 0,
          totalGst: 0,
          totalAmount: 0,
        };
        existingGst.quantity += qty;
        existingGst.taxableAmount += taxable;
        existingGst.cgst += itemTax / 2;
        existingGst.sgst += itemTax / 2;
        existingGst.totalGst += itemTax;
        existingGst.totalAmount += lineTotal;
        productGstMap.set(name, existingGst);
      });
    });

    // Deduct returns tax from total collected tax
    const totalReturnsTax = returns.reduce((sum: number, r: any) => sum + (r.totalTax || 0), 0);
    const netGstCollected = Math.max(0, totalTax - totalReturnsTax);

    // 2. Credit Transactions breakdown
    let creditCollectedToday = 0;
    let manualCreditGiven = 0;

    creditTxns.forEach((tx: any) => {
      if (tx.type === 'payment') {
        creditCollectedToday += tx.amount || 0;
      } else if (tx.type === 'credit') {
        manualCreditGiven += tx.amount || 0;
      }
    });

    const totalExpenseAmount = expenses.reduce((sum: number, e: any) => sum + (e.amount || 0), 0);
    const cashRefunds = returns
      .filter((r: any) => (r.refundMethod || 'cash').toLowerCase() === 'cash')
      .reduce((sum: number, r: any) => sum + (r.refundAmount || 0), 0);
    const totalReturnsRefunded = returns.reduce((sum: number, r: any) => sum + (r.refundAmount || 0), 0);

    const moneyIn = nonCreditSales + creditCollectedToday;
    const moneyOut = totalExpenseAmount + cashRefunds;
    const netBalance = moneyIn - moneyOut;
    const creditGiven = creditSales + manualCreditGiven;

    const paymentModeBreakdown = Array.from(modeMap.entries()).map(([method, amount]) => ({
      method,
      amount,
    }));

    const topSellingItemToday = Array.from(productSalesMap.values()).sort((a, b) => b.revenue - a.revenue)[0] || null;

    const rawGstPaid = purchases._sum.totalTax || 0;
    const purchaseReturnsTax = purchaseReturnsAgg._sum.totalTax || 0;
    const gstPaid = Math.max(0, Math.round((rawGstPaid - purchaseReturnsTax) * 100) / 100);
    const productGstBreakdown = Array.from(productGstMap.values())
      .map((p) => ({
        name: p.name,
        quantity: p.quantity,
        taxRate: p.taxRate,
        taxableAmount: Math.round(p.taxableAmount * 100) / 100,
        cgst: Math.round(p.cgst * 100) / 100,
        sgst: Math.round(p.sgst * 100) / 100,
        totalGst: Math.round(p.totalGst * 100) / 100,
        totalAmount: Math.round(p.totalAmount * 100) / 100,
      }))
      .sort((a, b) => b.totalGst - a.totalGst);

    // 3. Transactions feed
    const transactions: Array<{
      type: 'sale' | 'expense' | 'credit_payment' | 'credit_given' | 'return';
      amount: number;
      isCredit: boolean;
      description: string;
      createdAt: string;
      isRemotePrint?: boolean;
    }> = [];

    sales.forEach((s: any) => {
      transactions.push({
        type: 'sale',
        amount: s.grandTotal,
        isCredit: s.paymentMethod === 'credit',
        description: `Sale ${s.invoiceNumber || ''} (${s.paymentMethod.toUpperCase()})`,
        createdAt: s.createdAt.toISOString(),
        isRemotePrint: !!s.isRemotePrint,
      });
    });

    returns.forEach((r: any) => {
      transactions.push({
        type: 'return',
        amount: r.refundAmount,
        isCredit: r.refundMethod === 'credit_reversal' || r.refundMethod === 'store_credit',
        description: `Return ${r.returnNumber} (for ${r.sale?.invoiceNumber || 'Sale'}) [${(r.refundMethod || 'cash').toUpperCase()}]`,
        createdAt: r.createdAt.toISOString(),
      });
    });

    expenses.forEach((e: any) => {
      transactions.push({
        type: 'expense',
        amount: e.amount,
        isCredit: false,
        description: `Expense: ${e.category || e.title || 'Store Expense'}`,
        createdAt: e.expenseDate.toISOString(),
      });
    });

    creditTxns.forEach((tx: any) => {
      transactions.push({
        type: tx.type === 'payment' ? 'credit_payment' : 'credit_given',
        amount: tx.amount,
        isCredit: tx.type === 'credit',
        description: `${tx.type === 'payment' ? 'Payment from' : 'Credit given to'} ${tx.customer?.name || 'Customer'}${tx.notes ? ` (${tx.notes})` : ''}`,
        createdAt: tx.createdAt.toISOString(),
      });
    });

    transactions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    res.json({
      date: targetDate.toISOString().split('T')[0],
      moneyIn,
      moneyOut,
      netBalance,
      creditGiven,
      creditCollectedToday,
      totalReturnsRefunded,
      cashRefunds,
      paymentModeBreakdown,
      gstSummary: {
        collected: Math.round(netGstCollected * 100) / 100,
        grossCollected: Math.round(totalTax * 100) / 100,
        returnedGst: Math.round(totalReturnsTax * 100) / 100,
        paid: Math.round(gstPaid * 100) / 100,
        net: Math.round((netGstCollected - gstPaid) * 100) / 100,
        cgstCollected: Math.round((netGstCollected / 2) * 100) / 100,
        sgstCollected: Math.round((netGstCollected / 2) * 100) / 100,
        products: productGstBreakdown,
      },
      gstCollectedToday: {
        total: netGstCollected,
        cgst: netGstCollected / 2,
        sgst: netGstCollected / 2,
      },
      topSellingItemToday,
      remindersSentToday: 0,
      lowStockAlertCount: lowStockCount,
      transactions: transactions.slice(0, 100),
    });
  } catch (error) {
    console.error('Failed to fetch daybook:', error);
    res.status(500).json({ error: 'Failed to fetch daybook' });
  }
};

export const getDayCloseStatus = async (req: Request, res: Response) => {
  try {
    const userId = await getOwnerUserId((req as any).user.id);
    const dateParam = req.query.date as string;
    const targetDate = dateParam ? new Date(dateParam) : new Date();
    const dayStart = startOfDay(targetDate);
    const dayEnd = endOfDay(targetDate);

    const record = await prisma.dayClose.findFirst({
      where: {
        userId,
        closeDate: { gte: dayStart, lte: dayEnd },
      },
    });

    res.json(record || null);
  } catch (error) {
    console.error('Failed to fetch day close status:', error);
    res.status(500).json({ error: 'Failed to fetch day close status' });
  }
};

export const closeDayRegister = async (req: Request, res: Response) => {
  try {
    const userId = await getOwnerUserId((req as any).user.id);
    const { countedCash, notes } = req.body;
    const todayStart = startOfDay(new Date());
    const todayEnd = endOfDay(new Date());

    // Calculate expected cash = Cash Sales + Cash Credit Payments - Cash Expenses - Cash Returns
    const [cashSales, cashReturns, cashCreditPayments, cashExpenses] = await Promise.all([
      prisma.sale.aggregate({
        where: { userId, createdAt: { gte: todayStart, lte: todayEnd }, paymentMethod: 'cash' },
        _sum: { grandTotal: true },
      }),
      prisma.saleReturn.aggregate({
        where: { userId, createdAt: { gte: todayStart, lte: todayEnd }, refundMethod: 'cash' },
        _sum: { refundAmount: true },
      }),
      prisma.creditTransaction.aggregate({
        where: { userId, createdAt: { gte: todayStart, lte: todayEnd }, type: 'payment' },
        _sum: { amount: true },
      }),
      prisma.expense.aggregate({
        where: { userId, expenseDate: { gte: todayStart, lte: todayEnd } },
        _sum: { amount: true },
      }),
    ]);

    const expectedCash =
      (cashSales._sum.grandTotal || 0) +
      (cashCreditPayments._sum.amount || 0) -
      (cashExpenses._sum.amount || 0) -
      (cashReturns._sum.refundAmount || 0);

    const counted = Number(countedCash) || 0;
    const variance = counted - expectedCash;

    const record = await prisma.dayClose.upsert({
      where: {
        userId_closeDate: {
          userId,
          closeDate: todayStart,
        },
      },
      create: {
        userId,
        closeDate: todayStart,
        expectedCash,
        countedCash: counted,
        variance,
        notes: notes ? String(notes).trim() : null,
      },
      update: {
        expectedCash,
        countedCash: counted,
        variance,
        notes: notes ? String(notes).trim() : null,
      },
    });

    res.status(201).json(record);
  } catch (error: any) {
    handleApiError(res, error, 'Failed to close day register');
  }
};
