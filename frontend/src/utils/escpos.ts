// Minimal ESC/POS command builder for 58mm (32 character wide) thermal printers.

import {
  computeLogoTargetDots,
  flattenLogoOntoWhite,
  packEscPos1bpp,
  resampleRgbaBilinear,
  trimLogoMargins,
} from '@shared/receiptLogoRaster'

const ESC = 0x1b
const GS = 0x1d

export type EscPosAlign = 'left' | 'center' | 'right'

// Printers on this command set generally only ship an 8-bit ASCII/CP437-ish
// code page, so non-ASCII characters (₹, etc.) are swapped for safe equivalents
// rather than risking mojibake on the receipt.
export function toPrinterSafeText(str: string): string {
  const withoutRupee = str.replace(/₹/g, 'Rs.')
  let result = ''
  for (const ch of withoutRupee) {
    result += ch.codePointAt(0)! <= 0x7f ? ch : '?'
  }
  return result
}

export class EscPosBuilder {
  private bytes: number[] = []

  private push(...values: number[]): this {
    this.bytes.push(...values)
    return this
  }

  init(paperSize: '58mm' | '80mm' = '58mm'): this {
    this.push(ESC, 0x40) // ESC @ — Reset printer to default state
    this.push(ESC, 0x4d, 0x00) // ESC M 0 — Select Font A (12x24 dots: 48 cols on 80mm / 32 cols on 58mm)
    this.push(GS, 0x4c, 0x00, 0x00) // GS L 0 0 — Set left margin to 0 dots
    if (paperSize === '80mm') {
      this.push(GS, 0x57, 0x40, 0x02) // GS W 576 (0x0240) — Set hardware printable area width to 576 dots (80mm)
    } else {
      this.push(GS, 0x57, 0x80, 0x01) // GS W 384 (0x0180) — Set hardware printable area width to 384 dots (58mm)
    }
    return this
  }

  align(align: EscPosAlign): this {
    const n = align === 'center' ? 1 : align === 'right' ? 2 : 0
    return this.push(ESC, 0x61, n)
  }

  bold(on: boolean): this {
    return this.push(ESC, 0x45, on ? 1 : 0)
  }

  doubleSize(on: boolean): this {
    return this.push(GS, 0x21, on ? 0x11 : 0x00)
  }

  text(str: string): this {
    const safe = toPrinterSafeText(str)
    for (let i = 0; i < safe.length; i++) {
      this.bytes.push(safe.charCodeAt(i) & 0xff)
    }
    return this
  }

  line(str = ''): this {
    return this.text(str).newline()
  }

  newline(count = 1): this {
    for (let i = 0; i < count; i++) this.push(0x0a)
    return this
  }

  hr(width = 32, char = '-'): this {
    return this.line(char.repeat(width))
  }

  // Pads two strings to exactly width cols using printer-safe character lengths.
  twoCol(left: string, right: string, width = 32): this {
    const safeLeft = toPrinterSafeText(left ?? '')
    const safeRight = toPrinterSafeText(right ?? '')
    const availableLeft = width - safeRight.length - 1
    if (availableLeft < 1) {
      return this.line(safeRight.slice(-width).padStart(width, ' '))
    }
    const leftStr = safeLeft.length > availableLeft ? safeLeft.slice(0, availableLeft) : safeLeft
    const padding = width - leftStr.length - safeRight.length
    return this.line(leftStr + ' '.repeat(Math.max(0, padding)) + safeRight)
  }

  feed(lines = 3): this {
    return this.push(ESC, 0x64, lines)
  }

  cut(): this {
    return this.push(GS, 0x56, 0x01)
  }

  // 1D barcode via the standard GS k command. CODE128 uses the newer
  // length-prefixed form (function 73) with a Code-Set-B prefix so any ASCII
  // payload works; EAN13 uses the classic NUL-terminated form and needs
  // exactly 12 or 13 digits (the 13th, the check digit, is computed by the
  // printer itself if 12 are given).
  barcode(type: 'CODE128' | 'EAN13', data: string, heightDots = 80): this {
    this.push(GS, 0x68, heightDots) // GS h n — barcode height
    this.push(GS, 0x77, 2) // GS w n — module width
    this.push(GS, 0x48, 2) // GS H n — print human-readable text below the bars

    if (type === 'EAN13') {
      const digits = data.replace(/\D/g, '').slice(0, 13).padStart(12, '0')
      this.push(GS, 0x6b, 2)
      this.text(digits)
      this.push(0x00)
    } else {
      const payload = `{B${data}`
      this.push(GS, 0x6b, 73, payload.length)
      this.text(payload)
    }
    return this
  }

