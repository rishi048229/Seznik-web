import { describe, it, expect } from 'vitest'
import {
  RECEIPT_LOGO_DEFAULT_WIDTH_PERCENT,
  RECEIPT_LOGO_STANDARD_WIDTH_PERCENT,
  receiptLogoHtmlMaxPx,
  receiptLogoHtmlMaxPxFromChip,
  receiptLogoMaxDots,
  receiptLogoMaxDotsFromChip,
  receiptLogoPrintWidthDots,
  receiptLogoScaledDots,
  receiptQrBitmapDots,
  receiptQrEscPosModuleSize,
  receiptQrEscPosModuleSizeForEntry,
  receiptStandardQrHtmlPx,
  receiptStandardQrHtmlPxFromChip,
} from '@shared/receiptPrintGeometry'

describe('receiptPrintGeometry', () => {
  it('uses the shared ESC/POS logo caps for medium chip', () => {
    expect(receiptLogoMaxDots('58mm')).toEqual({ maxWidth: 320, maxHeight: 120 })
    expect(receiptLogoMaxDots('80mm')).toEqual({ maxWidth: 440, maxHeight: 130 })
  })

  it('maps logo size chips to distinct ESC/POS caps', () => {
    expect(receiptLogoMaxDotsFromChip('58mm', 'small')).toEqual({ maxWidth: 200, maxHeight: 68 })
    expect(receiptLogoMaxDotsFromChip('58mm', 'large')).toEqual({ maxWidth: 384, maxHeight: 170 })
  })

  it('uses mobile HTML logo max dimensions for both paper widths', () => {
    expect(receiptLogoHtmlMaxPx('58mm')).toEqual({ maxHeight: 88, maxWidth: 260 })
    expect(receiptLogoHtmlMaxPxFromChip('medium')).toEqual({ maxHeight: 56, maxWidth: 220 })
  })

  it('uses mobile-standard HTML payment QR sizes', () => {
    expect(receiptStandardQrHtmlPxFromChip('medium')).toBe(110)
    expect(receiptStandardQrHtmlPx('58mm')).toBe(165)
    expect(receiptStandardQrHtmlPx('80mm')).toBe(195)
  })

  it('caps unknown-aspect logos within both width and height bounds', () => {
    expect(RECEIPT_LOGO_DEFAULT_WIDTH_PERCENT).toBe(60)
    expect(RECEIPT_LOGO_STANDARD_WIDTH_PERCENT).toBe(100)
    expect(receiptLogoPrintWidthDots('58mm', 40)).toBe(120)
    expect(receiptLogoPrintWidthDots('80mm', 40)).toBe(130)
  })

  it('scales a square logo to the height cap', () => {
    expect(receiptLogoPrintWidthDots('58mm', 60, 500, 500)).toBe(120)
    expect(receiptLogoPrintWidthDots('80mm', 60, 500, 500)).toBe(136)
  })

  it('keeps a wide logo within max width', () => {
    expect(receiptLogoPrintWidthDots('58mm', 60, 1000, 200)).toBe(192)
  })

  it('uses full paper width for standard receipts', () => {
    expect(receiptLogoScaledDots('58mm', 100, 500, 500, 'small').widthDots).toBe(72)
    expect(receiptLogoScaledDots('58mm', 100, 500, 500, 'large').widthDots).toBe(176)
  })

  it('matches native QR module sizes', () => {
    expect(receiptQrEscPosModuleSize('58mm')).toBe(6)
    expect(receiptQrEscPosModuleSize('80mm')).toBe(7)
    expect(receiptQrEscPosModuleSizeForEntry('small')).toBe(4)
    expect(receiptQrEscPosModuleSizeForEntry('medium')).toBe(6)
    expect(receiptQrEscPosModuleSizeForEntry('large')).toBe(8)
  })

  it('maps those modules to bitmap QR dots', () => {
    expect(receiptQrBitmapDots('58mm')).toBe(246)
    expect(receiptQrBitmapDots('80mm')).toBe(287)
    expect(receiptQrBitmapDots('58mm', 'medium')).toBe(246)
    expect(receiptQrBitmapDots('58mm', 'large')).toBe(320)
  })
})
