import { EscPosBuilder } from './escpos'
import type { LabelElement } from '@/types/settings.types'

// Shared default layout — used both as the Label Designer's starting point
// and as the fallback template anywhere else in the app that prints a label
// (e.g. Products page) before the user has customized one.
export const defaultLabelTemplate: LabelElement[] = [
  { id: 'el-business', type: 'businessName', align: 'center', bold: false, large: false },
  { id: 'el-product', type: 'productName', align: 'center', bold: true, large: false },
  { id: 'el-barcode', type: 'barcode', align: 'center', bold: false, large: false },
  { id: 'el-price', type: 'price', align: 'center', bold: true, large: true },
]

export interface LabelData {
  businessName: string
  productName: string
  price: string
  /** Barcode/QR payload — a product's barcode, falling back to its SKU. */
  barcodeValue: string
}

const resolveElementText = (el: LabelElement, data: LabelData): string => {
  switch (el.type) {
    case 'businessName': return data.businessName
    case 'productName': return data.productName
    case 'price': return data.price
    case 'custom': return el.text ?? ''
    case 'barcode': return '' // rendered as a real barcode/QR, not text
  }
}

/**
 * Builds compact ESC/POS bytes scaled specifically to fit inside small sticker label
 * dimensions (e.g. 50mm x 30mm) without overflowing across label gap boundaries.
 */
export function generateLabelEscPos(
  template: LabelElement[],
  barcodeType: 'CODE128' | 'EAN13' | 'QR',
  data: LabelData
): Uint8Array {
  const builder = new EscPosBuilder()
  builder.init()

  for (const el of template) {
    builder.align(el.align)

    if (el.type === 'barcode') {
      if (barcodeType === 'QR') {
        // moduleSize = 3 creates a compact ~9.5mm QR code that easily fits on a 30mm label
        builder.qr(data.barcodeValue || '0000000000', 3)
      } else {
        // heightDots = 40 (~5mm tall) keeps 1D barcode compact
        builder.barcode(barcodeType, data.barcodeValue || '0000000000', 40)
      }
      builder.newline()
      continue
    }

    const text = resolveElementText(el, data)
    if (!text) continue

    builder.bold(el.bold)
    builder.doubleSize(el.large)
    builder.line(text)
    builder.bold(false)
    builder.doubleSize(false)
  }

  // Feed 1 line to advance to cutter/edge without spilling into next sticker
  builder.feed(1)
  return builder.toBytes()
}

/**
 * Builds TSPL / TSPL2 command bytes for dedicated dual-mode label printers.
 * Emits exact SIZE, GAP, and coordinate placement so the printer hardware
 * gap sensor aligns every print to 1 physical sticker with all text & graphics.
 */
export function generateLabelTspl(
  template: LabelElement[],
  barcodeType: 'CODE128' | 'EAN13' | 'QR',
  data: LabelData,
  labelWidth = 50,
  labelHeight = 30
): Uint8Array {
  const encoder = new TextEncoder()
  const widthDots = labelWidth * 8

  let tspl = `SIZE ${labelWidth} mm, ${labelHeight} mm\r\n`
  tspl += `GAP 2 mm, 0 mm\r\n`
  tspl += `DIRECTION 1\r\n`
  tspl += `CLS\r\n`

  let y = 12

  for (const el of template) {
    if (el.type === 'barcode') {
      if (barcodeType === 'QR') {
        const qrSizeDots = 100 // ~12.5mm QR size at cell_width 4
        const x = el.align === 'left' ? 15 : el.align === 'right' ? Math.max(10, widthDots - qrSizeDots - 15) : Math.max(10, Math.floor((widthDots - qrSizeDots) / 2))
        tspl += `QRCODE ${x},${y},L,4,A,0,"${data.barcodeValue || '0000000000'}"\r\n`
        y += 105
      } else {
        const barcodeWidthDots = Math.min(widthDots - 30, (data.barcodeValue || '0000000000').length * 14 + 40)
        const x = el.align === 'left' ? 15 : el.align === 'right' ? Math.max(10, widthDots - barcodeWidthDots - 15) : Math.max(10, Math.floor((widthDots - barcodeWidthDots) / 2))
        tspl += `BARCODE ${x},${y},"128",40,1,0,2,2,"${data.barcodeValue || '0000000000'}"\r\n`
        y += 60
      }
      continue
    }

    const text = resolveElementText(el, data)
    if (!text) continue

    const font = el.large ? '"3"' : '"2"'
    const charWidth = el.large ? 16 : 12
    const mulX = 1
    const mulY = el.large ? 2 : 1
    const textWidthDots = text.length * charWidth * mulX

    const x = el.align === 'left'
      ? 15
      : el.align === 'right'
      ? Math.max(10, widthDots - textWidthDots - 15)
      : Math.max(10, Math.floor((widthDots - textWidthDots) / 2))

    // Valid TSPL spec TEXT command: TEXT x, y, "font", rotation, x-mul, y-mul, "string"
    const safeText = text.replace(/"/g, '').replace(/[\r\n]+/g, ' ')
    tspl += `TEXT ${x},${y},${font},0,${mulX},${mulY},"${safeText}"\r\n`
    y += el.large ? 38 : 24
  }

  tspl += `PRINT 1,1\r\n`
  return encoder.encode(tspl)
}

/**
 * Generates TSPL Gap Auto-Calibration command bytes to calibrate
 * physical sticker gap sensors on dual-mode label printers.
 */
export function generateGapCalibrationBytes(): Uint8Array {
  const encoder = new TextEncoder()
  return encoder.encode('GAPDETECT\r\nAUTO GAP\r\n')
}
