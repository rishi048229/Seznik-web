import { describe, it, expect } from 'vitest'
import {
  interpolateReceiptVariables,
  compileCustomReceiptTextLines,
  resolveActiveCustomTemplate,
  renderCompactTableItemLines,
  wrapCompactTableName,
  compactTableNameWidth,
  resolveCompactTableWrap,
  SAMPLE_RECEIPT_CONTEXT,
} from '@/utils/customReceiptEngine'
import { mergeReceiptConfig } from '@/utils/mergeReceiptConfig'
import { createDefaultReceiptTemplate } from '@/types/customReceipt'
import { createRestaurantReceiptTemplate } from '@/utils/restaurantReceiptTemplate'
import { getCols } from '@/utils/receiptEngine'

describe('customReceiptEngine', () => {
  it('interpolates store variables', () => {
    const out = interpolateReceiptVariables('Bill {{invoice_no}} — {{store_name}}', SAMPLE_RECEIPT_CONTEXT)
    expect(out).toContain('INV-2026-0042')
    expect(out).toContain('SEZNIK SUPERSTORE')
  })

  it('skips disabled blocks in compile', () => {
    const tpl = createDefaultReceiptTemplate('Test')
    tpl.entries = [
      { id: '1', type: 'text', enabled: false, text: 'HIDDEN', size: 'medium', align: 'center' },
      { id: '2', type: 'text', enabled: true, text: 'VISIBLE', size: 'medium', align: 'center' },
    ]
    const lines = compileCustomReceiptTextLines(tpl, SAMPLE_RECEIPT_CONTEXT, '58mm')
    expect(lines.some((l) => l.includes('HIDDEN'))).toBe(false)
    expect(lines.some((l) => l.includes('VISIBLE'))).toBe(true)
  })

  it('resolves active custom template', () => {
    const tpl = createDefaultReceiptTemplate('Active')
    const active = resolveActiveCustomTemplate({
      customTemplates: [tpl],
      activeCustomTemplateId: tpl.id,
    })
    expect(active?.id).toBe(tpl.id)
  })

  it('falls back to first template when none active', () => {
    const tpl = createDefaultReceiptTemplate('Default')
    const active = resolveActiveCustomTemplate({ customTemplates: [tpl] })
    expect(active?.id).toBe(tpl.id)
  })

  it('tax_invoice vs slab_wise produce different custom template tax sections', () => {
    const tpl = createDefaultReceiptTemplate('GST Test')
    const taxInvoice = compileCustomReceiptTextLines(tpl, SAMPLE_RECEIPT_CONTEXT, '58mm', {
      showTaxBreakdown: true,
      gstStyle: 'tax_invoice',
    })
    const slabWise = compileCustomReceiptTextLines(tpl, SAMPLE_RECEIPT_CONTEXT, '58mm', {
      showTaxBreakdown: true,
      gstStyle: 'slab_wise',
    })
    expect(taxInvoice.some((l) => l.includes('Taxable Value'))).toBe(true)
    expect(slabWise.some((l) => l.includes('Taxable @'))).toBe(true)
    expect(taxInvoice.some((l) => l.includes('Taxable @'))).toBe(false)
  })

  it('compact custom template prints one GST line', () => {
    const tpl = createDefaultReceiptTemplate('Compact')
    const lines = compileCustomReceiptTextLines(tpl, SAMPLE_RECEIPT_CONTEXT, '58mm', {
      showTaxBreakdown: true,
      gstStyle: 'compact',
    })
    const gstLines = lines.filter((l) => l.includes('GST') && !l.includes('% GST'))
    expect(gstLines.length).toBeGreaterThanOrEqual(1)
    expect(lines.some((l) => l.includes('Taxable Value'))).toBe(false)
  })

  it('table items keep name and amount on separate lines', () => {
    const tpl = createDefaultReceiptTemplate('Table layout')
    const data = {
      ...SAMPLE_RECEIPT_CONTEXT,
      items: [
        {
          productName: 'Very Long Product Name That Should Not Share A Line With Price',
          quantity: 2,
          unitPrice: 123456.78,
          total: 246913.56,
          unit: 'Pc',
          gstRate: 18,
        },
      ],
    }
    const lines = compileCustomReceiptTextLines(tpl, data, '58mm', { itemWiseGst: true })
    const nameLineIdx = lines.findIndex((l) => l.includes('Very Long Product'))
    expect(nameLineIdx).toBeGreaterThanOrEqual(0)
    const amountLine = lines.find((l) => l.trimEnd().endsWith('246913.56'))
    expect(amountLine).toBeDefined()
    expect(amountLine).not.toContain('Very Long Product')
  })

  it('does not number line items unless the store is a restaurant or the table opts in', () => {
    const tpl = createDefaultReceiptTemplate('Numbers')
    const retail = compileCustomReceiptTextLines(tpl, SAMPLE_RECEIPT_CONTEXT, '58mm')
    expect(retail.some((l) => l.startsWith('1. '))).toBe(false)

    const restaurant = compileCustomReceiptTextLines(tpl, SAMPLE_RECEIPT_CONTEXT, '58mm', { isRestaurant: true })
    expect(restaurant.some((l) => l.includes('1. Premium Basmati'))).toBe(true)
  })

  it('interpolates restaurant token and table fields', () => {
    const out = interpolateReceiptVariables('Token {{token_no}} / TNo {{table_no}}', {
      ...SAMPLE_RECEIPT_CONTEXT,
      tokenNo: '42',
      tableNo: '12',
    })
    expect(out).toBe('Token 42 / TNo 12')
  })

  it('compact restaurant table keeps short names on one line', () => {
    const tpl = createRestaurantReceiptTemplate()
    const data = {
      ...SAMPLE_RECEIPT_CONTEXT,
      items: [{ productName: 'Butter Naan', quantity: 2, unitPrice: 55, total: 110 }],
    }
    const lines = compileCustomReceiptTextLines(tpl, data, '58mm', { isRestaurant: true })
    const itemLine = lines.find((l) => l.includes('BUTTER NAAN'))
    expect(itemLine).toBeDefined()
    expect(itemLine).toContain('2')
    expect(itemLine).toContain('110.00')
  })

  it('compact restaurant table wraps long dish names without truncation', () => {
    const longName = 'Aloo Pyaaz Parantha With Extra Butter'
    const width = getCols('58mm')
    const itemLines = renderCompactTableItemLines(
      { productName: longName, quantity: 1, unitPrice: 55, total: 55 },
      width,
      true
    )
    expect(itemLines.length).toBeGreaterThan(1)
    expect(itemLines.join('\n')).toContain('ALOO')
    expect(itemLines.join('\n')).toContain('BUTTER')
    expect(itemLines[0]?.trimEnd()).toMatch(/1\s+55\.00$/)

    const tpl = createRestaurantReceiptTemplate()
    const compiled = compileCustomReceiptTextLines(
      tpl,
      {
        ...SAMPLE_RECEIPT_CONTEXT,
        items: [{ productName: longName, quantity: 1, unitPrice: 55, total: 55 }],
      },
      '58mm',
      { isRestaurant: true }
    )
    const joined = compiled.join('\n')
    expect(joined).toContain('ALOO')
    expect(joined).toContain('BUTTER')
    expect(joined).toMatch(/1\s+55\.00/)
  })

  it('compact restaurant table wraps long names on 80mm without column drift', () => {
    const longName = 'Paneer Butter Masala Special Chef Recipe Large Portion'
    const width = getCols('80mm')
    const itemLines = renderCompactTableItemLines(
      { productName: longName, quantity: 2, unitPrice: 320, total: 640 },
      width,
      true
    )
    expect(itemLines.length).toBeGreaterThan(1)
    expect(itemLines[0]?.trimEnd()).toMatch(/2\s+640\.00$/)
  })

  it('wrapCompactTableName keeps words intact and respects name column width on 58mm', () => {
    const longName = 'Aloo Pyaaz Parantha With Extra Butter'
    const width = getCols('58mm')
    const nameWidth = compactTableNameWidth(width)
    const words = longName.toUpperCase().split(/\s+/)
    const wrapped = wrapCompactTableName(longName.toUpperCase(), nameWidth)

    expect(nameWidth).toBe(18)
    words.forEach((word) => {
      expect(wrapped.join(' ')).toContain(word)
      expect(wrapped.some((line) => line.split(/\s+/).includes(word))).toBe(true)
    })
    wrapped.forEach((line) => {
      const lineWords = line.split(/\s+/)
      const isSingleOversizedWord = lineWords.length === 1 && lineWords[0]!.length > nameWidth
      expect(isSingleOversizedWord || line.length <= nameWidth).toBe(true)
    })
    expect(wrapped.some((line) => line.split(/\s+/).includes('PARAN'))).toBe(false)
  })

  it('wrapCompactTableName respects name column width on 80mm', () => {
    const longName = 'Paneer Butter Masala Special Chef Recipe Large Portion'
    const width = getCols('80mm')
    const nameWidth = compactTableNameWidth(width)
    const wrapped = wrapCompactTableName(longName.toUpperCase(), nameWidth)

    expect(nameWidth).toBe(34)
    wrapped.forEach((line) => {
      const lineWords = line.split(/\s+/)
      const isSingleOversizedWord = lineWords.length === 1 && lineWords[0]!.length > nameWidth
      expect(isSingleOversizedWord || line.length <= nameWidth).toBe(true)
    })
  })

  it('wrapCompactTableName puts oversized single word on its own line', () => {
    const nameWidth = compactTableNameWidth(getCols('58mm'))
    const wrapped = wrapCompactTableName('SUPERLONGDISHNAME', nameWidth)
    expect(wrapped).toEqual(['SUPERLONGDISHNAME'])
  })

  it('compact table name lines stay within name column before qty row', () => {
    const longName = 'Aloo Pyaaz Parantha With Extra Butter'
    const width = getCols('58mm')
    const nameWidth = compactTableNameWidth(width)
    const itemLines = renderCompactTableItemLines(
      { productName: longName, quantity: 1, unitPrice: 55, total: 55 },
      width,
      true
    )
    const continuationLines = itemLines.slice(1)
    continuationLines.forEach((line) => {
      const trimmed = line.trimEnd()
      const lineWords = trimmed.split(/\s+/)
      const isSingleOversizedWord = lineWords.length === 1 && lineWords[0]!.length > nameWidth
      expect(isSingleOversizedWord || trimmed.length <= nameWidth).toBe(true)
    })
    expect(itemLines[0]?.trimEnd()).toMatch(/1\s+55\.00$/)
  })

  it('compact advanced table does not wrap long names for retail templates', () => {
    const longName = 'Aloo Pyaaz Parantha With Extra Butter'
    const width = getCols('58mm')
    const itemLines = renderCompactTableItemLines(
      { productName: longName, quantity: 1, unitPrice: 55, total: 55 },
      width,
      false
    )
    expect(itemLines).toHaveLength(1)
    expect(itemLines[0]?.trimEnd()).toMatch(/1\s+55\.00$/)
    expect(itemLines[0]).not.toContain('EXTRA BUTTER')

    const tpl = createDefaultReceiptTemplate('Retail compact')
    tpl.entries = tpl.entries.map((entry) =>
      entry.type === 'table' ? { ...entry, tableType: 'advanced' as const } : entry
    )
    const compiled = compileCustomReceiptTextLines(
      tpl,
      {
        ...SAMPLE_RECEIPT_CONTEXT,
        items: [{ productName: longName, quantity: 1, unitPrice: 55, total: 55 }],
      },
      '58mm',
      { isRestaurant: false }
    )
    const joined = compiled.join('\n')
    expect(joined).not.toMatch(/EXTRA BUTTER/)
    expect(joined).toMatch(/1\s+55\.00/)
  })

  it('restaurant receipt template wraps long names even without isRestaurant flag', () => {
    const longName = 'Aloo Pyaaz Parantha With Extra Butter'
    const tpl = createRestaurantReceiptTemplate()
    expect(resolveCompactTableWrap({ isRestaurant: false }, tpl)).toBe(true)

    const compiled = compileCustomReceiptTextLines(
      tpl,
      {
        ...SAMPLE_RECEIPT_CONTEXT,
        items: [{ productName: longName, quantity: 1, unitPrice: 55, total: 55 }],
      },
      '58mm',
      { isRestaurant: false }
    )
    const joined = compiled.join('\n')
    expect(joined).toContain('EXTRA BUTTER')
    expect(joined).toMatch(/1\s+55\.00/)
  })
})

describe('mergeReceiptConfig', () => {
  it('preserves untouched fields and merges templates', () => {
    const existing = {
      companyName: 'Shop',
      showTaxBreakdown: true,
      customTemplates: [{ id: 'a', name: 'A', updatedAt: '2026-01-01T00:00:00.000Z', paperWidth: '58mm' as const, entries: [], createdAt: '2026-01-01' }],
    }
    const merged = mergeReceiptConfig(existing, {
      companyName: 'New Shop',
      customTemplates: [{ id: 'b', name: 'B', updatedAt: '2026-02-01T00:00:00.000Z', paperWidth: '58mm' as const, entries: [], createdAt: '2026-02-01' }],
    })
    expect(merged.companyName).toBe('New Shop')
    expect(merged.showTaxBreakdown).toBe(true)
    expect(merged.customTemplates?.length).toBe(2)
  })
})
