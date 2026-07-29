import { fetchApi } from './api'
import type { Purchase } from '@/types/purchase.types'

export const getPurchases = async (_uid: string): Promise<Purchase[]> => {
  return await fetchApi('/purchases')
}

export const getPurchaseById = async (_uid: string, purchaseId: string): Promise<Purchase | null> => {
  try {
    return await fetchApi(`/purchases/${purchaseId}`)
  } catch {
    return null
  }
}

export const createPurchase = async (
  _uid: string,
  purchaseData: Omit<Purchase, 'id' | 'invoiceNumber' | 'createdAt'>
): Promise<{ id: string; invoiceNumber: string }> => {
  const purchase = await fetchApi('/purchases', {
    method: 'POST',
    body: JSON.stringify(purchaseData),
  })
  return { id: purchase.id, invoiceNumber: purchase.invoiceNumber }
}

export const deletePurchase = async (_uid: string, purchaseId: string): Promise<void> => {
  await fetchApi(`/purchases/${purchaseId}`, {
    method: 'DELETE',
  })
}

export const bulkDeletePurchases = async (_uid: string, purchaseIds: string[]): Promise<void> => {
  await fetchApi('/purchases/bulk-delete', {
    method: 'POST',
    body: JSON.stringify({ purchaseIds }),
  })
}

export const getPurchasesBySupplier = async (_uid: string, supplierId: string): Promise<Purchase[]> => {
  const purchases = await getPurchases(_uid)
  return purchases.filter(p => p.supplierId === supplierId)
}

export const updatePurchase = async (_uid: string, purchaseId: string, data: Partial<Purchase>): Promise<void> => {
  await fetchApi(`/purchases/${purchaseId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

