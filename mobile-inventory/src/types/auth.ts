export interface UserPermissions {
  canManipulateStock?: boolean;
  canAccessSuppliers?: boolean;
  canAccessPurchases?: boolean;
  canAccessExpenses?: boolean;
  canAccessReports?: boolean;
  canManageUsers?: boolean;
  canAccessKOT?: boolean;
  [key: string]: boolean | undefined;
}

export type BusinessType = 'restaurant_cafe' | 'online_store' | 'retail_shop';

export interface UserProfile {
  id: string;
  email: string;
  displayName?: string | null;
  businessName?: string | null;
  businessType?: BusinessType | null;
  phone?: string | null;
  role: 'admin' | 'agent' | string;
  onboardingCompleted?: boolean;
  seznikUser?: boolean;
  accountType?: 'user' | 'managed';
  permissions?: UserPermissions | null;
}

export interface CompleteOnboardingPayload {
  businessName: string;
  businessType: BusinessType;
  phone: string;
  businessAddress: string;
  businessLogoURL?: string | null;
  upiId: string;
}

export interface AuthResponse {
  token: string;
  user: UserProfile;
}

export interface LoginPayload {
  email: string;
  password?: string;
}

/** A staff sub-account created by an admin — serializeManagedUser's shape in authController.ts. */
export interface ManagedUser {
  uid: string;
  displayName?: string | null;
  email?: string | null;
  role: 'admin' | 'agent' | string;
  permissions?: UserPermissions | null;
  photoURL?: string | null;
  businessName?: string | null;
  plan?: string;
  createdAt?: string;
}

export interface CreateManagedUserPayload {
  uid?: string;
  displayName: string;
  email?: string;
  /** Required on create — the backend rejects a missing password. Omitted on edit (sync) calls. */
  password: string;
  role?: 'admin' | 'agent';
  permissions?: UserPermissions;
  photoURL?: string;
  businessName?: string;
  plan?: string;
}

export interface RegisterPayload {
  email: string;
  password?: string;
  phone: string;
  displayName?: string;
  registrationSource?: 'web' | 'mobile';
  hasSeznikPrinter?: boolean;
  accessCode?: string;
}

export interface QrLoginSession {
  sessionId: string;
  qrPayload: string;
  expiresAt: string;
  expiresInSeconds: number;
}

export type QrLoginStatus = 'pending' | 'consumed' | 'expired';
