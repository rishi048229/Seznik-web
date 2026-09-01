import type { Sale, SaleItem } from '@/types/sale.types'
import type { ReceiptConfig } from '@/types/settings.types'
import { EscPosBuilder } from './escpos'
import { calculateReceiptTotals, formatIndianNumber, getCols } from './receiptEngine'
import { printReceipt } from './receipt'

export interface RestaurantBillContext {
  sale: Sale
  receiptConfig?: Partial<ReceiptConfig> | null
  businessName?: string
  businessAddress?: string
  tableName?: string | null
  waiterName?: string | null
  orderType?: string | null
  kotNumber?: number | null
  customerName?: string | null
  paperSize?: '58mm' | '80mm'
}

const isExtraLine = (name: string) => {
  const n = name.toLowerCase()
  return n.includes('service charge') || n.includes('room charge') || n.includes('ac charge') || n.includes('non-ac')
}

const orderTypeTitle = (type?: string | null) => {
  if (type === 'takeaway') return 'TAKEAWAY'
  if (type === 'delivery') return 'DELIVERY'
  if (type === 'dine_in') return 'DINE-IN'
  return type ? type.replace(/_/g, ' ').toUpperCase() : ''
}

const esc = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const money = (n: number) => formatIndianNumber(n)

const splitItems = (items: SaleItem[]) => ({
  food: items.filter((it) => !isExtraLine(it.productName)),
  extras: items.filter((it) => isExtraLine(it.productName)),
})

const taxRows = (sale: Sale, gstin?: string) => {
  const totals = calculateReceiptTotals(sale, gstin, false)
  const rows: Array<{ label: string; value: number }> = []
  if (totals.totalDiscount > 0) rows.push({ label: 'Discount', value: -totals.totalDiscount })
  if (totals.docTitle === 'TAX INVOICE' && (totals.totalTax > 0 || sale.totalTax > 0)) {
    if (totals.taxGroups.length > 0) {
      totals.taxGroups.forEach((g) => {
        const half = Math.round((g.taxRate / 2) * 100) / 100
        if (g.cgst > 0) rows.push({ label: `CGST ${half}%`, value: g.cgst })
        if (g.sgst > 0) rows.push({ label: `SGST ${half}%`, value: g.sgst })
      })
    } else if (sale.totalTax > 0) {
      const half = Number((sale.totalTax / 2).toFixed(2))
      rows.push({ label: 'CGST', value: half })
      rows.push({ label: 'SGST', value: Number((sale.totalTax - half).toFixed(2)) })
    }
  } else if (sale.totalTax > 0) {
    rows.push({ label: 'Tax', value: sale.totalTax })
  }
  return { totals, rows }
}

