import type { Sale, SaleItem } from '@/types/sale.types'
import type { PrinterConfig, ReceiptConfig, UserSettings } from '@/types/settings.types'
import type { Product } from '@/types/product.types'
import { EscPosBuilder, rasterizeImageForEscPos } from './escpos'
import { compileReceiptTextLines } from './receiptEngine'
import { buildUpiPayLink, getUpiQrImageUrl } from './upiQr'
import { generateA4InvoiceHTML } from './a4Invoice'

export const resolveEffectiveReceiptConfig = (
  settings?: Partial<UserSettings> | null,
  overrides?: Partial<ReceiptConfig> | null
): ReceiptConfig => {
  const pConf = settings?.printerConfig
  const rConf = settings?.receiptConfig

  const merged: ReceiptConfig = {
    headerTitle: rConf?.headerTitle || 'TAX INVOICE',
    companyName: rConf?.companyName || settings?.businessName || '',
    address: rConf?.address || settings?.businessAddress || '',
    phone: rConf?.phone || settings?.businessPhone || '',
    gstin: rConf?.gstin || settings?.businessGSTIN || '',
    logoURL: rConf?.logoURL || settings?.businessLogoURL || '',
    footerMessage: rConf?.footerMessage || 'Thank you for your purchase!',
    termsLine1: rConf?.termsLine1 || '1. Goods once sold will not be taken back or exchanged',
    termsLine2: rConf?.termsLine2 || '2. All disputes are subject to local jurisdiction only',
    termsLine3: rConf?.termsLine3 || '',
    compactMode: rConf?.compactMode ?? false,
    showCompanyHeader: rConf?.showCompanyHeader ?? true,
    showAddress: rConf?.showAddress ?? true,
    showPhone: rConf?.showPhone ?? true,
    showGSTIN: rConf?.showGSTIN ?? true,
    showCustomerDetails: rConf?.showCustomerDetails ?? true,
    showInvoiceNoAndDate: rConf?.showInvoiceNoAndDate ?? true,
    showSubtotalDiscount: rConf?.showSubtotalDiscount ?? true,
    showTaxBreakdown: rConf?.showTaxBreakdown ?? true,
    showFooterMessage: rConf?.showFooterMessage ?? true,
    showTerms: rConf?.showTerms ?? true,
    showBarcode: rConf?.showBarcode ?? true,
    showLogo: rConf?.showLogo ?? pConf?.showLogo ?? true,
    showPaymentQR: rConf?.showPaymentQR ?? pConf?.invoiceShowPaymentQR ?? false,
    upiId: rConf?.upiId || '',
    paymentQrURL: rConf?.paymentQrURL || pConf?.paymentQrURL || '',
  }

  return { ...merged, ...(overrides || {}) }
}

export interface GenerateReceiptHTMLParams {
  sale: Sale
  receiptConfig?: Partial<ReceiptConfig> | null
  printerConfig?: Partial<PrinterConfig> | null
  businessName?: string
  businessAddress?: string
  customerName?: string
  customer?: { name?: string; phone?: string; address?: string; email?: string } | null
  width?: '50mm' | '80mm' | '210mm'
  logoURL?: string
  settingsTaxRate?: number
  settingsTaxName?: string
  dateLabel?: string
  customerPhone?: string
  products?: Array<Pick<Product, 'id' | 'sku' | 'unit' | 'expiryDate' | 'brand'>> | null
}

