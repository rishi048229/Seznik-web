import { fetchApi } from './client';
import {
  KOTOrder,
  CreateKOTOrderPayload,
  GenerateKOTBillPayload,
  KOTOrderStatus,
  KOTPriority,
} from '@/types/kot';

export const kotOrdersApi = {
  getOrders: async (params?: { status?: string; orderType?: string; tableId?: string }): Promise<KOTOrder[]> => {
    const query = new URLSearchParams();
    if (params?.status) query.append('status', params.status);
    if (params?.orderType) query.append('orderType', params.orderType);
    if (params?.tableId) query.append('tableId', params.tableId);
    const qs = query.toString() ? `?${query.toString()}` : '';
    return fetchApi<KOTOrder[]>(`/kot-orders${qs}`);
  },

  getOrderById: async (id: string): Promise<KOTOrder> => {
    return fetchApi<KOTOrder>(`/kot-orders/${id}`);
  },

  createOrder: async (payload: CreateKOTOrderPayload): Promise<KOTOrder> => {
    return fetchApi<KOTOrder>('/kot-orders', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  addItems: async (id: string, items: CreateKOTOrderPayload['items']): Promise<KOTOrder> => {
    return fetchApi<KOTOrder>(`/kot-orders/${id}/items`, {
      method: 'POST',
      body: JSON.stringify({ items }),
    });
  },

  updateStatus: async (
    id: string,
    payload: { status?: KOTOrderStatus; priority?: KOTPriority; notes?: string }
  ): Promise<{ success: boolean }> => {
    return fetchApi<{ success: boolean }>(`/kot-orders/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  generateBill: async (
    id: string,
    payload: GenerateKOTBillPayload
  ): Promise<{ order: KOTOrder; sale: any }> => {
    return fetchApi<{ order: KOTOrder; sale: any }>(`/kot-orders/${id}/bill`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
};
