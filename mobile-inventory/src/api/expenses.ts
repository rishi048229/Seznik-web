import { fetchApi } from './client';
import { CreateExpensePayload, Expense } from '@/types/expense';

export const expensesApi = {
  getExpenses: async (): Promise<Expense[]> => {
    return fetchApi<Expense[]>('/expenses');
  },

  createExpense: async (payload: CreateExpensePayload): Promise<Expense> => {
    return fetchApi<Expense>('/expenses', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  updateExpense: async (id: string, payload: Partial<CreateExpensePayload>): Promise<{ success: boolean }> => {
    return fetchApi<{ success: boolean }>(`/expenses/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  deleteExpense: async (id: string): Promise<{ success: boolean }> => {
    return fetchApi<{ success: boolean }>(`/expenses/${id}`, {
      method: 'DELETE',
    });
  },
};
