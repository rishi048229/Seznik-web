import type {
  BarcodeReceiptEntry,
  CustomReceiptEntry,
  CustomReceiptTemplate,
  ImageReceiptEntry,
  LeftRightTextReceiptEntry,
  TableReceiptEntry,
  TextReceiptEntry,
  TextSpecialReceiptEntry,
} from '@/types/customReceipt'
import { createEmptyBlock } from '@/types/customReceipt'
import {
  containsTemplateVar,
  isOnlyTemplateVar,
  parseTemplateSide,
  serializeTemplateSide,
  type TemplateSideContent,
} from '@/utils/receiptTemplateTokens'

export type SimpleSectionId =
  | 'logo'
  | 'storeName'
  | 'storeDetails'
  | 'invoiceRow'
  | 'customerRow'
  | 'items'
  | 'subtotal'
  | 'discount'
  | 'tax'
  | 'grandTotal'
  | 'qr'
  | 'footer'

export type QrPurpose = 'digital_bill' | 'upi' | 'invoice_barcode' | 'custom' | 'none'

type TextLikeEntry = TextReceiptEntry | TextSpecialReceiptEntry

const SECTION_ORDER: SimpleSectionId[] = [
  'logo',
  'storeName',
  'storeDetails',
  'invoiceRow',
  'customerRow',
  'items',
  'subtotal',
  'discount',
  'tax',
  'grandTotal',
  'qr',
  'footer',
]

function isTextLike(entry: CustomReceiptEntry): entry is TextLikeEntry {
  return entry.type === 'text' || entry.type === 'text_special'
}

function newId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
}

function hasAnyStoreDetailVar(text: string): boolean {
  return (
    containsTemplateVar(text, 'store_address') ||
    containsTemplateVar(text, 'store_phone') ||
    containsTemplateVar(text, 'store_gstin')
  )
}

export function inferQrPurpose(entry: BarcodeReceiptEntry): QrPurpose {
  if (!entry.enabled) return 'none'
  if (entry.qrType) return entry.qrType
  if (entry.value?.includes('{{upi_qr}}') || entry.upiId) return 'upi'
  if (entry.format === 'code128' || entry.format === 'ean13' || entry.codeType === 'barcode_1d') {
    return 'invoice_barcode'
  }
  if (entry.value?.includes('{{bill_pdf_url}}') || entry.format === 'qr' || entry.codeType === 'qr_code') {
    return 'digital_bill'
  }
  return 'custom'
}

export function applyQrPurpose(entry: BarcodeReceiptEntry, purpose: QrPurpose): BarcodeReceiptEntry {
  switch (purpose) {
    case 'none':
      return { ...entry, enabled: false }
    case 'upi':
      return { ...entry, enabled: true, qrType: 'upi', format: 'qr', codeType: 'qr_code', value: '{{upi_qr}}' }
    case 'invoice_barcode':
      return {
        ...entry,
        enabled: true,
        qrType: 'invoice_barcode',
        format: 'code128',
        codeType: 'barcode_1d',
        value: '{{invoice_no}}',
      }
    case 'digital_bill':
      return {
        ...entry,
        enabled: true,
        qrType: 'digital_bill',
        format: 'qr',
        codeType: 'qr_code',
        value: '{{bill_pdf_url}}',
      }
    case 'custom':
      return { ...entry, enabled: true, qrType: 'custom', format: entry.format || 'qr', codeType: entry.codeType || 'qr_code' }
  }
}

export function isEnabledUpiQrEntry(entry: CustomReceiptEntry): entry is BarcodeReceiptEntry {
  return entry.enabled && entry.type === 'barcode' && inferQrPurpose(entry) === 'upi'
}

export function templateRequiresUpiId(template: CustomReceiptTemplate): boolean {
  return template.entries.some(isEnabledUpiQrEntry)
}

export function buildStoreDetailsText(flags: { address: boolean; phone: boolean; gstin: boolean }): string {
  const lines: string[] = []
  if (flags.address) lines.push('{{store_address}}')
  if (flags.phone) lines.push('Ph: {{store_phone}}')
  if (flags.gstin) lines.push('GSTIN: {{store_gstin}}')
  return lines.join('\n')
}

