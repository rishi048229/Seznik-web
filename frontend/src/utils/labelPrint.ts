import { EscPosBuilder } from './escpos'
import type { LabelElement } from '@/types/settings.types'

export interface LabelData {
  businessName: string
  productName: string
  price: string
  /** Barcode/QR payload — a product's barcode, falling back to its SKU. */
  barcodeValue: string
  sku?: string
  category?: string
}

// Shared default layout — used both as the Label Designer's starting point
// and as the fallback template anywhere else in the app that prints a label
export const defaultLabelTemplate: LabelElement[] = [
  { id: 'el-business', type: 'businessName', align: 'center', bold: true, fontSize: 'medium' },
  { id: 'el-product', type: 'productName', align: 'center', bold: false, fontSize: 'small' },
  { id: 'el-barcode', type: 'barcode', align: 'center', bold: false },
  { id: 'el-mrp-hdr', type: 'mrpHeader', align: 'center', bold: false, fontSize: 'small', prefix: 'MRP (Incl. of all taxes)' },
  { id: 'el-price', type: 'price', align: 'center', bold: true, fontSize: 'large', prefix: 'Rs. ' },
]

export const PRESET_RETAIL_DUAL_CODE: LabelElement[] = [
  { id: 'el-1', type: 'businessName', align: 'center', bold: true, fontSize: 'medium' },
  { id: 'el-2', type: 'productName', align: 'left', bold: true, fontSize: 'small' },
  { id: 'el-3', type: 'sideBySideBarcodeQr', align: 'center', bold: false },
  { id: 'el-4', type: 'mrpHeader', align: 'left', bold: false, fontSize: 'small', prefix: 'MRP (Incl. of all taxes)' },
  { id: 'el-5', type: 'price', align: 'left', bold: true, fontSize: 'medium', prefix: 'Rs. ' },
]

export const PRESET_CENTERED_STANDARD: LabelElement[] = [
  { id: 'el-1', type: 'businessName', align: 'center', bold: true, fontSize: 'medium' },
  { id: 'el-2', type: 'productName', align: 'center', bold: true, fontSize: 'medium' },
  { id: 'el-3', type: 'barcode', align: 'center', bold: false },
  { id: 'el-4', type: 'divider', align: 'center', bold: false },
  { id: 'el-5', type: 'price', align: 'center', bold: true, fontSize: 'large', prefix: 'Rs. ' },
]

export const PRESET_MINIMAL_TAG: LabelElement[] = [
  { id: 'el-1', type: 'productName', align: 'left', bold: true, fontSize: 'small' },
  { id: 'el-2', type: 'barcode', align: 'center', bold: false },
  { id: 'el-3', type: 'price', align: 'right', bold: true, fontSize: 'medium', prefix: 'Rs. ' },
]

/** Sanitizes text to remove non-ASCII characters (e.g. ₹ -> Rs.) that cause Chinese mojibake on printers */
export function cleanTextForPrinter(str: string): string {
  if (!str) return ''
  return str.replace(/₹/g, 'Rs. ').replace(/[^\x00-\x7F]/g, '').trim()
}

