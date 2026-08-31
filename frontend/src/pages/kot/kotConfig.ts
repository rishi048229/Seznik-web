import type { KotConfig, KotRoomType, KotTableNoun, KotVenueType } from '@/types/settings.types'
import type { KOTOrderType } from '@/types/kot.types'

export const DEFAULT_KOT_CONFIG: Required<KotConfig> = {
  venueType: 'restaurant',
  defaultOrderType: 'dine_in',
  taxRate: 0,
  applyTaxOverride: false,
  serviceChargeType: 'percent',
  serviceChargeValue: 0,
  acCharge: 0,
  nonAcCharge: 0,
  defaultRoomType: 'none',
  kotSlipTitle: 'KITCHEN ORDER TICKET',
  showWaiterOnSlip: true,
  showTables: true,
  showWaiterField: true,
  showRoomCharges: true,
  showServiceCharge: true,
  tableNoun: 'tables',
  allowedOrderTypes: ['dine_in', 'takeaway', 'delivery'],
}

export interface VenuePreset {
  venueType: KotVenueType
  label: string
  hint: string
  defaultOrderType: KOTOrderType
  showTables: boolean
  showWaiterField: boolean
  showRoomCharges: boolean
  showServiceCharge: boolean
  showWaiterOnSlip: boolean
  kotSlipTitle: string
  tableNoun: KotTableNoun
  allowedOrderTypes: KOTOrderType[]
}

export const VENUE_PRESETS: Record<KotVenueType, VenuePreset> = {
  cafe: {
    venueType: 'cafe',
    label: 'Cafe',
    hint: 'Counter + seats, takeaway first',
    defaultOrderType: 'takeaway',
    showTables: true,
    showWaiterField: false,
    showRoomCharges: false,
    showServiceCharge: false,
    showWaiterOnSlip: false,
    kotSlipTitle: 'CAFE TICKET',
    tableNoun: 'seats',
    allowedOrderTypes: ['dine_in', 'takeaway', 'delivery'],
  },
  restaurant: {
    venueType: 'restaurant',
    label: 'Restaurant',
    hint: 'Full floor, waiters, dine-in',
    defaultOrderType: 'dine_in',
    showTables: true,
    showWaiterField: true,
    showRoomCharges: true,
    showServiceCharge: true,
    showWaiterOnSlip: true,
    kotSlipTitle: 'KITCHEN ORDER TICKET',
    tableNoun: 'tables',
    allowedOrderTypes: ['dine_in', 'takeaway', 'delivery'],
  },
  qsr: {
    venueType: 'qsr',
    label: 'QSR',
    hint: 'Quick service, counter bills',
    defaultOrderType: 'takeaway',
    showTables: false,
    showWaiterField: false,
    showRoomCharges: false,
    showServiceCharge: false,
    showWaiterOnSlip: false,
    kotSlipTitle: 'KITCHEN TICKET',
    tableNoun: 'counters',
    allowedOrderTypes: ['takeaway', 'delivery'],
  },
  bakery: {
    venueType: 'bakery',
    label: 'Bakery',
    hint: 'Walk-in counter, no floor',
    defaultOrderType: 'takeaway',
    showTables: false,
    showWaiterField: false,
    showRoomCharges: false,
    showServiceCharge: false,
    showWaiterOnSlip: false,
    kotSlipTitle: 'BAKERY TICKET',
    tableNoun: 'counters',
    allowedOrderTypes: ['takeaway', 'delivery'],
  },
  cloud_kitchen: {
    venueType: 'cloud_kitchen',
    label: 'Cloud',
    hint: 'Delivery kitchen, no tables',
    defaultOrderType: 'delivery',
    showTables: false,
    showWaiterField: false,
    showRoomCharges: false,
    showServiceCharge: false,
    showWaiterOnSlip: false,
    kotSlipTitle: 'DISPATCH TICKET',
    tableNoun: 'counters',
    allowedOrderTypes: ['delivery', 'takeaway'],
  },
  bar: {
    venueType: 'bar',
    label: 'Bar',
    hint: 'Tables, service & room charges',
    defaultOrderType: 'dine_in',
    showTables: true,
    showWaiterField: true,
    showRoomCharges: true,
    showServiceCharge: true,
    showWaiterOnSlip: true,
    kotSlipTitle: 'BAR / KITCHEN TICKET',
    tableNoun: 'tables',
    allowedOrderTypes: ['dine_in', 'takeaway'],
  },
}

export const VENUE_TYPES = Object.keys(VENUE_PRESETS) as KotVenueType[]

