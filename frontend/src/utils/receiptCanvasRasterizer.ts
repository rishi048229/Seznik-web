import QRCode from 'qrcode'
import type { ReceiptTemplate } from '../types/receiptTemplate'
import type { ReceiptContext } from './receiptEngine'
import { isValidUpiVpa, buildUpiPayLink } from './upiQr'
import { compileGstBreakdownPairs } from './customReceiptEngine'

export interface RasterizedReceipt {
  packed: Uint8Array
  widthBytes: number
  heightDots: number
}

interface RasterOptions {
  showLogo?: boolean
  businessLogoURL?: string | null
  customTemplate?: ReceiptTemplate | null
  isRestaurant?: boolean
  tableNo?: string
  waiterName?: string
  tokenNo?: string
  showTaxBreakdown?: boolean
  itemWiseGst?: boolean
  gstStyle?: 'tax_invoice' | 'bill_of_supply'
  receiptConfig?: {
    showPaymentQR?: boolean
    paymentQrURL?: string
    upiId?: string
    enableBillQrCode?: boolean
  }
}

/**
 * Ensures Google Font "JetBrains Mono" is loaded before drawing to 2D Canvas.
 */
async function ensureJetBrainsMonoLoaded(): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) return
  try {
    await Promise.all([
      document.fonts.load('400 16px "JetBrains Mono"'),
      document.fonts.load('600 18px "JetBrains Mono"'),
      document.fonts.load('700 22px "JetBrains Mono"'),
      document.fonts.load('800 26px "JetBrains Mono"'),
    ])
    await document.fonts.ready
  } catch (err) {
    console.warn('Font loading check timed out, proceeding with canvas render:', err)
  }
}

function loadImg(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = src
  })
}

async function generateQrDataUrl(text: string, sizePx: number): Promise<string | null> {
  try {
    return await QRCode.toDataURL(text, {
      width: sizePx,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: { dark: '#000000', light: '#ffffff' },
    })
  } catch {
    return null
  }
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/)
  const lines: string[] = []
  let currentLine = words[0] || ''

  for (let i = 1; i < words.length; i++) {
    const word = words[i]
    const width = ctx.measureText(currentLine + ' ' + word).width
    if (width < maxWidth) {
      currentLine += ' ' + word
    } else {
      lines.push(currentLine)
      currentLine = word
    }
  }
  if (currentLine) lines.push(currentLine)
  return lines.length ? lines : [text]
}

/**
 * Renders a full sales receipt to an HTML5 Canvas using JetBrains Mono typography,
 * and packs the rendered result into a 1-bit monochrome ESC/POS raster byte buffer.
 */
