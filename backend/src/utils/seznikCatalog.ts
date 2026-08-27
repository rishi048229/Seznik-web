import { SEZNIK_WEBSITE_PRODUCTS } from '../data/seznikWebsiteProducts';

const PRODUCT_BY_ID = new Map(SEZNIK_WEBSITE_PRODUCTS.map((p) => [p.id, p]));

export function getSeznikProductById(productId: string) {
  return PRODUCT_BY_ID.get(productId);
}

export function isValidSeznikProductId(productId: string): boolean {
  return PRODUCT_BY_ID.has(productId);
}

export function getSeznikProductName(productId: string): string | undefined {
  return PRODUCT_BY_ID.get(productId)?.name;
}
