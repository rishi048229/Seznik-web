import { ADMIN_PERMISSIONS, AGENT_PERMISSIONS, type UserPermissions, type UserProfile, type UserRole } from '@/types/auth.types'

export const PERMISSION_KEYS: (keyof UserPermissions)[] = [
  'canAccessProducts',
  'canManipulateStock',
  'canAccessSales',
  'canAccessCustomers',
  'canAccessSuppliers',
  'canAccessPurchases',
  'canAccessExpenses',
  'canAccessReports',
  'canAccessSettings',
  'canManageUsers',
  'canAccessKOT',
  'canSendRemotePrint',
]

const parsePermissionsSource = (raw: unknown): Partial<UserPermissions> => {
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Partial<UserPermissions>
      }
    } catch {
      return {}
    }
  }
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Partial<UserPermissions>
  }
  return {}
}

export const normalizePermissions = (
  raw: Partial<UserPermissions> | null | undefined | unknown,
  role: UserRole | null | undefined = 'agent'
): UserPermissions => {
  const defaults = role === 'admin' ? ADMIN_PERMISSIONS : AGENT_PERMISSIONS
  const src = parsePermissionsSource(raw)
  const result: UserPermissions = { ...defaults }
  for (const key of PERMISSION_KEYS) {
    if (typeof src[key] === 'boolean') {
      result[key] = src[key] as boolean
    }
  }
  if (typeof src.canAccessKOT !== 'boolean' && typeof src.canAccessSales === 'boolean') {
    result.canAccessKOT = src.canAccessSales
  }
  if (typeof src.canSendRemotePrint !== 'boolean' && typeof src.canAccessSales === 'boolean') {
    result.canSendRemotePrint = src.canAccessSales
  }
  return result
}

export const resolveUserPermissions = (profile: UserProfile | null | undefined): UserPermissions | null => {
  if (!profile) return null
  if (profile.role === 'admin' && profile.accountType !== 'managed') return ADMIN_PERMISSIONS
  return normalizePermissions(profile.permissions, profile.role || 'agent')
}

export const hasPermission = (
  permissions: UserPermissions | undefined | null,
  permission: keyof UserPermissions
): boolean => {
  if (!permissions) return false
  if (typeof permissions[permission] === 'boolean') return permissions[permission] === true
  if (permission === 'canAccessKOT' || permission === 'canSendRemotePrint') {
    return permissions.canAccessSales === true
  }
  return false
}

export const hasAnyPermission = (
  permissions: UserPermissions | undefined | null,
  keys: (keyof UserPermissions)[]
): boolean => keys.some(key => hasPermission(permissions, key))

export const canAccessProducts = (permissions: UserPermissions | undefined): boolean => {
  return hasPermission(permissions, 'canAccessProducts')
}

export const canManipulateStock = (permissions: UserPermissions | undefined): boolean => {
  return hasPermission(permissions, 'canManipulateStock')
}

export const canAccessSuppliers = (permissions: UserPermissions | undefined): boolean => {
  return hasPermission(permissions, 'canAccessSuppliers')
}

export const canAccessPurchases = (permissions: UserPermissions | undefined): boolean => {
  return hasPermission(permissions, 'canAccessPurchases')
}

export const canAccessExpenses = (permissions: UserPermissions | undefined): boolean => {
  return hasPermission(permissions, 'canAccessExpenses')
}

export const canAccessSales = (permissions: UserPermissions | undefined): boolean => {
  return hasPermission(permissions, 'canAccessSales')
}

export const canAccessCustomers = (permissions: UserPermissions | undefined): boolean => {
  return hasPermission(permissions, 'canAccessCustomers')
}

export const canAccessReports = (permissions: UserPermissions | undefined): boolean => {
  return hasPermission(permissions, 'canAccessReports')
}

export const canAccessSettings = (permissions: UserPermissions | undefined): boolean => {
  return hasPermission(permissions, 'canAccessSettings')
}

export const canManageUsers = (permissions: UserPermissions | undefined): boolean => {
  return hasPermission(permissions, 'canManageUsers')
}
