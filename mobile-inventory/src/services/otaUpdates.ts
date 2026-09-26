import { Platform } from 'react-native';
import * as Updates from 'expo-updates';

/** Check Expo OTA for a new JS bundle and reload if one is available (production builds only). */
export async function checkForOtaUpdateOnLaunch(): Promise<void> {
  if (__DEV__ || Platform.OS === 'web') return;
  if (!Updates.isEnabled) return;

  try {
    const result = await Updates.checkForUpdateAsync();
    if (!result.isAvailable) return;
    await Updates.fetchUpdateAsync();
    await Updates.reloadAsync();
  } catch (err) {
    console.warn('[OTA] Update check failed (app continues on bundled JS):', err);
  }
}