  // 2D QR code via the standard Epson "GS ( k" symbol-storage sequence
  // (select model → set module size → set error-correction level → store
  // data → print). This exact byte sequence is the widely-replicated ESC/POS
  // spec used by most Chinese-clone thermal printers, not vendor-specific.
  qr(data: string, moduleSize = 6): this {
    const cn = 0x31 // '1' — fixed value for 2D symbol commands

    this.push(GS, 0x28, 0x6b, 0x04, 0x00, cn, 0x41, 0x32, 0x00) // select Model 2
    this.push(GS, 0x28, 0x6b, 0x03, 0x00, cn, 0x43, moduleSize) // module size (1-16)
    this.push(GS, 0x28, 0x6b, 0x03, 0x00, cn, 0x45, 0x31) // error correction level M (~15%)

    const bytes = new TextEncoder().encode(data)
    const storeLen = bytes.length + 3
    this.push(GS, 0x28, 0x6b, storeLen & 0xff, (storeLen >> 8) & 0xff, cn, 0x50, 0x30)
    for (const b of bytes) this.bytes.push(b)

    this.push(GS, 0x28, 0x6b, 0x03, 0x00, cn, 0x51, 0x30) // print the stored symbol
    return this
  }

  // Raster bit-image via the standard "GS v 0" command — the only way a
  // logo can actually appear on a thermal receipt (there is no HTML/<img>
  // on real hardware; the previous implementation only ever rendered the
  // logo in the on-screen A4/browser preview and silently did nothing here,
  // which is why it never showed up on an actual printed receipt).
  // `packed` is 1-bit-per-pixel data (1 = black), MSB-first, each row
  // padded out to a whole number of bytes — see rasterizeImageForEscPos().
  image(packed: Uint8Array, widthBytes: number, heightDots: number): this {
    this.push(GS, 0x76, 0x30, 0x00, widthBytes & 0xff, (widthBytes >> 8) & 0xff, heightDots & 0xff, (heightDots >> 8) & 0xff)
    for (const b of packed) this.bytes.push(b)
    return this
  }

  toBytes(): Uint8Array {
    return new Uint8Array(this.bytes)
  }
}

/**
 * Loads an image (data: URI or http(s) URL) and converts it into 1bpp
 * packed raster data ready for EscPosBuilder.image().
 *
 * Proportionally scales to fit within both maxWidthDots and maxHeightDots,
 * trims blank borders, and aligns width to 8-dot byte boundaries. This keeps
 * bitmap payloads lightweight (~800–1600 bytes) and prevents printer buffer
 * exhaustion and motor stuttering during receipt printing.
 */
async function toRasterizableSrc(src: string): Promise<string> {
  if (!src || src.startsWith('data:') || src.startsWith('blob:')) return src
  try {
    const response = await fetch(src)
    if (!response.ok) return src
    const blob = await response.blob()
    return await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result || src))
      reader.onerror = () => reject(new Error('Failed to read logo blob'))
      reader.readAsDataURL(blob)
    })
  } catch {
    return src
  }
}

export async function rasterizeImageForEscPos(
  src: string,
  maxWidthDots = 224,
  maxHeightDots = 72
): Promise<{ packed: Uint8Array; widthBytes: number; heightDots: number } | null> {
  if (!src) return null
  try {
    const rasterSrc = await toRasterizableSrc(src)
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image()
      if (!rasterSrc.startsWith('data:') && !rasterSrc.startsWith('blob:')) el.crossOrigin = 'anonymous'
      el.onload = () => resolve(el)
      el.onerror = () => reject(new Error('Failed to load logo image'))
      el.src = rasterSrc
    })

    if (!img.width || !img.height) return null

    const rawCanvas = document.createElement('canvas')
    rawCanvas.width = img.width
    rawCanvas.height = img.height
    const rawCtx = rawCanvas.getContext('2d')
    if (!rawCtx) return null
    rawCtx.drawImage(img, 0, 0)

    const { data } = rawCtx.getImageData(0, 0, img.width, img.height)
    const flat = flattenLogoOntoWhite(new Uint8Array(data), img.width, img.height)
    const trimmed = trimLogoMargins(flat, img.width, img.height)
    const { widthDots, heightDots } = computeLogoTargetDots(
      trimmed.width,
      trimmed.height,
      maxWidthDots,
      maxHeightDots
    )

    const scaled = resampleRgbaBilinear(
      trimmed.pixels,
      trimmed.width,
      trimmed.height,
      widthDots,
      heightDots
    )

    return packEscPos1bpp(scaled, widthDots, heightDots)
  } catch (err) {
    console.warn('[receipt] rasterizeImageForEscPos failed:', err)
    return null
  }
}
