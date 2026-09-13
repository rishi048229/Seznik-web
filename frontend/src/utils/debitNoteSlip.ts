import type { PurchaseReturn } from '@/types/purchaseReturn.types'
import type { Purchase } from '@/types/purchase.types'
import type { UserSettings } from '@/types/settings.types'
import { formatINR } from './currency'
import { EscPosBuilder, toPrinterSafeText } from './escpos'

/**
 * Word wraps text into lines of at most maxWidth characters without cutting words in the middle.
 */
export function wrapText(text: string, maxWidth: number): string[] {
  if (!text) return []
  const clean = text.trim()
  if (clean.length <= maxWidth) return [clean]

  const words = clean.split(/\s+/)
  const lines: string[] = []
  let currentLine = ''

  for (const word of words) {
    if (!currentLine) {
      if (word.length <= maxWidth) {
        currentLine = word
      } else {
        // Hard-break words longer than maxWidth
        for (let i = 0; i < word.length; i += maxWidth) {
          const slice = word.slice(i, i + maxWidth)
          if (i + maxWidth >= word.length) {
            currentLine = slice
          } else {
            lines.push(slice)
          }
        }
      }
    } else if (currentLine.length + 1 + word.length <= maxWidth) {
      currentLine += ' ' + word
    } else {
      lines.push(currentLine)
      if (word.length <= maxWidth) {
        currentLine = word
      } else {
        currentLine = ''
        for (let i = 0; i < word.length; i += maxWidth) {
          const slice = word.slice(i, i + maxWidth)
          if (i + maxWidth >= word.length) {
            currentLine = slice
          } else {
            lines.push(slice)
          }
        }
      }
    }
  }
  if (currentLine) lines.push(currentLine)
  return lines
}

