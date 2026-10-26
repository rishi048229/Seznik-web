import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/contexts/AuthContext'
import { QUERY_KEYS } from '@/constants/queryKeys'
import * as purchaseService from '@/services/purchaseService'

const accountId = (user: { id?: string; uid?: string } | null | undefined) =>
  user?.id || user?.uid || ''

export const usePurchases = (opts?: { refetchInterval?: number | false }) => {
  const { user } = useAuth()
  const userId = accountId(user)
  return useQuery({
    queryKey: [QUERY_KEYS.PURCHASES, userId],
    queryFn: () => purchaseService.getPurchases(userId),
    enabled: !!userId,
    staleTime: opts?.refetchInterval ? 0 : 5 * 60 * 1000,
    refetchOnWindowFocus: Boolean(opts?.refetchInterval),
    refetchInterval: opts?.refetchInterval,
  })
}

export const usePurchasesBySupplier = (supplierId: string) => {
  const { user } = useAuth()
  const userId = accountId(user)
  return useQuery({
    queryKey: [QUERY_KEYS.PURCHASES, userId, supplierId],
    queryFn: () => purchaseService.getPurchasesBySupplier(userId, supplierId),
    enabled: !!userId && !!supplierId,
    staleTime: 5 * 60 * 1000,
  })
}

export const useCreatePurchase = () => {
  const { user } = useAuth()
  const userId = accountId(user)
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Parameters<typeof purchaseService.createPurchase>[1]) =>
      purchaseService.createPurchase(userId, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [QUERY_KEYS.PURCHASES] })
      void qc.invalidateQueries({ queryKey: [QUERY_KEYS.PRODUCTS] })
    },
  })
}

export const useUpdatePurchase = () => {
  const { user } = useAuth()
  const userId = accountId(user)
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ purchaseId, data }: { purchaseId: string; data: Record<string, unknown> }) =>
      purchaseService.updatePurchase(userId, purchaseId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEYS.PURCHASES] })
    },
  })
}

export const useDeletePurchase = () => {
  const { user } = useAuth()
  const userId = accountId(user)
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (purchaseId: string) => purchaseService.deletePurchase(userId, purchaseId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [QUERY_KEYS.PURCHASES] })
      void qc.invalidateQueries({ queryKey: [QUERY_KEYS.PRODUCTS] })
    },
  })
}
