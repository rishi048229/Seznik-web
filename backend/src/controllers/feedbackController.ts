import { Request, Response } from 'express';
import prisma from '../config/db';

const VALID_AREAS = ['general', 'dashboard', 'pos', 'products', 'categories', 'customers', 'suppliers', 'sales', 'purchases', 'expenses', 'credits', 'reports', 'printers', 'settings', 'other'];

export const createFeedback = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { area, rating, message } = req.body;

    if (!message || !String(message).trim()) {
      return res.status(400).json({ error: 'Please write your feedback before submitting' });
    }
    const normalizedArea = VALID_AREAS.includes(String(area)) ? String(area) : 'general';
    let normalizedRating: number | null = null;
    if (rating !== undefined && rating !== null && rating !== '') {
      const r = Number(rating);
      if (!Number.isInteger(r) || r < 1 || r > 5) {
        return res.status(400).json({ error: 'Rating must be between 1 and 5' });
      }
      normalizedRating = r;
    }

    const feedback = await prisma.feedback.create({
      data: {
        area: normalizedArea,
        rating: normalizedRating,
        message: String(message).trim().slice(0, 2000),
        userId,
      },
    });
    res.status(201).json(feedback);
  } catch (error) {
    console.error('createFeedback error:', error);
    res.status(500).json({ error: 'Failed to submit feedback' });
  }
};

export const getMyFeedback = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const feedbacks = await prisma.feedback.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    res.json(feedbacks);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch feedback' });
  }
};