/** Guest / restaurant check — prices + GST summary. Kitchen KOT is a different slip. */
export const generateRestaurantBillHTML = (ctx: RestaurantBillContext): string => {
  const company = ctx.receiptConfig?.companyName || ctx.businessName || 'Restaurant'
  const address = ctx.receiptConfig?.address || ctx.businessAddress || ''
  const phone = ctx.receiptConfig?.phone || ''
  const gstin = ctx.receiptConfig?.gstin || ''
  const items = ctx.sale.items ?? []
  const { food, extras } = splitItems(items)
  const { totals, rows } = taxRows(ctx.sale, gstin)
  const pay =
    ctx.sale.paymentMethod === 'upi' ? 'UPI' : ctx.sale.paymentMethod === 'card' ? 'Card' : ctx.sale.paymentMethod === 'credit' ? 'Credit' : 'Cash'
  const when = new Date(ctx.sale.createdAt).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
  const typeLabel = orderTypeTitle(ctx.orderType)
  const footer = ctx.receiptConfig?.footerMessage || 'Thank you. Please visit again.'

  const itemRow = (it: SaleItem) => {
    const amt = it.sellingPrice * it.quantity - (it.discount || 0)
    return `<tr>
      <td style="padding:3px 0;vertical-align:top;">${esc(it.productName)}<div style="font-size:10px;opacity:.75;">${it.quantity} x ${money(it.sellingPrice)}</div></td>
      <td style="padding:3px 0;text-align:right;vertical-align:top;white-space:nowrap;font-variant-numeric:tabular-nums;">${money(amt)}</td>
    </tr>`
  }

  const sumRow = (label: string, value: string, strong = false) =>
    `<tr>
      <td style="padding:2px 0;${strong ? 'font-weight:900;' : ''}">${esc(label)}</td>
      <td style="padding:2px 0;text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums;${strong ? 'font-weight:900;' : ''}">${esc(value)}</td>
    </tr>`

  return `<div style="font-family:'Courier New',Courier,ui-monospace,monospace;color:#000;width:100%;font-size:12px;line-height:1.3;">
    <div style="text-align:center;font-weight:900;font-size:16px;letter-spacing:0.4px;">${esc(company)}</div>
    ${address ? `<div style="text-align:center;font-size:10px;">${esc(address)}</div>` : ''}
    ${phone ? `<div style="text-align:center;font-size:10px;">Ph: ${esc(phone)}</div>` : ''}
    ${gstin ? `<div style="text-align:center;font-size:10px;font-weight:700;">GSTIN: ${esc(gstin)}</div>` : ''}
    <div style="border-top:2px solid #000;margin:8px 0 6px;"></div>
    <div style="text-align:center;font-weight:900;letter-spacing:1px;">${esc(totals.docTitle === 'TAX INVOICE' ? 'TAX INVOICE' : 'GUEST BILL')}</div>
    ${typeLabel ? `<div style="text-align:center;font-size:11px;font-weight:700;margin-top:2px;">${esc(typeLabel)}</div>` : ''}
    <div style="border-top:1px dashed #000;margin:6px 0;"></div>
    <table style="width:100%;border-collapse:collapse;font-size:11px;">
      ${sumRow('Bill No', ctx.sale.invoiceNumber || '—')}
      ${ctx.kotNumber != null ? sumRow('KOT No', String(ctx.kotNumber)) : ''}
      ${ctx.tableName ? sumRow('Table', ctx.tableName) : ''}
      ${ctx.waiterName ? sumRow('Waiter', ctx.waiterName) : ''}
      ${ctx.customerName ? sumRow('Guest', ctx.customerName) : ''}
      ${sumRow('Date', when)}
    </table>
    <div style="border-top:1px dashed #000;margin:6px 0;"></div>
    <table style="width:100%;border-collapse:collapse;font-size:12px;">
      <tr>
        <td style="font-weight:800;padding-bottom:4px;border-bottom:1px solid #000;">Item</td>
        <td style="font-weight:800;padding-bottom:4px;border-bottom:1px solid #000;text-align:right;">Amt</td>
      </tr>
      ${(food.length ? food : items).map(itemRow).join('')}
      ${extras.map(itemRow).join('')}
    </table>
    <div style="border-top:1px dashed #000;margin:6px 0;"></div>
    <table style="width:100%;border-collapse:collapse;font-size:12px;">
      ${sumRow('Sub Total', money(ctx.sale.subtotal || totals.subTotal))}
      ${rows.map((r) => sumRow(r.label, money(r.value))).join('')}
      <tr><td colspan="2" style="border-top:2px solid #000;padding-top:4px;"></td></tr>
      ${sumRow('TOTAL', `Rs.${money(ctx.sale.grandTotal || totals.finalGrandTotal)}`, true)}
      ${sumRow(`Paid (${pay})`, money(ctx.sale.amountPaid || ctx.sale.grandTotal || 0))}
      ${ctx.sale.changeReturned > 0 ? sumRow('Change', money(ctx.sale.changeReturned)) : ''}
    </table>
    <div style="border-top:2px solid #000;margin:8px 0 4px;"></div>
    <div style="text-align:center;font-size:10px;">${esc(footer)}</div>
    <div style="text-align:center;font-size:10px;font-weight:700;margin-top:4px;">-- Guest Copy --</div>
  </div>`
}

