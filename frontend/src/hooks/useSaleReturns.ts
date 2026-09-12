import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { QUERY_KEYS } from '@/constants/queryKeys'
import * as saleReturnService from '@/services/saleReturnService'
import type { CreateSaleReturnPayload } from '@/types/sale.types'

export const useSaleReturns = (page = 1, limit = 50) => {
  return useQuery({
    queryKey: ['sale-returns', page, limit],
    queryFn: () => saleReturnService.getSaleReturns(page, limit),
  })
}

export const useReturnsForSale = (saleId: string) => {
  return useQuery({
    queryKey: ['sale-returns', 'sale', saleId],
    queryFn: () => saleReturnService.getReturnsForSale(saleId),
    enabled: !!saleId,
  })
}

export const useCreateSaleReturn = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ saleId, payload }: { saleId: string; payload: CreateSaleReturnPayload }) =>
      saleReturnService.createSaleReturn(saleId, payload),
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: [QUERY_KEYS.SALES] })
      qc.invalidateQueries({ queryKey: ['sale-returns'] })
      qc.invalidateQueries({ queryKey: [QUERY_KEYS.PRODUCTS] })
      qc.invalidateQueries({ queryKey: [QUERY_KEYS.CUSTOMERS] })
      qc.invalidateQueries({ queryKey: [QUERY_KEYS.CREDITS] })
    },
  })
}
