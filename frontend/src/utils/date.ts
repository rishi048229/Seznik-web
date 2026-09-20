import { format, startOfDay as fnsStartOfDay, endOfDay } from 'date-fns'

export const formatDate = (date: Date | number | string, pattern = 'dd MMM yyyy'): string => {
  return format(new Date(date), pattern)
}

export const parseSaleDate = (date: unknown): Date => {
  if (date && typeof date === 'object' && typeof (date as { toDate?: () => Date }).toDate === 'function') {
    return (date as { toDate: () => Date }).toDate()
  }
  if (typeof date === 'string' || typeof date === 'number') {
    const parsed = new Date(date)
    if (!Number.isNaN(parsed.getTime())) return parsed
  }
  return new Date()
}

/** YYYY-MM-DD in the user's local calendar — not UTC. */
export const localDateInputValue = (date = new Date()): string => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** Keep the chosen bill date, but stamp the current clock so receipts are not stuck at 12:00. */
export const saleTimestampFromBillDate = (billDate?: string | null): string => {
  const now = new Date()
  if (!billDate) return now.toISOString()
  const [year, month, day] = billDate.split('-').map(Number)
  if (!year || !month || !day) return now.toISOString()
  return new Date(
    year,
    month - 1,
    day,
    now.getHours(),
    now.getMinutes(),
    now.getSeconds(),
    now.getMilliseconds()
  ).toISOString()
}

const isLegacyNoonStamp = (date: Date): boolean =>
  date.getHours() === 12 && date.getMinutes() === 0 && date.getSeconds() === 0

/** Older POS bills were saved at local noon. Use the real clock on that same date. */
export const effectiveReceiptDate = (date: unknown): Date => {
  const parsed = parseSaleDate(date)
  if (!isLegacyNoonStamp(parsed)) return parsed
  const now = new Date()
  return new Date(
    parsed.getFullYear(),
    parsed.getMonth(),
    parsed.getDate(),
    now.getHours(),
    now.getMinutes(),
    now.getSeconds()
  )
}

export const formatReceiptTime = (date: unknown): string =>
  effectiveReceiptDate(date).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })

export const formatReceiptDateTime = (date: unknown, showTime = true): string => {
  const parsed = effectiveReceiptDate(date)
  const dateStr = parsed.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
  if (!showTime) return dateStr
  return `${dateStr} ${formatReceiptTime(parsed)}`
}

export const composeReceiptDateLabel = (
  dateLabel: string | undefined,
  saleDate: unknown,
  showTime = true
): string => {
  if (!dateLabel) return formatReceiptDateTime(saleDate, showTime)
  const stripped = dateLabel.replace(/\s+\d{1,2}:\d{2}(?:\s*[APap][Mm])?.*$/, '').trim()
  if (!showTime) return stripped || dateLabel
  if (/\d{1,2}:\d{2}/.test(dateLabel) && !/\b12:00\b/.test(dateLabel)) return dateLabel
  return `${stripped || dateLabel} ${formatReceiptTime(saleDate)}`
}

export const startOfDay = (date: Date): Date => {
  return fnsStartOfDay(date)
}

export const getEndOfDay = (date: Date): Date => {
  return endOfDay(date)
}

export const getDateRange = (days: number): { start: Date; end: Date } => {
  const end = new Date()
  const start = new Date()
  start.setDate(start.getDate() - days)
  return { start, end }
}
