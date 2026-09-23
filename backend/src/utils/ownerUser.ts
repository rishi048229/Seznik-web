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
  'canAccessKOT',
  'canSendRemotePrint',
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
  canAccessKOT: true,
  canSendRemotePrint: true,
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
  canAccessKOT: false,
  canSendRemotePrint: true,
};

export function parsePermissionsSource(raw: unknown): Record<string, unknown> {
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return {};
    }
  }
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  return {};
}

export function normalizePermissions(raw: unknown, role?: string | null): UserPermissions {
  const defaults = role === 'admin' ? ADMIN_PERMISSIONS : AGENT_PERMISSION_DEFAULTS;
  const src = parsePermissionsSource(raw);
  const result = { ...defaults };
  for (const key of PERMISSION_KEYS) {
    if (typeof src[key] === 'boolean') {
      result[key] = src[key] as boolean;
    }
  }
  if (typeof src.canAccessKOT !== 'boolean' && typeof src.canAccessSales === 'boolean') {
    result.canAccessKOT = src.canAccessSales as boolean;
  }
  if (typeof src.canSendRemotePrint !== 'boolean' && typeof src.canAccessSales === 'boolean') {
    result.canSendRemotePrint = src.canAccessSales as boolean;
  }
  return result;
}

export { getOwnerUserId } from './getOwnerUserId';

/** Store-owner userId. Auth middleware attaches this as req.user.ownerId. */
export function getTenantUserId(req: Request): string {
  const user = (req as any).user;
  if (!user) return '';
  return user.ownerId || user.id;
}

export async function resolveActor(rawUserId: string) {
  const user =
    (await prisma.user.findUnique({ where: { id: rawUserId } })) ||
    (await prisma.user.findUnique({ where: { uid: rawUserId } }));
  if (user) {
    return {
      id: user.id,
      ownerId: user.id,
      role: user.role || 'admin',
      permissions: ADMIN_PERMISSIONS,
    };
  }

  const managedUser =
    (await prisma.managedUser.findUnique({ where: { id: rawUserId } })) ||
    (await prisma.managedUser.findUnique({ where: { uid: rawUserId } }));
  if (managedUser) {
    const owner =
      (await prisma.user.findUnique({ where: { id: managedUser.adminId }, select: { id: true } })) ||
      (await prisma.user.findUnique({ where: { uid: managedUser.adminId }, select: { id: true } }));
    return {
      id: managedUser.id,
      ownerId: owner?.id || managedUser.adminId,
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
