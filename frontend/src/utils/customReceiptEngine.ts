import type { Sale, SaleItem } from '@/types/sale.types'
import type { CustomReceiptEntry, CustomReceiptTemplate } from '@/types/customReceipt'
import type { GstBreakdownStyle } from '@/constants/gstBilling'
import { getCols, padTwoCol, formatThermalAmount, formatThermalMoney } from './receiptEngine'
import { gstSummaryFromCart } from './gst'
import { buildUpiPayLink, isValidUpiVpa } from './upiQr'
import { EscPosBuilder, rasterizeImageForEscPos, type EscPosAlign } from './escpos'
import { resolveActiveFromTemplates } from './ensureReceiptTemplates'
import { isRestaurantReceiptTemplate } from './restaurantReceiptTemplate'
import { isReceiptEntryEnabled, isBrowserLoadableImageSrc, prefetchPrintableLogoSrc, resolveReceiptImageSrc } from './receiptLogo'
import {
  RECEIPT_LOGO_DEFAULT_WIDTH_PERCENT,
  coerceGstRate,
  formatItemGstRate,
  receiptLogoMaxDots,
  receiptLogoMaxDotsFromChip,
  receiptLogoHtmlMaxPxFromChip,
  receiptQrEscPosModuleSizeForEntry,
  receiptQrHtmlPx,
  receiptStandardQrHtmlPxFromChip,
  type ReceiptSizeChip,
  wrapReceiptWords,
  alignReceiptLine,
  wrapReceiptAligned,
} from '@shared/receiptPrintGeometry'

export { wrapReceiptWords, alignReceiptLine, wrapReceiptAligned }

export interface ReceiptPrintContext {
  storeName: string
  storeAddress?: string
  storePhone?: string
  storeGstin?: string
  storeLogoUrl?: string
  upiId?: string
  saleId?: string
  invoiceNumber: string
  date?: string
  time?: string
  customerName?: string
  customerPhone?: string
  items: {
    productName: string
    quantity: number
    unitPrice: number
    total: number
    unit?: string
    gstRate?: number
    discount?: number
    priceIncludesGst?: boolean
  }[]
  subtotal: number
  totalDiscount: number
  totalTax: number
  grandTotal: number
  amountPaid?: number
  changeReturned?: number
  paymentMethod?: string
  footerMessage?: string
  tableNo?: string
  waiterName?: string
  tokenNo?: string
}

export const SAMPLE_RECEIPT_CONTEXT: ReceiptPrintContext = {
  storeName: 'SEZNIK SUPERSTORE',
  storeAddress: '123 Market Road, City Centre',
  storePhone: '+91 98765 43210',
  storeGstin: '27AAAAA0000A1Z5',
  invoiceNumber: 'INV-2026-0042',
  date: new Date().toLocaleDateString('en-GB'),
  time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  customerName: 'Walk-in Customer',
  customerPhone: '+91 99887 76655',
  items: [
    { productName: 'Basmati Rice 5kg', quantity: 1, unitPrice: 450, total: 450, unit: 'Bag', gstRate: 5 },
    { productName: 'Sunflower Oil 1L', quantity: 2, unitPrice: 180, total: 360, unit: 'Btl', gstRate: 5 },
    { productName: 'Whole Wheat Flour 5kg', quantity: 1, unitPrice: 280, total: 280, unit: 'Bag', gstRate: 0 },
  ],
  subtotal: 1090,
  totalDiscount: 0,
  totalTax: 40.5,
  grandTotal: 1130.5,
  amountPaid: 1130.5,
  changeReturned: 0,
  paymentMethod: 'CASH',
  footerMessage: 'Thank you for your purchase!',
}

export function saleToReceiptContext(
  sale: Sale,
  opts?: {
    businessName?: string
    businessAddress?: string
    businessPhone?: string
    businessGSTIN?: string
    businessLogoURL?: string
    upiId?: string
    footerMessage?: string
    customerName?: string
    tableNo?: string
    waiterName?: string
    tokenNo?: string
  }
): ReceiptPrintContext {
  const items = (sale.items || []).map((it: SaleItem) => ({
    productName: it.productName || 'Item',
    quantity: it.quantity ?? 1,
    unitPrice: it.sellingPrice ?? 0,
    total: it.total ?? it.quantity * (it.sellingPrice ?? 0),
    gstRate: coerceGstRate(it.taxRate),
    discount: it.discount,
    priceIncludesGst: it.priceIncludesGst,
  }))
  const subtotal = sale.subtotal ?? items.reduce((s, i) => s + i.total, 0)
  const totalDiscount = sale.totalDiscount ?? 0
  const totalTax = sale.totalTax ?? 0
  const grandTotal = sale.grandTotal ?? subtotal - totalDiscount + totalTax
  const d = sale.createdAt ? new Date(sale.createdAt as string | number | Date) : new Date()
  const saleExtra = sale as Sale & { tableNo?: string; waiterName?: string; tokenNumber?: string | number }
  const tokenNo = opts?.tokenNo || (saleExtra.tokenNumber != null ? String(saleExtra.tokenNumber) : undefined)
  return {
    storeName: opts?.businessName || '',
    storeAddress: opts?.businessAddress,
    storePhone: opts?.businessPhone,
    storeGstin: opts?.businessGSTIN,
    storeLogoUrl: opts?.businessLogoURL,
    upiId: opts?.upiId,
    saleId: sale.id,
    invoiceNumber: sale.invoiceNumber || sale.id?.slice(0, 8) || 'INV-0000',
    date: d.toLocaleDateString('en-GB'),
    time: d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    customerName: (
      opts?.customerName ||
      (sale as any)?.customerName ||
      (sale as any)?.customer?.name ||
      'Walk-in Customer'
    ).trim() || 'Walk-in Customer',
    customerPhone: (opts?.customerPhone || (sale as any)?.customerPhone || (sale as any)?.customer?.phone || '').trim() || undefined,
    items,
    subtotal,
    totalDiscount,
    totalTax,
    grandTotal,
    amountPaid: sale.amountPaid ?? grandTotal,
    changeReturned: sale.changeReturned ?? 0,
    paymentMethod: sale.paymentMethod || 'CASH',
    footerMessage: opts?.footerMessage || '',
    tableNo: opts?.tableNo || saleExtra.tableNo,
    waiterName: opts?.waiterName || saleExtra.waiterName,
    tokenNo,
  }
}

