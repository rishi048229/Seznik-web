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

const defaultDevUser: UserProfile = {
  id: 'dev-store-owner',
  email: 'owner@seznik.com',
  displayName: 'Seznik POS Admin',
  role: 'admin',
  onboardingCompleted: true,
  accountType: 'user',
};

export const useAuthStore = create<AuthState>((set, get) => ({
  token: 'dev-token-bypass',
  user: defaultDevUser,
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
          token: 'dev-token-bypass',
          user: defaultDevUser,
          isAuthenticated: true,
          isLoading: false,
        });
      }
    } catch (e) {
      console.error('Failed to initialize auth from SecureStore:', e);
      set({
        token: 'dev-token-bypass',
        user: defaultDevUser,
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

  updateUser: async (user: UserProfile) => {
    await setStoredUser(user);
    set({ user });
  },

  logout: async () => {
    await removeAuthToken();
    await removeStoredUser();
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
