export type BusinessType = 'restaurant_cafe' | 'online_store' | 'retail_shop'

export const BUSINESS_TYPE_OPTIONS: ReadonlyArray<{
  id: BusinessType
  label: string
  description: string
}> = [
  {
    id: 'restaurant_cafe',
    label: 'Restaurant & Cafe',
    description: 'Table service, KOT kitchen orders, and counter tokens',
  },
  {
    id: 'online_store',
    label: 'Online Store',
    description: 'E-commerce inventory, orders, and multi-location stock',
  },
  {
    id: 'retail_shop',
    label: 'Retail Shop',
    description: 'In-store POS, barcode billing, and stock management',
  },
]

export type NavFeatureId =
  | 'kot'
  | 'tokens'
  | 'calculator'
  | 'purchases'
  | 'suppliers'
  | 'stores'
  | 'posPrimary'
  | 'calculatorPrimary'

export const BUSINESS_NAV_FEATURES: Record<BusinessType, Record<NavFeatureId, boolean>> = {
  restaurant_cafe: {
    kot: true,
    tokens: true,
    calculator: true,
    purchases: true,
    suppliers: true,
    stores: false, // Multi-store implementation temporarily hidden
    posPrimary: false,
    calculatorPrimary: false,
  },
  online_store: {
    kot: false,
    tokens: false,
    calculator: false,
    purchases: true,
    suppliers: true,
    stores: false, // Multi-store implementation temporarily hidden
    posPrimary: true,
    calculatorPrimary: false,
  },
  retail_shop: {
    kot: false,
    tokens: false,
    calculator: true,
    purchases: true,
    suppliers: true,
    stores: false, // Multi-store implementation temporarily hidden
    posPrimary: true,
    calculatorPrimary: true,
  },
}

/** Primary chrome layout: restaurant centers Tables / New Bill / Menu instead of POS / Calculator / Products. */
export type PrimaryNavMode = 'restaurant' | 'retail'

export function getPrimaryNavMode(
  type: BusinessType | null | undefined
): PrimaryNavMode {
  return type === 'restaurant_cafe' ? 'restaurant' : 'retail'
}

export function usesRestaurantPrimaryNav(
  type: BusinessType | null | undefined
): boolean {
  return getPrimaryNavMode(type) === 'restaurant'
}

/** Alias used by businessFeatures helpers. */
export function usesKotFirstNav(type: BusinessType | null | undefined): boolean {
  return usesRestaurantPrimaryNav(type)
}

export const BUSINESS_TEMPLATES: Record<
  BusinessType,
  { title: string; subtitle: string; features: string[] }
> = {
  restaurant_cafe: {
    title: 'Restaurant & Cafe workspace',
    subtitle: 'Tables, kitchen tickets, and settle-bill flow — plus shared store tools.',
    features: [
      'Table floor and New Bill',
      'Kitchen Order Tickets (KOT)',
      'Menu and categories',
      'Settle bill and counter tokens',
      'Multi-store / franchise locations',
    ],
  },
  online_store: {
    title: 'Online Store workspace',
    subtitle: 'Inventory, orders, and multi-location stock — without kitchen tools.',
    features: [
      'POS and barcode billing',
      'Inventory and catalog',
      'Purchases and suppliers',
      'Multi-store / franchise locations',
    ],
  },
  retail_shop: {
    title: 'Retail Shop workspace',
    subtitle: 'In-store POS and stock management — without kitchen tools.',
    features: [
      'POS and barcode billing',
      'Inventory and catalog',
      'Purchases and suppliers',
      'Multi-store / franchise locations',
    ],
  },
}

export function getBusinessTypeLabel(type: BusinessType | null | undefined): string {
  if (!type) return 'Not set'
  return BUSINESS_TYPE_OPTIONS.find(option => option.id === type)?.label ?? type
}

export function isRestaurantBusiness(type: BusinessType | null | undefined): boolean {
  return type === 'restaurant_cafe'
}
