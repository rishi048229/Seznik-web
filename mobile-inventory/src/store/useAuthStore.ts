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
  setUserRole: (role: 'admin' | 'agent', password?: string, agentUid?: string) => Promise<void>;
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
    const prevUser = get().user;
    if (!prevUser || prevUser.id !== user.id) {
      try {
        const { removeStoredSettings } = await import('@/services/secureStore');
        const { setCachedSettings } = await import('@/hooks/useSettings');
        const { clearPersistedBusinessLogo } = await import('@/utils/businessLogoStorage');
        await removeStoredSettings();
        setCachedSettings(null);
        await clearPersistedBusinessLogo();
      } catch {
        // ignore
      }
    }
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

  setUserRole: async (role: 'admin' | 'agent', password?: string, agentUid?: string) => {
    const { authApi } = await import('@/api/auth');
    const res = await authApi.setRole({ role, password, agentUid });
    if (res?.token && res?.user) {
      await get().setAuth(res.token, res.user);
    } else if (res?.user) {
      await get().updateUser(res.user);
    }
  },

  logout: async () => {
    await removeAuthToken();
    await removeStoredUser();
    try {
      const { setStoredSettings } = await import('@/services/secureStore');
      const { setCachedSettings } = await import('@/hooks/useSettings');
      const { clearPersistedBusinessLogo } = await import('@/utils/businessLogoStorage');
      await setStoredSettings(null);
      setCachedSettings(null);
      await clearPersistedBusinessLogo();
    } catch {
      // ignore
    }
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

    // Store Owner with Admin role has all permissions by default
    if (user.role === 'admin' && user.accountType !== 'managed') {
      return true;
    }

    // ManagedUser (agent) relies on granular permissions object
    let perms = user.permissions;
    if (typeof perms === 'string') {
      try {
        perms = JSON.parse(perms);
      } catch {
        perms = null;
      }
    }

    if (perms && typeof (perms as any)[permission] === 'boolean') {
      return !!(perms as any)[permission];
    }

    return false;
  },
}));
