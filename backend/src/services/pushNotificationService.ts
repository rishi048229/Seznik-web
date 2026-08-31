import prisma from '../config/db';

export interface PushMessagePayload {
  title: string;
  body: string;
  data?: Record<string, any>;
  sound?: string;
  priority?: 'default' | 'normal' | 'high';
  channelId?: string;
}

/**
 * Sends a push notification to all registered devices for a given user via Expo Push API.
 */
export async function sendPushNotificationToUser(
  userId: string,
  payload: PushMessagePayload
): Promise<{ success: boolean; sentCount: number; error?: string }> {
  try {
    const settings = await prisma.settings.findUnique({
      where: { userId },
      select: { notificationConfig: true },
    });

    const config = (settings?.notificationConfig as Record<string, any>) || {};
    const tokens: string[] = Array.isArray(config.pushTokens) ? config.pushTokens : [];

    // Filter valid Expo Push Tokens
    const validTokens = tokens.filter(
      (token) => typeof token === 'string' && (token.startsWith('ExponentPushToken[') || token.startsWith('ExpoPushToken['))
    );

    if (validTokens.length === 0) {
      return { success: true, sentCount: 0 };
    }

    const messages = validTokens.map((token) => ({
      to: token,
      sound: payload.sound || 'default',
      priority: payload.priority || 'high',
      channelId: payload.channelId || 'inventory-alerts',
      title: payload.title,
      body: payload.body,
      data: {
        ...(payload.data || {}),
        timestamp: new Date().toISOString(),
      },
    }));

    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.warn('[PushNotification] Expo API responded with error:', errText);
      return { success: false, sentCount: 0, error: errText };
    }

    const data = await response.json();
    return { success: true, sentCount: messages.length };
  } catch (err: any) {
    console.error('[PushNotification] Error sending push notification:', err);
    return { success: false, sentCount: 0, error: err?.message || 'Failed to dispatch push' };
  }
}

/**
 * Checks all products for a user and dispatches a low stock push notification if any item is <= threshold.
 */
export async function checkAndSendLowStockPush(userId: string): Promise<number> {
  try {
    const products = await prisma.product.findMany({
      where: { userId, isActive: true },
      select: { id: true, name: true, currentStock: true, lowStockThreshold: true, unit: true },
    });

    const lowStockItems = products.filter(
      (p) => p.currentStock <= (p.lowStockThreshold || 5)
    );

    if (lowStockItems.length === 0) return 0;

    const outOfStock = lowStockItems.filter((p) => p.currentStock <= 0);

    let title = '';
    let body = '';

    if (outOfStock.length > 0) {
      const names = outOfStock.slice(0, 2).map((p) => p.name).join(', ');
      const extra = outOfStock.length > 2 ? ` and ${outOfStock.length - 2} more` : '';
      title = `🚨 Out of Stock: ${outOfStock.length} Item${outOfStock.length > 1 ? 's' : ''}`;
      body = `${names}${extra} ran completely out of stock. Tap to reorder now!`;
    } else {
      const names = lowStockItems.slice(0, 2).map((p) => p.name).join(', ');
      const extra = lowStockItems.length > 2 ? ` and ${lowStockItems.length - 2} more` : '';
      title = `⚠️ Low Stock Alert: ${lowStockItems.length} Item${lowStockItems.length > 1 ? 's' : ''}`;
      body = `${names}${extra} reached reorder level. Tap to restock.`;
    }

    await sendPushNotificationToUser(userId, {
      title,
      body,
      data: { type: 'low_stock_batch', count: lowStockItems.length },
    });

    return lowStockItems.length;
  } catch (err) {
    console.error('[PushNotification] checkAndSendLowStockPush error:', err);
    return 0;
  }
}
