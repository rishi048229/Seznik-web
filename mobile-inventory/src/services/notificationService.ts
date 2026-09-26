import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';

export type StockAlertSeverity = 'critical' | 'urgent' | 'warning';

export interface FormattedStockMessage {
  title: string;
  body: string;
  severity: StockAlertSeverity;
  badgeCount?: number;
}

let cachedNotifications: any = null;
let isChannelInitialized = false;

/**
 * Checks if the native ExpoPushTokenManager module is compiled into the current binary.
 * Uses requireOptionalNativeModule which returns null without throwing if absent.
 */
export function isExpoNotificationsSupported(): boolean {
  if (Platform.OS === 'web') return false;
  try {
    const nativeManager = requireOptionalNativeModule('ExpoPushTokenManager');
    return !!nativeManager;
  } catch {
    return false;
  }
}

/**
 * Safely resolves the expo-notifications module only if the native module is present.
 */
export function getSafeNotificationsModule(): any | null {
  if (cachedNotifications) return cachedNotifications;
  if (!isExpoNotificationsSupported()) return null;

  try {
    const mod = require('expo-notifications');
    cachedNotifications = mod;

    if (typeof mod?.setNotificationHandler === 'function') {
      mod.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
          shouldShowBanner: true,
          shouldShowList: true,
        }),
      });
    }

    return mod;
  } catch {
    return null;
  }
}

/**
 * Evaluates conditional rules for a product's stock and formats a high-impact message.
 */
export function formatLowStockNotification(product: {
  id?: string;
  name: string;
  currentStock: number;
  lowStockThreshold: number;
  unit?: string;
}): FormattedStockMessage {
  const stock = product.currentStock;
  const threshold = product.lowStockThreshold;
  const unitStr = product.unit ? ` ${product.unit}` : ' units';
  const name = product.name?.trim() || 'Product';

  // Condition 1: Out of stock (0 or negative)
  if (stock <= 0) {
    return {
      title: `🚨 Out of Stock: ${name}`,
      body: `"${name}" has completely run out of stock (0${unitStr} left). Tap to restock now and prevent lost sales!`,
      severity: 'critical',
    };
  }

  // Condition 2: Critical low stock (at or below half the threshold, or <= 2)
  const halfThreshold = Math.max(1, Math.floor(threshold / 2));
  if (stock <= halfThreshold) {
    return {
      title: `⚠️ Critical Stock Alert: ${name}`,
      body: `Only ${stock}${unitStr} remaining for "${name}" (Threshold: ${threshold}${unitStr}). Reorder immediately!`,
      severity: 'urgent',
    };
  }

  // Condition 3: Approaching/at reorder threshold
  return {
    title: `📦 Low Stock Warning: ${name}`,
    body: `"${name}" reached its reorder level with ${stock}${unitStr} remaining (Threshold: ${threshold}${unitStr}).`,
    severity: 'warning',
  };
}

/**
 * Evaluates batch low stock for multiple products and formats a consolidated alert.
 */
export function formatBatchLowStockNotification(
  products: { name: string; currentStock: number; lowStockThreshold: number; unit?: string }[]
): FormattedStockMessage {
  const count = products.length;
  const sampleNames = products.slice(0, 3).map((p) => p.name).join(', ');
  const remainder = count > 3 ? ` and ${count - 3} other item${count - 3 > 1 ? 's' : ''}` : '';

  const outOfStockCount = products.filter((p) => p.currentStock <= 0).length;

  if (outOfStockCount > 0) {
    return {
      title: `🚨 Inventory Alert: ${count} Items Need Attention`,
      body: `${outOfStockCount} item${outOfStockCount > 1 ? 's are' : ' is'} completely out of stock (${sampleNames}${remainder}). Tap to review and restock.`,
      severity: 'critical',
    };
  }

  return {
    title: `⚠️ Low Stock Alert: ${count} Items Reached Reorder Level`,
    body: `${sampleNames}${remainder} are running low on stock. Tap to reorder.`,
    severity: 'urgent',
  };
}

/**
 * Configures Android notification channel with high priority sound and vibration.
 */
export async function initializeNotificationChannel(): Promise<void> {
  if (isChannelInitialized || Platform.OS !== 'android') return;

  const Notifications = getSafeNotificationsModule();
  if (!Notifications || typeof Notifications.setNotificationChannelAsync !== 'function') {
    return;
  }

  try {
    await Notifications.setNotificationChannelAsync('inventory-alerts', {
      name: 'Inventory & Stock Alerts',
      description: 'Notifications for low stock, out of stock, and critical reorder points.',
      importance: Notifications.AndroidImportance?.HIGH ?? 4,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#EF4444',
      enableLights: true,
      enableVibrate: true,
      showBadge: true,
    });
    await Notifications.setNotificationChannelAsync('remote-print', {
      name: 'Remote Print Requests',
      description: 'A receipt was sent to this phone to print — tap to accept or decline.',
      importance: Notifications.AndroidImportance?.MAX ?? 5,
      vibrationPattern: [0, 300, 150, 300],
      lightColor: '#2563EB',
      enableLights: true,
      enableVibrate: true,
      showBadge: true,
    });
    await Notifications.setNotificationChannelAsync('daybook-alerts', {
      name: 'Daybook & Sales Summary',
      description: 'End-of-day sales and cashflow reminders.',
      importance: Notifications.AndroidImportance?.HIGH ?? 4,
      vibrationPattern: [0, 200, 100, 200],
      lightColor: '#10B981',
      enableLights: true,
      enableVibrate: true,
      showBadge: true,
    });
    isChannelInitialized = true;
  } catch (err) {
    console.warn('[NotificationService] Failed to set Android notification channel:', err);
  }
}

