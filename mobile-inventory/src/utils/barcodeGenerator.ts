/**
 * Barcode & EAN-13 / CODE-128 Generation Utility for Seznik POS
 */

// Calculate EAN-13 Checksum digit (GS1 standard MOD 10 algorithm)
export function calculateEAN13Checksum(first12Digits: string): number {
  if (first12Digits.length !== 12) return 0;
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const digit = parseInt(first12Digits[i], 10) || 0;
    // Even index (0, 2, 4...) has weight 1, Odd index (1, 3, 5...) has weight 3
    sum += i % 2 === 0 ? digit : digit * 3;
  }
  const remainder = sum % 10;
  return remainder === 0 ? 0 : 10 - remainder;
}

// Generate valid, unique Indian GS1 EAN-13 barcode (starts with 890)
export function generateEAN13Barcode(seed?: string | number): string {
  if (seed && String(seed).length === 13 && /^\d{13}$/.test(String(seed))) {
    const s = String(seed);
    const first12 = s.slice(0, 12);
    const expectedCheck = calculateEAN13Checksum(first12);
    if (parseInt(s[12], 10) === expectedCheck) {
      return s;
    }
  }

  const prefix = '890';
  // Generate 9 unique digits using high-resolution timestamp slice + random integer
  const nowStr = Date.now().toString().slice(-5);
  const randNum = Math.floor(1000 + Math.random() * 9000).toString();
  const middle = `${nowStr}${randNum}`;
  const first12 = prefix + middle;
  const check = calculateEAN13Checksum(first12);
  return `${first12}${check}`;
}

// Validate whether a string is a valid EAN-13 barcode
export function isValidEAN13(barcode: string): boolean {
  if (!barcode || barcode.length !== 13 || !/^\d{13}$/.test(barcode)) return false;
  const first12 = barcode.slice(0, 12);
  const check = calculateEAN13Checksum(first12);
  return parseInt(barcode[12], 10) === check;
}

// Generate unique alphanumeric CODE-128 barcode
export function generateCode128Barcode(inputCode?: string): string {
  if (inputCode && inputCode.trim().length > 0) return inputCode.trim();
  const randNum = Math.floor(100000 + Math.random() * 900000);
  return `SZN-${randNum}`;
}

// Generate QR Data Payload String
export function generateQRDataPayload(productName: string, price: number, sku: string): string {
  return JSON.stringify({
    app: 'Seznik POS',
    name: productName || 'Product',
    price: price || 0,
    sku: sku || '',
  });
}
