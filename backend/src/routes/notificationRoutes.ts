import { Router } from 'express';
import { protect } from '../middlewares/authMiddleware';
import prisma from '../config/db';
import {
  sendPushNotificationToUser,
  checkAndSendLowStockPush,
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
      // Keep at most 5 recent device tokens per user to prevent unbounded growth
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
 * Unregister a push token (e.g. on user logout)
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
 * Dispatches an immediate test push notification (for verifying closed-app alerts)
 */
router.post('/test-push', protect, async (req: any, res: any) => {
  try {
    const userId = req.user.id;
    const { delaySeconds = 0 } = req.body;

    const sendTest = async () => {
      await sendPushNotificationToUser(userId, {
        title: '🔔 Seznik POS Push Alert',
        body: 'This is a live test notification! Push notifications are working when your app is closed.',
        data: { type: 'test_alert', test: true },
      });
    };

    if (delaySeconds > 0) {
      setTimeout(sendTest, delaySeconds * 1000);
      return res.json({
        success: true,
        message: `Push notification scheduled in ${delaySeconds} seconds. You can now lock/close the app!`,
      });
    }

    const result = await sendPushNotificationToUser(userId, {
      title: '🔔 Seznik POS Push Alert',
      body: 'This is a live test notification! Push notifications are active.',
      data: { type: 'test_alert', test: true },
    });

    return res.json(result);
  } catch (err) {
    console.error('[NotificationRoute] /test-push error:', err);
    return res.status(500).json({ error: 'Failed to send test push' });
  }
});

/**
 * Triggers a stock scan and pushes alerts for any low-stock items
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

export default router;