export const resolveElementText = (el: LabelElement, data: LabelData): string => {
  const pfx = el.prefix ?? ''
  const sfx = el.suffix ?? ''
  let val = ''

  switch (el.type) {
    case 'businessName': val = data.businessName; break
    case 'productName': val = data.productName; break
    case 'price': val = data.price; break
    case 'mrpHeader': val = el.text || 'MRP (Incl. of all taxes)'; break
    case 'sku': val = data.sku || data.barcodeValue; break
    case 'category': val = data.category || ''; break
    case 'custom': val = el.text ?? ''; break
    case 'barcode':
    case 'qrCode':
    case 'sideBySideBarcodeQr':
    case 'divider':
      return ''
  }

  const raw = `${pfx}${val}${sfx}`
  return cleanTextForPrinter(raw)
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
    sku: cleanTextForPrinter(data.sku || ''),
    category: cleanTextForPrinter(data.category || ''),
  }

  for (const el of template) {
    builder.align(el.align || 'center')

    if (el.type === 'divider') {
      builder.line('--------------------------------')
      continue
    }

    if (el.type === 'barcode' || el.type === 'qrCode' || el.type === 'sideBySideBarcodeQr') {
      if (el.type === 'qrCode' || barcodeType === 'QR') {
        builder.qr(safeData.barcodeValue, 3)
      } else {
        builder.barcode(barcodeType, safeData.barcodeValue, 40)
      }
      builder.newline()
      continue
    }

    const text = resolveElementText(el, safeData)
    if (!text) continue

    const isLarge = el.large || el.fontSize === 'large' || el.fontSize === 'xlarge'
    const isBold = el.bold ?? false

    builder.bold(isBold)
    builder.doubleSize(isLarge)
    builder.line(text)
    builder.bold(false)
    builder.doubleSize(false)
  }

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
  labelHeight = 30,
  offsetX = 0,
  offsetY = 0,
  barcodeHeight = 38
): Uint8Array {
  const encoder = new TextEncoder()
  const widthDots = Math.max(100, Math.round(labelWidth * 8)) // 8 dots/mm at 203 DPI
  const offsetXDots = Math.round((offsetX || 0) * 8)
  const offsetYDots = Math.round((offsetY || 0) * 8)

  const safeData: LabelData = {
    businessName: cleanTextForPrinter(data.businessName),
    productName: cleanTextForPrinter(data.productName),
    price: cleanTextForPrinter(data.price),
    barcodeValue: cleanTextForPrinter(data.barcodeValue || '0000000000'),
    sku: cleanTextForPrinter(data.sku || ''),
    category: cleanTextForPrinter(data.category || ''),
  }

  let tspl = `SIZE ${labelWidth} mm, ${labelHeight} mm\r\n`
  tspl += `GAP 2 mm, 0 mm\r\n`
  tspl += `DIRECTION 1\r\n`
  tspl += `CLS\r\n`

  let y = Math.max(10, 16 + offsetYDots)

  for (const el of template) {
    const align = el.align || 'center'

    if (el.type === 'divider') {
      const startX = Math.max(5, 15 + offsetXDots)
      const lineLen = Math.max(20, widthDots - 30)
      tspl += `BAR ${startX},${y},${lineLen},2\r\n`
      y += 10
      continue
    }

    if (el.type === 'sideBySideBarcodeQr') {
      const barcodeStr = safeData.barcodeValue || '0000000000'
      const leftHalfDots = Math.floor(widthDots * 0.62)
      const rightHalfDots = widthDots - leftHalfDots

      const moduleWidth = (barcodeStr.length * 11 + 35) * 2 > (leftHalfDots - 10) ? 1 : 2
      const barWidthDots = (barcodeStr.length * 11 + 35) * moduleWidth
      const xBar = Math.max(5, Math.floor((leftHalfDots - barWidthDots) / 2) + offsetXDots)

      const qrSizeDots = 70 // ~8.7mm QR size
      const xQr = Math.max(leftHalfDots, leftHalfDots + Math.floor((rightHalfDots - qrSizeDots) / 2) + offsetXDots)

      tspl += `BARCODE ${xBar},${y},"128",34,2,0,${moduleWidth},${moduleWidth},"${barcodeStr}"\r\n`
      tspl += `QRCODE ${xQr},${y},L,3,A,0,"${barcodeStr}"\r\n`

      y += 62
      continue
    }

    if (el.type === 'barcode' || el.type === 'qrCode') {
      const barcodeStr = safeData.barcodeValue || '0000000000'
      if (el.type === 'qrCode' || barcodeType === 'QR') {
        const qrSizeDots = 84 // ~10.5mm QR size
        const x = align === 'left'
          ? Math.max(5, 15 + offsetXDots)
          : align === 'right'
          ? Math.max(5, widthDots - qrSizeDots - 15 + offsetXDots)
          : Math.max(5, Math.floor((widthDots - qrSizeDots) / 2) + offsetXDots)

        tspl += `QRCODE ${x},${y},L,4,A,0,"${barcodeStr}"\r\n`
        y += 92
      } else {
        const h = barcodeHeight || 52 // 52 dots = ~6.5mm height (larger & clearer barcode)
        const moduleWidth = (barcodeStr.length * 11 + 55) * 2 > (widthDots - 20) ? 1 : 2
        // Code128 total width including start (11), check (11), stop (13), and quiet zones (20) = N*11 + 55
        const barcodeWidthDots = (barcodeStr.length * 11 + 55) * moduleWidth

        const x = align === 'left'
          ? Math.max(5, 15 + offsetXDots)
          : align === 'right'
          ? Math.max(5, widthDots - barcodeWidthDots - 15 + offsetXDots)
          : Math.max(5, Math.floor((widthDots - barcodeWidthDots) / 2) + offsetXDots)

        // TSPL BARCODE x, y, "code", height, human_readable (2 = centered below), rotation, narrow, wide, "data"
        tspl += `BARCODE ${x},${y},"128",${h},2,0,${moduleWidth},${moduleWidth},"${barcodeStr}"\r\n`
        y += h + 28
      }
      continue
    }

    const text = resolveElementText(el, safeData)
    if (!text) continue

    // Shift price element down slightly towards bottom of sticker
    if (el.type === 'price') {
      y += 8
    }

    const sizeKey = el.fontSize || (el.large ? 'large' : 'medium')
    let font = '"2"'
    let charWidth = 12
    let advanceY = 24
    let mulX = 1
    let mulY = 1

    if (sizeKey === 'small') {
      font = '"1"'
      charWidth = 8
      advanceY = 18
    } else if (sizeKey === 'medium') {
      font = '"2"'
      charWidth = 12
      advanceY = 24
    } else if (sizeKey === 'large') {
      font = '"3"'
      charWidth = 16
      advanceY = 30
    } else if (sizeKey === 'xlarge') {
      font = '"4"'
      charWidth = 24
      advanceY = 38
    }

    const textWidthDots = text.length * charWidth * mulX
    const x = align === 'left'
      ? Math.max(5, 15 + offsetXDots)
      : align === 'right'
      ? Math.max(5, widthDots - textWidthDots - 15 + offsetXDots)
      : Math.max(5, Math.floor((widthDots - textWidthDots) / 2) + offsetXDots)

    const safeText = text.replace(/"/g, '').replace(/[\r\n]+/g, ' ')
    tspl += `TEXT ${x},${y},${font},0,${mulX},${mulY},"${safeText}"\r\n`
    y += advanceY
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

