import { fetchApi, setAuthToken, removeAuthToken } from './api'
import type { UserProfile, UserRole, UserPermissions, CompleteOnboardingPayload, BusinessType } from '@/types/auth.types'

export interface AuthResponse {
  token: string
  user: UserProfile
  [key: string]: unknown
}

export const loginUser = async (email: string, pass: string): Promise<AuthResponse> => {
  const data = await fetchApi('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password: pass }),
  })
  setAuthToken(data.token)
  return data
}

export const registerUser = async (
  email: string,
  pass: string,
  firstName: string,
  lastName: string,
  phone: string,
  hasSeznikPrinter?: boolean,
  accessCode?: string
): Promise<AuthResponse> => {
  const displayName = `${firstName} ${lastName}`.trim();
  const data = await fetchApi('/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      email,
      password: pass,
      displayName,
      phone,
      registrationSource: 'web',
      hasSeznikPrinter: Boolean(hasSeznikPrinter),
      accessCode: hasSeznikPrinter && accessCode ? accessCode.trim().toUpperCase() : undefined,
    }),
  })
  setAuthToken(data.token)
  return data
}

// Access Code verification and redemption
export const verifyAccessCode = async (
  code: string
): Promise<{ valid: boolean; message?: string; error?: string; code?: string }> => {
  return fetchApi('/auth/verify-access-code', {
    method: 'POST',
    body: JSON.stringify({ code: code.trim().toUpperCase() }),
  })
}

export const redeemAccessCode = async (
  code: string
): Promise<{ success: boolean; message: string; user: UserProfile }> => {
  return fetchApi('/auth/redeem-access-code', {
    method: 'POST',
    body: JSON.stringify({ code: code.trim().toUpperCase() }),
  })
}

// Pre-signup email verification
export const sendEmailOtp = async (email: string): Promise<{ message?: string }> => {
  return fetchApi('/auth/send-otp', {
    method: 'POST',
    body: JSON.stringify({ email }),
  })
}

export const verifyEmailOtp = async (email: string, otp: string): Promise<void> => {
  await fetchApi('/auth/verify-otp', {
    method: 'POST',
    body: JSON.stringify({ email, otp }),
  })
}

// Pre-signup phone verification (default 000000)
export const sendPhoneOtp = async (phone: string): Promise<{ devOtp?: string; message?: string }> => {
  return fetchApi('/auth/send-phone-otp', {
    method: 'POST',
    body: JSON.stringify({ phone }),
  })
}

export const verifyPhoneOtp = async (phone: string, otp: string): Promise<{ success: boolean; message?: string }> => {
  return fetchApi('/auth/verify-phone-otp', {
    method: 'POST',
    body: JSON.stringify({ phone, otp }),
  })
}

// Forgot Password Flow
export const sendForgotPasswordOtp = async (email: string): Promise<void> => {
  await fetchApi('/auth/forgot-password/send-otp', {
    method: 'POST',
    body: JSON.stringify({ email }),
  })
}

export const verifyForgotPasswordOtp = async (email: string, otp: string): Promise<void> => {
  await fetchApi('/auth/forgot-password/verify-otp', {
    method: 'POST',
    body: JSON.stringify({ email, otp }),
  })
}

export const resetPasswordWithOtp = async (email: string, newPassword: string): Promise<void> => {
  await fetchApi('/auth/forgot-password/reset-password', {
    method: 'POST',
    body: JSON.stringify({ email, newPassword }),
  })
}

export const signOutUser = async (): Promise<void> => {
  removeAuthToken()
}

export const getUserProfile = async (): Promise<UserProfile | null> => {
  try {
    const user = await fetchApi('/auth/profile')
    return {
      ...user,
      id: user.id,
      uid: user.uid || user.id,
    } as UserProfile
  } catch {
    return null
  }
}


export const setUserRoleAndProfile = async (
  uid: string,
  role: UserRole,
  name: string,
  password: string,
  agentUid?: string
): Promise<{ user?: UserProfile; token?: string }> => {
  const data = await fetchApi('/auth/setRole', {
    method: 'POST',
    body: JSON.stringify({ uid, role, name, password, agentUid }),
  })
  if (data?.token) {
    setAuthToken(data.token)
  }
  return data as { user?: UserProfile; token?: string }
}

export const completeOnboarding = async (
  payload: CompleteOnboardingPayload
): Promise<UserProfile> => {
  return fetchApi('/auth/onboard', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export const requestAgentOtp = async (email: string): Promise<{ message?: string; existingAgents?: string[] }> => {
  return fetchApi('/auth/agent/request-otp', {
    method: 'POST',
    body: JSON.stringify({ email }),
  })
}

export const verifyAgentOtp = async (email: string, otp: string, displayName: string): Promise<AuthResponse> => {
  const data = await fetchApi('/auth/agent/verify-otp', {
    method: 'POST',
    body: JSON.stringify({ email, otp, displayName }),
  })
  setAuthToken(data.token)
  return data
}

export const updateBusinessType = async (businessType: BusinessType): Promise<UserProfile> => {
  return fetchApi('/auth/business-type', {
    method: 'PATCH',
    body: JSON.stringify({ businessType }),
  })
}

export const updateUserPermissions = async (
  uid: string,
  permissions: UserPermissions
): Promise<void> => {
  await fetchApi(`/auth/permissions/${uid}`, {
    method: 'PUT',
    body: JSON.stringify({ permissions }),
  })
}

export const updateUserPassword = async (
  uid: string,
  newPassword: string
): Promise<void> => {
  await fetchApi(`/auth/password/${uid}`, {
    method: 'PUT',
    body: JSON.stringify({ password: newPassword }),
  })
}

export const updateManagedUserPasswordDirectly = async (
  adminUid: string,
  uid: string,
  newPassword: string
): Promise<void> => {
  await fetchApi(`/auth/managed-users/${adminUid}/password`, {
    method: 'POST',
    body: JSON.stringify({ uid, newPassword }),
  })
}

export const resetUserPassword = async (
  uid: string
): Promise<void> => {
  await fetchApi(`/auth/reset-password/${uid}`, {
    method: 'POST',
  })
}

export const getAllUsers = async (adminUid: string): Promise<UserProfile[]> => {
  const data = await fetchApi(`/auth/managed-users/${adminUid}`)
  if (Array.isArray(data)) return data as UserProfile[]
  if (data && typeof data === 'object' && Array.isArray((data as any).data)) {
    return (data as any).data as UserProfile[]
  }
  return []
}

export const saveManagedUser = async (
  adminUid: string,
  user: UserProfile
): Promise<void> => {
  await fetchApi(`/auth/managed-users/${adminUid}`, {
    method: 'POST',
    body: JSON.stringify(user),
  })
}

export const saveManagedUsers = async (
  adminUid: string,
  users: UserProfile[]
): Promise<void> => {
  await fetchApi(`/auth/managed-users/${adminUid}/bulk`, {
    method: 'POST',
    body: JSON.stringify({ users }),
  })
}
