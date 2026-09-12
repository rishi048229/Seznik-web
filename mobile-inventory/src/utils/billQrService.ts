import { getApiBaseUrl } from '@/api/client';
import { PrintSaleData } from '@/services/PrinterService';
import { scanFromURLAsync } from 'expo-camera';

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

export interface ExtractedUpiDetails {
  upiId: string;
  payeeName?: string;
  rawPayload: string;
}

/**
 * Parses a raw QR string payload (e.g. from a standee QR or UPI payment link)
 * and extracts the merchant's Virtual Payment Address (VPA / UPI ID) and store name.
 */
export function parseUpiIdFromQrString(raw: string): ExtractedUpiDetails | null {
  if (!raw || !raw.trim()) return null;
  const str = raw.trim();

  // 1. Direct VPA string (e.g. shop@okhdfcbank or 9876543210@paytm)
  if (isValidUpiVpa(str)) {
    return { upiId: str, rawPayload: str };
  }

  // 2. UPI Deep Link (upi://pay?pa=...&pn=...)
  if (str.toLowerCase().startsWith('upi://') || str.includes('pa=')) {
    try {
      const url = str.startsWith('upi://') ? str : `upi://${str}`;
      const queryIdx = url.indexOf('?');
      if (queryIdx !== -1) {
        const queryString = url.slice(queryIdx + 1);
        const params = new URLSearchParams(queryString);
        const pa = params.get('pa') || params.get('PA');
        const pn = params.get('pn') || params.get('PN');
        if (pa && isValidUpiVpa(pa.trim())) {
          return {
            upiId: pa.trim(),
            payeeName: pn ? decodeURIComponent(pn).trim() : undefined,
            rawPayload: str,
          };
        }
      }
    } catch {
      // ignore & fallback to regex
    }

    const paMatch = str.match(/[?&]pa=([^&]+)/i);
    const pnMatch = str.match(/[?&]pn=([^&]+)/i);
    if (paMatch && paMatch[1]) {
      const decodedPa = decodeURIComponent(paMatch[1]).trim();
      if (isValidUpiVpa(decodedPa)) {
        return {
          upiId: decodedPa,
          payeeName: pnMatch ? decodeURIComponent(pnMatch[1]).trim() : undefined,
          rawPayload: str,
        };
      }
    }
  }

  // 3. Fallback: match any VPA pattern inside the string
  const vpaMatch = str.match(/[a-zA-Z0-9._-]{2,}@[a-zA-Z][a-zA-Z0-9.-]{1,}/);
  if (vpaMatch && isValidUpiVpa(vpaMatch[0])) {
    return { upiId: vpaMatch[0], rawPayload: str };
  }

  return null;
}

/**
 * Scans an uploaded QR code image (from user's gallery) and automatically
 * decodes and extracts the merchant's UPI ID / VPA.
 */
export async function extractUpiFromQrImageAsync(imageUri: string): Promise<ExtractedUpiDetails | null> {
  if (!imageUri) return null;
  try {
    const results = await scanFromURLAsync(imageUri, ['qr']);
    if (results && results.length > 0) {
      for (const res of results) {
        if (res.data) {
          const parsed = parseUpiIdFromQrString(res.data);
          if (parsed) return parsed;
        }
      }
    }
    return null;
  } catch (err) {
    console.warn('[billQrService] QR scan from image failed:', err);
    return null;
  }
}
