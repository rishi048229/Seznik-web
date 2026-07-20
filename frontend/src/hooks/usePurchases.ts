import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/contexts/AuthContext'
import { QUERY_KEYS } from '@/constants/queryKeys'
import * as purchaseService from '@/services/purchaseService'

export const usePurchases = () => {
  const { user } = useAuth()
  return useQuery({
    queryKey: [QUERY_KEYS.PURCHASES, user?.uid],
    queryFn: () => purchaseService.getPurchases(user!.uid),
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  })
}

export const usePurchasesBySupplier = (supplierId: string) => {
  const { user } = useAuth()
  return useQuery({
    queryKey: [QUERY_KEYS.PURCHASES, user?.uid, supplierId],
    queryFn: () => purchaseService.getPurchasesBySupplier(user!.uid, supplierId),
    enabled: !!user && !!supplierId,
    staleTime: 5 * 60 * 1000,
  })
}

export const useCreatePurchase = () => {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Parameters<typeof purchaseService.createPurchase>[1]) =>
      purchaseService.createPurchase(user!.uid, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEYS.PURCHASES, QUERY_KEYS.PRODUCTS] })
    },
  })
}

export const useUpdatePurchase = () => {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ purchaseId, data }: { purchaseId: string; data: Record<string, unknown> }) =>
      purchaseService.updatePurchase(user!.uid, purchaseId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEYS.PURCHASES] })
    },
  })
}

export const useDeletePurchase = () => {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (purchaseId: string) => purchaseService.deletePurchase(user!.uid, purchaseId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEYS.PURCHASES, QUERY_KEYS.PRODUCTS] })
    },
  })
}
