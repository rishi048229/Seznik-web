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

/**
 * Builds UPI payment QR string from store settings and grand total.
 * When scanned by any UPI app (GPay, PhonePe, Paytm, BHIM), automatically
 * opens the app and prefills the merchant name and exact dynamic bill amount.
 */
export function buildUpiPayString(upiId: string, storeName: string, amount: number, invoiceNumber?: string): string {
  const cleanUpi = (upiId || 'store@upi').trim();
  const cleanName = encodeURIComponent((storeName || 'Store').trim());
  const cleanAmt = Math.max(0, amount || 0).toFixed(2);
  const note = invoiceNumber ? `&tn=${encodeURIComponent(`Bill ${invoiceNumber}`)}` : '';
  return `upi://pay?pa=${encodeURIComponent(cleanUpi)}&pn=${cleanName}&am=${cleanAmt}&cu=INR${note}`;
}
