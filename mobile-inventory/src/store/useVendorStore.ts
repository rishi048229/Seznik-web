import { create } from 'zustand';
import { Vendor } from '../types';
import * as db from '../services/db';

interface VendorState {
  vendors: Vendor[];
  isLoading: boolean;
  searchQuery: string;

  loadVendors: () => Promise<void>;
  addVendor: (vendor: Omit<Vendor, 'id'>) => Promise<void>;
  updateVendor: (vendor: Vendor) => Promise<void>;
  deleteVendor: (id: string) => Promise<void>;
  setSearchQuery: (query: string) => void;
}

export const useVendorStore = create<VendorState>((set, get) => ({
  vendors: [],
  isLoading: false,
  searchQuery: '',

  loadVendors: async () => {
    set({ isLoading: true });
    try {
      const list = await db.getVendors();
      set({ vendors: list, isLoading: false });
    } catch (e) {
      set({ isLoading: false });
    }
  },

  addVendor: async (vendorData) => {
    set({ isLoading: true });
    try {
      const vendor: Vendor = {
        ...vendorData,
        id: Math.random().toString(36).substring(2, 9),
      };
      await db.saveVendor(vendor);
      await get().loadVendors();
    } catch (e) {
      set({ isLoading: false });
    }
  },

  updateVendor: async (vendor) => {
    set({ isLoading: true });
    try {
      await db.saveVendor(vendor);
      await get().loadVendors();
    } catch (e) {
      set({ isLoading: false });
    }
  },

  deleteVendor: async (id) => {
    set({ isLoading: true });
    try {
      await db.deleteVendor(id);
      await get().loadVendors();
    } catch (e) {
      set({ isLoading: false });
    }
  },

  setSearchQuery: (searchQuery) => set({ searchQuery }),
}));
