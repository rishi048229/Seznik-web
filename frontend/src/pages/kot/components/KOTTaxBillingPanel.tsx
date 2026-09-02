import { Percent } from 'lucide-react'
import { GstBillingSettingsPanel } from '@/components/billing/GstBillingSettingsPanel'
import { BillChargesSettingsPanel } from '@/components/billing/BillChargesSettingsPanel'
import type { GstBillingFormState } from '@/hooks/useGstBillingSettings'
import type { GstBreakdownStyle } from '@/constants/gstBilling'
import type { BillChargePreset } from '@/constants/restaurantBilling'

interface KOTTaxBillingPanelProps {
  form: GstBillingFormState
  onShowBreakdownChange: (value: boolean) => void
  onStyleChange: (value: GstBreakdownStyle) => void
  onPrintOnReceiptChange: (value: boolean) => void
  onItemWiseGstChange: (value: boolean) => void
  chargePresets: BillChargePreset[]
  onChargePresetsChange: (presets: BillChargePreset[]) => void
}

/** Tax & billing controls for restaurant checkout — edited from KOT settings. */
export function KOTTaxBillingPanel({
  form,
  onShowBreakdownChange,
  onStyleChange,
  onPrintOnReceiptChange,
  onItemWiseGstChange,
  chargePresets,
  onChargePresetsChange,
}: KOTTaxBillingPanelProps) {
  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3 rounded-xl border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/40 dark:bg-emerald-950/20 p-3">
        <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 shrink-0">
          <Percent size={16} />
        </div>
        <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
          GST breakdown on bills and extra charges (service, packing, delivery). Receipt print layout is configured under Printers.
        </p>
      </div>

      <GstBillingSettingsPanel
        showBreakdown={form.showBreakdown}
        style={form.style}
        printOnReceipt={form.printOnReceipt}
        itemWiseGst={form.itemWiseGst}
        onShowBreakdownChange={onShowBreakdownChange}
        onStyleChange={onStyleChange}
        onPrintOnReceiptChange={onPrintOnReceiptChange}
        onItemWiseGstChange={onItemWiseGstChange}
        showSaveButton={false}
        variant="checkout"
        hintText="Show CGST/SGST or slab totals on KOT bills and POS checkout."
      />

      <div className="pt-4 border-t border-gray-200 dark:border-dark-border">
        <BillChargesSettingsPanel presets={chargePresets} onChange={onChargePresetsChange} />
      </div>
    </div>
  )
}
