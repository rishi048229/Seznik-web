import { fetchApi } from './api'
import type { Expense } from '@/types/expense.types'

export const getExpenses = async (_uid: string): Promise<Expense[]> => {
  return await fetchApi('/expenses')
}

export const createExpense = async (
  _uid: string,
  data: Omit<Expense, 'id' | 'createdAt'>
): Promise<string> => {
  const expense = await fetchApi('/expenses', {
    method: 'POST',
    body: JSON.stringify(data),
  })
  return expense.id
}

export const updateExpense = async (
  _uid: string,
  expenseId: string,
  data: Partial<Omit<Expense, 'id' | 'createdAt'>>
): Promise<void> => {
  await fetchApi(`/expenses/${expenseId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export const deleteExpense = async (_uid: string, expenseId: string): Promise<void> => {
  await fetchApi(`/expenses/${expenseId}`, {
    method: 'DELETE',
  })
}

