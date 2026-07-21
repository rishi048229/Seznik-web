import { Request, Response } from 'express';
import prisma from '../config/db';
import { subDays, startOfDay, endOfDay } from 'date-fns';

const parseDate = (d: any, defaultDate: Date) => {
  if (!d || d === 'undefined' || d === 'null') return defaultDate;
  const parsed = new Date(d as string);
  return isNaN(parsed.getTime()) ? defaultDate : parsed;
};

const parseRangeEnd = (d: any, defaultDate: Date) => endOfDay(parseDate(d, defaultDate));

export const getDashboardStats = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const todayStart = startOfDay(new Date());

    const todaySales = await prisma.sale.findMany({
      where: {
        userId,
        createdAt: { gte: todayStart }
      }
    });

    const activeProducts = await prisma.product.findMany({
      where: { userId, isActive: true }
    });
    const lowStockProducts = activeProducts
      .filter(p => p.currentStock <= p.lowStockThreshold)
      .slice(0, 20);

    const recentSales = await prisma.sale.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 5
    });

    res.json({
      todayRevenue: todaySales.reduce((s, sale) => s + sale.grandTotal, 0),
      todayInvoices: todaySales.length,
      lowStockCount: lowStockProducts.length,
      lowStockProducts: lowStockProducts.map(p => ({
        id: p.id,
        name: p.name,
        currentStock: p.currentStock,
        threshold: p.lowStockThreshold
      })),
      recentSales: recentSales.map(s => ({
        id: s.id,
        invoiceNumber: s.invoiceNumber,
        grandTotal: s.grandTotal,
        createdAt: s.createdAt.getTime()
      }))
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch dashboard stats' });
  }
};

export const getSalesReport = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { start, end } = req.query;

    const sales = await prisma.sale.findMany({
      where: {
        userId,
        createdAt: {
          gte: parseDate(start, new Date(0)),
          lte: parseRangeEnd(end, new Date())
        }
      }
    });

    const dayMap = new Map<string, { revenue: number; count: number }>();
    sales.forEach(sale => {
      const key = sale.createdAt.toISOString().split('T')[0];
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
    const userId = (req as any).user.id;
    const { start, end } = req.query;

    const sales = await prisma.sale.findMany({
      where: {
        userId,
        createdAt: {
          gte: parseDate(start, new Date(0)),
          lte: parseRangeEnd(end, new Date())
        }
      }
    });

    const expenses: any[] = await prisma.$queryRaw`
      SELECT * FROM "Expense" 
      WHERE "userId" = ${userId} 
        AND "expenseDate" >= ${parseDate(start, new Date(0))} 
        AND "expenseDate" <= ${parseRangeEnd(end, new Date())}
    `;

    const totalRevenue = sales.reduce((sum, d) => sum + d.grandTotal, 0);
    const totalExpenses = expenses.reduce((sum, d) => sum + d.amount, 0);
    const totalCost = totalRevenue * 0.6; // Simplified

    res.json({
      totalRevenue,
      totalCost,
      totalExpenses,
      netProfit: totalRevenue - totalCost - totalExpenses,
      period: `${parseDate(start, new Date(0)).toISOString().split('T')[0]} to ${parseRangeEnd(end, new Date()).toISOString().split('T')[0]}`,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch P&L report' });
  }
};

export const getTaxReport = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { start, end } = req.query;

    const sales = await prisma.sale.findMany({
      where: {
        userId,
        createdAt: {
          gte: parseDate(start, new Date(0)),
          lte: parseRangeEnd(end, new Date())
        }
      }
    });

    res.json({
      totalOutputTax: sales.reduce((sum, sale) => sum + sale.totalTax, 0),
      taxableSales: sales.length,
      period: `${parseDate(start, new Date(0)).toISOString().split('T')[0]} to ${parseRangeEnd(end, new Date()).toISOString().split('T')[0]}`,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch tax report' });
  }
};

export const getRevenueTrend = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { days } = req.query;
    const numDays = Number(days) || 7;
    const startDate = startOfDay(subDays(new Date(), numDays - 1));

    const sales = await prisma.sale.findMany({
      where: {
        userId,
        createdAt: { gte: startDate }
      }
    });

    const products = await prisma.product.findMany({ where: { userId } });
    const productCosts = new Map<string, number>();
    products.forEach(p => productCosts.set(p.id, p.costPrice));

    const dayMap = new Map<string, { revenue: number; count: number; profit: number }>();
    sales.forEach(sale => {
      const key = sale.createdAt.toISOString().split('T')[0];
      const existing = dayMap.get(key) ?? { revenue: 0, count: 0, profit: 0 };
      existing.revenue += sale.grandTotal;
      existing.count += 1;

      let totalCost = 0;
      const items: any = sale.items;
      if (items && Array.isArray(items)) {
        items.forEach(item => {
          if (item.productId) {
            totalCost += (productCosts.get(item.productId) ?? 0) * item.quantity;
          }
        });
      }
      existing.profit += sale.grandTotal - sale.totalTax - totalCost;
      dayMap.set(key, existing);
    });

    const labels: string[] = [];
    const revenue: number[] = [];
    const profit: number[] = [];
    for (let i = 0; i < numDays; i++) {
      const date = subDays(new Date(), numDays - 1 - i);
      const key = date.toISOString().split('T')[0];
      const dayLabel = date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
      labels.push(dayLabel);
      const data = dayMap.get(key);
      revenue.push(data?.revenue ?? 0);
      profit.push(data?.profit ?? 0);
    }

    res.json({ labels, revenue, profit });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch revenue trend' });
  }
};

