import type { SaleReturn, Sale } from '@/types/sale.types'
import type { UserSettings } from '@/types/settings.types'
import { formatINR } from './currency'
import { EscPosBuilder, toPrinterSafeText } from './escpos'
import { wrapText } from './debitNoteSlip'

export function generateReturnSlipHTML(
  saleReturn: SaleReturn,
  sale: Sale,
  settings?: Partial<UserSettings> | null,
  width: '50mm' | '80mm' | '210mm' = '50mm'
): string {
  const isThermal = width === '50mm' || width === '80mm'
  const businessName = settings?.businessName || 'SEZNIK RETAIL'
  const businessAddress = settings?.businessAddress || ''
  const businessPhone = settings?.businessPhone || ''
  const businessGSTIN = settings?.businessGSTIN || ''
  const returnDate = new Date(saleReturn.createdAt || Date.now()).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
  const origDate = new Date(sale.createdAt || Date.now()).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })

  const customerName = saleReturn.customer?.name || (sale as any).customerName || (sale as any).customer?.name || 'Walk-in Customer'
  const customerPhone = saleReturn.customer?.phone || (sale as any).customerPhone || (sale as any).customer?.phone || ''

  if (isThermal) {
    const is58mm = width === '50mm'
    const maxWidth = is58mm ? '48mm' : '72mm'
    const fontSize = is58mm ? '10.5px' : '12px'

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Credit Note - ${saleReturn.returnNumber}</title>
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
          ** RETURN SLIP / CREDIT NOTE **
        </div>

        <table>
          <tr>
            <td style="width: 35%;">CN No:</td>
            <td class="text-right font-bold" style="width: 65%; font-size: 11px;">${saleReturn.returnNumber}</td>
          </tr>
          <tr>
            <td>Date:</td>
            <td class="text-right">${returnDate}</td>
          </tr>
          <tr>
            <td>Ref Invoice:</td>
            <td class="text-right">#${sale.invoiceNumber || '—'}</td>
          </tr>
          <tr>
            <td style="vertical-align: top;">Customer:</td>
            <td class="text-right font-bold" style="word-break: break-word; white-space: normal;">${customerName}</td>
          </tr>
          ${customerPhone ? `<tr><td>Phone:</td><td class="text-right">${customerPhone}</td></tr>` : ''}
          <tr>
            <td>Refund Mode:</td>
            <td class="text-right font-bold" style="text-transform: uppercase;">${(saleReturn.refundMethod || 'cash').replace(/_/g, ' ')}</td>
          </tr>
          ${saleReturn.reason ? `<tr><td>Reason:</td><td class="text-right" style="text-transform: capitalize;">${saleReturn.reason.replace(/_/g, ' ')}</td></tr>` : ''}
        </table>

        <div class="border-b my-2"></div>
        <table>
          <thead>
            <tr class="font-bold border-b">
              <th class="w-item">Item</th>
              <th class="w-qty">Qty</th>
              <th class="w-amt">Refund</th>
            </tr>
          </thead>
          <tbody>
            ${(saleReturn.items || [])
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
            <td>Taxable Subtotal:</td>
            <td class="text-right">${formatINR(Number(saleReturn.subtotal || 0))}</td>
          </tr>
          <tr>
            <td>GST Reversal:</td>
            <td class="text-right">${formatINR(Number(saleReturn.totalTax || 0))}</td>
          </tr>
          ${
            (saleReturn.extraChargesRefunded || 0) > 0
              ? `<tr><td>Extra Charges Refund:</td><td class="text-right">${formatINR(Number(saleReturn.extraChargesRefunded || 0))}</td></tr>`
              : ''
          }
          <tr class="font-bold border-t border-b" style="font-size: 12px;">
            <td class="py-1">TOTAL REFUND:</td>
            <td class="text-right py-1">${formatINR(Number(saleReturn.refundAmount || 0))}</td>
          </tr>
        </table>

        <div class="text-center" style="font-size: 9px; margin-top: 10px; line-height: 1.3;">
          Retain this slip for credit/exchange records.<br>
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
      <title>Credit Note - ${saleReturn.returnNumber}</title>
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
        .subtitle { font-size: 14px; font-weight: 600; color: #dc2626; text-transform: uppercase; letter-spacing: 1px; }
        .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 24px; }
        .card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
        th { background: #0f172a; color: #fff; text-align: left; padding: 10px 12px; font-size: 12px; }
        td { padding: 10px 12px; border-bottom: 1px solid #e2e8f0; }
        .totals-container { display: flex; justify-content: flex-end; }
        .totals-box { width: 300px; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 16px; }
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
          <div class="subtitle">CREDIT NOTE / RETURN SLIP</div>
          <div style="font-size: 18px; font-weight: 700; color: #0f172a; margin-top: 4px;">#${saleReturn.returnNumber}</div>
          <div style="color: #64748b; margin-top: 4px;">Date: ${returnDate}</div>
        </div>
      </div>

      <div class="meta-grid">
        <div class="card">
          <div style="font-weight: 700; color: #475569; margin-bottom: 6px; font-size: 11px; text-transform: uppercase;">Customer Details</div>
          <div style="font-size: 14px; font-weight: 700; color: #0f172a;">${customerName}</div>
          ${customerPhone ? `<div style="color: #64748b; margin-top: 2px;">Phone: ${customerPhone}</div>` : ''}
        </div>
        <div class="card">
          <div style="font-weight: 700; color: #475569; margin-bottom: 6px; font-size: 11px; text-transform: uppercase;">Original Invoice Details</div>
          <div style="font-size: 14px; font-weight: 700; color: #0f172a;">Invoice #${sale.invoiceNumber || '—'}</div>
          <div style="color: #64748b; margin-top: 2px;">Invoice Date: ${origDate}</div>
          <div style="color: #64748b; margin-top: 2px;">Original Grand Total: ${formatINR(Number(sale.grandTotal || 0))}</div>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Item Description</th>
            <th style="text-align: center;">Returned Qty</th>
            <th style="text-align: right;">Unit Price</th>
            <th style="text-align: right;">GST Rate</th>
            <th style="text-align: right;">Taxable Value</th>
            <th style="text-align: right;">GST Amount</th>
            <th style="text-align: right;">Total Refund</th>
          </tr>
        </thead>
        <tbody>
          ${(saleReturn.items || [])
            .map(
              (item, idx) => `
            <tr>
              <td>${idx + 1}</td>
              <td style="font-weight: 600; word-break: break-word;">${item.productName}</td>
              <td style="text-align: center;">${item.quantity}</td>
              <td style="text-align: right;">${formatINR(Number(item.unitPrice || 0))}</td>
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
            <span>Taxable Subtotal:</span>
            <span>${formatINR(Number(saleReturn.subtotal || 0))}</span>
          </div>
          <div class="totals-row">
            <span>GST Output Tax Reversal:</span>
            <span>${formatINR(Number(saleReturn.totalTax || 0))}</span>
          </div>
          ${
            (saleReturn.extraChargesRefunded || 0) > 0
              ? `
          <div class="totals-row">
            <span>Extra Charges Refunded:</span>
            <span>${formatINR(Number(saleReturn.extraChargesRefunded || 0))}</span>
          </div>
          `
              : ''
          }
          <div class="totals-row grand">
            <span>Net Refund Amount:</span>
            <span>${formatINR(Number(saleReturn.refundAmount || 0))}</span>
          </div>
          <div style="margin-top: 10px; font-size: 11px; color: #64748b;">
            Settlement Mode: <strong style="text-transform: uppercase; color: #0f172a;">${(saleReturn.refundMethod || 'cash').replace(/_/g, ' ')}</strong>
          </div>
        </div>
      </div>

      <div class="footer">
        This is a computer-generated Credit Note / Return Slip.
      </div>
    </body>
    </html>
  `
}

/**
 * Generates raw ESC/POS command bytes for 58mm (32 cols) or 80mm (48 cols) direct thermal printers.
 */
export async function generateReturnSlipEscPos(
  saleReturn: SaleReturn,
  sale: Sale,
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

  const returnDate = new Date(saleReturn.createdAt || Date.now()).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })

  const customerName = saleReturn.customer?.name || (sale as any).customerName || (sale as any).customer?.name || 'Walk-in'

  // Header
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
  builder.bold(true).line('** RETURN SLIP / CREDIT NOTE **')
  builder.bold(false).hr(cols, '=')

  // Metadata
  builder.align('left')
  builder.twoCol('CN No:', saleReturn.returnNumber || 'CN', cols)
  builder.twoCol('Date:', returnDate, cols)
  builder.twoCol('Ref Invoice:', `#${sale.invoiceNumber || '—'}`, cols)

  const cLines = wrapText(customerName, cols - 10)
  if (cLines.length <= 1) {
    builder.twoCol('Customer:', cLines[0] || customerName, cols)
  } else {
    builder.line('Customer:')
    for (const cl of cLines) {
      builder.line(`  ${toPrinterSafeText(cl)}`)
    }
  }

  const refundMethod = (saleReturn.refundMethod || 'cash').toUpperCase().replace(/_/g, ' ')
  builder.twoCol('Refund Mode:', refundMethod, cols)

  if (saleReturn.reason) {
    const reasonText = saleReturn.reason.replace(/_/g, ' ')
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
  builder.bold(true).threeCol('Item', 'Qty', 'Refund', itemColW, qtyColW, amtColW).bold(false)
  builder.hr(cols, '-')

  // Line items
  for (const item of saleReturn.items || []) {
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
  const subtotalStr = `Rs.${Number(saleReturn.subtotal || 0).toFixed(2)}`
  const taxStr = `Rs.${Number(saleReturn.totalTax || 0).toFixed(2)}`
  const refundStr = `Rs.${Number(saleReturn.refundAmount || 0).toFixed(2)}`

  builder.twoCol('Taxable Subtotal:', subtotalStr, cols)
  builder.twoCol('GST Reversal:', taxStr, cols)
  if ((saleReturn.extraChargesRefunded || 0) > 0) {
    builder.twoCol('Extra Charges Refund:', `Rs.${Number(saleReturn.extraChargesRefunded || 0).toFixed(2)}`, cols)
  }

  builder.hr(cols, '=')
  builder.bold(true).doubleHeight(true)
  builder.twoCol('TOTAL REFUND:', refundStr, cols)
  builder.doubleHeight(false).bold(false)
  builder.hr(cols, '=')

  builder.align('center')
  builder.newline(1)
  builder.line('Retain this slip for records.')
  builder.feedAndCut(4)

  return builder.toBytes()
}
