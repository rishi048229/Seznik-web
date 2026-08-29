export type ReceiptEntryType =
  | 'text'
  | 'image'
  | 'text_special'
  | 'horizontal_line'
  | 'barcode'
  | 'left_right_text'
  | 'table'
  | 'multi_format'
  | 'files_note'

export interface BaseReceiptEntry {
  id: string
  type: ReceiptEntryType
  enabled: boolean
}

export interface TextReceiptEntry extends BaseReceiptEntry {
  type: 'text'
  text: string
  size: 'small' | 'medium' | 'large' | 'double_width' | 'double_height'
  bold?: boolean
  underline?: boolean
  align: 'left' | 'center' | 'right'
}

export interface ImageReceiptEntry extends BaseReceiptEntry {
  type: 'image'
  imageUri?: string
  imageBase64?: string
  imageURL?: string
  align: 'left' | 'center' | 'right'
  widthPercent: number
}

export interface TextSpecialReceiptEntry extends BaseReceiptEntry {
  type: 'text_special'
  text: string
  fontSizePt: number
  bold?: boolean
  italic?: boolean
  underline?: boolean
  align: 'left' | 'center' | 'right'
  fontFamily?: string
}

export interface HorizontalLineReceiptEntry extends BaseReceiptEntry {
  type: 'horizontal_line'
  lineStyle: 'single' | 'double' | 'dashed' | 'dotted'
}

export interface BarcodeReceiptEntry extends BaseReceiptEntry {
  type: 'barcode'
  codeType: 'barcode_1d' | 'qr_code'
  format: 'code128' | 'ean13' | 'qr'
  value: string
  align: 'left' | 'center' | 'right'
  size: 'small' | 'medium' | 'large'
  showText?: boolean
  qrType?: 'upi' | 'digital_bill' | 'invoice_barcode' | 'custom'
  upiId?: string
}

export interface LeftRightTextReceiptEntry extends BaseReceiptEntry {
  type: 'left_right_text'
  left: string
  right: string
  bold?: boolean
  size: 'small' | 'medium' | 'large'
}

export interface TableReceiptEntry extends BaseReceiptEntry {
  type: 'table'
  tableType: 'simple' | 'advanced'
  showTaxColumn?: boolean
  showDiscountColumn?: boolean
  /** Serial 1. 2. 3. on line items. Unset = on for restaurant/cafe, off otherwise. */
  showItemNumbers?: boolean
  columnHeaders?: {
    item?: string
    qty?: string
    rate?: string
    tax?: string
    total?: string
  }
}

export interface MultiFormatSegment {
  text: string
  bold?: boolean
  underline?: boolean
  size?: 'small' | 'medium' | 'large'
}

export interface MultiFormatReceiptEntry extends BaseReceiptEntry {
  type: 'multi_format'
  segments: MultiFormatSegment[]
  align: 'left' | 'center' | 'right'
}

export interface FilesNoteReceiptEntry extends BaseReceiptEntry {
  type: 'files_note'
  title?: string
  content: string
  align: 'left' | 'center' | 'right'
}

export type CustomReceiptEntry =
  | TextReceiptEntry
  | ImageReceiptEntry
  | TextSpecialReceiptEntry
  | HorizontalLineReceiptEntry
  | BarcodeReceiptEntry
  | LeftRightTextReceiptEntry
  | TableReceiptEntry
  | MultiFormatReceiptEntry
  | FilesNoteReceiptEntry

export interface CustomReceiptTemplate {
  id: string
  name: string
  description?: string
  paperWidth: '58mm' | '80mm'
  entries: CustomReceiptEntry[]
  isDefault?: boolean
  createdAt: string
  updatedAt: string
}

export const TEMPLATE_VARIABLES = [
  { key: '{{store_name}}', label: 'Store Name', sample: 'SEZNIK SUPERSTORE' },
  { key: '{{store_address}}', label: 'Store Address', sample: '123 Market St, City' },
  { key: '{{store_phone}}', label: 'Store Phone', sample: '+91 9876543210' },
  { key: '{{store_gstin}}', label: 'GSTIN Number', sample: '27AAAAA0000A1Z5' },
  { key: '{{invoice_no}}', label: 'Invoice / Bill No', sample: 'INV-2026-0042' },
  { key: '{{date}}', label: 'Current Date', sample: '19/08/2026' },
  { key: '{{time}}', label: 'Current Time', sample: '12:45 PM' },
  { key: '{{customer_name}}', label: 'Customer Name', sample: 'John Doe' },
  { key: '{{customer_phone}}', label: 'Customer Phone', sample: '+91 9988776655' },
  { key: '{{subtotal}}', label: 'Subtotal Amount', sample: '₹1,250.00' },
  { key: '{{discount}}', label: 'Total Discount', sample: '₹50.00' },
  { key: '{{tax}}', label: 'Total Tax', sample: '₹62.50' },
  { key: '{{grand_total}}', label: 'Grand Total', sample: '₹1,262.50' },
  { key: '{{paid_amount}}', label: 'Amount Paid', sample: '₹1,300.00' },
  { key: '{{change_returned}}', label: 'Change Balance', sample: '₹37.50' },
  { key: '{{payment_method}}', label: 'Payment Mode', sample: 'UPI' },
  { key: '{{upi_qr}}', label: 'UPI QR String', sample: 'upi://pay?pa=store@upi' },
  { key: '{{bill_pdf_url}}', label: 'Digital Bill PDF URL', sample: 'https://api.seznik.com/receipt/INV-2026-0042' },
  { key: '{{footer_message}}', label: 'Thank You Message', sample: 'Thank you! Visit again.' },
  { key: '{{token_no}}', label: 'Token / Order No', sample: '42' },
  { key: '{{table_no}}', label: 'Table No', sample: '12' },
  { key: '{{waiter_name}}', label: 'Waiter Name', sample: 'RAJ' },
] as const

