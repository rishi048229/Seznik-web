import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { productsApi } from '@/api/products';
import { CreateProductPayload, Product, StockAdjustmentPayload } from '@/types/product';

const SAMPLE_PRODUCTS: Product[] = [
  {
    id: 'prod-1',
    name: 'Organic Basmati Rice 5kg',
    sellingPrice: 480,
    costPrice: 380,
    currentStock: 45,
    lowStockThreshold: 10,
    unit: 'kg',
    barcode: '8901234567890',
    taxRate: 5,
    priceIncludesGst: true,
    isActive: true,
  },
  {
    id: 'prod-2',
    name: 'Fresh Cow Milk 1L',
    sellingPrice: 66,
    costPrice: 54,
    currentStock: 80,
    lowStockThreshold: 15,
    unit: 'pkt',
    barcode: '8901234567891',
    taxRate: 0,
    priceIncludesGst: true,
    isActive: true,
  },
  {
    id: 'prod-3',
    name: 'Premium Filter Coffee 250g',
    sellingPrice: 210,
    costPrice: 160,
    currentStock: 24,
    lowStockThreshold: 5,
    unit: 'pcs',
    barcode: '8901234567892',
    taxRate: 18,
    priceIncludesGst: true,
    isActive: true,
  },
  {
    id: 'prod-4',
    name: 'Sunflower Cooking Oil 1L',
    sellingPrice: 175,
    costPrice: 140,
    currentStock: 30,
    lowStockThreshold: 8,
    unit: 'bot',
    barcode: '8901234567893',
    taxRate: 5,
    priceIncludesGst: true,
    isActive: true,
  },
  {
    id: 'prod-5',
    name: 'Whole Wheat Atta 10kg',
    sellingPrice: 420,
    costPrice: 350,
    currentStock: 18,
    lowStockThreshold: 5,
    unit: 'kg',
    barcode: '8901234567894',
    taxRate: 0,
    priceIncludesGst: true,
    isActive: true,
  },
  {
    id: 'prod-6',
    name: 'Dark Chocolate Biscuit 150g',
    sellingPrice: 45,
    costPrice: 32,
    currentStock: 60,
    lowStockThreshold: 10,
    unit: 'pcs',
    barcode: '8901234567895',
    taxRate: 18,
    priceIncludesGst: true,
    isActive: true,
  },
];

export function useProducts() {
  const queryClient = useQueryClient();

  const productsQuery = useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      try {
        const data = await productsApi.getProducts();
        if (Array.isArray(data)) {
          return data;
        }
        return SAMPLE_PRODUCTS;
      } catch (err) {
        console.warn('Failed to fetch backend products, using offline fallback:', err);
        return SAMPLE_PRODUCTS;
      }
    },
  });

  const lowStockQuery = useQuery({
    queryKey: ['products', 'low-stock'],
    queryFn: async () => {
      try {
        return await productsApi.getLowStockProducts();
      } catch {
        return SAMPLE_PRODUCTS.filter((p) => p.currentStock <= p.lowStockThreshold);
      }
    },
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
    products: productsQuery.data || SAMPLE_PRODUCTS,
    isLoading: productsQuery.isLoading,
    isRefetching: productsQuery.isRefetching,
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


