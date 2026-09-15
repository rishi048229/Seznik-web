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
import { fetchApi } from '@/api/client';

export type NotificationType =
  | 'out_of_stock'
  | 'critical_stock'
  | 'low_stock'
  | 'credit_due'
  | 'payment_due'
  | 'daily_sales_summary'
  | 'announcement'
  | 'system';

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
  customerId?: string;
  customerName?: string;
  amount?: number;
  totalSales?: number;
  ordersCount?: number;
  actionUrl?: string;
  read: boolean;
  createdAt: string;
}

export interface NotificationPreferences {
  lowStockAlertsEnabled: boolean;
  outOfStockAlertsEnabled: boolean;
  creditDueAlertsEnabled: boolean;
  dailySummaryEnabled: boolean;
  pushNotificationsEnabled: boolean;
  soundEnabled: boolean;
  minimumThresholdMultiplier: number;
}

const DEFAULT_PREFERENCES: NotificationPreferences = {
  lowStockAlertsEnabled: true,
  outOfStockAlertsEnabled: true,
  creditDueAlertsEnabled: true,
  dailySummaryEnabled: true,
  pushNotificationsEnabled: true,
  soundEnabled: true,
  minimumThresholdMultiplier: 1.0,
};

const NOTIFICATION_COOLDOWN_MS = 10 * 60 * 1000;

interface NotificationState {
  notifications: AppNotification[];
  unreadCount: number;
  preferences: NotificationPreferences;
  isHydrated: boolean;
  isSyncingFeed: boolean;
  activeBanner: AppNotification | null;
  pauseInAppBanner: boolean;
  lastNotifiedMap: Record<string, { stock: number; timestamp: number }>;

  hydrate: () => Promise<void>;
  syncLiveFeed: () => Promise<void>;
  dismissBanner: () => void;
  setPauseInAppBanner: (paused: boolean) => void;
  addNotification: (
    item: Omit<AppNotification, 'id' | 'createdAt' | 'read'> & { id?: string }
  ) => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (id: string) => Promise<void>;
  clearAllNotifications: () => Promise<void>;
  updatePreferences: (partial: Partial<NotificationPreferences>) => Promise<void>;

  evaluateStockConditions: (products: (Product | any)[]) => Promise<void>;
  checkSoldItemsStock: (
    items: {
      productId: string;
      productName?: string;
      currentStock: number;
      lowStockThreshold: number;
      unit?: string;
    }[]
  ) => Promise<void>;
  triggerDayBookSummary: (totalSales: number, ordersCount: number) => Promise<void>;
  triggerCreditReminder: (customer: { id?: string; name: string; amountDue: number; phone?: string }) => Promise<void>;
  sendTestNotification: (type?: NotificationType) => Promise<void>;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  preferences: DEFAULT_PREFERENCES,
  isHydrated: false,
  isSyncingFeed: false,
  activeBanner: null,
  pauseInAppBanner: false,
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

      if (prefs.pushNotificationsEnabled) {
        requestNotificationPermissions().catch(() => {});
      }

