import {
  BUSINESS_NAV_FEATURES,
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

export function needsBusinessSetup(profile: {
  accountType?: 'user' | 'managed' | string | null
  onboardingCompleted?: boolean
  businessType?: BusinessType | null
} | null | undefined): boolean {
  if (!profile || profile.accountType === 'managed') return false
  if (profile.onboardingCompleted === false) return true
  return !profile.businessType
}