export const createDefaultReceiptTemplate = (name = 'Shop Custom Receipt'): CustomReceiptTemplate => {
  const now = new Date().toISOString()
  const ts = Date.now()
  return {
    id: `receipt-tpl-${ts}`,
    name,
    description: 'Custom editable thermal receipt layout',
    paperWidth: '58mm',
    isDefault: true,
    createdAt: now,
    updatedAt: now,
    entries: [
      { id: `entry-0-${ts}`, type: 'image', enabled: true, align: 'center', widthPercent: 60 },
      { id: `entry-1-${ts}`, type: 'text', enabled: true, text: '{{store_name}}', size: 'large', bold: true, align: 'center' },
      { id: `entry-2-${ts}`, type: 'text', enabled: true, text: '{{store_address}}\nPh: {{store_phone}}\nGSTIN: {{store_gstin}}', size: 'small', align: 'center' },
      { id: `entry-3-${ts}`, type: 'horizontal_line', enabled: true, lineStyle: 'dashed' },
      { id: `entry-4-${ts}`, type: 'left_right_text', enabled: true, left: 'Invoice: {{invoice_no}}', right: '{{date}}', size: 'small' },
      { id: `entry-5-${ts}`, type: 'left_right_text', enabled: true, left: 'Customer: {{customer_name}}', right: '{{time}}', size: 'small' },
      { id: `entry-6-${ts}`, type: 'horizontal_line', enabled: true, lineStyle: 'dashed' },
      { id: `entry-7-${ts}`, type: 'table', enabled: true, tableType: 'simple' },
      { id: `entry-8-${ts}`, type: 'horizontal_line', enabled: true, lineStyle: 'dashed' },
      { id: `entry-9-${ts}`, type: 'left_right_text', enabled: true, left: 'Sub Total', right: '{{subtotal}}', size: 'small' },
      { id: `entry-9b-${ts}`, type: 'left_right_text', enabled: true, left: 'Discount', right: '-{{discount}}', size: 'small', bold: true },
      { id: `entry-10-${ts}`, type: 'left_right_text', enabled: true, left: 'Tax', right: '{{tax}}', size: 'small' },
      { id: `entry-11-${ts}`, type: 'horizontal_line', enabled: true, lineStyle: 'double' },
      { id: `entry-12-${ts}`, type: 'left_right_text', enabled: true, left: 'GRAND TOTAL', right: '{{grand_total}}', size: 'medium', bold: true },
      { id: `entry-13-${ts}`, type: 'horizontal_line', enabled: true, lineStyle: 'dashed' },
      { id: `entry-14-${ts}`, type: 'barcode', enabled: true, codeType: 'qr_code', format: 'qr', value: '{{bill_pdf_url}}', align: 'center', size: 'medium', qrType: 'digital_bill' },
      { id: `entry-15-${ts}`, type: 'text', enabled: true, text: 'Scan QR to View & Download Bill PDF', size: 'small', align: 'center' },
      { id: `entry-16-${ts}`, type: 'text', enabled: true, text: '{{footer_message}}', size: 'small', bold: true, align: 'center' },
    ],
  }
}

export const BLOCK_TYPE_LABELS: Record<ReceiptEntryType, string> = {
  text: 'Text',
  image: 'Logo / Image',
  text_special: 'Styled Text',
  horizontal_line: 'Divider Line',
  barcode: 'Barcode / QR',
  left_right_text: 'Left & Right Row',
  table: 'Items Table',
  multi_format: 'Mixed Format Line',
  files_note: 'Policy / Note',
}

export const createEmptyBlock = (type: ReceiptEntryType): CustomReceiptEntry => {
  const id = `entry-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
  switch (type) {
    case 'text':
      return { id, type, enabled: true, text: 'New text', size: 'medium', align: 'left' }
    case 'image':
      return { id, type, enabled: true, align: 'center', widthPercent: 60 }
    case 'text_special':
      return { id, type, enabled: true, text: 'Heading', fontSizePt: 14, bold: true, align: 'center' }
    case 'horizontal_line':
      return { id, type, enabled: true, lineStyle: 'single' }
    case 'barcode':
      return { id, type, enabled: true, codeType: 'qr_code', format: 'qr', value: '{{bill_pdf_url}}', align: 'center', size: 'medium', qrType: 'digital_bill' }
    case 'left_right_text':
      return { id, type, enabled: true, left: 'Label', right: 'Value', size: 'small' }
    case 'table':
      return { id, type, enabled: true, tableType: 'simple', showDiscountColumn: false }
    case 'multi_format':
      return { id, type, enabled: true, segments: [{ text: 'Mixed ', bold: false }, { text: 'text', bold: true }], align: 'left' }
    case 'files_note':
      return { id, type, enabled: true, title: 'Note', content: 'Store policy text', align: 'left' }
  }
}
