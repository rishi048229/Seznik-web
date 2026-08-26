// Shared expiry-date math for the Products page badge/panel and the POS /
// Scan-to-Bill add-to-cart warning toast. A product with no expiryDate is
// simply not expiring — this feature is invisible until opted into per-product.

export const EXPIRY_WARNING_DAYS = 30

/** Whole days until expiry — negative if already expired. Null if no expiryDate. */
export function daysUntilExpiry(expiryDate?: string | Date | null): number | null {
  if (!expiryDate) return null
  const expiry = new Date(expiryDate)
  if (Number.isNaN(expiry.getTime())) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  expiry.setHours(0, 0, 0, 0)
  return Math.round((expiry.getTime() - today.getTime()) / 86400000)
}

export function isExpiringSoon(expiryDate?: string | Date | null, withinDays = EXPIRY_WARNING_DAYS): boolean {
  const days = daysUntilExpiry(expiryDate)
  return days !== null && days <= withinDays
}

export function isExpired(expiryDate?: string | Date | null): boolean {
  const days = daysUntilExpiry(expiryDate)
  return days !== null && days < 0
}

/** "Expired 3 days ago" / "Expires today" / "Expires in 12 days". Empty string if no expiryDate. */
export function formatExpiryMessage(expiryDate?: string | Date | null): string {
  const days = daysUntilExpiry(expiryDate)
  if (days === null) return ''
  if (days < 0) return `Expired ${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} ago`
  if (days === 0) return 'Expires today'
  return `Expires in ${days} day${days === 1 ? '' : 's'}`
}
