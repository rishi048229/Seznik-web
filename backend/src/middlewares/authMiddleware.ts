import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt';
import prisma from '../config/db';

export const protect = async (req: Request, res: Response, next: NextFunction) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];

      // Support dev mode token bypass seamlessly for testing
      if (token === 'dev-token-bypass') {
        let devUser = await prisma.user.findFirst();
        if (!devUser) {
          devUser = await prisma.user.create({
            data: {
              email: 'admin@seznik.com',
              displayName: 'Seznik Admin',
              uid: 'dev-admin-uid',
              role: 'admin',
              onboardingCompleted: true,
            },
          });
        }
        (req as any).user = { id: devUser.id, role: devUser.role || 'admin' };
        return next();
      }

      const decoded = verifyToken(token);
      (req as any).user = decoded;
      return next();
    } catch (error) {
      return res.status(401).json({ error: 'Not authorized, token failed' });
    }
  }

  return res.status(401).json({ error: 'Not authorized, no token' });
};

