import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { purchasesApi } from '@/api/purchases';
import { CreatePurchasePayload, Purchase } from '@/types/purchase';

const SAMPLE_PURCHASES: Purchase[] = [
  {
    id: 'pur-1',
    invoiceNumber: 'PUR-2026-001',
    supplierId: 'sup-1',
    supplierName: 'Metro Cash & Carry',
    supplier: { id: 'sup-1', name: 'Metro Cash & Carry' },
    subtotal: 12500,
    totalTax: 625,
    totalDiscount: 0,
    grandTotal: 13125,
    paymentMethod: 'bank_transfer',
    amountPaid: 13125,
    items: [
      { productId: 'prod-1', productName: 'Organic Basmati Rice 5kg', quantity: 25, costPrice: 380, total: 9500 },
      { productId: 'prod-4', productName: 'Sunflower Cooking Oil 1L', quantity: 20, costPrice: 150, total: 3000 },
    ],
    createdAt: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: 'pur-2',
    invoiceNumber: 'PUR-2026-002',
    supplierId: 'sup-2',
    supplierName: 'Amul Dairy Distributors',
    supplier: { id: 'sup-2', name: 'Amul Dairy Distributors' },
    subtotal: 4800,
    totalTax: 0,
    totalDiscount: 0,
    grandTotal: 4800,
    paymentMethod: 'cash',
    amountPaid: 4800,
    items: [
      { productId: 'prod-2', productName: 'Fresh Cow Milk 1L', quantity: 80, costPrice: 60, total: 4800 },
    ],
    createdAt: new Date().toISOString(),
  },
];

export function usePurchases() {
  const queryClient = useQueryClient();

  const purchasesQuery = useQuery({
    queryKey: ['purchases'],
    queryFn: async () => {
      try {
        const data = await purchasesApi.getPurchases();
        if (Array.isArray(data) && data.length > 0) {
          return data;
        }
        return data && Array.isArray(data) ? data : SAMPLE_PURCHASES;
      } catch (err) {
        console.warn('Failed to fetch backend purchases, using sample fallback:', err);
        return SAMPLE_PURCHASES;
      }
    },
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
    purchases: purchasesQuery.data || SAMPLE_PURCHASES,
    isLoading: !purchasesQuery.data && purchasesQuery.isLoading,
    isRefetching: purchasesQuery.isRefetching,
    refetch: purchasesQuery.refetch,
    createPurchase: createPurchaseMutation.mutateAsync,
    isCreating: createPurchaseMutation.isPending,
    deletePurchase: deletePurchaseMutation.mutateAsync,
    isDeleting: deletePurchaseMutation.isPending,
  };
}
