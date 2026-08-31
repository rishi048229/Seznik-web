import { Settings } from '@/api/settings';
import { UserProfile } from '@/types/auth';
import { useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useSettings } from '@/hooks/useSettings';
import { resolveStoreLogoUrl, resolveSettingsFooterMessage } from '@/utils/receiptLogo';

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

export interface StoreProfile {
  storeName: string;
  storeAddress: string;
  storePhone: string;
  storeGstin: string;
  storeLogoUrl?: string;
  upiId?: string;
  footerMessage?: string;
}

/** Merge saved Settings with the signed-in user profile for receipt header fields. */
export function resolveStoreProfile(
  settings: Settings | null | undefined,
  user: UserProfile | null | undefined
): StoreProfile {
  const personalInfo =
    settings?.personalInfo && typeof settings.personalInfo === 'object'
      ? (settings.personalInfo as Record<string, unknown>)
      : null;
  const receiptConfig =
    settings?.receiptConfig && typeof settings.receiptConfig === 'object'
      ? (settings.receiptConfig as Record<string, unknown>)
      : null;

  const storeName =
    settings?.businessName?.trim() ||
    str(receiptConfig?.companyName) ||
    user?.businessName?.trim() ||
    user?.displayName?.trim() ||
    'Your Store Name';

  const storeAddress =
    settings?.businessAddress?.trim() || str(receiptConfig?.address) || '';

  const storePhone =
    settings?.businessPhone?.trim() ||
    String(personalInfo?.phone || personalInfo?.businessPhone || personalInfo?.mobile || '').trim() ||
    str(receiptConfig?.phone) ||
    str(receiptConfig?.storePhone) ||
    user?.phone?.trim() ||
    '';

  const storeGstin =
    settings?.businessGSTIN?.trim() || str(receiptConfig?.gstin) || '';

  const upiId =
    settings?.upiId?.trim() ||
    str(receiptConfig?.upiId) ||
    undefined;

  return {
    storeName,
    storeAddress,
    storePhone,
    storeGstin,
    storeLogoUrl: resolveStoreLogoUrl(receiptConfig, settings?.businessLogoURL),
    upiId,
    footerMessage: resolveSettingsFooterMessage(receiptConfig),
  };
}

/**
 * Store details for receipts — prefers Settings, falls back to account phone/name
 * when the merchant hasn't filled the business profile yet.
 */
export function useStoreProfile() {
  const { settings, isLoading } = useSettings();
  const { user } = useAuth();

  const profile = useMemo(
    () => resolveStoreProfile(settings, user),
    [
      settings?.businessName,
      settings?.businessAddress,
      settings?.businessPhone,
      settings?.businessGSTIN,
      settings?.businessLogoURL,
      settings?.upiId,
      settings?.personalInfo,
      settings?.receiptConfig,
      user?.businessName,
      user?.displayName,
      user?.phone,
    ]
  );

  return {
    ...profile,
    settings,
    isLoading,
  };
}
