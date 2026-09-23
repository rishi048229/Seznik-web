/**
 * Restaurant / KOT configuration now lives in `shared/kotConfig.ts` so the mobile app uses the
 * exact same presets, defaults and merge rules. This file stays as the web's import path so no
 * existing `@/pages/kot/kotConfig` import had to change.
 */
export {
  DEFAULT_KOT_CONFIG,
  VENUE_PRESETS,
  VENUE_TYPES,
  mergeKotConfig,
  applyVenuePreset,
  ORDER_TYPE_OPTIONS,
  visibleOrderTypes,
  orderTypeLabel,
  tableNounLabel,
} from '@shared/kotConfig'

export type { VenuePreset } from '@shared/kotConfig'
