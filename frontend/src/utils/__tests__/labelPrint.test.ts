import { describe, expect, it } from 'vitest'
import {
  generateLabelEscPos,
  generateLabelTspl,
  defaultLabelTemplate,
  PRESET_RETAIL_DUAL_CODE,
} from '../labelPrint'
import { LABEL_SIZE_PRESETS, labelContentCssTransform, labelContentBoxMm, snapLabelPreset } from '../labelSizes'

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

  it('rotates 90° with a swapped content box, not a shrink', () => {
    expect(labelContentBoxMm(90, 50, 30)).toEqual({ width: 30, height: 50 })
    expect(labelContentCssTransform(90, 50, 30)).toBe('rotate(90deg)')
    expect(labelContentCssTransform(90, 50, 30)).not.toContain('scale')
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

  it('rotates 90° with native TSPL TEXT, not a BITMAP negative', () => {
    const text = decode(generateLabelTspl(defaultLabelTemplate, 'CODE128', sample, 50, 30, 0, 0, 30, 0, 0, 90))
    expect(text).toContain('TEXT')
    expect(text).toMatch(/TEXT \d+,\d+,"\d+",90,/)
    expect(text).not.toContain('BITMAP')
  })

  it('rotates 180° ESC/POS with ESC { not a raster image', () => {
    const bytes = generateLabelEscPos(defaultLabelTemplate, 'CODE128', sample, { rotation: 180 })
    expect(bytes).toContain(0x7b)
    const gsV0 = bytes.findIndex((_, i) => bytes[i] === 0x1d && bytes[i + 1] === 0x76 && bytes[i + 2] === 0x30)
    expect(gsV0).toBe(-1)
  })
})

describe('label alignment and dual QR', () => {
  it('centers 0° text instead of pinning it to the left margin', () => {
    const text = decode(generateLabelTspl(defaultLabelTemplate, 'CODE128', sample, 50, 30))
    const match = text.match(/TEXT (\d+),(\d+),"2",0,/)
    expect(match).toBeTruthy()
    expect(Number(match![1])).toBeGreaterThan(40)
  })

  it.each([0, 90, 180, 270] as const)('prints barcode and QR on the sticker at %s°', (rotation) => {
    const text = decode(generateLabelTspl(PRESET_RETAIL_DUAL_CODE, 'CODE128', sample, 50, 30, 0, 0, 30, 0, 0, rotation))
    expect(text).toContain('BARCODE')
    expect(text).toContain('QRCODE')
    expect(text).not.toContain('BITMAP')
    const qr = text.match(/QRCODE (\d+),(\d+),L,(\d+),A,0,/)
    expect(qr).toBeTruthy()
    const x = Number(qr![1])
    const y = Number(qr![2])
    const cell = Number(qr![3])
    const size = 21 * cell
    expect(x).toBeGreaterThanOrEqual(0)
    expect(y).toBeGreaterThanOrEqual(0)
    expect(x + size).toBeLessThanOrEqual(400)
    expect(y + size).toBeLessThanOrEqual(240)
  })

  it('prints both barcode and QR on ESC/POS dual labels', () => {
    const bytes = generateLabelEscPos(PRESET_RETAIL_DUAL_CODE, 'CODE128', sample)
    expect(bytes).toContain(0x6b) // GS k barcode
    const qrFn = bytes.findIndex((_, i) => bytes[i] === 0x1d && bytes[i + 1] === 0x28 && bytes[i + 2] === 0x6b)
    expect(qrFn).toBeGreaterThan(0)
  })
})
