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
