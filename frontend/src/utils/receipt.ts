import type { Sale, SaleItem } from '@/types/sale.types'
import type { ReceiptConfig, UserSettings } from '@/types/settings.types'
import { EscPosBuilder, rasterizeImageForEscPos } from './escpos'
import { compileReceiptTextLines, getCols } from './receiptEngine'
import {
  appendCustomTemplateToEscPos,
  compileCustomReceiptHtml,
  compileCustomReceiptTextLines,
  resolveActiveCustomTemplate,
  saleToReceiptContext,
} from './customReceiptEngine'
import type { CustomReceiptTemplate } from '@/types/customReceipt'
import { buildUpiPayLink, getUpiQrImageUrl, isValidUpiVpa } from './upiQr'
import { resolveStoreLogoUrl, prefetchPrintableLogoSrc, isBrowserLoadableImageSrc, preferPrintableSrc, inlineHtmlImageSources } from './receiptLogo'
import { ensureTemplateHasLogoBlock } from './ensureReceiptTemplates'
import { resolveReceiptPrintGst, type GstBreakdownStyle } from '@/constants/gstBilling'
import { gstSummaryFromCart } from '@/utils/gst'

function escapeHtmlAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
}

function thermalReceiptContainerStyle(paperSize: '58mm' | '80mm', fontSize: string): string {
  return [
    "font-family:'Courier New',Courier,monospace",
    `font-size:${fontSize}`,
    'font-weight:400',
    'line-height:1.3',
    'color:#000',
    'width:100%',
    'max-width:100%',
    'padding:0',
    'box-sizing:border-box',
    'text-align:left',
    'overflow:hidden',
  ].join(';')
}

function receiptLogoImgHtml(
  src: string | undefined,
  maxHeightPx: number,
  maxWidthPx: number,
  align: 'left' | 'center' | 'right' = 'center'
): string {
  if (!isBrowserLoadableImageSrc(src)) return ''
  const escaped = escapeHtmlAttr(src!.trim())
  const textAlign = align === 'left' ? 'left' : align === 'right' ? 'right' : 'center'
  return `<div style="text-align:${textAlign};margin:0 auto 8px auto;padding-bottom:4px;border-bottom:1px dashed #000;display:block;overflow:visible;"><img src="${escaped}" alt="Store Logo" style="max-height:${maxHeightPx}px;max-width:${maxWidthPx}px;width:auto;height:auto;object-fit:contain;margin:0 auto;display:block;" /></div>`
}

function withPrintableLogo(
  receiptConfig: Partial<ReceiptConfig> | null | undefined,
  printableLogo?: string
): Partial<ReceiptConfig> | null | undefined {
  if (!printableLogo) return receiptConfig
  const next: Partial<ReceiptConfig> = { ...(receiptConfig || {}), logoURL: printableLogo }
  if (Array.isArray(next.customTemplates)) {
    next.customTemplates = next.customTemplates.map((t) => ensureTemplateHasLogoBlock(t, printableLogo))
  }
  return next
}

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
    logoURL: resolveStoreLogoUrl(rConf, settings?.businessLogoURL) || '',
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
    showPaymentQR: rConf?.showPaymentQR ?? pConf?.invoiceShowPaymentQR ?? Boolean((rConf?.upiId || settings?.upiId || '').trim()),
    upiId: rConf?.upiId || settings?.upiId || '',
    paymentQrURL: rConf?.paymentQrURL || pConf?.paymentQrURL || '',
    customTemplates: rConf?.customTemplates,
    activeCustomTemplateId: rConf?.activeCustomTemplateId ?? null,
    templateId: rConf?.templateId,
    enableBillQrCode: rConf?.enableBillQrCode,
  }

  const withOverrides = { ...merged, ...(overrides || {}) }
  const printGst = resolveReceiptPrintGst(settings?.invoiceConfig, withOverrides)
  withOverrides.showTaxBreakdown = printGst.showTaxBreakdown
  return withOverrides
}

export function getReceiptPrintGstOptions(
  invoiceConfig: unknown,
  receiptConfig?: Partial<ReceiptConfig> | null
) {
  return resolveReceiptPrintGst(invoiceConfig, receiptConfig)
}

