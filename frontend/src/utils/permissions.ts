import type { UserPermissions } from '@/types/auth.types'

export const hasPermission = (
  permissions: UserPermissions | undefined,
  permission: keyof UserPermissions
): boolean => {
  if (!permissions) return false
  return permissions[permission] === true
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

export const canAccessReports = (permissions: UserPermissions | undefined): boolean => {
  return hasPermission(permissions, 'canAccessReports')
}

export const canManageUsers = (permissions: UserPermissions | undefined): boolean => {
  return hasPermission(permissions, 'canManageUsers')
}
