/**
 * Shared receipt-logo pixel rasterization for thermal ESC/POS.
 * Pure Uint8Array logic — used by web (canvas) and mobile (loadImageRgba).
 */

import {
  receiptLogoEscPosBounds,
  type ReceiptSizeChip,
  type ThermalPaper,
} from './receiptPrintGeometry'

export type RgbaBuffer = { pixels: Uint8Array; width: number; height: number }

const LUM_THRESHOLD = 170
const TRIM_ALPHA_MIN = 30
const TRIM_LUM_MAX = 240

function pixelLuminance(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b
}

function isContentPixel(r: number, g: number, b: number, a: number): boolean {
  return a > TRIM_ALPHA_MIN && pixelLuminance(r, g, b) < TRIM_LUM_MAX
}

/** Flatten RGBA onto opaque white (transparent → white). */
export function flattenLogoOntoWhite(pixels: Uint8Array, width: number, height: number): Uint8Array {
  const out = new Uint8Array(pixels.length)
  for (let p = 0; p < width * height; p++) {
    const i = p * 4
    const a = pixels[i + 3] / 255
    out[i] = Math.round(pixels[i] * a + 255 * (1 - a))
    out[i + 1] = Math.round(pixels[i + 1] * a + 255 * (1 - a))
    out[i + 2] = Math.round(pixels[i + 2] * a + 255 * (1 - a))
    out[i + 3] = 255
  }
  return out
}

/**
 * Auto-crops transparent and solid white outer margins — same rules as web trimImageCanvas.
 */
export function trimLogoMargins(
  pixels: Uint8Array,
  width: number,
  height: number
): RgbaBuffer {
  if (width <= 0 || height <= 0) return { pixels, width, height }

  let top = 0
  let bottom = height
  let left = 0
  let right = width

  topLoop: for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      if (isContentPixel(pixels[i], pixels[i + 1], pixels[i + 2], pixels[i + 3])) {
        top = y
        break topLoop
      }
    }
  }

  bottomLoop: for (let y = height - 1; y >= top; y--) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      if (isContentPixel(pixels[i], pixels[i + 1], pixels[i + 2], pixels[i + 3])) {
        bottom = y + 1
        break bottomLoop
      }
    }
  }

  leftLoop: for (let x = 0; x < width; x++) {
    for (let y = top; y < bottom; y++) {
      const i = (y * width + x) * 4
      if (isContentPixel(pixels[i], pixels[i + 1], pixels[i + 2], pixels[i + 3])) {
        left = x
        break leftLoop
      }
    }
  }

  rightLoop: for (let x = width - 1; x >= left; x--) {
    for (let y = top; y < bottom; y++) {
      const i = (y * width + x) * 4
      if (isContentPixel(pixels[i], pixels[i + 1], pixels[i + 2], pixels[i + 3])) {
        right = x + 1
        break rightLoop
      }
    }
  }

  const trimmedW = right - left
  const trimmedH = bottom - top
  if (trimmedW <= 0 || trimmedH <= 0 || (trimmedW === width && trimmedH === height)) {
    return { pixels, width, height }
  }

  const cropped = new Uint8Array(trimmedW * trimmedH * 4)
  for (let y = 0; y < trimmedH; y++) {
    const srcRow = ((top + y) * width + left) * 4
    const dstRow = y * trimmedW * 4
    cropped.set(pixels.subarray(srcRow, srcRow + trimmedW * 4), dstRow)
  }
  return { pixels: cropped, width: trimmedW, height: trimmedH }
}

/** Proportional target dot size after trim — width aligned to 8 dots. */
export function computeLogoTargetDots(
  srcWidth: number,
  srcHeight: number,
  maxWidthDots: number,
  maxHeightDots: number
): { widthDots: number; heightDots: number } {
  if (srcWidth <= 0 || srcHeight <= 0) {
    const side = Math.min(maxWidthDots, maxHeightDots)
    return { widthDots: side, heightDots: side }
  }
  const scale = Math.min(1, maxWidthDots / srcWidth, maxHeightDots / srcHeight)
  let widthDots = Math.max(8, Math.round(srcWidth * scale))
  widthDots = Math.ceil(widthDots / 8) * 8
  const heightDots = Math.max(1, Math.round(srcHeight * scale))
  return { widthDots, heightDots }
}