export const mergeKotConfig = (raw?: KotConfig | null): Required<KotConfig> => {
  const venue = raw?.venueType && VENUE_PRESETS[raw.venueType] ? raw.venueType : DEFAULT_KOT_CONFIG.venueType
  const preset = VENUE_PRESETS[venue]
  const allowed =
    raw?.allowedOrderTypes && raw.allowedOrderTypes.length > 0
      ? raw.allowedOrderTypes
      : preset.allowedOrderTypes

  return {
    venueType: venue,
    defaultOrderType:
      raw?.defaultOrderType && allowed.includes(raw.defaultOrderType)
        ? raw.defaultOrderType
        : allowed.includes(preset.defaultOrderType)
          ? preset.defaultOrderType
          : allowed[0],
    taxRate: raw?.taxRate ?? DEFAULT_KOT_CONFIG.taxRate,
    applyTaxOverride: raw?.applyTaxOverride ?? DEFAULT_KOT_CONFIG.applyTaxOverride,
    serviceChargeType: raw?.serviceChargeType || DEFAULT_KOT_CONFIG.serviceChargeType,
    serviceChargeValue: raw?.serviceChargeValue ?? DEFAULT_KOT_CONFIG.serviceChargeValue,
    acCharge: raw?.acCharge ?? DEFAULT_KOT_CONFIG.acCharge,
    nonAcCharge: raw?.nonAcCharge ?? DEFAULT_KOT_CONFIG.nonAcCharge,
    defaultRoomType: raw?.defaultRoomType || DEFAULT_KOT_CONFIG.defaultRoomType,
    kotSlipTitle: raw?.kotSlipTitle || preset.kotSlipTitle,
    showWaiterOnSlip: raw?.showWaiterOnSlip ?? preset.showWaiterOnSlip,
    showTables: raw?.showTables ?? preset.showTables,
    showWaiterField: raw?.showWaiterField ?? preset.showWaiterField,
    showRoomCharges: raw?.showRoomCharges ?? preset.showRoomCharges,
    showServiceCharge: raw?.showServiceCharge ?? preset.showServiceCharge,
    tableNoun: raw?.tableNoun || preset.tableNoun,
    allowedOrderTypes: allowed,
  }
}

export const applyVenuePreset = (current: Required<KotConfig>, venueType: KotVenueType): Required<KotConfig> => {
  const preset = VENUE_PRESETS[venueType]
  return {
    ...current,
    venueType,
    defaultOrderType: preset.defaultOrderType,
    showTables: preset.showTables,
    showWaiterField: preset.showWaiterField,
    showRoomCharges: preset.showRoomCharges,
    showServiceCharge: preset.showServiceCharge,
    showWaiterOnSlip: preset.showWaiterOnSlip,
    kotSlipTitle: preset.kotSlipTitle,
    tableNoun: preset.tableNoun,
    allowedOrderTypes: preset.allowedOrderTypes,
    defaultRoomType: preset.showRoomCharges ? current.defaultRoomType : 'none',
  }
}

export const ORDER_TYPE_OPTIONS: Array<{ id: KOTOrderType; label: string }> = [
  { id: 'dine_in', label: 'Dine-in' },
  { id: 'takeaway', label: 'Takeaway' },
  { id: 'delivery', label: 'Delivery' },
]

export const visibleOrderTypes = (cfg: Pick<KotConfig, 'allowedOrderTypes'>): Array<{ id: KOTOrderType; label: string }> => {
  const allowed = cfg.allowedOrderTypes?.length ? cfg.allowedOrderTypes : DEFAULT_KOT_CONFIG.allowedOrderTypes
  return ORDER_TYPE_OPTIONS.filter((opt) => allowed.includes(opt.id))
}

export const orderTypeLabel = (type?: string | null): string => {
  const match = ORDER_TYPE_OPTIONS.find((opt) => opt.id === type)
  return match?.label || 'Walk-in'
}

export const tableNounLabel = (noun?: KotTableNoun, plural = true): string => {
  if (noun === 'seats') return plural ? 'Seats' : 'Seat'
  if (noun === 'counters') return plural ? 'Counters' : 'Counter'
  return plural ? 'Tables' : 'Table'
}

export const ticketTitle = (tableName?: string | null, orderType?: string | null): string => {
  if (tableName) return tableName
  return orderTypeLabel(orderType)
}

export const computeServiceCharge = (subtotal: number, cfg: Pick<KotConfig, 'serviceChargeType' | 'serviceChargeValue'>): number => {
  const value = Math.max(0, Number(cfg.serviceChargeValue) || 0)
  if (cfg.serviceChargeType === 'flat') return value
  return (subtotal * value) / 100
}

export const roomChargeFor = (roomType: KotRoomType | undefined, cfg: Pick<KotConfig, 'acCharge' | 'nonAcCharge'>): number => {
  if (roomType === 'ac') return Math.max(0, Number(cfg.acCharge) || 0)
  if (roomType === 'non_ac') return Math.max(0, Number(cfg.nonAcCharge) || 0)
  return 0
}

export const roomChargeLabel = (roomType: KotRoomType | undefined): string => {
  if (roomType === 'ac') return 'AC Charge'
  if (roomType === 'non_ac') return 'Non-AC Charge'
  return 'Room Charge'
}