export async function renderReceiptToMonochromeRaster(
  context: ReceiptContext,
  paper: '58mm' | '80mm',
  options: RasterOptions = {}
): Promise<RasterizedReceipt> {
  await ensureJetBrainsMonoLoaded()

  const is80 = paper === '80mm'
  const widthDots = is80 ? 576 : 384
  const widthBytes = widthDots / 8
  const padX = is80 ? 16 : 8
  const contentW = widthDots - padX * 2

  const canvas = document.createElement('canvas')
  const maxCanvasHeight = 3500
  canvas.width = widthDots
  canvas.height = maxCanvasHeight
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('Failed to acquire 2D canvas context')

  // Solid white background
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, widthDots, maxCanvasHeight)
  ctx.fillStyle = '#000000'
  ctx.textBaseline = 'top'

  const fontFamily = "'JetBrains Mono', monospace"
  const titleSize = is80 ? 26 : 22
  const headerSize = is80 ? 17 : 14
  const bodySize = is80 ? 17 : 14
  const smallSize = is80 ? 15 : 12
  const grandTotalSize = is80 ? 24 : 19

  let curY = 16

  const drawCenteredText = (text: string, fontSize: number, isBold = false) => {
    ctx.font = `${isBold ? '700' : '500'} ${fontSize}px ${fontFamily}`
    const tw = ctx.measureText(text).width
    const tx = Math.max(padX, padX + (contentW - tw) / 2)
    ctx.fillText(text, tx, curY)
    curY += Math.round(fontSize * 1.35)
  }

  const drawTwoColRow = (left: string, right: string, fontSize: number, isBold = false) => {
    ctx.font = `${isBold ? '700' : '500'} ${fontSize}px ${fontFamily}`
    ctx.fillText(left, padX, curY)
    const rw = ctx.measureText(right).width
    ctx.fillText(right, widthDots - padX - rw, curY)
    curY += Math.round(fontSize * 1.35)
  }

  const drawDashedDivider = (y: number) => {
    ctx.beginPath()
    ctx.setLineDash([5, 4])
    ctx.lineWidth = 1.5
    ctx.strokeStyle = '#000000'
    ctx.moveTo(padX, y)
    ctx.lineTo(widthDots - padX, y)
    ctx.stroke()
    ctx.setLineDash([])
  }

  const drawSolidDivider = (y: number) => {
    ctx.beginPath()
    ctx.lineWidth = 1.5
    ctx.strokeStyle = '#000000'
    ctx.moveTo(padX, y)
    ctx.lineTo(widthDots - padX, y)
    ctx.stroke()
  }

  const drawDoubleDivider = (y: number) => {
    ctx.beginPath()
    ctx.lineWidth = 1.5
    ctx.strokeStyle = '#000000'
    ctx.moveTo(padX, y - 2)
    ctx.lineTo(widthDots - padX, y - 2)
    ctx.moveTo(padX, y + 2)
    ctx.lineTo(widthDots - padX, y + 2)
    ctx.stroke()
  }

  const {
    showLogo = false,
    businessLogoURL,
    customTemplate,
    showTaxBreakdown = true,
    itemWiseGst = false,
    gstStyle = 'tax_invoice',
    receiptConfig,
  } = options

  // 1. Business Logo (if available)
  if (showLogo && businessLogoURL) {
    const img = await loadImg(businessLogoURL)
    if (img) {
      const maxLogoW = is80 ? 300 : 200
      const maxLogoH = 80
      const scale = Math.min(1, maxLogoW / img.naturalWidth, maxLogoH / img.naturalHeight)
      const drawW = Math.round((img.naturalWidth || maxLogoW) * scale)
      const drawH = Math.round((img.naturalHeight || maxLogoH) * scale)
      const logoX = padX + (contentW - drawW) / 2

      ctx.drawImage(img, logoX, curY, drawW, drawH)
      curY += drawH + 10
      drawDashedDivider(curY)
      curY += 8
    }
  }

  // 2. Store Header
  const storeName = context.storeName || 'SEZNIK STORE'
  drawCenteredText(storeName, titleSize, true)
  curY += 2

  if (context.storeAddress) {
    const addrLines = wrapText(ctx, context.storeAddress, contentW)
    for (const l of addrLines) drawCenteredText(l, headerSize)
  }
  if (context.storePhone) {
    drawCenteredText(`Phone: ${context.storePhone}`, headerSize)
  }
  if (context.storeGstin) {
    drawCenteredText(`GSTIN: ${context.storeGstin}`, headerSize)
  }

  curY += 4
  drawDashedDivider(curY)
  curY += 8

  // 3. Document Title & Metadata
  const isTaxInv = gstStyle === 'tax_invoice'
  drawCenteredText(isTaxInv ? 'TAX INVOICE' : 'BILL OF SUPPLY', headerSize, true)
  curY += 3

  drawTwoColRow(`Invoice: ${context.invoiceNumber}`, `${context.date} ${context.time}`, headerSize)
  if (context.customerName) {
    curY += 2
    drawTwoColRow(`Customer: ${context.customerName}`, '', headerSize)
  }
  if (context.tableNo || context.tokenNo) {
    curY += 2
    const restInfo = [
      context.tableNo ? `Table: ${context.tableNo}` : '',
      context.tokenNo ? `Token: ${context.tokenNo}` : '',
      context.waiterName ? `Server: ${context.waiterName}` : '',
    ]
      .filter(Boolean)
      .join(' | ')
    drawCenteredText(restInfo, smallSize)
  }

  curY += 6
  drawSolidDivider(curY)
  curY += 8

  // 4. Line Items Table (with Monospaced JetBrains Mono Column Alignment)
  const colItemW = is80 ? 280 : 175
  const colQtyX = is80 ? 330 : 210
  const colRateX = is80 ? 440 : 285
  const colTotalX = widthDots - padX

  ctx.font = `700 ${smallSize}px ${fontFamily}`
  ctx.fillText('ITEM', padX, curY)
  const qtyHdrW = ctx.measureText('QTY').width
  ctx.fillText('QTY', colQtyX - qtyHdrW / 2, curY)
  const rateHdrW = ctx.measureText('RATE').width
  ctx.fillText('RATE', colRateX - rateHdrW, curY)
  const totHdrW = ctx.measureText('AMOUNT').width
  ctx.fillText('AMOUNT', colTotalX - totHdrW, curY)
  curY += Math.round(smallSize * 1.35) + 4

  drawDashedDivider(curY)
  curY += 8

  for (const it of context.items) {
    ctx.font = `500 ${bodySize}px ${fontFamily}`
    const nameLines = wrapText(ctx, it.productName, colItemW)
    const rowStartY = curY

    for (let i = 0; i < nameLines.length; i++) {
      ctx.fillText(nameLines[i], padX, curY)
      curY += Math.round(bodySize * 1.35)
    }

    const qtyStr = it.quantity.toString()
    const rateStr = it.unitPrice.toFixed(2)
    const totStr = it.total.toFixed(2)

    const qW = ctx.measureText(qtyStr).width
    ctx.fillText(qtyStr, colQtyX - qW / 2, rowStartY)

    const rW = ctx.measureText(rateStr).width
    ctx.fillText(rateStr, colRateX - rW, rowStartY)

    const tW = ctx.measureText(totStr).width
    ctx.fillText(totStr, colTotalX - tW, rowStartY)

    if (itemWiseGst && it.gstRate) {
      ctx.font = `400 ${smallSize - 2}px ${fontFamily}`
      ctx.fillText(`(GST ${it.gstRate}%)`, padX + 4, curY)
      curY += Math.round((smallSize - 2) * 1.3)
    }

    curY += 3
  }

  curY += 3
  drawDashedDivider(curY)
  curY += 8

  // 5. Totals Section
  drawTwoColRow('Subtotal', `Rs. ${context.subtotal.toFixed(2)}`, bodySize)
  curY += 2

  if (context.totalDiscount > 0) {
    drawTwoColRow('Discount', `-Rs. ${context.totalDiscount.toFixed(2)}`, bodySize)
    curY += 2
  }

  if (showTaxBreakdown && context.totalTax > 0) {
    const gstPairs = compileGstBreakdownPairs(context, {
      showTaxBreakdown,
      itemWiseGst,
      gstStyle,
    })
    if (gstPairs.length > 0) {
      for (const p of gstPairs) {
        drawTwoColRow(p.left, p.right, smallSize)
        curY += 2
      }
    } else {
      drawTwoColRow('Total Tax (GST)', `Rs. ${context.totalTax.toFixed(2)}`, smallSize)
      curY += 2
    }
  }

  curY += 4
  drawDoubleDivider(curY)
  curY += 10

  // 6. Grand Total (Prominent JetBrains Mono)
  drawTwoColRow('GRAND TOTAL', `Rs. ${context.grandTotal.toFixed(2)}`, grandTotalSize, true)
  curY += 6
  drawDoubleDivider(curY)
  curY += 10

  // 7. Payment Info
  const payMode = (context.paymentMethod || 'CASH').toUpperCase()
  drawTwoColRow(`Paid (${payMode})`, `Rs. ${(context.amountPaid || context.grandTotal).toFixed(2)}`, bodySize)
  curY += 2

  if (context.changeReturned > 0) {
    drawTwoColRow('Change Due', `Rs. ${context.changeReturned.toFixed(2)}`, bodySize)
    curY += 2
  }

  // 8. Scan to Pay UPI QR Code
  const showPayQR =
    receiptConfig?.showPaymentQR &&
    (isValidUpiVpa(receiptConfig?.upiId || context.upiId) || receiptConfig?.paymentQrURL)

  if (showPayQR) {
    curY += 6
    drawDashedDivider(curY)
    curY += 10

    drawCenteredText('SCAN TO PAY VIA UPI', headerSize, true)
    curY += 6

    const upiPayPayload = isValidUpiVpa(receiptConfig?.upiId || context.upiId)
      ? buildUpiPayLink({
          upiId: (receiptConfig?.upiId || context.upiId)!,
          payeeName: context.storeName,
          amount: context.grandTotal,
          note: context.invoiceNumber,
        })
      : receiptConfig?.paymentQrURL!

    const qrSize = is80 ? 180 : 145
    const qrDataUrl = await generateQrDataUrl(upiPayPayload, qrSize)
    if (qrDataUrl) {
      const qrImg = await loadImg(qrDataUrl)
      if (qrImg) {
        const qrX = padX + (contentW - qrSize) / 2
        ctx.drawImage(qrImg, qrX, curY, qrSize, qrSize)
        curY += qrSize + 8
      }
    }
  }

  // 9. Digital Bill PDF QR Code
  if (receiptConfig?.enableBillQrCode) {
    curY += 6
    drawDashedDivider(curY)
    curY += 10

    drawCenteredText('Scan QR for Digital Bill PDF', smallSize, true)
    curY += 6

    const targetId = encodeURIComponent(context.saleId || context.invoiceNumber || 'INV')
    const billPdfUrl =
      typeof window !== 'undefined'
        ? `${window.location.origin}/receipt/${targetId}`
        : `https://api.seznik.com/receipt/${targetId}`

    const qrSize = is80 ? 150 : 125
    const qrDataUrl = await generateQrDataUrl(billPdfUrl, qrSize)
    if (qrDataUrl) {
      const qrImg = await loadImg(qrDataUrl)
      if (qrImg) {
        const qrX = padX + (contentW - qrSize) / 2
        ctx.drawImage(qrImg, qrX, curY, qrSize, qrSize)
        curY += qrSize + 8
      }
    }
  }

  // 10. Footer Message
  if (context.footerMessage) {
    curY += 8
    drawCenteredText(context.footerMessage, smallSize)
    curY += 4
  }

  curY += 24
  const finalHeight = Math.min(Math.max(curY, 100), maxCanvasHeight)

  // Convert canvas pixel buffer to 1-bit monochrome MSB-first packed bytes
  const imgData = ctx.getImageData(0, 0, widthDots, finalHeight)
  const data = imgData.data
  const packed = new Uint8Array(widthBytes * finalHeight)

  for (let y = 0; y < finalHeight; y++) {
    for (let x = 0; x < widthDots; x++) {
      const idx = (y * widthDots + x) * 4
      const alpha = data[idx + 3]
      const luminance = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2]
      // Any sufficiently dark pixel is a printed thermal dot
      if (alpha > 100 && luminance < 190) {
        packed[y * widthBytes + (x >> 3)] |= 0x80 >> (x & 7)
      }
    }
  }

  return {
    packed,
    widthBytes,
    heightDots: finalHeight,
  }
}
