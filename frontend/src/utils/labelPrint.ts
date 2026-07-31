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

/** Sanitizes text to remove non-ASCII characters (e.g. ₹ -> Rs.) that cause Chinese mojibake on printers */
function cleanTextForPrinter(str: string): string {
  if (!str) return ''
  return str.replace(/₹/g, 'Rs. ').replace(/[^\x00-\x7F]/g, '').trim()
}

const resolveElementText = (el: LabelElement, data: LabelData): string => {
  let text = ''
  switch (el.type) {
    case 'businessName': text = data.businessName; break
    case 'productName': text = data.productName; break
    case 'price': text = data.price; break
    case 'custom': text = el.text ?? ''; break
    case 'barcode': return '' // rendered as a real barcode/QR, not text
  }
  return cleanTextForPrinter(text)
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

  const safeData: LabelData = {
    businessName: cleanTextForPrinter(data.businessName),
    productName: cleanTextForPrinter(data.productName),
    price: cleanTextForPrinter(data.price),
    barcodeValue: cleanTextForPrinter(data.barcodeValue || '0000000000'),
  }

  for (const el of template) {
    builder.align(el.align)

    if (el.type === 'barcode') {
      if (barcodeType === 'QR') {
        // moduleSize = 3 creates a compact ~9.5mm QR code that easily fits on a 30mm label
        builder.qr(safeData.barcodeValue, 3)
      } else {
        // heightDots = 40 (~5mm tall) keeps 1D barcode compact
        builder.barcode(barcodeType, safeData.barcodeValue, 40)
      }
      builder.newline()
      continue
    }

    const text = resolveElementText(el, safeData)
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
  const widthDots = labelWidth * 8 // 8 dots/mm at 203 DPI

  const safeData: LabelData = {
    businessName: cleanTextForPrinter(data.businessName),
    productName: cleanTextForPrinter(data.productName),
    price: cleanTextForPrinter(data.price),
    barcodeValue: cleanTextForPrinter(data.barcodeValue || '0000000000'),
  }

  let tspl = `SIZE ${labelWidth} mm, ${labelHeight} mm\r\n`
  tspl += `GAP 2 mm, 0 mm\r\n`
  tspl += `DIRECTION 1\r\n`
  tspl += `CLS\r\n`

  let y = 12

  for (const el of template) {
    if (el.type === 'barcode') {
      const barcodeStr = safeData.barcodeValue || '0000000000'
      if (barcodeType === 'QR') {
        const qrSizeDots = 90 // ~11mm QR size
        const x = el.align === 'left'
          ? 15
          : el.align === 'right'
          ? Math.max(10, widthDots - qrSizeDots - 15)
          : Math.max(10, Math.floor((widthDots - qrSizeDots) / 2))

        tspl += `QRCODE ${x},${y},L,4,A,0,"${barcodeStr}"\r\n`
        y += 98
      } else {
        // Dynamic narrow bar sizing for Code 128:
        // Use narrow=1 for longer barcodes (>10 chars) so they fit nicely centered on a 50mm label
        const narrow = barcodeStr.length > 10 ? 1 : 2
        const narrowDots = narrow === 1 ? 1 : 2
        const barcodeWidthDots = Math.min(widthDots - 20, (barcodeStr.length + 4) * 11 * narrowDots)
        
        const x = el.align === 'left'
          ? 15
          : el.align === 'right'
          ? Math.max(10, widthDots - barcodeWidthDots - 15)
          : Math.max(10, Math.floor((widthDots - barcodeWidthDots) / 2))

        // TSPL BARCODE x, y, "code", height, human_readable(1=below), rotation, narrow, wide, "data"
        tspl += `BARCODE ${x},${y},"128",42,1,0,${narrow},${narrow},"${barcodeStr}"\r\n`
        // 42 dots height + 20 dots human-readable text + 10 dots spacing = 72 dots advance
        y += 72
      }
      continue
    }

    const text = resolveElementText(el, safeData)
    if (!text) continue

    const font = el.large ? '"3"' : '"2"'
    const charWidth = el.large ? 14 : 10
    const mulX = 1
    const mulY = 1
    const textWidthDots = text.length * charWidth * mulX

    const x = el.align === 'left'
      ? 15
      : el.align === 'right'
      ? Math.max(10, widthDots - textWidthDots - 15)
      : Math.max(10, Math.floor((widthDots - textWidthDots) / 2))

    // Valid TSPL TEXT command: TEXT x, y, "font", rotation, x-mul, y-mul, "string"
    const safeText = text.replace(/"/g, '').replace(/[\r\n]+/g, ' ')
    tspl += `TEXT ${x},${y},${font},0,${mulX},${mulY},"${safeText}"\r\n`
    y += el.large ? 32 : 24
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
