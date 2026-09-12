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
]

export const normalizePermissions = (
  raw: Partial<UserPermissions> | null | undefined,
  role: UserRole | null | undefined = 'agent'
): UserPermissions => {
  const defaults = role === 'admin' ? ADMIN_PERMISSIONS : AGENT_PERMISSIONS
  return {
    canAccessProducts: raw?.canAccessProducts ?? defaults.canAccessProducts,
    canManipulateStock: raw?.canManipulateStock ?? defaults.canManipulateStock,
    canAccessSuppliers: raw?.canAccessSuppliers ?? defaults.canAccessSuppliers,
    canAccessPurchases: raw?.canAccessPurchases ?? defaults.canAccessPurchases,
    canAccessExpenses: raw?.canAccessExpenses ?? defaults.canAccessExpenses,
    canAccessSales: raw?.canAccessSales ?? defaults.canAccessSales,
    canAccessCustomers: raw?.canAccessCustomers ?? defaults.canAccessCustomers,
    canAccessReports: raw?.canAccessReports ?? defaults.canAccessReports,
    canAccessSettings: raw?.canAccessSettings ?? defaults.canAccessSettings,
    canManageUsers: raw?.canManageUsers ?? defaults.canManageUsers,
  }
}

export const resolveUserPermissions = (profile: UserProfile | null | undefined): UserPermissions | null => {
  if (!profile) return null
  if (profile.role === 'admin') return ADMIN_PERMISSIONS
  return normalizePermissions(profile.permissions, profile.role || 'agent')
}

export const hasPermission = (
  permissions: UserPermissions | undefined | null,
  permission: keyof UserPermissions
): boolean => {
  if (!permissions) return false
  return permissions[permission] === true
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
