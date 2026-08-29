import type { Sale, SaleItem } from '@/types/sale.types'
import type { PrinterConfig, ReceiptConfig } from '@/types/settings.types'
import type { Product } from '@/types/product.types'
import { getUpiQrImageUrl } from './upiQr'
import {
  getA4InvoiceTemplate,
  type A4InvoiceLayout,
  type A4InvoiceTheme,
} from './a4InvoiceTemplates'

export interface A4InvoiceCustomer {
  name?: string
  phone?: string
  address?: string
  email?: string
}

export interface GenerateA4InvoiceHTMLParams {
  sale: Sale
  receiptConfig?: Partial<ReceiptConfig> | null
  printerConfig?: Partial<PrinterConfig> | null
  businessName?: string
  businessAddress?: string
  customerName?: string
  customer?: A4InvoiceCustomer | null
  logoURL?: string
  settingsTaxName?: string
  products?: Array<Pick<Product, 'id' | 'sku' | 'unit' | 'expiryDate' | 'brand'>> | null
}

const THEME: Record<A4InvoiceTheme, { primary: string; accent: string; soft: string; ink: string }> = {
  navy: { primary: '#0a0a2e', accent: '#1e3a8a', soft: '#eef2ff', ink: '#0f172a' },
  emerald: { primary: '#064e3b', accent: '#059669', soft: '#ecfdf5', ink: '#064e3b' },
  slate: { primary: '#1e293b', accent: '#475569', soft: '#f1f5f9', ink: '#0f172a' },
  royal: { primary: '#1e3a8a', accent: '#2563eb', soft: '#eff6ff', ink: '#1e3a8a' },
  rose: { primary: '#9f1239', accent: '#e11d48', soft: '#fff1f2', ink: '#881337' },
  amber: { primary: '#78350f', accent: '#d97706', soft: '#fffbeb', ink: '#78350f' },
  teal: { primary: '#115e59', accent: '#0d9488', soft: '#f0fdfa', ink: '#134e4a' },
  wine: { primary: '#7f1d1d', accent: '#b91c1c', soft: '#fef2f2', ink: '#7f1d1d' },
}

