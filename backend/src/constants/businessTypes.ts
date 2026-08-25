export const VALID_BUSINESS_TYPES = ['restaurant_cafe', 'online_store', 'retail_shop'] as const;

export type BusinessType = (typeof VALID_BUSINESS_TYPES)[number];

export function isValidBusinessType(value: unknown): value is BusinessType {
  return typeof value === 'string' && (VALID_BUSINESS_TYPES as readonly string[]).includes(value);
}
