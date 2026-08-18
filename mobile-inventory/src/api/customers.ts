import { fetchApi } from './client';
import { CreateCustomerPayload, Customer } from '@/types/customer';

export const customersApi = {
  getCustomers: async (): Promise<Customer[]> => {
    const raw = await fetchApi<any>('/customers');
    return Array.isArray(raw) ? raw : (Array.isArray(raw?.customers) ? raw.customers : []);
  },

  getCustomerById: async (id: string): Promise<Customer> => {
    return fetchApi<Customer>(`/customers/${id}`);
  },

  createCustomer: async (payload: CreateCustomerPayload): Promise<Customer> => {
    return fetchApi<Customer>('/customers', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  updateCustomer: async (id: string, payload: Partial<CreateCustomerPayload>): Promise<Customer> => {
    return fetchApi<Customer>(`/customers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  deleteCustomer: async (id: string): Promise<{ success: boolean }> => {
    return fetchApi<{ success: boolean }>(`/customers/${id}`, {
      method: 'DELETE',
    });
  },

  bulkCreateCustomers: async (customers: CreateCustomerPayload[]): Promise<{ success: boolean; count: number }> => {
    return fetchApi<{ success: boolean; count: number }>('/customers/bulk-create', {
      method: 'POST',
      body: JSON.stringify({ customers }),
    });
  },
};


