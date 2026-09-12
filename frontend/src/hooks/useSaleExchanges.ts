import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { QUERY_KEYS } from '@/constants/queryKeys'
import * as saleExchangeService from '@/services/saleExchangeService'
import type { CreateSaleExchangePayload } from '@/types/sale.types'

export const useSaleExchanges = (page = 1, limit = 50) => {
  return useQuery({
    queryKey: ['sale-exchanges', page, limit],
    queryFn: () => saleExchangeService.getSaleExchanges(page, limit),
  })
}

export const useExchangesForSale = (saleId: string) => {
  return useQuery({
    queryKey: ['sale-exchanges', 'sale', saleId],
    queryFn: () => saleExchangeService.getExchangesForSale(saleId),
    enabled: !!saleId,
  })
}

export const useCreateSaleExchange = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ saleId, payload }: { saleId: string; payload: CreateSaleExchangePayload }) =>
      saleExchangeService.createSaleExchange(saleId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEYS.SALES] })
      qc.invalidateQueries({ queryKey: ['sale-returns'] })
      qc.invalidateQueries({ queryKey: ['sale-exchanges'] })
      qc.invalidateQueries({ queryKey: [QUERY_KEYS.PRODUCTS] })
      qc.invalidateQueries({ queryKey: [QUERY_KEYS.CUSTOMERS] })
      qc.invalidateQueries({ queryKey: [QUERY_KEYS.CREDITS] })
    },
  })
}