export function generateDebitNoteSlipHTML(
  purchaseReturn: PurchaseReturn,
  purchase: Purchase,
  settings?: Partial<UserSettings> | null,
  width: '50mm' | '80mm' | '210mm' = '50mm'
): string {
  const isThermal = width === '50mm' || width === '80mm'
  const businessName = settings?.businessName || 'SEZNIK RETAIL'
  const businessAddress = settings?.businessAddress || ''
  const businessPhone = settings?.businessPhone || ''
  const businessGSTIN = settings?.businessGSTIN || ''
  const returnDate = new Date(purchaseReturn.createdAt || Date.now()).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
  const origDate = new Date(purchase.createdAt || Date.now()).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })

  const supplierName = purchaseReturn.supplier?.name || purchase.supplier?.name || 'Supplier'
  const supplierAddress = (purchaseReturn.supplier as any)?.address || (purchase.supplier as any)?.address || ''
  const supplierPhone = purchaseReturn.supplier?.phone || purchase.supplier?.phone || ''
  const supplierGSTIN = purchaseReturn.supplier?.gstin || purchase.supplier?.gstin || ''

  // Determine Full vs Partial Return
  const totalOrigQty = Array.isArray(purchase.items)
    ? purchase.items.reduce((s, i) => s + (Number(i.quantity) || 0), 0)
    : 0
  const totalReturnQty = Array.isArray(purchaseReturn.items)
    ? purchaseReturn.items.reduce((s, i) => s + (Number(i.quantity) || 0), 0)
    : 0
  const isFullReturn = purchase.returnStatus === 'full' || (totalOrigQty > 0 && totalReturnQty >= totalOrigQty)
  const returnStatusLabel = isFullReturn ? 'FULL RETURN' : 'PARTIAL RETURN'

  if (isThermal) {
    const is58mm = width === '50mm'
    const maxWidth = is58mm ? '48mm' : '72mm'
    const fontSize = is58mm ? '10.5px' : '12px'

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Debit Note - ${purchaseReturn.returnNumber}</title>
        <style>
          @page {
            margin: 0;
            size: ${width === '80mm' ? '80mm auto' : '58mm auto'};
          }
          * {
            box-sizing: border-box;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Courier New", monospace;
            font-size: ${fontSize};
            line-height: 1.35;
            color: #000;
            background: #fff;
            margin: 0 auto;
            padding: 8px 4px 18px 4px;
            width: ${maxWidth};
            max-width: 100%;
            word-wrap: break-word;
            overflow-wrap: break-word;
          }
          .text-center { text-align: center; }
          .text-right { text-align: right; }
          .font-bold { font-weight: 700; }
          .border-b { border-bottom: 1px dashed #000; }
          .border-t { border-top: 1px dashed #000; }
          .border-solid { border-top: 1px solid #000; border-bottom: 1px solid #000; }
          .py-1 { padding-top: 3px; padding-bottom: 3px; }
          .my-1 { margin-top: 4px; margin-bottom: 4px; }
          .my-2 { margin-top: 6px; margin-bottom: 6px; }
          table { width: 100%; border-collapse: collapse; table-layout: fixed; }
          td, th { padding: 2px 0; vertical-align: top; word-break: break-word; overflow-wrap: break-word; }
          .w-item { width: 55%; text-align: left; }
          .w-qty { width: 15%; text-align: center; }
          .w-amt { width: 30%; text-align: right; }
        </style>
      </head>
      <body>
        <div class="text-center font-bold" style="font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; word-break: break-word;">${businessName}</div>
        ${businessAddress ? `<div class="text-center" style="font-size: 9.5px; color: #333; margin-top: 1px; word-break: break-word; white-space: normal; line-height: 1.3;">${businessAddress}</div>` : ''}
        ${businessPhone ? `<div class="text-center" style="font-size: 9.5px; word-break: break-word;">Ph: ${businessPhone}</div>` : ''}
        ${businessGSTIN ? `<div class="text-center" style="font-size: 9.5px; word-break: break-word;">GSTIN: ${businessGSTIN}</div>` : ''}
        
        <div class="border-solid my-2 py-1 text-center font-bold" style="font-size: 11px; letter-spacing: 0.5px;">
          ** DEBIT NOTE / ${returnStatusLabel} **
        </div>

        <table>
          <tr>
            <td style="width: 35%;">DN No:</td>
            <td class="text-right font-bold" style="width: 65%; font-size: 11px;">${purchaseReturn.returnNumber}</td>
          </tr>
          <tr>
            <td>Status:</td>
            <td class="text-right font-bold" style="color: #000;">[ ${returnStatusLabel} ]</td>
          </tr>
          <tr>
            <td>Date:</td>
            <td class="text-right">${returnDate}</td>
          </tr>
          <tr>
            <td>Ref Purchase:</td>
            <td class="text-right">#${purchase.invoiceNumber || '—'}</td>
          </tr>
          <tr>
            <td style="vertical-align: top;">Supplier:</td>
            <td class="text-right font-bold" style="word-break: break-word; white-space: normal;">${supplierName}</td>
          </tr>
          ${supplierAddress ? `
          <tr>
            <td style="vertical-align: top;">Address:</td>
            <td class="text-right" style="word-break: break-word; white-space: normal; font-size: 9.5px; color: #333;">${supplierAddress}</td>
          </tr>` : ''}
          ${supplierPhone ? `<tr><td>Phone:</td><td class="text-right">${supplierPhone}</td></tr>` : ''}
          ${supplierGSTIN ? `<tr><td>GSTIN:</td><td class="text-right">${supplierGSTIN}</td></tr>` : ''}
          <tr>
            <td>Settlement:</td>
            <td class="text-right font-bold" style="text-transform: uppercase;">${(purchaseReturn.settlementMethod || 'cash').replace(/_/g, ' ')}</td>
          </tr>
          ${purchaseReturn.reason ? `<tr><td>Reason:</td><td class="text-right" style="text-transform: capitalize;">${purchaseReturn.reason.replace(/_/g, ' ')}</td></tr>` : ''}
        </table>

        <div class="border-b my-2"></div>
        <table>
          <thead>
            <tr class="font-bold border-b">
              <th class="w-item">Item</th>
              <th class="w-qty">Qty</th>
              <th class="w-amt">Debit</th>
            </tr>
          </thead>
          <tbody>
            ${(purchaseReturn.items || [])
              .map(
                (item) => `
              <tr>
                <td class="w-item font-bold">${item.productName}</td>
                <td class="w-qty">${item.quantity}</td>
                <td class="w-amt font-bold">${formatINR(Number(item.refundAmount || 0))}</td>
              </tr>
            `
              )
              .join('')}
          </tbody>
        </table>

        <div class="border-t my-2"></div>
        <table>
          <tr>
            <td>Taxable Reversed:</td>
            <td class="text-right">${formatINR(Number(purchaseReturn.subtotal || 0))}</td>
          </tr>
          <tr>
            <td>ITC Reversal:</td>
            <td class="text-right">${formatINR(Number(purchaseReturn.totalTax || 0))}</td>
          </tr>
          <tr class="font-bold border-t border-b" style="font-size: 12px;">
            <td class="py-1">TOTAL DEBIT AMOUNT:</td>
            <td class="text-right py-1">${formatINR(Number(purchaseReturn.refundAmount || 0))}</td>
          </tr>
        </table>

        <div class="text-center" style="font-size: 9px; margin-top: 10px; line-height: 1.3;">
          Status: <strong>${returnStatusLabel}</strong><br>
          Retain this Debit Note slip for supplier payable adjustment.<br>
          Thank you!
        </div>
      </body>
      </html>
    `
  }

  // Full A4 Page
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Debit Note - ${purchaseReturn.returnNumber}</title>
      <style>
        @page { size: A4 portrait; margin: 15mm; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          color: #1e293b;
          background: #fff;
          margin: 0;
          padding: 0;
          font-size: 13px;
        }
        .header { display: flex; justify-content: space-between; border-bottom: 2px solid #e2e8f0; padding-bottom: 16px; margin-bottom: 20px; }
        .title { font-size: 24px; font-weight: 800; color: #0f172a; }
        .subtitle { font-size: 14px; font-weight: 600; color: #2563eb; text-transform: uppercase; letter-spacing: 1px; }
        .badge { display: inline-block; padding: 4px 8px; font-size: 11px; font-weight: 700; border-radius: 6px; text-transform: uppercase; margin-top: 4px; }
        .badge-full { background: #fee2e2; color: #dc2626; border: 1px solid #fca5a5; }
        .badge-partial { background: #fef3c7; color: #d97706; border: 1px solid #fcd34d; }
        .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 24px; }
        .card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
        th { background: #0f172a; color: #fff; text-align: left; padding: 10px 12px; font-size: 12px; }
        td { padding: 10px 12px; border-bottom: 1px solid #e2e8f0; }
        .totals-container { display: flex; justify-content: flex-end; }
        .totals-box { width: 320px; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 16px; }
        .totals-row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 13px; }
        .totals-row.grand { font-size: 16px; font-weight: 800; color: #0f172a; border-top: 1px solid #94a3b8; margin-top: 8px; padding-top: 8px; }
        .footer { margin-top: 40px; text-align: center; color: #64748b; font-size: 11px; border-top: 1px solid #e2e8f0; padding-top: 16px; }
      </style>
    </head>
    <body>
      <div class="header">
        <div>
          <div class="title">${businessName}</div>
          ${businessAddress ? `<div style="color: #64748b; margin-top: 4px; word-break: break-word;">${businessAddress}</div>` : ''}
          ${businessPhone ? `<div style="color: #64748b;">Phone: ${businessPhone}</div>` : ''}
          ${businessGSTIN ? `<div style="font-weight: 600; margin-top: 4px;">GSTIN: ${businessGSTIN}</div>` : ''}
        </div>
        <div style="text-align: right;">
          <div class="subtitle">DEBIT NOTE / PURCHASE RETURN</div>
          <div style="font-size: 18px; font-weight: 700; color: #0f172a; margin-top: 4px;">#${purchaseReturn.returnNumber}</div>
          <span class="badge ${isFullReturn ? 'badge-full' : 'badge-partial'}">${returnStatusLabel}</span>
          <div style="color: #64748b; margin-top: 4px;">Date: ${returnDate}</div>
        </div>
      </div>

      <div class="meta-grid">
        <div class="card">
          <div style="font-weight: 700; color: #475569; margin-bottom: 6px; font-size: 11px; text-transform: uppercase;">Supplier Details</div>
          <div style="font-size: 14px; font-weight: 700; color: #0f172a;">${supplierName}</div>
          ${supplierAddress ? `<div style="color: #64748b; margin-top: 2px; word-break: break-word;">${supplierAddress}</div>` : ''}
          ${supplierPhone ? `<div style="color: #64748b; margin-top: 2px;">Phone: ${supplierPhone}</div>` : ''}
          ${supplierGSTIN ? `<div style="color: #64748b; margin-top: 2px;">GSTIN: ${supplierGSTIN}</div>` : ''}
        </div>
        <div class="card">
          <div style="font-weight: 700; color: #475569; margin-bottom: 6px; font-size: 11px; text-transform: uppercase;">Original Purchase Reference</div>
          <div style="font-size: 14px; font-weight: 700; color: #0f172a;">Purchase #${purchase.invoiceNumber || '—'}</div>
          <div style="color: #64748b; margin-top: 2px;">Purchase Date: ${origDate}</div>
          <div style="color: #64748b; margin-top: 2px;">Original Grand Total: ${formatINR(Number(purchase.grandTotal || 0))}</div>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Item Description</th>
            <th style="text-align: center;">Returned Qty</th>
            <th style="text-align: right;">Unit Cost</th>
            <th style="text-align: right;">GST Rate</th>
            <th style="text-align: right;">Taxable Reversed</th>
            <th style="text-align: right;">ITC Reversal</th>
            <th style="text-align: right;">Total Debit</th>
          </tr>
        </thead>
        <tbody>
          ${(purchaseReturn.items || [])
            .map(
              (item, idx) => `
            <tr>
              <td>${idx + 1}</td>
              <td style="font-weight: 600; word-break: break-word;">${item.productName}</td>
              <td style="text-align: center;">${item.quantity}</td>
              <td style="text-align: right;">${formatINR(Number(item.unitCost || 0))}</td>
              <td style="text-align: right;">${item.taxRate || 0}%</td>
              <td style="text-align: right;">${formatINR(Number(item.taxableAmount || 0))}</td>
              <td style="text-align: right;">${formatINR(Number(item.gstAmount || 0))}</td>
              <td style="text-align: right; font-weight: 700;">${formatINR(Number(item.refundAmount || 0))}</td>
            </tr>
          `
            )
            .join('')}
        </tbody>
      </table>

      <div class="totals-container">
        <div class="totals-box">
          <div class="totals-row">
            <span>Taxable Value Reversed:</span>
            <span>${formatINR(Number(purchaseReturn.subtotal || 0))}</span>
          </div>
          <div class="totals-row">
            <span>Input Tax Credit (ITC) Reversal:</span>
            <span>${formatINR(Number(purchaseReturn.totalTax || 0))}</span>
          </div>
          <div class="totals-row grand">
            <span>Net Debit Amount:</span>
            <span>${formatINR(Number(purchaseReturn.refundAmount || 0))}</span>
          </div>
          <div style="margin-top: 10px; font-size: 11px; color: #64748b;">
            Settlement Mode: <strong style="text-transform: uppercase; color: #0f172a;">${(purchaseReturn.settlementMethod || 'cash').replace(/_/g, ' ')}</strong>
          </div>
          ${purchaseReturn.reason ? `
          <div style="margin-top: 4px; font-size: 11px; color: #64748b;">
            Reason: <strong style="text-transform: capitalize; color: #0f172a;">${purchaseReturn.reason.replace(/_/g, ' ')}</strong>
          </div>` : ''}
        </div>
      </div>

      <div class="footer">
        Status: ${returnStatusLabel} • This is a computer-generated Debit Note / Purchase Return Slip.
      </div>
    </body>
    </html>
  `
}

/**
 * Generates raw ESC/POS command bytes for 58mm (32 cols) or 80mm (48 cols) direct thermal printers.
 */
export async function generateDebitNoteSlipEscPos(
  purchaseReturn: PurchaseReturn,
  purchase: Purchase,
  settings?: Partial<UserSettings> | null,
  paperSize: '58mm' | '80mm' = '58mm'
): Promise<Uint8Array> {
  const builder = new EscPosBuilder()
  builder.init(paperSize)

  const cols = paperSize === '80mm' ? 48 : 32
  const businessName = settings?.businessName || 'SEZNIK RETAIL'
  const businessAddress = settings?.businessAddress || ''
  const businessPhone = settings?.businessPhone || ''
  const businessGSTIN = settings?.businessGSTIN || ''

  const returnDate = new Date(purchaseReturn.createdAt || Date.now()).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })

  const supplierName = purchaseReturn.supplier?.name || purchase.supplier?.name || 'Supplier'
  const supplierAddress = (purchaseReturn.supplier as any)?.address || (purchase.supplier as any)?.address || ''
  const supplierPhone = purchaseReturn.supplier?.phone || purchase.supplier?.phone || ''
  const supplierGSTIN = purchaseReturn.supplier?.gstin || purchase.supplier?.gstin || ''

  const totalOrigQty = Array.isArray(purchase.items)
    ? purchase.items.reduce((s, i) => s + (Number(i.quantity) || 0), 0)
    : 0
  const totalReturnQty = Array.isArray(purchaseReturn.items)
    ? purchaseReturn.items.reduce((s, i) => s + (Number(i.quantity) || 0), 0)
    : 0
  const isFullReturn = purchase.returnStatus === 'full' || (totalOrigQty > 0 && totalReturnQty >= totalOrigQty)
  const returnStatusLabel = isFullReturn ? 'FULL RETURN' : 'PARTIAL RETURN'

  // Header - Business Details with multi-line word wrapping
  builder.align('center').bold(true).doubleHeight(true)
  const nameLines = wrapText(businessName, cols)
  for (const nl of nameLines) {
    builder.line(toPrinterSafeText(nl))
  }
  builder.doubleHeight(false).bold(false)

  if (businessAddress) {
    const addressLines = wrapText(businessAddress, cols)
    for (const al of addressLines) {
      builder.line(toPrinterSafeText(al))
    }
  }
  if (businessPhone) builder.line(`Ph: ${toPrinterSafeText(businessPhone)}`)
  if (businessGSTIN) builder.line(`GSTIN: ${toPrinterSafeText(businessGSTIN)}`)

  builder.hr(cols, '=')
  builder.bold(true).line(`** DEBIT NOTE (${returnStatusLabel}) **`)
  builder.bold(false).hr(cols, '=')

  // Metadata
  builder.align('left')
  builder.twoCol('DN No:', purchaseReturn.returnNumber || 'DN', cols)
  builder.twoCol('Return Type:', returnStatusLabel, cols)
  builder.twoCol('Date:', returnDate, cols)
  builder.twoCol('Ref Purchase:', `#${purchase.invoiceNumber || '—'}`, cols)

  const sLines = wrapText(supplierName, cols - 10)
  if (sLines.length <= 1) {
    builder.twoCol('Supplier:', sLines[0] || supplierName, cols)
  } else {
    builder.line('Supplier:')
    for (const sl of sLines) {
      builder.line(`  ${toPrinterSafeText(sl)}`)
    }
  }

  if (supplierAddress) {
    const saLines = wrapText(supplierAddress, cols - 4)
    builder.line('Address:')
    for (const sal of saLines) {
      builder.line(`  ${toPrinterSafeText(sal)}`)
    }
  }

  if (supplierPhone) {
    builder.twoCol('Phone:', supplierPhone, cols)
  }
  if (supplierGSTIN) {
    builder.twoCol('GSTIN:', supplierGSTIN, cols)
  }

  const settlement = (purchaseReturn.settlementMethod || 'cash').toUpperCase().replace(/_/g, ' ')
  builder.twoCol('Settlement:', settlement, cols)

  if (purchaseReturn.reason) {
    const reasonText = purchaseReturn.reason.replace(/_/g, ' ')
    const rLines = wrapText(reasonText, cols - 9)
    if (rLines.length <= 1) {
      builder.twoCol('Reason:', rLines[0] || reasonText, cols)
    } else {
      builder.line('Reason:')
      for (const rl of rLines) {
        builder.line(`  ${toPrinterSafeText(rl)}`)
      }
    }
  }

  builder.hr(cols, '-')

  // Items Header
  const itemColW = cols === 32 ? 16 : 24
  const qtyColW = cols === 32 ? 4 : 6
  const amtColW = cols === 32 ? 12 : 18
  builder.bold(true).threeCol('Item', 'Qty', 'Debit', itemColW, qtyColW, amtColW).bold(false)
  builder.hr(cols, '-')

  // Line items
  for (const item of purchaseReturn.items || []) {
    const name = toPrinterSafeText(item.productName || 'Item')
    const qty = String(item.quantity ?? 1)
    const refund = `Rs.${Number(item.refundAmount || 0).toFixed(2)}`
    const pLines = wrapText(name, itemColW)

    builder.threeCol(pLines[0] || name, qty, refund, itemColW, qtyColW, amtColW)
    for (let i = 1; i < pLines.length; i++) {
      builder.line(pLines[i])
    }
  }

  builder.hr(cols, '-')

  // Totals
  const subtotalStr = `Rs.${Number(purchaseReturn.subtotal || 0).toFixed(2)}`
  const taxStr = `Rs.${Number(purchaseReturn.totalTax || 0).toFixed(2)}`
  const refundStr = `Rs.${Number(purchaseReturn.refundAmount || 0).toFixed(2)}`

  builder.twoCol('Taxable Reversed:', subtotalStr, cols)
  builder.twoCol('ITC Reversal:', taxStr, cols)

  builder.hr(cols, '=')
  builder.bold(true).doubleHeight(true)
  builder.twoCol('TOTAL DEBIT:', refundStr, cols)
  builder.doubleHeight(false).bold(false)
  builder.hr(cols, '=')

  builder.align('center')
  builder.newline(1)
  builder.line(`Status: ${returnStatusLabel}`)
  builder.line('Retain this slip for records.')
  builder.feedAndCut(4)

  return builder.toBytes()
}

