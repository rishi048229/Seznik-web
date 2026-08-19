import type { Sale, SaleItem } from '@/types/sale.types'
import type { ReceiptConfig } from '@/types/settings.types'
import { EscPosBuilder } from './escpos'
import { compileReceiptTextLines } from './receiptEngine'

interface GenerateReceiptHTMLParams {
  sale: Sale
  receiptConfig?: Partial<ReceiptConfig> | null
  businessName?: string
  businessAddress?: string
  customerName?: string
  width?: '50mm' | '80mm' | '210mm'
  logoURL?: string
  settingsTaxRate?: number   // from settings.taxConfig.taxRate
  settingsTaxName?: string   // from settings.taxConfig.taxName
}

// ─── Number to words (Indian system) ─────────────────────────────────────────
function numberToWords(amount: number): string {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
    'Seventeen', 'Eighteen', 'Nineteen']
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']

  const toWords = (n: number): string => {
    if (n === 0) return ''
    if (n < 20) return ones[n] + ' '
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '') + ' '
    if (n < 1000) return ones[Math.floor(n / 100)] + ' Hundred ' + toWords(n % 100)
    if (n < 100000) return toWords(Math.floor(n / 1000)) + 'Thousand ' + toWords(n % 1000)
    if (n < 10000000) return toWords(Math.floor(n / 100000)) + 'Lakh ' + toWords(n % 100000)
    return toWords(Math.floor(n / 10000000)) + 'Crore ' + toWords(n % 10000000)
  }

  const rupees = Math.floor(amount)
  const paise = Math.round((amount - rupees) * 100)
  let result = toWords(rupees).trim()
  if (paise > 0) result += ` and ${toWords(paise).trim()} Paise`
  return 'Indian Rupee ' + result + ' Only'
}

