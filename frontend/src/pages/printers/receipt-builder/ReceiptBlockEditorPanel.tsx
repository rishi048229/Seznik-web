import type { CustomReceiptEntry, ReceiptEntryType } from '@/types/customReceipt'
import { ImageUpload } from '@/components/forms/ImageUpload'
import { ReceiptTokenField } from './ReceiptTokenField'
import { applyQrPurpose, inferQrPurpose, type QrPurpose } from './receiptSimpleSections'
import { ReceiptUpiIdField } from './ReceiptUpiIdField'
import { resolveShowItemNumbers } from '@/utils/customReceiptEngine'

interface ReceiptBlockEditorPanelProps {
  entry: CustomReceiptEntry
  logoFallback?: string
  storeUpiId?: string
  onStoreUpiIdChange?: (upiId: string) => void
  onChange: (entry: CustomReceiptEntry) => void
  isRestaurant?: boolean
}

const inputCls = 'w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-xs'

export function ReceiptBlockEditorPanel({
  entry,
  logoFallback,
  storeUpiId,
  onStoreUpiIdChange,
  onChange,
  isRestaurant = false,
}: ReceiptBlockEditorPanelProps) {
  switch (entry.type) {
    case 'text':
    case 'text_special':
      return (
        <div className="space-y-2">
          <ReceiptTokenField
            value={entry.text}
            multiline
            onChange={(text) => onChange({ ...entry, text })}
          />
          <div className="grid grid-cols-2 gap-2">
            <select className={inputCls} value={entry.align} onChange={(e) => onChange({ ...entry, align: e.target.value as typeof entry.align })}>
              <option value="left">Left</option>
              <option value="center">Center</option>
              <option value="right">Right</option>
            </select>
            {entry.type === 'text' ? (
              <select className={inputCls} value={entry.size} onChange={(e) => onChange({ ...entry, size: e.target.value as typeof entry.size })}>
                <option value="small">Small</option>
                <option value="medium">Medium</option>
                <option value="large">Large</option>
              </select>
            ) : (
              <input type="number" className={inputCls} value={entry.fontSizePt} onChange={(e) => onChange({ ...entry, fontSizePt: Number(e.target.value) })} />
            )}
          </div>
          <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={!!entry.bold} onChange={(e) => onChange({ ...entry, bold: e.target.checked })} /> Bold</label>
        </div>
      )
    case 'left_right_text':
      return (
        <div className="space-y-2">
          <div>
            <label className="text-[10px] font-semibold text-gray-500">Left</label>
            <ReceiptTokenField value={entry.left} onChange={(left) => onChange({ ...entry, left })} />
          </div>
          <div>
            <label className="text-[10px] font-semibold text-gray-500">Right</label>
            <ReceiptTokenField value={entry.right} onChange={(right) => onChange({ ...entry, right })} />
          </div>
        </div>
      )
    case 'horizontal_line':
      return (
        <select className={inputCls} value={entry.lineStyle} onChange={(e) => onChange({ ...entry, lineStyle: e.target.value as typeof entry.lineStyle })}>
          <option value="single">Single</option>
          <option value="double">Double</option>
          <option value="dashed">Dashed</option>
          <option value="dotted">Dotted</option>
        </select>
      )
    case 'table':
      return (
        <div className="space-y-2 text-xs">
          <select className={inputCls} value={entry.tableType} onChange={(e) => onChange({ ...entry, tableType: e.target.value as typeof entry.tableType })}>
            <option value="simple">Simple</option>
            <option value="advanced">Advanced</option>
          </select>
          <label className="flex items-center gap-2"><input type="checkbox" checked={!!entry.showTaxColumn} onChange={(e) => onChange({ ...entry, showTaxColumn: e.target.checked })} /> Show tax column</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={resolveShowItemNumbers(entry, isRestaurant)} onChange={(e) => onChange({ ...entry, showItemNumbers: e.target.checked })} /> Number line items (1. 2. 3.)</label>
        </div>
      )
    case 'barcode': {
      const purpose = inferQrPurpose(entry)
      return (
        <div className="space-y-2">
          <select
            className={inputCls}
            value={purpose}
            onChange={(e) => onChange(applyQrPurpose(entry, e.target.value as QrPurpose))}
          >
            <option value="upi">💳 UPI payment QR</option>
            <option value="digital_bill">📄 Digital bill / Invoice PDF QR</option>
            <option value="custom">🔗 Custom link / Website</option>
          </select>
          {purpose === 'upi' ? (
            <ReceiptUpiIdField
              value={entry.upiId || storeUpiId || ''}
              onChange={(upiId) => {
                onChange({ ...entry, upiId, qrType: 'upi' })
                onStoreUpiIdChange?.(upiId)
              }}
            />
          ) : null}
          {purpose === 'custom' ? (
            <ReceiptTokenField
              value={entry.value}
              placeholder="Custom QR or barcode value"
              onChange={(value) => onChange({ ...entry, value, qrType: 'custom' })}
            />
          ) : null}
        </div>
      )
    }
    case 'image':
      return (
        <div className="space-y-2">
          <ImageUpload
            label="Receipt image"
            value={entry.imageURL || logoFallback || ''}
            onChange={(url) => onChange({ ...entry, imageURL: url, imageUri: undefined })}
            previewSize="sm"
            enableBackgroundCleanup
          />
          <input type="range" min={20} max={100} value={entry.widthPercent || 60} onChange={(e) => onChange({ ...entry, widthPercent: Number(e.target.value) })} />
        </div>
      )
    case 'multi_format':
      return (
        <div className="space-y-2">
          {(entry.segments || []).map((seg, idx) => (
            <ReceiptTokenField
              key={`${entry.id}-seg-${idx}`}
              value={seg.text}
              onChange={(text) =>
                onChange({
                  ...entry,
                  segments: (entry.segments || []).map((s, i) => (i === idx ? { ...s, text } : s)),
                })
              }
            />
          ))}
        </div>
      )
    case 'files_note':
      return (
        <div className="space-y-2">
          <input className={inputCls} placeholder="Title" value={entry.title || ''} onChange={(e) => onChange({ ...entry, title: e.target.value })} />
          <ReceiptTokenField multiline value={entry.content} onChange={(content) => onChange({ ...entry, content })} />
        </div>
      )
    default:
      return null
  }
}

export const BLOCK_ADD_OPTIONS: { type: ReceiptEntryType; label: string }[] = [
  { type: 'text', label: 'Text' },
  { type: 'left_right_text', label: 'Left & Right Row' },
  { type: 'table', label: 'Items Table' },
  { type: 'horizontal_line', label: 'Divider' },
  { type: 'barcode', label: 'Barcode / QR' },
  { type: 'image', label: 'Logo / Image' },
  { type: 'text_special', label: 'Styled Text' },
  { type: 'multi_format', label: 'Mixed Format' },
  { type: 'files_note', label: 'Policy Note' },
]
