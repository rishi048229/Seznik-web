import { describe, it, expect } from 'vitest'
import {
  RECEIPT_LOGO_DEFAULT_WIDTH_PERCENT,
  receiptLogoMaxDots,
  receiptLogoPrintWidthDots,
  receiptQrBitmapDots,
  receiptQrEscPosModuleSize,
  receiptQrEscPosModuleSizeForEntry,
} from '@shared/receiptPrintGeometry'

describe('receiptPrintGeometry', () => {
  it('uses the web ESC/POS logo caps', () => {
    expect(receiptLogoMaxDots('58mm')).toEqual({ maxWidth: 224, maxHeight: 72 })
    expect(receiptLogoMaxDots('80mm')).toEqual({ maxWidth: 320, maxHeight: 96 })
  })

  it('caps unknown-aspect logos at max height so they are not 40%-of-paper wide', () => {
    expect(RECEIPT_LOGO_DEFAULT_WIDTH_PERCENT).toBe(60)
    expect(receiptLogoPrintWidthDots('58mm', 40)).toBe(72)
    expect(receiptLogoPrintWidthDots('80mm', 40)).toBe(96)
  })

  it('scales a square logo to the height cap', () => {
    expect(receiptLogoPrintWidthDots('58mm', 60, 500, 500)).toBe(72)
    expect(receiptLogoPrintWidthDots('80mm', 60, 500, 500)).toBe(96)
  })

  it('keeps a wide logo within max width', () => {
    expect(receiptLogoPrintWidthDots('58mm', 60, 1000, 200)).toBe(134)
  })

  it('matches web native QR module sizes', () => {
    expect(receiptQrEscPosModuleSize('58mm')).toBe(4)
    expect(receiptQrEscPosModuleSize('80mm')).toBe(6)
    expect(receiptQrEscPosModuleSizeForEntry('small')).toBe(4)
    expect(receiptQrEscPosModuleSizeForEntry('medium')).toBe(5)
    expect(receiptQrEscPosModuleSizeForEntry('large')).toBe(6)
  })

  it('maps those modules to a larger bitmap QR than the old 150/190 mobile sizes', () => {
    expect(receiptQrBitmapDots('58mm')).toBe(164)
    expect(receiptQrBitmapDots('80mm')).toBe(246)
    expect(receiptQrBitmapDots('58mm', 'medium')).toBe(205)
    expect(receiptQrBitmapDots('58mm', 'large')).toBe(246)
  })
})
