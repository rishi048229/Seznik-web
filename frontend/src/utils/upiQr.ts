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

export function buildUpiPayLink({ upiId, payeeName, amount, note }: UpiQrParams): string {
  const params = new URLSearchParams({
    pa: upiId,
    pn: payeeName || 'Merchant',
    am: amount.toFixed(2),
    cu: 'INR',
  })
  if (note) params.set('tn', note)
  return `upi://pay?${params.toString()}`
}

/** Renders the UPI QR for the given amount onto a canvas. */
export async function drawUpiQrToCanvas(canvas: HTMLCanvasElement, params: UpiQrParams, size = 180): Promise<void> {
  await drawQrCodeToCanvas(canvas, buildUpiPayLink(params), size)
}
