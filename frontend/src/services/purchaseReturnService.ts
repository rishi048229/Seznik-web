import { fetchApi } from './api';
import type {
  PurchaseReturn,
  CreatePurchaseReturnPayload,
  CreatePurchaseReturnResponse,
} from '@/types/purchaseReturn.types';

export const createPurchaseReturn = async (
  purchaseId: string,
  payload: CreatePurchaseReturnPayload
): Promise<CreatePurchaseReturnResponse> => {
  return await fetchApi(`/purchase-returns/${purchaseId}`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
};

export const getPurchaseReturns = async (params?: { page?: number; limit?: number }) => {
  const page = params?.page || 1;
  const limit = params?.limit || 50;
  return await fetchApi(`/purchase-returns?page=${page}&limit=${limit}`);
};

export const getReturnsForPurchase = async (purchaseId: string): Promise<PurchaseReturn[]> => {
  return await fetchApi(`/purchase-returns/purchase/${purchaseId}`);
};

export const getPurchaseReturnById = async (id: string): Promise<PurchaseReturn> => {
  return await fetchApi(`/purchase-returns/${id}`);
};
