import { describe, expect, it } from 'vitest'
import { generateLabelEscPos, defaultLabelTemplate } from '../labelPrint'
import { LABEL_SIZE_PRESETS, labelContentCssTransform, snapLabelPreset } from '../labelSizes'

const sample = {
  businessName: 'Rohan KI dukan',
  productName: 'MI Phone',
  price: 'Rs. 7,000.00',
  barcodeValue: 'SZ245681757928',
}

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

  it('scales 90° invert so content still fits the original sticker', () => {
    expect(labelContentCssTransform(90, 50, 30)).toContain('rotate(90deg)')
    expect(labelContentCssTransform(90, 50, 30)).toContain('scale(0.6)')
    expect(labelContentCssTransform(180, 50, 30)).toBe('rotate(180deg)')
    expect(labelContentCssTransform(0, 50, 30)).toBe('none')
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
