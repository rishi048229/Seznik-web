import { create } from 'zustand';
import { Customer } from '../types';
import * as db from '../services/db';

interface CustomerState {
  customers: Customer[];
  isLoading: boolean;
  searchQuery: string;

  loadCustomers: () => Promise<void>;
  addCustomer: (customer: Customer) => Promise<void>;
  updateCustomer: (customer: Customer) => Promise<void>;
  deleteCustomer: (id: string) => Promise<void>;
  lookupByPhone: (phone: string) => Customer | undefined;
  incrementVisit: (id: string, amount: number) => Promise<void>;
  updateCreditBalance: (id: string, delta: number) => Promise<void>;
  setSearchQuery: (query: string) => void;
}

export const useCustomerStore = create<CustomerState>((set, get) => ({
  customers: [],
  isLoading: false,
  searchQuery: '',

  loadCustomers: async () => {
    set({ isLoading: true });
    try {
      const customers = await db.getCustomers();
      set({ customers, isLoading: false });
    } catch (_e) {
      set({ isLoading: false });
    }
  },

  addCustomer: async (customer) => {
    try {
      await db.saveCustomer(customer);
      await get().loadCustomers();
    } catch (_e) {
      // Ignored
    }
  },

  updateCustomer: async (customer) => {
    try {
      await db.saveCustomer(customer);
      await get().loadCustomers();
    } catch (_e) {
      // Ignored
    }
  },

  deleteCustomer: async (id) => {
    try {
      await db.deleteCustomer(id);
      await get().loadCustomers();
    } catch (_e) {
      // Ignored
    }
  },

  lookupByPhone: (phone) => {
    const normalized = phone.replace(/\s+/g, '').replace(/^\+91/, '');
    return get().customers.find((c) => {
      const cNorm = c.phone.replace(/\s+/g, '').replace(/^\+91/, '');
      return cNorm === normalized || cNorm.endsWith(normalized) || normalized.endsWith(cNorm);
    });
  },

  incrementVisit: async (id, amount) => {
    const customer = get().customers.find((c) => c.id === id);
    if (!customer) return;
    const updated: Customer = {
      ...customer,
      visitCount: customer.visitCount + 1,
      totalSpend: customer.totalSpend + amount,
      lastVisitAt: new Date().toISOString(),
    };
    await db.saveCustomer(updated);
    await get().loadCustomers();
  },

  updateCreditBalance: async (id, delta) => {
    const customer = get().customers.find((c) => c.id === id);
    if (!customer) return;
    const updated: Customer = {
      ...customer,
      creditBalance: (customer.creditBalance || 0) + delta,
    };
    await db.saveCustomer(updated);
    await get().loadCustomers();
  },

  setSearchQuery: (searchQuery) => set({ searchQuery }),
}));
