import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { locationsApi } from '@/api/locations';

// Multi-location inventory (opt-in — see useSettings().settings?.locationConfig?.enabled).
// Mirrors the web app's useLocations.ts hook-for-hook.

export function useLocations() {
  const queryClient = useQueryClient();

  const locationsQuery = useQuery({
    queryKey: ['locations'],
    queryFn: locationsApi.getLocations,
    staleTime: 1000 * 60 * 5,
  });

  const invalidateLocations = () => {
    queryClient.invalidateQueries({ queryKey: ['locations'] });
    queryClient.invalidateQueries({ queryKey: ['locationStock'] });
  };

  const createLocationMutation = useMutation({
    mutationFn: ({ name, sortOrder, seedFromCurrentStock }: { name: string; sortOrder?: number; seedFromCurrentStock?: boolean }) =>
      locationsApi.createLocation(name, sortOrder, seedFromCurrentStock),
    onSuccess: invalidateLocations,
  });

  const updateLocationMutation = useMutation({
    mutationFn: ({ locationId, name, sortOrder }: { locationId: string; name: string; sortOrder?: number }) =>
      locationsApi.updateLocation(locationId, name, sortOrder),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['locations'] }),
  });

  const toggleLocationActiveMutation = useMutation({
    mutationFn: ({ locationId, isActive }: { locationId: string; isActive: boolean }) =>
      locationsApi.toggleLocationActive(locationId, isActive),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['locations'] }),
  });

  const deleteLocationMutation = useMutation({
    mutationFn: (locationId: string) => locationsApi.deleteLocation(locationId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['locations'] }),
  });

  return {
    locations: locationsQuery.data || [],
    isLoading: !locationsQuery.data && locationsQuery.isLoading,
    isRefetching: locationsQuery.isRefetching,
    isError: locationsQuery.isError && !locationsQuery.data,
    refetch: locationsQuery.refetch,
    createLocation: createLocationMutation.mutateAsync,
    isCreating: createLocationMutation.isPending,
    updateLocation: updateLocationMutation.mutateAsync,
    toggleLocationActive: toggleLocationActiveMutation.mutateAsync,
    deleteLocation: deleteLocationMutation.mutateAsync,
  };
}

export function useLocationStock(locationId: string | null) {
  const query = useQuery({
    queryKey: ['locationStock', locationId],
    queryFn: () => locationsApi.getLocationStock(locationId as string),
    enabled: !!locationId,
    staleTime: 1000 * 60,
  });

  return {
    locationStock: query.data || [],
    isLoading: !query.data && query.isLoading,
    isRefetching: query.isRefetching,
    isError: query.isError && !query.data,
    refetch: query.refetch,
  };
}

/** One product's stock/price across every location — for the product edit form's "Stock by Location". */
export function useProductLocationStock(productId: string | null) {
  const query = useQuery({
    queryKey: ['locationStock', 'product', productId],
    queryFn: () => locationsApi.getProductLocationStock(productId as string),
    enabled: !!productId,
    staleTime: 1000 * 30,
  });

  return {
    productLocationStock: query.data || [],
    isLoading: !query.data && query.isLoading,
    refetch: query.refetch,
  };
}

export function useUpsertProductLocationStock() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: ({
      productId,
      locationId,
      data,
    }: {
      productId: string;
      locationId: string;
      data: { stock?: number; priceOverride?: number | null; lowStockThreshold?: number | null };
    }) => locationsApi.upsertProductLocationStock(productId, locationId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['locationStock'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });

  return {
    upsertStock: mutation.mutateAsync,
    isUpserting: mutation.isPending,
  };
}

export function useCreateStockTransfer() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: locationsApi.createStockTransfer,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['locationStock'] });
      queryClient.invalidateQueries({ queryKey: ['stockTransfers'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });

  return {
    createTransfer: mutation.mutateAsync,
    isTransferring: mutation.isPending,
  };
}

export function useStockTransfers() {
  const query = useQuery({
    queryKey: ['stockTransfers'],
    queryFn: locationsApi.getStockTransfers,
    staleTime: 1000 * 30,
  });

  return {
    transfers: query.data || [],
    isLoading: !query.data && query.isLoading,
    isRefetching: query.isRefetching,
    isError: query.isError && !query.data,
    refetch: query.refetch,
  };
}
