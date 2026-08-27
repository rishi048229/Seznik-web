import toast from 'react-hot-toast'
import { Printer } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { GstBillingSettingsPanel } from '@/components/billing/GstBillingSettingsPanel'
import { useGstBillingSettings } from '@/hooks/useGstBillingSettings'
import { useLanguage } from '@/contexts/LanguageContext'
import { useSettings } from '@/hooks/useSettings'
import { resolveActiveCustomTemplate } from '@/utils/customReceiptEngine'

interface GstPrintDisplaySectionProps {
  className?: string
}

/** GST layout options for thermal / browser receipt prints — configured on Printers page. */
export function GstPrintDisplaySection({ className = '' }: GstPrintDisplaySectionProps) {
  const { t } = useLanguage()
  const {
    form,
    setStyle,
    setPrintOnReceipt,
    setItemWiseGst,
    saveGstBilling,
    isSaving,
  } = useGstBillingSettings()
  const { data: settings } = useSettings()
  const hasCustomTemplate = Boolean(resolveActiveCustomTemplate(settings?.receiptConfig))

  const handleSave = async () => {
    try {
      await saveGstBilling({
        onSuccess: () => toast.success(t('settings.gstPrintDisplaySaved')),
      })
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

      <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 bg-white dark:bg-gray-800/80">
        <GstBillingSettingsPanel
          showBreakdown={form.showBreakdown}
          style={form.style}
          printOnReceipt={form.printOnReceipt}
          itemWiseGst={form.itemWiseGst}
          onShowBreakdownChange={() => {}}
          onStyleChange={setStyle}
          onPrintOnReceiptChange={setPrintOnReceipt}
          onItemWiseGstChange={setItemWiseGst}
          showSaveButton={false}
          variant="print"
        />
      </div>

      {hasCustomTemplate ? (
        <p className="text-[11px] text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2 leading-relaxed">
          GST style applies to the tax section of your receipt template. Use Test Print to preview changes.
        </p>
      ) : null}

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isSaving} size="sm">
          {t('settings.saveGstPrintDisplay')}
        </Button>
      </div>
    </div>
  )
}
