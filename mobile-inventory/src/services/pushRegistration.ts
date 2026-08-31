import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { fetchApi } from '@/api/client';
import {
  getSafeNotificationsModule,
  initializeNotificationChannel,
} from './notificationService';

let isRegistered = false;
let lastRegisteredToken: string | null = null;

/**
 * Registers the device's Expo Push Token with the Seznik backend so that
 * remote push notifications (e.g. low stock alerts, new orders) can wake up
 * the phone and display a system banner even when the app is completely closed.
 */
export async function registerPushTokenWithBackend(): Promise<string | null> {
  if (Platform.OS === 'web') return null;

  try {
    const Notifications = getSafeNotificationsModule();
    if (!Notifications || typeof Notifications.getExpoPushTokenAsync !== 'function') {
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
      console.log('[PushRegistration] Push notification permission not granted');
      return null;
    }

    // 2. Resolve EAS Project ID for push token generation
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ||
      (Constants as any)?.easConfig?.projectId ||
      'fe03bcde-b899-40d9-96d8-a59892db22a3';

    const tokenResponse = await Notifications.getExpoPushTokenAsync({ projectId });
    const pushToken = tokenResponse?.data;

    if (!pushToken || typeof pushToken !== 'string') {
      return null;
    }

    // Avoid duplicate network registration if token hasn't changed
    if (isRegistered && lastRegisteredToken === pushToken) {
      return pushToken;
    }

    // 3. Register token with backend server
    await fetchApi('/notifications/register-token', {
      method: 'POST',
      body: JSON.stringify({ pushToken }),
    });
    isRegistered = true;
    lastRegisteredToken = pushToken;
    console.log('[PushRegistration] Successfully registered device push token with backend');

    return pushToken;
  } catch (err: any) {
    console.warn('[PushRegistration] Could not register push token (expected in Expo Go / simulator):', err?.message || err);
    return null;
  }
}

/**
 * Sends a delayed test push notification from the backend to verify that
 * system notifications arrive when the user locks or closes the app.
 */
export async function triggerClosedAppTestPush(delaySeconds = 5): Promise<boolean> {
  try {
    // Ensure token is registered first
    await registerPushTokenWithBackend();

    const response = await fetchApi('/notifications/test-push', {
      method: 'POST',
      body: JSON.stringify({ delaySeconds }),
    });
    return !!response?.success;
  } catch (err) {
    console.warn('[PushRegistration] triggerClosedAppTestPush error:', err);
    return false;
  }
}
