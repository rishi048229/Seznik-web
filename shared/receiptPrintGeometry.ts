/**
 * Shared thermal receipt logo / QR geometry.
 *
 * Mobile HTML sizes are the shared default for both clients (web adopts these).
 * ESC/POS bitmap caps stay platform-agnostic so Bluetooth prints match across web/app.
 */

export type ThermalPaper = '58mm' | '80mm'
export type ReceiptQrSize = 'small' | 'medium' | 'large'

/** Coerce a product / line GST rate (0–100) for receipt display. */
export function coerceGstRate(rate: unknown): number {
  const n = Number(rate)
  if (!Number.isFinite(n) || n <= 0) return 0
  return n
}

/**
 * Per-item GST rate label for thermal receipts.
 * Uses whole-number percents when possible (18% not 18.0%) so 58mm columns do not truncate.
 */
export function formatItemGstRate(rate: unknown): string {
  const n = coerceGstRate(rate)
  if (n <= 0) return ''
  const rounded = Math.round(n * 100) / 100
  if (Number.isInteger(rounded)) return `${rounded}%`
  const trimmed = rounded.toFixed(2).replace(/\.?0+$/, '')
  return `${trimmed}%`
}

/**
 * User-selectable size chip for logo and QR on a receipt.
 * Stored in ReceiptConfig as receiptLogoSize / receiptQrSize.
 * Both Web and Mobile read from this to determine pixel dimensions.
 */
export type ReceiptSizeChip = 'small' | 'medium' | 'large'

/**
 * Concrete logo max dimensions for each size chip.
 * Used by both Web (receipt.ts, customReceiptEngine.ts) and Mobile (PrinterService.ts).
 */
export function receiptLogoHtmlMaxPxFromChip(chip: ReceiptSizeChip = 'medium'): { maxHeight: number; maxWidth: number } {
  if (chip === 'small') return { maxHeight: 32, maxWidth: 140 }
  if (chip === 'large') return { maxHeight: 80, maxWidth: 300 }
  return { maxHeight: 56, maxWidth: 220 } // medium (default)
}

/**
 * Concrete QR pixel size for each size chip.
 * Used by both Web (receipt.ts, customReceiptEngine.ts) and Mobile (PrinterService.ts).
 */
export function receiptStandardQrHtmlPxFromChip(chip: ReceiptSizeChip = 'medium'): number {
  if (chip === 'small') return 80
  if (chip === 'large') return 140
  return 110 // medium (default)
}

/** Custom template default — image blocks use 60% of paper width. */
export const RECEIPT_LOGO_DEFAULT_WIDTH_PERCENT = 60

/** Standard receipt logo uses the full chip max width (matches web receipt.ts ESC/POS). */
export const RECEIPT_LOGO_STANDARD_WIDTH_PERCENT = 100

/** Typical UPI QR (version 4) plus quiet zone, in modules. */
const TYPICAL_QR_MODULES = 41

export function receiptLogoMaxDotsFromChip(
  paperWidth: ThermalPaper,
  chip: ReceiptSizeChip = 'medium'
): { maxWidth: number; maxHeight: number } {
  if (chip === 'small') {
    return paperWidth === '80mm'
      ? { maxWidth: 280, maxHeight: 80 }
      : { maxWidth: 200, maxHeight: 68 }
  }
  if (chip === 'large') {
    return paperWidth === '80mm'
      ? { maxWidth: 576, maxHeight: 180 }
      : { maxWidth: 384, maxHeight: 170 }
  }
  // medium (default)
  return paperWidth === '80mm'
    ? { maxWidth: 440, maxHeight: 130 }
    : { maxWidth: 320, maxHeight: 120 }
}

export function receiptLogoMaxDots(paperWidth: ThermalPaper): { maxWidth: number; maxHeight: number } {
  return receiptLogoMaxDotsFromChip(paperWidth, 'medium')
}

/**
 * Mobile-standard HTML / browser / Expo thermal logo max dimensions.
 * Used by web generateReceiptHTML and mobile HTML fallback alike.
 */
export function receiptLogoHtmlMaxPx(_paperWidth?: ThermalPaper): { maxHeight: number; maxWidth: number } {
  return { maxHeight: 88, maxWidth: 260 }
}

/**
 * ESC/POS raster bounds for a logo block — mirrors web tryAppendEscPosLogo /
 * rasterizeImageForEscPos maxWidth / maxHeight inputs.
 */
export function receiptLogoEscPosBounds(
  paperWidth: ThermalPaper,
  chip: ReceiptSizeChip = 'medium',
  widthPercent = RECEIPT_LOGO_DEFAULT_WIDTH_PERCENT
): { maxWidthDots: number; maxHeightDots: number } {
  const { maxWidth, maxHeight } = receiptLogoMaxDotsFromChip(paperWidth, chip)
  const pct = Math.min(Math.max(widthPercent, 1), 100)
  return {
    maxWidthDots: Math.max(48, Math.floor((maxWidth * pct) / 100)),
    maxHeightDots: maxHeight,
  }
}

/**
 * Target printer-dot dimensions after proportional scaling — same math as web
 * rasterizeImageForEscPos (width aligned to 8 dots for clean 1bpp packing).
 */
