import { fetchApi, setAuthToken, removeAuthToken } from './api'
import type { UserProfile, UserRole, UserPermissions } from '@/types/auth.types'

export interface AuthResponse {
  token: string
  user: UserProfile
  [key: string]: unknown
}

const withStableIds = (data: AuthResponse): AuthResponse => {
  if (!data?.user) return data
  const id = data.user.id || data.user.uid
  return {
    ...data,
    user: {
      ...data.user,
      id,
      uid: id,
    },
  }
}

export const loginUser = async (email: string, pass: string): Promise<AuthResponse> => {
  const data = await fetchApi('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password: pass }),
  })
  setAuthToken(data.token)
  return withStableIds(data)
}

export const registerUser = async (email: string, pass: string, firstName: string, lastName: string, phone: string): Promise<AuthResponse> => {
  const displayName = `${firstName} ${lastName}`.trim();
  const data = await fetchApi('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password: pass, displayName, phone }),
  })
  setAuthToken(data.token)
  return withStableIds(data)
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
    // Prefer the DB primary key for app identity. Spreading first then setting
    // uid/id prevents a legacy Firebase `uid` field from overwriting it.
    const id = user.id || user.uid
    return {
      ...user,
      id,
      uid: id,
    } as UserProfile
  } catch {
    return null
  }
}

/** Admin account id used for managed-user (agent) API paths. */
export const getAdminAccountId = (user: { id?: string; uid?: string } | null | undefined): string =>
  user?.id || user?.uid || ''


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
  return data as UserProfile[]
}

export const saveManagedUser = async (
  adminUid: string,
  user: UserProfile & { password?: string }
): Promise<UserProfile> => {
  const created = await fetchApi(`/auth/managed-users/${adminUid}`, {
    method: 'POST',
    body: JSON.stringify(user),
  })
  return created as UserProfile
}

export const updateManagedUserProfile = async (
  adminUid: string,
  uid: string,
  patch: Partial<UserProfile>
): Promise<UserProfile> => {
  const updated = await fetchApi(`/auth/managed-users/${adminUid}/${uid}`, {
    method: 'PUT',
    body: JSON.stringify(patch),
  })
  return updated as UserProfile
}

export const deleteManagedUser = async (
  adminUid: string,
  uid: string
): Promise<void> => {
  await fetchApi(`/auth/managed-users/${adminUid}/${uid}`, {
    method: 'DELETE',
  })
}

export const saveManagedUsers = async (
  adminUid: string,
  users: UserProfile[]
): Promise<UserProfile[]> => {
  const data = await fetchApi(`/auth/managed-users/${adminUid}/bulk`, {
    method: 'POST',
    body: JSON.stringify({ users }),
  })
  return data as UserProfile[]
}
