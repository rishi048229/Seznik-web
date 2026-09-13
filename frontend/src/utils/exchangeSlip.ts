import type { SaleExchange, SaleReturn, Sale } from '@/types/sale.types'
import type { UserSettings } from '@/types/settings.types'
import { formatINR } from './currency'
import { EscPosBuilder, toPrinterSafeText } from './escpos'

export function generateExchangeSlipHTML(
  exchange: SaleExchange,
  originalSale: Sale,
  saleReturn: SaleReturn,
  newSale: Sale,
  settings?: Partial<UserSettings> | null,
  width: '50mm' | '80mm' | '210mm' = '50mm'
): string {
  const isThermal = width === '50mm' || width === '80mm'
  const businessName = settings?.businessName || 'SEZNIK RETAIL'
  const businessAddress = settings?.businessAddress || ''
  const businessPhone = settings?.businessPhone || ''
  const businessGSTIN = settings?.businessGSTIN || ''
  const exchangeDate = new Date(exchange.createdAt).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  const customerName =
    saleReturn.customer?.name ||
    (originalSale as any).customerName ||
    (originalSale as any).customer?.name ||
    'Walk-in Customer'
  const customerPhone =
    saleReturn.customer?.phone ||
    (originalSale as any).customerPhone ||
    (originalSale as any).customer?.phone ||
    ''

  const isEven = Math.abs(exchange.differenceAmount) < 0.01
  const isUpgrade = exchange.differenceAmount > 0
  const isDowngrade = exchange.differenceAmount < 0

  if (isThermal) {
    const is58mm = width === '50mm'
    const maxWidth = is58mm ? '48mm' : '72mm'
    const fontSize = is58mm ? '10.5px' : '12px'

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Exchange Voucher - ${exchange.exchangeNumber}</title>
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
            padding: 6px 4px 16px 4px;
            width: ${maxWidth};
            max-width: 100%;
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
          td, th { padding: 2px 0; vertical-align: top; word-break: break-word; }
          .w-item { width: 55%; text-align: left; }
          .w-qty { width: 15%; text-align: center; }
          .w-amt { width: 30%; text-align: right; }
        </style>
      </head>
      <body>
        <div class="text-center font-bold" style="font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">${businessName}</div>
        ${businessAddress ? `<div class="text-center" style="font-size: 9.5px; color: #333; margin-top: 1px;">${businessAddress}</div>` : ''}
        ${businessPhone ? `<div class="text-center" style="font-size: 9.5px;">Ph: ${businessPhone}</div>` : ''}
        ${businessGSTIN ? `<div class="text-center" style="font-size: 9.5px;">GSTIN: ${businessGSTIN}</div>` : ''}
        
        <div class="border-solid my-2 py-1 text-center font-bold" style="font-size: 11px; letter-spacing: 0.5px;">
          ** EXCHANGE VOUCHER **
        </div>

        <table>
          <tr>
            <td style="width: 35%;">Exchange #:</td>
            <td class="text-right font-bold" style="width: 65%; font-size: 11px;">${exchange.exchangeNumber}</td>
          </tr>
          <tr>
            <td>Date:</td>
            <td class="text-right">${exchangeDate}</td>
          </tr>
          <tr>
            <td>Original Inv:</td>
            <td class="text-right">#${originalSale.invoiceNumber}</td>
          </tr>
          <tr>
            <td>Return Note:</td>
            <td class="text-right">${saleReturn.returnNumber}</td>
          </tr>
          <tr>
            <td>New Invoice:</td>
            <td class="text-right">#${newSale.invoiceNumber}</td>
          </tr>
          <tr>
            <td>Customer:</td>
            <td class="text-right">${customerName}</td>
          </tr>
          ${customerPhone ? `<tr><td>Phone:</td><td class="text-right">${customerPhone}</td></tr>` : ''}
          <tr>
            <td>Settlement:</td>
            <td class="text-right font-bold" style="text-transform: uppercase;">${exchange.settlementMethod.replace('_', ' ')}</td>
          </tr>
          ${exchange.reason ? `<tr><td>Reason:</td><td class="text-right" style="text-transform: capitalize;">${exchange.reason.replace(/_/g, ' ')}</td></tr>` : ''}
        </table>

        <!-- Returned Items -->
        <div class="border-b my-2"></div>
        <div class="font-bold" style="font-size: 10px; margin-bottom: 2px;">RETURNED ITEMS (INWARD)</div>
        <table>
          <thead>
            <tr class="font-bold border-b">
              <th class="w-item">Item</th>
              <th class="w-qty">Qty</th>
              <th class="w-amt">Credit</th>
            </tr>
          </thead>
          <tbody>
            ${saleReturn.items
              .map(
                (item) => `
              <tr>
                <td class="w-item font-bold">${item.productName}</td>
                <td class="w-qty">${item.quantity}</td>
                <td class="w-amt font-bold">${formatINR(item.refundAmount)}</td>
              </tr>
            `
              )
              .join('')}
          </tbody>
        </table>

        <!-- Replacement Items -->
        <div class="border-b my-2"></div>
        <div class="font-bold" style="font-size: 10px; margin-bottom: 2px;">NEW REPLACEMENTS (OUTWARD)</div>
        <table>
          <thead>
            <tr class="font-bold border-b">
              <th class="w-item">Item</th>
              <th class="w-qty">Qty</th>
              <th class="w-amt">Price</th>
            </tr>
          </thead>
          <tbody>
            ${newSale.items
              .map(
                (item: any) => `
              <tr>
                <td class="w-item font-bold">${item.productName || item.name}</td>
                <td class="w-qty">${item.quantity}</td>
                <td class="w-amt font-bold">${formatINR(item.total || item.sellingPrice * item.quantity)}</td>
              </tr>
            `
              )
              .join('')}
          </tbody>
        </table>

        <!-- Settlement Computation -->
        <div class="border-t my-2"></div>
        <table>
          <tr>
            <td>New Items Total:</td>
            <td class="text-right">${formatINR(newSale.grandTotal)}</td>
          </tr>
          <tr>
            <td>Less Return Credit:</td>
            <td class="text-right">-${formatINR(saleReturn.refundAmount)}</td>
          </tr>
          <tr class="font-bold border-t border-b" style="font-size: 11.5px;">
            <td class="py-1">${isEven ? 'NET DIFFERENCE:' : isUpgrade ? 'CUSTOMER PAYS:' : 'STORE REFUNDS:'}</td>
            <td class="text-right py-1">${formatINR(Math.abs(exchange.differenceAmount))}</td>
          </tr>
        </table>

        <div class="text-center" style="font-size: 9px; margin-top: 10px; line-height: 1.3;">
          Retain this slip for warranty & exchange records.<br>
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
      <title>Exchange Voucher - ${exchange.exchangeNumber}</title>
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
        .subtitle { font-size: 14px; font-weight: 600; color: #0284c7; text-transform: uppercase; letter-spacing: 1px; }
        .meta-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; margin-bottom: 24px; }
        .card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        th { background: #0f172a; color: #fff; text-align: left; padding: 8px 12px; font-size: 12px; }
        td { padding: 8px 12px; border-bottom: 1px solid #e2e8f0; }
        .section-title { font-size: 14px; font-weight: 700; color: #0f172a; margin-bottom: 8px; margin-top: 16px; }
        .totals-container { display: flex; justify-content: flex-end; margin-top: 16px; }
        .totals-box { width: 340px; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 16px; }
        .totals-row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 13px; }
        .totals-row.grand { font-size: 16px; font-weight: 800; color: #0f172a; border-top: 1px solid #94a3b8; margin-top: 8px; padding-top: 8px; }
        .footer { margin-top: 40px; text-align: center; color: #64748b; font-size: 11px; border-top: 1px solid #e2e8f0; padding-top: 16px; }
      </style>
    </head>
    <body>
      <div class="header">
        <div>
          <div class="title">${businessName}</div>
          ${businessAddress ? `<div style="color: #64748b; margin-top: 4px;">${businessAddress}</div>` : ''}
          ${businessPhone ? `<div style="color: #64748b;">Phone: ${businessPhone}</div>` : ''}
          ${businessGSTIN ? `<div style="font-weight: 600; margin-top: 4px;">GSTIN: ${businessGSTIN}</div>` : ''}
        </div>
        <div style="text-align: right;">
          <div class="subtitle">EXCHANGE VOUCHER</div>
          <div style="font-size: 18px; font-weight: 700; color: #0f172a; margin-top: 4px;">#${exchange.exchangeNumber}</div>
          <div style="color: #64748b; margin-top: 4px;">Date: ${exchangeDate}</div>
        </div>
      </div>

      <div class="meta-grid">
        <div class="card">
          <div style="font-weight: 700; color: #475569; margin-bottom: 6px; font-size: 11px; text-transform: uppercase;">Customer Details</div>
          <div style="font-size: 14px; font-weight: 700; color: #0f172a;">${customerName}</div>
          ${customerPhone ? `<div style="color: #64748b; margin-top: 2px;">Phone: ${customerPhone}</div>` : ''}
        </div>
        <div class="card">
          <div style="font-weight: 700; color: #475569; margin-bottom: 6px; font-size: 11px; text-transform: uppercase;">Original Sale & Return</div>
          <div>Original Inv: <strong>#${originalSale.invoiceNumber}</strong></div>
          <div>Return Note: <strong>${saleReturn.returnNumber}</strong></div>
          <div>Return Credit: <strong>${formatINR(saleReturn.refundAmount)}</strong></div>
        </div>
        <div class="card">
          <div style="font-weight: 700; color: #475569; margin-bottom: 6px; font-size: 11px; text-transform: uppercase;">New Replacement Sale</div>
          <div>New Invoice: <strong>#${newSale.invoiceNumber}</strong></div>
          <div>New Grand Total: <strong>${formatINR(newSale.grandTotal)}</strong></div>
          <div>Settlement: <strong style="text-transform: uppercase;">${exchange.settlementMethod.replace('_', ' ')}</strong></div>
        </div>
      </div>

      <div class="section-title">1. Returned Items (Inward Leg)</div>
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Item Description</th>
            <th style="text-align: center;">Qty</th>
            <th style="text-align: right;">Unit Price</th>
            <th style="text-align: right;">GST Rate</th>
            <th style="text-align: right;">Return Credit Value</th>
          </tr>
        </thead>
        <tbody>
          ${saleReturn.items
            .map(
              (item, idx) => `
            <tr>
              <td>${idx + 1}</td>
              <td style="font-weight: 600;">${item.productName}</td>
              <td style="text-align: center;">${item.quantity}</td>
              <td style="text-align: right;">${formatINR(item.unitPrice)}</td>
              <td style="text-align: right;">${item.taxRate}%</td>
              <td style="text-align: right; font-weight: 700;">${formatINR(item.refundAmount)}</td>
            </tr>
          `
            )
            .join('')}
        </tbody>
      </table>

      <div class="section-title">2. Replacement Items (Outward Leg)</div>
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Item Description</th>
            <th style="text-align: center;">Qty</th>
            <th style="text-align: right;">Unit Price</th>
            <th style="text-align: right;">GST Rate</th>
            <th style="text-align: right;">Total Amount</th>
          </tr>
        </thead>
        <tbody>
          ${newSale.items
            .map(
              (item: any, idx: number) => `
            <tr>
              <td>${idx + 1}</td>
              <td style="font-weight: 600;">${item.productName || item.name}</td>
              <td style="text-align: center;">${item.quantity}</td>
              <td style="text-align: right;">${formatINR(item.unitPrice || item.sellingPrice)}</td>
              <td style="text-align: right;">${item.taxRate || 0}%</td>
              <td style="text-align: right; font-weight: 700;">${formatINR(item.total || item.sellingPrice * item.quantity)}</td>
            </tr>
          `
            )
            .join('')}
        </tbody>
      </table>

      <div class="totals-container">
        <div class="totals-box">
          <div class="totals-row">
            <span>New Sale Grand Total:</span>
            <span>${formatINR(newSale.grandTotal)}</span>
          </div>
          <div class="totals-row">
            <span>Less Return Credit:</span>
            <span>-${formatINR(saleReturn.refundAmount)}</span>
          </div>
          <div class="totals-row grand">
            <span>${isEven ? 'Net Difference:' : isUpgrade ? 'Customer Pays:' : 'Store Refunds:'}</span>
            <span>${formatINR(Math.abs(exchange.differenceAmount))}</span>
          </div>
          <div style="margin-top: 8px; font-size: 11px; color: #64748b;">
            Settlement Mode: <strong style="text-transform: uppercase; color: #0f172a;">${exchange.settlementMethod.replace('_', ' ')}</strong>
          </div>
        </div>
      </div>

      <div class="footer">
        This is a computer-generated Exchange Voucher.
      </div>
    </body>
    </html>
  `
}

/**
 * Generates raw ESC/POS command bytes for 58mm (32 cols) or 80mm (48 cols) direct thermal printers.
 */
export async function generateExchangeSlipEscPos(
  exchange: SaleExchange,
  originalSale: Sale,
  saleReturn: SaleReturn,
  newSale: Sale,
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

  const exchangeDate = new Date(exchange.createdAt).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })

  const customerName =
    saleReturn.customer?.name ||
    (originalSale as any).customerName ||
    (originalSale as any).customer?.name ||
    'Walk-in'

  const isEven = Math.abs(exchange.differenceAmount) < 0.01
  const isUpgrade = exchange.differenceAmount > 0

  // Header
  builder.align('center').bold(true).doubleHeight(true).line(toPrinterSafeText(businessName))
  builder.doubleHeight(false).bold(false)

  if (businessAddress) builder.line(toPrinterSafeText(businessAddress.slice(0, cols)))
  if (businessPhone) builder.line(`Ph: ${toPrinterSafeText(businessPhone)}`)
  if (businessGSTIN) builder.line(`GSTIN: ${toPrinterSafeText(businessGSTIN)}`)

  builder.hr(cols, '=')
  builder.bold(true).line('** EXCHANGE VOUCHER **')
  builder.bold(false).hr(cols, '=')

  // Metadata
  builder.align('left')
  builder.twoCol('Exchange #:', exchange.exchangeNumber, cols)
  builder.twoCol('Date:', exchangeDate, cols)
  builder.twoCol('Orig Inv:', `#${originalSale.invoiceNumber}`, cols)
  builder.twoCol('Return Note:', saleReturn.returnNumber, cols)
  builder.twoCol('New Inv:', `#${newSale.invoiceNumber}`, cols)
  builder.twoCol('Customer:', customerName.slice(0, cols - 10), cols)
  builder.twoCol('Settlement:', exchange.settlementMethod.toUpperCase().replace('_', ' '), cols)

  builder.hr(cols, '-')

  // Return items
  builder.bold(true).line('RETURNED ITEMS:').bold(false)
  for (const item of saleReturn.items) {
    const name = toPrinterSafeText(item.productName)
    const qty = String(item.quantity)
    const refund = `Rs.${item.refundAmount.toFixed(2)}`
    if (cols === 32) {
      builder.threeCol(name.slice(0, 16), qty, refund, 16, 4, 12)
    } else {
      builder.threeCol(name.slice(0, 24), qty, refund, 24, 6, 18)
    }
  }

  builder.hr(cols, '-')

  // New items
  builder.bold(true).line('NEW REPLACEMENTS:').bold(false)
  for (const item of newSale.items as any[]) {
    const name = toPrinterSafeText(item.productName || item.name)
    const qty = String(item.quantity)
    const price = `Rs.${(item.total || item.sellingPrice * item.quantity).toFixed(2)}`
    if (cols === 32) {
      builder.threeCol(name.slice(0, 16), qty, price, 16, 4, 12)
    } else {
      builder.threeCol(name.slice(0, 24), qty, price, 24, 6, 18)
    }
  }

  builder.hr(cols, '-')

  // Totals
  builder.twoCol('New Items Total:', `Rs.${newSale.grandTotal.toFixed(2)}`, cols)
  builder.twoCol('Less Return Credit:', `-Rs.${saleReturn.refundAmount.toFixed(2)}`, cols)

  builder.hr(cols, '=')
  builder.bold(true).doubleHeight(true)
  const settlementLabel = isEven ? 'NET DIFFERENCE:' : isUpgrade ? 'CUSTOMER PAYS:' : 'STORE REFUNDS:'
  builder.twoCol(settlementLabel, `Rs.${Math.abs(exchange.differenceAmount).toFixed(2)}`, cols)
  builder.doubleHeight(false).bold(false)
  builder.hr(cols, '=')

  builder.align('center')
  builder.newline(1)
  builder.line('Retain this slip for warranty records.')
  builder.feedAndCut(4)

  return builder.toBytes()
}
