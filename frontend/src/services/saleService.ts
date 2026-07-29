import { fetchApi } from './api'
import type { Sale } from '@/types/sale.types'

export const getSales = async (_uid: string): Promise<Sale[]> => {
  return await fetchApi('/sales')
}

export const getSaleById = async (_uid: string, saleId: string): Promise<Sale | null> => {
  try {
    return await fetchApi(`/sales/${saleId}`)
  } catch {
    return null
  }
}

export const createSale = async (
  _uid: string,
  saleData: Omit<Sale, 'id' | 'invoiceNumber' | 'createdAt'>
): Promise<{ id: string; invoiceNumber: string }> => {
  const sale = await fetchApi('/sales', {
    method: 'POST',
    body: JSON.stringify(saleData),
  })
  return { id: sale.id, invoiceNumber: sale.invoiceNumber }
}

export const getSalesByDateRange = async (_uid: string, start: string | Date, end: string | Date): Promise<Sale[]> => {
  const startStr = typeof start === 'string' ? start : start.toISOString()
  const endStr = typeof end === 'string' ? end : end.toISOString()
  
  return await fetchApi(`/sales/range?start=${encodeURIComponent(startStr)}&end=${encodeURIComponent(endStr)}`)
}

export const deleteSale = async (_uid: string, saleId: string): Promise<void> => {
  await fetchApi(`/sales/${saleId}`, {
    method: 'DELETE',
  })
}

export const bulkDeleteSales = async (_uid: string, saleIds: string[]): Promise<void> => {
  await fetchApi('/sales/bulk-delete', {
    method: 'POST',
    body: JSON.stringify({ saleIds }),
  })
}

