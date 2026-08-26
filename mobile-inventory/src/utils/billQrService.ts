import { getApiBaseUrl } from '@/api/client';
import { PrintSaleData } from '@/services/PrinterService';

/**
 * Builds a universal verifiable digital receipt URL for any bill/sale.
 * When scanned by any smartphone camera or QR scanner, opens the digital
 * receipt viewer with full item breakdown and "Download PDF" capability.
 */
export function buildBillPdfUrl(data: Pick<PrintSaleData, 'invoiceNumber'> & { saleId?: string }): string {
  const baseUrl = getApiBaseUrl().replace(/\/api$/, '');
  const idOrNumber = encodeURIComponent(data.invoiceNumber || data.saleId || 'unknown');
  return `${baseUrl}/receipt/${idOrNumber}`;
}

/** True for a merchant VPA such as shop@okhdfcbank or 9876543210@paytm. */
export function isValidUpiVpa(value: string | undefined | null): boolean {
  const v = (value || '').trim();
  if (!v || v.length > 256) return false;
  return /^[a-zA-Z0-9._-]{2,}@[a-zA-Z][a-zA-Z0-9.-]{1,}$/.test(v);
}

/**
 * Builds UPI payment QR string from store settings and grand total.
 * When scanned by any UPI app (GPay, PhonePe, Paytm, BHIM), automatically
 * opens the app and prefills the merchant name and exact dynamic bill amount.
 */
export function buildUpiPayString(upiId: string, storeName: string, amount: number, invoiceNumber?: string): string {
  const cleanUpi = (upiId || '').trim();
  const cleanName = (storeName || 'Store').trim().replace(/[&=]/g, ' ');
  const numAmount = typeof amount === 'number' && !isNaN(amount) ? amount : Number(amount || 0);
  const cleanAmt = (numAmount > 0 ? Math.round(numAmount * 100) / 100 : 0).toFixed(2);
  let uri = `upi://pay?pa=${cleanUpi}&pn=${encodeURIComponent(cleanName)}&am=${cleanAmt}&cu=INR`;
  if (invoiceNumber && invoiceNumber.trim()) {
    uri += `&tn=${encodeURIComponent(`Bill ${invoiceNumber.trim()}`.replace(/[&=]/g, ' ').slice(0, 50))}`;
  }
  return uri;
}
