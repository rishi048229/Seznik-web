import { create } from 'zustand';
import { Product, StockHistoryItem, StockActionType } from '../types';
import * as db from '../services/db';

interface InventoryState {
  products: Product[];
  categories: string[];
  isLoading: boolean;
  searchQuery: string;
  selectedCategory: string;
  showLowStockOnly: boolean;

  loadProducts: () => Promise<void>;
  addProduct: (product: Omit<Product, 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateProduct: (product: Product) => Promise<void>;
  archiveProduct: (id: string) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  restockProduct: (id: string, qty: number, description: string) => Promise<void>;
  deductStock: (id: string, qty: number, reasonCode: 'damaged' | 'expired' | 'returned' | 'correction' | 'sold_outside', description?: string) => Promise<void>;
  bulkUploadProducts: (products: Omit<Product, 'createdAt' | 'updatedAt'>[]) => Promise<{ added: number; skipped: number; errors: string[] }>;

  setSearchQuery: (query: string) => void;
  setSelectedCategory: (category: string) => void;
  setShowLowStockOnly: (val: boolean) => void;
}

export const useInventoryStore = create<InventoryState>((set, get) => ({
  products: [],
  categories: [],
  isLoading: false,
  searchQuery: '',
  selectedCategory: '',
  showLowStockOnly: false,

  loadProducts: async () => {
    set({ isLoading: true });
    try {
      const list = await db.getProducts();
      const categoriesSet = new Set<string>();
      list.forEach((p) => {
        if (p.category) categoriesSet.add(p.category);
      });
      set({
        products: list.filter((p) => !p.archived),
        categories: Array.from(categoriesSet),
        isLoading: false,
      });
    } catch (_e) {
      set({ isLoading: false });
    }
  },

  addProduct: async (prodData) => {
    set({ isLoading: true });
    try {
      const timestamp = new Date().toISOString();
      const product: Product = { ...prodData, createdAt: timestamp, updatedAt: timestamp };
      await db.saveProduct(product);

      if (product.stockQty > 0) {
        const historyItem: StockHistoryItem = {
          id: Math.random().toString(36).substring(2, 9),
          productId: product.id,
          type: 'restock',
          qty: product.stockQty,
          date: timestamp,
          description: 'Initial stock load',
        };
        await db.addStockHistory(historyItem);
      }
      await get().loadProducts();
    } catch (_e) {
      set({ isLoading: false });
    }
  },

  updateProduct: async (product) => {
    set({ isLoading: true });
    try {
      const updated: Product = { ...product, updatedAt: new Date().toISOString() };
      await db.saveProduct(updated);
      await get().loadProducts();
    } catch (_e) {
      set({ isLoading: false });
    }
  },

  archiveProduct: async (id) => {
    set({ isLoading: true });
    try {
      const prod = get().products.find((p) => p.id === id);
      if (prod) {
        const archived: Product = { ...prod, archived: true, updatedAt: new Date().toISOString() };
        await db.saveProduct(archived);
      }
      await get().loadProducts();
    } catch (_e) {
      set({ isLoading: false });
    }
  },

  deleteProduct: async (id) => {
    set({ isLoading: true });
    try {
      await db.deleteProduct(id);
      await get().loadProducts();
    } catch (_e) {
      set({ isLoading: false });
    }
  },

  restockProduct: async (id, qty, description) => {
    set({ isLoading: true });
    try {
      const prod = get().products.find((p) => p.id === id);
      if (prod) {
        const timestamp = new Date().toISOString();
        const updated: Product = { ...prod, stockQty: prod.stockQty + qty, updatedAt: timestamp };
        await db.saveProduct(updated);

        const historyItem: StockHistoryItem = {
          id: Math.random().toString(36).substring(2, 9),
          productId: id,
          type: 'restock',
          qty,
          date: timestamp,
          description: description || 'Manual stock replenishment',
        };
        await db.addStockHistory(historyItem);
        await get().loadProducts();
      } else {
        set({ isLoading: false });
      }
    } catch (_e) {
      set({ isLoading: false });
    }
  },

  deductStock: async (id, qty, reasonCode, description) => {
    set({ isLoading: true });
    try {
      const prod = get().products.find((p) => p.id === id);
      if (prod) {
        const timestamp = new Date().toISOString();
        const updated: Product = { ...prod, stockQty: Math.max(0, prod.stockQty - qty), updatedAt: timestamp };
        await db.saveProduct(updated);

        const reasonLabels: Record<string, string> = {
          damaged: 'Damaged goods',
          expired: 'Expired stock',
          returned: 'Customer return',
          correction: 'Stock correction',
          sold_outside: 'Sold outside app',
        };

        const historyItem: StockHistoryItem = {
          id: Math.random().toString(36).substring(2, 9),
          productId: id,
          type: 'deduct',
          qty,
          date: timestamp,
          description: description || reasonLabels[reasonCode] || 'Stock deduction',
          reasonCode,
        };
        await db.addStockHistory(historyItem);
        await get().loadProducts();
      } else {
        set({ isLoading: false });
      }
    } catch (_e) {
      set({ isLoading: false });
    }
  },

  bulkUploadProducts: async (items) => {
    set({ isLoading: true });
    let added = 0;
    let skipped = 0;
    const errors: string[] = [];
    const timestamp = new Date().toISOString();

    try {
      for (const item of items) {
        if (!item.name || !item.barcode) {
          skipped++;
          errors.push(`Row missing Name or Barcode: ${JSON.stringify(item)}`);
          continue;
        }

        const existing = get().products.find((p) => p.barcode === item.barcode);
        if (existing) {
          const updatedStock = existing.stockQty + item.stockQty;
          const updated: Product = {
            ...existing,
            stockQty: updatedStock,
            price: item.price > 0 ? item.price : existing.price,
            costPrice: item.costPrice ?? existing.costPrice,
            updatedAt: timestamp,
          };
          await db.saveProduct(updated);
          await db.addStockHistory({
            id: Math.random().toString(36).substring(2, 9),
            productId: existing.id,
            type: 'restock',
            qty: item.stockQty,
            date: timestamp,
            description: 'Bulk CSV import update',
          });
          added++;
        } else {
          const newProduct: Product = { ...item, createdAt: timestamp, updatedAt: timestamp };
          await db.saveProduct(newProduct);
          if (newProduct.stockQty > 0) {
            await db.addStockHistory({
              id: Math.random().toString(36).substring(2, 9),
              productId: newProduct.id,
              type: 'restock',
              qty: newProduct.stockQty,
              date: timestamp,
              description: 'Initial stock from bulk import',
            });
          }
          added++;
        }
      }
      await get().loadProducts();
      return { added, skipped, errors };
    } catch (e: any) {
      errors.push(`Fatal bulk upload error: ${e?.message || e}`);
      set({ isLoading: false });
      return { added, skipped, errors };
    }
  },

  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setSelectedCategory: (selectedCategory) => set({ selectedCategory }),
  setShowLowStockOnly: (showLowStockOnly) => set({ showLowStockOnly }),
}));
