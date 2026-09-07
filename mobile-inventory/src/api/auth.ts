import { fetchApi } from './client';
import { AuthResponse, CompleteOnboardingPayload, CreateManagedUserPayload, LoginPayload, ManagedUser, RegisterPayload, UserProfile } from '@/types/auth';

export const authApi = {
  login: async (payload: LoginPayload): Promise<AuthResponse> => {
    return fetchApi<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  loginWithQr: async (code: string): Promise<AuthResponse> => {
    return fetchApi<AuthResponse>('/auth/qr-login', {
      method: 'POST',
      body: JSON.stringify({ code }),
    });
  },

  register: async (payload: RegisterPayload): Promise<AuthResponse> => {
    return fetchApi<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ ...payload, registrationSource: 'mobile' }),
    });
  },

  getProfile: async (): Promise<UserProfile> => {
    const res = await fetchApi<{ user?: UserProfile } & UserProfile>('/auth/profile', {
      method: 'GET',
    });
    return res.user || res;
  },

  completeOnboarding: async (payload: CompleteOnboardingPayload): Promise<UserProfile> => {
    return fetchApi<UserProfile>('/auth/onboard', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  updateBusinessType: async (businessType: CompleteOnboardingPayload['businessType']): Promise<UserProfile> => {
    return fetchApi<UserProfile>('/auth/business-type', {
      method: 'PATCH',
      body: JSON.stringify({ businessType }),
    });
  },

  sendEmailOtp: async (email: string) => {
    return fetchApi<{ message: string; devOtp?: string }>('/auth/send-otp', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  },

  verifyAccessCode: async (code: string) => {
    return fetchApi<{ valid: boolean; message?: string; error?: string; code?: string }>('/auth/verify-access-code', {
      method: 'POST',
      body: JSON.stringify({ code }),
    });
  },

  verifyEmailOtp: async (email: string, otp: string) => {
    return fetchApi<{ message: string }>('/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ email, otp }),
    });
  },

  sendPhoneOtp: async (phone: string) => {
    return fetchApi<{ message?: string; devOtp?: string }>('/auth/send-phone-otp', {
      method: 'POST',
      body: JSON.stringify({ phone }),
    });
  },

  verifyPhoneOtp: async (phone: string, otp: string) => {
    return fetchApi<{ success: boolean; message?: string }>('/auth/verify-phone-otp', {
      method: 'POST',
      body: JSON.stringify({ phone, otp }),
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
