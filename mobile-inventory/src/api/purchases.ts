import { fetchApi } from './client';
import { CreatePurchasePayload, Purchase } from '@/types/purchase';

export const purchasesApi = {
  getPurchases: async (): Promise<Purchase[]> => {
    return fetchApi<Purchase[]>('/purchases');
  },

  getPurchaseById: async (id: string): Promise<Purchase> => {
    return fetchApi<Purchase>(`/purchases/${id}`);
  },

  createPurchase: async (payload: CreatePurchasePayload): Promise<Purchase> => {
    return fetchApi<Purchase>('/purchases', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  deletePurchase: async (id: string): Promise<void> => {
    return fetchApi<void>(`/purchases/${id}`, {
      method: 'DELETE',
    });
  },
};
