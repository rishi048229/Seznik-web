import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { productsApi } from '@/api/products';
import { useAuthStore } from '@/store/useAuthStore';
import { CreateProductPayload, Product, StockAdjustmentPayload } from '@/types/product';

export function useProducts() {
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const userId = user?.id || 'guest';

  const productsQuery = useQuery({
    queryKey: ['products', userId],
    queryFn: () => productsApi.getProducts(),
    staleTime: 1000 * 30,
    // Was retry:2, stacked on top of getProducts()'s own timeoutMs:120000 below — up to ~6
    // minutes of spinner on a real failure. Falls back to the app-wide default (retry:1).
  });

  const lowStockQuery = useQuery({
    queryKey: ['products', 'low-stock', userId],
    queryFn: () => productsApi.getLowStockProducts(),
    staleTime: 1000 * 30,
    // Explicit retry:1 here was redundant with the app-wide default anyway — dropped for consistency.
  });

  const createProductMutation = useMutation({
    mutationFn: (payload: CreateProductPayload) => productsApi.createProduct(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['reports', 'dashboard'] });
    },
  });

  const updateProductMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<CreateProductPayload> }) =>
      productsApi.updateProduct(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['reports', 'dashboard'] });
    },
  });

  const deleteProductMutation = useMutation({
    mutationFn: (id: string) => productsApi.deleteProduct(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['reports', 'dashboard'] });
    },
  });

  const adjustStockMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: StockAdjustmentPayload }) =>
      productsApi.adjustStock(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['reports', 'dashboard'] });
    },
  });

  const bulkCreateMutation = useMutation({
    mutationFn: (products: any[]) => productsApi.bulkCreateProducts(products),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      queryClient.invalidateQueries({ queryKey: ['reports', 'dashboard'] });
    },
  });

  return {
    products: productsQuery.data || [],
    isLoading: productsQuery.isLoading,
    isInitialLoading: !productsQuery.data && productsQuery.isLoading,
    isRefetching: productsQuery.isRefetching,
    isError: productsQuery.isError,
    error: productsQuery.error,
    refetch: productsQuery.refetch,
    lowStockProducts: lowStockQuery.data || [],
    createProduct: createProductMutation.mutateAsync,
    isCreating: createProductMutation.isPending,
    updateProduct: updateProductMutation.mutateAsync,
    isUpdating: updateProductMutation.isPending,
    deleteProduct: deleteProductMutation.mutateAsync,
    isDeleting: deleteProductMutation.isPending,
    adjustStock: adjustStockMutation.mutateAsync,
    isAdjustingStock: adjustStockMutation.isPending,
    aiExtractProducts: productsApi.aiExtractProducts,
    aiConvertInvoice: productsApi.aiConvertInvoice,
    bulkCreateProducts: bulkCreateMutation.mutateAsync,
    isBulkCreating: bulkCreateMutation.isPending,
    getByBarcode: productsApi.getProductByBarcode,
  };
}