export interface GenerateReceiptHTMLParams {
  sale: Sale
  receiptConfig?: Partial<ReceiptConfig> | null
  businessName?: string
  businessAddress?: string
  customerName?: string
  width?: '50mm' | '80mm' | '210mm'
  logoURL?: string
  settingsTaxRate?: number
  settingsTaxName?: string
  invoiceConfig?: unknown
  templateOverride?: CustomReceiptTemplate
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
  businessName,
  businessAddress,
  customerName,
  width = '50mm',
  logoURL,
  settingsTaxRate,
  settingsTaxName,
  invoiceConfig,
  templateOverride,
}: GenerateReceiptHTMLParams): string => {
  const printGst = getReceiptPrintGstOptions(invoiceConfig, receiptConfig)
  const effectiveConfig = {
    ...receiptConfig,
    showTaxBreakdown: printGst.showTaxBreakdown,
  }
  const gstStyle = printGst.gstStyle
  const itemWiseGst = printGst.itemWiseGst
  const companyName = effectiveConfig?.companyName || businessName || 'Your Company'
  const companyAddress = effectiveConfig?.address || businessAddress || ''
  const companyPhone = effectiveConfig?.phone || ''
  const companyGSTIN = effectiveConfig?.gstin || ''
  const footerMessage = effectiveConfig?.footerMessage || 'Thank you for your purchase!'

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

  const showTaxBreakdown = effectiveConfig?.showTaxBreakdown ?? true
  const lineDisc = saleItems.reduce((s, i) => s + (i.discount || 0), 0)
  const orderDisc = Math.max(0, (sale.totalDiscount || lineDisc) - lineDisc)
  const gstSummary = gstSummaryFromCart(
    saleItems.map((i) => ({
      sellingPrice: i.sellingPrice,
      quantity: i.quantity,
      discount: i.discount || 0,
      taxRate: i.taxRate || 0,
      priceIncludesGst: i.priceIncludesGst,
    })),
    orderDisc
  )
  const totalTax = sale.totalTax || gstSummary.totalGst || 0
  const uniqueItemTaxRates = Array.from(new Set(saleItems.map(item => item.taxRate || 0).filter(rate => rate > 0)))
  const hasMixedTaxRates = uniqueItemTaxRates.length > 1
  const taxableAmount = gstSummary.taxableValue || saleItems.reduce(
    (sum, item) => sum + (item.sellingPrice * item.quantity - (item.discount || 0)),
    0
  )
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
  const resolvedLogo = preferPrintableSrc(
    logoURL,
    resolveStoreLogoUrl(receiptConfig ?? undefined, logoURL),
    receiptConfig?.logoURL
  )
  const effectiveLogo = (effectiveConfig?.showLogo ?? true) && isBrowserLoadableImageSrc(resolvedLogo) ? resolvedLogo! : ''
  const isPaymentQrEnabled = effectiveConfig?.showPaymentQR ?? false
  const effectivePaymentQR = isPaymentQrEnabled
    ? (isValidUpiVpa(effectiveConfig?.upiId)
        ? getUpiQrImageUrl({
            upiId: effectiveConfig.upiId!,
            payeeName: companyName,
            amount: billTotal,
            note: sale.invoiceNumber || 'Bill Payment',
          }, 180)
        : (effectiveConfig?.paymentQrURL || ''))
    : ''

  const buildA4TaxSummaryHtml = (): string => {
    if (!showTaxBreakdown || totalTax <= 0) return ''
    if (gstStyle === 'compact') {
      return `
      <div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid #e5e7eb;">
        <span style="font-size:12px;color:#6b7280;">GST</span>
        <span style="font-size:12px;">${totalTax.toFixed(2)}</span>
      </div>`
    }
    if (gstStyle === 'slab_wise') {
      return gstSummary.slabs
        .filter((s) => s.gstRate > 0)
        .map(
          (s) => `
      <div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid #e5e7eb;">
        <span style="font-size:12px;color:#6b7280;">Taxable @ ${s.gstRate}%</span>
        <span style="font-size:12px;">${s.taxableValue.toFixed(2)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid #e5e7eb;">
        <span style="font-size:12px;color:#6b7280;">CGST @ ${s.cgstRate}%</span>
        <span style="font-size:12px;">${s.cgstAmount.toFixed(2)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid #e5e7eb;">
        <span style="font-size:12px;color:#6b7280;">SGST @ ${s.sgstRate}%</span>
        <span style="font-size:12px;">${s.sgstAmount.toFixed(2)}</span>
      </div>`
        )
        .join('')
    }
    return `
      <div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid #e5e7eb;">
        <span style="font-size:12px;color:#6b7280;">Taxable Value</span>
        <span style="font-size:12px;">${gstSummary.taxableValue.toFixed(2)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid #e5e7eb;">
        <span style="font-size:12px;color:#6b7280;">CGST</span>
        <span style="font-size:12px;">${gstSummary.cgstAmount.toFixed(2)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid #e5e7eb;">
        <span style="font-size:12px;color:#6b7280;">SGST</span>
        <span style="font-size:12px;">${gstSummary.sgstAmount.toFixed(2)}</span>
      </div>`
  }

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

      const showItemTaxCol = itemWiseGst && itemRate > 0
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
          ${showItemTaxCol ? `<td style="padding:10px 12px;font-size:14px;text-align:center;">${formatTaxRate(itemRate)}%</td>
          <td style="padding:10px 12px;font-size:14px;text-align:right;">${igstAmt.toFixed(2)}</td>` : ''}
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
      ${effectiveLogo ? `<img src="${escapeHtmlAttr(effectiveLogo)}" alt="Logo" style="max-height:55px;max-width:180px;width:auto;height:auto;object-fit:contain;margin-bottom:6px;display:block;" />` : ''}
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
        ${showTaxBreakdown && itemWiseGst ? `
        <th colspan="2" style="padding:10px 12px;text-align:center;font-size:13px;font-weight:700;border-left:1px solid rgba(255,255,255,0.3);">IGST</th>
        ` : ''}
        <th style="padding:10px 12px;text-align:right;font-size:13px;font-weight:700;">${showTaxBreakdown ? 'Base Amount' : 'Amount'}</th>
      </tr>
      ${showTaxBreakdown && itemWiseGst ? `
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
        <div style="font-size:11px;font-weight:700;color:#1e3a8a;margin-bottom:4px;">Scan &amp; Pay Exact Bill (&#x20B9;${billTotal.toFixed(2)}) via UPI:</div>
        <img src="${effectivePaymentQR}" alt="Payment QR" style="width:110px;height:110px;object-fit:contain;display:block;" />
      </div>` : ''}
    </div>
    <!-- Right: summary -->
    <div style="width:260px;flex-shrink:0;padding:10px 14px;">
      <div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid #e5e7eb;">
        <span style="font-size:12px;color:#6b7280;">Sub Total</span>
        <span style="font-size:12px;font-weight:600;">${sale.subtotal.toFixed(2)}</span>
      </div>
      ${(showTaxBreakdown && totalTax > 0) ? buildA4TaxSummaryHtml() : ''}
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
  // THERMAL (58 mm / 80 mm) RECEIPT HTML
  // ══════════════════════════════════════════════════════════════════════════
  const paperSizeKey = width === '80mm' ? '80mm' : '58mm'
  const customTemplateRaw = templateOverride ?? resolveActiveCustomTemplate(effectiveConfig ?? undefined)
  const customTemplate = customTemplateRaw
    ? ensureTemplateHasLogoBlock(customTemplateRaw, resolvedLogo || effectiveLogo)
    : null

  if (customTemplate) {
    const showLogo = effectiveConfig?.showLogo ?? true
    const storeLogoUrl = showLogo ? preferPrintableSrc(resolvedLogo, effectiveLogo, logoURL, effectiveConfig?.logoURL) : undefined
    const context = saleToReceiptContext(sale, {
      businessName: companyName,
      businessAddress: companyAddress,
      businessPhone: companyPhone,
      businessGSTIN: companyGSTIN,
      businessLogoURL: storeLogoUrl,
      upiId: effectiveConfig?.upiId,
      footerMessage,
      customerName,
    })
    const bodyHtml = compileCustomReceiptHtml(
      customTemplate,
      context,
      paperSizeKey,
      storeLogoUrl,
      smallFS,
      (src, widthPercent, align) =>
        receiptLogoImgHtml(src, 56, Math.max(80, Math.round(180 * Math.min(widthPercent, 100) / 100)), align),
      {
        showLogo,
        itemWiseGst,
        gstStyle,
        showTaxBreakdown: printGst.showTaxBreakdown,
      }
    )

    return `
  <div style="${thermalReceiptContainerStyle(paperSizeKey, smallFS)}">
${bodyHtml}
  </div>`
  }

  const textLines = compileReceiptTextLines({
    sale,
    receiptConfig: effectiveConfig,
    businessName,
    businessAddress,
    businessPhone: effectiveConfig?.phone,
    businessGSTIN: effectiveConfig?.gstin,
    customerName,
    paperSize: paperSizeKey,
    gstStyle,
    itemWiseGst,
  })

  return `
  <div style="${thermalReceiptContainerStyle(paperSizeKey, smallFS)}">
${receiptLogoImgHtml(effectiveLogo, 56, 180)}
${textLines.map((l) => `<div style="white-space:pre;overflow:hidden;width:100%;font-family:'Courier New',Courier,monospace;">${l.replace(/ /g, '&nbsp;')}</div>`).join('')}
${effectivePaymentQR ? `<div style="text-align:center;margin-top:10px;padding:6px 0;border-top:1px dashed #000;display:block;"><div style="font-size:${tinyFS};font-weight:900;margin-bottom:4px;letter-spacing:0.5px;">SCAN TO PAY &#x20B9;${billTotal.toFixed(2)} VIA UPI</div><img src="${effectivePaymentQR}" alt="Payment QR" style="width:130px;height:130px;object-fit:contain;margin:0 auto;display:block;" /></div>` : ''}
  </div>`
}

// ─────────────────────────────────────────────────────────────────────────────
// printReceipt
// ─────────────────────────────────────────────────────────────────────────────
async function inlineDocumentImages(doc: Document): Promise<void> {
  const images = Array.from(doc.images || [])
  await Promise.all(
    images.map(async (img) => {
      const src = img.getAttribute('src') || img.src
      const inlined = await prefetchPrintableLogoSrc(src)
      if (inlined && inlined !== src) img.src = inlined
    })
  )
}

async function waitForDocumentImages(doc: Document): Promise<void> {
  const images = Array.from(doc.images || [])
  await Promise.all(
    images.map((img) => {
      const ready = () => (typeof img.decode === 'function' ? img.decode().catch(() => undefined) : Promise.resolve())
      if (img.complete && img.naturalHeight !== 0) return ready()
      return new Promise<void>((resolve) => {
        const done = () => {
          ready().finally(() => resolve())
        }
        img.addEventListener('load', done, { once: true })
        img.addEventListener('error', () => resolve(), { once: true })
        setTimeout(() => resolve(), 2500)
      })
    })
  )
}

export const printReceipt = (
  receiptHTML: string,
  width: '50mm' | '80mm' | '210mm' = '50mm',
  title = 'Receipt',
  onDone?: () => void,
) => {
  void runBrowserReceiptPrint(receiptHTML, width, title, onDone)
}

async function runBrowserReceiptPrint(
  receiptHTML: string,
  width: '50mm' | '80mm' | '210mm',
  title: string,
  onDone?: () => void,
) {
  const preparedReceiptHtml = await inlineHtmlImageSources(receiptHTML)
  const isThermal = width === '50mm' || width === '80mm'
  const paperWidth = width === '80mm' ? '80mm' : width === '50mm' ? '72mm' : 'A4'
  const pageMargin = width === '80mm' ? '2mm 2mm 10mm 2mm' : isThermal ? '2mm 1mm 10mm 1mm' : '12mm 15mm'
  const iframeWidth = width === '210mm' ? '210mm' : paperWidth

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
      img { max-width: 100% !important; display: block !important; visibility: visible !important; opacity: 1 !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: ${isThermal ? '2px' : '0'};
      width: 100%;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    #receipt { width: 100%; max-width: 100%; margin: 0; padding: 0; overflow: hidden; }
    img { -webkit-print-color-adjust: exact; print-color-adjust: exact; image-rendering: auto; opacity: 1; }
  </style>
</head>
<body>
  <div id="receipt">${preparedReceiptHtml}</div>
</body>
</html>`

  const existing = document.getElementById('receipt-iframe')
  if (existing) existing.remove()

  const iframe = document.createElement('iframe')
  iframe.id = 'receipt-iframe'
  iframe.setAttribute('aria-hidden', 'true')
  // Keep full opacity — Chrome often skips printing images inside opacity:0 / visibility:hidden frames.
  iframe.style.cssText = [
    'position:fixed',
    'left:0',
    'top:0',
    `width:${iframeWidth}`,
    'min-height:240mm',
    'height:auto',
    'border:0',
    'transform:translateX(-200vw)',
    'pointer-events:none',
  ].join(';')
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

  const prepareAndPrint = async (doc: Document | null | undefined) => {
    if (doc) {
      await inlineDocumentImages(doc)
      await waitForDocumentImages(doc)
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      })
      await new Promise<void>((resolve) => setTimeout(resolve, 150))
    }
    executePrint()
  }

  const doc = iframe.contentDocument || iframe.contentWindow?.document
  if (doc) {
    doc.open()
    doc.write(fullHTML)
    doc.close()
    await prepareAndPrint(doc)
    return
  }

  iframe.onload = () => {
    void prepareAndPrint(iframe.contentDocument || iframe.contentWindow?.document)
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
  invoiceConfig?: unknown
  templateOverride?: CustomReceiptTemplate
  businessLogoURL?: string
}