export function interpolateReceiptVariables(
  text: string,
  data: ReceiptPrintContext,
  opts?: { thermal?: boolean }
): string {
  if (!text) return ''
  if (/scan/i.test(text) && /pay/i.test(text)) {
    return 'SCAN TO PAY VIA UPI'
  }
  const upiStr = data.upiId ? buildUpiPayLink({ upiId: data.upiId, payeeName: data.storeName, amount: data.grandTotal, note: data.invoiceNumber }) : ''
  const targetId = encodeURIComponent(data.saleId || data.invoiceNumber || 'INV-2026-0042')
  const billPdfUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/receipt/${targetId}`
    : `https://api.seznik.com/receipt/${targetId}`

  const rawDate = (data.date || '').trim()
  let dateStr = rawDate
  let timeStr = (data.time || '').trim()
  const dtMatch = rawDate.match(/^(\d{1,4}[-/.]\d{1,2}[-/.]\d{2,4})[,\sT]+(.+)$/)
  if (dtMatch) {
    dateStr = dtMatch[1]
    if (!timeStr) {
      timeStr = dtMatch[2]
    }
  }
  if (!dateStr) {
    dateStr = new Date().toLocaleDateString('en-GB')
  }
  if (!timeStr) {
    timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const rawCustName = (data.customerName || 'Walk-in Customer').trim()
  const isWalkIn = !data.customerName || /walk[- ]*in/i.test(data.customerName)
  const custName = isWalkIn ? 'Walk-in Customer' : rawCustName
  const custLabelVal = isWalkIn ? 'Walk-in' : rawCustName
  const custPhone = (data.customerPhone || '').trim()

  const money = (n: number) => (opts?.thermal ? formatThermalMoney(n) : `₹${n.toFixed(2)}`)

  return text
    .replace(/(?:Phone|Ph|Tel)?:\s*\{\{store_phone\}\}/gi, data.storePhone ? `Ph: ${data.storePhone}` : '')
    .replace(/GST(?:IN)?:\s*\{\{store_gstin\}\}/gi, data.storeGstin ? `GSTIN: ${data.storeGstin}` : '')
    .replace(/(?:Customer|Cust)?:\s*\{\{customer_name\}\}/gi, `Customer: ${custLabelVal}`)
    .replace(/(?:Phone|Ph|Tel)?:\s*\{\{customer_phone\}\}/gi, custPhone ? `Phone: ${custPhone}` : '')
    .replace(/(?:Table|Tbl)?:\s*\{\{table_no\}\}/gi, data.tableNo ? `Table: ${data.tableNo}` : '')
    .replace(/(?:Waiter)?:\s*\{\{waiter_name\}\}/gi, data.waiterName ? `Waiter: ${data.waiterName}` : '')
    .replace(/(?:Token)?:\s*\{\{token_no\}\}/gi, data.tokenNo ? `Token: ${data.tokenNo}` : '')
    .replace(/\{\{store_name\}\}/gi, data.storeName || '')
    .replace(/\{\{store_address\}\}/gi, data.storeAddress || '')
    .replace(/\{\{store_phone\}\}/gi, data.storePhone || '')
    .replace(/\{\{store_gstin\}\}/gi, data.storeGstin || '')
    .replace(/\{\{invoice_no\}\}/gi, data.invoiceNumber || '')
    .replace(/\{\{date\}\}/gi, dateStr)
    .replace(/\{\{time\}\}/gi, timeStr)
    .replace(/\{\{customer_name\}\}/gi, custName)
    .replace(/\{\{customer_phone\}\}/gi, custPhone)
    .replace(/\{\{subtotal\}\}/gi, money(data.subtotal))
    .replace(/\{\{discount\}\}/gi, money(data.totalDiscount))
    .replace(/\{\{tax\}\}/gi, money(data.totalTax))
    .replace(/\{\{total_tax\}\}/gi, money(data.totalTax))
    .replace(/\{\{grand_total\}\}/gi, money(data.grandTotal))
    .replace(/\{\{paid_amount\}\}/gi, money(data.amountPaid ?? data.grandTotal))
    .replace(/\{\{change_returned\}\}/gi, money(data.changeReturned ?? 0))
    .replace(/\{\{payment_method\}\}/gi, data.paymentMethod || 'CASH')
    .replace(/\{\{upi_qr\}\}/gi, upiStr)
    .replace(/\{\{bill_pdf_url\}\}/gi, billPdfUrl)
    .replace(/\{\{footer_message\}\}/gi, data.footerMessage || '')
    .replace(/\{\{token_no\}\}/gi, data.tokenNo || '')
    .replace(/\{\{table_no\}\}/gi, data.tableNo || '')
    .replace(/\{\{waiter_name\}\}/gi, data.waiterName || '')
}

const isDiscountEntry = (e: CustomReceiptEntry) =>
  e.type === 'left_right_text' && /discount/i.test(e.left + e.right)

const isTaxEntry = (e: CustomReceiptEntry) =>
  e.type === 'left_right_text' && /\btax\b/i.test(e.left + e.right)

export interface CustomReceiptGstOpts {
  itemWiseGst?: boolean
  gstStyle?: GstBreakdownStyle
  showTaxBreakdown?: boolean
  /** When unset on the table block, restaurant/cafe bills number items; retail does not. */
  isRestaurant?: boolean
  /** User-selected Logo size chip from ReceiptConfig.receiptLogoSize */
  receiptLogoSize?: ReceiptSizeChip
  /** User-selected QR size chip from ReceiptConfig.receiptQrSize */
  receiptQrSize?: ReceiptSizeChip
  /** Shared receipt font library id — CSS / RN typeface for preview + HTML prints. */
  receiptFont?: import('@shared/receiptFonts').ReceiptFontId
}

/** Format thermal table amounts without ₹ or Indian grouping to preserve column width. */
function thermalAmount(num: number): string {
  return formatThermalAmount(num)
}

function escapeHtmlText(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

const HTML_ROW =
  'display:flex;justify-content:space-between;align-items:baseline;gap:8px;width:100%;max-width:100%;overflow:hidden;'
const HTML_LEFT = 'flex:1 1 auto;min-width:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;'
const HTML_RIGHT = 'flex:0 0 auto;white-space:nowrap;text-align:right;'

export function padTwoColLines(left: string, right: string, width: number): string[] {
  const leftStr = String(left ?? '').trim()
  const rightStr = String(right ?? '').trim()
  if (!leftStr && !rightStr) return []
  if (!leftStr) return [rightStr.padStart(width, ' ')]
  if (!rightStr) return wrapReceiptWords(leftStr, width)

  if (leftStr.length + rightStr.length + 1 <= width) {
    const spaces = width - leftStr.length - rightStr.length
    return [leftStr + ' '.repeat(spaces) + rightStr]
  }

  const leftLines = wrapReceiptWords(leftStr, width)
  return [...leftLines, rightStr.padStart(width, ' ')]
}

function htmlTwoColRow(left: string, right: string, fontSize: string, bold = false): string {
  const weight = bold ? 'font-weight:700;' : ''
  return `<div style="${HTML_ROW}${weight}font-size:${fontSize};"><span style="${HTML_LEFT}">${escapeHtmlText(left)}</span><span style="${HTML_RIGHT}">${escapeHtmlText(right)}</span></div>`
}

export function resolveShowItemNumbers(entry: CustomReceiptEntry, isRestaurant?: boolean): boolean {
  if (entry.type !== 'table') return false
  if (entry.showItemNumbers === true) return true
  if (entry.showItemNumbers === false) return false
  return isRestaurant === true && entry.tableType === 'advanced'
}

/** Advanced table blocks use compact ITEM | QTY | AMT columns (restaurant thermal layout). */
export function isCompactItemsTable(entry: CustomReceiptEntry): entry is TableReceiptEntry {
  return entry.type === 'table' && entry.tableType === 'advanced'
}

/** Word-wrap long dish names for restaurant/cafe bills and the restaurant receipt template. */
export function resolveCompactTableWrap(
  opts?: CustomReceiptGstOpts,
  template?: Pick<CustomReceiptTemplate, 'id' | 'name'> | null
): boolean {
  return opts?.isRestaurant === true || isRestaurantReceiptTemplate(template ?? undefined)
}

type TableReceiptEntry = Extract<CustomReceiptEntry, { type: 'table' }>

function padColLeft(str: string, len: number): string {
  const s = String(str ?? '')
  if (s.length >= len) return s.slice(s.length - len)
  return ' '.repeat(len - s.length) + s
}

function padColRight(str: string, len: number): string {
  const s = String(str ?? '')
  if (s.length >= len) return s.slice(0, len)
  return s + ' '.repeat(len - s.length)
}

function formatCompactQty(qty: number): string {
  const rounded = Math.round(qty * 1000) / 1000
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(3)
}

function compactItemLine(name: string, qty: string, amount: string, width: number): string {
  const amt = padColLeft(amount, 8)
  const qtyCol = padColLeft(qty, 4)
  const nameWidth = compactTableNameWidth(width)
  return `${padColRight(name.toUpperCase(), nameWidth)} ${qtyCol} ${amt}`.slice(0, width)
}

/** Name column width for compact ITEM | QTY | AMT rows (58mm ≈ 18 chars). */
export function compactTableNameWidth(width: number): number {
  const amtWidth = 8
  const qtyWidth = 4
  return Math.max(8, width - amtWidth - qtyWidth - 2)
}

/** Word-boundary wrap for compact table name column — never splits mid-word. */
export function wrapCompactTableName(name: string, nameWidth: number): string[] {
  const words = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (words.length === 0) return ['']

  const lines: string[] = []
  let current = ''

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word
    if (candidate.length <= nameWidth) {
      current = candidate
    } else {
      if (current) lines.push(current)
      current = word
    }
  }
  if (current) lines.push(current)
  return lines
}

/** Hybrid compact item: single line when short; wrapped name + aligned qty/amt when long (restaurant/cafe only). */
export function renderCompactTableItemLines(
  item: ReceiptPrintContext['items'][number],
  width: number,
  wrapNames?: boolean,
  showTaxColumn?: boolean
): string[] {
  const name = String(item.productName || 'ITEM').toUpperCase()
  const qty = formatCompactQty(item.quantity)
  const amount = thermalAmount(item.total)
  const nameWidth = compactTableNameWidth(width)

  const output: string[] = []
  if (!wrapNames || name.length <= nameWidth) {
    output.push(compactItemLine(name, qty, amount, width))
  } else {
    const nameLines = wrapCompactTableName(name, nameWidth)
    output.push(compactItemLine(nameLines[0]!, qty, amount, width))
    for (let i = 1; i < nameLines.length; i++) {
      output.push(nameLines[i]!)
    }
  }

  if (showTaxColumn && item.gstRate) {
    const gstLabel = formatItemGstRate(item.gstRate)
    if (gstLabel) output.push(`   ${gstLabel} GST`)
  }

  return output
}

function renderCompactTableItemHtml(
  item: ReceiptPrintContext['items'][number],
  fontSize: string,
  width: number,
  wrapNames?: boolean,
  showTaxColumn?: boolean
): string {
  const name = String(item.productName || 'ITEM').toUpperCase()
  const qty = formatCompactQty(item.quantity)
  const amount = thermalAmount(item.total)
  const nameWidth = compactTableNameWidth(width)
  const gstHtml =
    showTaxColumn && item.gstRate
      ? (() => {
          const gstLabel = formatItemGstRate(item.gstRate)
          return gstLabel
            ? `<div style="font-size:${fontSize};padding-left:8px;color:#555;">${escapeHtmlText(gstLabel)} GST</div>`
            : ''
        })()
      : ''

  if (!wrapNames || name.length <= nameWidth) {
    return `<div style="display:flex;justify-content:space-between;font-size:${fontSize};margin-bottom:2px;"><span style="flex:1;font-weight:700;${wrapNames ? '' : 'overflow:hidden;text-overflow:ellipsis;white-space:nowrap;'}">${escapeHtmlText(name)}</span><span style="width:28px;text-align:right;flex-shrink:0;">${escapeHtmlText(qty)}</span><span style="width:52px;text-align:right;font-weight:700;flex-shrink:0;">${escapeHtmlText(amount)}</span></div>${gstHtml}`
  }

  const nameLines = wrapCompactTableName(name, nameWidth)
  const continuation = nameLines
    .slice(1)
    .map(
      (line) =>
        `<div style="font-size:${fontSize};font-weight:700;line-height:1.25;">${escapeHtmlText(line)}</div>`
    )
    .join('')
  return `<div style="margin-bottom:8px;"><div style="display:flex;justify-content:space-between;align-items:flex-start;font-size:${fontSize};"><span style="flex:1;font-weight:700;line-height:1.25;">${escapeHtmlText(nameLines[0]!)}</span><span style="width:28px;text-align:right;flex-shrink:0;line-height:1.25;">${escapeHtmlText(qty)}</span><span style="width:52px;text-align:right;font-weight:700;flex-shrink:0;line-height:1.25;">${escapeHtmlText(amount)}</span></div>${continuation}${gstHtml}</div>`
}

function appendCompactTableItemLines(
  target: string[],
  item: ReceiptPrintContext['items'][number],
  width: number,
  wrapNames: boolean,
  addLeadingGap: boolean,
  showTaxColumn?: boolean
): void {
  if (addLeadingGap) target.push('')
  target.push(...renderCompactTableItemLines(item, width, wrapNames, showTaxColumn))
}

function renderCompactTableHeader(entry: TableReceiptEntry, width: number): string {
  const itemCol = entry.columnHeaders?.item || 'ITEM'
  const qtyCol = entry.columnHeaders?.qty || 'QTY'
  const totalCol = entry.columnHeaders?.total || 'AMT'
  return compactItemLine(itemCol, qtyCol, totalCol, width)
}

/** Product name on its own line(s); qty/rate and amount on a separate padded row. */
function renderTableItemLines(
  item: ReceiptPrintContext['items'][number],
  idx: number,
  width: number,
  showTaxColumn: boolean,
  showItemNumbers: boolean
): string[] {
  const lines: string[] = []
  const prefix = showItemNumbers ? `${idx + 1}. ` : ''
  const name = String(item.productName || 'Item')
  const fullName = prefix + name

  const nameLines = wrapReceiptWords(fullName, width)
  lines.push(...nameLines)

  if (showTaxColumn && item.gstRate) {
    const gstLabel = formatItemGstRate(item.gstRate)
    if (gstLabel) lines.push(`   ${gstLabel} GST`)
  }

  const qtyRate = `${item.quantity} ${item.unit || 'Pc'} x ${thermalAmount(item.unitPrice)}`
  lines.push(padTwoCol(`   ${qtyRate}`, thermalAmount(item.total), width))

  if (item.discount && item.discount > 0) {
    lines.push(`   Disc: -Rs.${thermalAmount(item.discount)}`)
  }

  return lines
}

function renderTableItemHtml(
  item: ReceiptPrintContext['items'][number],
  idx: number,
  fontSize: string,
  showTaxColumn: boolean,
  showItemNumbers: boolean
): string {
  const name = showItemNumbers ? `${idx + 1}. ${item.productName || 'Item'}` : (item.productName || 'Item')
  const qtyRate = `${item.quantity} ${item.unit || 'Pc'} x ${thermalAmount(item.unitPrice)}`
  const parts = [
    `<div style="font-size:${fontSize};word-break:break-word;overflow-wrap:anywhere;">${escapeHtmlText(name)}</div>`,
  ]
  if (showTaxColumn && item.gstRate) {
    const gstLabel = formatItemGstRate(item.gstRate)
    if (gstLabel) {
      parts.push(`<div style="font-size:${fontSize};padding-left:8px;">${escapeHtmlText(gstLabel)} GST</div>`)
    }
  }
  parts.push(htmlTwoColRow(qtyRate, thermalAmount(item.total), fontSize))
  if (item.discount && item.discount > 0) {
    parts.push(`<div style="font-size:${fontSize};padding-left:8px;">Disc: -Rs.${thermalAmount(item.discount)}</div>`)
  }
  return parts.join('')
}

export function resolveShowTaxColumn(entry: CustomReceiptEntry, globalItemWiseGst?: boolean): boolean {
  if (entry.type !== 'table') return false
  if (entry.showTaxColumn === true) return true
  if (entry.showTaxColumn === false) return false
  return globalItemWiseGst === true
}

export function compileGstBreakdownLines(
  data: ReceiptPrintContext,
  width: number,
  opts?: CustomReceiptGstOpts
): string[] {
  return compileGstBreakdownPairs(data, opts).map(({ left, right }) => padTwoCol(left, right, width))
}

export function compileGstBreakdownPairs(
  data: ReceiptPrintContext,
  opts?: CustomReceiptGstOpts
): { left: string; right: string }[] {
  if (!opts?.showTaxBreakdown || data.totalTax <= 0) return []

  const gstStyle = opts.gstStyle ?? 'tax_invoice'
  const lineDisc = data.items.reduce((s, i) => s + (i.discount || 0), 0)
  const orderDisc = Math.max(0, data.totalDiscount - lineDisc)
  const summary = gstSummaryFromCart(
    data.items.map((i) => ({
      sellingPrice: i.unitPrice,
      quantity: i.quantity,
      discount: i.discount || 0,
      taxRate: i.gstRate || 0,
      priceIncludesGst: i.priceIncludesGst ?? true,
    })),
    orderDisc
  )

  if (gstStyle === 'compact') {
    return [{ left: 'GST', right: thermalAmount(data.totalTax) }]
  }

  if (gstStyle === 'slab_wise') {
    const pairs: { left: string; right: string }[] = []
    summary.slabs
      .filter((s) => s.gstRate > 0)
      .forEach((s) => {
        pairs.push({ left: `Taxable @ ${s.gstRate}%`, right: thermalAmount(s.taxableValue) })
        pairs.push({ left: `  CGST @ ${s.cgstRate}%`, right: thermalAmount(s.cgstAmount) })
        pairs.push({ left: `  SGST @ ${s.sgstRate}%`, right: thermalAmount(s.sgstAmount) })
      })
    return pairs
  }

  return [
    { left: 'Taxable Value', right: thermalAmount(summary.taxableValue) },
    { left: '  CGST', right: thermalAmount(summary.cgstAmount) },
    { left: '  SGST', right: thermalAmount(summary.sgstAmount) },
  ]
}

export function compileCustomReceiptTextLines(
  template: CustomReceiptTemplate,
  data: ReceiptPrintContext,
  paperSize: '58mm' | '80mm' = '58mm',
  opts?: CustomReceiptGstOpts
): string[] {
  const width = getCols(paperSize, undefined, opts?.receiptFont)
  const lines: string[] = []
  const globalItemWiseGst = opts?.itemWiseGst
  const wrapCompactNames = resolveCompactTableWrap(opts, template)

  const alignText = (str: string, align: 'left' | 'center' | 'right' = 'left') => {
    return alignReceiptLine(str, width, align)
  }

  const padLine = (left: string, right: string) => padTwoCol(left, right, width)
  const thermal = { thermal: true as const }

  for (const entry of template.entries.filter(isReceiptEntryEnabled)) {
    switch (entry.type) {
      case 'text':
      case 'text_special': {
        const raw = interpolateReceiptVariables(entry.text, data, thermal)
        const wrapped = wrapReceiptAligned(raw, width, entry.align || 'left')
        lines.push(...wrapped.filter((l) => l.trim().length > 0))
        break
      }
      case 'horizontal_line': {
        const char = entry.lineStyle === 'double' ? '=' : entry.lineStyle === 'dotted' ? '.' : '-'
        lines.push(char.repeat(width))
        break
      }
      case 'left_right_text': {
        if (isDiscountEntry(entry) && data.totalDiscount <= 0) break
        if (isTaxEntry(entry)) {
          if (data.totalTax <= 0) break
          const gstLines = compileGstBreakdownLines(data, width, opts)
          if (gstLines.length > 0) {
            lines.push(...gstLines)
          } else if (opts?.showTaxBreakdown !== false) {
            lines.push(
              padLine(
                interpolateReceiptVariables(entry.left, data, thermal),
                interpolateReceiptVariables(entry.right, data, thermal)
              )
            )
          }
          break
        }
        // Skip scan-to-pay rows — barcode block handles the "SCAN TO PAY VIA UPI" label
        if (/scan/i.test(String(entry.left || '') + String(entry.right || ''))) break
        const l = interpolateReceiptVariables(entry.left, data, thermal).trim()
        const r = interpolateReceiptVariables(entry.right, data, thermal).trim()
        if (l || r) {
          lines.push(...padTwoColLines(l, r, width))
        }
        break
      }
      case 'table': {
        if (isCompactItemsTable(entry)) {
          const showTaxColumn = resolveShowTaxColumn(entry, globalItemWiseGst)
          lines.push(renderCompactTableHeader(entry, width))
          lines.push('-'.repeat(width))
          data.items.forEach((item, idx) => {
            appendCompactTableItemLines(
              lines,
              item,
              width,
              wrapCompactNames,
              wrapCompactNames && idx > 0,
              showTaxColumn
            )
          })
          break
        }
        const itemCol = entry.columnHeaders?.item || 'Item'
        const totalCol = entry.columnHeaders?.total || 'Total'
        const showTaxColumn = resolveShowTaxColumn(entry, globalItemWiseGst)
        const showItemNumbers = resolveShowItemNumbers(entry, opts?.isRestaurant)
        lines.push(padLine(itemCol, totalCol))
        lines.push('-'.repeat(width))
        data.items.forEach((item, idx) => {
          lines.push(...renderTableItemLines(item, idx, width, showTaxColumn, showItemNumbers))
        })
        break
      }
      case 'multi_format': {
        const joined = (entry.segments || [])
          .map((seg) => interpolateReceiptVariables(seg.text, data, thermal))
          .filter(Boolean)
          .join(' ')
        lines.push(alignText(joined, entry.align || 'left'))
        break
      }
      case 'barcode': {
        const val = interpolateReceiptVariables(entry.value, data, thermal)
        if (entry.format === 'qr' || entry.codeType === 'qr_code') {
          lines.push(alignText(`[QR: ${val}]`, entry.align || 'center'))
        } else {
          lines.push(alignText(`* ${val} *`, entry.align || 'center'))
        }
        break
      }
      case 'files_note': {
        if (entry.title) lines.push(alignText(interpolateReceiptVariables(entry.title, data, thermal), entry.align || 'left'))
        interpolateReceiptVariables(entry.content, data, thermal)
          .split('\n')
          .forEach((l) => lines.push(alignText(l, entry.align || 'left')))
        break
      }
      case 'image':
        lines.push('')
        break
    }
  }

  lines.push('')
  return lines
}

export interface CustomReceiptHtmlImageRenderer {
  (src: string | undefined, widthPercent: number, align: 'left' | 'center' | 'right'): string
}

/** Browser-print HTML for a custom template — mirrors preview block order, including logos. */
export function compileCustomReceiptHtml(
  template: CustomReceiptTemplate,
  data: ReceiptPrintContext,
  paperSize: '58mm' | '80mm',
  storeLogoUrl: string | undefined,
  smallFS: string,
  renderImage: CustomReceiptHtmlImageRenderer,
  opts?: CustomReceiptGstOpts & { showLogo?: boolean }
): string {
  const showLogo = opts?.showLogo ?? true
  const gstOpts: CustomReceiptGstOpts = {
    itemWiseGst: opts?.itemWiseGst,
    gstStyle: opts?.gstStyle,
    showTaxBreakdown: opts?.showTaxBreakdown,
    isRestaurant: opts?.isRestaurant,
    receiptFont: opts?.receiptFont,
  }
  const cols = getCols(paperSize, undefined, opts?.receiptFont)
  const wrapCompactNames = resolveCompactTableWrap(opts, template)
  const enabledEntries = template.entries.filter(isReceiptEntryEnabled)
  const hasEnabledImageBlock = enabledEntries.some((e) => e.type === 'image')
  const parts: string[] = []

  if (showLogo && !hasEnabledImageBlock && isBrowserLoadableImageSrc(storeLogoUrl)) {
    parts.push(renderImage(storeLogoUrl, RECEIPT_LOGO_DEFAULT_WIDTH_PERCENT, 'center'))
  }

  for (const entry of enabledEntries) {
    if (entry.type === 'image') {
      if (!showLogo) continue
      const src = resolveReceiptImageSrc(entry, storeLogoUrl)
      if (!src && !storeLogoUrl) continue
      parts.push(renderImage(src, entry.widthPercent || RECEIPT_LOGO_DEFAULT_WIDTH_PERCENT, entry.align || 'center'))
      continue
    }

    if (entry.type === 'left_right_text') {
      if (isDiscountEntry(entry) && data.totalDiscount <= 0) continue
      if (isTaxEntry(entry)) {
        if (data.totalTax <= 0) continue
        const gstPairs = compileGstBreakdownPairs(data, gstOpts)
        if (gstPairs.length > 0) {
          gstPairs.forEach(({ left, right }) => {
            parts.push(htmlTwoColRow(left, right, smallFS))
          })
        } else if (gstOpts.showTaxBreakdown !== false) {
          const l = interpolateReceiptVariables(entry.left, data).trim()
          const r = interpolateReceiptVariables(entry.right, data).trim()
          if (l || r) {
            parts.push(htmlTwoColRow(l, r, smallFS))
          }
        }
        continue
      }
      // Skip scan-to-pay rows entirely — the barcode block renders "SCAN TO PAY VIA UPI" as a header
      if (/scan/i.test(String(entry.left || '') + String(entry.right || ''))) continue
      let leftVal = interpolateReceiptVariables(entry.left, data).trim()
      let rightVal = interpolateReceiptVariables(entry.right, data).trim()
      if (!leftVal && !rightVal) continue
      parts.push(
        htmlTwoColRow(
          leftVal,
          rightVal,
          smallFS,
          Boolean(entry.bold)
        )
      )
      continue
    }

    if (entry.type === 'table') {
      if (isCompactItemsTable(entry)) {
        const showTaxColumn = resolveShowTaxColumn(entry, gstOpts.itemWiseGst)
        const itemCol = entry.columnHeaders?.item || 'ITEM'
        const qtyCol = entry.columnHeaders?.qty || 'QTY'
        const totalCol = entry.columnHeaders?.total || 'AMT'
        const header = `<div style="display:flex;justify-content:space-between;font-weight:700;font-size:${smallFS};border-bottom:1px dashed #000;padding-bottom:2px;margin-bottom:2px;"><span style="flex:1;">${escapeHtmlText(itemCol)}</span><span style="width:28px;text-align:right;">${escapeHtmlText(qtyCol)}</span><span style="width:52px;text-align:right;">${escapeHtmlText(totalCol)}</span></div>`
        const rows = data.items
          .map((item) => renderCompactTableItemHtml(item, smallFS, cols, wrapCompactNames, showTaxColumn))
          .join('')
        parts.push(`<div style="width:100%;">${header}${rows}</div>`)
        continue
      }
      const itemCol = entry.columnHeaders?.item || 'Item'
      const totalCol = entry.columnHeaders?.total || 'Total'
      const showTaxColumn = resolveShowTaxColumn(entry, gstOpts.itemWiseGst)
      const showItemNumbers = resolveShowItemNumbers(entry, gstOpts.isRestaurant)
      const tableParts = [
        htmlTwoColRow(itemCol, totalCol, smallFS, true),
        `<div style="border-top:1px dashed #000;margin:2px 0;font-size:${smallFS};"></div>`,
        ...data.items.map((item, idx) => renderTableItemHtml(item, idx, smallFS, showTaxColumn, showItemNumbers)),
      ]
      parts.push(`<div style="font-size:${smallFS};width:100%;">${tableParts.join('')}</div>`)
      continue
    }

    if (entry.type === 'barcode') {
      let rawVal = interpolateReceiptVariables(entry.value || '', data)
      if (entry.qrType === 'upi' || entry.value?.includes('{{upi_qr}}') || entry.upiId) {
        const upi = entry.upiId || data.upiId
        if (isValidUpiVpa(upi)) {
          rawVal = buildUpiPayLink({
            upiId: (upi || '').trim(),
            payeeName: data.storeName,
            amount: data.grandTotal,
            note: data.invoiceNumber,
          })
        } else {
          rawVal = ''
        }
      } else if (entry.qrType === 'custom') {
        rawVal = rawVal && rawVal !== '{{custom_url}}' ? rawVal : 'https://seznik.com'
      } else if (entry.qrType === 'digital_bill' || rawVal === '{{bill_pdf_url}}') {
        const targetId = encodeURIComponent(data.saleId || data.invoiceNumber || 'INV-2026-0042')
        rawVal = typeof window !== 'undefined'
          ? `${window.location.origin}/receipt/${targetId}`
          : `https://api.seznik.com/receipt/${targetId}`
      } else if (entry.qrType === 'invoice_barcode' || rawVal === '{{invoice_no}}') {
        rawVal = data.invoiceNumber || 'INV-2026-0001'
      }

      const align = entry.align || 'center'
      const isQr = entry.format === 'qr' || entry.codeType === 'qr_code'
      const isUpi = entry.qrType === 'upi' || entry.value?.includes('{{upi_qr}}') || Boolean(entry.upiId)
      if (isQr && rawVal) {
        const qrImg = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&margin=4&data=${encodeURIComponent(rawVal)}`
      const qrDim =
          isUpi || entry.qrType === 'digital_bill' || !entry.size
            ? receiptStandardQrHtmlPxFromChip(gstOpts.receiptQrSize)
            : receiptQrHtmlPx(entry.size === 'large' || entry.size === 'small' ? entry.size : 'medium')
        parts.push(
          `<div style="text-align:${align};margin:10px 0;width:100%;"><img src="${qrImg}" width="${qrDim}" height="${qrDim}" alt="QR Code" style="display:inline-block;image-rendering:pixelated;background:#fff;padding:4px;border:1px solid #e2e8f0;border-radius:6px;margin:0 auto;" /></div>`
        )
      } else {
        parts.push(
          `<div style="text-align:${align};font-size:${smallFS};width:100%;">* ${escapeHtmlText(rawVal)} *</div>`
        )
      }
      continue
    }

    const miniTemplate: CustomReceiptTemplate = { ...template, entries: [entry] }
    const lines = compileCustomReceiptTextLines(miniTemplate, data, paperSize, gstOpts).filter((line) => line.trim())
    if (!lines.length) continue
    const align =
      entry.type === 'text' || entry.type === 'text_special' || entry.type === 'files_note'
        ? entry.align || 'left'
        : 'left'
    parts.push(
      `<div style="white-space:pre-wrap;font-size:${smallFS};text-align:${align};width:100%;max-width:100%;overflow:hidden;word-break:break-word;">${lines
        .map((line) => escapeHtmlText(line))
        .join('<br/>')}</div>`
    )
  }

  return parts.join('\n')
}

function toEscPosAlign(align?: 'left' | 'center' | 'right'): EscPosAlign {
  return align === 'center' ? 'center' : align === 'right' ? 'right' : 'left'
}

function qrModuleSize(entry: CustomReceiptEntry, defaultChip?: ReceiptSizeChip): number {
  if (entry.type !== 'barcode') return 4
  return receiptQrEscPosModuleSizeForEntry(entry.size || defaultChip || 'medium')
}

/** Rasterize and emit a store logo bitmap; returns true when bytes were sent. */
async function tryAppendEscPosLogo(
  b: EscPosBuilder,
  src: string | undefined,
  paperSize: '58mm' | '80mm',
  widthPercent = RECEIPT_LOGO_DEFAULT_WIDTH_PERCENT,
  align: EscPosAlign = 'center',
  chip: ReceiptSizeChip = 'medium'
): Promise<boolean> {
  if (!src) return false
  const printable = (await prefetchPrintableLogoSrc(src)) || src
  const { maxWidth: maxLogoWidth, maxHeight: maxLogoHeight } = receiptLogoMaxDotsFromChip(paperSize, chip)
  const widthDots = Math.floor(maxLogoWidth * Math.min(widthPercent, 100) / 100)
  const raster = await rasterizeImageForEscPos(printable, widthDots, maxLogoHeight)
  if (!raster) {
    console.warn('[receipt] Logo rasterization failed for:', src.slice(0, 80))
    return false
  }
  b.align(align)
  b.image(raster.packed, raster.widthBytes, raster.heightDots)
  b.feed(1)
  b.align('left')
  return true
}

/** Renders a custom receipt template directly to ESC/POS (text, logos, QR blocks). */
export async function appendCustomTemplateToEscPos(
  b: EscPosBuilder,
  template: CustomReceiptTemplate,
  data: ReceiptPrintContext,
  paperSize: '58mm' | '80mm' = '58mm',
  opts?: CustomReceiptGstOpts & { fallbackLogoUrl?: string; showLogo?: boolean }
): Promise<void> {
  const width = getCols(paperSize, undefined, opts?.receiptFont)
  const showLogo = opts?.showLogo ?? true
  const globalItemWiseGst = opts?.itemWiseGst
  const wrapCompactNames = resolveCompactTableWrap(opts, template)
  const gstOpts: CustomReceiptGstOpts = {
    itemWiseGst: opts?.itemWiseGst,
    gstStyle: opts?.gstStyle,
    showTaxBreakdown: opts?.showTaxBreakdown,
    isRestaurant: opts?.isRestaurant,
    receiptLogoSize: opts?.receiptLogoSize,
    receiptQrSize: opts?.receiptQrSize,
    receiptFont: opts?.receiptFont,
  }
  const fallbackLogo = showLogo ? (data.storeLogoUrl || opts?.fallbackLogoUrl) : undefined
  const enabledEntries = template.entries.filter(isReceiptEntryEnabled)
  const hasImageBlock = enabledEntries.some((e) => e.type === 'image')
  let logoPrinted = false

  // Legacy behaviour: always print store logo when template has no image block.
  if (fallbackLogo && !hasImageBlock) {
    logoPrinted = await tryAppendEscPosLogo(
      b,
      fallbackLogo,
      paperSize,
      RECEIPT_LOGO_DEFAULT_WIDTH_PERCENT,
      'center',
      opts?.receiptLogoSize || 'medium'
    )
  }

  const alignText = (str: string, align: 'left' | 'center' | 'right' = 'left') => {
    const wrapped = wrapReceiptWords(str, width)
    if (!wrapped.length) return
    b.align(toEscPosAlign(align))
    wrapped.forEach((line) => {
      if (line.trim()) b.line(line.trim())
    })
    b.align('left')
  }

  const padLine = (left: string, right: string) => {
    b.twoCol(left, right, width)
  }
  const thermal = { thermal: true as const }

  for (const entry of enabledEntries) {
    switch (entry.type) {
      case 'text':
      case 'text_special': {
        const isDouble = entry.type === 'text_special' || entry.size === 'large'
        const effectiveCols = isDouble ? Math.floor(width / 2) : width
        const raw = interpolateReceiptVariables(entry.text, data, thermal)
        const wrapped = wrapReceiptWords(raw, effectiveCols)
        b.align(toEscPosAlign(entry.align || 'left'))
        if (entry.bold) b.bold(true)
        if (isDouble) b.doubleSize(true)
        wrapped.forEach((line) => {
          if (line.trim()) b.line(line.trim())
        })
        if (isDouble) b.doubleSize(false)
        if (entry.bold) b.bold(false)
        b.align('left')
        break
      }
      case 'image': {
        const primary = resolveReceiptImageSrc(entry, fallbackLogo)
        const widthPct = entry.widthPercent || RECEIPT_LOGO_DEFAULT_WIDTH_PERCENT
        const align = toEscPosAlign(entry.align || 'center')
        let ok = await tryAppendEscPosLogo(b, primary, paperSize, widthPct, align, opts?.receiptLogoSize || 'medium')
        if (!ok && fallbackLogo && primary !== fallbackLogo) {
          ok = await tryAppendEscPosLogo(b, fallbackLogo, paperSize, widthPct, align, opts?.receiptLogoSize || 'medium')
        }
        logoPrinted = logoPrinted || ok
        break
      }
      case 'horizontal_line': {
        const char = entry.lineStyle === 'double' ? '=' : entry.lineStyle === 'dotted' ? '.' : '-'
        b.hr(width, char)
        break
      }
      case 'left_right_text': {
        if (isDiscountEntry(entry) && data.totalDiscount <= 0) break
        if (isTaxEntry(entry)) {
          if (data.totalTax <= 0) break
          const gstLines = compileGstBreakdownLines(data, width, gstOpts)
          if (gstLines.length > 0) {
            gstLines.forEach((line) => b.line(line))
          } else if (gstOpts.showTaxBreakdown !== false) {
            const l = interpolateReceiptVariables(entry.left, data, thermal).trim()
            const r = interpolateReceiptVariables(entry.right, data, thermal).trim()
            if (l || r) {
              padLine(l, r)
            }
          }
          break
        }
        let leftVal = interpolateReceiptVariables(entry.left, data, thermal).trim()
        let rightVal = interpolateReceiptVariables(entry.right, data, thermal).trim()
        if (/scan/i.test(entry.left + entry.right)) {
          leftVal = 'SCAN TO PAY VIA UPI'
          rightVal = ''
        }
        if (!leftVal && !rightVal) break
        padTwoColLines(leftVal, rightVal, width).forEach((line) => b.line(line))
        break
      }
      case 'table': {
        if (isCompactItemsTable(entry)) {
          const showTaxColumn = resolveShowTaxColumn(entry, globalItemWiseGst)
          b.line(renderCompactTableHeader(entry, width))
          b.hr(width, '-')
          data.items.forEach((item, idx) => {
            if (wrapCompactNames && idx > 0) b.line('')
            renderCompactTableItemLines(item, width, wrapCompactNames, showTaxColumn).forEach((line) =>
              b.line(line)
            )
          })
          break
        }
        const itemCol = entry.columnHeaders?.item || 'Item'
        const totalCol = entry.columnHeaders?.total || 'Total'
        const showTaxColumn = resolveShowTaxColumn(entry, globalItemWiseGst)
        const showItemNumbers = resolveShowItemNumbers(entry, opts?.isRestaurant)
        padLine(itemCol, totalCol)
        b.hr(width, '-')
        data.items.forEach((item, idx) => {
          renderTableItemLines(item, idx, width, showTaxColumn, showItemNumbers).forEach((line) => b.line(line))
        })
        break
      }
      case 'multi_format': {
        const joined = (entry.segments || [])
          .map((seg) => interpolateReceiptVariables(seg.text, data, thermal))
          .filter(Boolean)
          .join(' ')
        alignText(joined, entry.align || 'left')
        break
      }
      case 'barcode': {
        let rawVal = interpolateReceiptVariables(entry.value || '', data, thermal)
        if (entry.qrType === 'upi' || entry.value?.includes('{{upi_qr}}') || entry.upiId) {
          const upi = entry.upiId || data.upiId
          if (isValidUpiVpa(upi)) {
            rawVal = buildUpiPayLink({
              upiId: upi!,
              payeeName: data.storeName,
              amount: data.grandTotal,
              note: data.invoiceNumber,
            })
          } else {
            rawVal = ''
          }
        } else if (entry.qrType === 'custom') {
          rawVal = rawVal && rawVal !== '{{custom_url}}' ? rawVal : 'https://seznik.com'
        } else if (entry.qrType === 'digital_bill' || rawVal === '{{bill_pdf_url}}') {
          const targetId = encodeURIComponent(data.saleId || data.invoiceNumber || 'INV-2026-0042')
          rawVal = typeof window !== 'undefined'
            ? `${window.location.origin}/receipt/${targetId}`
            : `https://api.seznik.com/receipt/${targetId}`
        } else if (entry.qrType === 'invoice_barcode' || rawVal === '{{invoice_no}}') {
          rawVal = data.invoiceNumber || 'INV-2026-0001'
        }

        if (entry.format === 'qr' || entry.codeType === 'qr_code') {
          if (rawVal) {
            b.feed(1)
            b.align(toEscPosAlign(entry.align || 'center'))
            b.qr(rawVal, qrModuleSize(entry, opts?.receiptQrSize))
            b.feed(1)
            b.align('left')
          }
        } else if (rawVal) {
          alignText(`* ${rawVal} *`, entry.align || 'center')
        }
        break
      }
      case 'files_note': {
        if (entry.title) alignText(interpolateReceiptVariables(entry.title, data, thermal), entry.align || 'left')
        interpolateReceiptVariables(entry.content, data, thermal)
          .split('\n')
          .forEach((l) => alignText(l, entry.align || 'left'))
        break
      }
    }
  }

  // Image block present but raster failed — fall back to store logo.
  if (fallbackLogo && hasImageBlock && !logoPrinted) {
    await tryAppendEscPosLogo(b, fallbackLogo, paperSize, RECEIPT_LOGO_DEFAULT_WIDTH_PERCENT, 'center')
  }
}

export function resolveActiveCustomTemplate(
  receiptConfig?: { customTemplates?: CustomReceiptTemplate[]; activeCustomTemplateId?: string | null } | null
): CustomReceiptTemplate | null {
  const templates = receiptConfig?.customTemplates
  if (!templates?.length) return null
  return resolveActiveFromTemplates(templates, receiptConfig?.activeCustomTemplateId)
}
