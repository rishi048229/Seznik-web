import type { Sale, SaleItem } from '@/types/sale.types'
import type { ReceiptConfig } from '@/types/settings.types'

export interface CompileReceiptParams {
  sale: Sale
  receiptConfig?: Partial<ReceiptConfig> | null
  businessName?: string
  businessAddress?: string
  businessPhone?: string
  businessGSTIN?: string
  customerName?: string
  paperSize?: '58mm' | '80mm' | string
  widthDots?: number
  pricesIncludeGst?: boolean
  cashierName?: string
  isDuplicate?: boolean
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Column Primitives & Formatting
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Derives column width: 32 for 58mm (384 dots), 48 for 80mm (576 dots)
 */
export function getCols(paperSize?: string, widthDots?: number): number {
  if (widthDots && widthDots > 0) return Math.floor(widthDots / 12)
  if (paperSize === '80mm') return 48
  return 32
}

/**
 * Left label, right value, padded to exactly totalCols.
 * Truncates left text if overflowing so right-aligned numeric value is preserved.
 */
export function row(left: string, right: string, totalCols: number): string {
  const rightStr = (right ?? '').toString()
  const availableLeft = totalCols - rightStr.length - 1
  if (availableLeft < 1) {
    return rightStr.slice(-totalCols).padStart(totalCols, ' ')
  }
  const leftStr = left.length > availableLeft ? left.slice(0, availableLeft) : left
  const padding = totalCols - leftStr.length - rightStr.length
  return leftStr + ' '.repeat(Math.max(0, padding)) + rightStr
}

export interface ColField {
  text: string
  width: number
  align?: 'L' | 'R'
}

/**
 * Formats multiple fields into a line of length totalCols.
 */
export function cols(fields: ColField[], totalCols: number): string {
  let result = ''
  for (let i = 0; i < fields.length; i++) {
    const f = fields[i]
    const align = f.align || 'L'
    const textStr = (f.text ?? '').toString()

    let cell = ''
    if (textStr.length > f.width) {
      cell = textStr.slice(0, f.width)
    } else if (align === 'R') {
      cell = textStr.padStart(f.width, ' ')
    } else {
      cell = textStr.padEnd(f.width, ' ')
    }
    result += cell
  }

  if (result.length < totalCols) {
    result = result.padEnd(totalCols, ' ')
  } else if (result.length > totalCols) {
    result = result.slice(0, totalCols)
  }

  return result
}

/**
 * Repeat char to exactly totalCols.
 */
export function divider(char: '-' | '=', totalCols: number): string {
  return char.repeat(totalCols)
}

/**
 * Center text padded to exactly totalCols.
 */
export function centerText(text: string, totalCols: number): string {
  const clean = (text ?? '').trim().slice(0, totalCols)
  const totalPadding = totalCols - clean.length
  const leftPadding = Math.floor(totalPadding / 2)
  const rightPadding = totalPadding - leftPadding
  return ' '.repeat(leftPadding) + clean + ' '.repeat(rightPadding)
}

/**
 * Formats numbers > 5 digits in Indian style: 1,23,456.00
 */
export function formatIndianNumber(num: number): string {
  const isNegative = num < 0
  const absNum = Math.abs(num)
  const fixed = absNum.toFixed(2)
  const [integerPart, decimalPart] = fixed.split('.')

  if (integerPart.length <= 3) {
    return (isNegative ? '-' : '') + integerPart + '.' + decimalPart
  }

  const lastThree = integerPart.slice(-3)
  const otherNumbers = integerPart.slice(0, -3)
  const formattedOthers = otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ',')

  return (isNegative ? '-' : '') + formattedOthers + ',' + lastThree + '.' + decimalPart
}

/**
 * Indian Numbering system to Words (e.g. Rupees Three Hundred Forty Only)
 */
export function numberToIndianWords(amount: number): string {
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

  const rupees = Math.floor(Math.abs(amount))
  const paise = Math.round((Math.abs(amount) - rupees) * 100)
  let result = toWords(rupees).trim()
  if (paise > 0) result += ` and ${toWords(paise).trim()} Paise`
  return 'Rupees ' + (result || 'Zero') + ' Only'
}

/**
 * Wraps text into lines padded to totalCols.
 */
