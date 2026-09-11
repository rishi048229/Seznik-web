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
  renderQrToSvg,
} from './customReceiptEngine'
import type { CustomReceiptTemplate } from '@/types/customReceipt'
import { buildUpiPayLink, isValidUpiVpa } from './upiQr'
import { resolveStoreLogoUrl, prefetchPrintableLogoSrc, isBrowserLoadableImageSrc, preferPrintableSrc, inlineHtmlImageSources } from './receiptLogo'
import { ensureTemplateHasLogoBlock } from './ensureReceiptTemplates'
import { resolveReceiptPrintGst, type GstBreakdownStyle } from '@/constants/gstBilling'
import { gstSummaryFromCart } from '@/utils/gst'
import {
  RECEIPT_LOGO_DEFAULT_WIDTH_PERCENT,
  receiptLogoHtmlMaxPx,
  receiptLogoHtmlMaxPxFromChip,
  receiptLogoMaxDots,
  receiptLogoMaxDotsFromChip,
  receiptQrEscPosModuleSize,
  receiptStandardQrHtmlPx,
  receiptStandardQrHtmlPxFromChip,
} from '@shared/receiptPrintGeometry'
import {
  isReceiptFontMonospace,
  receiptFontCssFamily,
  receiptFontEscPosType,
  receiptFontSizeScale,
  resolveReceiptFontId,
  getReceiptFont,
  type ReceiptFontId,
} from '@shared/receiptFonts'

function escapeHtmlAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
}

