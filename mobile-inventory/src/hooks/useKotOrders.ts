import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { kotOrdersApi } from '@/api/kotOrders';
import { CreateKOTOrderPayload, GenerateKOTBillPayload, KOTOrderStatus, KOTPriority } from '@/types/kot';

function invalidateBillingSideEffects(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ['kot-orders'] });
  queryClient.invalidateQueries({ queryKey: ['sales'] });
  queryClient.invalidateQueries({ queryKey: ['products'] });
  queryClient.invalidateQueries({ queryKey: ['reports', 'dashboard'] });
  queryClient.invalidateQueries({ queryKey: ['restaurant-tables'] });
}

export function useKotOrders(statuses?: KOTOrderStatus[]) {
  const queryClient = useQueryClient();

  const statusParam = statuses?.join(',');

  const ordersQuery = useQuery({
    queryKey: ['kot-orders', statusParam || 'all'],
    queryFn: () => kotOrdersApi.getOrders({ status: statusParam }),
    staleTime: 1000 * 10, // 10s live updates
  });

  const createOrderMutation = useMutation({
    mutationFn: (payload: CreateKOTOrderPayload) => kotOrdersApi.createOrder(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kot-orders'] });
      queryClient.invalidateQueries({ queryKey: ['restaurant-tables'] });
    },
  });

  const addItemsMutation = useMutation({
    mutationFn: ({ id, items }: { id: string; items: CreateKOTOrderPayload['items'] }) =>
      kotOrdersApi.addItems(id, items),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['kot-orders'] });
      queryClient.invalidateQueries({ queryKey: ['kot-order', variables.id] });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: { status?: KOTOrderStatus; priority?: KOTPriority; notes?: string };
    }) => kotOrdersApi.updateStatus(id, payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['kot-orders'] });
      queryClient.invalidateQueries({ queryKey: ['kot-order', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['restaurant-tables'] });
    },
  });

  const generateBillMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: GenerateKOTBillPayload }) =>
      kotOrdersApi.generateBill(id, payload),
    onSuccess: () => {
      invalidateBillingSideEffects(queryClient);
    },
  });

  return {
    orders: ordersQuery.data || [],
    isLoading: ordersQuery.isLoading,
    isRefetching: ordersQuery.isRefetching,
    refetch: ordersQuery.refetch,
    createOrder: createOrderMutation.mutateAsync,
    addItems: addItemsMutation.mutateAsync,
    updateStatus: updateStatusMutation.mutateAsync,
    generateBill: generateBillMutation.mutateAsync,
    isCreating: createOrderMutation.isPending,
    isGeneratingBill: generateBillMutation.isPending,
  };
}

export function useKotOrder(id?: string) {
  const queryClient = useQueryClient();

  const orderQuery = useQuery({
    queryKey: ['kot-order', id],
    queryFn: () => kotOrdersApi.getOrderById(id as string),
    enabled: !!id,
  });

  return {
    order: orderQuery.data,
    isLoading: orderQuery.isLoading,
    refetch: orderQuery.refetch,
  };
}
