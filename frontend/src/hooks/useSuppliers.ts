import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/contexts/AuthContext'
import { QUERY_KEYS } from '@/constants/queryKeys'
import * as supplierService from '@/services/supplierService'

export const useSuppliers = () => {
  const { user } = useAuth()
  return useQuery({
    queryKey: [QUERY_KEYS.SUPPLIERS, user?.uid],
    queryFn: () => supplierService.getSuppliers(user!.uid),
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  })
}

export const useCreateSupplier = () => {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { name: string; phone: string; email?: string; address?: string; gstin?: string }) =>
      supplierService.createSupplier(user!.uid, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEYS.SUPPLIERS] })
    },
  })
}

export const useUpdateSupplier = () => {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ supplierId, data }: { supplierId: string; data: Record<string, unknown> }) =>
      supplierService.updateSupplier(user!.uid, supplierId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEYS.SUPPLIERS] })
    },
  })
}

export const useDeleteSupplier = () => {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (supplierId: string) => supplierService.deleteSupplier(user!.uid, supplierId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEYS.SUPPLIERS] })
    },
  })
}
