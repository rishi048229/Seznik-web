import { fetchApi } from './api'
import type { CreditTransaction, Customer } from '@/types/customer.types'

export type CustomerCreditSummary = Customer & { totalCredit: number }

export const getCreditTransactions = async (
  _uid: string,
  customerId?: string
): Promise<CreditTransaction[]> => {
  const query = customerId ? `?customerId=${customerId}` : ''
  return await fetchApi(`/credits${query}`)
}

export const createCreditTransaction = async (
  _uid: string,
  data: Omit<CreditTransaction, 'id' | 'createdAt'>
): Promise<string> => {
  const transaction = await fetchApi('/credits', {
    method: 'POST',
    body: JSON.stringify(data),
  })
  return transaction.id
}

export const deleteCreditTransaction = async (_uid: string, transactionId: string): Promise<void> => {
  await fetchApi(`/credits/${transactionId}`, {
    method: 'DELETE',
  })
}

export const getCustomersWithCredit = async (_uid: string): Promise<CustomerCreditSummary[]> => {
  return await fetchApi('/credits/customers')
}

