import prisma from '../config/db';

export interface PushMessagePayload {
  title: string;
  body: string;
  data?: Record<string, any>;
  sound?: string;
  priority?: 'default' | 'normal' | 'high';
  channelId?: string;
}

/** Shared "hand these tokens + this payload to Expo" call — both the existing broadcast-style
 *  send below and the new per-agent send use this, so there is one place that talks to the Expo
 *  API rather than two copies that could drift. Behavior is unchanged from before this was
 *  extracted; sendPushNotificationToUser calls it with exactly the same messages it built inline. */
async function sendExpoMessages(
  tokens: string[],
  payload: PushMessagePayload
): Promise<{ success: boolean; sentCount: number; error?: string }> {
  const validTokens = tokens.filter(
    (token) =>
      typeof token === 'string' &&
      (token.startsWith('ExponentPushToken[') || token.startsWith('ExpoPushToken['))
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

  return { success: true, sentCount: messages.length };
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

    return await sendExpoMessages(tokens, payload);
  } catch (err: any) {
    console.error('[PushNotification] Error sending push notification:', err);
    return { success: false, sentCount: 0, error: err?.message || 'Failed to dispatch push' };
  }
}

/**
 * Sends a push notification to ONE specific person's registered device(s) — an owner or a
 * ManagedUser (agent), addressed by their raw JWT subject id via the DeviceToken table (see
 * deviceTokenController.ts for why this exists separately from the Settings-based broadcast pool
 * above). Used for remote-print job delivery, where the notification must reach exactly the
 * targeted agent, never the whole business.
 */
export async function sendPushToActor(
  actorId: string,
  payload: PushMessagePayload
): Promise<{ success: boolean; sentCount: number; error?: string }> {
  try {
    const devices = await prisma.deviceToken.findMany({
      where: { actorId },
      select: { expoPushToken: true },
    });
    return await sendExpoMessages(devices.map((d) => d.expoPushToken), payload);
  } catch (err: any) {
    console.error('[PushNotification] Error sending push to actor:', err);
    return { success: false, sentCount: 0, error: err?.message || 'Failed to dispatch push' };
  }
}

/** Same as sendPushToActor, but for every device registered at a location — used for
 *  "first-accept-wins" jobs targeted at a location rather than one named agent. */
export async function sendPushToActors(
  actorIds: string[],
  payload: PushMessagePayload
): Promise<{ success: boolean; sentCount: number; error?: string }> {
  try {
    if (actorIds.length === 0) return { success: true, sentCount: 0 };
    const devices = await prisma.deviceToken.findMany({
      where: { actorId: { in: actorIds } },
      select: { expoPushToken: true },
    });
    return await sendExpoMessages(devices.map((d) => d.expoPushToken), payload);
  } catch (err: any) {
    console.error('[PushNotification] Error sending push to actors:', err);
    return { success: false, sentCount: 0, error: err?.message || 'Failed to dispatch push' };
  }
}

/**
 * 1. Low Stock & Out of Stock Notification
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
    let targetProductId = lowStockItems[0]?.id;

    if (outOfStock.length > 0) {
      const names = outOfStock.slice(0, 2).map((p) => p.name).join(', ');
      const extra = outOfStock.length > 2 ? ` and ${outOfStock.length - 2} more` : '';
      title = `🚨 Out of Stock: ${outOfStock.length} Item${outOfStock.length > 1 ? 's' : ''}`;
      body = `"${names}"${extra} ran completely out of stock. Tap to reorder now!`;
      targetProductId = outOfStock[0]?.id;
    } else {
      const first = lowStockItems[0];
      const names = lowStockItems.slice(0, 2).map((p) => p.name).join(', ');
      const extra = lowStockItems.length > 2 ? ` and ${lowStockItems.length - 2} more` : '';
      title = `⚠️ Low Stock Alert: ${lowStockItems.length} Item${lowStockItems.length > 1 ? 's' : ''}`;
      body = `"${first.name}" has only ${first.currentStock} ${first.unit || 'units'} remaining (Threshold: ${first.lowStockThreshold || 5}). Tap to restock.`;
    }

    await sendPushNotificationToUser(userId, {
      title,
      body,
      data: {
        type: 'low_stock',
        productId: targetProductId,
        lowStockCount: lowStockItems.length,
      },
    });

    return lowStockItems.length;
  } catch (err) {
    console.error('[PushNotification] checkAndSendLowStockPush error:', err);
    return 0;
  }
}

/**
 * 2. Customer Credit / Payment Due Reminder Notification
 */
