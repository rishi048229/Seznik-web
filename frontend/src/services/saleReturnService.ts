import { fetchApi } from './api'
import type { SaleReturn, CreateSaleReturnPayload } from '@/types/sale.types'

export const getSaleReturns = async (page = 1, limit = 50): Promise<{ returns: SaleReturn[]; pagination: any }> => {
  return await fetchApi(`/sale-returns?page=${page}&limit=${limit}`)
}

export const getReturnsForSale = async (saleId: string): Promise<SaleReturn[]> => {
  return await fetchApi(`/sale-returns/sale/${saleId}`)
}

export const getSaleReturnById = async (returnId: string): Promise<SaleReturn> => {
  return await fetchApi(`/sale-returns/${returnId}`)
}

export const createSaleReturn = async (
  saleId: string,
  payload: CreateSaleReturnPayload
): Promise<{ success: boolean; saleReturn: SaleReturn; saleStatus: string; totalRefunded: number }> => {
  return await fetchApi(`/sale-returns/${saleId}`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}
