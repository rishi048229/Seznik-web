// Builds a standard UPI deep link and renders it as a real, scannable QR.
// Shared by the live on-screen checkout QR (POSPage/POSLitePage payment
// modals) and the thermal-receipt QR (receipt.ts) so both encode the exact
// same payload shape.

import { drawQrCodeToCanvas } from './barcodeGenerator'

export interface UpiQrParams {
  /** The merchant's UPI VPA, e.g. "yourname@okhdfcbank". NOT a phone number. */
  upiId: string
  payeeName: string
  amount: number
  /** Shown as the transaction note in most UPI apps. */
  note?: string
}

/** True for a merchant VPA such as shop@okhdfcbank or 9876543210@paytm. */
export function isValidUpiVpa(value: string | undefined | null): boolean {
  const v = (value || '').trim()
  if (!v || v.length > 256) return false
  return /^[a-zA-Z0-9._-]{2,}@[a-zA-Z][a-zA-Z0-9.-]{1,}$/.test(v)
}

/**
 * Builds standard NPCI compliant UPI payment URL.
 * Preserves literal '@' in VPA so UPI scanners (GPay, PhonePe, Paytm, BHIM, Cred)
 * parse the exact merchant ID and exact bill amount without regex/encoding errors.
 */
export function buildUpiPayLink({ upiId, payeeName, amount, note }: UpiQrParams): string {
  const cleanUpi = (upiId || '').trim()
  const cleanName = (payeeName || 'Merchant').trim().replace(/[&=]/g, ' ')
  const numAmount = typeof amount === 'number' && !isNaN(amount) ? amount : Number(amount || 0)
  const cleanAmount = (numAmount > 0 ? (Math.round(numAmount * 100) / 100).toFixed(2) : '0.00')

  let uri = `upi://pay?pa=${cleanUpi}&pn=${encodeURIComponent(cleanName)}&am=${cleanAmount}&cu=INR`
  if (note && note.trim()) {
    uri += `&tn=${encodeURIComponent(note.trim().replace(/[&=]/g, ' ').slice(0, 50))}`
  }
  return uri
}

/**
 * Returns a high-resolution QR image URL encoding the exact bill amount and UPI deep link.
 */
export function getUpiQrImageUrl(params: UpiQrParams, size = 180): string {
  const uri = buildUpiPayLink(params)
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=1&data=${encodeURIComponent(uri)}`
}

export interface ExtractedUpiDetails {
  upiId: string
  payeeName?: string
  rawPayload: string
}

/**
 * Parses a raw QR string payload (e.g. from a standee QR or UPI payment link)
 * and extracts the merchant's Virtual Payment Address (VPA / UPI ID) and store name.
 */
export function parseUpiIdFromQrString(raw: string): ExtractedUpiDetails | null {
  if (!raw || !raw.trim()) return null
  const str = raw.trim()

  // 1. Direct VPA string (e.g. shop@okhdfcbank or 9876543210@paytm)
  if (isValidUpiVpa(str)) {
    return { upiId: str, rawPayload: str }
  }

  // 2. UPI Deep Link (upi://pay?pa=...&pn=...)
  if (str.toLowerCase().startsWith('upi://') || str.includes('pa=')) {
    try {
      const url = str.startsWith('upi://') ? str : `upi://${str}`
      const queryIdx = url.indexOf('?')
      if (queryIdx !== -1) {
        const queryString = url.slice(queryIdx + 1)
        const params = new URLSearchParams(queryString)
        const pa = params.get('pa') || params.get('PA')
        const pn = params.get('pn') || params.get('PN')
        if (pa && isValidUpiVpa(pa.trim())) {
          return {
            upiId: pa.trim(),
            payeeName: pn ? decodeURIComponent(pn).trim() : undefined,
            rawPayload: str,
          }
        }
      }
    } catch {
      // ignore & fallback to regex
    }

    const paMatch = str.match(/[?&]pa=([^&]+)/i)
    const pnMatch = str.match(/[?&]pn=([^&]+)/i)
    if (paMatch && paMatch[1]) {
      const decodedPa = decodeURIComponent(paMatch[1]).trim()
      if (isValidUpiVpa(decodedPa)) {
        return {
          upiId: decodedPa,
          payeeName: pnMatch ? decodeURIComponent(pnMatch[1]).trim() : undefined,
          rawPayload: str,
        }
      }
    }
  }

  // 3. Fallback: match any VPA pattern inside the string
  const vpaMatch = str.match(/[a-zA-Z0-9._-]{2,}@[a-zA-Z][a-zA-Z0-9.-]{1,}/)
  if (vpaMatch && isValidUpiVpa(vpaMatch[0])) {
    return { upiId: vpaMatch[0], rawPayload: str }
  }

  return null
}

/**
 * Scans an uploaded QR code image file in the browser and extracts the merchant's UPI ID.
 */
export async function extractUpiFromQrImageFile(file: File): Promise<ExtractedUpiDetails | null> {
  if (!file) return null
  try {
    if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
      const detector = new (window as any).BarcodeDetector({ formats: ['qr_code'] })
      const imageBitmap = await createImageBitmap(file)
      const barcodes = await detector.detect(imageBitmap)
      if (barcodes && barcodes.length > 0) {
        for (const barcode of barcodes) {
          if (barcode.rawValue) {
            const parsed = parseUpiIdFromQrString(barcode.rawValue)
            if (parsed) return parsed
          }
        }
      }
    }
  } catch (err) {
    console.warn('[upiQr] Web BarcodeDetector scan failed:', err)
  }
  return null
}

/** Renders the UPI QR for the given amount onto a canvas. */
export async function drawUpiQrToCanvas(canvas: HTMLCanvasElement, params: UpiQrParams, size = 180): Promise<void> {
  await drawQrCodeToCanvas(canvas, buildUpiPayLink(params), size)
}