/**
 * Requests device notification permissions safely.
 */
export async function requestNotificationPermissions(): Promise<boolean> {
  if (Platform.OS === 'web') return false;

  const Notifications = getSafeNotificationsModule();
  if (!Notifications || typeof Notifications.getPermissionsAsync !== 'function') {
    return false;
  }

  try {
    await initializeNotificationChannel();
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    return finalStatus === 'granted';
  } catch (err) {
    console.warn('[NotificationService] Error requesting notification permissions:', err);
    return false;
  }
}

/**
 * Dispatches an instant system local notification for a low stock event.
 */
export async function dispatchLocalStockNotification(params: {
  title: string;
  body: string;
  productId?: string;
  productName?: string;
  currentStock?: number;
  threshold?: number;
  severity?: StockAlertSeverity;
  delaySeconds?: number;
  data?: Record<string, any>;
}): Promise<string | null> {
  if (Platform.OS === 'web') {
    return null;
  }

  const Notifications = getSafeNotificationsModule();
  if (!Notifications || typeof Notifications.scheduleNotificationAsync !== 'function') {
    return null;
  }

  try {
    await initializeNotificationChannel();

    const priority = Notifications.AndroidNotificationPriority?.HIGH ?? 2;

    const trigger =
      typeof params.delaySeconds === 'number' && params.delaySeconds > 0
        ? {
            type: Notifications.SchedulableTriggerInputTypes?.TIME_INTERVAL || 'timeInterval',
            seconds: params.delaySeconds,
            channelId: 'inventory-alerts',
          }
        : null;

    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: params.title,
        body: params.body,
        sound: true,
        priority,
        vibrate: [0, 250, 250, 250],
        data: {
          type: 'low_stock',
          productId: params.productId,
          productName: params.productName,
          currentStock: params.currentStock,
          threshold: params.threshold,
          severity: params.severity || 'warning',
          ...(params.data || {}),
        },
      },
      trigger: trigger as any,
    });

    return notificationId;
  } catch (err) {
    console.warn('[NotificationService] Failed to schedule system notification:', err);
    return null;
  }
}

/** Surfaces a remote print job outside the app when push delivery is delayed or denied. */
export async function dispatchRemotePrintLocalNotification(params: {
  printJobId: string;
  title: string;
  body: string;
  jobType?: 'receipt' | 'kot';
}): Promise<string | null> {
  return dispatchSystemNotification({
    title: params.title,
    body: params.body,
    type: 'remote_print_job',
    channelId: 'remote-print',
    data: {
      printJobId: params.printJobId,
      jobType: params.jobType || 'receipt',
      screen: `/print-jobs/${params.printJobId}`,
    },
  });
}

/**
 * Dispatches an instant or scheduled system notification.
 */
export async function dispatchSystemNotification(params: {
  title: string;
  body: string;
  type: string;
  severity?: StockAlertSeverity | 'info';
  channelId?: string;
  delaySeconds?: number;
  data?: Record<string, any>;
}): Promise<string | null> {
  if (Platform.OS === 'web') {
    return null;
  }

  const Notifications = getSafeNotificationsModule();
  if (!Notifications || typeof Notifications.scheduleNotificationAsync !== 'function') {
    return null;
  }

  try {
    await initializeNotificationChannel();

    const priority = Notifications.AndroidNotificationPriority?.HIGH ?? 2;

    const trigger =
      typeof params.delaySeconds === 'number' && params.delaySeconds > 0
        ? {
            type: Notifications.SchedulableTriggerInputTypes?.TIME_INTERVAL || 'timeInterval',
            seconds: params.delaySeconds,
            channelId: params.channelId || 'inventory-alerts',
          }
        : null;

    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: params.title,
        body: params.body,
        sound: true,
        priority,
        vibrate: [0, 250, 250, 250],
        data: {
          type: params.type,
          severity: params.severity || 'info',
          ...(params.data || {}),
        },
      },
      trigger: trigger as any,
    });

    return notificationId;
  } catch (err) {
    console.warn('[NotificationService] Failed to schedule system notification:', err);
    return null;
  }
}

/**
 * Formats and dispatches a Day Book / Total daily collection summary notification.
 */
