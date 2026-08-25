import { useEffect, useMemo, useState } from 'react'
import {
  defaultSelectedPresetIds,
  getEnabledPresets,
  parseRestaurantBilling,
  resolveBillCharges,
  shouldShowBillCharges,
  type AppliedBillCharge,
} from '@/constants/restaurantBilling'

export function useBillCharges(
  invoiceConfig: unknown,
  grossSubtotal: number,
  totalDiscount: number,
) {
  const restaurantBilling = useMemo(() => parseRestaurantBilling(invoiceConfig), [invoiceConfig])
  const enabledPresets = useMemo(
    () => (shouldShowBillCharges(restaurantBilling) ? getEnabledPresets(restaurantBilling) : []),
    [restaurantBilling],
  )
  const presetKey = enabledPresets.map((preset) => `${preset.id}:${preset.defaultSelected}`).join('|')
  const [selectedIds, setSelectedIds] = useState<string[]>(() => defaultSelectedPresetIds(enabledPresets))

  useEffect(() => {
    setSelectedIds(presetKey ? defaultSelectedPresetIds(enabledPresets) : [])
    // Reset selections only when the enabled preset set changes, not on every cart total update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presetKey])

  const netSubtotal = Math.max(0, grossSubtotal - totalDiscount)
  const billCharges: AppliedBillCharge[] = useMemo(
    () => resolveBillCharges(enabledPresets, selectedIds, netSubtotal, grossSubtotal),
    [enabledPresets, selectedIds, netSubtotal, grossSubtotal],
  )
  const extraChargesTotal = billCharges.reduce((sum, charge) => sum + charge.amount, 0)

  const toggleCharge = (presetId: string) => {
    setSelectedIds((prev) =>
      prev.includes(presetId) ? prev.filter((id) => id !== presetId) : [...prev, presetId],
    )
  }

  return {
    enabledPresets,
    selectedIds,
    billCharges,
    extraChargesTotal,
    showCharges: enabledPresets.length > 0,
    netSubtotal,
    toggleCharge,
  }
}
