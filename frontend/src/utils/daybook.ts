export const CASH_IN_TAG = '[Cash In]'
export const CASH_OUT_TAG = '[Cash Out]'
export const CASH_OPENING_TAG = '[Opening]'

export const toDateInputValue = (d: Date) => {
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
  return local.toISOString().split('T')[0]
}

export const toTs = (val: unknown, fallback: number): number => {
  const raw = val as { toDate?: () => Date } | string | number | undefined
  if (typeof raw === 'object' && raw?.toDate) return raw.toDate().getTime()
  if (typeof raw === 'string' || typeof raw === 'number') {
    const ts = new Date(raw).getTime()
    return Number.isNaN(ts) ? fallback : ts
  }
  return fallback
}

export const dayBounds = (dateStr: string) => {
  const selected = new Date(`${dateStr}T00:00:00`)
  const startVal = selected.getTime()
  return { startVal, endVal: startVal + 86400000 }
}

export const isCashInDesc = (description?: string) =>
  Boolean(description?.startsWith(CASH_IN_TAG))

export const isCashOutDesc = (description?: string) =>
  Boolean(description?.startsWith(CASH_OUT_TAG))

export const isOpeningCashDesc = (description?: string) =>
  Boolean(description?.includes(CASH_OPENING_TAG))

export const stripCashTags = (description: string) =>
  description
    .replace(CASH_IN_TAG, '')
    .replace(CASH_OUT_TAG, '')
    .replace(CASH_OPENING_TAG, '')
    .trim()

export const shiftDateValue = (dateStr: string, deltaDays: number) => {
  const d = new Date(`${dateStr}T00:00:00`)
  d.setDate(d.getDate() + deltaDays)
  return toDateInputValue(d)
}
