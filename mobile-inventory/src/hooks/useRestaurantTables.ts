import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { restaurantTablesApi } from '@/api/restaurantTables';
import { RestaurantTable } from '@/types/kot';

export function useRestaurantTables() {
  const queryClient = useQueryClient();

  const tablesQuery = useQuery({
    queryKey: ['restaurant-tables'],
    queryFn: restaurantTablesApi.getTables,
    staleTime: 1000 * 30, // 30s
  });

  const createMutation = useMutation({
    mutationFn: restaurantTablesApi.createTable,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['restaurant-tables'] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<RestaurantTable> }) =>
      restaurantTablesApi.updateTable(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['restaurant-tables'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: restaurantTablesApi.deleteTable,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['restaurant-tables'] });
    },
  });

  return {
    tables: tablesQuery.data || [],
    isLoading: tablesQuery.isLoading,
    isRefetching: tablesQuery.isRefetching,
    refetch: tablesQuery.refetch,
    createTable: createMutation.mutateAsync,
    updateTable: updateMutation.mutateAsync,
    deleteTable: deleteMutation.mutateAsync,
    isCreating: createMutation.isPending,
  };
}
