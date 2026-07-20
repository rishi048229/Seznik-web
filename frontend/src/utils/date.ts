import { format, startOfDay as fnsStartOfDay, endOfDay } from 'date-fns'

export const formatDate = (date: Date | number | string, pattern = 'dd MMM yyyy'): string => {
  return format(new Date(date), pattern)
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
