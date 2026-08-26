import type { KotConfig, KotRoomType } from '@/types/settings.types'
import type { KOTOrderType } from '@/types/kot.types'

export const DEFAULT_KOT_CONFIG: Required<KotConfig> = {
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
}

export const mergeKotConfig = (raw?: KotConfig | null): Required<KotConfig> => ({
  ...DEFAULT_KOT_CONFIG,
  ...raw,
  defaultOrderType: raw?.defaultOrderType || DEFAULT_KOT_CONFIG.defaultOrderType,
  serviceChargeType: raw?.serviceChargeType || DEFAULT_KOT_CONFIG.serviceChargeType,
  defaultRoomType: raw?.defaultRoomType || DEFAULT_KOT_CONFIG.defaultRoomType,
  kotSlipTitle: raw?.kotSlipTitle || DEFAULT_KOT_CONFIG.kotSlipTitle,
})

export const ORDER_TYPE_OPTIONS: Array<{ id: KOTOrderType; label: string }> = [
  { id: 'dine_in', label: 'Dine-in' },
  { id: 'takeaway', label: 'Takeaway' },
  { id: 'delivery', label: 'Delivery' },
]

export const orderTypeLabel = (type?: string | null): string => {
  const match = ORDER_TYPE_OPTIONS.find((opt) => opt.id === type)
  return match?.label || 'Walk-in'
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
