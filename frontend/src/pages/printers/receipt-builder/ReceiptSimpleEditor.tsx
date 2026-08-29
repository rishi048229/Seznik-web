import { useState, type ReactNode } from 'react'
import { ChevronDown, Minus, QrCode, Type } from 'lucide-react'
import { ImageUpload } from '@/components/forms/ImageUpload'
import { TEMPLATE_VARIABLES } from '@/types/customReceipt'
import type { CustomReceiptTemplate } from '@/types/customReceipt'
import { containsTemplateVar, isOnlyTemplateVar, parseTemplateSide, unwrapTemplateKey } from '@/utils/receiptTemplateTokens'
import { isValidUpiVpa } from '@/utils/upiQr'
import { ReceiptBlockEditorPanel } from './ReceiptBlockEditorPanel'
import { ReceiptTokenField } from './ReceiptTokenField'
import { ReceiptUpiIdField } from './ReceiptUpiIdField'
import {
  SIMPLE_ADD_CUSTOM_LINE,
  SIMPLE_ADD_DIVIDER,
  SIMPLE_ADD_QR,
  applyFooter,
  applyLeftRightSide,
  applyQrSection,
  applyStoreDetails,
  appendBlocks,
  defaultQrCaptionForPurpose,
  inferQrPurpose,
  isSectionEnabled,
  mapTemplateToSimple,
  patchSectionEntry,
  removeEntry,
  setSectionEnabled,
  updateCustomEntry,
  type QrPurpose,
  type SimpleSectionId,
} from './receiptSimpleSections'

interface ReceiptSimpleEditorProps {
  template: CustomReceiptTemplate
  onChange: (template: CustomReceiptTemplate) => void
  logoFallback?: string
  upiId?: string
  onUpiIdChange?: (upiId: string) => void
}

const inputCls = 'w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-xs'

const FIELD_OPTIONS = [
  { value: '', label: 'Plain text only' },
  ...TEMPLATE_VARIABLES.map((v) => ({ value: unwrapTemplateKey(v.key), label: v.label })),
]

