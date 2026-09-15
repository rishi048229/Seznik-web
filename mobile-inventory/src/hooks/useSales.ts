import { useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { salesApi } from '@/api/sales';
import { refreshApiBaseUrl } from '@/api/client';
import { CreateSalePayload, Sale } from '@/types/sale';
import { useNotificationStore } from '@/store/useNotificationStore';

export function useSales() {
  const queryClient = useQueryClient();

  const salesQuery = useQuery({
    queryKey: ['sales'],
    queryFn: salesApi.getSales,
  });

  const createSaleMutation = useMutation({
    mutationFn: (payload: CreateSalePayload) => salesApi.createSale(payload),
    onSuccess: (createdSale, variables) => {
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['reports', 'dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['reports', 'trend'] });
      queryClient.invalidateQueries({ queryKey: ['daybook'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['customerLedger'] });
      queryClient.invalidateQueries({ queryKey: ['remindersDue'] });

      // Trigger credit reminder if sale was made on credit
      if (variables?.paymentMethod === 'credit' && variables.customerId) {
        useNotificationStore.getState().triggerCreditReminder({
          id: variables.customerId,
          name: createdSale?.customerName || 'Customer',
          amountDue: createdSale?.grandTotal || variables.grandTotal || 0,
        }).catch(() => {});
      }
    },
  });

  const deleteSaleMutation = useMutation({
    mutationFn: (id: string) => salesApi.deleteSale(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['reports', 'dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['reports', 'trend'] });
      queryClient.invalidateQueries({ queryKey: ['daybook'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['customerLedger'] });
      queryClient.invalidateQueries({ queryKey: ['remindersDue'] });
    },
  });

  /** Saves in the background so checkout can print immediately without waiting on the network. */
  const persistSaleInBackground = useCallback(
    (
      payload: CreateSalePayload,
      handlers?: {
        onSuccess?: (sale: Sale) => void;
        onError?: (err: Error) => void;
      }
    ) => {
      refreshApiBaseUrl();
      createSaleMutation.mutate(payload, {
        onSuccess: (sale) => handlers?.onSuccess?.(sale),
        onError: (err) =>
          handlers?.onError?.(err instanceof Error ? err : new Error(String((err as any)?.message || err))),
      });
    },
    [createSaleMutation]
  );

  return {
    sales: salesQuery.data || [],
    isLoading: !salesQuery.data && salesQuery.isLoading,
    isRefetching: salesQuery.isRefetching,
    isError: salesQuery.isError && !salesQuery.data,
    refetch: salesQuery.refetch,
    createSale: createSaleMutation.mutateAsync,
    persistSaleInBackground,
    isCreating: createSaleMutation.isPending,
    deleteSale: deleteSaleMutation.mutateAsync,
    isDeleting: deleteSaleMutation.isPending,
  };
}
