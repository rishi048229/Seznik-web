import { describe, it, expect } from 'vitest'
import {
  interpolateReceiptVariables,
  compileCustomReceiptTextLines,
  resolveActiveCustomTemplate,
  SAMPLE_RECEIPT_CONTEXT,
} from '@/utils/customReceiptEngine'
import { mergeReceiptConfig } from '@/utils/mergeReceiptConfig'
import { createDefaultReceiptTemplate } from '@/types/customReceipt'

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
