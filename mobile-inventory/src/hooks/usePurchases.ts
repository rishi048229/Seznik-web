import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { purchasesApi } from '@/api/purchases';
import { CreatePurchasePayload } from '@/types/purchase';

export function usePurchases() {
  const queryClient = useQueryClient();

  // Previously this queryFn caught its own errors and returned hardcoded SAMPLE_PURCHASES on ANY
  // failure — React Query never saw it as an error (isError stayed permanently false), so a real
  // backend outage silently rendered fabricated purchase history with no way to tell it was fake.
  // It also replaced a genuine empty result (a store with zero purchases yet — a normal, valid
  // state) with the same fake data. Letting the query actually fail/return real data lets it
  // surface through the same error-state pattern as everywhere else.
  const purchasesQuery = useQuery({
    queryKey: ['purchases'],
    queryFn: () => purchasesApi.getPurchases(),
    staleTime: 1000 * 60 * 5,
  });

  const createPurchaseMutation = useMutation({
    mutationFn: (payload: CreatePurchasePayload) => purchasesApi.createPurchase(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchases'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      queryClient.invalidateQueries({ queryKey: ['daybook'] });
      queryClient.invalidateQueries({ queryKey: ['reports', 'dashboard'] });
    },
  });

  const deletePurchaseMutation = useMutation({
    mutationFn: (id: string) => purchasesApi.deletePurchase(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchases'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['reports', 'dashboard'] });
    },
  });

  return {
    purchases: purchasesQuery.data || [],
    isLoading: !purchasesQuery.data && purchasesQuery.isLoading,
    isRefetching: purchasesQuery.isRefetching,
    isError: purchasesQuery.isError && !purchasesQuery.data,
    refetch: purchasesQuery.refetch,
    createPurchase: createPurchaseMutation.mutateAsync,
    isCreating: createPurchaseMutation.isPending,
    deletePurchase: deletePurchaseMutation.mutateAsync,
    isDeleting: deletePurchaseMutation.isPending,
  };
}