function patchById(
  entries: CustomReceiptEntry[],
  id: string,
  updater: (entry: CustomReceiptEntry) => CustomReceiptEntry
): CustomReceiptEntry[] {
  return entries.map((entry) => (entry.id === id ? updater(entry) : entry))
}

function setEnabled(entries: CustomReceiptEntry[], id: string, enabled: boolean): CustomReceiptEntry[] {
  return patchById(entries, id, (entry) => ({ ...entry, enabled }))
}

export interface MappedSimpleTemplate {
  logo: ImageReceiptEntry | null
  storeName: TextLikeEntry | null
  storeDetails: TextLikeEntry | null
  invoiceRow: LeftRightTextReceiptEntry | null
  customerRow: LeftRightTextReceiptEntry | null
  items: TableReceiptEntry | null
  subtotal: LeftRightTextReceiptEntry | null
  discount: LeftRightTextReceiptEntry | null
  tax: LeftRightTextReceiptEntry | null
  grandTotal: LeftRightTextReceiptEntry | null
  qr: BarcodeReceiptEntry | null
  qrCaption: TextLikeEntry | null
  footer: TextLikeEntry | null
  customEntries: CustomReceiptEntry[]
  hasCustomLines: boolean
}

function takeFirst<T extends CustomReceiptEntry>(
  entries: CustomReceiptEntry[],
  used: Set<string>,
  pred: (entry: CustomReceiptEntry) => boolean
): T | null {
  const found = entries.find((entry) => !used.has(entry.id) && pred(entry))
  if (!found) return null
  used.add(found.id)
  return found as T
}

