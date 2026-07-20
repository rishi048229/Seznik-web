import { fetchApi } from './api'
import type { Purchase } from '@/types/purchase.types'

export const getPurchases = async (uid: string): Promise<Purchase[]> => {
  return await fetchApi('/purchases')
}

export const getPurchaseById = async (uid: string, purchaseId: string): Promise<Purchase | null> => {
  try {
    return await fetchApi(`/purchases/${purchaseId}`)
  } catch {
    return null
  }
}

export const createPurchase = async (
  uid: string,
  purchaseData: Omit<Purchase, 'id' | 'invoiceNumber' | 'createdAt'>
): Promise<{ id: string; invoiceNumber: string }> => {
  const purchase = await fetchApi('/purchases', {
    method: 'POST',
    body: JSON.stringify(purchaseData),
  })
  return { id: purchase.id, invoiceNumber: purchase.invoiceNumber }
}

export const deletePurchase = async (uid: string, purchaseId: string): Promise<void> => {
  await fetchApi(`/purchases/${purchaseId}`, {
    method: 'DELETE',
  })
}

export const bulkDeletePurchases = async (uid: string, purchaseIds: string[]): Promise<void> => {
  await fetchApi('/purchases/bulk-delete', {
    method: 'POST',
    body: JSON.stringify({ purchaseIds }),
  })
}
