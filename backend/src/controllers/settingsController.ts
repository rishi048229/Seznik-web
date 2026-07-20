import { Request, Response } from 'express';
import prisma from '../config/db';

export const getSettings = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    let settings = await prisma.settings.findUnique({
      where: { userId },
    });
    
    // If no settings exist yet, we could return a default object or null
    // The frontend expects null if it doesn't exist
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
};

export const createSettings = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const data = req.body;
    
    const settings = await prisma.settings.create({
      data: { ...data, userId },
    });
    res.status(201).json(settings);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create settings' });
  }
};

export const updateSettings = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { id } = req.params; // we can use id or just update based on userId
    const data = req.body;
    
    const settings = await prisma.settings.update({
      where: { userId }, // using userId as it's unique
      data,
    });
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update settings' });
  }
};

export const updateInvoiceConfig = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { invoiceConfig } = req.body;
    
    const settings = await prisma.settings.update({
      where: { userId },
      data: { invoiceConfig },
    });
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update invoice config' });
  }
};

export const updateNotificationConfig = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { notificationConfig } = req.body;
    
    const settings = await prisma.settings.update({
      where: { userId },
      data: { notificationConfig },
    });
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update notification config' });
  }
};
