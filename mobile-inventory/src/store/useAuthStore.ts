import { create } from 'zustand';
import { UserPermissions, UserProfile } from '@/types/auth';
import { getAuthToken, getStoredUser, removeAuthToken, removeStoredUser, setAuthToken, setStoredUser } from '@/services/secureStore';

/** Shared dev bypass credentials — always the same store for every tester/device. */
export const DEV_BYPASS_TOKEN = 'dev-token-bypass';

export const DEV_BYPASS_USER: UserProfile = {
  id: '6f183b3c-2753-4144-b723-dd366eb53526',
  email: 'owner@seznik.com',
  displayName: 'Seznik Owner',
  businessName: 'Seznik POS Store',
  businessType: 'restaurant_cafe',
  role: 'admin',
  onboardingCompleted: true,
  accountType: 'user',
};

interface AuthState {
  token: string | null;
  user: UserProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  initializeAuth: () => Promise<void>;
  setAuth: (token: string, user: UserProfile) => Promise<void>;
  loginWithDevBypass: () => Promise<void>;
  updateUser: (user: UserProfile) => Promise<void>;
  logout: () => Promise<void>;
  hasPermission: (permission: keyof UserPermissions) => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: DEV_BYPASS_TOKEN,
  user: DEV_BYPASS_USER,
  isLoading: true,
  isAuthenticated: true, // Default to true to bypass login directly to dashboard for dev

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
        // Bypass login for quick dev testing; fallback to default dev admin user
        set({
          token: DEV_BYPASS_TOKEN,
          user: DEV_BYPASS_USER,
          isAuthenticated: true,
          isLoading: false,
        });
      }
    } catch (e) {
      console.error('Failed to initialize auth from SecureStore:', e);
      set({
        token: DEV_BYPASS_TOKEN,
        user: DEV_BYPASS_USER,
        isAuthenticated: true,
        isLoading: false,
      });
    }
  },

  setAuth: async (token: string, user: UserProfile) => {
    await setAuthToken(token);
    await setStoredUser(user);
    set({
      token,
      user,
      isAuthenticated: true,
      isLoading: false,
    });
  },

  /** Wipe any prior login and always open the shared Seznik POS Store dev account. */
  loginWithDevBypass: async () => {
    await removeAuthToken();
    await removeStoredUser();

    await setAuthToken(DEV_BYPASS_TOKEN);
    await setStoredUser(DEV_BYPASS_USER);
    set({
      token: DEV_BYPASS_TOKEN,
      user: DEV_BYPASS_USER,
      isAuthenticated: true,
      isLoading: false,
    });

    try {
      const { authApi } = await import('@/api/auth');
      const profile = await authApi.getProfile();
      const syncedUser: UserProfile = {
        ...profile,
        id: profile.id,
        email: DEV_BYPASS_USER.email,
        displayName: DEV_BYPASS_USER.displayName,
        businessName: DEV_BYPASS_USER.businessName,
        businessType: profile.businessType ?? DEV_BYPASS_USER.businessType,
        role: 'admin',
        onboardingCompleted: true,
        accountType: 'user',
      };
      await setStoredUser(syncedUser);
      set({ user: syncedUser });
    } catch {
      // Backend unreachable — local dev user is still usable for UI testing
    }
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
