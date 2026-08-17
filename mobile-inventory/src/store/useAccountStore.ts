import { create } from 'zustand';
import { UserRole, StaffAccount } from '../types';

interface UserProfile {
  name: string;
  email: string;
  phone: string;
  role: UserRole;
}

interface AccountState {
  user: UserProfile;
  appLockPin: string;
  isAppLockEnabled: boolean;
  staffAccounts: StaffAccount[];
  activeRole: UserRole;

  updateUser: (user: Partial<UserProfile>) => void;
  updatePin: (pin: string) => void;
  toggleAppLock: (val: boolean) => void;
  addStaffAccount: (account: StaffAccount) => void;
  removeStaffAccount: (id: string) => void;
  exportData: () => Promise<string>;
  backupData: () => Promise<string>;
}

export const useAccountStore = create<AccountState>((set, get) => ({
  user: {
    name: 'Rishi',
    email: 'rishi@seznik.com',
    phone: '+91 98765 43210',
    role: 'Owner',
  },
  appLockPin: '1234',
  isAppLockEnabled: false,
  staffAccounts: [],
  activeRole: 'Owner',

  updateUser: (updates) => set((prev) => {
    const updatedUser = { ...prev.user, ...updates };
    return { user: updatedUser, activeRole: updatedUser.role };
  }),
  updatePin: (appLockPin) => set({ appLockPin }),
  toggleAppLock: (isAppLockEnabled) => set({ isAppLockEnabled }),

  addStaffAccount: (account) => set((prev) => ({
    staffAccounts: [...prev.staffAccounts, account],
  })),

  removeStaffAccount: (id) => set((prev) => ({
    staffAccounts: prev.staffAccounts.filter((s) => s.id !== id),
  })),

  exportData: async () => {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return JSON.stringify({ shop: 'Seznik Shop', timestamp: new Date().toISOString() });
  },
  backupData: async () => {
    await new Promise((resolve) => setTimeout(resolve, 1200));
    return new Date().toLocaleString();
  },
}));
