import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/contexts/AuthContext'
import { QUERY_KEYS } from '@/constants/queryKeys'
import * as saleService from '@/services/saleService'

const accountId = (user: { id?: string; uid?: string } | null | undefined) =>
  user?.id || user?.uid || ''

export const useSales = (opts?: { refetchInterval?: number | false }) => {
  const { user } = useAuth()
  const userId = accountId(user)
  return useQuery({
    queryKey: [QUERY_KEYS.SALES, userId],
    queryFn: () => saleService.getSales(userId),
    enabled: !!userId,
    staleTime: opts?.refetchInterval ? 0 : 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: Boolean(opts?.refetchInterval),
    refetchInterval: opts?.refetchInterval,
  })
}

export const useSaleById = (saleId: string) => {
  const { user } = useAuth()
  const userId = accountId(user)
  return useQuery({
    queryKey: [QUERY_KEYS.SALES, userId, saleId],
    queryFn: () => saleService.getSaleById(userId, saleId),
    enabled: !!userId && !!saleId,
  })
}

export const useCreateSale = () => {
  const { user } = useAuth()
  const userId = accountId(user)
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Parameters<typeof saleService.createSale>[1]) =>
      saleService.createSale(userId, data),
    onSuccess: () => {
      void Promise.all([
        qc.invalidateQueries({ queryKey: [QUERY_KEYS.SALES] }),
        qc.invalidateQueries({ queryKey: [QUERY_KEYS.PRODUCTS] }),
        qc.invalidateQueries({ queryKey: [QUERY_KEYS.CUSTOMERS] }),
        qc.invalidateQueries({ queryKey: [QUERY_KEYS.CREDITS] }),
        qc.invalidateQueries({ queryKey: ['credit-transactions'] }),
      ])
    },
    onError: (error) => {
      const msg = error instanceof Error ? error.message : 'Unknown error'
      console.error('createSale error:', msg)
      throw error
    },
  })
}

export const useDeleteSale = () => {
  const { user } = useAuth()
  const userId = accountId(user)
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (saleId: string) => saleService.deleteSale(userId, saleId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEYS.SALES] })
    },
  })
}

export const useBulkDeleteSales = () => {
  const { user } = useAuth()
  const userId = accountId(user)
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (saleIds: string[]) => saleService.bulkDeleteSales(userId, saleIds),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEYS.SALES] })
    },
  })
}
