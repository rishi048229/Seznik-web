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