export function wrapProse(text: string, totalCols: number, alignCenter = false): string[] {
  if (!text) return []
  const words = text.split(/\s+/)
  const lines: string[] = []
  let currentLine = ''

  for (const word of words) {
    if (!word) continue
    if ((currentLine + (currentLine ? ' ' : '') + word).length <= totalCols) {
      currentLine += (currentLine ? ' ' : '') + word
    } else {
      if (currentLine) lines.push(alignCenter ? centerText(currentLine, totalCols) : currentLine.padEnd(totalCols, ' '))
      currentLine = word.slice(0, totalCols)
    }
  }
  if (currentLine) {
    lines.push(alignCenter ? centerText(currentLine, totalCols) : currentLine.padEnd(totalCols, ' '))
  }

  return lines
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Document Title & Tax Calculation Engine
// ─────────────────────────────────────────────────────────────────────────────

export function getDocumentTitle(gstin?: string | null, items: { taxRate?: number | null }[] = []): string {
  const cleanGstin = gstin?.trim()
  if (!cleanGstin) return 'BILL'
  const hasTax = items.some(item => (item.taxRate || 0) > 0)
  if (!hasTax) return 'BILL OF SUPPLY'
  return 'TAX INVOICE'
}

export interface GstTaxGroup {
  taxRate: number
  taxableAmount: number
  totalTax: number
  cgst: number
  sgst: number
}

export interface ReceiptTotalsResult {
  docTitle: string
  subTotal: number
  totalDiscount: number
  taxableAmount: number
  totalTax: number
  cgstTotal: number
  sgstTotal: number
  rawGrandTotal: number
  finalGrandTotal: number
  roundOff: number
  taxGroups: GstTaxGroup[]
  totalQty: number
  itemCount: number
}

export function calculateReceiptTotals(
  sale: Sale,
  gstin?: string | null,
  pricesIncludeGst = true
): ReceiptTotalsResult {
  const items = sale.items ?? []
  const docTitle = getDocumentTitle(gstin, items)
  const isTaxInvoice = docTitle === 'TAX INVOICE'

  let totalQty = 0
  let rawSubTotal = 0
  let itemDiscounts = 0

  items.forEach(item => {
    totalQty += item.quantity
    rawSubTotal += item.sellingPrice * item.quantity
    itemDiscounts += (item.discount || 0)
  })

  const subTotal = sale.subtotal || rawSubTotal
  const totalDiscount = sale.totalDiscount || itemDiscounts
  const orderDiscount = Math.max(0, totalDiscount - itemDiscounts)

  // Group items by taxRate (accounting for both item discounts and proportional order discount)
  const groupMap = new Map<number, number>() // rate -> sum of line net amounts

  items.forEach(item => {
    const rate = isTaxInvoice ? (item.taxRate || 0) : 0
    const lineNetBeforeOrderDisc = item.sellingPrice * item.quantity - (item.discount || 0)
    const lineOrderDisc = rawSubTotal > 0 ? (lineNetBeforeOrderDisc / rawSubTotal) * orderDiscount : 0
    const lineNet = lineNetBeforeOrderDisc - lineOrderDisc
    groupMap.set(rate, (groupMap.get(rate) || 0) + lineNet)
  })

  const taxGroups: GstTaxGroup[] = []
  let taxableSum = 0
  let totalTaxSum = 0
  let cgstSum = 0
  let sgstSum = 0

  if (isTaxInvoice) {
    Array.from(groupMap.entries())
      .sort((a, b) => a[0] - b[0])
      .forEach(([rate, groupAmt]) => {
        let taxable = 0
        let tax = 0

        if (rate === 0) {
          taxable = groupAmt
          tax = 0
        } else if (pricesIncludeGst) {
          taxable = groupAmt / (1 + rate / 100)
          tax = groupAmt - taxable
        } else {
          taxable = groupAmt
          tax = groupAmt * (rate / 100)
        }

        taxable = Number(taxable.toFixed(2))
        tax = Number(tax.toFixed(2))

        // Split tax evenly into CGST and SGST
        let sgst = Number((tax / 2).toFixed(2))
        let cgst = Number((tax - sgst).toFixed(2)) // Put any odd 1 paisa rounding on CGST

        if (rate > 0) {
          taxGroups.push({
            taxRate: rate,
            taxableAmount: taxable,
            totalTax: tax,
            cgst,
            sgst
          })
        }

        taxableSum += taxable
        totalTaxSum += tax
        cgstSum += cgst
        sgstSum += sgst
      })
  }

  const netPayableBeforeTax = subTotal - totalDiscount
  const taxableAmount = isTaxInvoice ? Number(taxableSum.toFixed(2)) : netPayableBeforeTax
  const totalTax = isTaxInvoice ? Number(totalTaxSum.toFixed(2)) : 0
  const cgstTotal = isTaxInvoice ? Number(cgstSum.toFixed(2)) : 0
  const sgstTotal = isTaxInvoice ? Number(sgstSum.toFixed(2)) : 0

  const rawGrandTotal = pricesIncludeGst
    ? netPayableBeforeTax
    : (netPayableBeforeTax + totalTax)

  const finalGrandTotal = Math.round(rawGrandTotal)
  const roundOff = Number((finalGrandTotal - rawGrandTotal).toFixed(2))

  return {
    docTitle,
    subTotal,
    totalDiscount,
    taxableAmount,
    totalTax,
    cgstTotal,
    sgstTotal,
    rawGrandTotal,
    finalGrandTotal,
    roundOff,
    taxGroups,
    totalQty,
    itemCount: items.length
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Receipt Text Lines Compiler (Guarantees every line.length === COLS)
// ─────────────────────────────────────────────────────────────────────────────

export function compileReceiptTextLines(params: CompileReceiptParams): string[] {
  const {
    sale,
    receiptConfig,
    businessName,
    businessAddress,
    businessPhone,
    businessGSTIN,
    customerName,
    paperSize = '58mm',
    widthDots,
    pricesIncludeGst = true,
    cashierName,
    isDuplicate = false,
  } = params

  const COLS = getCols(paperSize, widthDots)
  const lines: string[] = []

  // Extract all user customization switches
  const showCompanyHeader = receiptConfig?.showCompanyHeader ?? true
  const showAddress = receiptConfig?.showAddress ?? true
  const showPhone = receiptConfig?.showPhone ?? true
  const showGSTIN = receiptConfig?.showGSTIN ?? true
  const showCustomerDetails = receiptConfig?.showCustomerDetails ?? true
  const showInvoiceNoAndDate = receiptConfig?.showInvoiceNoAndDate ?? true
  const showTaxBreakdown = receiptConfig?.showTaxBreakdown ?? true
  const showSubtotalDiscount = receiptConfig?.showSubtotalDiscount ?? true
  const showFooterMessage = receiptConfig?.showFooterMessage ?? true
  const showTerms = receiptConfig?.showTerms ?? true
  const showBarcode = receiptConfig?.showBarcode ?? true
  const compactMode = receiptConfig?.compactMode ?? false

  const companyName = receiptConfig?.companyName || businessName || 'SEZNIK STORE'
  const companyAddr = receiptConfig?.address || businessAddress || ''
  const companyPh = receiptConfig?.phone || businessPhone || ''
  const companyGst = receiptConfig?.gstin || businessGSTIN || ''
  const footerText = receiptConfig?.footerMessage || 'Thank You! Visit Again'

  const totals = calculateReceiptTotals(sale, companyGst, pricesIncludeGst)

  // ── 1. HEADER ──
  if (showCompanyHeader) {
    if (companyName) lines.push(...wrapProse(companyName, COLS, true))
    if (showAddress && companyAddr) lines.push(...wrapProse(companyAddr, COLS, true))
    if (showPhone && companyPh) lines.push(centerText(`Ph: ${companyPh}`, COLS))
    if (showGSTIN && companyGst) lines.push(centerText(`GSTIN: ${companyGst}`, COLS))
    lines.push(divider('=', COLS))
  }

  const customTitle = receiptConfig?.headerTitle
  const titleText = (customTitle !== undefined && customTitle !== null)
    ? customTitle
    : totals.docTitle

  if (titleText) {
    lines.push(centerText(titleText, COLS))
    if (isDuplicate) {
      lines.push(centerText('*** DUPLICATE ***', COLS))
    }
    lines.push(divider('=', COLS))
  }

  // ── 2. META DETAILS ──
  if (showInvoiceNoAndDate || (showCustomerDetails && customerName)) {
    const dateObj = sale.createdAt ? new Date(sale.createdAt) : new Date()
    const dateStr = dateObj.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
    const timeStr = dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })

    if (showInvoiceNoAndDate) {
      if (compactMode) {
        lines.push(row(`Inv:#${sale.invoiceNumber || '---'}`, dateStr, COLS))
      } else {
        lines.push(row('Bill No :', sale.invoiceNumber || 'INV-00000', COLS))
        lines.push(row('Date    :', `${dateStr} ${timeStr}`, COLS))
        if (cashierName) lines.push(row('Cashier :', cashierName, COLS))
      }
    }
    if (showCustomerDetails && customerName) {
      lines.push(row('Customer:', customerName, COLS))
    }
    lines.push(divider('-', COLS))
  }

  // ── 3. ITEMS TABLE ──
  const items = sale.items ?? []

  if (COLS >= 48) {
    // 48-Column One-Line Layout
    lines.push(cols([
      { text: 'ITEM', width: 22, align: 'L' },
      { text: 'QTY', width: 5, align: 'R' },
      { text: 'GST', width: 5, align: 'R' },
      { text: 'RATE', width: 8, align: 'R' },
      { text: 'AMOUNT', width: 8, align: 'R' },
    ], COLS))
    lines.push(divider('-', COLS))

    items.forEach((item, index) => {
      const lineAmt = item.sellingPrice * item.quantity - (item.discount || 0)
      const gstStr = (totals.docTitle === 'TAX INVOICE' && item.taxRate && item.taxRate > 0)
        ? `${Math.round(item.taxRate * 100) / 100}%`
        : ''

      const nameWidth = 22
      const fullName = `${index + 1} ${item.productName}`

      const firstLineName = fullName.slice(0, nameWidth)
      lines.push(cols([
        { text: firstLineName, width: 22, align: 'L' },
        { text: item.quantity.toString(), width: 5, align: 'R' },
        { text: gstStr, width: 5, align: 'R' },
        { text: formatIndianNumber(item.sellingPrice), width: 8, align: 'R' },
        { text: formatIndianNumber(lineAmt), width: 8, align: 'R' },
      ], COLS))

      let remainingName = fullName.slice(nameWidth)
      while (remainingName.length > 0) {
        const chunk = '  ' + remainingName.slice(0, nameWidth - 2)
        remainingName = remainingName.slice(nameWidth - 2)
        lines.push(cols([
          { text: chunk, width: 22, align: 'L' },
          { text: '', width: 26, align: 'L' }
        ], COLS))
      }
    })
  } else {
    // 32-Column Two-Line Layout
    lines.push(row('ITEM', 'AMOUNT', COLS))
    lines.push(divider('-', COLS))

    items.forEach((item, index) => {
      const lineAmt = item.sellingPrice * item.quantity - (item.discount || 0)
      const gstStr = (totals.docTitle === 'TAX INVOICE' && item.taxRate && item.taxRate > 0)
        ? `${Math.round(item.taxRate * 100) / 100}%`
        : ''

      const fullName = `${index + 1} ${item.productName}`
      const nameLines = wrapProse(fullName, COLS, false)
      lines.push(...nameLines)

      const qtyRateStr = `${item.quantity} x ${formatIndianNumber(item.sellingPrice)}`
      lines.push(cols([
        { text: '  ', width: 2, align: 'L' },
        { text: qtyRateStr, width: 16, align: 'L' },
        { text: gstStr, width: 4, align: 'R' },
        { text: formatIndianNumber(lineAmt), width: 10, align: 'R' },
      ], COLS))
    })
  }

  lines.push(divider('-', COLS))

  // ── 4. TOTALS BLOCK ──
  if (showSubtotalDiscount) {
    lines.push(row('Sub Total', formatIndianNumber(totals.subTotal), COLS))
    if (totals.totalDiscount > 0) {
      lines.push(row('Discount', `-${formatIndianNumber(totals.totalDiscount)}`, COLS))
    }
    lines.push(divider('-', COLS))
  }

  if (showTaxBreakdown && totals.docTitle === 'TAX INVOICE' && totals.totalTax > 0) {
    lines.push(row('Taxable Value', formatIndianNumber(totals.taxableAmount), COLS))
    lines.push(row('  CGST', formatIndianNumber(totals.cgstTotal), COLS))
    lines.push(row('  SGST', formatIndianNumber(totals.sgstTotal), COLS))
    lines.push(divider('-', COLS))
  }

  if (totals.roundOff !== 0) {
    lines.push(row('Round Off', formatIndianNumber(totals.roundOff), COLS))
  }

  lines.push(divider('=', COLS))
  lines.push(row('GRAND TOTAL', formatIndianNumber(totals.finalGrandTotal), COLS))
  lines.push(divider('=', COLS))

  // ── 5. GST SUMMARY TABLE (TAX INVOICE ONLY) ──
  if (showTaxBreakdown && totals.docTitle === 'TAX INVOICE' && totals.taxGroups.length > 0) {
    lines.push(centerText('GST SUMMARY', COLS))
    if (COLS >= 48) {
      lines.push(cols([
        { text: 'Rate', width: 6, align: 'R' },
        { text: 'Taxable', width: 14, align: 'R' },
        { text: 'CGST', width: 14, align: 'R' },
        { text: 'SGST', width: 14, align: 'R' },
      ], COLS))
      totals.taxGroups.forEach(g => {
        lines.push(cols([
          { text: `${Math.round(g.taxRate * 100) / 100}%`, width: 6, align: 'R' },
          { text: formatIndianNumber(g.taxableAmount), width: 14, align: 'R' },
          { text: formatIndianNumber(g.cgst), width: 14, align: 'R' },
          { text: formatIndianNumber(g.sgst), width: 14, align: 'R' },
        ], COLS))
      })
    } else {
      lines.push(cols([
        { text: 'Rate', width: 4, align: 'R' },
        { text: 'Taxable', width: 10, align: 'R' },
        { text: 'CGST', width: 9, align: 'R' },
        { text: 'SGST', width: 9, align: 'R' },
      ], COLS))
      totals.taxGroups.forEach(g => {
        lines.push(cols([
          { text: `${Math.round(g.taxRate * 100) / 100}%`, width: 4, align: 'R' },
          { text: formatIndianNumber(g.taxableAmount), width: 10, align: 'R' },
          { text: formatIndianNumber(g.cgst), width: 9, align: 'R' },
          { text: formatIndianNumber(g.sgst), width: 9, align: 'R' },
        ], COLS))
      })
    }
    lines.push(divider('-', COLS))
  }

  // ── 6. SUMMARY STATS & PAYMENT ──
  lines.push(row(`Items: ${totals.itemCount}`, `Total Qty: ${totals.totalQty}`, COLS))
  const payMethodStr = (sale.paymentMethod || 'CASH').toUpperCase()
  lines.push(row('Payment:', payMethodStr, COLS))
  lines.push(divider('-', COLS))

  // ── 7. AMOUNT IN WORDS ──
  const wordsText = numberToIndianWords(totals.finalGrandTotal)
  lines.push(...wrapProse(wordsText, COLS, true))
  lines.push(divider('-', COLS))

  // ── 8. FOOTER & TERMS ──
  if (showFooterMessage && footerText) {
    lines.push(...wrapProse(footerText, COLS, true))
  }

  if (showTerms && (receiptConfig?.termsLine1 || receiptConfig?.termsLine2 || receiptConfig?.termsLine3)) {
    lines.push(divider('-', COLS))
    lines.push(centerText('Terms & Conditions', COLS))
    if (receiptConfig?.termsLine1) lines.push(...wrapProse(`1. ${receiptConfig.termsLine1}`, COLS, false))
    if (receiptConfig?.termsLine2) lines.push(...wrapProse(`2. ${receiptConfig.termsLine2}`, COLS, false))
    if (receiptConfig?.termsLine3) lines.push(...wrapProse(`3. ${receiptConfig.termsLine3}`, COLS, false))
  }

  if (showBarcode && sale.invoiceNumber) {
    lines.push(divider('-', COLS))
    lines.push(centerText('', COLS))
    lines.push(centerText(sale.invoiceNumber, COLS))
  }

  lines.push(divider('-', COLS))

  // Assert line length rule
  lines.forEach((l, idx) => {
    if (l.length !== COLS) {
      console.warn(`Line ${idx} length mismatch: expected ${COLS}, got ${l.length} ("${l}")`)
    }
  })

  return lines
}
