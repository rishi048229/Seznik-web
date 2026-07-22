import { fetchApi } from './api'
import type { CreditTransaction } from '@/types/customer.types'

export const getCreditTransactions = async (
  uid: string,
  customerId?: string
): Promise<CreditTransaction[]> => {
  const query = customerId ? `?customerId=${customerId}` : ''
  return await fetchApi(`/credits${query}`)
}

export const createCreditTransaction = async (
  uid: string,
  data: Omit<CreditTransaction, 'id' | 'createdAt'>
): Promise<string> => {
  const transaction = await fetchApi('/credits', {
    method: 'POST',
    body: JSON.stringify(data),
  })
  return transaction.id
}

export const deleteCreditTransaction = async (uid: string, transactionId: string): Promise<void> => {
  await fetchApi(`/credits/${transactionId}`, {
    method: 'DELETE',
  })
}

export const getCustomersWithCredit = async (uid: string): Promise<any[]> => {
  return await fetchApi('/credits/customers')
}
