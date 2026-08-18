/**
 * Finds the product a scanned/typed code refers to. Exact match on barcode, SKU, or id
 * (case-insensitive) first; a numeric fallback only kicks in when BOTH the scanned code and the
 * product's barcode are full-length (>=8 digit) numeric codes, matched by exact equality after
 * stripping leading zeros — never by a suffix/substring match.
 *
 * The previous version (duplicated across every scan handler in the app) matched via
 * `code.endsWith(productDigits) || productDigits.endsWith(code)`, which silently matched *any*
 * scanned barcode whose digits happened to end with a short/partial barcode stored on some other
 * product — in practice this meant every scan resolved to whichever product in the catalog had
 * the shortest/most generic barcode (e.g. always "Tea"), regardless of what was actually scanned.
 */
export function matchProductByCode<T extends { barcode?: string | null; sku?: string | null; id: string }>(
  products: T[],
  rawCode: string
): T | undefined {
  const raw = String(rawCode || '').trim();
  if (!raw) return undefined;
  const cleanNum = raw.replace(/[^0-9]/g, '');

  return products.find((p) => {
    const pBar = (p.barcode || '').trim();
    const pSku = (p.sku || '').trim();
    const pId = String(p.id || '').trim();

    if (pBar && pBar.toLowerCase() === raw.toLowerCase()) return true;
    if (pSku && pSku.toLowerCase() === raw.toLowerCase()) return true;
    if (pId === raw) return true;

    const pDigits = pBar.replace(/[^0-9]/g, '');
    if (pDigits.length >= 8 && cleanNum.length >= 8) {
      return pDigits.replace(/^0+/, '') === cleanNum.replace(/^0+/, '');
    }
    return false;
  });
}
