import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/contexts/AuthContext'
import { QUERY_KEYS } from '@/constants/queryKeys'
import * as expenseService from '@/services/expenseService'

export const useExpenses = () => {
  const { user } = useAuth()
  return useQuery({
    queryKey: [QUERY_KEYS.EXPENSES, user?.uid],
    queryFn: () => expenseService.getExpenses(user!.uid),
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  })
}

export const useCreateExpense = () => {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Parameters<typeof expenseService.createExpense>[1]) =>
      expenseService.createExpense(user!.uid, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEYS.EXPENSES] })
    },
  })
}

export const useUpdateExpense = () => {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ expenseId, data }: { expenseId: string; data: Record<string, unknown> }) =>
      expenseService.updateExpense(user!.uid, expenseId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEYS.EXPENSES] })
    },
  })
}

export const useDeleteExpense = () => {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (expenseId: string) => expenseService.deleteExpense(user!.uid, expenseId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEYS.EXPENSES] })
    },
  })
}
