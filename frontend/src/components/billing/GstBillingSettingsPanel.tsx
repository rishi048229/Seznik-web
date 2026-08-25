import { Check } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Switch } from '@/components/ui/Switch'
import { GST_BREAKDOWN_STYLE_OPTIONS, type GstBreakdownStyle } from '@/constants/gstBilling'
import { useLanguage } from '@/contexts/LanguageContext'

export interface GstBillingSettingsPanelProps {
  showBreakdown: boolean
  style: GstBreakdownStyle
  printOnReceipt: boolean
  itemWiseGst: boolean
  onShowBreakdownChange: (value: boolean) => void
  onStyleChange: (value: GstBreakdownStyle) => void
  onPrintOnReceiptChange: (value: boolean) => void
  onItemWiseGstChange: (value: boolean) => void
  onSave?: () => void
  isSaving?: boolean
  showSaveButton?: boolean
  hintText?: string
  className?: string
}

export function GstBillingSettingsPanel({
  showBreakdown,
  style: gstStyle,
  printOnReceipt,
  itemWiseGst,
  onShowBreakdownChange,
  onStyleChange,
  onPrintOnReceiptChange,
  onItemWiseGstChange,
  onSave,
  isSaving = false,
  showSaveButton = true,
  hintText,
  className = '',
}: GstBillingSettingsPanelProps) {
  const { t } = useLanguage()

  return (
    <div className={`space-y-4 ${className}`}>
      {hintText !== undefined ? (
        hintText ? (
          <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">{hintText}</p>
        ) : null
      ) : (
        <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">{t('settings.gstBillingHint')}</p>
      )}

      <Switch
        checked={showBreakdown}
        onChange={(val) => {
          onShowBreakdownChange(val)
          if (val && !printOnReceipt) onPrintOnReceiptChange(true)
        }}
        label={t('settings.gstShowBreakdown')}
        description={t('settings.gstShowBreakdownDesc')}
      />

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">
          {t('settings.gstStyleLabel')}
        </p>
        <div className="space-y-2">
          {GST_BREAKDOWN_STYLE_OPTIONS.map((option) => {
            const selected = gstStyle === option.value
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => onStyleChange(option.value)}
                className={`w-full text-left px-3 py-2.5 rounded-lg border transition-colors ${
                  selected
                    ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className={`text-sm font-semibold ${selected ? 'text-blue-700 dark:text-blue-300' : 'text-gray-900 dark:text-gray-100'}`}>
                      {option.label}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-snug">{option.description}</p>
                  </div>
                  {selected ? <Check size={16} className="text-blue-600 shrink-0 mt-0.5" /> : null}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      <Switch
        checked={printOnReceipt}
        onChange={onPrintOnReceiptChange}
        label={t('settings.gstPrintOnReceipt')}
        description={t('settings.gstPrintOnReceiptDesc')}
      />

      <Switch
        checked={itemWiseGst}
        onChange={onItemWiseGstChange}
        label={t('settings.gstItemWise')}
        description={t('settings.gstItemWiseDesc')}
      />

      {showSaveButton && onSave ? (
        <Button onClick={onSave} loading={isSaving} className="w-full sm:w-auto">
          {t('settings.saveTaxBilling')}
        </Button>
      ) : null}
    </div>
  )
}