export function esc(value: string | number | null | undefined): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function formatDate(date: unknown): string {
  const dateObj =
    typeof date === 'object' && date && (date as { toDate?: () => Date }).toDate
      ? (date as { toDate: () => Date }).toDate()
      : typeof date === 'string' || typeof date === 'number'
        ? new Date(date)
        : new Date()
  return dateObj.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

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

function formatRate(rate: number): string {
  if (!rate || isNaN(rate)) return '0'
  return String(Math.round(rate * 100) / 100)
}

const nl2br = (text: string) =>
  esc(text).split('\n').filter(Boolean).map(line => `<div>${line}</div>`).join('')

export function wrapA4Document(innerHtml: string, title: string, paper: 'A4' | 'Letter' = 'A4'): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${esc(title)}</title>
  <style>
    @page { size: ${paper}; margin: 10mm 12mm; }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: #fff; color: #111; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  </style>
</head>
<body>${innerHtml}</body>
</html>`
}

export function downloadA4InvoicePdf(innerHtml: string, filename: string, paper: 'A4' | 'Letter' = 'A4') {
  const full = wrapA4Document(innerHtml, filename.replace(/\.pdf$/i, ''), paper)
  const existing = document.getElementById('a4-invoice-pdf-frame')
  if (existing) existing.remove()

  const iframe = document.createElement('iframe')
  iframe.id = 'a4-invoice-pdf-frame'
  iframe.setAttribute('title', filename)
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0'
  document.body.appendChild(iframe)

  const doc = iframe.contentDocument || iframe.contentWindow?.document
  if (!doc) {
    iframe.remove()
    const w = window.open('', '_blank')
    if (!w) return
    w.document.write(full)
    w.document.close()
    w.focus()
    setTimeout(() => w.print(), 400)
    return
  }

  doc.open()
  doc.write(full)
  doc.close()

  const runPrint = () => {
    try {
      iframe.contentWindow?.focus()
      iframe.contentWindow?.print()
    } finally {
      setTimeout(() => iframe.remove(), 2500)
    }
  }

  const images = Array.from(doc.images || [])
  if (images.length === 0) {
    setTimeout(runPrint, 250)
    return
  }
  let left = images.length
  const tick = () => {
    left -= 1
    if (left <= 0) setTimeout(runPrint, 250)
  }
  images.forEach(img => {
    if (img.complete) tick()
    else {
      img.addEventListener('load', tick)
      img.addEventListener('error', tick)
    }
  })
}

type ResolvedA4 = {
  templateId: string
  layout: A4InvoiceLayout
  theme: A4InvoiceTheme
  docTitle: string
  showHeader: boolean
  showTerms: boolean
  termsText: string
  showQr: boolean
  showHsn: boolean
  showSku: boolean
  showUnit: boolean
  showBatchExpiry: boolean
  showFssai: boolean
  showLicense: boolean
  showBank: boolean
  codeLabel: string
  unitLabel: string
  placeOfSupply: string
  reverseCharge: string
  fssai: string
  licenseNo: string
  signatureName: string
  bankName: string
  bankAccount: string
  bankIfsc: string
  notes: string
  meta: Array<{ label: string; value: string }>
}

function resolveA4(printer?: Partial<PrinterConfig> | null): ResolvedA4 {
  const template = getA4InvoiceTemplate(printer?.invoiceTemplateId)
  const theme = (printer?.invoiceColorTheme || template.theme) as A4InvoiceTheme
  const meta = [
    { label: printer?.invoiceMeta1Label ?? template.meta1Label, value: printer?.invoiceMeta1Value || '' },
    { label: printer?.invoiceMeta2Label ?? template.meta2Label, value: printer?.invoiceMeta2Value || '' },
    { label: printer?.invoiceMeta3Label ?? template.meta3Label, value: printer?.invoiceMeta3Value || template.meta3Value || '' },
  ].filter(m => m.label.trim())

  return {
    templateId: template.id,
    layout: template.layout,
    theme: THEME[theme] ? theme : template.theme,
    docTitle: printer?.invoiceDocTitle || template.docTitle,
    showHeader: printer?.invoiceShowHeader ?? true,
    showTerms: printer?.invoiceShowTerms ?? true,
    termsText: (printer?.invoiceTermsText || template.defaultTerms).trim(),
    showQr: printer?.invoiceShowPaymentQR ?? false,
    showHsn: printer?.invoiceShowHsn ?? template.showHsn,
    showSku: printer?.invoiceShowSku ?? template.showSku,
    showUnit: printer?.invoiceShowUnit ?? template.showUnit,
    showBatchExpiry: printer?.invoiceShowBatchExpiry ?? template.showBatchExpiry,
    showFssai: template.showFssai,
    showLicense: template.showLicense,
    showBank: template.showBank,
    codeLabel: template.codeLabel,
    unitLabel: template.unitLabel,
    placeOfSupply: printer?.invoicePlaceOfSupply || '',
    reverseCharge: printer?.invoiceReverseCharge || 'No',
    fssai: printer?.invoiceFssai || '',
    licenseNo: printer?.invoiceLicenseNo || '',
    signatureName: printer?.invoiceSignatureName || 'Authorised Signatory',
    bankName: printer?.invoiceBankName || '',
    bankAccount: printer?.invoiceBankAccount || '',
    bankIfsc: printer?.invoiceBankIfsc || '',
    notes: printer?.invoiceNotes || '',
    meta,
  }
}

function metaGrid(cfg: ResolvedA4, extra: Array<{ label: string; value: string }>, colors: typeof THEME.navy): string {
  const cells = [...cfg.meta, ...extra].filter(c => c.label)
  if (cells.length === 0) return ''
  return `<div style="display:grid;grid-template-columns:repeat(${Math.min(cells.length, 3)},1fr);gap:8px;padding:10px 16px;background:${colors.soft};border-bottom:1px solid #e5e7eb;">
    ${cells.map(c => `
      <div>
        <div style="font-size:9px;letter-spacing:.08em;text-transform:uppercase;color:${colors.accent};font-weight:700;">${esc(c.label)}</div>
        <div style="font-size:12px;font-weight:700;color:${colors.ink};margin-top:2px;">${esc(c.value || '—')}</div>
      </div>`).join('')}
  </div>`
}

function gstStrip(cfg: ResolvedA4, gstin: string, colors: typeof THEME.navy): string {
  const bits = [
    gstin ? `GSTIN: ${gstin}` : '',
    cfg.placeOfSupply ? `Place of supply: ${cfg.placeOfSupply}` : '',
    `Reverse charge: ${cfg.reverseCharge || 'No'}`,
    cfg.showFssai && cfg.fssai ? `FSSAI: ${cfg.fssai}` : '',
    cfg.showLicense && cfg.licenseNo ? `Licence: ${cfg.licenseNo}` : '',
  ].filter(Boolean)
  if (!bits.length) return ''
  return `<div style="padding:6px 16px;font-size:11px;color:${colors.ink};border-bottom:1px solid #e5e7eb;display:flex;flex-wrap:wrap;gap:12px;">
    ${bits.map(b => `<span>${esc(b)}</span>`).join('')}
  </div>`
}

export const generateA4InvoiceHTML = ({
  sale,
  receiptConfig,
  printerConfig,
  businessName,
  businessAddress,
  customerName,
  customer,
  logoURL,
  products,
}: GenerateA4InvoiceHTMLParams): string => {
  const cfg = resolveA4(printerConfig)
  const colors = THEME[cfg.theme]
  const companyName = receiptConfig?.companyName || businessName || 'Your Company'
  const companyAddress = receiptConfig?.address || businessAddress || ''
  const companyPhone = receiptConfig?.phone || ''
  const companyGSTIN = receiptConfig?.gstin || ''
  const footerMessage = cfg.notes || receiptConfig?.footerMessage || ''
  const showTax = receiptConfig?.showTaxBreakdown ?? true
  const showLogo = receiptConfig?.showLogo ?? true
  const effectiveLogo = showLogo ? (logoURL || receiptConfig?.logoURL || '') : ''
  const billToName = customer?.name || customerName || 'Walk-in Customer'
  const billToPhone = customer?.phone || ''
  const billToAddress = customer?.address || ''
  const billToEmail = customer?.email || ''

  const saleItems = sale.items ?? []
  const dateStr = formatDate(sale.createdAt)
  const billTotal = Number(sale.grandTotal ?? 0)
  const paymentMade = sale.amountPaid || 0
  const balanceDue = Math.max(0, billTotal - paymentMade)
  const totalTax = sale.totalTax || 0
  const methodLabel =
    sale.paymentMethod === 'cash' ? 'Cash'
      : sale.paymentMethod === 'card' ? 'Card'
        : sale.paymentMethod === 'upi' ? 'UPI'
          : 'Credit'

  const uniqueRates = Array.from(new Set(saleItems.map(i => i.taxRate || 0).filter(r => r > 0)))
  const taxable = saleItems.reduce((s, i) => s + (i.sellingPrice * i.quantity - (i.discount || 0)), 0)
  const inferred = taxable > 0 ? (totalTax / taxable) * 100 : 0
  const effectiveRate = uniqueRates.length === 1 ? uniqueRates[0] : inferred

  const qrEnabled = printerConfig?.invoiceShowPaymentQR ?? receiptConfig?.showPaymentQR ?? false
  const paymentQR = qrEnabled
    ? (receiptConfig?.upiId
        ? getUpiQrImageUrl({
            upiId: receiptConfig.upiId,
            payeeName: companyName,
            amount: billTotal,
            note: sale.invoiceNumber || 'Bill Payment',
          }, 180)
        : (receiptConfig?.paymentQrURL || printerConfig?.paymentQrURL || ''))
    : ''

  const lookup = (item: SaleItem) =>
    item.productId && products ? products.find(p => p.id === item.productId) : undefined

  const expiryOf = (item: SaleItem) => {
    const p = lookup(item)
    if (!p?.expiryDate) return ''
    const d = p.expiryDate instanceof Date ? p.expiryDate : new Date(p.expiryDate)
    if (Number.isNaN(d.getTime())) return ''
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  const colCount =
    4
    + (cfg.showSku ? 1 : 0)
    + (cfg.showHsn ? 1 : 0)
    + (cfg.showUnit ? 1 : 0)
    + (cfg.showBatchExpiry ? 1 : 0)
    + (showTax ? 2 : 0)

  const th = (label: string, align: 'left' | 'center' | 'right' = 'center') =>
    `<th style="padding:8px 8px;font-size:10px;letter-spacing:.04em;text-transform:uppercase;text-align:${align};">${label}</th>`

  const itemRows = saleItems.map((item, index) => {
    const product = lookup(item)
    const line = item.sellingPrice * item.quantity
    const rate = item.taxRate || effectiveRate
    const taxAmt = item.taxAmount || (line * (rate / 100))
    const amount = line - (item.discount || 0) + (showTax ? 0 : taxAmt)
    const unit = product?.unit || cfg.unitLabel
    const sku = product?.sku || ''
    const hsn = cfg.meta.find(m => /sac|hsn/i.test(m.label))?.value || ''
    const expiry = expiryOf(item)
    const gstTag = item.priceIncludesGst
      ? '<span style="font-size:9px;color:#1e3a8a;font-weight:700;margin-left:4px;">Incl. GST</span>'
      : rate > 0
        ? ''
        : ''
    return `<tr style="border-bottom:1px solid #e5e7eb;">
      <td style="padding:8px;font-size:11px;text-align:center;color:#64748b;">${index + 1}</td>
      <td style="padding:8px;font-size:12px;">
        <div style="font-weight:700;">${esc(item.productName)}${gstTag}</div>
        ${product?.brand ? `<div style="font-size:10px;color:#64748b;">${esc(product.brand)}</div>` : ''}
        ${item.discount ? `<div style="font-size:10px;color:#b91c1c;">Disc. ₹${item.discount.toFixed(2)}</div>` : ''}
      </td>
      ${cfg.showSku ? `<td style="padding:8px;font-size:11px;text-align:center;">${esc(sku || '—')}</td>` : ''}
      ${cfg.showHsn ? `<td style="padding:8px;font-size:11px;text-align:center;">${esc(hsn || '—')}</td>` : ''}
      <td style="padding:8px;font-size:12px;text-align:center;font-weight:600;">${item.quantity}</td>
      ${cfg.showUnit ? `<td style="padding:8px;font-size:11px;text-align:center;color:#64748b;">${esc(unit)}</td>` : ''}
      ${cfg.showBatchExpiry ? `<td style="padding:8px;font-size:10px;text-align:center;">${esc(expiry || '—')}</td>` : ''}
      <td style="padding:8px;font-size:12px;text-align:right;">${item.sellingPrice.toFixed(2)}</td>
      ${showTax ? `<td style="padding:8px;font-size:11px;text-align:center;">${formatRate(rate)}%</td>
        <td style="padding:8px;font-size:11px;text-align:right;">${taxAmt.toFixed(2)}</td>` : ''}
      <td style="padding:8px;font-size:12px;text-align:right;font-weight:700;">${(showTax ? (line - (item.discount || 0)) : amount).toFixed(2)}</td>
    </tr>`
  }).join('')

  const tableHead = `<tr style="background:${colors.primary};color:#fff;">
    ${th('#')}
    ${th('Description', 'left')}
    ${cfg.showSku ? th('SKU') : ''}
    ${cfg.showHsn ? th(cfg.codeLabel) : ''}
    ${th('Qty')}
    ${cfg.showUnit ? th('Unit') : ''}
    ${cfg.showBatchExpiry ? th('Expiry') : ''}
    ${th('Rate', 'right')}
    ${showTax ? `${th('GST')} ${th('Tax', 'right')}` : ''}
    ${th('Amount', 'right')}
  </tr>`

  const logoBlock = effectiveLogo
    ? `<img src="${esc(effectiveLogo)}" alt="" style="max-height:52px;max-width:160px;object-fit:contain;display:block;margin-bottom:6px;" />`
    : ''

  const companyBlock = `
    ${logoBlock}
    <div style="font-size:20px;font-weight:900;color:${colors.primary};letter-spacing:.02em;">${esc(companyName)}</div>
    ${companyAddress ? `<div style="font-size:11px;color:#475569;margin-top:2px;max-width:280px;">${esc(companyAddress)}</div>` : ''}
    ${companyPhone ? `<div style="font-size:11px;color:#475569;">Ph: ${esc(companyPhone)}</div>` : ''}
    ${companyGSTIN ? `<div style="font-size:11px;font-weight:700;color:${colors.accent};">GSTIN: ${esc(companyGSTIN)}</div>` : ''}
  `

  const invoiceMetaBox = `
    <div style="text-align:right;">
      <div style="font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:${colors.accent};font-weight:800;">${esc(cfg.docTitle)}</div>
      <div style="font-size:18px;font-weight:900;margin-top:4px;"># ${esc(sale.invoiceNumber || '—')}</div>
      <div style="font-size:11px;color:#64748b;margin-top:4px;">Date: ${esc(dateStr)}</div>
      <div style="font-size:11px;color:#64748b;">Payment: ${esc(methodLabel)}</div>
    </div>
  `

  const billTo = `
    <div style="font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:${colors.accent};font-weight:700;margin-bottom:4px;">Bill to</div>
    <div style="font-size:14px;font-weight:800;">${esc(billToName)}</div>
    ${billToPhone ? `<div style="font-size:11px;color:#475569;">${esc(billToPhone)}</div>` : ''}
    ${billToEmail ? `<div style="font-size:11px;color:#475569;">${esc(billToEmail)}</div>` : ''}
    ${billToAddress ? `<div style="font-size:11px;color:#475569;">${esc(billToAddress)}</div>` : ''}
  `

  const header = (() => {
    if (!cfg.showHeader) {
      return `<div style="padding:14px 16px;display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid ${colors.primary};">${invoiceMetaBox}</div>`
    }
    switch (cfg.layout) {
      case 'banded':
        return `<div style="background:${colors.primary};color:#fff;padding:18px 20px;">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;">
            <div>
              ${logoBlock}
              <div style="font-size:22px;font-weight:900;">${esc(companyName)}</div>
              ${companyAddress ? `<div style="font-size:11px;opacity:.85;margin-top:3px;">${esc(companyAddress)}</div>` : ''}
              ${companyPhone ? `<div style="font-size:11px;opacity:.85;">Ph: ${esc(companyPhone)}</div>` : ''}
              ${companyGSTIN ? `<div style="font-size:11px;font-weight:700;margin-top:4px;">GSTIN: ${esc(companyGSTIN)}</div>` : ''}
            </div>
            <div style="text-align:right;">
              <div style="font-size:11px;letter-spacing:.2em;text-transform:uppercase;opacity:.8;">${esc(cfg.docTitle)}</div>
              <div style="font-size:22px;font-weight:900;margin-top:4px;"># ${esc(sale.invoiceNumber || '—')}</div>
              <div style="font-size:11px;opacity:.85;margin-top:4px;">${esc(dateStr)} · ${esc(methodLabel)}</div>
            </div>
          </div>
        </div>`
      case 'folio':
        return `<div style="padding:16px 20px 12px;border-bottom:3px solid ${colors.accent};">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;">
            <div>${companyBlock}</div>
            <div style="text-align:right;">
              <div style="display:inline-block;border:1px solid ${colors.accent};color:${colors.accent};padding:4px 10px;font-size:10px;letter-spacing:.16em;font-weight:800;">GUEST FOLIO</div>
              <div style="font-size:13px;font-weight:800;margin-top:8px;">${esc(cfg.docTitle)}</div>
              <div style="font-size:18px;font-weight:900;"># ${esc(sale.invoiceNumber || '—')}</div>
              <div style="font-size:11px;color:#64748b;">${esc(dateStr)}</div>
            </div>
          </div>
        </div>`
      case 'ticket':
        return `<div style="background:${colors.primary};color:#fff;padding:16px 20px;display:flex;justify-content:space-between;align-items:center;">
          <div>
            ${logoBlock}
            <div style="font-size:20px;font-weight:900;">${esc(companyName)}</div>
            <div style="font-size:11px;opacity:.85;">${esc(companyAddress)}</div>
          </div>
          <div style="text-align:right;border-left:1px solid rgba(255,255,255,.25);padding-left:16px;">
            <div style="font-size:10px;letter-spacing:.2em;text-transform:uppercase;">${esc(cfg.docTitle)}</div>
            <div style="font-size:20px;font-weight:900;">${esc(sale.invoiceNumber || '—')}</div>
            <div style="font-size:11px;opacity:.85;">${esc(dateStr)}</div>
          </div>
        </div>`
      case 'statement':
        return `<div style="padding:18px 20px;border-bottom:1px solid #e5e7eb;">
          <div style="display:flex;justify-content:space-between;gap:24px;">
            <div>${companyBlock}</div>
            ${invoiceMetaBox}
          </div>
          <div style="margin-top:14px;height:3px;background:linear-gradient(90deg,${colors.primary},${colors.accent},transparent);"></div>
        </div>`
      case 'industrial':
        return `<div style="border-top:8px solid ${colors.primary};padding:16px 18px;display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid ${colors.primary};">
          <div>${companyBlock}</div>
          <div style="background:${colors.primary};color:#fff;padding:12px 16px;min-width:180px;">
            <div style="font-size:10px;letter-spacing:.14em;text-transform:uppercase;opacity:.8;">${esc(cfg.docTitle)}</div>
            <div style="font-size:16px;font-weight:900;margin-top:4px;">${esc(sale.invoiceNumber || '—')}</div>
            <div style="font-size:11px;opacity:.85;margin-top:6px;">${esc(dateStr)}<br/>${esc(methodLabel)}</div>
          </div>
        </div>`
      case 'clinical':
        return `<div style="padding:0;">
          <div style="height:6px;background:${colors.accent};"></div>
          <div style="padding:16px 18px;display:flex;justify-content:space-between;background:${colors.soft};">
            <div>${companyBlock}</div>
            ${invoiceMetaBox}
          </div>
        </div>`
      case 'compact':
        return `<div style="padding:12px 16px;display:flex;justify-content:space-between;align-items:center;background:${colors.soft};border-bottom:2px solid ${colors.primary};">
          <div style="display:flex;gap:10px;align-items:center;">
            ${effectiveLogo ? `<img src="${esc(effectiveLogo)}" alt="" style="height:36px;max-width:80px;object-fit:contain;" />` : ''}
            <div>
              <div style="font-size:16px;font-weight:900;color:${colors.primary};">${esc(companyName)}</div>
              <div style="font-size:10px;color:#64748b;">${esc(companyGSTIN ? `GSTIN ${companyGSTIN}` : companyAddress)}</div>
            </div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:10px;font-weight:800;color:${colors.accent};">${esc(cfg.docTitle)}</div>
            <div style="font-size:14px;font-weight:900;">${esc(sale.invoiceNumber || '—')}</div>
            <div style="font-size:10px;color:#64748b;">${esc(dateStr)}</div>
          </div>
        </div>`
      default:
        return `<div style="padding:16px 18px;display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid ${colors.primary};">
          <div>${companyBlock}</div>
          ${invoiceMetaBox}
        </div>`
    }
  })()

  const cgst = totalTax / 2
  const sgst = totalTax / 2

  const totals = `
    <div style="display:flex;border-top:2px solid ${colors.primary};">
      <div style="flex:1;padding:12px 16px;border-right:1px solid #e5e7eb;">
        <div style="font-size:9px;letter-spacing:.08em;text-transform:uppercase;color:#64748b;font-weight:700;">Amount in words</div>
        <div style="font-size:12px;font-weight:700;font-style:italic;margin-top:4px;">${esc(numberToWords(billTotal))}</div>
        ${footerMessage ? `<div style="font-size:11px;color:#475569;margin-top:10px;"><b>Notes</b><br/>${nl2br(footerMessage)}</div>` : ''}
        ${paymentQR ? `<div style="margin-top:10px;"><div style="font-size:10px;font-weight:700;color:${colors.accent};margin-bottom:4px;">Scan &amp; pay ₹${billTotal.toFixed(2)}</div><img src="${esc(paymentQR)}" alt="UPI QR" style="width:96px;height:96px;" /></div>` : ''}
        ${cfg.showBank && (cfg.bankName || cfg.bankAccount) ? `<div style="margin-top:10px;font-size:11px;color:#334155;"><b>Bank</b><br/>${esc(cfg.bankName)} ${cfg.bankAccount ? `· A/C ${esc(cfg.bankAccount)}` : ''} ${cfg.bankIfsc ? `· IFSC ${esc(cfg.bankIfsc)}` : ''}</div>` : ''}
      </div>
      <div style="width:240px;flex-shrink:0;padding:10px 14px;">
        <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:12px;"><span style="color:#64748b;">Taxable</span><span>${(sale.subtotal || taxable).toFixed(2)}</span></div>
        ${sale.totalDiscount > 0 ? `<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:12px;color:#b91c1c;"><span>Discount</span><span>(-) ${sale.totalDiscount.toFixed(2)}</span></div>` : ''}
        ${showTax && totalTax > 0 ? `
          <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:12px;"><span style="color:#64748b;">CGST</span><span>${cgst.toFixed(2)}</span></div>
          <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:12px;"><span style="color:#64748b;">SGST</span><span>${sgst.toFixed(2)}</span></div>
        ` : ''}
        <div style="display:flex;justify-content:space-between;padding:8px 0;border-top:2px solid ${colors.primary};border-bottom:1px solid ${colors.primary};font-size:14px;font-weight:900;color:${colors.primary};">
          <span>Total</span><span>₹${billTotal.toFixed(2)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:12px;"><span style="color:#64748b;">Paid (${esc(methodLabel)})</span><span>${paymentMade.toFixed(2)}</span></div>
        <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:13px;font-weight:800;"><span>Balance</span><span>₹${balanceDue.toFixed(2)}</span></div>
      </div>
    </div>
  `

  const terms = cfg.showTerms && cfg.termsText
    ? `<div style="padding:10px 16px;background:#f8fafc;border-top:1px solid #e5e7eb;">
        <div style="font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:${colors.accent};font-weight:800;margin-bottom:4px;">Terms &amp; conditions</div>
        <div style="font-size:10px;color:#475569;line-height:1.45;">${nl2br(cfg.termsText)}</div>
      </div>`
    : ''

  const sign = `<div style="display:flex;justify-content:space-between;padding:14px 16px 18px;">
    <div style="font-size:10px;color:#94a3b8;">Original for recipient</div>
    <div style="text-align:center;min-width:180px;">
      <div style="height:36px;"></div>
      <div style="border-top:1px solid ${colors.primary};padding-top:4px;font-size:11px;font-weight:700;color:${colors.primary};">${esc(cfg.signatureName)}</div>
      <div style="font-size:10px;color:#64748b;">For ${esc(companyName)}</div>
    </div>
  </div>`

  return `<div style="font-family:Arial,Helvetica,sans-serif;color:${colors.ink};width:100%;min-height:267mm;box-sizing:border-box;border:1px solid #cbd5e1;background:#fff;">
    ${header}
    ${gstStrip(cfg, companyGSTIN, colors)}
    <div style="display:flex;border-bottom:1px solid #e5e7eb;">
      <div style="flex:1;padding:12px 16px;">${billTo}</div>
    </div>
    ${metaGrid(cfg, [], colors)}
    <table style="width:100%;border-collapse:collapse;">
      <thead>${tableHead}</thead>
      <tbody>${itemRows || `<tr><td colspan="${colCount}" style="padding:16px;text-align:center;color:#94a3b8;">No items</td></tr>`}</tbody>
    </table>
    ${totals}
    ${sign}
    ${terms}
  </div>`
}