export function mapTemplateToSimple(template: CustomReceiptTemplate): MappedSimpleTemplate {
  const used = new Set<string>()
  const { entries } = template

  const logo = takeFirst<ImageReceiptEntry>(entries, used, (e) => e.type === 'image')
  const storeName = takeFirst<TextLikeEntry>(
    entries,
    used,
    (e) => isTextLike(e) && isOnlyTemplateVar(e.text, 'store_name')
  )
  const storeDetails = takeFirst<TextLikeEntry>(entries, used, (e) => isTextLike(e) && hasAnyStoreDetailVar(e.text))
  const invoiceRow = takeFirst<LeftRightTextReceiptEntry>(
    entries,
    used,
    (e) =>
      e.type === 'left_right_text' &&
      (containsTemplateVar(e.left, 'invoice_no') || containsTemplateVar(e.right, 'invoice_no'))
  )
  const customerRow = takeFirst<LeftRightTextReceiptEntry>(
    entries,
    used,
    (e) =>
      e.type === 'left_right_text' &&
      (containsTemplateVar(e.left, 'customer_name') || containsTemplateVar(e.right, 'customer_name'))
  )
  const items = takeFirst<TableReceiptEntry>(entries, used, (e) => e.type === 'table')
  const subtotal = takeFirst<LeftRightTextReceiptEntry>(
    entries,
    used,
    (e) =>
      e.type === 'left_right_text' &&
      (containsTemplateVar(e.left, 'subtotal') || containsTemplateVar(e.right, 'subtotal'))
  )
  const discount = takeFirst<LeftRightTextReceiptEntry>(
    entries,
    used,
    (e) =>
      e.type === 'left_right_text' &&
      (containsTemplateVar(e.left, 'discount') || containsTemplateVar(e.right, 'discount'))
  )
  const tax = takeFirst<LeftRightTextReceiptEntry>(
    entries,
    used,
    (e) =>
      e.type === 'left_right_text' &&
      (containsTemplateVar(e.left, 'tax') ||
        containsTemplateVar(e.right, 'tax') ||
        containsTemplateVar(e.left, 'total_tax') ||
        containsTemplateVar(e.right, 'total_tax'))
  )
  const grandTotal = takeFirst<LeftRightTextReceiptEntry>(
    entries,
    used,
    (e) =>
      e.type === 'left_right_text' &&
      (containsTemplateVar(e.left, 'grand_total') || containsTemplateVar(e.right, 'grand_total'))
  )
  const qr = takeFirst<BarcodeReceiptEntry>(entries, used, (e) => e.type === 'barcode')

  let qrCaption: TextLikeEntry | null = null
  if (qr) {
    const idx = entries.findIndex((e) => e.id === qr.id)
    const next = idx >= 0 ? entries[idx + 1] : undefined
    if (next && isTextLike(next) && !used.has(next.id) && !/\{\{/.test(next.text)) {
      used.add(next.id)
      qrCaption = next
    }
  }

  const footer = takeFirst<TextLikeEntry>(
    entries,
    used,
    (e) => isTextLike(e) && containsTemplateVar(e.text, 'footer_message')
  )

  const customEntries = entries.filter((e) => !used.has(e.id) && e.type !== 'horizontal_line')
  return {
    logo,
    storeName,
    storeDetails,
    invoiceRow,
    customerRow,
    items,
    subtotal,
    discount,
    tax,
    grandTotal,
    qr,
    qrCaption,
    footer,
    customEntries,
    hasCustomLines: customEntries.length > 0,
  }
}

export function getSectionEntry(
  mapped: MappedSimpleTemplate,
  section: SimpleSectionId
): CustomReceiptEntry | null {
  if (section === 'qr') return mapped.qr
  return mapped[section]
}

export function isSectionEnabled(mapped: MappedSimpleTemplate, section: SimpleSectionId): boolean {
  const entry = getSectionEntry(mapped, section)
  return Boolean(entry?.enabled)
}

function createSectionBlocks(section: SimpleSectionId): CustomReceiptEntry[] {
  switch (section) {
    case 'logo':
      return [createEmptyBlock('image')]
    case 'storeName':
      return [
        {
          id: newId('entry-store-name'),
          type: 'text',
          enabled: true,
          text: '{{store_name}}',
          size: 'large',
          bold: true,
          align: 'center',
        },
      ]
    case 'storeDetails':
      return [
        {
          id: newId('entry-store-details'),
          type: 'text',
          enabled: true,
          text: buildStoreDetailsText({ address: true, phone: true, gstin: true }),
          size: 'small',
          align: 'center',
        },
      ]
    case 'invoiceRow':
      return [
        {
          id: newId('entry-invoice'),
          type: 'left_right_text',
          enabled: true,
          left: 'Invoice: {{invoice_no}}',
          right: '{{date}}',
          size: 'small',
        },
      ]
    case 'customerRow':
      return [
        {
          id: newId('entry-customer'),
          type: 'left_right_text',
          enabled: true,
          left: 'Customer: {{customer_name}}',
          right: '{{time}}',
          size: 'small',
        },
      ]
    case 'items':
      return [createEmptyBlock('table')]
    case 'subtotal':
      return [
        {
          id: newId('entry-subtotal'),
          type: 'left_right_text',
          enabled: true,
          left: 'Sub Total',
          right: '{{subtotal}}',
          size: 'small',
        },
      ]
    case 'discount':
      return [
        {
          id: newId('entry-discount'),
          type: 'left_right_text',
          enabled: true,
          left: 'Discount',
          right: '-{{discount}}',
          size: 'small',
          bold: true,
        },
      ]
    case 'tax':
      return [
        {
          id: newId('entry-tax'),
          type: 'left_right_text',
          enabled: true,
          left: 'Tax',
          right: '{{tax}}',
          size: 'small',
        },
      ]
    case 'grandTotal':
      return [
        {
          id: newId('entry-grand'),
          type: 'left_right_text',
          enabled: true,
          left: 'GRAND TOTAL',
          right: '{{grand_total}}',
          size: 'medium',
          bold: true,
        },
      ]
    case 'qr':
      return [
        createEmptyBlock('barcode'),
        {
          id: newId('entry-qr-caption'),
          type: 'text',
          enabled: true,
          text: 'Scan QR to View & Download Bill PDF',
          size: 'small',
          align: 'center',
        },
      ]
    case 'footer':
      return [
        {
          id: newId('entry-footer'),
          type: 'text',
          enabled: true,
          text: '{{footer_message}}',
          size: 'small',
          bold: true,
          align: 'center',
        },
      ]
  }
}

function lastRelatedId(mapped: MappedSimpleTemplate, section: SimpleSectionId): string | null {
  if (section === 'qr') return mapped.qrCaption?.id || mapped.qr?.id || null
  return getSectionEntry(mapped, section)?.id || null
}

function insertAfter(entries: CustomReceiptEntry[], afterId: string | null, blocks: CustomReceiptEntry[]): CustomReceiptEntry[] {
  if (!afterId) return [...blocks, ...entries]
  const idx = entries.findIndex((e) => e.id === afterId)
  if (idx < 0) return [...entries, ...blocks]
  return [...entries.slice(0, idx + 1), ...blocks, ...entries.slice(idx + 1)]
}

export function setSectionEnabled(
  template: CustomReceiptTemplate,
  section: SimpleSectionId,
  enabled: boolean
): CustomReceiptTemplate {
  const mapped = mapTemplateToSimple(template)
  const existing = getSectionEntry(mapped, section)
  if (existing) {
    let entries = setEnabled(template.entries, existing.id, enabled)
    if (section === 'qr' && mapped.qrCaption) {
      entries = setEnabled(entries, mapped.qrCaption.id, enabled)
    }
    return { ...template, entries }
  }
  if (!enabled) return template
  const prev = SECTION_ORDER.slice(0, SECTION_ORDER.indexOf(section))
    .map((id) => lastRelatedId(mapped, id))
    .filter(Boolean)
    .pop() as string | undefined
  return { ...template, entries: insertAfter(template.entries, prev || null, createSectionBlocks(section)) }
}

export function patchSectionEntry(
  template: CustomReceiptTemplate,
  section: SimpleSectionId,
  updater: (entry: CustomReceiptEntry) => CustomReceiptEntry
): CustomReceiptTemplate {
  const mapped = mapTemplateToSimple(template)
  const existing = getSectionEntry(mapped, section)
  if (!existing) return template
  return { ...template, entries: patchById(template.entries, existing.id, updater) }
}

export function applyStoreDetails(
  template: CustomReceiptTemplate,
  flags: { address: boolean; phone: boolean; gstin: boolean }
): CustomReceiptTemplate {
  const mapped = mapTemplateToSimple(template)
  if (!mapped.storeDetails) {
    if (!flags.address && !flags.phone && !flags.gstin) return template
    return setSectionEnabled(
      {
        ...template,
        entries: insertAfter(template.entries, mapped.storeName?.id || mapped.logo?.id || null, createSectionBlocks('storeDetails')),
      },
      'storeDetails',
      true
    )
  }
  const anyOn = flags.address || flags.phone || flags.gstin
  return {
    ...template,
    entries: patchById(template.entries, mapped.storeDetails.id, (entry) => {
      if (!isTextLike(entry)) return entry
      return {
        ...entry,
        enabled: anyOn ? true : false,
        text: anyOn ? buildStoreDetailsText(flags) : entry.text,
      }
    }),
  }
}

export function applyLeftRightSide(
  template: CustomReceiptTemplate,
  section: 'invoiceRow' | 'customerRow',
  side: 'left' | 'right',
  next: TemplateSideContent
): CustomReceiptTemplate {
  return patchSectionEntry(template, section, (entry) => {
    if (entry.type !== 'left_right_text') return entry
    return { ...entry, [side]: serializeTemplateSide(next) }
  })
}

export function defaultQrCaptionForPurpose(purpose: QrPurpose): string {
  switch (purpose) {
    case 'upi':
      return 'Scan to pay with UPI'
    case 'digital_bill':
      return 'Scan QR to View & Download Bill PDF'
    case 'custom':
      return 'Scan for store website & reviews'
    case 'none':
    default:
      return ''
  }
}

export function applyQrSection(
  template: CustomReceiptTemplate,
  patch: { purpose?: QrPurpose; caption?: string }
): CustomReceiptTemplate {
  let next = template
  if (patch.purpose === 'none') {
    next = patchSectionEntry(next, 'qr', (entry) =>
      entry.type === 'barcode' ? { ...entry, enabled: false } : entry
    )
    const mapped = mapTemplateToSimple(next)
    if (mapped.qrCaption) {
      next = {
        ...next,
        entries: patchById(next.entries, mapped.qrCaption.id, (entry) =>
          isTextLike(entry) ? { ...entry, enabled: false } : entry
        ),
      }
    }
    return next
  }

  if (patch.purpose) {
    next = setSectionEnabled(next, 'qr', true)
    next = patchSectionEntry(next, 'qr', (entry) =>
      entry.type === 'barcode' ? applyQrPurpose(entry, patch.purpose!) : entry
    )
  }

  const captionText =
    patch.caption !== undefined
      ? patch.caption
      : patch.purpose
        ? defaultQrCaptionForPurpose(patch.purpose)
        : undefined

  if (captionText !== undefined) {
    const mapped = mapTemplateToSimple(next)
    if (mapped.qrCaption) {
      next = {
        ...next,
        entries: patchById(next.entries, mapped.qrCaption.id, (entry) =>
          isTextLike(entry) ? { ...entry, text: captionText, enabled: true } : entry
        ),
      }
    } else if (mapped.qr) {
      const captionBlock: TextReceiptEntry = {
        id: newId('entry-qr-caption'),
        type: 'text',
        enabled: true,
        text: captionText,
        size: 'small',
        align: 'center',
      }
      next = {
        ...next,
        entries: insertAfter(next.entries, mapped.qr.id, [captionBlock]),
      }
    }
  }
  return next
}

/** Point the receipt QR at a merchant UPI ID so printed bills collect payment. */
export function applyUpiQrToTemplate(template: CustomReceiptTemplate, upiId: string): CustomReceiptTemplate {
  const trimmed = upiId.trim()
  let next = template
  if (!mapTemplateToSimple(next).qr) {
    next = setSectionEnabled(next, 'qr', true)
  }
  next = applyQrSection(next, { purpose: 'upi', caption: 'Scan to pay with UPI' })
  return patchSectionEntry(next, 'qr', (entry) =>
    entry.type === 'barcode' ? { ...entry, upiId: trimmed, qrType: 'upi', value: '{{upi_qr}}' } : entry
  )
}

export function applyFooter(
  template: CustomReceiptTemplate,
  patch: { useStoreFooter?: boolean; text?: string }
): CustomReceiptTemplate {
  return patchSectionEntry(template, 'footer', (entry) => {
    if (!isTextLike(entry)) return entry
    if (patch.useStoreFooter === true) return { ...entry, text: '{{footer_message}}' }
    if (patch.useStoreFooter === false) {
      const nextText =
        patch.text !== undefined
          ? patch.text
          : isOnlyTemplateVar(entry.text, 'footer_message')
            ? 'Thank you! Visit again.'
            : entry.text
      return { ...entry, text: nextText }
    }
    if (patch.text !== undefined) return { ...entry, text: patch.text }
    return entry
  })
}

export function updateCustomEntry(
  template: CustomReceiptTemplate,
  entryId: string,
  updater: (entry: CustomReceiptEntry) => CustomReceiptEntry
): CustomReceiptTemplate {
  return { ...template, entries: patchById(template.entries, entryId, updater) }
}

export function removeEntry(template: CustomReceiptTemplate, entryId: string): CustomReceiptTemplate {
  return { ...template, entries: template.entries.filter((e) => e.id !== entryId) }
}

export function appendBlocks(
  template: CustomReceiptTemplate,
  blocks: CustomReceiptEntry[]
): CustomReceiptTemplate {
  return { ...template, entries: [...template.entries, ...blocks] }
}

export const SIMPLE_ADD_DIVIDER = (): CustomReceiptEntry => {
  const block = createEmptyBlock('horizontal_line')
  if (block.type !== 'horizontal_line') return block
  return { ...block, lineStyle: 'dashed' }
}

export const SIMPLE_ADD_CUSTOM_LINE = (): CustomReceiptEntry => {
  const block = createEmptyBlock('text')
  if (block.type !== 'text') return block
  return { ...block, text: '', size: 'small', align: 'center' }
}

export const SIMPLE_ADD_QR = (): CustomReceiptEntry => createEmptyBlock('barcode')
