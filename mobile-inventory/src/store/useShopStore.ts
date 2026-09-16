import { create } from 'zustand';
import { ShopProfile, BusinessMode } from '../types';
import { getShopProfile, saveShopProfile, getBusinessMode, saveBusinessMode, getOnboarded, saveOnboarded } from '../services/db';

interface ShopState {
  profile: ShopProfile;
  currency: string;
  defaultTaxRate: number;
  isLoading: boolean;
  mode: BusinessMode;
  isOnboarded: boolean;

  loadProfile: () => Promise<void>;
  updateProfile: (profile: ShopProfile) => Promise<void>;
  setCurrency: (currency: string) => void;
  setDefaultTaxRate: (rate: number) => void;
  setMode: (mode: BusinessMode) => Promise<void>;
  completeOnboarding: () => Promise<void>;
  loadOnboardingState: () => Promise<void>;
}

export const useShopStore = create<ShopState>((set) => ({
  profile: {
    name: '',
    address: '',
    phone: '',
    taxId: '',
  },
  currency: '₹',
  defaultTaxRate: 18,
  isLoading: false,
  mode: 'product',
  isOnboarded: false,

  loadProfile: async () => {
    set({ isLoading: true });
    try {
      const profile = await getShopProfile();
      const mode = await getBusinessMode();
      set({ profile, mode, isLoading: false });
    } catch (_e) {
      set({ isLoading: false });
    }
  },

  updateProfile: async (newProfile: ShopProfile) => {
    set({ isLoading: true });
    try {
      await saveShopProfile(newProfile);
      set({ profile: newProfile, isLoading: false });
    } catch (_e) {
      set({ isLoading: false });
    }
  },

  setCurrency: (currency) => set({ currency }),
  setDefaultTaxRate: (defaultTaxRate) => set({ defaultTaxRate }),

  setMode: async (mode) => {
    await saveBusinessMode(mode);
    set({ mode });
  },

  completeOnboarding: async () => {
    await saveOnboarded(true);
    set({ isOnboarded: true });
  },

  loadOnboardingState: async () => {
    try {
      const isOnboarded = await getOnboarded();
      const mode = await getBusinessMode();
      set({ isOnboarded, mode });
    } catch (_e) {
      // Defaults already set
    }
  },
}));
