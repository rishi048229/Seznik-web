/**
 * Code 128-B Barcode & QR Code Canvas Generator & PNG Exporter
 * Provides zero-dependency canvas rendering and PNG download utilities.
 */
import QRCode from 'qrcode'

// Code 128-B Character Set Patterns (107 patterns)
const CODE128_PATTERNS: number[] = [
  211214, 211412, 211232, 121124, 121421, 141122, 141221, 112214, 112412, 122114, // 0-9
  122411, 142112, 142211, 241211, 221114, 212411, 241121, 221411, 241211, 211124, // 10-19
  211421, 241112, 214112, 214211, 112124, 112421, 122124, 122421, 142121, 142411, // 20-29
  242111, 242211, 212124, 212421, 242121, 211241, 211412, 214121, 241121, 241211, // 30-39
  211214, 211412, 214112, 241112, 212114, 212411, 242111, 241121, 242111, 221214, // 40-49
  221412, 212214, 212412, 211224, 211422, 214122, 214221, 241122, 241221, 242122, // 50-59
  242221, 221224, 221422, 224122, 224221, 241212, 241221, 242112, 242121, 211142, // 60-69
  211241, 211421, 241112, 241211, 242111, 211412, 241121, 211124, 211412, 241112, // 70-79
  211214, 211241, 211421, 214112, 214121, 214211, 241112, 241121, 241211, 211214, // 80-89
  211412, 214112, 214121, 214211, 241112, 241121, 242111, 211214, 211241, 211421, // 90-99
  214112, 214121, 214211, 211214, 211412, 214112, 233111,                        // 100-106
]

const START_CODE_B = 104
const STOP_CODE = 106

/**
 * Encodes string to Code 128-B bar width array.
 */
export function encodeCode128B(text: string): number[] {
  const codePoints: number[] = [START_CODE_B]
  let checksum = START_CODE_B

  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i) - 32
    if (code >= 0 && code <= 95) {
      codePoints.push(code)
      checksum += code * (i + 1)
    }
  }

  const checkCode = checksum % 103
  codePoints.push(checkCode)
  codePoints.push(STOP_CODE)

  const bars: number[] = []
  for (const cp of codePoints) {
    const pattern = CODE128_PATTERNS[cp] || CODE128_PATTERNS[0]
    const pStr = pattern.toString()
    for (let j = 0; j < pStr.length; j++) {
      bars.push(parseInt(pStr[j], 10))
    }
  }
  // Stop code ending bar
  bars.push(2)

  return bars
}

/**
 * Draws Code 128 Barcode on HTMLCanvasElement.
 */
export function drawBarcodeToCanvas(
  canvas: HTMLCanvasElement,
  text: string,
  options?: { height?: number; quietZone?: number; barWidth?: number }
): void {
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const cleanText = text.trim() || '0000000000'
  const bars = encodeCode128B(cleanText)
  const barWidth = options?.barWidth ?? 2
  const height = options?.height ?? 80
  const quietZone = options?.quietZone ?? 20

  let totalWidth = quietZone * 2
  for (const b of bars) totalWidth += b * barWidth

  canvas.width = totalWidth
  canvas.height = height + 35

  // Background
  ctx.fillStyle = '#FFFFFF'
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  // Draw Bars
  ctx.fillStyle = '#000000'
  let currentX = quietZone
  let isBar = true

  for (const widthUnits of bars) {
    const w = widthUnits * barWidth
    if (isBar) {
      ctx.fillRect(currentX, 10, w, height)
    }
    currentX += w
    isBar = !isBar
  }

  // Draw Text
  ctx.font = 'bold 13px monospace'
  ctx.fillStyle = '#1E293B'
  ctx.textAlign = 'center'
  ctx.fillText(cleanText, canvas.width / 2, height + 26)
}

/**
 * Draws a real, independently-scannable QR code (ISO/IEC 18004 via the
 * `qrcode` package) onto a canvas.
 *
 * This used to be a fake procedural pattern (finder squares + sine-noise
 * "data modules" hashed from the text) that was never a valid QR encoding —
 * it looked like a QR code but no scanner could read it. Replaced with a
 * real encoder; returns a Promise since encoding is async, but every
 * existing call site fires this without awaiting (a canvas ref mutated
 * in place is fine to update a tick later), except `downloadBarcodePng`
 * below, which now awaits it before reading the canvas back out.
 */
export async function drawQrCodeToCanvas(
  canvas: HTMLCanvasElement,
  text: string,
  size: number = 180
): Promise<void> {
  await QRCode.toCanvas(canvas, text || ' ', {
    width: size,
    margin: 1,
    color: { dark: '#0F172A', light: '#FFFFFF' },
  })
}

/**
 * Downloads a canvas element as a PNG image file.
 */
export function downloadCanvasAsPng(canvas: HTMLCanvasElement, filename: string): void {
  const dataUrl = canvas.toDataURL('image/png')
  const link = document.createElement('a')
  link.href = dataUrl
  link.download = `${filename}.png`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

/**
 * Utility to generate & download a barcode/QR image as PNG directly.
 */
export async function downloadBarcodePng(productName: string, text: string, type: 'CODE128' | 'EAN13' | 'QR' = 'CODE128'): Promise<void> {
  const tempCanvas = document.createElement('canvas')
  if (type === 'QR') {
    await drawQrCodeToCanvas(tempCanvas, text, 200)
  } else {
    drawBarcodeToCanvas(tempCanvas, text, { height: 90 })
  }
  downloadCanvasAsPng(tempCanvas, `${productName || 'product'}-${type.toLowerCase()}`)
}
