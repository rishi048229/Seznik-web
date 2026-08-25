export type BusinessType = 'restaurant_cafe' | 'online_store' | 'retail_shop'

export const BUSINESS_TYPE_OPTIONS: ReadonlyArray<{
  id: BusinessType
  label: string
  description: string
  emoji: string
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
]

export type NavFeatureId = 'kot' | 'tokens' | 'calculator' | 'purchases' | 'suppliers' | 'stores'

export const BUSINESS_NAV_FEATURES: Record<BusinessType, Record<NavFeatureId, boolean>> = {
  restaurant_cafe: {
    kot: true,
    tokens: true,
    calculator: true,
    purchases: true,
    suppliers: true,
    stores: true,
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
}

export const BUSINESS_TEMPLATES: Record<
  BusinessType,
  { title: string; subtitle: string; features: string[] }
> = {
  restaurant_cafe: {
    title: 'Restaurant & Cafe workspace',
    subtitle: 'Kitchen tickets, table billing, and counter service — plus the shared store tools.',
    features: [
      'Kitchen Order Tickets (KOT) on mobile',
      'Table billing and floor management',
      'Quick counter tokens',
      'POS, inventory, and billing',
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
