import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt';
import prisma from '../config/db';

export const protect = async (req: Request, res: Response, next: NextFunction) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];

      // Support dev mode token bypass seamlessly for testing - consistently routes to owner@seznik.com
      if (token === 'dev-token-bypass') {
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
        (req as any).user = { id: devUser.id, role: devUser.role || 'admin' };
        return next();
      }

      const decoded = verifyToken(token);
      (req as any).user = decoded;

      if (decoded?.id) {
        const checkUser: any = await (prisma.user as any).findUnique({
          where: { id: decoded.id },
          select: { isBanned: true, banReason: true },
        });
        if (checkUser?.isBanned) {
          return res.status(403).json({
            error: `Your account has been suspended by system administrator. Reason: ${checkUser.banReason || 'Policy violation'}.`,
            isBanned: true,
          });
        }
      }

      return next();
    } catch (error) {
      return res.status(401).json({ error: 'Not authorized, token failed' });
    }
  }

  return res.status(401).json({ error: 'Not authorized, no token' });
};

