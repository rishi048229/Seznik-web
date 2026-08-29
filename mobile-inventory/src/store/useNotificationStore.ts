import { create } from 'zustand';
import { Product } from '@/types/product';
import {
  formatLowStockNotification,
  dispatchLocalStockNotification,
  requestNotificationPermissions,
  StockAlertSeverity,
} from '@/services/notificationService';
import {
  getStoredNotifications,
  setStoredNotifications,
  getStoredNotificationPreferences,
  setStoredNotificationPreferences,
} from '@/services/secureStore';

export type NotificationType = 'out_of_stock' | 'critical_stock' | 'low_stock' | 'system';

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: NotificationType;
  severity: StockAlertSeverity | 'info';
  productId?: string;
  productName?: string;
  currentStock?: number;
  lowStockThreshold?: number;
  unit?: string;
  read: boolean;
  createdAt: string;
}

export interface NotificationPreferences {
  lowStockAlertsEnabled: boolean;
  outOfStockAlertsEnabled: boolean;
  pushNotificationsEnabled: boolean;
  soundEnabled: boolean;
  minimumThresholdMultiplier: number;
}

const DEFAULT_PREFERENCES: NotificationPreferences = {
  lowStockAlertsEnabled: true,
  outOfStockAlertsEnabled: true,
  pushNotificationsEnabled: true,
  soundEnabled: true,
  minimumThresholdMultiplier: 1.0,
};

// 10 minutes cooldown per product per exact stock level to avoid redundant noise while allowing rapid updates
const NOTIFICATION_COOLDOWN_MS = 10 * 60 * 1000;

interface NotificationState {
  notifications: AppNotification[];
  unreadCount: number;
  preferences: NotificationPreferences;
  isHydrated: boolean;
  activeBanner: AppNotification | null;
  lastNotifiedMap: Record<string, { stock: number; timestamp: number }>;

  hydrate: () => Promise<void>;
  dismissBanner: () => void;
  addNotification: (
    item: Omit<AppNotification, 'id' | 'createdAt' | 'read'> & { id?: string }
  ) => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (id: string) => Promise<void>;
  clearAllNotifications: () => Promise<void>;
  updatePreferences: (partial: Partial<NotificationPreferences>) => Promise<void>;

  /**
   * Main conditional evaluation engine: inspects product catalog and fires alerts for low/out-of-stock items.
   */
  evaluateStockConditions: (products: (Product | any)[]) => Promise<void>;

  /**
   * Evaluates stock levels for items immediately following a sale or deduction.
   */
  checkSoldItemsStock: (
    items: {
      productId: string;
      productName?: string;
      currentStock: number;
      lowStockThreshold: number;
      unit?: string;
    }[]
  ) => Promise<void>;

  /**
   * Sends a diagnostic test notification so the user can verify notifications.
   */
  sendTestNotification: () => Promise<void>;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  preferences: DEFAULT_PREFERENCES,
  isHydrated: false,
  activeBanner: null,
  lastNotifiedMap: {},

  hydrate: async () => {
    try {
      const storedNotifsJson = await getStoredNotifications();
      let notifs: AppNotification[] = [];
      if (storedNotifsJson) {
        try {
          notifs = JSON.parse(storedNotifsJson);
        } catch {}
      }

      const storedPrefsJson = await getStoredNotificationPreferences();
      let prefs = DEFAULT_PREFERENCES;
      if (storedPrefsJson) {
        try {
          prefs = { ...DEFAULT_PREFERENCES, ...JSON.parse(storedPrefsJson) };
        } catch {}
      }

      const unread = notifs.filter((n) => !n.read).length;
      set({
        notifications: notifs,
        unreadCount: unread,
        preferences: prefs,
        isHydrated: true,
      });

      // Request notification permissions gracefully on hydration
      if (prefs.pushNotificationsEnabled) {
        requestNotificationPermissions().catch(() => {});
      }
    } catch {
      set({ isHydrated: true });
    }
  },