export const generateReceiptHTML = ({
  sale,
  receiptConfig,
  businessName,
  businessAddress,
  customerName,
  width = '50mm',
  logoURL,
  settingsTaxRate,
  settingsTaxName,
}: GenerateReceiptHTMLParams): string => {
  const companyName = receiptConfig?.companyName || businessName || 'Your Company'
  const companyAddress = receiptConfig?.address || businessAddress || ''
  const companyPhone = receiptConfig?.phone || ''
  const companyGSTIN = receiptConfig?.gstin || ''
  const footerMessage = receiptConfig?.footerMessage || 'Thank you for your purchase!'

  const saleItems = sale.items ?? []
  const dateRaw = sale.createdAt as unknown as { toDate?: () => Date } | string | number | undefined
  const dateObj = typeof dateRaw === 'object' && dateRaw?.toDate ? dateRaw.toDate() : (typeof dateRaw === 'string' || typeof dateRaw === 'number') ? new Date(dateRaw) : new Date()


  const dateStr = dateObj.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const dueDateStr = dateStr // same day unless terms differ

  const methodLabel =
    sale.paymentMethod === 'cash' ? 'Cash Sale'
      : sale.paymentMethod === 'card' ? 'Card'
        : sale.paymentMethod === 'upi' ? 'UPI'
          : 'Credit'

  const isThermal = width === '50mm' || width === '80mm'

  const is80mm = width === '80mm'

  const totalTax = sale.totalTax || 0
  const taxableAmount = saleItems.reduce(
    (sum, item) => sum + (item.sellingPrice * item.quantity - (item.discount || 0)),
    0
  )
  const uniqueItemTaxRates = Array.from(new Set(saleItems.map(item => item.taxRate || 0).filter(rate => rate > 0)))
  const hasMixedTaxRates = uniqueItemTaxRates.length > 1
  const inferredTaxRate = taxableAmount > 0 ? (totalTax / taxableAmount) * 100 : 0
  const effectiveTaxRate = hasMixedTaxRates
    ? inferredTaxRate
    : (saleItems[0]?.taxRate ?? inferredTaxRate ?? settingsTaxRate ?? 0)
  const effectiveTaxName = settingsTaxName || 'GST'

  const formatTaxRate = (rate: number): string => {
    if (!rate || isNaN(rate)) return '0'
    const rounded = Math.round(rate * 100) / 100
    return rounded.toString()
  }

  const showTaxBreakdown = receiptConfig?.showTaxBreakdown ?? true

  // ─── Font sizes ──────────────────────────────────────────────────────────
  // Thermal: 58mm vs 80mm vs A4
  const headerFS = is80mm ? '17px' : isThermal ? '15px' : '20px'
  const baseFS = is80mm ? '13px' : isThermal ? '12px' : '14px'
  const smallFS = is80mm ? '11px' : isThermal ? '10px' : '13px'
  const tinyFS = is80mm ? '10px' : isThermal ? '9px' : '11px'
  const totalFS = is80mm ? '14px' : isThermal ? '12px' : '17px'

  // ─── Separators ──────────────────────────────────────────────────────────
  const sep = `<div style="border-top:1px dashed #000;margin:${isThermal ? '2px' : '3px'} 0;"></div>`
  const sepS = `<div style="border-top:2px solid #000;margin:${isThermal ? '2px' : '3px'} 0;"></div>`

  // ══════════════════════════════════════════════════════════════════════════
  // A4 INVOICE HTML
  // ══════════════════════════════════════════════════════════════════════════
  const effectiveLogo = (receiptConfig?.showLogo ?? true) ? (logoURL || receiptConfig?.logoURL || '') : ''
  const effectivePaymentQR = (receiptConfig?.showPaymentQR ?? false) ? (receiptConfig?.paymentQrURL || '') : ''

  if (!isThermal) {
    // Items table rows for A4 — larger font sizes to fill A4 page
    const a4ItemRows = saleItems.map((item: SaleItem, index: number) => {
      const lineSubtotal = item.sellingPrice * item.quantity
      const itemRate = item.taxRate || effectiveTaxRate
      const igstAmt = item.taxAmount || (lineSubtotal * (itemRate / 100))
      const baseAmt = lineSubtotal + (showTaxBreakdown ? igstAmt : 0) - (item.discount || 0)

      if (!showTaxBreakdown) {
        return `
        <tr style="border-bottom:1px solid #e5e7eb;">
          <td style="padding:10px 12px;font-size:14px;text-align:center;">${index + 1}</td>
          <td style="padding:10px 12px;font-size:14px;">
            <div style="font-weight:700;">${item.productName}</div>
          </td>
          <td style="padding:10px 12px;font-size:14px;text-align:center;">---</td>
          <td style="padding:10px 12px;font-size:14px;text-align:center;">${item.quantity}<br/><span style="font-size:11px;color:#6b7280;">pcs</span></td>
          <td style="padding:10px 12px;font-size:14px;text-align:right;">${item.sellingPrice.toFixed(2)}</td>
          <td style="padding:10px 12px;font-size:14px;font-weight:700;text-align:right;">${baseAmt.toFixed(2)}</td>
        </tr>`
      }

      return `
        <tr style="border-bottom:1px solid #e5e7eb;">
          <td style="padding:10px 12px;font-size:14px;text-align:center;">${index + 1}</td>
          <td style="padding:10px 12px;font-size:14px;">
            <div style="font-weight:700;">
              ${item.productName}
              ${item.priceIncludesGst ? '<span style="font-size:11px;color:#1e3a8a;font-weight:bold;margin-left:6px;">[Incl. GST]</span>' : (item.taxRate && item.taxRate > 0) ? '<span style="font-size:11px;color:#d97706;font-weight:bold;margin-left:6px;">[+GST Excl.]</span>' : ''}
            </div>
          </td>
          <td style="padding:10px 12px;font-size:14px;text-align:center;">---</td>
          <td style="padding:10px 12px;font-size:14px;text-align:center;">${item.quantity}<br/><span style="font-size:11px;color:#6b7280;">pcs</span></td>
          <td style="padding:10px 12px;font-size:14px;text-align:right;">${item.sellingPrice.toFixed(2)}</td>
          <td style="padding:10px 12px;font-size:14px;text-align:center;">${formatTaxRate(itemRate)}%</td>
          <td style="padding:10px 12px;font-size:14px;text-align:right;">${igstAmt.toFixed(2)}</td>
          <td style="padding:10px 12px;font-size:14px;font-weight:700;text-align:right;">${baseAmt.toFixed(2)}</td>
        </tr>`
    }).join('')

    const totalInWords = numberToWords(sale.grandTotal)
    const paymentMade = sale.amountPaid || 0
    const balanceDue = Math.max(0, sale.grandTotal - paymentMade)
    const invoiceTitle = showTaxBreakdown ? 'TAX INVOICE' : 'INVOICE'

    return `
<div style="font-family:Arial,sans-serif;color:#000;width:100%;min-height:267mm;box-sizing:border-box;border:1px solid #374151;padding:0;">

  <!-- ── HEADER ── -->
  <div style="display:flex;justify-content:space-between;align-items:center;padding:18px 24px;background:#f8fafc;border-bottom:2px solid #374151;">
    <div>
      ${effectiveLogo ? `<img src="${effectiveLogo}" alt="Logo" style="max-height:55px;max-width:180px;object-fit:contain;margin-bottom:6px;display:block;" />` : ''}
      <div style="font-size:22px;font-weight:900;color:#1e3a8a;">${companyName}</div>
      ${companyAddress ? `<div style="font-size:12px;color:#4b5563;margin-top:2px;">${companyAddress}</div>` : ''}
      ${companyPhone ? `<div style="font-size:12px;color:#4b5563;">Phone: ${companyPhone}</div>` : ''}
      ${companyGSTIN ? `<div style="font-size:12px;font-weight:700;color:#1e3a8a;">GSTIN: ${companyGSTIN}</div>` : ''}
    </div>
    <div style="text-align:right;">
      <div style="font-size:26px;font-weight:900;color:#1e3a8a;letter-spacing:1px;">${invoiceTitle}</div>
      <div style="font-size:14px;font-weight:700;margin-top:4px;"># ${sale.invoiceNumber || '---'}</div>
      <div style="font-size:12px;color:#6b7280;margin-top:2px;">Date: ${dateStr}</div>
      <div style="font-size:12px;color:#6b7280;">Due Date: ${dueDateStr}</div>
    </div>
  </div>

  <!-- ── BILL TO & SHIP TO ── -->
  <div style="display:flex;border-bottom:1px solid #e5e7eb;background:#fff;">
    <div style="flex:1;padding:14px 18px;border-right:1px solid #e5e7eb;">
      <div style="font-size:13px;font-weight:700;text-transform:uppercase;margin-bottom:5px;color:#374151;">Bill To</div>
      <div style="font-size:15px;font-weight:700;">${customerName || 'Walk-in Customer'}</div>
    </div>
    <div style="flex:1;padding:14px 18px;">
      <div style="font-size:13px;font-weight:700;text-transform:uppercase;margin-bottom:5px;color:#374151;">Ship To</div>
      <div style="font-size:15px;font-weight:700;">${customerName || 'Walk-in Customer'}</div>
    </div>
  </div>

  <!-- ── ITEMS TABLE ── -->
  <table style="width:100%;border-collapse:collapse;">
    <thead>
      <tr style="background:#1e3a8a;color:#fff;">
        <th style="padding:10px 12px;text-align:center;font-size:13px;font-weight:700;">#</th>
        <th style="padding:10px 12px;text-align:left;font-size:13px;font-weight:700;">Item &amp; Description</th>
        <th style="padding:10px 12px;text-align:center;font-size:13px;font-weight:700;">HSN/SAC</th>
        <th style="padding:10px 12px;text-align:center;font-size:13px;font-weight:700;">Qty</th>
        <th style="padding:10px 12px;text-align:right;font-size:13px;font-weight:700;">Rate</th>
        ${showTaxBreakdown ? `
        <th colspan="2" style="padding:10px 12px;text-align:center;font-size:13px;font-weight:700;border-left:1px solid rgba(255,255,255,0.3);">IGST</th>
        ` : ''}
        <th style="padding:10px 12px;text-align:right;font-size:13px;font-weight:700;">${showTaxBreakdown ? 'Base Amount' : 'Amount'}</th>
      </tr>
      ${showTaxBreakdown ? `
      <tr style="background:#1e3a8a;color:#fff;">
        <th colspan="5" style="padding:2px;"></th>
        <th style="padding:5px 12px;text-align:center;font-size:12px;border-left:1px solid rgba(255,255,255,0.3);">%</th>
        <th style="padding:5px 12px;text-align:right;font-size:12px;">Amt</th>
        <th style="padding:2px;"></th>
      </tr>` : ''}
    </thead>
    <tbody>
      ${a4ItemRows}
    </tbody>
  </table>

  <!-- ── TOTALS + WORDS ── -->
  <div style="display:flex;border-top:2px solid #374151;border-bottom:1px solid #374151;">
    <!-- Left: words + notes + payment QR -->
    <div style="flex:1;padding:10px 14px;border-right:1px solid #374151;">
      <div style="font-size:11px;font-weight:600;color:#374151;margin-bottom:4px;">Total In Words</div>
      <div style="font-size:12px;font-weight:700;font-style:italic;">${totalInWords}</div>
      ${footerMessage ? `<div style="font-size:11px;margin-top:8px;color:#374151;"><span style="font-weight:600;">Notes</span><br/>${footerMessage}</div>` : ''}
      ${effectivePaymentQR ? `
      <div style="margin-top:12px;padding-top:8px;border-top:1px dashed #cbd5e1;">
        <div style="font-size:11px;font-weight:700;color:#1e3a8a;margin-bottom:4px;">Scan &amp; Pay via UPI / QR:</div>
        <img src="${effectivePaymentQR}" alt="Payment QR" style="width:110px;height:110px;object-fit:contain;display:block;" />
      </div>` : ''}
    </div>
    <!-- Right: summary -->
    <div style="width:260px;flex-shrink:0;padding:10px 14px;">
      <div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid #e5e7eb;">
        <span style="font-size:12px;color:#6b7280;">Sub Total</span>
        <span style="font-size:12px;font-weight:600;">${sale.subtotal.toFixed(2)}</span>
      </div>
      ${(showTaxBreakdown && totalTax > 0) ? `
      <div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid #e5e7eb;">
        <span style="font-size:12px;color:#6b7280;">${effectiveTaxName} (${formatTaxRate(effectiveTaxRate)}%)</span>
        <span style="font-size:12px;">${totalTax.toFixed(2)}</span>
      </div>` : ''}
      ${sale.totalDiscount > 0 ? `
      <div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid #e5e7eb;">
        <span style="font-size:12px;color:#6b7280;">Discount</span>
        <span style="font-size:12px;color:#dc2626;">(-) ${sale.totalDiscount.toFixed(2)}</span>
      </div>` : ''}
      <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:2px solid #374151;">
        <span style="font-size:13px;font-weight:900;">Total</span>
        <span style="font-size:13px;font-weight:900;">&#x20B9;${sale.grandTotal.toFixed(2)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid #e5e7eb;">
        <span style="font-size:12px;color:#6b7280;">Payment Made</span>
        <span style="font-size:12px;color:#dc2626;">(-) ${paymentMade.toFixed(2)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;padding:5px 0;">
        <span style="font-size:13px;font-weight:900;">Balance Due</span>
        <span style="font-size:13px;font-weight:900;">&#x20B9;${balanceDue.toFixed(2)}</span>
      </div>
    </div>
  </div>

  <!-- ── SIGNATURE BLOCK ── -->
  <div style="display:flex;border-bottom:1px solid #374151;">
    <div style="flex:1;padding:14px;border-right:1px solid #374151;">
      <!-- empty left -->
    </div>
    <div style="width:260px;flex-shrink:0;padding:14px;text-align:center;">
      <div style="font-size:12px;font-weight:700;color:#1e3a8a;margin-bottom:4px;">${companyName}</div>
      <div style="height:55px;"></div>
      <div style="font-size:12px;font-weight:700;color:#1e3a8a;">PARTNER</div>
      <div style="height:30px;"></div>
    </div>
  </div>

  <!-- ── TERMS AND CONDITIONS ── -->
  ${(receiptConfig?.termsLine1 || receiptConfig?.termsLine2 || receiptConfig?.termsLine3) ? `
  <div style="padding:10px 14px;background:#f9fafb;">
    <div style="font-size:11px;font-weight:700;color:#1e3a8a;margin-bottom:4px;">Terms &amp; Conditions</div>
    ${receiptConfig?.termsLine1 ? `<div style="font-size:11px;color:#374151;margin-bottom:3px;">${receiptConfig.termsLine1}</div>` : ''}
    ${receiptConfig?.termsLine2 ? `<div style="font-size:11px;color:#374151;margin-bottom:3px;">${receiptConfig.termsLine2}</div>` : ''}
    ${receiptConfig?.termsLine3 ? `<div style="font-size:11px;color:#374151;">${receiptConfig.termsLine3}</div>` : ''}
  </div>` : ''}

</div>`
  }

  // ══════════════════════════════════════════════════════════════════════════
  // THERMAL (58 mm / 80 mm) RECEIPT HTML (Uses column layout engine)
  // ══════════════════════════════════════════════════════════════════════════
  const paperSizeKey = width === '80mm' ? '80mm' : '58mm'
  const textLines = compileReceiptTextLines({
    sale,
    receiptConfig,
    businessName,
    businessAddress,
    businessPhone: receiptConfig?.phone,
    businessGSTIN: receiptConfig?.gstin,
    customerName,
    paperSize: paperSizeKey,
    pricesIncludeGst: true,
  })

  const rawLinesHtml = textLines.map(l => l.replace(/ /g, '&nbsp;')).join('<br/>')

  return `
  <div style="
    font-family:'Courier New',Courier,monospace;
    font-size:${smallFS};
    font-weight:700;
    line-height:1.25;
    color:#000;
    width:100%;
    max-width:100%;
    padding:0;
    box-sizing:border-box;
    white-space:pre;
    text-align:left;
    overflow:hidden;
  ">
${effectiveLogo ? `<div style="text-align:center;margin-bottom:6px;padding-bottom:4px;"><img src="${effectiveLogo}" alt="Logo" style="max-height:48px;max-width:160px;object-fit:contain;margin:0 auto;display:block;" /></div>` : ''}
${rawLinesHtml}
${effectivePaymentQR ? `<div style="text-align:center;margin-top:8px;padding:6px 0;border-top:1px dashed #000;"><div style="font-size:${tinyFS};font-weight:900;margin-bottom:4px;">SCAN TO PAY (UPI / QR)</div><img src="${effectivePaymentQR}" alt="Payment QR" style="width:120px;height:120px;object-fit:contain;margin:0 auto;display:block;" /></div>` : ''}
  </div>`
}

