import { fetchApi } from './api'
import type { Supplier } from '@/types/supplier.types'

export type { Supplier } from '@/types/supplier.types'

export const getSuppliers = async (uid: string): Promise<Supplier[]> => {
  return await fetchApi('/suppliers')
}

export const createSupplier = async (uid: string, data: Omit<Supplier, 'id' | 'createdAt'>): Promise<string> => {
  const supplier = await fetchApi('/suppliers', {
    method: 'POST',
    body: JSON.stringify(data),
  })
  return supplier.id
}

export const updateSupplier = async (uid: string, supplierId: string, data: Partial<Omit<Supplier, 'id' | 'createdAt'>>): Promise<void> => {
  await fetchApi(`/suppliers/${supplierId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export const deleteSupplier = async (uid: string, supplierId: string): Promise<void> => {
  await fetchApi(`/suppliers/${supplierId}`, {
    method: 'DELETE',
  })
}
