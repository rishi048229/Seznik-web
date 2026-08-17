import { fetchApi } from './client';
import { AuthResponse, CreateManagedUserPayload, LoginPayload, ManagedUser, RegisterPayload, UserProfile } from '@/types/auth';

export const authApi = {
  login: async (payload: LoginPayload): Promise<AuthResponse> => {
    return fetchApi<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  register: async (payload: RegisterPayload): Promise<AuthResponse> => {
    return fetchApi<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  getProfile: async (): Promise<UserProfile> => {
    const res = await fetchApi<{ user?: UserProfile } & UserProfile>('/auth/profile', {
      method: 'GET',
    });
    return res.user || res;
  },

  sendEmailOtp: async (email: string) => {
    return fetchApi<{ message: string; devOtp?: string }>('/auth/send-otp', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  },

  verifyEmailOtp: async (email: string, otp: string) => {
    return fetchApi<{ message: string }>('/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ email, otp }),
    });
  },

  sendForgotPasswordOtp: async (email: string) => {
    return fetchApi<{ message: string; devOtp?: string }>('/auth/forgot-password/send-otp', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  },

  verifyForgotPasswordOtp: async (email: string, otp: string) => {
    return fetchApi<{ message: string }>('/auth/forgot-password/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ email, otp }),
    });
  },

  resetPasswordWithOtp: async (email: string, newPassword: string) => {
    return fetchApi<{ message: string }>('/auth/forgot-password/reset-password', {
      method: 'POST',
      body: JSON.stringify({ email, newPassword }),
    });
  },

  // Staff sub-accounts. The `:adminUid` URL segment is accepted by the backend for REST shape but
  // not actually used for scoping (it derives the admin from the auth token instead) — the caller's
  // own id is passed for semantic correctness.
  getManagedUsers: async (adminUid: string): Promise<ManagedUser[]> => {
    return fetchApi<ManagedUser[]>(`/auth/managed-users/${adminUid}`);
  },

  createManagedUser: async (adminUid: string, payload: CreateManagedUserPayload): Promise<ManagedUser> => {
    return fetchApi<ManagedUser>(`/auth/managed-users/${adminUid}`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  /**
   * Full-roster replace: present entries are upserted, anything omitted is deleted. This is the
   * backend's only endpoint for editing or removing an individual staff member (there's no single
   * PUT/DELETE managed-user route) — the caller sends the whole desired list back.
   */
  syncManagedUsers: async (adminUid: string, users: (ManagedUser | CreateManagedUserPayload)[]): Promise<ManagedUser[]> => {
    return fetchApi<ManagedUser[]>(`/auth/managed-users/${adminUid}/bulk`, {
      method: 'POST',
      body: JSON.stringify({ users }),
    });
  },
};
