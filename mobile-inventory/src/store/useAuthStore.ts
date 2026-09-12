import { create } from 'zustand';
import { UserPermissions, UserProfile } from '@/types/auth';
import { getAuthToken, getStoredUser, removeAuthToken, removeStoredUser, setAuthToken, setStoredUser } from '@/services/secureStore';

interface AuthState {
  token: string | null;
  user: UserProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  initializeAuth: () => Promise<void>;
  setAuth: (token: string, user: UserProfile) => Promise<void>;
  updateUser: (user: UserProfile) => Promise<void>;
  logout: () => Promise<void>;
  hasPermission: (permission: keyof UserPermissions) => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: null,
  user: null,
  isLoading: true,
  isAuthenticated: false,

  initializeAuth: async () => {
    try {
      const [savedToken, savedUser] = await Promise.all([
        getAuthToken(),
        getStoredUser<UserProfile>(),
      ]);

      if (savedToken && savedUser) {
        set({
          token: savedToken,
          user: savedUser,
          isAuthenticated: true,
          isLoading: false,
        });
      } else {
        set({
          token: null,
          user: null,
          isAuthenticated: false,
          isLoading: false,
        });
      }
    } catch (e) {
      console.error('Failed to initialize auth from SecureStore:', e);
      set({
        token: null,
        user: null,
        isAuthenticated: false,
        isLoading: false,
      });
    }
  },

  setAuth: async (token: string, user: UserProfile) => {
    await setAuthToken(token);
    await setStoredUser(user);
    try {
      const { useCartStore } = await import('@/store/useCartStore');
      useCartStore.getState().clearCart();
    } catch {
      // ignore
    }
    set({
      token,
      user,
      isAuthenticated: true,
      isLoading: false,
    });
  },

  updateUser: async (user: UserProfile) => {
    await setStoredUser(user);
    set({ user });
  },

  logout: async () => {
    await removeAuthToken();
    await removeStoredUser();
    try {
      const { clearCatalogCache } = await import('@/services/catalogCache');
      await clearCatalogCache();
    } catch {
      // ignore
    }
    try {
      const { useCartStore } = await import('@/store/useCartStore');
      useCartStore.getState().clearCart();
    } catch {
      // ignore
    }
    set({
      token: null,
      user: null,
      isAuthenticated: false,
      isLoading: false,
    });
  },

  hasPermission: (permission: keyof UserPermissions) => {
    const { user } = get();
    if (!user) return false;

    // Admin role has all permissions by default
    if (user.role === 'admin' || user.accountType === 'user') {
      return true;
    }

    // ManagedUser (agent) relies on granular permissions object
    if (user.permissions && typeof user.permissions[permission] === 'boolean') {
      return !!user.permissions[permission];
    }

    return false;
  },
}));
