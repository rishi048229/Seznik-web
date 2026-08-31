import type { CustomReceiptEntry, CustomReceiptTemplate, ImageReceiptEntry } from '@/types/customReceipt';
import { RECEIPT_LOGO_DEFAULT_WIDTH_PERCENT } from '@shared/receiptPrintGeometry';

const LOCAL_URI_PREFIXES = ['file://', 'content://', 'ph://', 'assets-library://'];

/** Image sources the thermal printer (or preview) can actually load. */
export function isPrintableImageSrc(src?: string | null): boolean {
  if (!src?.trim()) return false;
  const s = src.trim();
  if (LOCAL_URI_PREFIXES.some((p) => s.startsWith(p))) return true;
  return (
    s.startsWith('data:') ||
    s.startsWith('http://') ||
    s.startsWith('https://') ||
    s.startsWith('/')
  );
}

/** Canonical store logo — receipt config first (web portal), then business profile. */
export function resolveStoreLogoUrl(
  receiptConfig?: Record<string, unknown> | null,
  businessLogoURL?: string | null
): string | undefined {
  const fromReceipt = typeof receiptConfig?.logoURL === 'string' ? receiptConfig.logoURL.trim() : '';
  if (isPrintableImageSrc(fromReceipt)) return fromReceipt;
  const fromBusiness = businessLogoURL?.trim();
  if (isPrintableImageSrc(fromBusiness)) return fromBusiness;
  return undefined;
}

export function resolveSettingsFooterMessage(
  receiptConfig?: Record<string, unknown> | null
): string {
  const msg = typeof receiptConfig?.footerMessage === 'string' ? receiptConfig.footerMessage.trim() : '';
  return msg || 'Thank you for your business!';
}

export interface ReceiptImageFields {
  imageURL?: string;
  imageUri?: string;
  imageBase64?: string;
}

/** Pick the first printable src on an image block, prioritizing the live store logo fallbackUrl over stale embedded base64. */
export function resolveReceiptImageSrc(
  entry?: ReceiptImageFields,
  fallbackUrl?: string
): string | undefined {
  const cleanFallback = isPrintableImageSrc(fallbackUrl) ? fallbackUrl!.trim() : undefined;

  // If entry has an explicit web/cloud URL matching or extending the catalog/store
  if (isPrintableImageSrc(entry?.imageURL)) {
    // If fallbackUrl is provided and entry's imageURL is a legacy/stale cloud URL or empty, fallbackUrl wins if entry has no separate custom URL
    return entry!.imageURL!.trim();
  }

  // If a live fallback store logo URL is available from current store profile, use it
  if (cleanFallback) {
    return cleanFallback;
  }

  // Otherwise fall back to embedded base64 or imageUri
  for (const candidate of [entry?.imageBase64, entry?.imageUri]) {
    if (isPrintableImageSrc(candidate)) return candidate!.trim();
  }
  return undefined;
}

function createLogoEntry(logoURL?: string, templateId?: string): CustomReceiptEntry {
  return {
    id: `entry-logo-${templateId || 'default'}`,
    type: 'image',
    enabled: true,
    align: 'center',
    widthPercent: RECEIPT_LOGO_DEFAULT_WIDTH_PERCENT,
    ...(logoURL ? { imageURL: logoURL.trim(), imageUri: logoURL.trim() } : {}),
  };
}

/** Sync store logo onto every image block; add one if the template has none and clear stale base64. */
export function ensureTemplateHasLogoBlock(
  template: CustomReceiptTemplate,
  logoURL?: string
): CustomReceiptTemplate {
  const imageIndexes = template.entries
    .map((e, i) => (e.type === 'image' ? i : -1))
    .filter((i) => i >= 0);

  if (imageIndexes.length === 0) {
    return {
      ...template,
      entries: [createLogoEntry(logoURL, template.id), ...template.entries],
    };
  }

  if (!logoURL || !isPrintableImageSrc(logoURL)) return template;
  const trimmedLogo = logoURL.trim();

  let changed = false;
  const entries = template.entries.map((e) => {
    if (e.type !== 'image') return e;
    const img = e as ImageReceiptEntry;

    // Check if the block is already synced to this exact logo
    if (img.imageURL === trimmedLogo && img.imageUri === trimmedLogo && !img.imageBase64) {
      return e;
    }

    changed = true;
    return {
      ...img,
      enabled: img.enabled !== false,
      imageURL: trimmedLogo,
      imageUri: trimmedLogo,
      imageBase64: undefined, // Clear stale embedded bitmap so fresh logo is rendered
    };
  });

  return changed ? { ...template, entries } : template;
}
