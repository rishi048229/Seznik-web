import { describe, expect, it } from 'vitest'
import { normalizeUnit } from '../bulkTemplateGenerator'

describe('normalizeUnit', () => {
  it('maps common spreadsheet unit labels', () => {
    expect(normalizeUnit('pcs')).toBe('piece')
    expect(normalizeUnit('KG')).toBe('kg')
    expect(normalizeUnit('doz')).toBe('dozen')
    expect(normalizeUnit('7')).toBe('box')
  })

  it('defaults empty values to piece', () => {
    expect(normalizeUnit('')).toBe('piece')
    expect(normalizeUnit(undefined)).toBe('piece')
  })
})
