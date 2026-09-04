import {
  BUSINESS_NAV_FEATURES,
  usesKotFirstNav,
  type BusinessType,
  type NavFeatureId,
} from '@/constants/businessTypes'

export function isNavFeatureVisible(
  businessType: BusinessType | null | undefined,
  feature: NavFeatureId
): boolean {
  if (!businessType) return true
  return BUSINESS_NAV_FEATURES[businessType][feature]
}

/** Restaurant primary chrome: Tables / New Bill / Menu instead of POS / Calculator / Products. */
export function isKotFirstNav(businessType: BusinessType | null | undefined): boolean {
  return usesKotFirstNav(businessType)
}

/** Catalog label: Menu for restaurant, Products otherwise. */
export function getCatalogNavLabel(businessType: BusinessType | null | undefined): string {
  return isKotFirstNav(businessType) ? 'Menu' : 'Products'
}

export function needsBusinessSetup(profile: {
  accountType?: 'user' | 'managed' | string | null
  onboardingCompleted?: boolean
  businessType?: BusinessType | null
} | null | undefined): boolean {
  if (!profile || profile.accountType === 'managed') return false
  if (profile.onboardingCompleted === false) return true
  return !profile.businessType
}
