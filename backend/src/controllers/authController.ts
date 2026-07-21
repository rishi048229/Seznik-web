import { Request, Response } from 'express';
import prisma from '../config/db';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const generateToken = (id: string, role: string) => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET || 'fallback_secret', {
    expiresIn: '30d',
  });
};

export const register = async (req: Request, res: Response) => {
  try {
    const { email, password, displayName } = req.body;

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        displayName,
        uid: email, // temporary uid until firebase is fully removed
      },
    });

    const token = generateToken(user.id, user.role || 'admin');

    res.status(201).json({
      user: { id: user.id, email: user.email, displayName: user.displayName, role: user.role },
      token,
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error during registration' });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.password) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const token = generateToken(user.id, user.role || 'admin');

    res.json({
      user: { id: user.id, email: user.email, displayName: user.displayName, role: user.role },
      token,
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error during login' });
  }
};

export const socialLogin = async (req: Request, res: Response) => {
  try {
    const { email, uid, displayName } = req.body;
    
    let user = await prisma.user.findFirst({ where: { email } });
    
    if (!user) {
      user = await prisma.user.create({
        data: {
          email,
          uid,
          displayName,
          role: 'admin',
        },
      });
    }

    const token = generateToken(user.id, user.role || 'admin');
    res.json({
      user: { id: user.id, email: user.email, displayName: user.displayName, role: user.role },
      token,
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error during social login' });
  }
};

export const getProfile = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    // Remove password before sending
    const { password, ...userWithoutPassword } = user;
    res.json(userWithoutPassword);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

export const setRole = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { role } = req.body;
    
    const user = await prisma.user.update({
      where: { id: userId },
      data: { role },
    });
    
    const { password, ...userWithoutPassword } = user;
    res.json(userWithoutPassword);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

export const completeOnboarding = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { businessName } = req.body;

    const user = await prisma.user.update({
      where: { id: userId },
      data: { businessName, onboardingCompleted: true },
    });

    const { password, ...userWithoutPassword } = user;
    res.json(userWithoutPassword);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

// ── Managed users (sub-accounts an admin configures) ────────────────────────
// The frontend keeps the full list in state and persists it; these endpoints
// back that with the ManagedUser table. Data always belongs to the admin, so
// managed users are configuration only (role + permission flags + password).

const serializeManagedUser = (m: any) => ({
  uid: m.uid,
  displayName: m.displayName,
  email: m.email,
  role: m.role,
  permissions: m.permissions,
  photoURL: m.photoURL,
  businessName: m.businessName,
  plan: m.plan,
  createdAt: m.createdAt,
});

export const getManagedUsers = async (req: Request, res: Response) => {
  try {
    const adminId = (req as any).user.id;
    const managed = await prisma.managedUser.findMany({
      where: { adminId },
      orderBy: { createdAt: 'asc' },
    });
    res.json(managed.map(serializeManagedUser));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch managed users' });
  }
};

export const createManagedUser = async (req: Request, res: Response) => {
  try {
    const adminId = (req as any).user.id;
    const { uid, displayName, email, role, permissions, password, photoURL, businessName, plan } = req.body;

    if (!displayName || !password) {
      return res.status(400).json({ error: 'Name and password are required' });
    }

    const hashedPassword = await bcrypt.hash(password, await bcrypt.genSalt(10));

    const managed = await prisma.managedUser.create({
      data: {
        uid: uid || `user_${Date.now()}`,
        displayName,
        email: email || null,
        role: role || 'agent',
        permissions: permissions ?? undefined,
        password: hashedPassword,
        photoURL: photoURL || null,
        businessName: businessName || '',
        plan: plan || 'free',
        adminId,
      },
    });

    res.status(201).json(serializeManagedUser(managed));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create managed user' });
  }
};

// Bulk sync: the request body is the full desired list of managed users.
// Users present are upserted; users absent are deleted. Passwords are only
// (re)hashed when a plaintext password is included for that user.
export const syncManagedUsers = async (req: Request, res: Response) => {
  try {
    const adminId = (req as any).user.id;
    const incoming: any[] = req.body.users ?? [];

    const existing = await prisma.managedUser.findMany({ where: { adminId } });
    const incomingUids = new Set(incoming.map(u => u.uid));

    // Delete users no longer in the list.
    const toDelete = existing.filter(e => !incomingUids.has(e.uid));
    if (toDelete.length > 0) {
      await prisma.managedUser.deleteMany({
        where: { adminId, uid: { in: toDelete.map(e => e.uid) } },
      });
    }

    // Upsert everyone in the incoming list.
    for (const u of incoming) {
      const existingUser = existing.find(e => e.uid === u.uid);
      const data: any = {
        displayName: u.displayName,
        email: u.email || null,
        role: u.role || 'agent',
        permissions: u.permissions ?? undefined,
        photoURL: u.photoURL || null,
        businessName: u.businessName || '',
        plan: u.plan || 'free',
      };
      if (u.password) {
        data.password = await bcrypt.hash(u.password, await bcrypt.genSalt(10));
      }

      if (existingUser) {
        await prisma.managedUser.update({ where: { uid: u.uid }, data });
      } else {
        await prisma.managedUser.create({
          data: {
            uid: u.uid || `user_${Date.now()}`,
            ...data,
            password: data.password || (await bcrypt.hash('password123', await bcrypt.genSalt(10))),
            adminId,
          },
        });
      }
    }

    const updated = await prisma.managedUser.findMany({
      where: { adminId },
      orderBy: { createdAt: 'asc' },
    });
    res.json(updated.map(serializeManagedUser));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to sync managed users' });
  }
};
