import { Request, Response } from 'express';
import prisma from '../config/db';
import { getOwnerUserId } from '../utils/getOwnerUserId';
import { mergeReceiptConfig, type ReceiptConfigLike } from '../utils/mergeReceiptConfig';
import { enrichSettingsWithUserProfile } from '../utils/enrichSettingsProfile';

const USER_PROFILE_SELECT = {
  businessName: true,
  displayName: true,
  phone: true,
} as const;

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

async function loadEnrichedSettings(userId: string) {
  const [settings, user] = await Promise.all([
    prisma.settings.findUnique({ where: { userId } }),
    prisma.user.findUnique({ where: { id: userId }, select: USER_PROFILE_SELECT }),
  ]);
  if (!settings || !user) return settings;
  return enrichSettingsWithUserProfile(settings, user);
}

function businessFieldsFromReceipt(receipt: ReceiptConfigLike): Record<string, string> {
  const sync: Record<string, string> = {};
  const companyName = str(receipt.companyName);
  const address = str(receipt.address);
  const phone = str(receipt.phone);
  const gstin = str(receipt.gstin);
  const logoURL = str(receipt.logoURL);
  const upiId = str(receipt.upiId);
  if (companyName) sync.businessName = companyName;
  if (address) sync.businessAddress = address;
  if (phone) sync.businessPhone = phone;
  if (gstin) sync.businessGSTIN = gstin;
  if (logoURL) sync.businessLogoURL = logoURL;
  if (upiId) sync.upiId = upiId;
  return sync;
}

export const getSettings = async (req: Request, res: Response) => {
  try {
    const rawUserId = (req as any).user.id;
    const userId = await getOwnerUserId(rawUserId);
    res.json(await loadEnrichedSettings(userId));
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
  'upiId',
  'personalInfo',
  'invoiceConfig',
  'notificationConfig',
  'receiptConfig',
  'printerConfig',
  'labelConfig',
  'locationConfig',
  'kotConfig',
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
    res.status(201).json((await loadEnrichedSettings(userId)) ?? settings);
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
    res.json((await loadEnrichedSettings(userId)) ?? settings);
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

export const updateReceiptConfig = async (req: Request, res: Response) => {
  try {
    const rawUserId = (req as any).user.id;
    const userId = await getOwnerUserId(rawUserId);
    const patch = (req.body?.receiptConfig ?? req.body) as ReceiptConfigLike;

    const current = await prisma.settings.findUnique({ where: { userId } });
    const existing = (current?.receiptConfig ?? {}) as ReceiptConfigLike;
    const merged = mergeReceiptConfig(existing, patch);

    const upiRaw = typeof patch.upiId === 'string' ? patch.upiId.trim() : undefined;
    const updateData: { receiptConfig: any; upiId?: string | null } = { receiptConfig: merged as any };
    const createData: { userId: string; receiptConfig: any; upiId?: string | null } = {
      userId,
      receiptConfig: merged as any,
    };
    if (upiRaw !== undefined) {
      updateData.upiId = upiRaw || null;
      createData.upiId = upiRaw || null;
    }

    const businessSync = businessFieldsFromReceipt(merged);
    const updatePayload = { ...updateData, ...businessSync };
    const createPayload = { ...createData, ...businessSync };

    const settings = await prisma.settings.upsert({
      where: { userId },
      update: updatePayload,
      create: createPayload,
    });
    res.json((await loadEnrichedSettings(userId)) ?? settings);
  } catch (error) {
    console.error('Failed to update receipt config:', error);
    const detail = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: `Failed to update receipt config: ${detail}` });
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