function CompactSwitch({ checked, onChange }: { checked: boolean; onChange: (next: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={(e) => {
        e.stopPropagation()
        onChange(!checked)
      }}
      className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${
        checked ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  )
}

function SectionCard({
  title,
  description,
  enabled,
  onToggle,
  forceOpen,
  children,
}: {
  title: string
  description: string
  enabled: boolean
  onToggle: (next: boolean) => void
  forceOpen?: boolean
  children?: ReactNode
}) {
  const [open, setOpen] = useState(Boolean(forceOpen))
  const expanded = Boolean(children) && enabled && (open || forceOpen)
  const showBody = expanded

  return (
    <div className={`rounded-xl border bg-white dark:bg-gray-800 ${enabled ? 'border-gray-200 dark:border-gray-700' : 'border-gray-100 dark:border-gray-800 opacity-70'}`}>
      <div className="flex items-center gap-2 p-3">
        <button type="button" className="flex-1 text-left min-w-0" onClick={() => setOpen((v) => !v)}>
          <div className="flex items-center gap-1.5">
            <div className="text-xs font-bold text-gray-900 dark:text-gray-100">{title}</div>
            {children ? (
              <ChevronDown size={14} className={`text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`} />
            ) : null}
          </div>
          <div className="text-[11px] text-gray-500">{description}</div>
        </button>
        <CompactSwitch checked={enabled} onChange={onToggle} />
      </div>
      {showBody ? <div className="px-3 pb-3 border-t border-gray-100 dark:border-gray-700 pt-3 space-y-2">{children}</div> : null}
    </div>
  )
}

function SideEditors({
  left,
  right,
  onLeft,
  onRight,
}: {
  left: ReturnType<typeof parseTemplateSide>
  right: ReturnType<typeof parseTemplateSide>
  onLeft: (next: ReturnType<typeof parseTemplateSide>) => void
  onRight: (next: ReturnType<typeof parseTemplateSide>) => void
}) {
  const renderSide = (
    label: string,
    side: ReturnType<typeof parseTemplateSide>,
    onChange: (next: ReturnType<typeof parseTemplateSide>) => void
  ) => {
    if (side.complex) {
      return (
        <div>
          <label className="text-[10px] font-semibold text-gray-500">{label}</label>
          <ReceiptTokenField value={side.prefix} onChange={(text) => onChange({ prefix: text, fieldKey: null, complex: true })} />
        </div>
      )
    }
    return (
      <div className="space-y-1">
        <label className="text-[10px] font-semibold text-gray-500">{label}</label>
        <div className="grid grid-cols-2 gap-2">
          <input
            className={inputCls}
            value={side.prefix}
            placeholder="Label"
            onChange={(e) => onChange({ ...side, prefix: e.target.value, complex: false })}
          />
          <select
            className={inputCls}
            value={side.fieldKey || ''}
            onChange={(e) => onChange({ ...side, fieldKey: e.target.value || null, complex: false })}
          >
            {FIELD_OPTIONS.map((opt) => (
              <option key={opt.value || 'plain'} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {renderSide('Left', left, onLeft)}
      {renderSide('Right', right, onRight)}
    </div>
  )
}

export function ReceiptSimpleEditor({ template, onChange, logoFallback, upiId = '', onUpiIdChange }: ReceiptSimpleEditorProps) {
  const mapped = mapTemplateToSimple(template)
  const qrPurpose = mapped.qr ? inferQrPurpose(mapped.qr) : null
  const needsUpiId = Boolean(mapped.qr?.enabled && qrPurpose === 'upi')
  const storeFlags = {
    address: containsTemplateVar(mapped.storeDetails?.text || '', 'store_address'),
    phone: containsTemplateVar(mapped.storeDetails?.text || '', 'store_phone'),
    gstin: containsTemplateVar(mapped.storeDetails?.text || '', 'store_gstin'),
  }

  const toggle = (section: SimpleSectionId, next: boolean) => {
    onChange(setSectionEnabled(template, section, next))
  }

  return (
    <div className="space-y-2">
      {mapped.hasCustomLines ? (
        <p className="text-[11px] text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
          Some lines are custom. They appear at the bottom and can also be edited in Customize.
        </p>
      ) : null}

      <SectionCard
        title="Store logo"
        description="Printed at the top of the bill"
        enabled={isSectionEnabled(mapped, 'logo')}
        onToggle={(v) => toggle('logo', v)}
      >
        {mapped.logo ? (
          <>
            <ImageUpload
              label="Receipt image"
              value={mapped.logo.imageURL || logoFallback || ''}
              onChange={(url) =>
                onChange(patchSectionEntry(template, 'logo', (entry) => (entry.type === 'image' ? { ...entry, imageURL: url, imageUri: undefined } : entry)))
              }
              previewSize="sm"
            />
            <input
              type="range"
              min={20}
              max={100}
              value={mapped.logo.widthPercent || 60}
              onChange={(e) =>
                onChange(
                  patchSectionEntry(template, 'logo', (entry) =>
                    entry.type === 'image' ? { ...entry, widthPercent: Number(e.target.value) } : entry
                  )
                )
              }
            />
          </>
        ) : null}
      </SectionCard>

      <SectionCard
        title="Store name"
        description="Always uses the name from store settings"
        enabled={isSectionEnabled(mapped, 'storeName')}
        onToggle={(v) => toggle('storeName', v)}
      >
        {mapped.storeName && mapped.storeName.type === 'text' ? (
          <div className="grid grid-cols-2 gap-2">
            <select
              className={inputCls}
              value={mapped.storeName.size}
              onChange={(e) =>
                onChange(
                  patchSectionEntry(template, 'storeName', (entry) =>
                    entry.type === 'text' ? { ...entry, size: e.target.value as 'small' | 'medium' | 'large' } : entry
                  )
                )
              }
            >
              <option value="small">Small</option>
              <option value="medium">Medium</option>
              <option value="large">Large</option>
            </select>
            <select
              className={inputCls}
              value={mapped.storeName.align}
              onChange={(e) =>
                onChange(
                  patchSectionEntry(template, 'storeName', (entry) =>
                    entry.type === 'text' || entry.type === 'text_special'
                      ? { ...entry, align: e.target.value as 'left' | 'center' | 'right' }
                      : entry
                  )
                )
              }
            >
              <option value="left">Left</option>
              <option value="center">Center</option>
              <option value="right">Right</option>
            </select>
            <label className="flex items-center gap-2 text-xs col-span-2">
              <input
                type="checkbox"
                checked={!!mapped.storeName.bold}
                onChange={(e) =>
                  onChange(
                    patchSectionEntry(template, 'storeName', (entry) =>
                      entry.type === 'text' || entry.type === 'text_special' ? { ...entry, bold: e.target.checked } : entry
                    )
                  )
                }
              />
              Bold
            </label>
          </div>
        ) : null}
      </SectionCard>

      <SectionCard
        title="Store details"
        description="Address, phone, and GSTIN from store settings"
        enabled={isSectionEnabled(mapped, 'storeDetails')}
        onToggle={(v) => toggle('storeDetails', v)}
      >
        {(['address', 'phone', 'gstin'] as const).map((key) => (
          <label key={key} className="flex items-center gap-2 text-xs capitalize">
            <input
              type="checkbox"
              checked={storeFlags[key]}
              onChange={(e) => onChange(applyStoreDetails(template, { ...storeFlags, [key]: e.target.checked }))}
            />
            {key === 'gstin' ? 'GSTIN' : key}
          </label>
        ))}
      </SectionCard>

      <SectionCard
        title="Invoice row"
        description="Bill number and date"
        enabled={isSectionEnabled(mapped, 'invoiceRow')}
        onToggle={(v) => toggle('invoiceRow', v)}
      >
        {mapped.invoiceRow ? (
          <SideEditors
            left={parseTemplateSide(mapped.invoiceRow.left)}
            right={parseTemplateSide(mapped.invoiceRow.right)}
            onLeft={(side) => onChange(applyLeftRightSide(template, 'invoiceRow', 'left', side))}
            onRight={(side) => onChange(applyLeftRightSide(template, 'invoiceRow', 'right', side))}
          />
        ) : null}
      </SectionCard>

      <SectionCard
        title="Customer row"
        description="Customer name and time"
        enabled={isSectionEnabled(mapped, 'customerRow')}
        onToggle={(v) => toggle('customerRow', v)}
      >
        {mapped.customerRow ? (
          <SideEditors
            left={parseTemplateSide(mapped.customerRow.left)}
            right={parseTemplateSide(mapped.customerRow.right)}
            onLeft={(side) => onChange(applyLeftRightSide(template, 'customerRow', 'left', side))}
            onRight={(side) => onChange(applyLeftRightSide(template, 'customerRow', 'right', side))}
          />
        ) : null}
      </SectionCard>

      <SectionCard
        title="Items table"
        description="Sold items with quantity and amount"
        enabled={isSectionEnabled(mapped, 'items')}
        onToggle={(v) => toggle('items', v)}
      >
        {mapped.items ? (
          <>
            <select
              className={inputCls}
              value={mapped.items.tableType}
              onChange={(e) =>
                onChange(
                  patchSectionEntry(template, 'items', (entry) =>
                    entry.type === 'table' ? { ...entry, tableType: e.target.value as 'simple' | 'advanced' } : entry
                  )
                )
              }
            >
              <option value="simple">Simple</option>
              <option value="advanced">Advanced</option>
            </select>
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={!!mapped.items.showTaxColumn}
                onChange={(e) =>
                  onChange(
                    patchSectionEntry(template, 'items', (entry) =>
                      entry.type === 'table' ? { ...entry, showTaxColumn: e.target.checked } : entry
                    )
                  )
                }
              />
              Show tax column
            </label>
          </>
        ) : null}
      </SectionCard>

      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3 space-y-1">
        <div className="text-xs font-bold text-gray-900 dark:text-gray-100">Totals</div>
        <p className="text-[11px] text-gray-500 pb-1">Turn each amount line on or off</p>
        {(
          [
            ['subtotal', 'Subtotal'],
            ['discount', 'Discount'],
            ['tax', 'Tax'],
            ['grandTotal', 'Grand total'],
          ] as const
        ).map(([id, label]) => (
          <div key={id} className="flex items-center justify-between py-1">
            <span className="text-xs text-gray-800 dark:text-gray-200">{label}</span>
            <CompactSwitch checked={isSectionEnabled(mapped, id)} onChange={(v) => toggle(id, v)} />
          </div>
        ))}
      </div>

      <SectionCard
        title="QR code"
        description="UPI payment, digital bill, or custom link"
        enabled={isSectionEnabled(mapped, 'qr')}
        onToggle={(v) => toggle('qr', v)}
        forceOpen={needsUpiId && !isValidUpiVpa(mapped.qr?.upiId || upiId)}
      >
        {mapped.qr ? (
          <>
            <select
              className={inputCls}
              value={inferQrPurpose(mapped.qr)}
              onChange={(e) => onChange(applyQrSection(template, { purpose: e.target.value as QrPurpose }))}
            >
              <option value="upi">💳 UPI payment QR</option>
              <option value="digital_bill">📄 Digital bill / Invoice PDF QR</option>
              <option value="custom">🔗 Custom link / Website</option>
            </select>
            {inferQrPurpose(mapped.qr) === 'upi' ? (
              <ReceiptUpiIdField
                value={mapped.qr.upiId || upiId}
                onChange={(next) => {
                  onUpiIdChange?.(next)
                  onChange(
                    patchSectionEntry(template, 'qr', (entry) =>
                      entry.type === 'barcode' ? { ...entry, upiId: next, qrType: 'upi' } : entry
                    )
                  )
                }}
              />
            ) : null}
            {inferQrPurpose(mapped.qr) === 'custom' ? (
              <ReceiptTokenField
                value={mapped.qr.value}
                placeholder="Custom QR or barcode value"
                onChange={(value) =>
                  onChange(patchSectionEntry(template, 'qr', (entry) => (entry.type === 'barcode' ? { ...entry, value, qrType: 'custom' } : entry)))
                }
              />
            ) : null}
            <div className="pt-2 border-t border-gray-100 dark:border-gray-700/80 space-y-1">
              <label className="text-[10px] font-semibold text-gray-700 dark:text-gray-300 block">
                Statement below QR (Printed on bill)
              </label>
              <input
                className={inputCls}
                value={mapped.qrCaption?.text ?? defaultQrCaptionForPurpose(inferQrPurpose(mapped.qr))}
                placeholder="e.g. Scan to pay with UPI or Scan to download bill PDF"
                onChange={(e) => onChange(applyQrSection(template, { caption: e.target.value }))}
              />
              <p className="text-[10px] text-gray-500">
                You can edit this custom text sentence to display anything below the QR code.
              </p>
            </div>
          </>
        ) : null}
      </SectionCard>

      <SectionCard
        title="Footer"
        description="Thank-you line at the bottom"
        enabled={isSectionEnabled(mapped, 'footer')}
        onToggle={(v) => toggle('footer', v)}
      >
        {mapped.footer ? (
          <>
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={isOnlyTemplateVar(mapped.footer.text, 'footer_message')}
                onChange={(e) => onChange(applyFooter(template, { useStoreFooter: e.target.checked }))}
              />
              Use store thank-you message
            </label>
            {!isOnlyTemplateVar(mapped.footer.text, 'footer_message') ? (
              <ReceiptTokenField
                multiline
                value={mapped.footer.text}
                placeholder="Thank you! Visit again."
                onChange={(text) => onChange(applyFooter(template, { text }))}
              />
            ) : null}
          </>
        ) : null}
      </SectionCard>

      {mapped.customEntries.length > 0 ? (
        <div className="space-y-2 pt-2">
          <div className="text-xs font-bold text-gray-900 dark:text-gray-100">Custom lines</div>
          {mapped.customEntries.map((entry) => (
            <div key={entry.id} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-gray-700 dark:text-gray-200">Custom line</span>
                <div className="flex items-center gap-2">
                  <CompactSwitch
                    checked={entry.enabled}
                    onChange={(enabled) => onChange(updateCustomEntry(template, entry.id, (e) => ({ ...e, enabled })))}
                  />
                  <button
                    type="button"
                    className="text-[11px] text-red-500"
                    onClick={() => onChange(removeEntry(template, entry.id))}
                  >
                    Remove
                  </button>
                </div>
              </div>
              <ReceiptBlockEditorPanel
                entry={entry}
                logoFallback={logoFallback}
                storeUpiId={upiId}
                onStoreUpiIdChange={onUpiIdChange}
                onChange={(updated) => onChange(updateCustomEntry(template, entry.id, () => updated))}
              />
            </div>
          ))}
        </div>
      ) : null}

      <div className="pt-2">
        <div className="text-xs font-semibold text-gray-500 mb-1.5">Add</div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 text-xs font-semibold"
            onClick={() => onChange(appendBlocks(template, [SIMPLE_ADD_DIVIDER()]))}
          >
            <Minus size={14} /> Divider
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 text-xs font-semibold"
            onClick={() => onChange(appendBlocks(template, [SIMPLE_ADD_CUSTOM_LINE()]))}
          >
            <Type size={14} /> Custom line
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 text-xs font-semibold"
            onClick={() => onChange(appendBlocks(template, [SIMPLE_ADD_QR()]))}
          >
            <QrCode size={14} /> Extra QR
          </button>
        </div>
      </div>
    </div>
  )
}
