import { useMemo } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { PrinterConfig, ReceiptConfig, UserSettings } from '@/types/settings.types'
import { Switch } from '@/components/ui/Switch'
import { FieldInfo } from '@/components/ui/FieldInfo'
import { Section, chipClass, fieldClass } from './PrintersUi'
import {
  A4_INVOICE_TEMPLATES,
  applyA4TemplateDefaults,
  getA4InvoiceTemplate,
  sampleSaleForTemplate,
} from '@/utils/a4InvoiceTemplates'
import { generateA4InvoiceHTML, wrapA4Document } from '@/utils/a4Invoice'
import { resolveEffectiveReceiptConfig } from '@/utils/receipt'

const THEMES: Array<{ id: PrinterConfig['invoiceColorTheme']; label: string }> = [
  { id: 'navy', label: 'Navy' },
  { id: 'emerald', label: 'Emerald' },
  { id: 'slate', label: 'Slate' },
  { id: 'royal', label: 'Royal' },
  { id: 'rose', label: 'Rose' },
  { id: 'amber', label: 'Amber' },
  { id: 'teal', label: 'Teal' },
  { id: 'wine', label: 'Wine' },
]

interface A4InvoiceTabProps {
  config: PrinterConfig
  setConfig: Dispatch<SetStateAction<PrinterConfig>>
  receiptConfig: ReceiptConfig
  setReceiptConfig: Dispatch<SetStateAction<ReceiptConfig>>
  settings?: UserSettings | null
}

