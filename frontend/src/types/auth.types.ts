

export type UserRole = 'admin' | 'agent'

export interface UserPermissions {
  canAccessProducts: boolean
  canManipulateStock: boolean
  canAccessSuppliers: boolean
  canAccessPurchases: boolean
  canAccessExpenses: boolean
  canAccessSales: boolean
  canAccessCustomers: boolean
  canAccessReports: boolean
  canAccessSettings: boolean
  canManageUsers: boolean
}

export const ADMIN_PERMISSIONS: UserPermissions = {
  canAccessProducts: true,
  canManipulateStock: true,
  canAccessSuppliers: true,
  canAccessPurchases: true,
  canAccessExpenses: true,
  canAccessSales: true,
  canAccessCustomers: true,
  canAccessReports: true,
  canAccessSettings: true,
  canManageUsers: true,
}

export const AGENT_PERMISSIONS: UserPermissions = {
  canAccessProducts: true,
  canManipulateStock: false,
  canAccessSuppliers: false,
  canAccessPurchases: false,
  canAccessExpenses: false,
  canAccessSales: true,
  canAccessCustomers: true,
  canAccessReports: false,
  canAccessSettings: true,
  canManageUsers: false,
}

export interface UserProfile {
  uid: string
  email: string | null
  emailVerified?: boolean
  phone?: string | null
  displayName: string | null
  photoURL: string | null
  businessName: string
  plan: 'free' | 'pro'
  createdAt: Date
  onboardingCompleted?: boolean
  role?: UserRole | null
  permissions?: UserPermissions
}
