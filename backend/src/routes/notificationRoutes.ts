import { Router } from 'express';
import { protect } from '../middlewares/authMiddleware';
import prisma from '../config/db';
import {
  sendPushNotificationToUser,
  checkAndSendLowStockPush,
  checkAndSendCustomerCreditDuePush,
  sendDailyNightSalesSummaryPush,
  sendImportantAnnouncementPush,
} from '../services/pushNotificationService';

const router = Router();

/**
 * Register or update an Expo Push Token for the authenticated merchant
 */
router.post('/register-token', protect, async (req: any, res: any) => {
  try {
    const { pushToken } = req.body;
    const userId = req.user.id;

    if (!pushToken || typeof pushToken !== 'string') {
      return res.status(400).json({ error: 'Valid pushToken string is required' });
    }

    const settings = await prisma.settings.findUnique({ where: { userId } });
    const config = (settings?.notificationConfig as Record<string, any>) || {};
    const tokens: string[] = Array.isArray(config.pushTokens) ? config.pushTokens : [];

    if (!tokens.includes(pushToken)) {
      tokens.push(pushToken);
      const recentTokens = tokens.slice(-5);

      await prisma.settings.upsert({
        where: { userId },
        update: {
          notificationConfig: {
            ...config,
            pushTokens: recentTokens,
            lastTokenRegisteredAt: new Date().toISOString(),
          },
        },
        create: {
          userId,
          notificationConfig: {
            pushTokens: recentTokens,
            lastTokenRegisteredAt: new Date().toISOString(),
          },
        },
      });
    }

    return res.json({ success: true, registered: true });
  } catch (err: any) {
    console.error('[NotificationRoute] /register-token error:', err);
    return res.status(500).json({ error: 'Failed to register push token' });
  }
});

/**
 * Unregister a push token on logout
 */
router.post('/unregister-token', protect, async (req: any, res: any) => {
  try {
    const { pushToken } = req.body;
    const userId = req.user.id;

    if (!pushToken) {
      return res.status(400).json({ error: 'pushToken is required' });
    }

    const settings = await prisma.settings.findUnique({ where: { userId } });
    if (settings?.notificationConfig) {
      const config = settings.notificationConfig as Record<string, any>;
      const tokens: string[] = Array.isArray(config.pushTokens) ? config.pushTokens : [];
      const remaining = tokens.filter((t) => t !== pushToken);

      await prisma.settings.update({
        where: { userId },
        data: {
          notificationConfig: {
            ...config,
            pushTokens: remaining,
          },
        },
      });
    }

    return res.json({ success: true, unregistered: true });
  } catch (err) {
    console.error('[NotificationRoute] /unregister-token error:', err);
    return res.status(500).json({ error: 'Failed to unregister push token' });
  }
});

/**
 * Live Feed of real store notifications (Stock, Customer Credits, Daily Sales, Announcements)
 */
