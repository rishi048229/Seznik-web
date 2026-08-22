import { Request, Response } from 'express';
import prisma from '../config/db';

const getOwnerUserId = async (rawUserId: string): Promise<string> => {
  if (!rawUserId) return rawUserId;

  const user = await prisma.user.findUnique({ where: { id: rawUserId } });
  if (user) return user.id;

  const managedUser = await prisma.managedUser.findUnique({ where: { id: rawUserId } });
  if (managedUser && managedUser.adminId) return managedUser.adminId;

  return rawUserId;
};

export const getSettings = async (req: Request, res: Response) => {
  try {
    const rawUserId = (req as any).user.id;
    const userId = await getOwnerUserId(rawUserId);

    let settings = await prisma.settings.findUnique({
      where: { userId },
    });
    
    res.json(settings);
  } catch (error) {
    console.error('Failed to fetch settings:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
};

const ALLOWED_SETTINGS_FIELDS = [
  'businessName',
  'businessAddress',
  'businessPhone',
  'businessGSTIN',
  'businessLogoURL',
  'personalInfo',
  'invoiceConfig',
  'notificationConfig',
  'receiptConfig',
  'printerConfig',
  // Multi-location inventory feature flag: { enabled: boolean }.
  'locationConfig',
  // Restored dev-branch column (see schema.prisma comment) — added to the
  // allowlist so it's no longer silently dropped now that the column exists.
  'labelConfig',
];

const sanitizeSettingsData = (raw: Record<string, any>): Record<string, any> => {
  const clean: Record<string, any> = {};
  for (const key of ALLOWED_SETTINGS_FIELDS) {
    if (key in raw && raw[key] !== undefined) {
      clean[key] = raw[key];
    }
  }
  return clean;
};

export const createSettings = async (req: Request, res: Response) => {
  try {
    const rawUserId = (req as any).user.id;
    const userId = await getOwnerUserId(rawUserId);
    const data = sanitizeSettingsData(req.body || {});
    
    const settings = await prisma.settings.upsert({
      where: { userId },
      update: { ...data },
      create: { ...data, userId },
    });
    res.status(201).json(settings);
  } catch (error) {
    console.error('Failed to create settings:', error);
    // Authenticated internal endpoint — surface the real error (e.g. Prisma's
    // "Unknown argument `locationConfig`" when the deployed schema/client is
    // stale) instead of a generic message that gives no diagnostic signal.
    const detail = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: `Failed to create settings: ${detail}` });
  }
};

export const updateSettings = async (req: Request, res: Response) => {
  try {
    const rawUserId = (req as any).user.id;
    const userId = await getOwnerUserId(rawUserId);
    const data = sanitizeSettingsData(req.body || {});
    
    const settings = await prisma.settings.upsert({
      where: { userId },
      update: { ...data },
      create: { ...data, userId },
    });
    res.json(settings);
  } catch (error) {
    console.error('Failed to update settings:', error);
    const detail = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: `Failed to update settings: ${detail}` });
  }
};

export const updateInvoiceConfig = async (req: Request, res: Response) => {
  try {
    const rawUserId = (req as any).user.id;
    const userId = await getOwnerUserId(rawUserId);
    const { invoiceConfig } = req.body;
    
    const settings = await prisma.settings.upsert({
      where: { userId },
      update: { invoiceConfig },
      create: { userId, invoiceConfig },
    });
    res.json(settings);
  } catch (error) {
    console.error('Failed to update invoice config:', error);
    res.status(500).json({ error: 'Failed to update invoice config' });
  }
};

export const updateNotificationConfig = async (req: Request, res: Response) => {
  try {
    const rawUserId = (req as any).user.id;
    const userId = await getOwnerUserId(rawUserId);
    const { notificationConfig } = req.body;
    
    const settings = await prisma.settings.upsert({
      where: { userId },
      update: { notificationConfig },
      create: { userId, notificationConfig },
    });
    res.json(settings);
  } catch (error) {
    console.error('Failed to update notification config:', error);
    res.status(500).json({ error: 'Failed to update notification config' });
  }
};

export const updatePrinterConfig = async (req: Request, res: Response) => {
  try {
    const rawUserId = (req as any).user.id;
    const userId = await getOwnerUserId(rawUserId);
    const { printerConfig } = req.body;

    const settings = await prisma.settings.upsert({
      where: { userId },
      update: { printerConfig },
      create: { userId, printerConfig },
    });
    res.json(settings);
  } catch (error) {
    console.error('Failed to update printer config:', error);
    res.status(500).json({ error: 'Failed to update printer config' });
  }
};