function formatDate(date: any): string {
  const dateObj = typeof date === 'object' && (date as any)?.toDate ? (date as any).toDate() : (typeof date === 'string' || typeof date === 'number') ? new Date(date) : new Date()
  return dateObj.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
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
  printerConfig,
  businessName,
  businessAddress,
  customerName,
  customer,
  width = '50mm',
  logoURL,
  settingsTaxRate,
  settingsTaxName,
  products,
  dateLabel,
  customerPhone,
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
  const paperWidth = width === '80mm' ? '80mm' : width === '50mm' ? '72mm' : 'A4'
  const pageMargin = width === '80mm' ? '2mm 2mm 8mm 2mm' : isThermal ? '2mm 1mm 8mm 1mm' : '10mm 12mm'

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
  const billTotal = Number(sale.grandTotal ?? (sale as any).finalTotal ?? (sale as any).total ?? 0)

  // Typography Tokens
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
  const isPaymentQrEnabled = receiptConfig?.showPaymentQR ?? false
  const effectivePaymentQR = isPaymentQrEnabled
    ? (receiptConfig?.upiId
        ? getUpiQrImageUrl({
            upiId: receiptConfig.upiId,
            payeeName: companyName,
            amount: billTotal,
            note: sale.invoiceNumber || 'Bill Payment',
          }, 180)
        : (receiptConfig?.paymentQrURL || ''))
    : ''

  if (!isThermal) {
    return generateA4InvoiceHTML({
      sale,
      receiptConfig,
      printerConfig,
      businessName,
      businessAddress,
      customerName,
      customer,
      logoURL: effectiveLogo,
      settingsTaxName,
      products,
      dateLabel,
    })
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
    customerPhone: customerPhone || customer?.phone,
    dateLabel,
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
${effectiveLogo ? `<div style="text-align:center;margin:0 auto 8px auto;padding-bottom:4px;border-bottom:1px dashed #000;display:block;"><img src="${effectiveLogo}" alt="Store Logo" style="max-height:56px;max-width:180px;object-fit:contain;margin:0 auto;display:block;" /></div>` : ''}
${rawLinesHtml}
${effectivePaymentQR ? `<div style="text-align:center;margin-top:10px;padding:6px 0;border-top:1px dashed #000;display:block;"><div style="font-size:${tinyFS};font-weight:900;margin-bottom:4px;letter-spacing:0.5px;">SCAN TO PAY &#x20B9;${billTotal.toFixed(2)} VIA UPI</div><img src="${effectivePaymentQR}" alt="Payment QR" style="width:130px;height:130px;object-fit:contain;margin:0 auto;display:block;" /></div>` : ''}
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
      img { max-width: 100% !important; display: block !important; visibility: visible !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
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
    img { -webkit-print-color-adjust: exact; print-color-adjust: exact; image-rendering: auto; }
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

  const executePrint = () => {
    try {
      iframe.contentWindow?.focus()
      iframe.contentWindow?.print()
    } finally {
      setTimeout(() => {
        iframe.remove()
        onDone?.()
      }, 2000)
    }
  }

  iframe.onload = () => {
    const doc = iframe.contentDocument || iframe.contentWindow?.document
    if (!doc) {
      setTimeout(executePrint, 400)
      return
    }

    const images = Array.from(doc.images || [])
    if (images.length === 0) {
      setTimeout(executePrint, 200)
      return
    }

    let remaining = images.length
    let printed = false
    const checkDone = () => {
      remaining--
      if (remaining <= 0 && !printed) {
        printed = true
        setTimeout(executePrint, 250)
      }
    }

    images.forEach(img => {
      if (img.complete && img.naturalHeight !== 0) {
        checkDone()
      } else {
        img.addEventListener('load', checkDone)
        img.addEventListener('error', checkDone)
      }
    })

    // Safeguard timeout in case image events don't fire
    setTimeout(() => {
      if (!printed) {
        printed = true
        executePrint()
      }
    }, 1500)
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
  customerPhone?: string
  dateLabel?: string
  settingsTaxRate?: number
}

export const generateReceiptEscPos = async ({
  sale,
  receiptConfig,
  paperSize = '58mm',
  businessName,
  businessAddress,
  customerName,
  customerPhone,
  dateLabel,
}: GenerateReceiptEscPosParams): Promise<Uint8Array> => {
  const textLines = compileReceiptTextLines({
    sale,
    receiptConfig,
    businessName,
    businessAddress,
    businessPhone: receiptConfig?.phone,
    businessGSTIN: receiptConfig?.gstin,
    customerName,
    customerPhone,
    dateLabel,
    paperSize,
    pricesIncludeGst: true,
  })

  const b = new EscPosBuilder()
  b.init(paperSize)

  // Store logo, rasterized to an actual high-contrast 1bpp bitmap.
  // Sized proportionally to ensure fast, continuous printing without printer buffer stalls.
  const logoSrc = (receiptConfig?.showLogo ?? true) ? (receiptConfig?.logoURL || '') : ''
  if (logoSrc) {
    const maxWidthDots = paperSize === '80mm' ? 320 : 224
    const maxHeightDots = paperSize === '80mm' ? 96 : 72
    const raster = await rasterizeImageForEscPos(logoSrc, maxWidthDots, maxHeightDots)
    if (raster) {
      b.align('center')
      b.image(raster.packed, raster.widthBytes, raster.heightDots)
      b.feed(1)
      b.align('left')
    }
  }

  textLines.forEach(line => {
    b.line(line)
  })

  // Payment QR Code on ESC/POS Bluetooth receipt. Prefers a real UPI ID
  // (proper VPA, e.g. "name@okhdfcbank") to build a correct upi://pay link with the exact bill amount.
  if (receiptConfig?.showPaymentQR && (receiptConfig?.upiId || receiptConfig?.paymentQrURL)) {
    const billTotal = Number(sale.grandTotal ?? (sale as any).finalTotal ?? (sale as any).total ?? 0)
    b.feed(1)
    b.align('center')
    b.bold(true)
    b.line(`SCAN TO PAY Rs.${billTotal.toFixed(2)}`)
    b.bold(false)
    const qrPayload = receiptConfig.upiId
      ? buildUpiPayLink({
          upiId: receiptConfig.upiId,
          payeeName: businessName || 'SEZNIK',
          amount: billTotal,
          note: sale.invoiceNumber || 'Bill Payment',
        })
      : receiptConfig.paymentQrURL!
    b.qr(qrPayload, paperSize === '80mm' ? 6 : 4)
  }

  b.feed(2)
  b.cut()

  return b.toBytes()
}