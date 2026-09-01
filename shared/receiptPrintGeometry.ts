/**
 * Shared thermal receipt logo / QR geometry.
 *
 * Mobile HTML sizes are the shared default for both clients (web adopts these).
 * ESC/POS bitmap caps stay platform-agnostic so Bluetooth prints match across web/app.
 */

export type ThermalPaper = '58mm' | '80mm'
export type ReceiptQrSize = 'small' | 'medium' | 'large'

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
  if (chip === 'small') return { maxHeight: 44, maxWidth: 140 }
  if (chip === 'large') return { maxHeight: 88, maxWidth: 260 }
  return { maxHeight: 68, maxWidth: 200 } // medium (default)
}

/**
 * Concrete QR pixel size for each size chip.
 * Used by both Web (receipt.ts, customReceiptEngine.ts) and Mobile (PrinterService.ts).
 */
export function receiptStandardQrHtmlPxFromChip(chip: ReceiptSizeChip = 'medium'): number {
  if (chip === 'small') return 95
  if (chip === 'large') return 150
  return 125 // medium (default)
}

/** Custom template default — image blocks use 60% of paper width. */
export const RECEIPT_LOGO_DEFAULT_WIDTH_PERCENT = 60

/** Typical UPI QR (version 4) plus quiet zone, in modules. */
const TYPICAL_QR_MODULES = 41

export function receiptLogoMaxDotsFromChip(
  paperWidth: ThermalPaper,
  chip: ReceiptSizeChip = 'medium'
): { maxWidth: number; maxHeight: number } {
  if (chip === 'small') {
    return paperWidth === '80mm'
      ? { maxWidth: 260, maxHeight: 72 }
      : { maxWidth: 180, maxHeight: 56 }
  }
  if (chip === 'large') {
    return paperWidth === '80mm'
      ? { maxWidth: 500, maxHeight: 170 }
      : { maxWidth: 360, maxHeight: 130 }
  }
  // medium (default)
  return paperWidth === '80mm'
    ? { maxWidth: 400, maxHeight: 120 }
    : { maxWidth: 280, maxHeight: 90 }
}

export function receiptLogoMaxDots(paperWidth: ThermalPaper): { maxWidth: number; maxHeight: number } {
  return receiptLogoMaxDotsFromChip(paperWidth, 'medium')
}

/**
 * Mobile-standard HTML / browser / Expo thermal logo max dimensions.
 * Used by web generateReceiptHTML and mobile HTML fallback alike.
 */
export function receiptLogoHtmlMaxPx(_paperWidth?: ThermalPaper): { maxHeight: number; maxWidth: number } {
  return { maxHeight: 68, maxWidth: 200 }
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
  const { maxWidth, maxHeight } = receiptLogoMaxDotsFromChip(paperWidth, chip)
  const pct = Math.min(Math.max(widthPercent, 1), 100)
  const allowedWidth = Math.max(48, Math.floor((maxWidth * pct) / 100))
  if (!imageWidth || !imageHeight) {
    return Math.min(allowedWidth, maxHeight)
  }
  const scale = Math.min(1, allowedWidth / imageWidth, maxHeight / imageHeight)
  return Math.max(48, Math.round(imageWidth * scale))
}

/** Native GS ( k module size used for the standard payment QR. */
export function receiptQrEscPosModuleSize(paperWidth: ThermalPaper, chip?: ReceiptSizeChip): number {
  if (chip) return receiptQrEscPosModuleSizeForEntry(chip)
  return paperWidth === '80mm' ? 6 : 5
}

/** Native GS ( k module size for a custom template QR block. */
export function receiptQrEscPosModuleSizeForEntry(size: ReceiptQrSize = 'medium'): number {
  if (size === 'large') return 6
  if (size === 'small') return 4
  return 5
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
  return Math.min(paperWidth === '80mm' ? 320 : 256, TYPICAL_QR_MODULES * moduleSize)
}

/** On-screen custom-receipt preview. */
export function receiptQrPreviewPx(size: ReceiptQrSize = 'medium'): number {
  if (size === 'large') return 135
  if (size === 'small') return 95
  return 115
}

/**
 * Mobile-standard HTML payment QR size (UPI / digital bill on thermal HTML).
 * 58mm → 125px, 80mm → 145px.
 */
export function receiptStandardQrHtmlPx(paperWidth: ThermalPaper = '58mm'): number {
  return paperWidth === '80mm' ? 145 : 125
}

/** Custom-template HTML QR by size chip (small / medium / large). */
export function receiptQrHtmlPx(size: ReceiptQrSize = 'medium'): number {
  if (size === 'large') return 145
  if (size === 'small') return 105
  return 125
}
