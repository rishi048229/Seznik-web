import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { expensesApi } from '@/api/expenses';
import { CreateExpensePayload } from '@/types/expense';

export function useExpenses() {
  const queryClient = useQueryClient();

  const expensesQuery = useQuery({
    queryKey: ['expenses'],
    queryFn: expensesApi.getExpenses,
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['expenses'] });
    queryClient.invalidateQueries({ queryKey: ['reports'] });
    queryClient.invalidateQueries({ queryKey: ['reports', 'dashboard'] });
    queryClient.invalidateQueries({ queryKey: ['reports', 'expenseSummary'] });
  };

  const createExpenseMutation = useMutation({
    mutationFn: (payload: CreateExpensePayload) => expensesApi.createExpense(payload),
    onSuccess: invalidateAll,
  });

  const updateExpenseMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<CreateExpensePayload> }) =>
      expensesApi.updateExpense(id, payload),
    onSuccess: invalidateAll,
  });

  const deleteExpenseMutation = useMutation({
    mutationFn: (id: string) => expensesApi.deleteExpense(id),
    onSuccess: invalidateAll,
  });

  return {
    expenses: expensesQuery.data || [],
    isLoading: expensesQuery.isLoading,
    refetch: expensesQuery.refetch,
    createExpense: createExpenseMutation.mutateAsync,
    isCreating: createExpenseMutation.isPending,
    updateExpense: updateExpenseMutation.mutateAsync,
    isUpdating: updateExpenseMutation.isPending,
    deleteExpense: deleteExpenseMutation.mutateAsync,
  };
}