export async function checkAndSendCustomerCreditDuePush(userId: string): Promise<number> {
  try {
    const customersWithDue = await prisma.customer.findMany({
      where: {
        userId,
        creditBalance: { gt: 0 },
      },
      select: {
        id: true,
        name: true,
        phone: true,
        creditBalance: true,
        oldestUnpaidSince: true,
      },
      orderBy: { creditBalance: 'desc' },
      take: 10,
    });

    if (customersWithDue.length === 0) return 0;

    const topCustomer = customersWithDue[0];
    const totalDue = customersWithDue.reduce((sum, c) => sum + c.creditBalance, 0);

    const title = `💳 Payment Due: ${customersWithDue.length} Customer${customersWithDue.length > 1 ? 's' : ''} (₹${totalDue.toFixed(0)})`;
    const body = `₹${topCustomer.creditBalance.toFixed(0)} pending from ${topCustomer.name}. Tap to view credit ledger & send WhatsApp reminder.`;

    await sendPushNotificationToUser(userId, {
      title,
      body,
      data: {
        type: 'credit_due',
        customerId: topCustomer.id,
        customerName: topCustomer.name,
        totalDue,
        dueCount: customersWithDue.length,
      },
    });

    return customersWithDue.length;
  } catch (err) {
    console.error('[PushNotification] checkAndSendCustomerCreditDuePush error:', err);
    return 0;
  }
}

/**
 * 3. Daily Night Total Sales Summary Notification
 */
export async function sendDailyNightSalesSummaryPush(userId: string): Promise<{ totalSales: number; ordersCount: number }> {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const salesToday = await prisma.sale.findMany({
      where: {
        userId,
        createdAt: {
          gte: today,
          lt: tomorrow,
        },
      },
      select: {
        id: true,
        grandTotal: true,
        paymentMethod: true,
      },
    });

    const ordersCount = salesToday.length;
    const totalSales = salesToday.reduce((sum, s) => sum + (s.grandTotal || 0), 0);

    const title = `🌙 Today's Sales Summary: ₹${totalSales.toFixed(2)}`;
    const body = ordersCount > 0
      ? `Total ${ordersCount} bill${ordersCount > 1 ? 's' : ''} ringed up today generating ₹${totalSales.toFixed(2)} revenue. Tap to view full day-end report.`
      : `No sales recorded today yet. Tap to review your counter status and day close.`;

    await sendPushNotificationToUser(userId, {
      title,
      body,
      data: {
        type: 'daily_sales_summary',
        totalSales,
        ordersCount,
        date: today.toISOString().split('T')[0],
      },
    });

    return { totalSales, ordersCount };
  } catch (err) {
    console.error('[PushNotification] sendDailyNightSalesSummaryPush error:', err);
    return { totalSales: 0, ordersCount: 0 };
  }
}

/**
 * 4. Important System & Store Announcements Notification
 */
export async function sendImportantAnnouncementPush(
  userId: string,
  title: string,
  body: string,
  extraData?: Record<string, any>
): Promise<boolean> {
  const result = await sendPushNotificationToUser(userId, {
    title: `📢 ${title}`,
    body,
    data: {
      type: 'announcement',
      ...(extraData || {}),
    },
  });
  return result.success;
}

/**
 * 5. Paper Rolls & Label Supplies Refill Reminder
 */
export async function sendPaperRollsRefillPush(userId: string): Promise<boolean> {
  const title = '🧻 Thermal Paper & Label Refill Alert';
  const body = 'Low on 58mm/80mm thermal rolls or barcode stickers? Stock up now to prevent checkout delays!';
  const result = await sendPushNotificationToUser(userId, {
    title,
    body,
    data: {
      type: 'supplies_refill',
      actionUrl: '/printers',
    },
  });
  return result.success;
}

/**
 * 6. New Product Launch / Catalog Announcement
 */
