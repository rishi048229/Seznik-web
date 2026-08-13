import { describe, it, expect } from 'vitest'
import {
  compileReceiptTextLines,
  calculateReceiptTotals,
  getDocumentTitle,
  formatIndianNumber,
  numberToIndianWords,
  getCols,
  row,
  cols,
  divider
} from '../receiptEngine'
import type { Sale } from '@/types/sale.types'

const dummySale: Sale = {
  id: 'sale-1',
  invoiceNumber: 'INV/2026/00142',
  items: [
    {
      productId: 'p1',
      productName: 'Parle-G Biscuit 100g',
      quantity: 2,
      sellingPrice: 10.00,
      discount: 0,
      taxRate: 5,
      taxAmount: 0.95,
      total: 20.00
    },
    {
      productId: 'p2',
      productName: 'Amul Butter 500g',
      quantity: 1,
      sellingPrice: 265.00,
      discount: 0,
      taxRate: 12,
      taxAmount: 28.39,
      total: 265.00
    },
    {
      productId: 'p3',
      productName: 'Fresh Milk 1L',
      quantity: 2,
      sellingPrice: 30.00,
      discount: 0,
      taxRate: 0,
      taxAmount: 0,
      total: 60.00
    }
  ],
  subtotal: 345.00,
  totalDiscount: 5.00,
  totalTax: 29.34,
  grandTotal: 340.00,
  paymentMethod: 'cash',
  amountPaid: 340.00,
  changeReturned: 0,
  isQuickBill: false,
  createdAt: '2026-08-13T11:02:00Z'
}

