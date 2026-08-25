export type BusinessType = 'restaurant_cafe' | 'online_store' | 'retail_shop';

export const BUSINESS_TYPE_OPTIONS: ReadonlyArray<{
  id: BusinessType;
  label: string;
  description: string;
  emoji: string;
}> = [
  {
    id: 'restaurant_cafe',
    label: 'Restaurant & Cafe',
    description: 'Table service, KOT kitchen orders, and counter tokens',
    emoji: '🍽️',
  },
  {
    id: 'online_store',
    label: 'Online Store',
    description: 'E-commerce inventory, orders, and multi-location stock',
    emoji: '🛒',
  },
  {
    id: 'retail_shop',
    label: 'Retail Shop',
    description: 'In-store POS, barcode billing, and stock management',
    emoji: '🏪',
  },
];

export type NavFeatureId =
  | 'kot'
  | 'tokens'
  | 'calculator'
  | 'purchases'
  | 'suppliers'
  | 'stores';

export const BUSINESS_NAV_FEATURES: Record<BusinessType, Record<NavFeatureId, boolean>> = {
  restaurant_cafe: {
    kot: true,
    tokens: true,
    calculator: true,
    purchases: true,
    suppliers: true,
    stores: false,
  },
  online_store: {
    kot: false,
    tokens: false,
    calculator: false,
    purchases: true,
    suppliers: true,
    stores: true,
  },
  retail_shop: {
    kot: false,
    tokens: false,
    calculator: true,
    purchases: true,
    suppliers: true,
    stores: true,
  },
};

export function getBusinessTypeLabel(type: BusinessType | null | undefined): string {
  if (!type) return 'Not set';
  return BUSINESS_TYPE_OPTIONS.find((option) => option.id === type)?.label ?? type;
}