export function receiptLogoScaledDots(
  paperWidth: ThermalPaper,
  widthPercent = RECEIPT_LOGO_DEFAULT_WIDTH_PERCENT,
  imageWidth = 0,
  imageHeight = 0,
  chip: ReceiptSizeChip = 'medium'
): { widthDots: number; heightDots: number } {
  const { maxWidthDots, maxHeightDots } = receiptLogoEscPosBounds(paperWidth, chip, widthPercent)
  if (!imageWidth || !imageHeight) {
    const side = Math.min(maxWidthDots, maxHeightDots)
    return { widthDots: side, heightDots: side }
  }
  const scale = Math.min(1, maxWidthDots / imageWidth, maxHeightDots / imageHeight)
  let widthDots = Math.max(8, Math.round(imageWidth * scale))
  widthDots = Math.ceil(widthDots / 8) * 8
  const heightDots = Math.max(1, Math.round(imageHeight * scale))
  return { widthDots, heightDots }
}

/**
 * Width to send to a width-only bitmap API (`printPic`) so the printed logo
 * also respects the height cap and user selected size chip.
 */
export function receiptLogoPrintWidthDots(
  paperWidth: ThermalPaper,
  widthPercent = RECEIPT_LOGO_DEFAULT_WIDTH_PERCENT,
  imageWidth = 0,
  imageHeight = 0,
  chip: ReceiptSizeChip = 'medium'
): number {
  return receiptLogoScaledDots(paperWidth, widthPercent, imageWidth, imageHeight, chip).widthDots
}

/** Native GS ( k module size used for the standard payment QR. */
export function receiptQrEscPosModuleSize(paperWidth: ThermalPaper, chip?: ReceiptSizeChip): number {
  if (chip) return receiptQrEscPosModuleSizeForEntry(chip)
  return paperWidth === '80mm' ? 7 : 6
}

/** Native GS ( k module size for a custom template QR block. */
export function receiptQrEscPosModuleSizeForEntry(size: ReceiptQrSize = 'medium'): number {
  if (size === 'large') return 8
  if (size === 'small') return 4
  return 6
}

/**
 * Pixel size for `printQRCode()` (bitmap, 1 printer-dot per pixel).
 * Omit `size` to match the standard payment QR (module 4 on 58mm / 6 on 80mm).
 * Pass small/medium/large to match custom-template blocks (4 / 5 / 6).
 */
export function receiptQrBitmapDots(paperWidth: ThermalPaper, size?: ReceiptQrSize): number {
  const moduleSize = size
    ? receiptQrEscPosModuleSizeForEntry(size)
    : receiptQrEscPosModuleSize(paperWidth)
  return Math.min(paperWidth === '80mm' ? 400 : 320, TYPICAL_QR_MODULES * moduleSize)
}

/** On-screen custom-receipt preview. */
export function receiptQrPreviewPx(size: ReceiptQrSize = 'medium'): number {
  if (size === 'large') return 175
  if (size === 'small') return 125
  return 150
}

/**
 * Mobile-standard HTML payment QR size (UPI / digital bill on thermal HTML).
 * 58mm → 165px, 80mm → 195px.
 */
export function receiptStandardQrHtmlPx(paperWidth: ThermalPaper = '58mm'): number {
  return paperWidth === '80mm' ? 195 : 165
}

/** Custom-template HTML QR by size chip (small / medium / large). */
export function receiptQrHtmlPx(size: ReceiptQrSize = 'medium'): number {
  if (size === 'large') return 195
  if (size === 'small') return 135
  return 165
}

/**
 * Word-boundary text wrapping for thermal receipts.
 * Shifts whole words to the next line when they exceed the column width.
 * Never cuts a word in between unless a single continuous token exceeds maxCols.
 */
export function wrapReceiptWords(text: string, maxCols: number): string[] {
  if (!text) return []
  const paragraphs = String(text).split('\n')
  const result: string[] = []

  for (const para of paragraphs) {
    const trimmed = para.trim()
    if (!trimmed) {
      result.push('')
      continue
    }
    const words = trimmed.split(/\s+/).filter(Boolean)
    let current = ''

    for (const word of words) {
      if (!current) {
        if (word.length <= maxCols) {
          current = word
        } else {
          // Word itself exceeds maxCols — slice only this oversized word
          let rem = word
          while (rem.length > maxCols) {
            result.push(rem.slice(0, maxCols))
            rem = rem.slice(maxCols)
          }
          current = rem
        }
      } else {
        const candidate = `${current} ${word}`
        if (candidate.length <= maxCols) {
          current = candidate
        } else {
          result.push(current)
          if (word.length <= maxCols) {
            current = word
          } else {
            let rem = word
            while (rem.length > maxCols) {
              result.push(rem.slice(0, maxCols))
              rem = rem.slice(maxCols)
            }
            current = rem
          }
        }
      }
    }
    if (current) {
      result.push(current)
    }
  }

  return result
}

/** Align a single wrapped line within a given character width. */
export function alignReceiptLine(
  line: string,
  width: number,
  align: 'left' | 'center' | 'right' = 'left'
): string {
  const trimmed = line.trim()
  if (!trimmed) return ''
  if (trimmed.length >= width) return trimmed
  if (align === 'center') {
    const pad = Math.floor((width - trimmed.length) / 2)
    return ' '.repeat(pad) + trimmed
  }
  if (align === 'right') {
    return ' '.repeat(width - trimmed.length) + trimmed
  }
  return trimmed
}

/** Wrap text by words and apply alignment to each resulting line. */
export function wrapReceiptAligned(
  text: string,
  width: number,
  align: 'left' | 'center' | 'right' = 'left'
): string[] {
  const wrapped = wrapReceiptWords(text, width)
  return wrapped.map((line) => alignReceiptLine(line, width, align))
}