      // Automatically sync live feed from backend
      get().syncLiveFeed().catch(() => {});
    } catch {
      set({ isHydrated: true });
    }
  },

  syncLiveFeed: async () => {
    try {
      set({ isSyncingFeed: true });
      const response = await fetchApi('/notifications/feed');
      if (response?.success && Array.isArray(response.notifications)) {
        const liveItems: AppNotification[] = response.notifications;
        const current = get().notifications;

        // Merge live items with existing user read status
        const readMap = new Map<string, boolean>();
        current.forEach((n) => readMap.set(n.id, n.read));

        const merged: AppNotification[] = liveItems.map((item) => ({
          ...item,
          read: readMap.has(item.id) ? !!readMap.get(item.id) : false,
        }));

        // Append any locally created notifications that aren't in backend feed
        const liveIdSet = new Set(liveItems.map((i) => i.id));
        const localCustoms = current.filter((n) => !liveIdSet.has(n.id) && !n.id.startsWith('stock-'));

        const finalNotifications = [...merged, ...localCustoms].slice(0, 100);
        const unread = finalNotifications.filter((n) => !n.read).length;

        set({
          notifications: finalNotifications,
          unreadCount: unread,
          isSyncingFeed: false,
        });

        await setStoredNotifications(JSON.stringify(finalNotifications)).catch(() => {});
      } else {
        set({ isSyncingFeed: false });
      }
    } catch {
      set({ isSyncingFeed: false });
    }
  },

  dismissBanner: () => {
    set({ activeBanner: null });
  },

  setPauseInAppBanner: (paused: boolean) => {
    set({ pauseInAppBanner: paused, ...(paused ? { activeBanner: null } : {}) });
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
      customerId: item.customerId,
      customerName: item.customerName,
      amount: item.amount,
      totalSales: item.totalSales,
      ordersCount: item.ordersCount,
      actionUrl: item.actionUrl,
      read: false,
      createdAt: new Date().toISOString(),
    };

    const updated = [newNotif, ...notifications.filter((n) => n.id !== newNotif.id)].slice(0, 100);
    const unread = updated.filter((n) => !n.read).length;

    set({
      notifications: updated,
      unreadCount: unread,
      activeBanner: get().pauseInAppBanner ? null : newNotif,
    });

    await setStoredNotifications(JSON.stringify(updated)).catch(() => {});

    // Dispatch system OS notification
    if (preferences.pushNotificationsEnabled) {
      await dispatchLocalStockNotification({
        title: newNotif.title,
        body: newNotif.message,
        productId: newNotif.productId,
        productName: newNotif.productName,
        currentStock: newNotif.currentStock,
        threshold: newNotif.lowStockThreshold,
        severity: newNotif.severity === 'info' ? 'warning' : newNotif.severity,
        data: {
          id: newNotif.id,
          type: newNotif.type,
          productId: newNotif.productId,
          customerId: newNotif.customerId,
          actionUrl: newNotif.actionUrl,
        },
      });
    }
  },

  markAsRead: async (id: string) => {
    const { notifications } = get();
    const updated = notifications.map((n) => (n.id === id ? { ...n, read: true } : n));
    const unread = updated.filter((n) => !n.read).length;

    set({ notifications: updated, unreadCount: unread });
    await setStoredNotifications(JSON.stringify(updated)).catch(() => {});
  },

  markAllAsRead: async () => {
    const { notifications } = get();
    const updated = notifications.map((n) => ({ ...n, read: true }));

    set({ notifications: updated, unreadCount: 0 });
    await setStoredNotifications(JSON.stringify(updated)).catch(() => {});
  },

  deleteNotification: async (id: string) => {
    const { notifications } = get();
    const updated = notifications.filter((n) => n.id !== id);
    const unread = updated.filter((n) => !n.read).length;

    set({ notifications: updated, unreadCount: unread });
    await setStoredNotifications(JSON.stringify(updated)).catch(() => {});
  },

  clearAllNotifications: async () => {
    set({ notifications: [], unreadCount: 0, activeBanner: null });
    await setStoredNotifications(JSON.stringify([])).catch(() => {});
  },

  updatePreferences: async (partial: Partial<NotificationPreferences>) => {
    const newPrefs = { ...get().preferences, ...partial };
    set({ preferences: newPrefs });
    await setStoredNotificationPreferences(JSON.stringify(newPrefs)).catch(() => {});
  },

  evaluateStockConditions: async (products: (Product | any)[]) => {
    const { preferences, lastNotifiedMap } = get();
    if (!preferences.lowStockAlertsEnabled && !preferences.outOfStockAlertsEnabled) {
      return;
    }

    const now = Date.now();
    const updatedMap = { ...lastNotifiedMap };

    for (const p of products) {
      if (!p || typeof p !== 'object' || !p.id) continue;

      const rawStock = typeof p.currentStock === 'number' ? p.currentStock : undefined;
      if (rawStock === undefined) continue;

      const stock = Math.max(0, rawStock);
      const rawThreshold = p.lowStockThreshold || 5;
      const threshold = Math.max(1, Math.round(rawThreshold * (preferences.minimumThresholdMultiplier || 1.0)));

      const isOutOfStock = stock <= 0;
      const isLowStock = stock > 0 && stock <= threshold;

      if (!isOutOfStock && !isLowStock) continue;

      if (isOutOfStock && !preferences.outOfStockAlertsEnabled) continue;
      if (isLowStock && !preferences.lowStockAlertsEnabled) continue;

      const lastRecord = updatedMap[p.id];
      if (lastRecord && lastRecord.stock === stock && now - lastRecord.timestamp < NOTIFICATION_COOLDOWN_MS) {
        continue;
      }

      updatedMap[p.id] = { stock, timestamp: now };

      const formatted = formatLowStockNotification({
        id: p.id,
        name: p.name,
        currentStock: stock,
        lowStockThreshold: threshold,
        unit: p.unit,
      });

      await get().addNotification({
        id: `stock-${p.id}`,
        title: formatted.title,
        message: formatted.body,
        type: isOutOfStock ? 'out_of_stock' : 'low_stock',
        severity: formatted.severity,
        productId: p.id,
        productName: p.name,
        currentStock: stock,
        lowStockThreshold: threshold,
        unit: p.unit,
      });
    }

    set({ lastNotifiedMap: updatedMap });
  },

  checkSoldItemsStock: async (items) => {
    const { preferences, lastNotifiedMap } = get();
    if (!preferences.lowStockAlertsEnabled && !preferences.outOfStockAlertsEnabled) return;

    const now = Date.now();
    const updatedMap = { ...lastNotifiedMap };

    for (const item of items) {
      const stock = Math.max(0, item.currentStock);
      const threshold = Math.max(1, item.lowStockThreshold || 5);

      const isOutOfStock = stock <= 0;
      const isLowStock = stock > 0 && stock <= threshold;

      if (!isOutOfStock && !isLowStock) continue;

      const lastRecord = updatedMap[item.productId];
      if (lastRecord && lastRecord.stock === stock && now - lastRecord.timestamp < NOTIFICATION_COOLDOWN_MS) {
        continue;
      }

      updatedMap[item.productId] = { stock, timestamp: now };

      const formatted = formatLowStockNotification({
        id: item.productId,
        name: item.productName || 'Product',
        currentStock: stock,
        lowStockThreshold: threshold,
        unit: item.unit,
      });

      await get().addNotification({
        id: `stock-${item.productId}`,
        title: formatted.title,
        message: formatted.body,
        type: isOutOfStock ? 'out_of_stock' : 'low_stock',
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

  triggerDayBookSummary: async (totalSales: number, ordersCount: number) => {
    const { preferences } = get();
    if (!preferences.dailySummaryEnabled) return;

    const formattedSales = `₹${(totalSales || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
    await get().addNotification({
      id: `daybook_${new Date().toISOString().split('T')[0]}`,
      title: `📊 Day Book: ${formattedSales} Collected Today`,
      message: `Total collection today: ${formattedSales} across ${ordersCount} bills. Tap to review day book report.`,
      type: 'daily_sales_summary',
      severity: 'info',
      totalSales,
      ordersCount,
      actionUrl: '/reports',
    });
  },

  triggerCreditReminder: async (customer: { id?: string; name: string; amountDue: number; phone?: string }) => {
    const { preferences } = get();
    if (!preferences.creditDueAlertsEnabled) return;

    const formattedAmount = `₹${(customer.amountDue || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
    await get().addNotification({
      id: `credit_${customer.id || customer.name}_${Date.now()}`,
      title: `💳 Credit Reminder: ${customer.name}`,
      message: `${customer.name} has ${formattedAmount} pending payment. Tap to view customer ledger.`,
      type: 'credit_due',
      severity: 'warning',
      customerId: customer.id,
      customerName: customer.name,
      amount: customer.amountDue,
      actionUrl: '/credits',
    });
  },

  sendTestNotification: async (type: NotificationType = 'low_stock') => {
    if (type === 'credit_due') {
      await get().addNotification({
        id: `demo_credit_${Date.now()}`,
        title: '💳 Payment Due: Rajesh Verma',
        message: '₹2,450.00 pending credit balance is due. Tap to open credit ledger and send WhatsApp reminder.',
        type: 'credit_due',
        severity: 'warning',
        customerName: 'Rajesh Verma',
        amount: 2450,
        actionUrl: '/credits',
      });
    } else if (type === 'daily_sales_summary') {
      await get().addNotification({
        id: `demo_sales_${Date.now()}`,
        title: '🌙 Daily Night Sales Summary: ₹14,850.00',
        message: 'Today: 28 orders completed. Total Revenue: ₹14,850.00. Net Profit: ₹4,210.00. Tap to view analytics.',
        type: 'daily_sales_summary',
        severity: 'info',
        totalSales: 14850,
        ordersCount: 28,
        actionUrl: '/reports',
      });
    } else if (type === 'announcement') {
      await get().addNotification({
        id: `demo_announce_${Date.now()}`,
        title: '📢 Cloud Sync & Backup Active',
        message: 'All bills and inventory changes are synced with your cloud dashboard in real-time.',
        type: 'announcement',
        severity: 'info',
        actionUrl: '/settings',
      });
    } else {
      await get().addNotification({
        id: `demo_stock_${Date.now()}`,
        title: '🚨 Out of Stock: Seznik A4 Thermal Paper',
        message: '"Seznik A4 Thermal Paper" reached 0 units! Tap to restock now.',
        type: 'out_of_stock',
        severity: 'critical',
        productName: 'Seznik A4 Thermal Paper',
        currentStock: 0,
        lowStockThreshold: 10,
        unit: 'rolls',
        actionUrl: '/products',
      });
    }
  },
}));