export const getTopCustomers = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const limit = Number(req.query.limit) || 10;

    const sales = await prisma.sale.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: { customer: true }
    });

    const customerMap = new Map<string, { name: string; totalSpent: number; invoiceCount: number; lastPurchase: number }>();

    sales.forEach(sale => {
      const key = sale.customerId ?? 'walk-in';
      const existing = customerMap.get(key) ?? {
        name: sale.customer?.name || 'Walk-in Customer',
        totalSpent: 0,
        invoiceCount: 0,
        lastPurchase: 0,
      };
      existing.totalSpent += sale.grandTotal;
      existing.invoiceCount += 1;
      const saleTime = sale.createdAt.getTime();
      if (saleTime > existing.lastPurchase) existing.lastPurchase = saleTime;
      customerMap.set(key, existing);
    });

    const top = Array.from(customerMap.entries())
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.totalSpent - a.totalSpent)
      .slice(0, limit);

    res.json(top);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch top customers' });
  }
};

export const getPaymentModeBreakdown = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const sales = await prisma.sale.findMany({ where: { userId } });

    const totals = new Map<string, { amount: number; count: number }>();
    let totalSales = 0;
    sales.forEach(sale => {
      const existing = totals.get(sale.paymentMethod) ?? { amount: 0, count: 0 };
      existing.amount += sale.grandTotal;
      existing.count += 1;
      totals.set(sale.paymentMethod, existing);
      totalSales += sale.grandTotal;
    });

    const modes = Array.from(totals.entries())
      .map(([method, data]) => ({
        method,
        amount: data.amount,
        count: data.count,
        percent: totalSales > 0 ? Math.round((data.amount / totalSales) * 100) : 0,
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
    const userId = (req as any).user.id;

    const [sales, products] = await Promise.all([
      prisma.sale.findMany({ where: { userId } }),
      prisma.product.findMany({ where: { userId } }),
    ]);
    const productCosts = new Map<string, number>();
    products.forEach(p => productCosts.set(p.id, p.costPrice));

    let revenue = 0;
    let tax = 0;
    let cost = 0;
    sales.forEach(sale => {
      revenue += sale.grandTotal;
      tax += sale.totalTax;
      const items: any = sale.items;
      if (Array.isArray(items)) {
        items.forEach(item => {
          if (item.productId) {
            cost += (productCosts.get(item.productId) ?? 0) * item.quantity;
          }
        });
      }
    });

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
    const userId = (req as any).user.id;
    const limit = Number(req.query.limit) || 5;

    const sales = await prisma.sale.findMany({ where: { userId } });

    const productMap = new Map<string, { name: string; unitsSold: number; revenue: number }>();
    sales.forEach(sale => {
      const items: any = sale.items;
      if (Array.isArray(items)) {
        items.forEach(item => {
          // productId can be an empty string (POS Lite always sends ''), which must
          // still fall through to name-based grouping rather than merge every such item.
          const key = item.productId || item.productName;
          const existing = productMap.get(key) ?? { name: item.productName, unitsSold: 0, revenue: 0 };
          existing.unitsSold += item.quantity;
          existing.revenue += item.total ?? (item.sellingPrice * item.quantity - (item.discount || 0));
          productMap.set(key, existing);
        });
      }
    });

    const top = Array.from(productMap.entries())
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, limit);

    res.json(top);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch top products' });
  }
};

export const getTopCategories = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const limit = Number(req.query.limit) || 3;

    const [sales, products] = await Promise.all([
      prisma.sale.findMany({ where: { userId } }),
      prisma.product.findMany({ where: { userId }, include: { category: true } }),
    ]);
    const categoryByProductId = new Map<string, string>();
    products.forEach(p => categoryByProductId.set(p.id, p.category?.name || 'Uncategorized'));

    const categoryMap = new Map<string, number>();
    sales.forEach(sale => {
      const items: any = sale.items;
      if (Array.isArray(items)) {
        items.forEach(item => {
          const categoryName = (item.productId && categoryByProductId.get(item.productId)) || 'Uncategorized';
          const revenue = item.total ?? (item.sellingPrice * item.quantity - (item.discount || 0));
          categoryMap.set(categoryName, (categoryMap.get(categoryName) ?? 0) + revenue);
        });
      }
    });

    const sorted = Array.from(categoryMap.entries())
      .map(([name, revenue]) => ({ name, revenue }))
      .sort((a, b) => b.revenue - a.revenue);

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
    const userId = (req as any).user.id;
    const now = new Date();
    const todayStart = startOfDay(now);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [todayExpenses, monthExpenses, allExpenses, allSales, todaySales] = await Promise.all([
      prisma.$queryRaw<any[]>`SELECT * FROM "Expense" WHERE "userId" = ${userId} AND "expenseDate" >= ${todayStart}`,
      prisma.$queryRaw<any[]>`SELECT * FROM "Expense" WHERE "userId" = ${userId} AND "expenseDate" >= ${monthStart}`,
      prisma.$queryRaw<any[]>`SELECT * FROM "Expense" WHERE "userId" = ${userId}`,
      prisma.sale.findMany({ where: { userId } }),
      prisma.sale.findMany({ where: { userId, createdAt: { gte: todayStart } } }),
    ]);

    const today = todayExpenses.reduce((sum, e) => sum + e.amount, 0);
    const thisMonth = monthExpenses.reduce((sum, e) => sum + e.amount, 0);
    const totalExpenses = allExpenses.reduce((sum, e) => sum + e.amount, 0);
    const totalRevenue = allSales.reduce((sum, s) => sum + s.grandTotal, 0);
    const collectionsNonCredit = todaySales
      .filter(s => s.paymentMethod !== 'credit')
      .reduce((sum, s) => sum + s.grandTotal, 0);
    const net = totalRevenue - totalExpenses;

    res.json({ today, thisMonth, collectionsNonCredit, net });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch expense summary' });
  }
};
