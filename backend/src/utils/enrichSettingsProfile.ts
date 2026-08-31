import type { Settings, User } from '@prisma/client';

type UserProfileSlice = Pick<User, 'businessName' | 'displayName' | 'phone'>;

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

/**
 * Merge Settings top-level business fields, nested receiptConfig, and User profile
 * so receipt/printer forms always see onboarding data regardless of which column
 * it was saved under.
 */
export function enrichSettingsWithUserProfile(
  settings: Settings | null,
  user: UserProfileSlice
): Settings | null {
  if (!settings) return null;

  const receiptRaw = settings.receiptConfig;
  const receipt = isPlainObject(receiptRaw) ? { ...receiptRaw } : {};

  const businessName =
    str(settings.businessName) ||
    str(receipt.companyName) ||
    str(user.businessName) ||
    str(user.displayName) ||
    '';

  const businessAddress = str(settings.businessAddress) || str(receipt.address) || '';

  const businessPhone =
    str(settings.businessPhone) ||
    str(receipt.phone) ||
    str(user.phone) ||
    '';

  const businessGSTIN = str(settings.businessGSTIN) || str(receipt.gstin) || '';

  const businessLogoURL =
    str(settings.businessLogoURL) || str(receipt.logoURL) || '';

  const upiId = str(settings.upiId) || str(receipt.upiId) || '';

  const enrichedReceipt: Record<string, unknown> = {
    ...receipt,
    companyName: str(receipt.companyName) || businessName,
    address: str(receipt.address) || businessAddress,
    phone: str(receipt.phone) || businessPhone,
    gstin: str(receipt.gstin) || businessGSTIN,
    logoURL: str(receipt.logoURL) || businessLogoURL,
    upiId: str(receipt.upiId) || upiId,
  };

  if (!str(enrichedReceipt.footerMessage)) {
    enrichedReceipt.footerMessage = 'Thank you for your purchase!';
  }

  return {
    ...settings,
    businessName: businessName || settings.businessName,
    businessAddress: businessAddress || settings.businessAddress,
    businessPhone: businessPhone || settings.businessPhone,
    businessGSTIN: businessGSTIN || settings.businessGSTIN,
    businessLogoURL: businessLogoURL || settings.businessLogoURL,
    upiId: upiId || settings.upiId,
    receiptConfig: enrichedReceipt as Settings['receiptConfig'],
  };
}

/** Build receiptConfig seed from onboarding / business profile fields. */
export function buildReceiptConfigFromProfile(input: {
  businessName: string;
  businessAddress: string;
  phone: string;
  upiId?: string;
  businessLogoURL?: string;
  businessGSTIN?: string;
  existingReceipt?: Record<string, unknown>;
}): Record<string, unknown> {
  const existing = input.existingReceipt || {};
  return {
    ...existing,
    companyName: input.businessName,
    address: input.businessAddress,
    phone: input.phone,
    gstin: str(input.businessGSTIN) || str(existing.gstin),
    logoURL: str(input.businessLogoURL) || str(existing.logoURL),
    upiId: str(input.upiId) || str(existing.upiId),
    showPaymentQR: existing.showPaymentQR ?? true,
    footerMessage:
      str(existing.footerMessage) || 'Thank you for your purchase!',
    termsLine1:
      str(existing.termsLine1) ||
      '1. Goods once sold will not be taken back or exchanged',
    termsLine2:
      str(existing.termsLine2) ||
      '2. All disputes are subject to local jurisdiction only',
    receiptConfigUpdatedAt: new Date().toISOString(),
  };
}
