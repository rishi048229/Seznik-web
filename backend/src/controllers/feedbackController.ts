import { Request, Response } from 'express';
import prisma from '../config/db';
import { normalizeFeedbackInput } from '../utils/feedbackValidation';

export const createFeedback = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const parsed = normalizeFeedbackInput(req.body);

    if (!parsed.ok) {
      return res.status(400).json({ error: parsed.error });
    }

    const feedback = await prisma.feedback.create({
      data: {
        ...parsed.data,
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