export async function dispatchDayBookNotification(summary: {
  totalSales: number;
  ordersCount: number;
  dateStr?: string;
}): Promise<string | null> {
  const formattedSales = `₹${(summary.totalSales || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
  const title = `📊 Day Book: ${formattedSales} Collected Today`;
  const body = `Total collection: ${formattedSales} across ${summary.ordersCount || 0} bills. Tap to open full Day Book report.`;

  return dispatchSystemNotification({
    title,
    body,
    type: 'daily_sales_summary',
    severity: 'info',
    data: {
      type: 'daily_sales_summary',
      screen: '/reports',
      totalSales: summary.totalSales,
      ordersCount: summary.ordersCount,
    },
  });
}

/**
 * Formats and dispatches a Customer Credit balance reminder notification.
 */
export async function dispatchCreditReminderNotification(customer: {
  id?: string;
  name: string;
  amountDue: number;
  phone?: string;
}): Promise<string | null> {
  const formattedAmount = `₹${(customer.amountDue || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
  const title = `💳 Credit Reminder: ${customer.name}`;
  const body = `${customer.name} has ${formattedAmount} pending payment. Tap to view customer ledger and send WhatsApp reminder.`;

  return dispatchSystemNotification({
    title,
    body,
    type: 'credit_due',
    severity: 'urgent',
    data: {
      type: 'credit_due',
      screen: '/credits',
      customerId: customer.id,
      customerName: customer.name,
      amount: customer.amountDue,
    },
  });
}

/**
 * Handles deep-link routing when any system notification is tapped by the user.
 */
export function handleNotificationNavigation(data: any, router: any): void {
  if (!data || !router) return;

  try {
    // 1. Direct explicit screen link
    if (data.screen) {
      router.push(data.screen);
      return;
    }

    // 2. Action URL
    if (data.actionUrl) {
      router.push(data.actionUrl);
      return;
    }

    // 3. Low stock / Out of stock -> Navigate to products catalog
    if (
      data.type === 'low_stock' ||
      data.type === 'out_of_stock' ||
      data.type === 'critical_stock' ||
      data.productId
    ) {
      router.push('/products');
      return;
    }

    // 4. Day Book / Daily sales summary -> Navigate to reports
    if (data.type === 'daily_sales_summary' || data.type === 'daybook') {
      router.push('/reports');
      return;
    }

    // 5. Credit / Payment Due -> Navigate to credits ledger
    if (data.type === 'credit_due' || data.type === 'payment_due' || data.customerId) {
      router.push('/credits');
      return;
    }

    // 6. Invoices / Sales
    if (data.type === 'invoice' || data.invoiceId) {
      router.push('/(tabs)/invoices');
      return;
    }
  } catch (err) {
    console.warn('[NotificationService] Deep link navigation failed:', err);
  }
}

/**
 * Subscribes safely to notification tap/response events for deep linking.
 */
export function subscribeToNotificationResponses(onResponse: (data: any) => void): () => void {
  const Notifications = getSafeNotificationsModule();
  if (!Notifications || typeof Notifications.addNotificationResponseReceivedListener !== 'function') {
    return () => {};
  }

  try {
    const subscription = Notifications.addNotificationResponseReceivedListener((response: any) => {
      const data = response?.notification?.request?.content?.data;
      onResponse(data);
    });

    return () => {
      if (subscription && typeof subscription.remove === 'function') {
        subscription.remove();
      }
    };
  } catch {
    return () => {};
  }
}

/**
 * Schedules a repeating local reminder so daybook closing still surfaces when the app is closed
 * (remote Expo push alone can miss Android Doze / missing FCM config).
 */
export async function scheduleDailyDaybookReminder(hour = 21, minute = 0): Promise<void> {
  if (Platform.OS === 'web') return;

  const Notifications = getSafeNotificationsModule();
  if (
    !Notifications ||
    typeof Notifications.scheduleNotificationAsync !== 'function' ||
    typeof Notifications.getAllScheduledNotificationsAsync !== 'function'
  ) {
    return;
  }

  try {
    await initializeNotificationChannel();
    const existing = await Notifications.getAllScheduledNotificationsAsync();
    const already = (existing || []).some(
      (n: any) => n?.content?.data?.type === 'daybook' && n?.identifier === 'seznik-daybook-daily'
    );
    if (already) return;

    await Notifications.scheduleNotificationAsync({
      identifier: 'seznik-daybook-daily',
      content: {
        title: 'Daybook closing reminder',
        body: 'Review today’s cashflow and settle the daybook before you leave.',
        data: { type: 'daybook', screen: '/credits' },
        sound: true,
        ...(Platform.OS === 'android' ? { channelId: 'daybook-alerts' } : {}),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes?.DAILY || 'daily',
        hour,
        minute,
        ...(Platform.OS === 'android' ? { channelId: 'daybook-alerts' } : {}),
      },
    });
  } catch (err) {
    console.warn('[NotificationService] Failed to schedule daybook reminder:', err);
  }
}
