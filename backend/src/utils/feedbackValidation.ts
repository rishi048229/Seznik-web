import { getSeznikProductName, isValidSeznikProductId } from './seznikCatalog';

const VALID_AREAS = ['general', 'dashboard', 'pos', 'products', 'categories', 'customers', 'suppliers', 'sales', 'purchases', 'expenses', 'credits', 'reports', 'printers', 'settings', 'other'];
const VALID_PLATFORMS = ['web', 'mobile'];

export interface NormalizedFeedbackInput {
  area: string;
  rating: number | null;
  message: string;
  platform: string;
  productId: string;
  productName: string;
}

export function normalizeFeedbackInput(body: Record<string, unknown>): { ok: true; data: NormalizedFeedbackInput } | { ok: false; error: string } {
  const { area, rating, message, platform, productId } = body;

  if (!message || !String(message).trim()) {
    return { ok: false, error: 'Please write your feedback before submitting' };
  }

  const normalizedProductId = String(productId || '').trim();
  if (!normalizedProductId) {
    return { ok: false, error: 'Please select a product' };
  }
  if (!isValidSeznikProductId(normalizedProductId)) {
    return { ok: false, error: 'Invalid product selected' };
  }
  const productName = getSeznikProductName(normalizedProductId);
  if (!productName) {
    return { ok: false, error: 'Invalid product selected' };
  }

  const normalizedPlatform = VALID_PLATFORMS.includes(String(platform)) ? String(platform) : null;
  if (!normalizedPlatform) {
    return { ok: false, error: 'Invalid platform' };
  }

  const normalizedArea = VALID_AREAS.includes(String(area)) ? String(area) : 'general';
  let normalizedRating: number | null = null;
  if (rating !== undefined && rating !== null && rating !== '') {
    const r = Number(rating);
    if (!Number.isInteger(r) || r < 1 || r > 5) {
      return { ok: false, error: 'Rating must be between 1 and 5' };
    }
    normalizedRating = r;
  }

  return {
    ok: true,
    data: {
      area: normalizedArea,
      rating: normalizedRating,
      message: String(message).trim().slice(0, 2000),
      platform: normalizedPlatform,
      productId: normalizedProductId,
      productName,
    },
  };
}
