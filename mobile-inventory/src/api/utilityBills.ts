import { fetchApi } from './client';
import {
  UtilityBill,
  UtilityBillStats,
  UtilityBillExtractResult,
  CreateUtilityBillPayload,
} from '@/types/utilityBill';

export const utilityBillsApi = {
  extractBill: async (
    imageBase64: string,
    mimeType: string = 'image/jpeg'
  ): Promise<UtilityBillExtractResult> => {
    const res = await fetchApi<any>('/utility-bills/extract', {
      method: 'POST',
      body: JSON.stringify({ imageBase64, mimeType }),
      timeoutMs: 20000,
    });
    if (res && typeof res === 'object' && 'data' in res && res.data) {
      return res.data;
    }
    return res;
  },

  getStats: async (): Promise<UtilityBillStats> => {
    const res = await fetchApi<any>('/utility-bills/stats');
    return res.data;
  },

  getBills: async (params?: {
    search?: string;
    billType?: string;
    page?: number;
    limit?: number;
  }): Promise<{ bills: UtilityBill[]; total: number; totalPages: number }> => {
    const query = new URLSearchParams();
    if (params?.search) query.append('search', params.search);
    if (params?.billType) query.append('billType', params.billType);
    if (params?.page) query.append('page', String(params.page));
    if (params?.limit) query.append('limit', String(params.limit));

    const qs = query.toString() ? `?${query.toString()}` : '';
    const res = await fetchApi<any>(`/utility-bills${qs}`);
    return {
      bills: res.data || [],
      total: res.pagination?.total || 0,
      totalPages: res.pagination?.totalPages || 1,
    };
  },

  createBill: async (payload: CreateUtilityBillPayload): Promise<UtilityBill> => {
    const res = await fetchApi<any>('/utility-bills', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return res?.data ?? res;
  },

  deleteBill: async (id: string): Promise<void> => {
    await fetchApi<any>(`/utility-bills/${id}`, {
      method: 'DELETE',
    });
  },
};
