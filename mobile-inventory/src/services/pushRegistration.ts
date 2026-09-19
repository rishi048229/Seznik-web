import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { fetchApi } from '@/api/client';
import {
  getSafeNotificationsModule,
  initializeNotificationChannel,
  dispatchLocalStockNotification,
} from './notificationService';
import { useNotificationStore } from '@/store/useNotificationStore';

let isRegistered = false;
let lastRegisteredToken: string | null = null;

/**
 * Registers the device's Expo Push Token with the Seznik backend so that
 * remote push notifications can wake up the phone when the app is closed.
 */
export async function registerPushTokenWithBackend(): Promise<string | null> {
  if (Platform.OS === 'web') return null;

  try {
    const Notifications = getSafeNotificationsModule();
    if (!Notifications) {
      return null;
    }

    await initializeNotificationChannel();

    // 1. Check or request notification permission
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      return null;
    }

    // 2. Resolve EAS Project ID for push token generation if available
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ||
      (Constants as any)?.easConfig?.projectId ||
      'fe03bcde-b899-40d9-96d8-a59892db22a3';

    if (typeof Notifications.getExpoPushTokenAsync === 'function') {
      try {
        const tokenResponse = await Notifications.getExpoPushTokenAsync({ projectId });
        const pushToken = tokenResponse?.data;

        if (pushToken && typeof pushToken === 'string') {
          if (!isRegistered || lastRegisteredToken !== pushToken) {
            await fetchApi('/notifications/register-token', {
              method: 'POST',
              body: JSON.stringify({ pushToken }),
            });
            // Per-login device registration (works for ManagedUser/agent logins too, unlike the
            // Settings-based broadcast pool above) — used to target Remote Print jobs at exactly
            // one agent's phone. Additive: failure here must never break the broadcast path.
            try {
              await fetchApi('/device-tokens/register', {
                method: 'POST',
                body: JSON.stringify({ expoPushToken: pushToken, platform: Platform.OS }),
              });
            } catch (_deviceTokenErr) {
              // Non-fatal — Remote Print delivery to this device just won't work until it succeeds.
            }
            isRegistered = true;
            lastRegisteredToken = pushToken;
          }
          return pushToken;
        }
      } catch (_fcmErr) {
        // FCM requires google-services.json for remote push, but local OS notifications work out of the box
      }
    }

    return null;
  } catch (err: any) {
    return null;
  }
}

/**
 * Schedules a delayed system notification on the device OS and backend,
 * ensuring the notification banner drops down on the lockscreen/notification shade
 * even when the app is swiped away or locked.
 */
export async function triggerClosedAppTestPush(delaySeconds = 5): Promise<boolean> {
  try {
    await registerPushTokenWithBackend();

    // 1. Schedule Native OS Notification via Android Alarm/NotificationManager
    // This will pop on the phone's lockscreen/notification tray in delaySeconds even if app is closed!
    const title = '🚨 Seznik Low Stock Alert';
    const body = 'Only 2 units remaining for "A4 Thermal Paper". Tap to restock now!';

    await dispatchLocalStockNotification({
      title,
      body,
      productName: 'A4 Thermal Paper',
      currentStock: 2,
      threshold: 5,
      severity: 'urgent',
      delaySeconds,
      data: { type: 'low_stock', test: true },
    });

    // 2. Add to in-app Notification Box
    useNotificationStore.getState().addNotification({
      title,
      message: body,
      type: 'low_stock',
      severity: 'urgent',
      productName: 'A4 Thermal Paper',
      currentStock: 2,
      lowStockThreshold: 5,
    }).catch(() => {});

    // 3. Also trigger backend push if server is reachable
    fetchApi('/notifications/test-push', {
      method: 'POST',
      body: JSON.stringify({ delaySeconds }),
    }).catch(() => {});

    return true;
  } catch (err) {
    console.warn('[PushRegistration] triggerClosedAppTestPush error:', err);
    return false;
  }
}
