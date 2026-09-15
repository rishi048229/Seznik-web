import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { productsApi } from '@/api/products';
import { useAuthStore } from '@/store/useAuthStore';
import { writeCatalogCache } from '@/services/catalogCache';
import { productsQueryKey } from '@/services/prefetchAppData';
import { CreateProductPayload, Product, StockAdjustmentPayload } from '@/types/product';
import { useNotificationStore } from '@/store/useNotificationStore';

export function useProducts(options?: { includeLowStock?: boolean }) {
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const userId = user?.id;
  const includeLowStock = options?.includeLowStock !== false;

  const productsQuery = useQuery({
    queryKey: productsQueryKey(userId || ''),
    queryFn: async () => {
      const list = await productsApi.getCatalog();
      if (userId) {
        await writeCatalogCache(userId, list);
      }
      if (Array.isArray(list) && list.length > 0) {
        useNotificationStore.getState().evaluateStockConditions(list).catch(() => {});
      }
      return list;
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 5,
  });

  const lowStockQuery = useQuery({
    queryKey: ['products', 'low-stock', userId],
    queryFn: async () => {
      const lowStockList = await productsApi.getLowStockProducts();
      if (Array.isArray(lowStockList) && lowStockList.length > 0) {
        useNotificationStore.getState().evaluateStockConditions(lowStockList).catch(() => {});
      }
      return lowStockList;
    },
    enabled: !!userId && includeLowStock,
    staleTime: 1000 * 60 * 5,
  });

  const patchCatalogImage = (productId: string, imageUrl?: string | null) => {
    if (!userId || !imageUrl) return;
    queryClient.setQueryData(productsQueryKey(userId), (old: Product[] | undefined) =>
      old?.map((product) => (product.id === productId ? { ...product, imageUrl } : product))
    );
  };

  const createProductMutation = useMutation({
    mutationFn: (payload: CreateProductPayload) => productsApi.createProduct(payload),
    onSuccess: async (created) => {
      await queryClient.invalidateQueries({ queryKey: ['products'] });
      if (created.imageUrl) {
        patchCatalogImage(created.id, created.imageUrl);
      }
      queryClient.invalidateQueries({ queryKey: ['reports', 'dashboard'] });
    },
  });

  const updateProductMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<CreateProductPayload> }) =>
      productsApi.updateProduct(id, payload),
    onSuccess: async (_result, variables) => {
      await queryClient.invalidateQueries({ queryKey: ['products'] });
      if (variables.payload.imageUrl) {
        patchCatalogImage(variables.id, variables.payload.imageUrl);
      }
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
    getProductById: productsApi.getProductById,
  };
}
