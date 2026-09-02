import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import toast from 'react-hot-toast'
import { Button } from '@/components/ui/Button'
import { GstBillingSettingsPanel } from '@/components/billing/GstBillingSettingsPanel'
import { BillChargesSettingsPanel } from '@/components/billing/BillChargesSettingsPanel'
import { useGstBillingSettings } from '@/hooks/useGstBillingSettings'
import { useLanguage } from '@/contexts/LanguageContext'
import {
  DEFAULT_RESTAURANT_PRESETS,
  parseRestaurantBilling,
  toRestaurantBillingPayload,
  type BillChargePreset,
} from '@/constants/restaurantBilling'

interface GstBillingSettingsModalProps {
  isOpen: boolean
  onClose: () => void
}

export function GstBillingSettingsModal({ isOpen, onClose }: GstBillingSettingsModalProps) {
  const { t } = useLanguage()
  const {
    form,
    setShowBreakdown,
    setStyle,
    setPrintOnReceipt,
    setItemWiseGst,
    saveGstBilling,
    isSaving,
    settings,
  } = useGstBillingSettings()
  const [chargePresets, setChargePresets] = useState<BillChargePreset[]>(DEFAULT_RESTAURANT_PRESETS)

  useEffect(() => {
    if (!isOpen || !settings) return
    setChargePresets(parseRestaurantBilling(settings.invoiceConfig).presets)
  }, [isOpen, settings?.id, settings?.invoiceConfig])

  if (!isOpen) return null

  const handleSave = async () => {
    try {
      await saveGstBilling({
        extraInvoiceConfig: {
          restaurantBilling: toRestaurantBillingPayload({ presets: chargePresets }),
        },
        onSuccess: () => {
          toast.success(t('settings.taxBillingSaved'))
          onClose()
        },
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('settings.failedToSavePrefix')
      toast.error(msg)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <button type="button" className="absolute inset-0 bg-black/50" onClick={onClose} aria-label="Close" />
      <div className="relative w-full sm:max-w-lg max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-white dark:bg-dark-bg shadow-xl border border-gray-200 dark:border-dark-border">
        <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-dark-border bg-white dark:bg-dark-bg">
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">{t('nav.taxBilling')}</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-dark-card text-gray-500"
          >
            <X size={20} />
          </button>
        </div>
        <div className="p-5 space-y-5">
          <GstBillingSettingsPanel
            showBreakdown={form.showBreakdown}
            style={form.style}
            printOnReceipt={form.printOnReceipt}
            itemWiseGst={form.itemWiseGst}
            onShowBreakdownChange={setShowBreakdown}
            onStyleChange={setStyle}
            onPrintOnReceiptChange={setPrintOnReceipt}
            onItemWiseGstChange={setItemWiseGst}
            showSaveButton={false}
          />
          <div className="pt-5 border-t border-gray-200 dark:border-dark-border">
            <BillChargesSettingsPanel presets={chargePresets} onChange={setChargePresets} />
          </div>
          <Button onClick={handleSave} loading={isSaving} className="w-full">
            {t('settings.saveTaxBilling')}
          </Button>
        </div>
      </div>
    </div>
  )
}
