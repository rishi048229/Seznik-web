import { create } from 'zustand';
import { Expense } from '../types';
import * as db from '../services/db';

interface ExpenseState {
  expenses: Expense[];
  isLoading: boolean;

  loadExpenses: () => Promise<void>;
  addExpense: (expense: Expense) => Promise<void>;
  updateExpense: (expense: Expense) => Promise<void>;
  deleteExpense: (id: string) => Promise<void>;
  getExpensesByRange: (startDate: string, endDate: string) => Expense[];
}

export const useExpenseStore = create<ExpenseState>((set, get) => ({
  expenses: [],
  isLoading: false,

  loadExpenses: async () => {
    set({ isLoading: true });
    try {
      const expenses = await db.getExpenses();
      set({ expenses, isLoading: false });
    } catch (_e) {
      set({ isLoading: false });
    }
  },

  addExpense: async (expense) => {
    try {
      await db.saveExpense(expense);
      await get().loadExpenses();
    } catch (_e) {
      // Ignored
    }
  },

  updateExpense: async (expense) => {
    try {
      await db.saveExpense(expense);
      await get().loadExpenses();
    } catch (_e) {
      // Ignored
    }
  },

  deleteExpense: async (id) => {
    try {
      await db.deleteExpense(id);
      await get().loadExpenses();
    } catch (_e) {
      // Ignored
    }
  },

  getExpensesByRange: (startDate, endDate) => {
    const start = new Date(startDate).getTime();
    const end = new Date(endDate).getTime();
    return get().expenses.filter((e) => {
      const d = new Date(e.date).getTime();
      return d >= start && d <= end;
    });
  },
}));
