import { Request, Response } from 'express';
import prisma from '../config/db';
import { getOwnerUserId } from '../utils/getOwnerUserId';

/**
 * Registers (or refreshes) THIS specific login's Expo push token for targeted delivery —
 * remote-print notifications need to reach one exact agent's phone, which the existing
 * Settings.notificationConfig.pushTokens pool (one shared array per business, strict FK to
 * User.id) cannot do: a ManagedUser login there hits a foreign key violation, and even for the
 * owner it can only ever mean "every device anyone at this business has registered."
 *
 * Deliberately additive — does not touch or replace the existing broadcast-style registration
 * endpoint (/notifications/register-token) used by low-stock/credit-due/etc. pushes.
 */
export const registerDeviceToken = async (req: Request, res: Response) => {
  try {
    const actorId = (req as any).user?.id;
    if (!actorId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const { expoPushToken, platform } = req.body as { expoPushToken?: string; platform?: string };
    if (!expoPushToken || typeof expoPushToken !== 'string') {
      return res.status(400).json({ success: false, message: 'expoPushToken is required' });
    }
    if (!(expoPushToken.startsWith('ExponentPushToken[') || expoPushToken.startsWith('ExpoPushToken['))) {
      return res.status(400).json({ success: false, message: 'expoPushToken does not look like a valid Expo push token' });
    }

    const ownerUserId = await getOwnerUserId(actorId);
    const owningUser = await prisma.user.findUnique({ where: { id: actorId }, select: { displayName: true, email: true } });
    const isManagedUser = !owningUser;
    const actorName =
      owningUser?.displayName ||
      owningUser?.email ||
      (isManagedUser
        ? (await prisma.managedUser.findUnique({ where: { id: actorId }, select: { displayName: true, email: true } }))?.displayName
        : null) ||
      'Unknown';

    await prisma.deviceToken.upsert({
      where: { expoPushToken },
      update: {
        ownerUserId,
        actorId,
        actorName,
        actorIsManagedUser: isManagedUser,
        platform: platform === 'ios' ? 'ios' : 'android',
        lastSeenAt: new Date(),
      },
      create: {
        ownerUserId,
        actorId,
        actorName,
        actorIsManagedUser: isManagedUser,
        expoPushToken,
        platform: platform === 'ios' ? 'ios' : 'android',
      },
    });

    return res.json({ success: true });
  } catch (error: any) {
    console.error('[DeviceToken] register failed:', error);
    return res.status(500).json({ success: false, message: 'Failed to register device token' });
  }
};

/** Lists every device this business owner can currently reach — used by the admin UI's target
 *  picker, and to show whether an agent has any registered device at all before sending a job. */
export const listBusinessDeviceTokens = async (req: Request, res: Response) => {
  try {
    const ownerUserId = await getOwnerUserId((req as any).user?.id);
    const tokens = await prisma.deviceToken.findMany({
      where: { ownerUserId },
      orderBy: { lastSeenAt: 'desc' },
      select: { actorId: true, actorName: true, actorIsManagedUser: true, platform: true, lastSeenAt: true },
    });
    // Collapse to one row per person — the same login can have re-registered on a new device/reinstall.
    const byActor = new Map<string, (typeof tokens)[number]>();
    for (const t of tokens) {
      if (!byActor.has(t.actorId)) byActor.set(t.actorId, t);
    }
    return res.json({ success: true, data: Array.from(byActor.values()) });
  } catch (error: any) {
    console.error('[DeviceToken] list failed:', error);
    return res.status(500).json({ success: false, message: 'Failed to list device tokens' });
  }
};
