import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/contexts/AuthContext'
import { QUERY_KEYS } from '@/constants/queryKeys'
import * as utilityBillService from '@/services/utilityBillService'

export const useUtilityBills = (params?: { search?: string; billType?: string; page?: number; limit?: number }) => {
  const { user } = useAuth()
  return useQuery({
    queryKey: [QUERY_KEYS.UTILITY_BILLS, user?.uid, params?.search || '', params?.billType || '', params?.page || 1],
    queryFn: () => utilityBillService.getUtilityBills(params),
    enabled: !!user,
    staleTime: 0,
  })
}

export const useUtilityBillStats = () => {
  const { user } = useAuth()
  return useQuery({
    queryKey: [QUERY_KEYS.UTILITY_BILL_STATS, user?.uid],
    queryFn: utilityBillService.getUtilityBillStats,
    enabled: !!user,
    staleTime: 15_000,
  })
}

export const useExtractUtilityBill = () => {
  return useMutation({
    mutationFn: ({ imageBase64, mimeType }: { imageBase64: string; mimeType: string }) =>
      utilityBillService.extractUtilityBill(imageBase64, mimeType),
  })
}

export const useCreateUtilityBill = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: utilityBillService.createUtilityBill,
    onSuccess: async () => {
      await Promise.all([
        qc.refetchQueries({ queryKey: [QUERY_KEYS.UTILITY_BILLS] }),
        qc.refetchQueries({ queryKey: [QUERY_KEYS.UTILITY_BILL_STATS] }),
      ])
    },
  })
}

export const useDeleteUtilityBill = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => utilityBillService.deleteUtilityBill(id),
    onSuccess: async () => {
      await Promise.all([
        qc.refetchQueries({ queryKey: [QUERY_KEYS.UTILITY_BILLS] }),
        qc.refetchQueries({ queryKey: [QUERY_KEYS.UTILITY_BILL_STATS] }),
      ])
    },
  })
}
