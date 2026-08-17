import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { purchasesApi } from '@/api/purchases';
import { CreatePurchasePayload } from '@/types/purchase';

export function usePurchases() {
  const queryClient = useQueryClient();

  const purchasesQuery = useQuery({
    queryKey: ['purchases'],
    queryFn: purchasesApi.getPurchases,
  });

  const createPurchaseMutation = useMutation({
    mutationFn: (payload: CreatePurchasePayload) => purchasesApi.createPurchase(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchases'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });

  const deletePurchaseMutation = useMutation({
    mutationFn: (id: string) => purchasesApi.deletePurchase(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchases'] });
    },
  });

  return {
    purchases: purchasesQuery.data || [],
    isLoading: purchasesQuery.isLoading,
    refetch: purchasesQuery.refetch,
    createPurchase: createPurchaseMutation.mutateAsync,
    isCreating: createPurchaseMutation.isPending,
    deletePurchase: deletePurchaseMutation.mutateAsync,
  };
}
