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

    const expenses = await prisma.expense.findMany({
      where: {
        userId,
        date: {
          gte: parseDate(start, new Date(0)),
          lte: parseRangeEnd(end, new Date())
        }
      }
    });

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
