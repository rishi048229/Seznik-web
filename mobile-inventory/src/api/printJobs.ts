import { fetchApi } from './client';
import { CreatePrintJobPayload, PrintJob, BusinessDeviceEntry } from '@/types/printJob';

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  message?: string;
}

export const printJobsApi = {
  create: async (payload: CreatePrintJobPayload): Promise<PrintJob> => {
    const res = await fetchApi<ApiEnvelope<PrintJob>>('/print-jobs', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return res.data;
  },

  listForAdmin: async (params?: { status?: string; targetAgentId?: string }): Promise<PrintJob[]> => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set('status', params.status);
    if (params?.targetAgentId) qs.set('targetAgentId', params.targetAgentId);
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    const res = await fetchApi<ApiEnvelope<PrintJob[]>>(`/print-jobs${suffix}`);
    return res.data;
  },

  listPendingForAgent: async (): Promise<PrintJob[]> => {
    const res = await fetchApi<ApiEnvelope<PrintJob[]>>('/print-jobs/agent/pending');
    return res.data;
  },

  getById: async (id: string): Promise<PrintJob> => {
    const res = await fetchApi<ApiEnvelope<PrintJob>>(`/print-jobs/${id}`);
    return res.data;
  },

  updateStatus: async (
    id: string,
    status: Exclude<PrintJob['status'], 'queued' | 'delivered' | 'expired' | 'cancelled'>,
    failureReason?: string
  ): Promise<PrintJob> => {
    const res = await fetchApi<ApiEnvelope<PrintJob>>(`/print-jobs/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, failureReason }),
    });
    return res.data;
  },

  cancel: async (id: string): Promise<PrintJob> => {
    const res = await fetchApi<ApiEnvelope<PrintJob>>(`/print-jobs/${id}/cancel`, { method: 'PATCH' });
    return res.data;
  },

  reassign: async (id: string, targetAgentId: string): Promise<PrintJob> => {
    const res = await fetchApi<ApiEnvelope<PrintJob>>(`/print-jobs/${id}/reassign`, {
      method: 'POST',
      body: JSON.stringify({ targetAgentId }),
    });
    return res.data;
  },
};

export const deviceTokensApi = {
  listBusinessDevices: async (): Promise<BusinessDeviceEntry[]> => {
    const res = await fetchApi<ApiEnvelope<BusinessDeviceEntry[]>>('/device-tokens');
    return res.data;
  },
};
