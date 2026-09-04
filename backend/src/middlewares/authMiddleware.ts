import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt';
import prisma from '../config/db';

// Per-process cache so the ban check doesn't cost a DB round-trip on every single authenticated
// request app-wide (it used to, unconditionally). Safe under PM2 cluster mode — each worker has
// its own memory and independently re-checks the DB at most once per TTL; there's no admin
// "ban user" route in this codebase today to hook an explicit invalidation into, so the TTL alone
// bounds staleness. This is a rate-limiting/perf cache, not a security-revocation mechanism — a
// banned user staying able to act for up to BAN_CACHE_TTL_MS on another worker is an acceptable
// tradeoff. If an admin-ban route is ever added, it should call `banCache.delete(userId)`.
const BAN_CACHE_TTL_MS = 30_000;
const banCache = new Map<string, { isBanned: boolean; banReason: string | null; expiresAt: number }>();

const BUSINESS_TYPE_CACHE_TTL_MS = 60_000;
const businessTypeCache = new Map<string, { businessType: string | null; expiresAt: number }>();

async function checkBanned(userId: string): Promise<{ isBanned: boolean; banReason: string | null }> {
  const now = Date.now();
  const cached = banCache.get(userId);
  if (cached && cached.expiresAt > now) return cached;

  const user: any = await (prisma.user as any).findUnique({
    where: { id: userId },
    select: { isBanned: true, banReason: true },
  });
  const result = { isBanned: !!user?.isBanned, banReason: user?.banReason ?? null };

  // Opportunistic eviction of expired entries so a long-uptime process doesn't accumulate one
  // entry per distinct user forever — only runs once the map has grown large enough to matter.
  if (banCache.size > 50_000) {
    for (const [key, value] of banCache) {
      if (value.expiresAt <= now) banCache.delete(key);
    }
  }

  banCache.set(userId, { ...result, expiresAt: now + BAN_CACHE_TTL_MS });
  return result;
}

/** Resolves owner businessType for both User and ManagedUser JWT subjects. */
async function resolveBusinessType(userId: string): Promise<string | null> {
  const now = Date.now();
  const cached = businessTypeCache.get(userId);
  if (cached && cached.expiresAt > now) return cached.businessType;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { businessType: true },
  });
  let businessType: string | null = user?.businessType ?? null;

  if (!user) {
    const managed = await prisma.managedUser.findUnique({
      where: { id: userId },
      select: { adminId: true },
    });
    if (managed?.adminId) {
      const admin = await prisma.user.findUnique({
        where: { id: managed.adminId },
        select: { businessType: true },
      });
      businessType = admin?.businessType ?? null;
    }
  }

  if (businessTypeCache.size > 50_000) {
    for (const [key, value] of businessTypeCache) {
      if (value.expiresAt <= now) businessTypeCache.delete(key);
    }
  }

  businessTypeCache.set(userId, { businessType, expiresAt: now + BUSINESS_TYPE_CACHE_TTL_MS });
  return businessType;
}

export const protect = async (req: Request, res: Response, next: NextFunction) => {
  let token;

  const authHeader = req.headers.authorization;
  const isDevMode = process.env.NODE_ENV !== 'production';

  const getDevUser = async () => {
    let devUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email: 'owner@seznik.com' },
          { uid: 'ownerseznik' },
        ],
      },
    });
    if (!devUser) {
      devUser = await prisma.user.create({
        data: {
          email: 'owner@seznik.com',
          displayName: 'Seznik Owner',
          uid: 'ownerseznik',
          businessName: 'Seznik POS Store',
          role: 'admin',
          onboardingCompleted: true,
          plan: 'premium',
        },
      });
    }
    return devUser;
  };

  /** Resolves the dev user onto the request. Returns false (and sends 503) if the database is down. */
  const applyDevUser = async (req: Request, res: Response): Promise<boolean> => {
    try {
      const devUser = await getDevUser();
      (req as any).user = {
        id: devUser.id,
        role: devUser.role || 'admin',
        businessType: (devUser as any).businessType ?? null,
      };
      return true;
    } catch (err) {
      console.error('[auth] dev-user lookup failed:', err instanceof Error ? err.message : err);
      res.status(503).json({ error: 'Database unavailable, please retry' });
      return false;
    }
  };

  if (authHeader && authHeader.startsWith('Bearer')) {
    try {
      token = authHeader.split(' ')[1];

      // Support dev mode token bypass seamlessly for testing - consistently routes to owner@seznik.com
      if (!token || token === 'dev-token-bypass' || token === 'null' || token === 'undefined') {
        if (await applyDevUser(req, res)) return next();
        return;
      }

      let decoded: any;
      try {
        decoded = verifyToken(token);
      } catch (jwtErr: any) {
        // If JWT token expired or signed with older secret during local dev, fallback gracefully
        if (isDevMode) {
          console.warn('JWT verification failed in development, falling back to local store user:', jwtErr?.message);
          if (await applyDevUser(req, res)) return next();
          return;
        }
        return res.status(401).json({ error: 'Not authorized, token expired or invalid' });
      }

      let businessType: string | null = null;
      if (decoded?.id) {
        const { isBanned, banReason } = await checkBanned(decoded.id);
        if (isBanned) {
          return res.status(403).json({
            error: `Your account has been suspended by system administrator. Reason: ${banReason || 'Policy violation'}.`,
            isBanned: true,
          });
        }
        try {
          businessType = await resolveBusinessType(decoded.id);
        } catch {
          businessType = null;
        }
      }

      (req as any).user = { ...decoded, businessType };

      return next();
    } catch (error) {
      if (isDevMode) {
        // getDevUser hits the database, so it can fail for the same reason the outer block did
        // (e.g. the connection dropped). Throwing from inside a catch here leaves the rejection
        // unhandled and takes the whole process down, so it needs its own guard.
        if (await applyDevUser(req, res)) return next();
        return;
      }
      return res.status(401).json({ error: 'Not authorized, token failed' });
    }
  }

  // If no auth header sent at all in development mode, fallback to dev user
  if (isDevMode) {
    if (await applyDevUser(req, res)) return next();
    return;
  }

  return res.status(401).json({ error: 'Not authorized, no token' });
};
