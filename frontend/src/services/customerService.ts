import { fetchApi } from './api'
import type { Customer, CreditTransaction } from '@/types/customer.types'

export const getCustomers = async (_uid: string): Promise<Customer[]> => {
  return await fetchApi('/customers')
}

export const getCustomerById = async (_uid: string, customerId: string): Promise<Customer> => {
  return await fetchApi(`/customers/${customerId}`)
}

export const createCustomer = async (_uid: string, data: Omit<Customer, 'id' | 'createdAt'>): Promise<string> => {
  const customer = await fetchApi('/customers', {
    method: 'POST',
    body: JSON.stringify(data),
  })
  return customer.id
}

export const updateCustomer = async (_uid: string, customerId: string, data: Partial<Omit<Customer, 'id' | 'createdAt'>>): Promise<void> => {
  await fetchApi(`/customers/${customerId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export const updateCustomerCredit = async (_uid: string, customerId: string, amount: number, notes?: string): Promise<void> => {
  await fetchApi('/credits', {
    method: 'POST',
    body: JSON.stringify({
      customerId,
      amount: Math.abs(amount),
      type: amount > 0 ? 'credit' : 'payment',
      notes: notes || (amount > 0 ? 'Credit issued' : 'Credit payment received'),
    }),
  })
}

export const addCreditTransaction = async (_uid: string, data: Omit<CreditTransaction, 'id' | 'createdAt'>): Promise<void> => {
  await fetchApi('/credits', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export const getCreditTransactions = async (_uid: string, customerId?: string): Promise<CreditTransaction[]> => {
  const query = customerId ? `?customerId=${customerId}` : ''
  return await fetchApi(`/credits${query}`)
}

export const recordPayment = async (_uid: string, data: { customerId: string; amount: number; notes?: string; paymentMethod?: string }): Promise<void> => {
  await fetchApi('/credits', {
    method: 'POST',
    body: JSON.stringify({
      customerId: data.customerId,
      amount: Number(data.amount),
      type: 'payment',
      notes: data.notes || 'Credit payment received',
    }),
  })
}

export const deleteCustomer = async (_uid: string, customerId: string): Promise<void> => {
  await fetchApi(`/customers/${customerId}`, {
    method: 'DELETE',
  })
}