export function A4InvoiceTab({
  config,
  setConfig,
  receiptConfig,
  setReceiptConfig,
  settings,
}: A4InvoiceTabProps) {
  const template = getA4InvoiceTemplate(config.invoiceTemplateId)

  const previewHtml = useMemo(() => {
    const sale = sampleSaleForTemplate(config.invoiceTemplateId)
    const mergedReceipt = resolveEffectiveReceiptConfig(
      {
        ...settings,
        businessName: settings?.businessName,
        businessAddress: settings?.businessAddress,
        receiptConfig: {
          ...receiptConfig,
          showPaymentQR: config.invoiceShowPaymentQR,
        },
        printerConfig: config,
      },
      receiptConfig,
    )
    const inner = generateA4InvoiceHTML({
      sale,
      receiptConfig: mergedReceipt,
      printerConfig: config,
      businessName: receiptConfig.companyName || settings?.businessName,
      businessAddress: receiptConfig.address || settings?.businessAddress,
      customerName: template.id === 'hotel' ? 'Guest — Sharma' : template.id === 'wholesale' ? 'Metro Traders' : 'Walk-in Customer',
      customer: {
        name: template.id === 'hotel' ? 'Guest — Sharma' : template.id === 'wholesale' ? 'Metro Traders' : 'Walk-in Customer',
        phone: '98765 43210',
        address: template.id === 'electrician' ? 'Flat 12B, Lakeview Apts' : 'Main Market Road',
      },
      logoURL: receiptConfig.logoURL || settings?.businessLogoURL,
      settingsTaxName: 'GST',
    })
    return wrapA4Document(inner, 'A4 preview', config.invoicePaperSize)
  }, [config, receiptConfig, settings, template.id])

  const setField = <K extends keyof PrinterConfig>(key: K, value: PrinterConfig[K]) => {
    setConfig(prev => ({ ...prev, [key]: value }))
  }

  return (
    <div className="flex flex-col xl:flex-row gap-6 items-start w-full">
      <div className="w-full xl:w-7/12 space-y-4 min-w-0">
        <Section
          eyebrow="Layout"
          title="Choose an A4 bill template"
          description="15 layouts built for different trades. GST fields stay on every bill; extra columns and labels change with the business type."
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {A4_INVOICE_TEMPLATES.map(item => {
              const active = (config.invoiceTemplateId || 'retail') === item.id
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setConfig(prev => applyA4TemplateDefaults(prev, item.id))}
                  className={`text-left rounded-xl border p-3 transition-colors ${
                    active
                      ? 'border-slate-900 dark:border-white bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950/40 hover:border-slate-400'
                  }`}
                >
                  <p className={`text-[10px] font-semibold uppercase tracking-wider ${active ? 'opacity-70' : 'text-slate-400'}`}>
                    {item.category}
                  </p>
                  <p className="text-sm font-semibold mt-0.5">{item.name}</p>
                  <p className={`text-[11px] mt-1 leading-snug ${active ? 'opacity-80' : 'text-slate-500'}`}>
                    {item.description}
                  </p>
                </button>
              )
            })}
          </div>
        </Section>

        <Section
          eyebrow="Document"
          title="Edit this A4 bill"
          description="These fields print on every A4 invoice until you change them. Save at the top of the page."
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="flex items-center text-xs font-semibold text-slate-500 mb-1.5">
                Document title
              </span>
              <input
                className={fieldClass}
                value={config.invoiceDocTitle ?? template.docTitle}
                onChange={e => setField('invoiceDocTitle', e.target.value)}
              />
            </label>
            <label className="block">
              <span className="flex items-center text-xs font-semibold text-slate-500 mb-1.5">
                Paper size
                <FieldInfo textKey="tip.printer.invoiceSize" />
              </span>
              <select
                className={fieldClass}
                value={config.invoicePaperSize}
                onChange={e => setField('invoicePaperSize', e.target.value as PrinterConfig['invoicePaperSize'])}
              >
                <option value="A4">A4</option>
                <option value="Letter">US Letter</option>
              </select>
            </label>
            <label className="block sm:col-span-2">
              <span className="flex items-center text-xs font-semibold text-slate-500 mb-1.5">
                Colour
                <FieldInfo textKey="tip.printer.invoiceTheme" />
              </span>
              <div className="flex flex-wrap gap-2">
                {THEMES.map(theme => (
                  <button
                    key={theme.id}
                    type="button"
                    onClick={() => setField('invoiceColorTheme', theme.id)}
                    className={`${chipClass(config.invoiceColorTheme === theme.id)} px-3 py-1.5`}
                  >
                    {theme.label}
                  </button>
                ))}
              </div>
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <label className="block">
              <span className="text-xs font-semibold text-slate-500 mb-1.5 block">Business name on bill</span>
              <input
                className={fieldClass}
                value={receiptConfig.companyName}
                onChange={e => setReceiptConfig(prev => ({ ...prev, companyName: e.target.value }))}
                placeholder={settings?.businessName || 'Business name'}
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-500 mb-1.5 block">GSTIN</span>
              <input
                className={fieldClass}
                value={receiptConfig.gstin}
                onChange={e => setReceiptConfig(prev => ({ ...prev, gstin: e.target.value }))}
                placeholder={settings?.businessGSTIN || 'GSTIN'}
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="text-xs font-semibold text-slate-500 mb-1.5 block">Address</span>
              <input
                className={fieldClass}
                value={receiptConfig.address}
                onChange={e => setReceiptConfig(prev => ({ ...prev, address: e.target.value }))}
                placeholder={settings?.businessAddress || 'Address'}
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-500 mb-1.5 block">Phone</span>
              <input
                className={fieldClass}
                value={receiptConfig.phone}
                onChange={e => setReceiptConfig(prev => ({ ...prev, phone: e.target.value }))}
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-500 mb-1.5 block">Signatory name</span>
              <input
                className={fieldClass}
                value={config.invoiceSignatureName ?? 'Authorised Signatory'}
                onChange={e => setField('invoiceSignatureName', e.target.value)}
              />
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-semibold text-slate-500 mb-1.5 block">Place of supply</span>
              <input
                className={fieldClass}
                value={config.invoicePlaceOfSupply ?? ''}
                onChange={e => setField('invoicePlaceOfSupply', e.target.value)}
                placeholder="e.g. Maharashtra (27)"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-500 mb-1.5 block">Reverse charge</span>
              <input
                className={fieldClass}
                value={config.invoiceReverseCharge ?? 'No'}
                onChange={e => setField('invoiceReverseCharge', e.target.value)}
              />
            </label>
            {(template.showFssai || config.invoiceFssai) && (
              <label className="block">
                <span className="text-xs font-semibold text-slate-500 mb-1.5 block">FSSAI number</span>
                <input
                  className={fieldClass}
                  value={config.invoiceFssai ?? ''}
                  onChange={e => setField('invoiceFssai', e.target.value)}
                />
              </label>
            )}
            {(template.showLicense || config.invoiceLicenseNo) && (
              <label className="block">
                <span className="text-xs font-semibold text-slate-500 mb-1.5 block">Licence / registration</span>
                <input
                  className={fieldClass}
                  value={config.invoiceLicenseNo ?? ''}
                  onChange={e => setField('invoiceLicenseNo', e.target.value)}
                />
              </label>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {([1, 2, 3] as const).map(n => (
              <div key={n} className="space-y-2">
                <input
                  className={fieldClass}
                  placeholder={`Extra label ${n}`}
                  value={(config[`invoiceMeta${n}Label` as const] as string) ?? ''}
                  onChange={e => setField(`invoiceMeta${n}Label` as const, e.target.value)}
                />
                <input
                  className={fieldClass}
                  placeholder="Value printed on bill"
                  value={(config[`invoiceMeta${n}Value` as const] as string) ?? ''}
                  onChange={e => setField(`invoiceMeta${n}Value` as const, e.target.value)}
                />
              </div>
            ))}
          </div>

          {template.showBank && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input
                className={fieldClass}
                placeholder="Bank name"
                value={config.invoiceBankName ?? ''}
                onChange={e => setField('invoiceBankName', e.target.value)}
              />
              <input
                className={fieldClass}
                placeholder="Account number"
                value={config.invoiceBankAccount ?? ''}
                onChange={e => setField('invoiceBankAccount', e.target.value)}
              />
              <input
                className={fieldClass}
                placeholder="IFSC"
                value={config.invoiceBankIfsc ?? ''}
                onChange={e => setField('invoiceBankIfsc', e.target.value)}
              />
            </div>
          )}

          <label className="block">
            <span className="text-xs font-semibold text-slate-500 mb-1.5 block">Notes on bill</span>
            <textarea
              rows={2}
              className={fieldClass}
              value={config.invoiceNotes ?? ''}
              onChange={e => setField('invoiceNotes', e.target.value)}
              placeholder="Printed under amount in words"
            />
          </label>

          <label className="block">
            <span className="flex items-center text-xs font-semibold text-slate-500 mb-1.5">
              Terms &amp; conditions
              <FieldInfo textKey="tip.printer.invoiceTerms" />
            </span>
            <textarea
              rows={4}
              className={`${fieldClass} font-mono`}
              value={config.invoiceTermsText}
              onChange={e => setField('invoiceTermsText', e.target.value)}
            />
          </label>

          <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-100 dark:border-slate-800 rounded-xl px-4">
            <Switch checked={config.invoiceShowHeader} onChange={v => setField('invoiceShowHeader', v)} label="Header banner" info={<FieldInfo textKey="tip.printer.invoiceShowHeader" />} />
            <Switch checked={config.invoiceShowTerms} onChange={v => setField('invoiceShowTerms', v)} label="Print terms & conditions" info={<FieldInfo textKey="tip.printer.invoiceShowTerms" />} />
            <Switch checked={config.invoiceShowPaymentQR} onChange={v => setField('invoiceShowPaymentQR', v)} label="UPI payment QR code" info={<FieldInfo textKey="tip.printer.invoiceShowPaymentQR" />} />
            <Switch checked={config.invoiceShowHsn ?? template.showHsn} onChange={v => setField('invoiceShowHsn', v)} label={`${template.codeLabel} column`} />
            <Switch checked={config.invoiceShowSku ?? template.showSku} onChange={v => setField('invoiceShowSku', v)} label="SKU column" />
            <Switch checked={config.invoiceShowUnit ?? template.showUnit} onChange={v => setField('invoiceShowUnit', v)} label="Unit column" />
            <Switch checked={config.invoiceShowBatchExpiry ?? template.showBatchExpiry} onChange={v => setField('invoiceShowBatchExpiry', v)} label="Expiry column" />
          </div>
        </Section>
      </div>

      <div className="w-full xl:w-5/12 flex flex-col xl:sticky xl:top-6 min-w-0">
        <Section
          eyebrow="Preview"
          title={template.name}
          description="This is the bill customers get for A4 print and PDF download. Save to use it on Sales and checkout."
        >
          <div className="overflow-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950 p-3">
            <div className="mx-auto" style={{ width: 210 * 0.48, height: 297 * 0.48 }}>
              <iframe
                title="A4 invoice preview"
                srcDoc={previewHtml}
                className="origin-top-left bg-white pointer-events-none"
                style={{
                  width: '210mm',
                  height: '297mm',
                  border: 0,
                  transform: 'scale(0.48)',
                }}
              />
            </div>
          </div>
        </Section>
      </div>
    </div>
  )
}
