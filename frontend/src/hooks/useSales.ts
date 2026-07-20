import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/contexts/AuthContext'
import { QUERY_KEYS } from '@/constants/queryKeys'
import * as saleService from '@/services/saleService'

export const useSales = () => {
  const { user } = useAuth()
  return useQuery({
    queryKey: [QUERY_KEYS.SALES, user?.uid],
    queryFn: () => saleService.getSales(user!.uid),
    enabled: !!user,
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  })
}

export const useSaleById = (saleId: string) => {
  const { user } = useAuth()
  return useQuery({
    queryKey: [QUERY_KEYS.SALES, user?.uid, saleId],
    queryFn: () => saleService.getSaleById(user!.uid, saleId),
    enabled: !!user && !!saleId,
  })
}

export const useCreateSale = () => {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Parameters<typeof saleService.createSale>[1]) =>
      saleService.createSale(user!.uid, data),
    onSuccess: async () => {
      await Promise.all([
        qc.refetchQueries({ queryKey: [QUERY_KEYS.SALES] }),
        qc.refetchQueries({ queryKey: [QUERY_KEYS.PRODUCTS] }),
      ])
    },
    onError: (error) => {
      console.error('createSale error:', error)
      const msg = error instanceof Error ? error.message : 'Unknown error'
      throw error // Re-throw so the caller can handle it
    },
  })
}

export const useDeleteSale = () => {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (saleId: string) => saleService.deleteSale(user!.uid, saleId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEYS.SALES] })
    },
  })
}

export const useBulkDeleteSales = () => {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (saleIds: string[]) => saleService.bulkDeleteSales(user!.uid, saleIds),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEYS.SALES] })
    },
  })
}
