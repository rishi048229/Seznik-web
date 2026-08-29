/**
 * Shared thermal receipt logo / QR geometry.
 *
 * Web ESC/POS (`frontend/src/utils/escpos.ts`, `receipt.ts`, `customReceiptEngine.ts`)
 * is the source of truth. Mobile `printPic` / `printQRCode` must use these same caps
 * so a 58mm/80mm receipt looks the same on both platforms.
 */

export type ThermalPaper = '58mm' | '80mm'
export type ReceiptQrSize = 'small' | 'medium' | 'large'

/** Custom template default — web image blocks use 60, not 40. */
export const RECEIPT_LOGO_DEFAULT_WIDTH_PERCENT = 60

/** Typical UPI QR (version 4) plus quiet zone, in modules. */
const TYPICAL_QR_MODULES = 41

export function receiptLogoMaxDots(paperWidth: ThermalPaper): { maxWidth: number; maxHeight: number } {
  return paperWidth === '80mm'
    ? { maxWidth: 320, maxHeight: 96 }
    : { maxWidth: 224, maxHeight: 72 }
}

/**
 * Width to send to a width-only bitmap API (`printPic`) so the printed logo
 * also respects the web height cap. Square logos otherwise print ~2× too tall.
 */
export function receiptLogoPrintWidthDots(
  paperWidth: ThermalPaper,
  widthPercent = RECEIPT_LOGO_DEFAULT_WIDTH_PERCENT,
  imageWidth = 0,
  imageHeight = 0
): number {
  const { maxWidth, maxHeight } = receiptLogoMaxDots(paperWidth)
  const pct = Math.min(Math.max(widthPercent, 1), 100)
  const allowedWidth = Math.max(48, Math.floor((maxWidth * pct) / 100))
  if (!imageWidth || !imageHeight) {
    return Math.min(allowedWidth, maxHeight)
  }
  const scale = Math.min(1, allowedWidth / imageWidth, maxHeight / imageHeight)
  return Math.max(48, Math.round(imageWidth * scale))
}

/** Native GS ( k module size used on web for the standard payment QR. */
export function receiptQrEscPosModuleSize(paperWidth: ThermalPaper): number {
  return paperWidth === '80mm' ? 6 : 4
}

/** Native GS ( k module size for a custom template QR block. */
export function receiptQrEscPosModuleSizeForEntry(size: ReceiptQrSize = 'medium'): number {
  if (size === 'large') return 6
  if (size === 'small') return 4
  return 5
}

/**
 * Pixel size for `printQRCode()` (bitmap, 1 printer-dot per pixel).
 * Omit `size` to match the standard web payment QR (module 4 on 58mm / 6 on 80mm).
 * Pass small/medium/large to match custom-template web blocks (4 / 5 / 6).
 */
export function receiptQrBitmapDots(paperWidth: ThermalPaper, size?: ReceiptQrSize): number {
  const moduleSize = size
    ? receiptQrEscPosModuleSizeForEntry(size)
    : receiptQrEscPosModuleSize(paperWidth)
  return Math.min(paperWidth === '80mm' ? 320 : 256, TYPICAL_QR_MODULES * moduleSize)
}

/** On-screen custom-receipt preview (web CustomReceiptPreview). */
export function receiptQrPreviewPx(size: ReceiptQrSize = 'medium'): number {
  if (size === 'large') return 120
  if (size === 'small') return 85
  return 100
}

/** Browser / Expo HTML thermal print (web generateReceiptHTML uses 130px). */
export function receiptQrHtmlPx(size: ReceiptQrSize = 'medium'): number {
  if (size === 'large') return 130
  if (size === 'small') return 100
  return 120
}
