import { describe, expect, it } from 'vitest'
import * as XLSX from 'xlsx'
import { normalizeUnit } from '../bulkTemplateGenerator'

/** Minimal mirror of BulkProductUploadModal header detection for regression tests. */
function parseSheetRows(sheet: XLSX.WorkSheet): Array<{ name: string; costPrice: number; sellingPrice: number; unit: string }> {
  const jsonRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '', raw: false })
  if (!jsonRows.length) return []
  const keys = Object.keys(jsonRows[0])
  const nameKey = keys.find((k) => /product name/i.test(k))
  const costKey = keys.find((k) => /cost price/i.test(k))
  const sellKey = keys.find((k) => /selling price/i.test(k))
  const unitKey = keys.find((k) => /^unit/i.test(k))
  if (!nameKey || !costKey || !sellKey) return []

  return jsonRows
    .map((row) => ({
      name: String(row[nameKey] ?? '').trim(),
      costPrice: Number(String(row[costKey] ?? '').replace(/,/g, '')) || 0,
      sellingPrice: Number(String(row[sellKey] ?? '').replace(/,/g, '')) || 0,
      unit: normalizeUnit(String(row[unitKey ?? ''] ?? '')),
    }))
    .filter((r) => r.name.length > 0)
}

describe('bulk spreadsheet parse (template shape)', () => {
  it('reads a template-shaped worksheet', () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ['Product Name*', 'Category*', 'Cost Price*', 'Selling Price*', 'Stock Quantity*', 'Unit*'],
      ['Demo Tea 100g', 'Beverages', '40', '55', '10', 'piece'],
    ])
    const rows = parseSheetRows(ws)
    expect(rows).toHaveLength(1)
    expect(rows[0].name).toBe('Demo Tea 100g')
    expect(rows[0].costPrice).toBe(40)
    expect(rows[0].sellingPrice).toBe(55)
    expect(rows[0].unit).toBe('piece')
  })
})
