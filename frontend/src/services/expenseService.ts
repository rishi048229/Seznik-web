import { fetchApi } from './api'
import type { Expense } from '@/types/expense.types'

export const getExpenses = async (uid: string): Promise<Expense[]> => {
  return await fetchApi('/expenses')
}

export const createExpense = async (
  uid: string,
  data: Omit<Expense, 'id' | 'createdAt'>
): Promise<string> => {
  const expense = await fetchApi('/expenses', {
    method: 'POST',
    body: JSON.stringify(data),
  })
  return expense.id
}

export const deleteExpense = async (uid: string, expenseId: string): Promise<void> => {
  await fetchApi(`/expenses/${expenseId}`, {
    method: 'DELETE',
  })
}
