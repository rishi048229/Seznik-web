import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/contexts/AuthContext'
import { QUERY_KEYS } from '@/constants/queryKeys'
import * as customerService from '@/services/customerService'

export const useCustomers = () => {
  const { user } = useAuth()
  return useQuery({
    queryKey: [QUERY_KEYS.CUSTOMERS, user?.uid],
    queryFn: () => customerService.getCustomers(user!.uid),
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  })
}

export const useCreateCustomer = () => {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { name: string; phone: string; email?: string; address?: string; creditBalance?: number; creditLimit?: number }) =>
      customerService.createCustomer(user!.uid, { creditBalance: 0, creditLimit: 0, ...data }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEYS.CUSTOMERS] })
    },
  })
}

export const useUpdateCustomer = () => {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ customerId, data }: { customerId: string; data: Record<string, unknown> }) =>
      customerService.updateCustomer(user!.uid, customerId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEYS.CUSTOMERS] })
    },
  })
}

export const useCreditTransactions = () => {
  const { user } = useAuth()
  return useQuery({
    queryKey: [QUERY_KEYS.CREDITS, user?.uid],
    queryFn: () => customerService.getCreditTransactions(user!.uid),
    enabled: !!user,
  })
}

export const useRecordPayment = () => {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ customerId, amount }: { customerId: string; amount: number; notes?: string }) =>
      customerService.recordPayment(user!.uid, { customerId, amount }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEYS.CUSTOMERS, QUERY_KEYS.CREDITS] })
    },
  })
}

export const useDeleteCustomer = () => {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (customerId: string) => customerService.deleteCustomer(user!.uid, customerId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEYS.CUSTOMERS] })
    },
  })
}
