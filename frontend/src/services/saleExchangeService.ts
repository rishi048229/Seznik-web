import { fetchApi } from './api'
import type { SaleExchange, CreateSaleExchangePayload, SaleReturn, Sale } from '@/types/sale.types'

export const getSaleExchanges = async (page = 1, limit = 50): Promise<{ data: SaleExchange[]; pagination: any }> => {
  return await fetchApi(`/sale-exchanges?page=${page}&limit=${limit}`)
}

export const getExchangesForSale = async (saleId: string): Promise<SaleExchange[]> => {
  return await fetchApi(`/sale-exchanges/sale/${saleId}`)
}

export const getSaleExchangeById = async (exchangeId: string): Promise<SaleExchange> => {
  return await fetchApi(`/sale-exchanges/${exchangeId}`)
}

export const createSaleExchange = async (
  saleId: string,
  payload: CreateSaleExchangePayload
): Promise<{
  success: boolean
  exchange: SaleExchange
  saleReturn: SaleReturn
  newSale: Sale
  originalSaleStatus: string
  differenceAmount: number
  settlementMethod: string
}> => {
  return await fetchApi(`/sale-exchanges/${saleId}`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}
