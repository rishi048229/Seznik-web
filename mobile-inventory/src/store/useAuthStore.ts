import { create } from 'zustand';
import { UserPermissions, UserProfile } from '@/types/auth';
import { getAuthToken, getStoredUser, removeAuthToken, removeStoredUser, setAuthToken, setStoredUser, setOwnerSessionBackup, getOwnerSessionBackup, clearOwnerSessionBackup } from '@/services/secureStore';

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
    const prevToken = get().token;
    const prevUser = get().user;
    const wasOwner =
      !!prevToken &&
      !!prevUser &&
      prevUser.accountType !== 'managed' &&
      !(prevUser as any)?.adminId;

    // Returning to Store Admin from an agent session: restore the saved owner JWT after
    // verifying the owner password against setRole using that backup token.
    if (role === 'admin' && (prevUser?.accountType === 'managed' || Boolean((prevUser as any)?.adminId))) {
      const backup = await getOwnerSessionBackup<{ token: string; user: UserProfile }>();
      if (backup?.token && backup?.user) {
        await setAuthToken(backup.token);
        try {
          const res = await authApi.setRole({
            role: 'admin',
            password,
            name: backup.user.displayName || backup.user.email || undefined,
          });
          await clearOwnerSessionBackup();
          if (res?.token && res?.user) {
            await get().setAuth(res.token, res.user);
          } else {
            await get().setAuth(backup.token, { ...backup.user, role: 'admin', accountType: 'user' });
          }
        } catch (err) {
          // Put the agent session back if owner password was wrong.
          if (prevToken && prevUser) {
            await setAuthToken(prevToken);
            await setStoredUser(prevUser);
            set({ token: prevToken, user: prevUser, isAuthenticated: true });
          }
          throw err;
        }
        return;
      }

      // No owner backup on this device — still allow elevating via owner password
      // verified server-side against the agent's store owner account.
      const res = await authApi.setRole({ role: 'admin', password });
      if (res?.token && res?.user) {
        await clearOwnerSessionBackup();
        await get().setAuth(res.token, res.user);
        return;
      }
      throw new Error(
        'No saved Store Owner session on this device. Log out and sign in with the store owner account, then choose Admin.'
      );
    }

    const res = await authApi.setRole({ role, password, agentUid });
    if (role === 'agent' && res?.user?.accountType !== 'managed' && !(res?.user as any)?.adminId) {
      throw new Error('Could not switch into the agent account. Pick the agent from the list and try again.');
    }
    if (role === 'agent' && !res?.token) {
      throw new Error('Agent login did not issue a new session. Pick the agent from the list and try again.');
    }
    if (role === 'agent' && wasOwner && prevToken && prevUser) {
      await setOwnerSessionBackup({ token: prevToken, user: prevUser });
    }
    if (res?.token && res?.user) {
      await get().setAuth(res.token, res.user);
    } else if (res?.user) {
      await get().updateUser(res.user);
    }
  },

  logout: async () => {
    await removeAuthToken();
    await removeStoredUser();
    await clearOwnerSessionBackup();
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

    if (user.role === 'admin' && user.accountType !== 'managed') {
      return true;
    }

    let perms = user.permissions as UserPermissions | string | null | undefined;
    if (typeof perms === 'string') {
      try {
        perms = JSON.parse(perms);
      } catch {
        perms = null;
      }
    }

    if (perms && typeof (perms as UserPermissions)[permission] === 'boolean') {
      return !!(perms as UserPermissions)[permission];
    }

    if (permission === 'canAccessKOT' || permission === 'canSendRemotePrint') {
      return !!(perms && (perms as UserPermissions).canAccessSales);
    }

    return false;
  },
}));
