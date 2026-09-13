import { fetchApi } from './api'
import type { Supplier, SupplierLedger, SupplierRemindersResponse } from '@/types/supplier.types'

export type { Supplier } from '@/types/supplier.types'

export const getSuppliers = async (_uid: string): Promise<Supplier[]> => {
  return await fetchApi('/suppliers')
}

export const getSupplierById = async (_uid: string, supplierId: string): Promise<Supplier> => {
  return await fetchApi(`/suppliers/${supplierId}`)
}

export const getSupplierLedger = async (_uid: string, supplierId: string): Promise<SupplierLedger> => {
  return await fetchApi(`/suppliers/${supplierId}/ledger`)
}

export const recordSupplierPayment = async (
  _uid: string,
  supplierId: string,
  data: { amount: number; paymentMethod: string; purchaseId?: string; notes?: string }
): Promise<any> => {
  return await fetchApi(`/suppliers/${supplierId}/payments`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export const getSupplierReminders = async (_uid: string): Promise<SupplierRemindersResponse> => {
  return await fetchApi('/suppliers/reminders/due')
}

export const createSupplier = async (_uid: string, data: Omit<Supplier, 'id' | 'createdAt'>): Promise<string> => {
  const supplier = await fetchApi('/suppliers', {
    method: 'POST',
    body: JSON.stringify(data),
  })
  return supplier.id
}

export const updateSupplier = async (_uid: string, supplierId: string, data: Partial<Omit<Supplier, 'id' | 'createdAt'>>): Promise<void> => {
  await fetchApi(`/suppliers/${supplierId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export const deleteSupplier = async (_uid: string, supplierId: string): Promise<void> => {
  await fetchApi(`/suppliers/${supplierId}`, {
    method: 'DELETE',
  })
}


