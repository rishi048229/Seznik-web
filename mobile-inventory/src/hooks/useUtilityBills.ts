import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { utilityBillsApi } from '@/api/utilityBills';
import { CreateUtilityBillPayload } from '@/types/utilityBill';

export function useUtilityBills(filters?: { search?: string; billType?: string }) {
  const queryClient = useQueryClient();

  const billsQuery = useQuery({
    queryKey: ['utilityBills', filters?.search, filters?.billType],
    queryFn: () => utilityBillsApi.getBills(filters),
  });

  const statsQuery = useQuery({
    queryKey: ['utilityBillStats'],
    queryFn: () => utilityBillsApi.getStats(),
  });

  const createBillMutation = useMutation({
    mutationFn: (payload: CreateUtilityBillPayload) => utilityBillsApi.createBill(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['utilityBills'] });
      queryClient.invalidateQueries({ queryKey: ['utilityBillStats'] });
    },
  });

  const deleteBillMutation = useMutation({
    mutationFn: (id: string) => utilityBillsApi.deleteBill(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['utilityBills'] });
      queryClient.invalidateQueries({ queryKey: ['utilityBillStats'] });
    },
  });

  const extractBillMutation = useMutation({
    mutationFn: ({ imageBase64, mimeType }: { imageBase64: string; mimeType?: string }) =>
      utilityBillsApi.extractBill(imageBase64, mimeType),
  });

  return {
    bills: billsQuery.data?.bills || [],
    totalCount: billsQuery.data?.total || 0,
    isLoadingBills: billsQuery.isLoading,
    isRefetchingBills: billsQuery.isRefetching,
    refetchBills: billsQuery.refetch,

    stats: statsQuery.data,
    isLoadingStats: statsQuery.isLoading,
    refetchStats: statsQuery.refetch,

    createBill: createBillMutation.mutateAsync,
    isCreating: createBillMutation.isPending,

    deleteBill: deleteBillMutation.mutateAsync,
    isDeleting: deleteBillMutation.isPending,

    extractBill: extractBillMutation.mutateAsync,
    isExtracting: extractBillMutation.isPending,
  };
}
