import { Settings } from '@/api/settings';
import { UserProfile } from '@/types/auth';
import { useAuth } from '@/hooks/useAuth';
import { useSettings } from '@/hooks/useSettings';

export interface StoreProfile {
  storeName: string;
  storeAddress: string;
  storePhone: string;
  storeGstin: string;
  storeLogoUrl?: string;
  upiId?: string;
}

/** Merge saved Settings with the signed-in user profile for receipt header fields. */
export function resolveStoreProfile(
  settings: Settings | null | undefined,
  user: UserProfile | null | undefined
): StoreProfile {
  return {
    storeName:
      settings?.businessName?.trim() ||
      user?.businessName?.trim() ||
      user?.displayName?.trim() ||
      'Your Store Name',
    storeAddress: settings?.businessAddress?.trim() || '',
    storePhone: settings?.businessPhone?.trim() || user?.phone?.trim() || '',
    storeGstin: settings?.businessGSTIN?.trim() || '',
    storeLogoUrl: settings?.businessLogoURL || undefined,
    upiId: settings?.upiId?.trim() || undefined,
  };
}

/**
 * Store details for receipts — prefers Settings, falls back to account phone/name
 * when the merchant hasn't filled the business profile yet.
 */
export function useStoreProfile() {
  const { settings, isLoading } = useSettings();
  const { user } = useAuth();

  return {
    ...resolveStoreProfile(settings, user),
    settings,
    isLoading,
  };
}
