import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getPurchaseReturns,
  getReturnsForPurchase,
  getPurchaseReturnById,
  createPurchaseReturn,
} from '@/services/purchaseReturnService';
import type { CreatePurchaseReturnPayload } from '@/types/purchaseReturn.types';

export const usePurchaseReturns = (params?: { page?: number; limit?: number }) => {
  return useQuery({
    queryKey: ['purchaseReturns', params],
    queryFn: () => getPurchaseReturns(params),
  });
};

export const useReturnsForPurchase = (purchaseId: string) => {
  return useQuery({
    queryKey: ['purchaseReturns', 'purchase', purchaseId],
    queryFn: () => getReturnsForPurchase(purchaseId),
    enabled: Boolean(purchaseId),
  });
};

export const usePurchaseReturnById = (id: string) => {
  return useQuery({
    queryKey: ['purchaseReturn', id],
    queryFn: () => getPurchaseReturnById(id),
    enabled: Boolean(id),
  });
};

export const useCreatePurchaseReturn = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ purchaseId, payload }: { purchaseId: string; payload: CreatePurchaseReturnPayload }) =>
      createPurchaseReturn(purchaseId, payload),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['purchases'] });
      queryClient.invalidateQueries({ queryKey: ['purchaseReturns'] });
      queryClient.invalidateQueries({ queryKey: ['purchaseReturns', 'purchase', variables.purchaseId] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
      queryClient.invalidateQueries({ queryKey: ['reports'] });
    },
  });
};
