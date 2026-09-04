import { describe, expect, it } from 'vitest'
import { generateLabelEscPos, generateLabelTspl, defaultLabelTemplate, PRESET_RETAIL_DUAL_CODE } from '../labelPrint'
import { LABEL_SIZE_PRESETS, snapLabelPreset } from '../labelSizes'

const sample = {
  businessName: 'Rohan KI dukan',
  productName: 'MI Phone',
  price: 'Rs. 7,000.00',
  barcodeValue: 'SZ245681757928',
}

const decode = (bytes: Uint8Array) => new TextDecoder('latin1').decode(bytes)

describe('label presets', () => {
  it('keeps only the 50 mm family: 30, 25, 50, 75, 100', () => {
    expect(LABEL_SIZE_PRESETS.map(p => `${p.width}x${p.height}`)).toEqual([
      '50x30',
      '50x25',
      '50x50',
      '50x75',
      '50x100',
    ])
  })

  it('snaps old 40×30 / 60×40 sizes onto the 50 mm family', () => {
    expect(snapLabelPreset(40, 30).id).toBe('50x30')
    expect(snapLabelPreset(60, 40).id).toBe('50x30')
  })
})

describe('receipt-paper label gap', () => {
  it('feeds dots after each ESC/POS label so stickers are not flush', () => {
    const bytes = generateLabelEscPos(defaultLabelTemplate, 'CODE128', sample)
    const escJ = bytes.findIndex((_, i) => bytes[i] === 0x1b && bytes[i + 1] === 0x4a)
    expect(escJ).toBeGreaterThan(0)
    expect(bytes[escJ + 2]).toBeGreaterThanOrEqual(24)
  })
})

describe('dual barcode + QR', () => {
  it('prints the original side-by-side dual row', () => {
    const text = decode(generateLabelTspl(PRESET_RETAIL_DUAL_CODE, 'CODE128', sample, 50, 30))
    expect(text).toMatch(/BARCODE \d+,\d+,"128",28,2,0,/)
    expect(text).toMatch(/QRCODE \d+,\d+,L,3,A,0,/)
    expect(text).not.toContain('BITMAP')
  })
})
