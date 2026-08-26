import { describe, it, expect } from 'vitest'
import {
  parseTemplateText,
  serializeTemplateRuns,
  humanizeTemplateText,
  insertFieldAt,
  parseTemplateSide,
  serializeTemplateSide,
  unwrapTemplateKey,
  wrapTemplateKey,
  isOnlyTemplateVar,
  containsTemplateVar,
} from '@/utils/receiptTemplateTokens'

describe('receiptTemplateTokens', () => {
  it('parses mixed text and fields', () => {
    expect(parseTemplateText('Bill {{invoice_no}} — {{store_name}}')).toEqual([
      { kind: 'text', value: 'Bill ' },
      { kind: 'field', key: 'invoice_no' },
      { kind: 'text', value: ' — ' },
      { kind: 'field', key: 'store_name' },
    ])
  })

  it('round-trips serialize(parse(text))', () => {
    const samples = [
      '',
      'Thank you! Visit again.',
      '{{store_name}}',
      'Invoice: {{invoice_no}}',
      '-{{discount}}',
      '{{store_address}}\nPh: {{store_phone}}\nGSTIN: {{store_gstin}}',
      'Bill {{invoice_no}} — {{store_name}}',
      '{{foo}}',
    ]
    for (const sample of samples) {
      expect(serializeTemplateRuns(parseTemplateText(sample))).toBe(sample)
    }
  })

  it('keeps unknown variables as fields', () => {
    expect(parseTemplateText('Ref {{foo}}')).toEqual([
      { kind: 'text', value: 'Ref ' },
      { kind: 'field', key: 'foo' },
    ])
    expect(humanizeTemplateText('Ref {{foo}}')).toBe('Ref Foo')
  })

  it('humanizes known labels without braces', () => {
    expect(humanizeTemplateText('{{store_name}}')).toBe('Store Name')
    expect(humanizeTemplateText('Invoice: {{invoice_no}}')).toBe('Invoice: Invoice / Bill No')
    expect(humanizeTemplateText('-{{discount}}')).toBe('-Total Discount')
  })

  it('inserts a field at the caret', () => {
    expect(insertFieldAt('Invoice: ', 'invoice_no', 9)).toBe('Invoice: {{invoice_no}}')
    expect(insertFieldAt('ab', 'date', 1, 1)).toBe('a{{date}}b')
  })

  it('parses a label + single field side', () => {
    expect(parseTemplateSide('Invoice: {{invoice_no}}')).toEqual({
      prefix: 'Invoice: ',
      fieldKey: 'invoice_no',
      complex: false,
    })
    expect(parseTemplateSide('{{date}}')).toEqual({
      prefix: '',
      fieldKey: 'date',
      complex: false,
    })
    expect(parseTemplateSide('-{{discount}}')).toEqual({
      prefix: '-',
      fieldKey: 'discount',
      complex: false,
    })
    expect(serializeTemplateSide({ prefix: 'Invoice: ', fieldKey: 'invoice_no', complex: false })).toBe(
      'Invoice: {{invoice_no}}'
    )
  })

  it('unwraps and wraps keys', () => {
    expect(unwrapTemplateKey('{{store_name}}')).toBe('store_name')
    expect(wrapTemplateKey('store_name')).toBe('{{store_name}}')
    expect(isOnlyTemplateVar('  {{footer_message}}  ', 'footer_message')).toBe(true)
    expect(containsTemplateVar('GSTIN: {{store_gstin}}', 'store_gstin')).toBe(true)
    expect(containsTemplateVar('GSTIN: {{store_gstin}}', 'store_name')).toBe(false)
  })
})
