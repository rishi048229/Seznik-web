import {
  BUSINESS_NAV_FEATURES,
  BusinessType,
  NavFeatureId,
} from '@/constants/businessTypes';

export function isNavFeatureVisible(
  businessType: BusinessType | null | undefined,
  feature: NavFeatureId
): boolean {
  if (!businessType) return true;
  return BUSINESS_NAV_FEATURES[businessType][feature];
}
