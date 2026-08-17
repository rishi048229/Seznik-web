import { fetchApi } from './client';
import { CreateSalePayload, Sale } from '@/types/sale';

export const salesApi = {
  getSales: async (): Promise<Sale[]> => {
    return fetchApi<Sale[]>('/sales');
  },

  getSaleById: async (id: string): Promise<Sale> => {
    return fetchApi<Sale>(`/sales/${id}`);
  },

  createSale: async (payload: CreateSalePayload): Promise<Sale> => {
    return fetchApi<Sale>('/sales', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  deleteSale: async (id: string): Promise<{ success: boolean }> => {
    return fetchApi<{ success: boolean }>(`/sales/${id}`, {
      method: 'DELETE',
    });
  },
};
