import { useState, useMemo, type ReactNode } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  ChevronDown,
  ChevronUp,
  GripVertical,
  Minus,
  QrCode,
  Type,
} from 'lucide-react'
import { ImageUpload } from '@/components/forms/ImageUpload'
import { TEMPLATE_VARIABLES } from '@/types/customReceipt'
import type { CustomReceiptTemplate } from '@/types/customReceipt'
import {
  containsTemplateVar,
  isOnlyTemplateVar,
  parseTemplateSide,
  unwrapTemplateKey,
} from '@/utils/receiptTemplateTokens'
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
  buildSimpleSectionsList,
  createSectionBlocks,
  defaultQrCaptionForPurpose,
  getSectionEntry,
  inferQrPurpose,
  insertAfter,
  isSectionEnabled,
  mapTemplateToSimple,
  patchSectionEntry,
  removeEntry,
  reorderSimpleSections,
  setSectionEnabled,
  updateCustomEntry,
  type QrPurpose,
  type SimpleSectionId,
  type SimpleSectionItem,
} from './receiptSimpleSections'

interface ReceiptSimpleEditorProps {
  template: CustomReceiptTemplate
  onChange: (template: CustomReceiptTemplate) => void
  logoFallback?: string
  upiId?: string
  onUpiIdChange?: (upiId: string) => void
  isRestaurant?: boolean
}

const inputCls =
  'w-full px-2 py-1.5 border border-gray-300 dark:border-dark-border-strong rounded-lg bg-white dark:bg-dark-elevated text-xs'

const FIELD_OPTIONS = [
  { value: '', label: 'Plain text only' },
  ...TEMPLATE_VARIABLES.map((v) => ({ value: unwrapTemplateKey(v.key), label: v.label })),
]

