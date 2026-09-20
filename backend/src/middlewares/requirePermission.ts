import { Request, Response, NextFunction } from 'express';
import type { PermissionKey } from '../utils/ownerUser';

/** Admins pass. Agents need at least one of the listed flags. */
export const requirePermission = (...keys: PermissionKey[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ error: 'Not authorized' });
    }
    if (user.role === 'admin') {
      return next();
    }

    const permissions = user.permissions || {};
    if (keys.some((key) => permissions[key] === true)) {
      return next();
    }

    return res.status(403).json({ error: 'You do not have permission to perform this action' });
  };
};
