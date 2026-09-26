import { Platform } from 'react-native';
import * as Updates from 'expo-updates';

/** Check Expo OTA for a new JS bundle and reload if one is available (production builds only). */
export async function checkForOtaUpdateOnLaunch(): Promise<void> {
  if (__DEV__ || Platform.OS === 'web') return;
  if (!Updates.isEnabled) return;

  try {
    const withTimeout = <T,>(p: Promise<T>, ms: number) =>
      Promise.race([
        p,
        new Promise<T>((_, reject) => setTimeout(() => reject(new Error('OTA check timeout')), ms)),
      ]);
    const result = await withTimeout(Updates.checkForUpdateAsync(), 8000);
    if (!result.isAvailable) return;
    await withTimeout(Updates.fetchUpdateAsync(), 20000);
    await Updates.reloadAsync();
  } catch (err) {
    console.warn('[OTA] Update check failed (app continues on bundled JS):', err);
  }
}