function CompactSwitch({
  checked,
  onChange,
}: {
  checked: boolean
  onChange: (next: boolean) => void
}) {
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
        checked ? 'bg-blue-600' : 'bg-gray-300 dark:bg-dark-hover'
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
          <ReceiptTokenField
            value={side.prefix}
            onChange={(text) => onChange({ prefix: text, fieldKey: null, complex: true })}
          />
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

interface SortableSectionCardProps {
  id: string
  title: string
  description: string
  enabled: boolean
  onToggle?: (next: boolean) => void
  index: number
  total: number
  onMove: (dir: -1 | 1) => void
  forceOpen?: boolean
  children?: ReactNode
  badge?: ReactNode
  onRemove?: () => void
}

function SortableSectionCard({
  id,
  title,
  description,
  enabled,
  onToggle,
  index,
  total,
  onMove,
  forceOpen,
  children,
  badge,
  onRemove,
}: SortableSectionCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: enabled ? 1 : 0.65,
  }

  const [open, setOpen] = useState(Boolean(forceOpen))
  const expanded = Boolean(children) && enabled && (open || forceOpen)
  const showBody = expanded

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`rounded-xl border bg-white dark:bg-dark-card transition-all ${
        isDragging
          ? 'border-blue-500 shadow-xl ring-2 ring-blue-500/25 z-20'
          : enabled
          ? 'border-gray-200 dark:border-dark-border hover:border-gray-300 dark:hover:border-dark-border-strong shadow-2xs'
          : 'border-gray-100 dark:border-dark-border opacity-70'
      }`}
    >
      <div className="flex items-center gap-2 p-3">
        <button
          type="button"
          className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 touch-none p-1 rounded-md hover:bg-gray-100 dark:hover:bg-dark-hover transition-colors shrink-0"
          title="Drag to reorganize block position"
          {...attributes}
          {...listeners}
        >
          <GripVertical size={17} />
        </button>

        <button
          type="button"
          className="flex-1 text-left min-w-0"
          onClick={() => setOpen((v) => !v)}
        >
          <div className="flex items-center gap-1.5 flex-wrap">
            <div className="text-xs font-bold text-gray-900 dark:text-gray-100">{title}</div>
            {badge}
            {children ? (
              <ChevronDown
                size={14}
                className={`text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
              />
            ) : null}
          </div>
          <div className="text-[11px] text-gray-500 truncate">{description}</div>
        </button>

        {onToggle ? <CompactSwitch checked={enabled} onChange={onToggle} /> : null}

        {onRemove ? (
          <button
            type="button"
            className="text-[11px] font-semibold text-red-500 hover:text-red-700 px-1.5 py-0.5 rounded hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
            onClick={onRemove}
            title="Remove custom block"
          >
            Remove
          </button>
        ) : null}

        <div className="flex items-center gap-0.5 border-l border-gray-100 dark:border-dark-border pl-1.5 ml-1 shrink-0">
          <button
            type="button"
            onClick={() => onMove(-1)}
            disabled={index === 0}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 disabled:opacity-20 transition-opacity"
            title="Move block up"
          >
            <ChevronUp size={15} />
          </button>
          <button
            type="button"
            onClick={() => onMove(1)}
            disabled={index === total - 1}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 disabled:opacity-20 transition-opacity"
            title="Move block down"
          >
            <ChevronDown size={15} />
          </button>
        </div>
      </div>

      {showBody ? (
        <div className="px-3 pb-3 border-t border-gray-100 dark:border-dark-border pt-3 space-y-2">
          {children}
        </div>
      ) : null}
    </div>
  )
}

export function ReceiptSimpleEditor({
  template,
  onChange,
  logoFallback,
  upiId = '',
  onUpiIdChange,
  isRestaurant = false,
}: ReceiptSimpleEditorProps) {
  const mapped = mapTemplateToSimple(template)
  const qrPurpose = mapped.qr ? inferQrPurpose(mapped.qr) : null
  const needsUpiId = Boolean(mapped.qr?.enabled && qrPurpose === 'upi')
  const storeFlags = {
    address: containsTemplateVar(mapped.storeDetails?.text || '', 'store_address'),
    phone: containsTemplateVar(mapped.storeDetails?.text || '', 'store_phone'),
    gstin: containsTemplateVar(mapped.storeDetails?.text || '', 'store_gstin'),
  }

  // Derive dynamic list of sections in their current template.entries sequence
  const sectionItems = useMemo(
    () => buildSimpleSectionsList(template, isRestaurant),
    [template, isRestaurant]
  )

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = sectionItems.findIndex((s) => s.id === active.id)
    const newIndex = sectionItems.findIndex((s) => s.id === over.id)
    if (oldIndex < 0 || newIndex < 0) return
    reorder(oldIndex, newIndex)
  }

  const handleMove = (index: number, dir: -1 | 1) => {
    const nextIndex = index + dir
    if (nextIndex < 0 || nextIndex >= sectionItems.length) return
    reorder(index, nextIndex)
  }

  const reorder = (fromIndex: number, toIndex: number) => {
    const reordered = arrayMove(sectionItems, fromIndex, toIndex)
    const updatedTemplate = reorderSimpleSections(template, reordered)
    onChange(updatedTemplate)
  }

  const toggle = (section: SimpleSectionId, next: boolean) => {
    const existing = getSectionEntry(mapped, section)
    if (!existing && next) {
      // Find where this section is in sectionItems
      const secIdx = sectionItems.findIndex((s) => s.sectionKey === section)
      let afterId: string | null = null
      for (let i = secIdx - 1; i >= 0; i--) {
        if (sectionItems[i].entryIds.length > 0) {
          afterId = sectionItems[i].entryIds[sectionItems[i].entryIds.length - 1]
          break
        }
      }
      const newBlocks = createSectionBlocks(section)
      const newEntries = insertAfter(template.entries, afterId, newBlocks)
      onChange({ ...template, entries: newEntries })
      return
    }

    onChange(setSectionEnabled(template, section, next))
  }

  const toggleTotals = (next: boolean) => {
    let t = template
    t = setSectionEnabled(t, 'subtotal', next)
    t = setSectionEnabled(t, 'discount', next)
    t = setSectionEnabled(t, 'tax', next)
    t = setSectionEnabled(t, 'grandTotal', next)
    onChange(t)
  }

  const renderSectionContent = (sec: SimpleSectionItem) => {
    switch (sec.sectionKey) {
      case 'logo':
        return mapped.logo ? (
          <>
            <ImageUpload
              label="Receipt image"
              value={mapped.logo.imageURL || logoFallback || ''}
              onChange={(url) =>
                onChange(
                  patchSectionEntry(template, 'logo', (entry) =>
                    entry.type === 'image' ? { ...entry, imageURL: url, imageUri: undefined } : entry
                  )
                )
              }
              previewSize="sm"
              enableBackgroundCleanup
            />
            <div className="space-y-1 pt-1">
              <label className="text-[10px] font-semibold text-gray-500 block">
                Logo Print Width ({mapped.logo.widthPercent || 60}%)
              </label>
              <input
                type="range"
                className="w-full"
                min={20}
                max={100}
                value={mapped.logo.widthPercent || 60}
                onChange={(e) =>
                  onChange(
                    patchSectionEntry(template, 'logo', (entry) =>
                      entry.type === 'image'
                        ? { ...entry, widthPercent: Number(e.target.value) }
                        : entry
                    )
                  )
                }
              />
            </div>
          </>
        ) : null

      case 'storeName':
        return mapped.storeName && mapped.storeName.type === 'text' ? (
          <div className="grid grid-cols-2 gap-2">
            <select
              className={inputCls}
              value={mapped.storeName.size}
              onChange={(e) =>
                onChange(
                  patchSectionEntry(template, 'storeName', (entry) =>
                    entry.type === 'text'
                      ? { ...entry, size: e.target.value as 'small' | 'medium' | 'large' }
                      : entry
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
                      entry.type === 'text' || entry.type === 'text_special'
                        ? { ...entry, bold: e.target.checked }
                        : entry
                    )
                  )
                }
              />
              Bold
            </label>
          </div>
        ) : null

      case 'storeDetails':
        return (
          <div className="space-y-1.5">
            {(['address', 'phone', 'gstin'] as const).map((key) => (
              <label key={key} className="flex items-center gap-2 text-xs capitalize">
                <input
                  type="checkbox"
                  checked={storeFlags[key]}
                  onChange={(e) =>
                    onChange(applyStoreDetails(template, { ...storeFlags, [key]: e.target.checked }))
                  }
                />
                {key === 'gstin' ? 'GSTIN' : key}
              </label>
            ))}
          </div>
        )

      case 'invoiceRow':
        return mapped.invoiceRow ? (
          <SideEditors
            left={parseTemplateSide(mapped.invoiceRow.left)}
            right={parseTemplateSide(mapped.invoiceRow.right)}
            onLeft={(side) => onChange(applyLeftRightSide(template, 'invoiceRow', 'left', side))}
            onRight={(side) => onChange(applyLeftRightSide(template, 'invoiceRow', 'right', side))}
          />
        ) : null

      case 'customerRow':
        return mapped.customerRow ? (
          <SideEditors
            left={parseTemplateSide(mapped.customerRow.left)}
            right={parseTemplateSide(mapped.customerRow.right)}
            onLeft={(side) => onChange(applyLeftRightSide(template, 'customerRow', 'left', side))}
            onRight={(side) => onChange(applyLeftRightSide(template, 'customerRow', 'right', side))}
          />
        ) : null

      case 'items':
        return mapped.items ? (
          <div className="space-y-2">
            <select
              className={inputCls}
              value={mapped.items.tableType}
              onChange={(e) =>
                onChange(
                  patchSectionEntry(template, 'items', (entry) =>
                    entry.type === 'table'
                      ? { ...entry, tableType: e.target.value as 'simple' | 'advanced' }
                      : entry
                  )
                )
              }
            >
              <option value="simple">Simple (item + amount)</option>
              <option value="advanced">Compact columns (ITEM | QTY | AMT)</option>
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
            {isRestaurant ? (
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={mapped.items.showItemNumbers !== false}
                  onChange={(e) =>
                    onChange(
                      patchSectionEntry(template, 'items', (entry) =>
                        entry.type === 'table'
                          ? { ...entry, showItemNumbers: e.target.checked }
                          : entry
                      )
                    )
                  }
                />
                Number line items (1. 2. 3.)
              </label>
            ) : null}
          </div>
        ) : null

      case 'totals':
        return (
          <div className="space-y-1">
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
                <CompactSwitch
                  checked={isSectionEnabled(mapped, id as SimpleSectionId)}
                  onChange={(v) => toggle(id as SimpleSectionId, v)}
                />
              </div>
            ))}
          </div>
        )

      case 'tokenRow':
        return mapped.tokenRow ? (
          <ReceiptTokenField
            value={mapped.tokenRow.text}
            placeholder="Token {{token_no}} or Table {{table_no}}"
            onChange={(text) =>
              onChange(
                patchSectionEntry(template, 'tokenRow', (entry) =>
                  entry.type === 'text' || entry.type === 'text_special'
                    ? { ...entry, text }
                    : entry
                )
              )
            }
          />
        ) : null

      case 'qr':
        return mapped.qr ? (
          <>
            <select
              className={inputCls}
              value={inferQrPurpose(mapped.qr)}
              onChange={(e) =>
                onChange(applyQrSection(template, { purpose: e.target.value as QrPurpose }))
              }
            >
              <option value="upi">UPI Payment QR</option>
              <option value="digital_bill">Digital Bill / Invoice PDF QR</option>
              <option value="custom">Custom Link / Website</option>
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
                  onChange(
                    patchSectionEntry(template, 'qr', (entry) =>
                      entry.type === 'barcode' ? { ...entry, value, qrType: 'custom' } : entry
                    )
                  )
                }
              />
            ) : null}
            <div className="pt-2 border-t border-gray-100 dark:border-dark-border/80 space-y-1">
              <label className="text-[10px] font-semibold text-gray-700 dark:text-gray-300 block">
                Statement below QR (Printed on bill)
              </label>
              <input
                className={inputCls}
                value={
                  mapped.qrCaption?.text ??
                  defaultQrCaptionForPurpose(inferQrPurpose(mapped.qr))
                }
                placeholder="e.g. Scan to pay with UPI or Scan to download bill PDF"
                onChange={(e) => onChange(applyQrSection(template, { caption: e.target.value }))}
              />
              <p className="text-[10px] text-gray-500">
                You can edit this custom text sentence to display anything below the QR code.
              </p>
            </div>
          </>
        ) : null

      case 'footer':
        return mapped.footer ? (
          <>
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={isOnlyTemplateVar(mapped.footer.text, 'footer_message')}
                onChange={(e) =>
                  onChange(applyFooter(template, { useStoreFooter: e.target.checked }))
                }
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
        ) : null

      case 'custom':
        return sec.customEntry ? (
          <ReceiptBlockEditorPanel
            entry={sec.customEntry}
            logoFallback={logoFallback}
            storeUpiId={upiId}
            onStoreUpiIdChange={onUpiIdChange}
            onChange={(updated) =>
              onChange(updateCustomEntry(template, sec.customEntry!.id, () => updated))
            }
          />
        ) : null

      default:
        return null
    }
  }

  return (
    <div className="space-y-2.5">
      {/* Reorganize Drag & Drop Header Notice */}
      <div className="flex items-center justify-between gap-2 px-3 py-2 bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/80 dark:border-blue-900/50 rounded-xl text-blue-900 dark:text-blue-200 text-xs">
        <div className="flex items-center gap-2">
          <GripVertical size={16} className="text-blue-600 dark:text-blue-400 shrink-0" />
          <span className="font-medium">
            Drag handles on the left or use{' '}
            <ChevronUp size={13} className="inline align-text-bottom" />
            <ChevronDown size={13} className="inline align-text-bottom" /> to reorder any section on your receipt.
          </span>
        </div>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={sectionItems.map((s) => s.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {sectionItems.map((sec, idx) => (
              <SortableSectionCard
                key={sec.id}
                id={sec.id}
                title={sec.title}
                description={sec.description}
                enabled={sec.enabled}
                index={idx}
                total={sectionItems.length}
                onMove={(dir) => handleMove(idx, dir)}
                onToggle={
                  sec.sectionKey === 'totals'
                    ? toggleTotals
                    : sec.sectionKey === 'custom'
                    ? (enabled) =>
                        onChange(
                          updateCustomEntry(template, sec.customEntry!.id, (e) => ({
                            ...e,
                            enabled,
                          }))
                        )
                    : (next) => toggle(sec.sectionKey as SimpleSectionId, next)
                }
                onRemove={
                  sec.sectionKey === 'custom' && sec.customEntry
                    ? () => onChange(removeEntry(template, sec.customEntry!.id))
                    : undefined
                }
                forceOpen={sec.sectionKey === 'qr' && needsUpiId && !isValidUpiVpa(mapped.qr?.upiId || upiId)}
              >
                {renderSectionContent(sec)}
              </SortableSectionCard>
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {/* Add Custom Blocks */}
      <div className="pt-2">
        <div className="text-xs font-semibold text-gray-500 mb-1.5">Add extra blocks</div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-dark-border-strong text-xs font-semibold hover:bg-gray-50 dark:hover:bg-dark-hover transition-colors"
            onClick={() => onChange(appendBlocks(template, [SIMPLE_ADD_DIVIDER()]))}
          >
            <Minus size={14} /> Divider
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-dark-border-strong text-xs font-semibold hover:bg-gray-50 dark:hover:bg-dark-hover transition-colors"
            onClick={() => onChange(appendBlocks(template, [SIMPLE_ADD_CUSTOM_LINE()]))}
          >
            <Type size={14} /> Custom line
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-dark-border-strong text-xs font-semibold hover:bg-gray-50 dark:hover:bg-dark-hover transition-colors"
            onClick={() => onChange(appendBlocks(template, [SIMPLE_ADD_QR()]))}
          >
            <QrCode size={14} /> Extra QR
          </button>
        </div>
      </div>
    </div>
  )
}