export function scaleLogoToEscPosBounds(
  buffer: RgbaBuffer,
  paperWidth: ThermalPaper,
  widthPercent: number,
  chip: ReceiptSizeChip
): { buffer: RgbaBuffer; widthDots: number; heightDots: number } {
  const { maxWidthDots, maxHeightDots } = receiptLogoEscPosBounds(paperWidth, chip, widthPercent)
  const { widthDots, heightDots } = computeLogoTargetDots(
    buffer.width,
    buffer.height,
    maxWidthDots,
    maxHeightDots
  )
  const scaled = resampleRgbaBilinear(buffer.pixels, buffer.width, buffer.height, widthDots, heightDots)
  return { buffer: { pixels: scaled, width: widthDots, height: heightDots }, widthDots, heightDots }
}

/** Bilinear resample RGBA — preserves aspect ratio via target dimensions from proportional scale. */
export function resampleRgbaBilinear(
  src: Uint8Array,
  srcW: number,
  srcH: number,
  dstW: number,
  dstH: number
): Uint8Array {
  const dst = new Uint8Array(dstW * dstH * 4)
  if (srcW <= 0 || srcH <= 0 || dstW <= 0 || dstH <= 0) return dst

  for (let y = 0; y < dstH; y++) {
    const srcY = ((y + 0.5) * srcH) / dstH - 0.5
    const y0 = Math.max(0, Math.floor(srcY))
    const y1 = Math.min(srcH - 1, y0 + 1)
    const fy = srcY - y0

    for (let x = 0; x < dstW; x++) {
      const srcX = ((x + 0.5) * srcW) / dstW - 0.5
      const x0 = Math.max(0, Math.floor(srcX))
      const x1 = Math.min(srcW - 1, x0 + 1)
      const fx = srcX - x0

      const i00 = (y0 * srcW + x0) * 4
      const i10 = (y0 * srcW + x1) * 4
      const i01 = (y1 * srcW + x0) * 4
      const i11 = (y1 * srcW + x1) * 4
      const di = (y * dstW + x) * 4

      for (let c = 0; c < 4; c++) {
        const v =
          src[i00 + c] * (1 - fx) * (1 - fy) +
          src[i10 + c] * fx * (1 - fy) +
          src[i01 + c] * (1 - fx) * fy +
          src[i11 + c] * fx * fy
        dst[di + c] = Math.round(v)
      }
    }
  }
  return dst
}

/** High-contrast monochrome RGBA (white bg, black foreground) — matches web threshold. */
export function thresholdToMonochromeRgba(
  pixels: Uint8Array,
  width: number,
  height: number,
  threshold = LUM_THRESHOLD
): Uint8Array {
  const out = new Uint8Array(pixels.length)
  for (let p = 0; p < width * height; p++) {
    const i = p * 4
    const lum = pixelLuminance(pixels[i], pixels[i + 1], pixels[i + 2])
    const isDark = lum < threshold
    out[i] = isDark ? 0 : 255
    out[i + 1] = isDark ? 0 : 255
    out[i + 2] = isDark ? 0 : 255
    out[i + 3] = 255
  }
  return out
}

/** Pack monochrome RGBA into ESC/POS GS v 0 1bpp raster (MSB-first). */
export function packEscPos1bpp(
  pixels: Uint8Array,
  widthDots: number,
  heightDots: number,
  threshold = LUM_THRESHOLD
): { packed: Uint8Array; widthBytes: number; heightDots: number } {
  const widthBytes = widthDots / 8
  const packed = new Uint8Array(widthBytes * heightDots)

  for (let y = 0; y < heightDots; y++) {
    for (let x = 0; x < widthDots; x++) {
      const i = (y * widthDots + x) * 4
      const lum = pixelLuminance(pixels[i], pixels[i + 1], pixels[i + 2])
      if (lum < threshold) {
        const byteIndex = y * widthBytes + (x >> 3)
        packed[byteIndex] |= 0x80 >> (x & 7)
      }
    }
  }

  return { packed, widthBytes, heightDots }
}

/** Full pixel pipeline: flatten → trim → scale → monochrome. */
export function rasterizeLogoPixels(
  pixels: Uint8Array,
  width: number,
  height: number,
  paperWidth: ThermalPaper,
  widthPercent: number,
  chip: ReceiptSizeChip
): { pixels: Uint8Array; widthDots: number; heightDots: number } | null {
  if (width <= 0 || height <= 0 || pixels.length === 0) return null

  const flat = flattenLogoOntoWhite(pixels, width, height)
  const trimmed = trimLogoMargins(flat, width, height)
  const { buffer, widthDots, heightDots } = scaleLogoToEscPosBounds(
    trimmed,
    paperWidth,
    widthPercent,
    chip
  )
  const mono = thresholdToMonochromeRgba(buffer.pixels, buffer.width, buffer.height)
  return { pixels: mono, widthDots, heightDots }
}
