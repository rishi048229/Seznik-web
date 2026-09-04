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

export function useKotOrders(
  statuses?: KOTOrderStatus[],
  options?: { enabled?: boolean }
) {
  const queryClient = useQueryClient();

  const statusParam = statuses?.join(',');
  const fetchEnabled = options?.enabled !== false;

  const ordersQuery = useQuery({
    queryKey: ['kot-orders', statusParam || 'all'],
    queryFn: () => kotOrdersApi.getOrders({ status: statusParam }),
    staleTime: 1000 * 10, // 10s live updates
    enabled: fetchEnabled,
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

  const editOrderMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: import('@/types/kot').EditKOTOrderPayload }) =>
      kotOrdersApi.editOrder(id, payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['kot-orders'] });
      queryClient.invalidateQueries({ queryKey: ['kot-order', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['restaurant-tables'] });
    },
  });

  return {
    orders: ordersQuery.data || [],
    isLoading: !ordersQuery.data && ordersQuery.isLoading,
    isRefetching: ordersQuery.isRefetching,
    isError: ordersQuery.isError && !ordersQuery.data,
    refetch: ordersQuery.refetch,
    createOrder: createOrderMutation.mutateAsync,
    addItems: addItemsMutation.mutateAsync,
    editOrder: editOrderMutation.mutateAsync,
    updateStatus: updateStatusMutation.mutateAsync,
    generateBill: generateBillMutation.mutateAsync,
    isCreating: createOrderMutation.isPending,
    isEditing: editOrderMutation.isPending,
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
    isLoading: !orderQuery.data && orderQuery.isLoading,
    isRefetching: orderQuery.isRefetching,
    isError: orderQuery.isError && !orderQuery.data,
    refetch: orderQuery.refetch,
  };
}
