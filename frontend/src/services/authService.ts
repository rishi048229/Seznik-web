import { fetchApi, setAuthToken, removeAuthToken } from './api'
import type { UserProfile, UserRole, UserPermissions } from '@/types/auth.types'
import { ADMIN_PERMISSIONS, AGENT_PERMISSIONS } from '@/types/auth.types'

export const loginUser = async (email: string, pass: string): Promise<any> => {
  const data = await fetchApi('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password: pass }),
  })
  setAuthToken(data.token)
  return data
}

export const registerUser = async (email: string, pass: string, firstName: string, lastName: string, phone: string): Promise<any> => {
  const displayName = `${firstName} ${lastName}`.trim();
  const data = await fetchApi('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password: pass, displayName, phone }),
  })
  setAuthToken(data.token)
  return data
}

// Pre-signup email verification
export const sendEmailOtp = async (email: string): Promise<void> => {
  await fetchApi('/auth/send-otp', {
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
      uid: user.id,
      ...user,
    } as UserProfile
  } catch (error) {
    return null
  }
}

export const setUserRoleAndProfile = async (
  uid: string,
  role: UserRole,
  name: string,
  password: string
): Promise<void> => {
  // In a real application, we would call an endpoint to update user role and managed users.
  // We need to implement this in the backend, but for now we simulate a call.
  await fetchApi('/auth/setRole', {
    method: 'POST',
    body: JSON.stringify({ uid, role, name, password }),
  })
}

export const completeOnboarding = async (
  uid: string,
  businessName: string
): Promise<void> => {
  await fetchApi('/auth/onboard', {
    method: 'POST',
    body: JSON.stringify({ uid, businessName }),
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

export const resetUserPassword = async (
  uid: string
): Promise<void> => {
  await fetchApi(`/auth/reset-password/${uid}`, {
    method: 'POST',
  })
}

export const getAllUsers = async (adminUid: string): Promise<UserProfile[]> => {
  const data = await fetchApi(`/auth/managed-users/${adminUid}`)
  return data as UserProfile[]
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
