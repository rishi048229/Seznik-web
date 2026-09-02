import toast from 'react-hot-toast'
import { Printer } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { GstBillingSettingsPanel } from '@/components/billing/GstBillingSettingsPanel'
import type { GstBillingFormState } from '@/hooks/useGstBillingSettings'
import type { GstBreakdownStyle } from '@/constants/gstBilling'
import { useLanguage } from '@/contexts/LanguageContext'

export interface GstPrintDisplaySectionProps {
  className?: string
  form: GstBillingFormState
  onStyleChange: (style: GstBreakdownStyle) => void
  onPrintOnReceiptChange: (printOnReceipt: boolean) => void
  onItemWiseGstChange: (itemWiseGst: boolean) => void
  onSave: () => Promise<void>
  isSaving?: boolean
}

/** GST layout options for thermal / browser receipt prints — shown on Printers page receipt tab. */
export function GstPrintDisplaySection({
  className = '',
  form,
  onStyleChange,
  onPrintOnReceiptChange,
  onItemWiseGstChange,
  onSave,
  isSaving = false,
}: GstPrintDisplaySectionProps) {
  const { t } = useLanguage()

  const handleSave = async () => {
    try {
      await onSave()
      toast.success(t('settings.gstPrintDisplaySaved'))
    } catch {
      toast.error('Failed to save GST print settings')
    }
  }

  return (
    <div className={`rounded-2xl border border-indigo-200 dark:border-indigo-800/60 bg-indigo-50/50 dark:bg-indigo-950/20 p-4 sm:p-5 space-y-4 ${className}`}>
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 shrink-0">
          <Printer size={18} />
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">{t('settings.gstPrintDisplayTitle')}</h3>
          <p className="text-[11px] text-gray-600 dark:text-gray-400 mt-0.5 leading-relaxed">
            {t('settings.gstPrintDisplayDesc')}
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 dark:border-dark-border p-4 bg-white dark:bg-dark-card/80">
        <GstBillingSettingsPanel
          showBreakdown={form.showBreakdown}
          style={form.style}
          printOnReceipt={form.printOnReceipt}
          itemWiseGst={form.itemWiseGst}
          onShowBreakdownChange={() => {}}
          onStyleChange={onStyleChange}
          onPrintOnReceiptChange={onPrintOnReceiptChange}
          onItemWiseGstChange={onItemWiseGstChange}
          showSaveButton={false}
          variant="print"
        />
      </div>

      <p className="text-[11px] text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-lg px-3 py-2 leading-relaxed">
        Changes update the live preview instantly. Save when you are ready to keep them for printing.
      </p>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isSaving} size="sm">
          {t('settings.saveGstPrintDisplay')}
        </Button>
      </div>
    </div>
  )
}