router.get('/feed', protect, async (req: any, res: any) => {
  try {
    const userId = req.user.id;
    const feed: any[] = [];

    // 1. Real Low Stock / Out of Stock Items
    const lowStockProducts = await prisma.product.findMany({
      where: { userId, isActive: true },
      select: { id: true, name: true, currentStock: true, lowStockThreshold: true, unit: true, updatedAt: true },
    });

    for (const p of lowStockProducts) {
      const threshold = p.lowStockThreshold || 5;
      if (p.currentStock <= threshold) {
        const isOutOfStock = p.currentStock <= 0;
        feed.push({
          id: `stock-${p.id}`,
          title: isOutOfStock ? `🚨 Out of Stock: ${p.name}` : `⚠️ Low Stock: ${p.name}`,
          message: isOutOfStock
            ? `"${p.name}" is completely sold out (0 ${p.unit || 'units'} left). Tap to reorder now.`
            : `Only ${p.currentStock} ${p.unit || 'units'} remaining (Threshold: ${threshold}). Tap to restock.`,
          type: isOutOfStock ? 'out_of_stock' : 'low_stock',
          severity: isOutOfStock ? 'critical' : 'urgent',
          productId: p.id,
          productName: p.name,
          currentStock: p.currentStock,
          lowStockThreshold: threshold,
          unit: p.unit || 'piece',
          createdAt: p.updatedAt.toISOString(),
          read: false,
        });
      }
    }

    // 2. Real Customer Credit / Payment Due
    const pendingCustomers = await prisma.customer.findMany({
      where: { userId, creditBalance: { gt: 0 } },
      select: { id: true, name: true, phone: true, creditBalance: true, oldestUnpaidSince: true, updatedAt: true },
      orderBy: { creditBalance: 'desc' },
      take: 5,
    });

    for (const c of pendingCustomers) {
      feed.push({
        id: `credit-${c.id}`,
        title: `💳 Payment Due: ${c.name}`,
        message: `₹${c.creditBalance.toFixed(2)} balance pending from ${c.name}. Tap to view customer ledger.`,
        type: 'credit_due',
        severity: 'warning',
        customerId: c.id,
        customerName: c.name,
        amount: c.creditBalance,
        createdAt: (c.oldestUnpaidSince || c.updatedAt).toISOString(),
        read: false,
      });
    }

    // 3. Today's Real Sales Summary
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todaySales = await prisma.sale.findMany({
      where: { userId, createdAt: { gte: today, lt: tomorrow } },
      select: { id: true, grandTotal: true },
    });

    const ordersCount = todaySales.length;
    const totalSales = todaySales.reduce((sum, s) => sum + (s.grandTotal || 0), 0);

    feed.push({
      id: `sales-summary-${today.toISOString().split('T')[0]}`,
      title: `🌙 Today's Sales Summary: ₹${totalSales.toFixed(2)}`,
      message: ordersCount > 0
        ? `Total ${ordersCount} order${ordersCount > 1 ? 's' : ''} ringed up today generating ₹${totalSales.toFixed(2)} revenue. Tap to view full report.`
        : `Counter is ready! No sales recorded today yet. Tap to view day close summary.`,
      type: 'daily_sales_summary',
      severity: 'info',
      totalSales,
      ordersCount,
      createdAt: new Date().toISOString(),
      read: false,
    });

    // 4. System / Store Announcements
    feed.push({
      id: 'system-announcement-ready',
      title: '📢 Cloud Sync & Backup Active',
      message: 'Your store data is continuously backed up with end-to-end sync. Tap to check system settings.',
      type: 'announcement',
      severity: 'info',
      createdAt: new Date().toISOString(),
      read: false,
    });

    return res.json({ success: true, count: feed.length, notifications: feed });
  } catch (err: any) {
    console.error('[NotificationRoute] /feed error:', err);
    return res.status(500).json({ error: 'Failed to fetch notification feed' });
  }
});

/**
 * 1. Trigger Low Stock Scan & Push
 */
router.post('/check-stock', protect, async (req: any, res: any) => {
  try {
    const userId = req.user.id;
    const count = await checkAndSendLowStockPush(userId);
    return res.json({ success: true, lowStockCount: count });
  } catch (err) {
    console.error('[NotificationRoute] /check-stock error:', err);
    return res.status(500).json({ error: 'Failed to check stock' });
  }
});

/**
 * 2. Trigger Customer Credit Due Check & Push
 */
router.post('/check-credit-due', protect, async (req: any, res: any) => {
  try {
    const userId = req.user.id;
    const count = await checkAndSendCustomerCreditDuePush(userId);
    return res.json({ success: true, customersDueCount: count });
  } catch (err) {
    console.error('[NotificationRoute] /check-credit-due error:', err);
    return res.status(500).json({ error: 'Failed to check customer credit due' });
  }
});

/**
 * 3. Trigger Daily Night Sales Summary Push
 */
router.post('/send-daily-summary', protect, async (req: any, res: any) => {
  try {
    const userId = req.user.id;
    const result = await sendDailyNightSalesSummaryPush(userId);
    return res.json({ success: true, ...result });
  } catch (err) {
    console.error('[NotificationRoute] /send-daily-summary error:', err);
    return res.status(500).json({ error: 'Failed to send daily summary' });
  }
});

/**
 * 4. Trigger Important Store Announcement Push
 */
router.post('/send-announcement', protect, async (req: any, res: any) => {
  try {
    const userId = req.user.id;
    const { title = 'Important Store Update', body = 'Please review your store configurations.' } = req.body;
    const success = await sendImportantAnnouncementPush(userId, title, body);
    return res.json({ success });
  } catch (err) {
    console.error('[NotificationRoute] /send-announcement error:', err);
    return res.status(500).json({ error: 'Failed to send announcement' });
  }
});

export default router;