export const generateReceiptEscPos = async ({
  sale,
  receiptConfig,
  paperSize = '58mm',
  businessName,
  businessAddress,
  customerName,
  templateOverride,
  businessLogoURL,
  invoiceConfig,
}: GenerateReceiptEscPosParams): Promise<Uint8Array> => {
  const printGst = getReceiptPrintGstOptions(invoiceConfig, receiptConfig)
  const effectiveConfig = {
    ...receiptConfig,
    showTaxBreakdown: printGst.showTaxBreakdown,
  }
  const showLogo = effectiveConfig?.showLogo ?? true
  const rawLogo = resolveStoreLogoUrl(effectiveConfig ?? undefined, businessLogoURL)
  const printableLogo = showLogo
    ? preferPrintableSrc(await prefetchPrintableLogoSrc(rawLogo), rawLogo, businessLogoURL)
    : undefined
  const printConfig = withPrintableLogo(effectiveConfig, printableLogo || undefined)
  const resolvedLogo = printableLogo || rawLogo
  const customTemplateRaw = templateOverride ?? resolveActiveCustomTemplate(printConfig ?? undefined)
  const customTemplate = customTemplateRaw
    ? ensureTemplateHasLogoBlock(customTemplateRaw, resolvedLogo)
    : null
  const effectivePaper = (customTemplate?.paperWidth || paperSize) as '58mm' | '80mm'
  const context = saleToReceiptContext(sale, {
    businessName,
    businessAddress,
    businessPhone: printConfig?.phone ?? effectiveConfig?.phone,
    businessGSTIN: printConfig?.gstin ?? effectiveConfig?.gstin,
    businessLogoURL: resolvedLogo,
    upiId: printConfig?.upiId ?? effectiveConfig?.upiId,
    footerMessage: printConfig?.footerMessage ?? effectiveConfig?.footerMessage,
    customerName,
  })

  const b = new EscPosBuilder()
  b.init(effectivePaper)

  if (customTemplate) {
    await appendCustomTemplateToEscPos(b, customTemplate, context, effectivePaper, {
      fallbackLogoUrl: resolvedLogo,
      showLogo,
      itemWiseGst: printGst.itemWiseGst,
      gstStyle: printGst.gstStyle,
      showTaxBreakdown: printGst.showTaxBreakdown,
    })
    b.feed(2)
    b.cut()
    return b.toBytes()
  }

  const textLines = compileReceiptTextLines({
    sale,
    receiptConfig: printConfig ?? effectiveConfig,
    businessName,
    businessAddress,
    businessPhone: printConfig?.phone ?? effectiveConfig?.phone,
    businessGSTIN: printConfig?.gstin ?? effectiveConfig?.gstin,
    customerName,
    paperSize: effectivePaper,
    gstStyle: printGst.gstStyle,
    itemWiseGst: printGst.itemWiseGst,
  })

  const logoSrc = showLogo ? (resolvedLogo || '') : ''
  if (logoSrc) {
    const maxWidthDots = effectivePaper === '80mm' ? 320 : 224
    const maxHeightDots = effectivePaper === '80mm' ? 96 : 72
    const rasterSrc = (await prefetchPrintableLogoSrc(logoSrc)) || logoSrc
    const raster = await rasterizeImageForEscPos(rasterSrc, maxWidthDots, maxHeightDots)
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

  if (receiptConfig?.showPaymentQR && (isValidUpiVpa(receiptConfig?.upiId) || receiptConfig?.paymentQrURL)) {
    const billTotal = Number(sale.grandTotal ?? (sale as any).finalTotal ?? (sale as any).total ?? 0)
    b.feed(1)
    b.align('center')
    b.bold(true)
    b.line(`SCAN TO PAY Rs.${billTotal.toFixed(2)}`)
    b.bold(false)
    const qrPayload = isValidUpiVpa(receiptConfig.upiId)
      ? buildUpiPayLink({
          upiId: receiptConfig.upiId!,
          payeeName: businessName || 'SEZNIK',
          amount: billTotal,
          note: sale.invoiceNumber || 'Bill Payment',
        })
      : receiptConfig.paymentQrURL!
    b.qr(qrPayload, effectivePaper === '80mm' ? 6 : 4)
  }

  b.feed(2)
  b.cut()

  return b.toBytes()
}