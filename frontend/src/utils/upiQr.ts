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

/** Renders the UPI QR for the given amount onto a canvas. */
export async function drawUpiQrToCanvas(canvas: HTMLCanvasElement, params: UpiQrParams, size = 180): Promise<void> {
  await drawQrCodeToCanvas(canvas, buildUpiPayLink(params), size)
}
