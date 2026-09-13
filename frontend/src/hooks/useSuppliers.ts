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

export const useSupplierById = (supplierId: string) => {
  const { user } = useAuth()
  return useQuery({
    queryKey: [QUERY_KEYS.SUPPLIERS, user?.uid, supplierId],
    queryFn: () => supplierService.getSupplierById(user!.uid, supplierId),
    enabled: !!user && !!supplierId,
  })
}

export const useSupplierLedger = (supplierId: string) => {
  const { user } = useAuth()
  return useQuery({
    queryKey: [QUERY_KEYS.SUPPLIERS, user?.uid, 'ledger', supplierId],
    queryFn: () => supplierService.getSupplierLedger(user!.uid, supplierId),
    enabled: !!user && !!supplierId,
  })
}

export const useSupplierReminders = () => {
  const { user } = useAuth()
  return useQuery({
    queryKey: [QUERY_KEYS.SUPPLIERS, user?.uid, 'reminders'],
    queryFn: () => supplierService.getSupplierReminders(user!.uid),
    enabled: !!user,
    refetchInterval: 60 * 1000,
  })
}

export const useRecordSupplierPayment = () => {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ supplierId, data }: { supplierId: string; data: { amount: number; paymentMethod: string; purchaseId?: string; notes?: string } }) =>
      supplierService.recordSupplierPayment(user!.uid, supplierId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEYS.SUPPLIERS] })
      qc.invalidateQueries({ queryKey: [QUERY_KEYS.PURCHASES] })
    },
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

