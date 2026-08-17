import { fetchApi } from './client';
import { CreateSupplierPayload, Supplier } from '@/types/supplier';

export const suppliersApi = {
  getSuppliers: async (): Promise<Supplier[]> => {
    return fetchApi<Supplier[]>('/suppliers');
  },

  createSupplier: async (payload: CreateSupplierPayload): Promise<Supplier> => {
    return fetchApi<Supplier>('/suppliers', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  updateSupplier: async (id: string, payload: Partial<CreateSupplierPayload>): Promise<Supplier> => {
    return fetchApi<Supplier>(`/suppliers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  deleteSupplier: async (id: string): Promise<{ success: boolean }> => {
    return fetchApi<{ success: boolean }>(`/suppliers/${id}`, {
      method: 'DELETE',
    });
  },
};
