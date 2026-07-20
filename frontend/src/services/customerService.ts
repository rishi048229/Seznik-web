import { fetchApi } from './api'
import type { Customer, CreditTransaction } from '@/types/customer.types'

export const getCustomers = async (uid: string): Promise<Customer[]> => {
  return await fetchApi('/customers')
}

export const createCustomer = async (uid: string, data: Omit<Customer, 'id' | 'createdAt'>): Promise<string> => {
  const customer = await fetchApi('/customers', {
    method: 'POST',
    body: JSON.stringify(data),
  })
  return customer.id
}

export const updateCustomer = async (uid: string, customerId: string, data: Partial<Omit<Customer, 'id' | 'createdAt'>>): Promise<void> => {
  await fetchApi(`/customers/${customerId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export const updateCustomerCredit = async (uid: string, customerId: string, amount: number): Promise<void> => {
  // In a complete implementation, this should be a dedicated endpoint
  // But for now we just use the generic update endpoint
  const customer = await fetchApi(`/customers/${customerId}`)
  await fetchApi(`/customers/${customerId}`, {
    method: 'PUT',
    body: JSON.stringify({ creditBalance: customer.creditBalance + amount }),
  })
}

export const addCreditTransaction = async (uid: string, data: Omit<CreditTransaction, 'id' | 'createdAt'>): Promise<void> => {
  // Need backend support for credit transactions, will implement if required
}
