import { create } from 'zustand';
import { Category } from '../types';
import * as db from '../services/db';

interface CategoryState {
  categories: Category[];
  isLoading: boolean;

  loadCategories: () => Promise<void>;
  addCategory: (category: Category) => Promise<void>;
  updateCategory: (category: Category) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
  reorderCategories: (categories: Category[]) => Promise<void>;
}

export const useCategoryStore = create<CategoryState>((set, get) => ({
  categories: [],
  isLoading: false,

  loadCategories: async () => {
    set({ isLoading: true });
    try {
      const categories = await db.getCategories();
      set({ categories, isLoading: false });
    } catch (_e) {
      set({ isLoading: false });
    }
  },

  addCategory: async (category) => {
    try {
      await db.saveCategory(category);
      await get().loadCategories();
    } catch (_e) {
      // Ignored
    }
  },

  updateCategory: async (category) => {
    try {
      await db.saveCategory(category);
      await get().loadCategories();
    } catch (_e) {
      // Ignored
    }
  },

  deleteCategory: async (id) => {
    try {
      await db.deleteCategory(id);
      await get().loadCategories();
    } catch (_e) {
      // Ignored
    }
  },

  reorderCategories: async (categories) => {
    try {
      await db.saveAllCategories(categories);
      set({ categories });
    } catch (_e) {
      // Ignored
    }
  },
}));
