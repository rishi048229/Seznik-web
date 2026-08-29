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

/** Pick the first printable src on an image block, then the store-logo fallback. */
export function resolveReceiptImageSrc(
  entry?: ReceiptImageFields,
  fallbackUrl?: string
): string | undefined {
  for (const candidate of [entry?.imageURL, entry?.imageBase64, entry?.imageUri, fallbackUrl]) {
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
    ...(logoURL ? { imageURL: logoURL, imageUri: logoURL } : {}),
  };
}

/** Sync store logo onto empty image blocks; add one if the template has none. */
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

  if (!logoURL) return template;

  let changed = false;
  const entries = template.entries.map((e) => {
    if (e.type !== 'image') return e;
    const img = e as ImageReceiptEntry;
    const hasLoadableImage = Boolean(resolveReceiptImageSrc(img));
    if (hasLoadableImage) return e;
    changed = true;
    return {
      ...img,
      enabled: img.enabled !== false ? true : img.enabled,
      imageURL: logoURL,
      imageUri: logoURL,
      imageBase64: undefined,
    };
  });

  return changed ? { ...template, entries } : template;
}