function thermalReceiptContainerStyle(
  paperSize: '58mm' | '80mm',
  fontSize: string,
  receiptFont?: ReceiptFontId | null
): string {
  const scale = receiptFontSizeScale(receiptFont)
  const basePx = parseFloat(fontSize) || (paperSize === '80mm' ? 11 : 10)
  const normalizedFs = `${(basePx * scale).toFixed(1)}px`
  return [
    `font-family:${receiptFontCssFamily(receiptFont)}`,
    `font-size:${normalizedFs}`,
    'font-weight:400',
    'line-height:1.35',
    'color:#000',
    'width:100%',
    `max-width:${paperSize === '80mm' ? '80mm' : '58mm'}`,
    'margin:0 auto',
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
  return `<div style="text-align:${textAlign};margin:0 auto 8px auto;padding-bottom:2px;display:block;overflow:visible;"><img src="${escaped}" alt="Store Logo" style="max-height:${maxHeightPx}px;max-width:${maxWidthPx}px;width:auto;height:auto;object-fit:contain;margin:0 auto;display:block;" /></div>`
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
  overrides?: Partial<ReceiptConfig> | null,
  user?: { businessName?: string | null; displayName?: string | null; phone?: string | null } | null
): ReceiptConfig => {
  const pConf = settings?.printerConfig
  const rConf = settings?.receiptConfig

  const merged: ReceiptConfig = {
    headerTitle: rConf?.headerTitle || 'TAX INVOICE',
    companyName: rConf?.companyName || settings?.businessName || user?.businessName || user?.displayName || '',
    address: rConf?.address || settings?.businessAddress || '',
    phone: rConf?.phone || settings?.businessPhone || user?.phone || '',
    gstin: rConf?.gstin || settings?.businessGSTIN || '',
    logoURL: resolveStoreLogoUrl(rConf, settings?.businessLogoURL) || '',
    footerMessage: rConf?.footerMessage || '',
    termsLine1: rConf?.termsLine1 || '',
    termsLine2: rConf?.termsLine2 || '',
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
    showPaymentQR: rConf?.showPaymentQR ?? false,
    upiId: rConf?.upiId || settings?.upiId || '',
    paymentQrURL: rConf?.paymentQrURL || pConf?.paymentQrURL || '',
    customTemplates: rConf?.customTemplates,
    activeCustomTemplateId: rConf?.activeCustomTemplateId ?? null,
    templateId: rConf?.templateId,
    enableBillQrCode: rConf?.enableBillQrCode,
    receiptLogoSize: rConf?.receiptLogoSize,
    receiptQrSize: rConf?.receiptQrSize,
  }

  const withOverrides: ReceiptConfig = {
    ...merged,
    ...(overrides || {}),
    customTemplates: overrides?.customTemplates ?? merged.customTemplates,
    activeCustomTemplateId: overrides?.activeCustomTemplateId ?? merged.activeCustomTemplateId,
  }
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
  /** Used to resolve receiptFont when receiptFont is not passed explicitly. */
  printerConfig?: { receiptFont?: ReceiptFontId | string | null } | null
  /** Explicit typeface from the shared receipt font library. */
  receiptFont?: ReceiptFontId | null
  businessName?: string
  businessAddress?: string
  businessPhone?: string
  businessGSTIN?: string
  customerName?: string
  customerPhone?: string
  customer?: any
  width?: '50mm' | '80mm' | '210mm'
  logoURL?: string
  settingsTaxRate?: number
  settingsTaxName?: string
  invoiceConfig?: unknown
  templateOverride?: CustomReceiptTemplate
  isRestaurant?: boolean
  tableNo?: string
  waiterName?: string
  tokenNo?: string
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
  receiptFont,
  businessName,
  businessAddress,
  businessPhone,
  businessGSTIN,
  customerName,
  customerPhone,
  width = '50mm',
  logoURL,
  settingsTaxRate,
  settingsTaxName,
  invoiceConfig,
  templateOverride,
  isRestaurant,
  tableNo,
  waiterName,
  tokenNo,
}: GenerateReceiptHTMLParams): string => {
  const effectiveReceiptFont = resolveReceiptFontId(receiptFont ?? printerConfig?.receiptFont)
  const printGst = getReceiptPrintGstOptions(invoiceConfig, receiptConfig)
  const effectiveConfig = {
    ...receiptConfig,
    showTaxBreakdown: printGst.showTaxBreakdown,
  }
  const gstStyle = printGst.gstStyle
  const itemWiseGst = printGst.itemWiseGst
  const companyName = effectiveConfig?.companyName || businessName || (sale as any)?.storeName || ''
  const companyAddress = effectiveConfig?.address || businessAddress || (sale as any)?.storeAddress || ''
  const companyPhone = effectiveConfig?.phone || businessPhone || (sale as any)?.storePhone || ''
  const companyGSTIN = effectiveConfig?.gstin || businessGSTIN || (sale as any)?.storeGstin || ''
  const footerMessage = effectiveConfig?.footerMessage || ''

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
  const paperWidth = width === '80mm' ? '80mm' : width === '50mm' ? '58mm' : 'A4'
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
  const paymentQrPayload = isPaymentQrEnabled
    ? (isValidUpiVpa(effectiveConfig?.upiId)
        ? buildUpiPayLink({
            upiId: effectiveConfig.upiId!,
            payeeName: companyName,
            amount: billTotal,
            note: sale.invoiceNumber || 'Bill Payment',
          })
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
      ${paymentQrPayload ? `
      <div style="margin-top:12px;padding-top:8px;border-top:1px dashed #cbd5e1;">
        <div style="font-size:11px;font-weight:700;color:#1e3a8a;margin-bottom:4px;">Scan &amp; Pay Exact Bill (&#x20B9;${billTotal.toFixed(2)}) via UPI:</div>
        <div style="width:110px;height:110px;margin-top:4px;">${renderQrToSvg(paymentQrPayload, 110)}</div>
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

  const effectiveCustomerName = (customerName || (sale as any)?.customerName || (sale as any)?.customer?.name || 'Walk-in Customer').trim() || 'Walk-in Customer'
  const effectiveCustomerPhone = (customerPhone || (sale as any)?.customerPhone || (sale as any)?.customer?.phone || '').trim() || undefined

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
      customerName: effectiveCustomerName,
      customerPhone: effectiveCustomerPhone,
      tableNo,
      waiterName,
      tokenNo,
    })
    const bodyHtml = compileCustomReceiptHtml(
      customTemplate,
      context,
      paperSizeKey,
      storeLogoUrl,
      smallFS,
      (src, widthPercent, align) => {
        const { maxHeight, maxWidth } = receiptLogoHtmlMaxPxFromChip(effectiveConfig?.receiptLogoSize)
        const pct = Math.min(widthPercent || RECEIPT_LOGO_DEFAULT_WIDTH_PERCENT, 100)
        return receiptLogoImgHtml(src, maxHeight, Math.max(80, Math.round(maxWidth * pct / 100)), align)
      },
      {
        showLogo,
        itemWiseGst,
        gstStyle,
        showTaxBreakdown: printGst.showTaxBreakdown,
        isRestaurant,
        receiptLogoSize: effectiveConfig?.receiptLogoSize,
        receiptQrSize: effectiveConfig?.receiptQrSize,
        receiptFont: effectiveReceiptFont,
      }
    )

    return `
  <div style="${thermalReceiptContainerStyle(paperSizeKey, smallFS, effectiveReceiptFont)}">
${bodyHtml}
  </div>`
  }

  const textLines = compileReceiptTextLines({
    sale,
    receiptConfig: effectiveConfig,
    businessName: companyName,
    businessAddress: companyAddress,
    businessPhone: companyPhone,
    businessGSTIN: companyGSTIN,
    customerName: effectiveCustomerName,
    customerPhone: effectiveCustomerPhone,
    paperSize: paperSizeKey,
    receiptFont: effectiveReceiptFont,
    gstStyle,
    itemWiseGst,
    isRestaurant,
  })

  const logoHtml = receiptLogoHtmlMaxPxFromChip(effectiveConfig?.receiptLogoSize)
  const qrDimension = receiptStandardQrHtmlPxFromChip(effectiveConfig?.receiptQrSize)
  const enableBillQr = Boolean(effectiveConfig?.enableBillQrCode)
  const billPdfTarget = encodeURIComponent(sale.id || sale.invoiceNumber || 'INV')
  const billPdfUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/receipt/${billPdfTarget}`
      : `https://api.seznik.com/receipt/${billPdfTarget}`
  const lineFontFamily = receiptFontCssFamily(effectiveReceiptFont)

  const renderedLinesHtml = textLines
    .map((line) => {
      const trimmed = line.trim()
      if (!trimmed) {
        return `<div style="height:4px;"></div>`
      }
      if (/^[-=.]+$/.test(trimmed)) {
        const isDouble = trimmed.includes('=')
        return `<div style="border-top:1px ${isDouble ? 'solid' : 'dashed'} #000;margin:4px 0;width:100%;"></div>`
      }
      return `<div style="white-space:pre;overflow:hidden;width:100%;font-family:${lineFontFamily};font-variant-numeric:tabular-nums;line-height:1.35;">${line.replace(/ /g, '&nbsp;')}</div>`
    })
    .join('')

  return `
  <div style="${thermalReceiptContainerStyle(paperSizeKey, smallFS, effectiveReceiptFont)}">
${receiptLogoImgHtml(effectiveLogo, logoHtml.maxHeight, logoHtml.maxWidth)}
${renderedLinesHtml}
${paymentQrPayload ? `<div style="text-align:center;margin-top:10px;padding:6px 0;border-top:1px dashed #000;display:block;"><div style="font-size:${tinyFS};font-weight:900;margin-bottom:4px;letter-spacing:0.5px;">SCAN TO PAY VIA UPI</div><div style="display:flex;justify-content:center;margin:4px 0;">${renderQrToSvg(paymentQrPayload, qrDimension)}</div></div>` : ''}
${enableBillQr ? `<div style="text-align:center;margin-top:8px;padding:4px 0;display:block;"><div style="font-size:${tinyFS};font-weight:700;margin-bottom:4px;">Scan QR to View &amp; Download Bill PDF</div><div style="display:flex;justify-content:center;margin:4px 0;">${renderQrToSvg(billPdfUrl, qrDimension)}</div></div>` : ''}
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
  receiptFont?: ReceiptFontId | null,
) => {
  const isThermal = width === '50mm' || width === '80mm'
  const paperWidth = width === '80mm' ? '80mm' : width === '50mm' ? '58mm' : 'A4'
  const pageMargin = width === '80mm' ? '2mm 2mm 10mm 2mm' : isThermal ? '2mm 1mm 10mm 1mm' : '12mm 15mm'

  // Only load Google Fonts when the selected font requires them
  const effectiveFont = resolveReceiptFontId(receiptFont)
  const needsIBMPlexMono = effectiveFont === 'modern'
  const needsIBMPlexSans = effectiveFont === 'clean'
  const needsGoogleFonts = needsIBMPlexMono || needsIBMPlexSans
  const googleFontFamilies = [
    ...(needsIBMPlexMono ? ['family=IBM+Plex+Mono:wght@400;500;600;700'] : []),
    ...(needsIBMPlexSans ? ['family=IBM+Plex+Sans:wght@400;500;600;700'] : []),
  ]
  const googleFontsLink = needsGoogleFonts
    ? `<link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?${googleFontFamilies.join('&')}&display=swap" rel="stylesheet" />`
    : ''
  const bodyFontFamily = receiptFontCssFamily(effectiveFont)

  const fullHTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  ${googleFontsLink}
  <style>
    @page {
      size: ${paperWidth} auto;
      margin: ${pageMargin};
    }
    @media print {
      @page { size: ${paperWidth} auto; margin: ${pageMargin}; }
      html, body { width: 100%; margin: 0; padding: 0; }
      #receipt { width: ${isThermal ? paperWidth : '100%'}; max-width: ${isThermal ? paperWidth : '100%'}; margin: 0 auto; padding: 0; }
      img { max-width: 100% !important; display: block !important; visibility: visible !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: ${isThermal ? '2px' : '0'};
      width: 100%;
      font-family: ${bodyFontFamily};
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    #receipt { width: ${isThermal ? paperWidth : '100%'}; max-width: ${isThermal ? paperWidth : '100%'}; margin: 0 auto; padding: 0; }
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

    // Wait for web fonts (e.g. IBM Plex) to finish loading before printing
    const fontsReady = doc.fonts?.ready ?? Promise.resolve()
    fontsReady.then(() => {
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
      }, 2500)
    }).catch(() => {
      // Font loading failed — print anyway with fallback fonts
      setTimeout(executePrint, 300)
    })
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
  /** Used to resolve receiptFont when receiptFont is not passed explicitly. */
  printerConfig?: { receiptFont?: ReceiptFontId | string | null; fontSize?: string | null } | null
  receiptFont?: ReceiptFontId | null
  businessName?: string
  businessAddress?: string
  businessPhone?: string
  businessGSTIN?: string
  customerName?: string
  customerPhone?: string
  settingsTaxRate?: number
  invoiceConfig?: unknown
  templateOverride?: CustomReceiptTemplate
  businessLogoURL?: string
  isRestaurant?: boolean
  tableNo?: string
  waiterName?: string
  tokenNo?: string
}

export const generateReceiptEscPos = async ({
  sale,
  receiptConfig,
  paperSize = '58mm',
  printerConfig,
  receiptFont,
  businessName,
  businessAddress,
  businessPhone,
  businessGSTIN,
  customerName,
  customerPhone,
  templateOverride,
  businessLogoURL,
  invoiceConfig,
  isRestaurant,
  tableNo,
  waiterName,
  tokenNo,
}: GenerateReceiptEscPosParams): Promise<Uint8Array> => {
  const effectiveReceiptFont = resolveReceiptFontId(receiptFont ?? printerConfig?.receiptFont)
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


  const effectiveCustomerName = (customerName || (sale as any)?.customerName || (sale as any)?.customer?.name || 'Walk-in Customer').trim() || 'Walk-in Customer'
  const effectiveCustomerPhone = (customerPhone || (sale as any)?.customerPhone || (sale as any)?.customer?.phone || '').trim() || undefined

  const context = saleToReceiptContext(sale, {
    businessName: businessName || printConfig?.companyName || effectiveConfig?.companyName || (sale as any)?.storeName,
    businessAddress: businessAddress || printConfig?.address || effectiveConfig?.address || (sale as any)?.storeAddress,
    businessPhone: businessPhone || printConfig?.phone || effectiveConfig?.phone || (sale as any)?.storePhone,
    businessGSTIN: businessGSTIN || printConfig?.gstin || effectiveConfig?.gstin || (sale as any)?.storeGstin,
    businessLogoURL: resolvedLogo,
    upiId: printConfig?.upiId || effectiveConfig?.upiId,
    footerMessage: printConfig?.footerMessage || effectiveConfig?.footerMessage,
    customerName: effectiveCustomerName,
    customerPhone: effectiveCustomerPhone,
    tableNo,
    waiterName,
    tokenNo,
  })

  const fontDef = getReceiptFont(effectiveReceiptFont)
  const b = new EscPosBuilder()
  b.init(effectivePaper, fontDef.escPosFont)

  if (customTemplate) {
    await appendCustomTemplateToEscPos(b, customTemplate, context, effectivePaper, {
      fallbackLogoUrl: resolvedLogo,
      showLogo,
      itemWiseGst: printGst.itemWiseGst,
      gstStyle: printGst.gstStyle,
      showTaxBreakdown: printGst.showTaxBreakdown,
      isRestaurant,
      receiptLogoSize: effectiveConfig?.receiptLogoSize,
      receiptQrSize: effectiveConfig?.receiptQrSize,
      receiptFont: effectiveReceiptFont,
    })
    b.feed(2)
    b.cut()
    return b.toBytes()
  }

  const textLines = compileReceiptTextLines({
    sale,
    receiptConfig: printConfig ?? effectiveConfig,
    businessName: businessName || printConfig?.companyName || effectiveConfig?.companyName,
    businessAddress: businessAddress || printConfig?.address || effectiveConfig?.address,
    businessPhone: printConfig?.phone || effectiveConfig?.phone || businessPhone,
    businessGSTIN: printConfig?.gstin || effectiveConfig?.gstin || businessGSTIN,
    customerName: effectiveCustomerName,
    customerPhone: effectiveCustomerPhone,
    paperSize: effectivePaper,
    receiptFont: effectiveReceiptFont,
    gstStyle: printGst.gstStyle,
    itemWiseGst: printGst.itemWiseGst,
    isRestaurant,
  })

  const logoSrc = showLogo ? (resolvedLogo || '') : ''
  if (logoSrc) {
    const { maxWidth: maxWidthDots, maxHeight: maxHeightDots } = receiptLogoMaxDotsFromChip(
      effectivePaper,
      effectiveConfig?.receiptLogoSize || 'medium'
    )
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
    const trimmed = line.trim()
    const isStoreName = Boolean((businessName && trimmed === businessName.trim()) || (printConfig?.companyName && trimmed === printConfig.companyName.trim()))
    const isDocTitle = trimmed === 'TAX INVOICE' || trimmed === 'BILL OF SUPPLY' || trimmed === 'BILL'
    const isGrandTotal = line.includes('GRAND TOTAL')
    if (isStoreName || isDocTitle || isGrandTotal) {
      b.bold(true)
      b.line(line)
      b.bold(false)
    } else {
      b.line(line)
    }
  })

  if ((printConfig?.showPaymentQR || effectiveConfig?.showPaymentQR) && (isValidUpiVpa(printConfig?.upiId || effectiveConfig?.upiId) || printConfig?.paymentQrURL || effectiveConfig?.paymentQrURL)) {
    const billTotal = Number(sale.grandTotal ?? (sale as any).finalTotal ?? (sale as any).total ?? 0)
    b.feed(1)
    b.align('center')
    b.bold(true)
    b.line('SCAN TO PAY VIA UPI')
    b.bold(false)
    const payeeUpi = printConfig?.upiId || effectiveConfig?.upiId
    const qrPayload = isValidUpiVpa(payeeUpi)
      ? buildUpiPayLink({
          upiId: payeeUpi!,
          payeeName: businessName || printConfig?.companyName || 'SEZNIK',
          amount: billTotal,
          note: sale.invoiceNumber || 'Bill Payment',
        })
      : (printConfig?.paymentQrURL || effectiveConfig?.paymentQrURL)!
    b.qr(qrPayload, receiptQrEscPosModuleSize(effectivePaper, effectiveConfig?.receiptQrSize))
  }

  if (effectiveConfig?.enableBillQrCode) {
    const billPdfTarget = encodeURIComponent(sale.id || sale.invoiceNumber || 'INV')
    const billPdfUrl =
      typeof window !== 'undefined'
        ? `${window.location.origin}/receipt/${billPdfTarget}`
        : `https://api.seznik.com/receipt/${billPdfTarget}`
    b.feed(1)
    b.align('center')
    b.line('Scan QR to View & Download Bill PDF')
    b.qr(billPdfUrl, receiptQrEscPosModuleSize(effectivePaper))
  }

  b.feed(2)
  b.cut()

  return b.toBytes()
}