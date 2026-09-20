import { Request } from 'express';
import prisma from '../config/db';

export const PERMISSION_KEYS = [
  'canAccessProducts',
  'canManipulateStock',
  'canAccessSuppliers',
  'canAccessPurchases',
  'canAccessExpenses',
  'canAccessSales',
  'canAccessCustomers',
  'canAccessReports',
  'canAccessSettings',
  'canManageUsers',
] as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[number];

export type UserPermissions = Record<PermissionKey, boolean>;

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
};

export const AGENT_PERMISSION_DEFAULTS: UserPermissions = {
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
};

export function normalizePermissions(raw: unknown, role?: string | null): UserPermissions {
  const defaults = role === 'admin' ? ADMIN_PERMISSIONS : AGENT_PERMISSION_DEFAULTS;
  const src = raw && typeof raw === 'object' && !Array.isArray(raw)
    ? (raw as Record<string, unknown>)
    : {};
  const result = { ...defaults };
  for (const key of PERMISSION_KEYS) {
    if (typeof src[key] === 'boolean') {
      result[key] = src[key] as boolean;
    }
  }
  return result;
}

export async function getOwnerUserId(rawUserId: string): Promise<string> {
  if (!rawUserId) return rawUserId;

  const user = await prisma.user.findUnique({
    where: { id: rawUserId },
    select: { id: true },
  });
  if (user) return user.id;

  const managedUser = await prisma.managedUser.findUnique({
    where: { id: rawUserId },
    select: { adminId: true },
  });
  if (managedUser?.adminId) return managedUser.adminId;

  return rawUserId;
}

/** Store-owner userId. Auth middleware attaches this as req.user.ownerId. */
export function getTenantUserId(req: Request): string {
  const user = (req as any).user;
  if (!user) return '';
  return user.ownerId || user.id;
}

export async function resolveActor(rawUserId: string) {
  const user = await prisma.user.findUnique({ where: { id: rawUserId } });
  if (user) {
    return {
      id: user.id,
      ownerId: user.id,
      role: user.role || 'admin',
      permissions: ADMIN_PERMISSIONS,
    };
  }

  const managedUser = await prisma.managedUser.findUnique({ where: { id: rawUserId } });
  if (managedUser) {
    return {
      id: managedUser.id,
      ownerId: managedUser.adminId,
      role: managedUser.role || 'agent',
      permissions: normalizePermissions(managedUser.permissions, managedUser.role || 'agent'),
    };
  }

  return {
    id: rawUserId,
    ownerId: rawUserId,
    role: 'agent',
    permissions: AGENT_PERMISSION_DEFAULTS,
  };
}
