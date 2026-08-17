import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { salesApi } from '@/api/sales';
import { CreateSalePayload } from '@/types/sale';

export function useSales() {
  const queryClient = useQueryClient();

  const salesQuery = useQuery({
    queryKey: ['sales'],
    queryFn: salesApi.getSales,
  });

  const createSaleMutation = useMutation({
    mutationFn: (payload: CreateSalePayload) => salesApi.createSale(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['reports', 'dashboard'] });
      // A sale can create/grow a customer's credit (paymentMethod: 'credit') and always affects
      // today's cashflow — without these, a fresh credit bill wouldn't show up on the Daybook or
      // that customer's account page until something else happened to trigger a refetch.
      queryClient.invalidateQueries({ queryKey: ['daybook'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['customerLedger'] });
      queryClient.invalidateQueries({ queryKey: ['remindersDue'] });
    },
  });

  const deleteSaleMutation = useMutation({
    mutationFn: (id: string) => salesApi.deleteSale(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['reports', 'dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['daybook'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['customerLedger'] });
      queryClient.invalidateQueries({ queryKey: ['remindersDue'] });
    },
  });

  return {
    sales: salesQuery.data || [],
    isLoading: salesQuery.isLoading,
    isRefetching: salesQuery.isRefetching,
    refetch: salesQuery.refetch,
    createSale: createSaleMutation.mutateAsync,
    isCreating: createSaleMutation.isPending,
    deleteSale: deleteSaleMutation.mutateAsync,
    isDeleting: deleteSaleMutation.isPending,
  };
}