  dismissBanner: () => {
    set({ activeBanner: null });
  },

  addNotification: async (item) => {
    const { notifications, preferences } = get();
    const cleanStock = item.currentStock !== undefined ? Math.max(0, item.currentStock) : undefined;
    const cleanThreshold = item.lowStockThreshold !== undefined ? Math.max(0, item.lowStockThreshold) : undefined;

    const newNotif: AppNotification = {
      id: item.id || `notif_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      title: item.title,
      message: item.message,
      type: item.type,
      severity: item.severity,
      productId: item.productId,
      productName: item.productName,
      currentStock: cleanStock,
      lowStockThreshold: cleanThreshold,
      unit: item.unit,
      read: false,
      createdAt: new Date().toISOString(),
    };

    // Keep max 100 recent notifications to maintain snappy performance
    const updated = [newNotif, ...notifications].slice(0, 100);
    const unread = updated.filter((n) => !n.read).length;

    // Trigger in-app toast popup banner & update store
    set({
      notifications: updated,
      unreadCount: unread,
      activeBanner: newNotif,
    });

    await setStoredNotifications(JSON.stringify(updated));

    // Dispatch system local notification if push notifications are enabled
    if (preferences.pushNotificationsEnabled) {
      await dispatchLocalStockNotification({
        title: newNotif.title,
        body: newNotif.message,
        productId: newNotif.productId,
        productName: newNotif.productName,
        currentStock: newNotif.currentStock,
        threshold: newNotif.lowStockThreshold,
        severity: item.severity !== 'info' ? item.severity : 'warning',
      });
    }
  },

  markAsRead: async (id) => {
    const { notifications } = get();
    const updated = notifications.map((n) => (n.id === id ? { ...n, read: true } : n));
    const unread = updated.filter((n) => !n.read).length;
    set({ notifications: updated, unreadCount: unread });
    await setStoredNotifications(JSON.stringify(updated));
  },

  markAllAsRead: async () => {
    const { notifications } = get();
    const updated = notifications.map((n) => ({ ...n, read: true }));
    set({ notifications: updated, unreadCount: 0 });
    await setStoredNotifications(JSON.stringify(updated));
  },

  deleteNotification: async (id) => {
    const { notifications } = get();
    const updated = notifications.filter((n) => n.id !== id);
    const unread = updated.filter((n) => !n.read).length;
    set({ notifications: updated, unreadCount: unread });
    await setStoredNotifications(JSON.stringify(updated));
  },

  clearAllNotifications: async () => {
    set({ notifications: [], unreadCount: 0, activeBanner: null });
    await setStoredNotifications(JSON.stringify([]));
  },

  updatePreferences: async (partial) => {
    const { preferences } = get();
    const updated = { ...preferences, ...partial };
    set({ preferences: updated });
    await setStoredNotificationPreferences(JSON.stringify(updated));

    if (updated.pushNotificationsEnabled) {
      requestNotificationPermissions().catch(() => {});
    }
  },

  evaluateStockConditions: async (products) => {
    if (!products || !Array.isArray(products) || products.length === 0) return;
    const { preferences, lastNotifiedMap, addNotification } = get();

    if (!preferences.lowStockAlertsEnabled && !preferences.outOfStockAlertsEnabled) {
      return;
    }

    const now = Date.now();
    const newlyUpdatedNotifiedMap = { ...lastNotifiedMap };

    for (const prod of products) {
      if (prod.archived || prod.isActive === false) continue;

      const rawStock = typeof prod.currentStock === 'number' ? prod.currentStock : (prod.stockQty ?? 0);
      const stock = Math.max(0, rawStock);
      const threshold = Math.max(
        0,
        typeof prod.lowStockThreshold === 'number'
          ? prod.lowStockThreshold
          : (prod.reorderThreshold ?? 5)
      );

      // Check conditions
      const isOutOfStock = stock <= 0;
      const isLowStock = stock > 0 && stock <= threshold * preferences.minimumThresholdMultiplier;

      if (!isOutOfStock && !isLowStock) {
        // Stock is healthy, clear any prior cooldown so future dips alert promptly
        delete newlyUpdatedNotifiedMap[prod.id];
        continue;
      }

      if (isOutOfStock && !preferences.outOfStockAlertsEnabled) continue;
      if (isLowStock && !preferences.lowStockAlertsEnabled) continue;

      // Check cooldown & de-duplication
      const lastNotified = newlyUpdatedNotifiedMap[prod.id];
      if (lastNotified) {
        const timeSince = now - lastNotified.timestamp;
        const stockUnchanged = lastNotified.stock === stock;
        // Don't repeat identical alert within cooldown window unless stock dropped further
        if (stockUnchanged && timeSince < NOTIFICATION_COOLDOWN_MS) {
          continue;
        }
      }

      // Format conditional notification message
      const formatted = formatLowStockNotification({
        id: prod.id,
        name: prod.name || 'Product',
        currentStock: stock,
        lowStockThreshold: threshold,
        unit: prod.unit,
      });

      const notifType: NotificationType = isOutOfStock
        ? 'out_of_stock'
        : formatted.severity === 'urgent'
        ? 'critical_stock'
        : 'low_stock';

      newlyUpdatedNotifiedMap[prod.id] = { stock, timestamp: now };

      await addNotification({
        title: formatted.title,
        message: formatted.body,
        type: notifType,
        severity: formatted.severity,
        productId: prod.id,
        productName: prod.name,
        currentStock: stock,
        lowStockThreshold: threshold,
        unit: prod.unit,
      });
    }

    set({ lastNotifiedMap: newlyUpdatedNotifiedMap });
  },

  checkSoldItemsStock: async (items) => {
    if (!items || items.length === 0) return;
    const { preferences, addNotification, lastNotifiedMap } = get();

    if (!preferences.lowStockAlertsEnabled && !preferences.outOfStockAlertsEnabled) {
      return;
    }

    const now = Date.now();
    const updatedMap = { ...lastNotifiedMap };

    for (const item of items) {
      const stock = Math.max(0, item.currentStock);
      const threshold = Math.max(0, item.lowStockThreshold);

      const isOutOfStock = stock <= 0;
      const isLowStock = stock > 0 && stock <= threshold * preferences.minimumThresholdMultiplier;

      if (!isOutOfStock && !isLowStock) continue;
      if (isOutOfStock && !preferences.outOfStockAlertsEnabled) continue;
      if (isLowStock && !preferences.lowStockAlertsEnabled) continue;

      const formatted = formatLowStockNotification({
        id: item.productId,
        name: item.productName || 'Product',
        currentStock: stock,
        lowStockThreshold: threshold,
        unit: item.unit,
      });

      const notifType: NotificationType = isOutOfStock
        ? 'out_of_stock'
        : formatted.severity === 'urgent'
        ? 'critical_stock'
        : 'low_stock';

      updatedMap[item.productId] = { stock, timestamp: now };

      await addNotification({
        title: formatted.title,
        message: formatted.body,
        type: notifType,
        severity: formatted.severity,
        productId: item.productId,
        productName: item.productName,
        currentStock: stock,
        lowStockThreshold: threshold,
        unit: item.unit,
      });
    }

    set({ lastNotifiedMap: updatedMap });
  },

  sendTestNotification: async () => {
    const { addNotification } = get();
    await addNotification({
      title: '📦 Low Stock Alert (Test Demo)',
      message: 'Organic Almond Milk has 3 bottles remaining (Reorder Threshold: 10 bottles). Restock soon!',
      type: 'low_stock',
      severity: 'warning',
      productId: 'test-product-id',
      productName: 'Organic Almond Milk',
      currentStock: 3,
      lowStockThreshold: 10,
      unit: 'bottles',
    });
  },
}));