export const generateRestaurantBillEscPos = (ctx: RestaurantBillContext): Uint8Array => {
  const paperSize = ctx.paperSize || '58mm'
  const cols = getCols(paperSize)
  const company = ctx.receiptConfig?.companyName || ctx.businessName || 'Restaurant'
  const address = ctx.receiptConfig?.address || ctx.businessAddress || ''
  const phone = ctx.receiptConfig?.phone || ''
  const gstin = ctx.receiptConfig?.gstin || ''
  const items = ctx.sale.items ?? []
  const { food, extras } = splitItems(items)
  const { totals, rows } = taxRows(ctx.sale, gstin)
  const pay =
    ctx.sale.paymentMethod === 'upi' ? 'UPI' : ctx.sale.paymentMethod === 'card' ? 'Card' : ctx.sale.paymentMethod === 'credit' ? 'Credit' : 'Cash'
  const when = new Date(ctx.sale.createdAt).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
  const b = new EscPosBuilder()
  b.init(paperSize)
  b.align('center')
  b.bold(true)
  b.line(company)
  b.bold(false)
  if (address) b.line(address)
  if (phone) b.line(`Ph: ${phone}`)
  if (gstin) b.line(`GSTIN: ${gstin}`)
  b.hr(cols, '=')
  b.bold(true)
  b.line(totals.docTitle === 'TAX INVOICE' ? 'TAX INVOICE' : 'GUEST BILL')
  const typeLabel = orderTypeTitle(ctx.orderType)
  if (typeLabel) b.line(typeLabel)
  b.bold(false)
  b.hr(cols, '-')
  b.align('left')
  b.twoCol('Bill No', ctx.sale.invoiceNumber || '-', cols)
  if (ctx.kotNumber != null) b.twoCol('KOT No', String(ctx.kotNumber), cols)
  if (ctx.tableName) b.twoCol('Table', ctx.tableName, cols)
  if (ctx.waiterName) b.twoCol('Waiter', ctx.waiterName, cols)
  if (ctx.customerName) b.twoCol('Guest', ctx.customerName, cols)
  b.twoCol('Date', when, cols)
  b.hr(cols, '-')
  b.twoCol('Item', 'Amt', cols)
  b.hr(cols, '-')
  const printItem = (it: SaleItem) => {
    const amt = it.sellingPrice * it.quantity - (it.discount || 0)
    b.line(it.productName)
    b.twoCol(`  ${it.quantity} x ${money(it.sellingPrice)}`, money(amt), cols)
  }
  ;(food.length ? food : items).forEach(printItem)
  extras.forEach(printItem)
  b.hr(cols, '-')
  b.twoCol('Sub Total', money(ctx.sale.subtotal || totals.subTotal), cols)
  rows.forEach((r) => b.twoCol(r.label, money(r.value), cols))
  b.hr(cols, '=')
  b.bold(true)
  b.twoCol('TOTAL', `Rs.${money(ctx.sale.grandTotal || totals.finalGrandTotal)}`, cols)
  b.bold(false)
  b.hr(cols, '=')
  b.twoCol(`Paid (${pay})`, money(ctx.sale.amountPaid || ctx.sale.grandTotal || 0), cols)
  if (ctx.sale.changeReturned > 0) b.twoCol('Change', money(ctx.sale.changeReturned), cols)
  b.hr(cols, '-')
  b.align('center')
  b.line(ctx.receiptConfig?.footerMessage || 'Thank you. Please visit again.')
  b.line('-- Guest Copy --')
  b.feed(2)
  b.cut()
  return b.toBytes()
}

export const printRestaurantBill = (ctx: RestaurantBillContext) => {
  const paperSize = ctx.paperSize || '58mm'
  const width: '50mm' | '80mm' = paperSize === '80mm' ? '80mm' : '50mm'
  printReceipt(generateRestaurantBillHTML(ctx), width, ctx.sale.invoiceNumber || 'Guest Bill')
}
