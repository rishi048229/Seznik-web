import { describe, it, expect } from 'vitest'
import {
  computeLogoTargetDots,
  flattenLogoOntoWhite,
  packEscPos1bpp,
  rasterizeLogoPixels,
  scaleLogoToEscPosBounds,
  thresholdToMonochromeRgba,
  trimLogoMargins,
} from '@shared/receiptLogoRaster'

function makeSolidRgba(w: number, h: number, r: number, g: number, b: number, a = 255): Uint8Array {
  const px = new Uint8Array(w * h * 4)
  for (let p = 0; p < w * h; p++) {
    const i = p * 4
    px[i] = r
    px[i + 1] = g
    px[i + 2] = b
    px[i + 3] = a
  }
  return px
}

/** Black rectangle on transparent canvas with white margins. */
function makeLogoWithPadding(
  canvasW: number,
  canvasH: number,
  logoW: number,
  logoH: number
): { pixels: Uint8Array; width: number; height: number } {
  const px = new Uint8Array(canvasW * canvasH * 4)
  const offX = Math.floor((canvasW - logoW) / 2)
  const offY = Math.floor((canvasH - logoH) / 2)
  for (let y = offY; y < offY + logoH; y++) {
    for (let x = offX; x < offX + logoW; x++) {
      const i = (y * canvasW + x) * 4
      px[i] = 0
      px[i + 1] = 0
      px[i + 2] = 0
      px[i + 3] = 255
    }
  }
  return { pixels: px, width: canvasW, height: canvasH }
}

describe('receiptLogoRaster', () => {
  it('trims transparent margins before scaling', () => {
    const { pixels, width, height } = makeLogoWithPadding(200, 100, 80, 40)
    const trimmed = trimLogoMargins(pixels, width, height)
    expect(trimmed.width).toBe(80)
    expect(trimmed.height).toBe(40)
  })

  it('preserves aspect ratio for wide logos after scale', () => {
    const src = { pixels: makeSolidRgba(1000, 200, 0, 0, 0), width: 1000, height: 200 }
    const { widthDots, heightDots } = scaleLogoToEscPosBounds(src, '58mm', 100, 'medium')
    const ratio = widthDots / heightDots
    expect(ratio).toBeCloseTo(5, 0)
  })

  it('preserves aspect ratio for tall logos after scale', () => {
    const src = { pixels: makeSolidRgba(200, 800, 0, 0, 0), width: 200, height: 800 }
    const { widthDots, heightDots } = scaleLogoToEscPosBounds(src, '58mm', 100, 'medium')
    const ratio = widthDots / heightDots
    expect(ratio).toBeCloseTo(0.25, 1)
  })

  it('preserves aspect ratio for square logos after scale', () => {
    const src = { pixels: makeSolidRgba(500, 500, 0, 0, 0), width: 500, height: 500 }
    const { widthDots, heightDots } = scaleLogoToEscPosBounds(src, '58mm', 60, 'medium')
    expect(widthDots).toBe(heightDots)
  })

  it('maps size chips to different dot widths for the same source', () => {
    const src = { pixels: makeSolidRgba(500, 500, 0, 0, 0), width: 500, height: 500 }
    const small = scaleLogoToEscPosBounds(src, '58mm', 100, 'small')
    const medium = scaleLogoToEscPosBounds(src, '58mm', 100, 'medium')
    const large = scaleLogoToEscPosBounds(src, '58mm', 100, 'large')
    expect(small.widthDots).toBeLessThan(medium.widthDots)
    expect(medium.widthDots).toBeLessThan(large.widthDots)
  })

  it('aligns width to 8 dots without changing height independently', () => {
    const { widthDots, heightDots } = computeLogoTargetDots(1000, 200, 320, 120)
    expect(widthDots % 8).toBe(0)
    expect(heightDots).toBe(Math.max(1, Math.round(200 * (widthDots / 1000))))
  })

  it('threshold produces pure black and white pixels', () => {
    const gray = makeSolidRgba(10, 10, 100, 100, 100)
    const mono = thresholdToMonochromeRgba(gray, 10, 10)
    for (let p = 0; p < 100; p++) {
      const i = p * 4
      expect(mono[i]).toBe(0)
      expect(mono[i + 1]).toBe(0)
      expect(mono[i + 2]).toBe(0)
    }
  })

  it('packEscPos1bpp produces expected byte count', () => {
    const mono = makeSolidRgba(16, 8, 0, 0, 0)
    const { packed, widthBytes, heightDots } = packEscPos1bpp(mono, 16, 8)
    expect(widthBytes).toBe(2)
    expect(heightDots).toBe(8)
    expect(packed.length).toBe(16)
  })

  it('rasterizeLogoPixels returns exact width matching widthDots', () => {
    const { pixels, width, height } = makeLogoWithPadding(300, 150, 120, 60)
    const result = rasterizeLogoPixels(pixels, width, height, '58mm', 100, 'medium')
    expect(result).not.toBeNull()
    expect(result!.widthDots).toBe(120)
    expect(result!.heightDots).toBeGreaterThan(0)
    expect(result!.pixels.length).toBe(result!.widthDots * result!.heightDots * 4)
  })

  it('flattenLogoOntoWhite makes transparent pixels white', () => {
    const px = new Uint8Array(4)
    px[3] = 0
    const flat = flattenLogoOntoWhite(px, 1, 1)
    expect(flat[0]).toBe(255)
    expect(flat[3]).toBe(255)
  })

  /** Cross-platform parity: same source + chip → ordered dot widths on 58mm standard receipt. */
  it('orders small/medium/large chip widths identically for web and mobile pipelines', () => {
    const src = { pixels: makeSolidRgba(400, 100, 0, 0, 0), width: 400, height: 100 }
    const small = scaleLogoToEscPosBounds(src, '58mm', 100, 'small')
    const medium = scaleLogoToEscPosBounds(src, '58mm', 100, 'medium')
    const large = scaleLogoToEscPosBounds(src, '58mm', 100, 'large')
    expect(small.widthDots).toBeLessThan(medium.widthDots)
    expect(medium.widthDots).toBeLessThan(large.widthDots)
    expect(small.widthDots).toBe(200)
    expect(medium.widthDots).toBe(320)
    expect(large.widthDots).toBe(384)
  })
})
