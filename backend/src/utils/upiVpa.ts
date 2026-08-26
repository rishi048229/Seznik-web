/** Merchant UPI VPA, e.g. shopname@okhdfcbank or 9876543210@paytm. */
const UPI_VPA_RE = /^[a-zA-Z0-9._-]{2,}@[a-zA-Z][a-zA-Z0-9.-]{1,}$/;

export function isValidUpiVpa(value: string | undefined | null): boolean {
  const v = (value || '').trim();
  return v.length > 0 && v.length <= 256 && UPI_VPA_RE.test(v);
}
