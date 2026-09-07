export const formatINR = (amount: number): string => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  }).format(amount)
}

export const formatCurrency = (amount: number, currency = '₹'): string => {
  return `${currency} ${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

// Compact Indian notation for space-constrained UI (chart legends, etc): 36.5L, 48.0K, 1.2Cr
export const formatINRCompact = (amount: number): string => {
  const abs = Math.abs(amount)
  const sign = amount < 0 ? '-' : ''
  if (abs >= 1_00_00_000) return `${sign}₹${(abs / 1_00_00_000).toFixed(1)}Cr`
  if (abs >= 1_00_000) return `${sign}₹${(abs / 1_00_000).toFixed(1)}L`
  if (abs >= 1_000) return `${sign}₹${(abs / 1_000).toFixed(1)}K`
  return `${sign}₹${abs.toFixed(2)}`
}

/**
 * Safely rounds a monetary number to 2 decimal places to prevent IEEE-754 floating-point inaccuracies
 * (e.g. 1274.6799999999998 -> 1274.68, 0.1 + 0.2 -> 0.3)
 */
export const roundCurrency = (amount: number): number => {
  return Math.round((Number(amount) || 0) * 100 + Number.EPSILON) / 100
}