// ─────────────────────────────────────────────────────────────────────────────
// printReceipt
// ─────────────────────────────────────────────────────────────────────────────
export const printReceipt = (
  receiptHTML: string,
  width: '50mm' | '80mm' | '210mm' = '50mm',
  title = 'Receipt',
  onDone?: () => void,
) => {
  const isThermal = width === '50mm' || width === '80mm'
  const paperWidth = width === '80mm' ? '80mm' : width === '50mm' ? '72mm' : 'A4'
  const pageMargin = width === '80mm' ? '2mm 2mm 10mm 2mm' : isThermal ? '2mm 1mm 10mm 1mm' : '12mm 15mm'

  const fullHTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <style>
    @page {
      size: ${paperWidth} auto;
      margin: ${pageMargin};
    }
    @media print {
      @page { size: ${paperWidth} auto; margin: ${pageMargin}; }
      html, body { width: 100%; margin: 0; padding: 0; }
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: ${isThermal ? '2px' : '0'};
      width: 100%;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    #receipt { width: 100%; margin: 0; padding: 0; }
  </style>
</head>
<body>
  <div id="receipt">${receiptHTML}</div>
</body>
</html>`

  const existing = document.getElementById('receipt-iframe')
  if (existing) existing.remove()

  const iframe = document.createElement('iframe')
  iframe.id = 'receipt-iframe'
  iframe.style.cssText =
    'position:absolute;left:-9999px;top:-9999px;width:1px;height:1px;border:none;visibility:hidden'
  document.body.appendChild(iframe)

  iframe.onload = () => {
    setTimeout(() => {
      try {
        iframe.contentWindow?.focus()
        iframe.contentWindow?.print()
      } finally {
        setTimeout(() => {
          iframe.remove()
          onDone?.()
        }, 2000)
      }
    }, 300)
  }

  iframe.srcdoc = fullHTML
}

// ─────────────────────────────────────────────────────────────────────────────
// generateReceiptEscPos — same thermal receipt content as the 50mm HTML
// template above, but as raw ESC/POS bytes for direct Bluetooth printing.
// ─────────────────────────────────────────────────────────────────────────────
interface GenerateReceiptEscPosParams {
  sale: Sale
  receiptConfig?: Partial<ReceiptConfig> | null
  paperSize?: '58mm' | '80mm'
  businessName?: string
  businessAddress?: string
  customerName?: string
  settingsTaxRate?: number
}

export const generateReceiptEscPos = ({
  sale,
  receiptConfig,
  paperSize = '58mm',
  businessName,
  businessAddress,
  customerName,
}: GenerateReceiptEscPosParams): Uint8Array => {
  const textLines = compileReceiptTextLines({
    sale,
    receiptConfig,
    businessName,
    businessAddress,
    businessPhone: receiptConfig?.phone,
    businessGSTIN: receiptConfig?.gstin,
    customerName,
    paperSize,
    pricesIncludeGst: true,
  })

  const b = new EscPosBuilder()
  b.init(paperSize)

  textLines.forEach(line => {
    b.line(line)
  })

  b.feed(2)
  b.cut()

  return b.toBytes()
}