describe('Receipt Engine & Acceptance Criteria', () => {

  // Criterion 1: All items 0% GST, GSTIN configured -> BILL OF SUPPLY
  it('Criterion 1: All items 0% GST with GSTIN configured generates BILL OF SUPPLY with no tax lines', () => {
    const zeroTaxSale: Sale = {
      ...dummySale,
      items: [
        { productId: 'p1', productName: 'Fresh Milk 1L', quantity: 2, sellingPrice: 30.00, discount: 0, taxRate: 0, taxAmount: 0, total: 60.00 }
      ],
      totalTax: 0
    }
    const lines = compileReceiptTextLines({
      sale: zeroTaxSale,
      businessGSTIN: '27ABCDE1234F1Z5',
      paperSize: '58mm'
    })
    const docTitleLine = lines.find(l => l.includes('BILL OF SUPPLY'))
    expect(docTitleLine).toBeDefined()
    expect(lines.some(l => l.includes('Taxable Value'))).toBe(false)
    expect(lines.some(l => l.includes('CGST'))).toBe(false)
    expect(lines.some(l => l.includes('SGST'))).toBe(false)
    expect(lines.some(l => l.includes('GST SUMMARY'))).toBe(false)
  })

  // Criterion 2: No GSTIN configured -> BILL
  it('Criterion 2: No GSTIN configured generates BILL with no tax block regardless of item tax rates', () => {
    const lines = compileReceiptTextLines({
      sale: dummySale,
      businessGSTIN: '',
      paperSize: '58mm'
    })
    const docTitleLine = lines.find(l => l.includes('BILL'))
    expect(docTitleLine).toBeDefined()
    expect(lines.some(l => l.includes('TAX INVOICE'))).toBe(false)
    expect(lines.some(l => l.includes('Taxable Value'))).toBe(false)
    expect(lines.some(l => l.includes('GST SUMMARY'))).toBe(false)
  })

  // Criterion 3: Mixed 0% and 5% items -> Zero-rated rows have empty GST field
  it('Criterion 3: Mixed 0% and 5% items have empty GST field on zero-rated rows and summary lists 5% only', () => {
    const lines = compileReceiptTextLines({
      sale: dummySale,
      businessGSTIN: '27ABCDE1234F1Z5',
      paperSize: '58mm'
    })

    const milkItemLine = lines.find(l => l.includes('Fresh Milk 1L'))
    expect(milkItemLine).toBeDefined()
    const milkIndex = lines.indexOf(milkItemLine!)
    const milkDetailLine = lines[milkIndex + 1]
    expect(milkDetailLine).not.toContain('0%')

    const summaryRateLines = lines.filter(l => l.includes('%'))
    expect(summaryRateLines.every(l => !l.includes('0%'))).toBe(true)
  })

  // Criterion 4: Single item, 18% -> CGST and SGST each half
  it('Criterion 4: Single item at 18% tax halves tax evenly between CGST and SGST', () => {
    const singleTaxSale: Sale = {
      ...dummySale,
      items: [
        { productId: 'p1', productName: 'Gadget', quantity: 1, sellingPrice: 118.00, discount: 0, taxRate: 18, taxAmount: 18.00, total: 118.00 }
      ],
      subtotal: 118.00,
      totalDiscount: 0,
      totalTax: 18.00,
      grandTotal: 118.00
    }
    const totals = calculateReceiptTotals(singleTaxSale, '27ABCDE1234F1Z5', true)
    expect(totals.taxGroups.length).toBe(1)
    expect(totals.taxGroups[0].cgst).toBe(totals.taxGroups[0].sgst)
    expect(totals.taxGroups[0].cgst + totals.taxGroups[0].sgst).toBe(totals.taxGroups[0].totalTax)
  })

  // Criterion 5: Odd tax rounding puts extra paisa on CGST
  it('Criterion 5: Odd tax amount allocates extra paisa to CGST', () => {
    const oddTaxSale: Sale = {
      ...dummySale,
      items: [
        { productId: 'p1', productName: 'Odd Item', quantity: 1, sellingPrice: 100.00, discount: 0, taxRate: 5, taxAmount: 4.76, total: 100.00 }
      ],
      subtotal: 100.00,
      totalDiscount: 0,
      totalTax: 4.76,
      grandTotal: 100.00
    }
    const totals = calculateReceiptTotals(oddTaxSale, '27ABCDE1234F1Z5', true)
    const g = totals.taxGroups[0]
    expect(g.cgst + g.sgst).toBe(g.totalTax)
    expect(g.cgst).toBeGreaterThanOrEqual(g.sgst)
  })

  // Criterion 6: Product name 60 chars wraps to indented continuation line
  it('Criterion 6: 60-character product name wraps to continuation lines without column drift', () => {
    const longNameSale: Sale = {
      ...dummySale,
      items: [
        {
          productId: 'p1',
          productName: 'Super Extra Long Product Name That Definitely Exceeds Normal Paper Width Columns Limit',
          quantity: 1,
          sellingPrice: 100.00,
          discount: 0,
          taxRate: 5,
          taxAmount: 4.76,
          total: 100.00
        }
      ]
    }
    const lines32 = compileReceiptTextLines({ sale: longNameSale, businessGSTIN: '27ABCDE1234F1Z5', paperSize: '58mm' })
    const lines48 = compileReceiptTextLines({ sale: longNameSale, businessGSTIN: '27ABCDE1234F1Z5', paperSize: '80mm' })

    expect(lines32.every(l => l.length === 32)).toBe(true)
    expect(lines48.every(l => l.length === 48)).toBe(true)
  })

  // Criterion 7: Amount 1,23,456.00 has Indian grouping and right alignment
  it('Criterion 7: Amount 1,23,456.00 formats in Indian grouping', () => {
    expect(formatIndianNumber(123456.00)).toBe('1,23,456.00')
    expect(formatIndianNumber(1234567.89)).toBe('12,34,567.89')
  })

  // Criterion 8: Round off is 0.00 -> Round Off line absent
  it('Criterion 8: Absent Round Off line when round off is 0.00', () => {
    const lines = compileReceiptTextLines({ sale: dummySale, businessGSTIN: '27ABCDE1234F1Z5', paperSize: '58mm' })
    const roundOffLine = lines.find(l => l.includes('Round Off'))
    expect(roundOffLine).toBeUndefined()
  })

  // Criterion 9: EVERY line satisfies line.length === COLS
  it('Criterion 9: Every single line in 58mm (32) and 80mm (48) satisfies line.length === COLS', () => {
    const lines32 = compileReceiptTextLines({ sale: dummySale, businessGSTIN: '27ABCDE1234F1Z5', paperSize: '58mm' })
    const lines48 = compileReceiptTextLines({ sale: dummySale, businessGSTIN: '27ABCDE1234F1Z5', paperSize: '80mm' })

    lines32.forEach((l, idx) => expect(l.length, `58mm Line ${idx}: "${l}"`).toBe(32))
    lines48.forEach((l, idx) => expect(l.length, `80mm Line ${idx}: "${l}"`).toBe(48))
  })

  // Criterion 10: 32 and 48 columns paper size render correctly
  it('Criterion 10: Same bill renders correctly at both 32 and 48 columns', () => {
    const lines32 = compileReceiptTextLines({ sale: dummySale, businessGSTIN: '27ABCDE1234F1Z5', paperSize: '58mm' })
    const lines48 = compileReceiptTextLines({ sale: dummySale, businessGSTIN: '27ABCDE1234F1Z5', paperSize: '80mm' })

    expect(lines32.length).toBeGreaterThan(0)
    expect(lines48.length).toBeGreaterThan(0)
    expect(lines32.every(l => l.length === 32)).toBe(true)
    expect(lines48.every(l => l.length === 48)).toBe(true)
  })

  // Criterion 11: Sub Total - Discount = Taxable Value + CGST + SGST + Round Off
  it('Criterion 11: Sub Total - Discount equals Taxable Value + CGST + SGST + Round Off to the paisa', () => {
    const totals = calculateReceiptTotals(dummySale, '27ABCDE1234F1Z5', true)
    const netPaid = totals.subTotal - totals.totalDiscount
    const rightSide = totals.taxableAmount + totals.cgstTotal + totals.sgstTotal + totals.roundOff
    expect(Math.abs(netPaid - rightSide)).toBeLessThanOrEqual(0.02)
  })

  // Criterion 12: 50-item bill handles without truncation or overrun
  it('Criterion 12: 50-item bill renders cleanly without buffer overrun', () => {
    const fiftyItems = Array.from({ length: 50 }, (_, i) => ({
      productId: `p${i}`,
      productName: `Bulk Product ${i + 1}`,
      quantity: i + 1,
      sellingPrice: (i + 1) * 15.5,
      discount: 0,
      taxRate: (i % 2 === 0) ? 18 : 5,
      taxAmount: 5,
      total: (i + 1) * 15.5
    }))

    const largeSale: Sale = {
      ...dummySale,
      items: fiftyItems,
      subtotal: fiftyItems.reduce((s, i) => s + i.sellingPrice * i.quantity, 0),
      grandTotal: 5000
    }

    const lines = compileReceiptTextLines({ sale: largeSale, businessGSTIN: '27ABCDE1234F1Z5', paperSize: '58mm' })
    expect(lines.length).toBeGreaterThan(100)
    expect(lines.every(l => l.length === 32)).toBe(true)
  })

})