export async function sendNewProductLaunchPush(
  userId: string,
  payload: { productName: string; price?: number; category?: string }
): Promise<boolean> {
  const priceStr = payload.price !== undefined ? ` at ₹${payload.price.toFixed(2)}` : '';
  const title = `🎉 New Launch: ${payload.productName}`;
  const body = `"${payload.productName}"${priceStr} is now live and ready for billing. Tap to view catalog!`;
  const result = await sendPushNotificationToUser(userId, {
    title,
    body,
    data: {
      type: 'product_launch',
      productName: payload.productName,
      actionUrl: '/products',
    },
  });
  return result.success;
}

/**
 * 7. Feature Highlight & Merchant Tip
 */
export async function sendFeatureTipPush(
  userId: string,
  tipType: 'barcode_studio' | 'whatsapp_receipt' | 'offline_pos' = 'barcode_studio'
): Promise<boolean> {
  const tips: Record<string, { title: string; body: string; url: string }> = {
    barcode_studio: {
      title: '🏷️ Pro Tip: Custom Barcode Label Printing',
      body: 'Generate and print custom 50x30mm / 40x30mm barcode price tags in 1-tap from Label Studio!',
      url: '/products',
    },
    whatsapp_receipt: {
      title: '💬 Instant WhatsApp & UPI QR Invoicing',
      body: 'Print dynamic UPI payment QR codes on every bill or share digital invoices on customer WhatsApp in seconds.',
      url: '/settings',
    },
    offline_pos: {
      title: '⚡ Lightning Fast Offline Billing',
      body: 'Seznik POS works seamlessly even if internet drops. Sales sync automatically when connection restores!',
      url: '/(tabs)/pos',
    },
  };

  const selected = tips[tipType] || tips.barcode_studio;
  const result = await sendPushNotificationToUser(userId, {
    title: selected.title,
    body: selected.body,
    data: {
      type: 'feature_tip',
      actionUrl: selected.url,
    },
  });
  return result.success;
}

/**
 * 8. Weekly Business Performance Summary (Sundays)
 */
export async function sendWeeklySummaryPush(userId: string): Promise<boolean> {
  try {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    weekAgo.setHours(0, 0, 0, 0);

    const weekSales = await prisma.sale.findMany({
      where: {
        userId,
        createdAt: { gte: weekAgo },
      },
      select: { grandTotal: true },
    });

    const ordersCount = weekSales.length;
    const totalSales = weekSales.reduce((sum, s) => sum + (s.grandTotal || 0), 0);

    const title = `📊 Weekly Performance: ₹${totalSales.toFixed(2)}`;
    const body = `This week your store completed ${ordersCount} bills generating ₹${totalSales.toFixed(2)}. Tap to view weekly trends.`;

    const result = await sendPushNotificationToUser(userId, {
      title,
      body,
      data: {
        type: 'weekly_summary',
        totalSales,
        ordersCount,
        actionUrl: '/reports',
      },
    });
    return result.success;
  } catch (err) {
    console.error('[PushNotification] sendWeeklySummaryPush error:', err);
    return false;
  }
}

/**
 * 9. Supplier Payables & Bill Due Date Reminder Push
 */
export async function checkAndSendSupplierPayableDuePush(userId: string): Promise<number> {
  try {
    const suppliersWithDue = await prisma.supplier.findMany({
      where: {
        userId,
        payableBalance: { gt: 0 },
      },
      select: {
        id: true,
        name: true,
        phone: true,
        payableBalance: true,
      },
      orderBy: { payableBalance: 'desc' },
      take: 10,
    });

    if (suppliersWithDue.length === 0) return 0;

    const topSupplier = suppliersWithDue[0];
    const totalPayable = suppliersWithDue.reduce((sum, s) => sum + s.payableBalance, 0);

    const title = `🏢 Supplier Payment Due: ${suppliersWithDue.length} Vendor${suppliersWithDue.length > 1 ? 's' : ''} (₹${totalPayable.toFixed(0)})`;
    const body = `₹${topSupplier.payableBalance.toFixed(0)} payable to ${topSupplier.name}. Tap to view supplier ledger & record payment.`;

    await sendPushNotificationToUser(userId, {
      title,
      body,
      data: {
        type: 'purchase_due',
        supplierId: topSupplier.id,
        supplierName: topSupplier.name,
        totalPayable,
        dueCount: suppliersWithDue.length,
        actionUrl: `/suppliers/${topSupplier.id}`,
      },
    });

    return suppliersWithDue.length;
  } catch (err) {
    console.error('[PushNotification] checkAndSendSupplierPayableDuePush error:', err);
    return 0;
  }
}

