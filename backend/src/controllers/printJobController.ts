import { Request, Response } from 'express';
import prisma from '../config/db';
import { getOwnerUserId } from '../utils/getOwnerUserId';
import { normalizePermissions } from '../utils/ownerUser';
import { sendPushToActor, sendPushToActors } from '../services/pushNotificationService';
import { debugFa19Log } from '../utils/debugFa19Log';

/** How long a job waits for an agent to accept/reject before it's treated as expired and the
 *  admin is offered reassignment (Step 6). Kept as one constant so the create-time deadline and
 *  the lazy expiry check below never drift apart. */
const RESPONSE_WINDOW_MS = 12 * 60 * 60 * 1000;

const VALID_STATUSES = [
  'queued',
  'delivered',
  'accepted',
  'rejected',
  'printer_connect_pending',
  'printing',
  'completed',
  'failed',
  'expired',
  'cancelled',
] as const;
type PrintJobStatus = (typeof VALID_STATUSES)[number];

/** Resolves the actor (User or ManagedUser) making this request, and whether they're allowed to
 *  create print jobs for the business. The business owner always can. A ManagedUser (agent/staff)
 *  can only if explicitly granted — via permissions.canSendRemotePrint, or a role the business
 *  owner has designated as admin-equivalent. Re-fetched from the DB rather than trusted from the
 *  JWT: the token only carries {id, role}, never the permissions JSON.
 *  NOTE: if this business's permission-key naming differs from `canSendRemotePrint` elsewhere in
 *  the app, this is the one place to change it. */
async function resolveSenderAuthority(
  actorId: string
): Promise<{ ok: boolean; ownerUserId: string; actorName: string } | null> {
  const user = await prisma.user.findUnique({
    where: { id: actorId },
    select: { id: true, displayName: true, email: true },
  });
  if (user) {
    return { ok: true, ownerUserId: user.id, actorName: user.displayName || user.email || 'Owner' };
  }

  const managed = await prisma.managedUser.findUnique({
    where: { id: actorId },
    select: { adminId: true, displayName: true, email: true, role: true, permissions: true },
  });
  if (!managed) return null;

  const perms = normalizePermissions(managed.permissions, managed.role);
  const ok = perms.canSendRemotePrint === true || managed.role === 'admin';
  const ownerUserId = await getOwnerUserId(managed.adminId);
  return { ok, ownerUserId, actorName: managed.displayName || managed.email || 'Staff' };
}

async function resolveActorName(actorId: string): Promise<string> {
  const user = await prisma.user.findUnique({ where: { id: actorId }, select: { displayName: true, email: true } });
  if (user) return user.displayName || user.email || 'Owner';
  const managed = await prisma.managedUser.findUnique({ where: { id: actorId }, select: { displayName: true, email: true } });
  return managed?.displayName || managed?.email || 'Agent';
}

/** Lazily flips a stale queued/delivered job to 'expired' at read time instead of a background
 *  timer — see the schema comment on PrintJob.expiresAt: PM2 cluster mode runs this process
 *  multiple times over, so a setInterval would fire redundantly on every worker. A read is the
 *  one thing guaranteed to happen exactly when someone actually needs the current status. */
async function withLazyExpiry<T extends { id: string; status: string; expiresAt: Date }>(job: T): Promise<T> {
  if ((job.status === 'queued' || job.status === 'delivered') && job.expiresAt.getTime() < Date.now()) {
    await prisma.printJob.update({ where: { id: job.id }, data: { status: 'expired' } });
    await prisma.printJobEvent.create({
      data: { printJobId: job.id, status: 'expired', note: 'No response within the time window.' },
    });
    return { ...job, status: 'expired' };
  }
  return job;
}

const jobListSelect = {
  id: true,
  saleId: true,
  requestedById: true,
  requestedByName: true,
  targetAgentId: true,
  targetAgentName: true,
  targetLocationId: true,
  targetLocationName: true,
  paperWidth: true,
  copies: true,
  status: true,
  failureReason: true,
  acceptedByAgentId: true,
  acceptedByAgentName: true,
  expiresAt: true,
  respondedAt: true,
  completedAt: true,
  createdAt: true,
  updatedAt: true,
  sale: {
    select: {
      id: true,
      invoiceNumber: true,
      grandTotal: true,
      createdAt: true,
      customer: { select: { name: true } },
    },
  },
} as const;

/** Creates a remote-print request for an existing Sale, pushes the target agent(s), and records
 *  the first audit event. Targets either one specific agent (targetAgentId) or every agent
 *  registered at a location (targetLocationId) — first-accept-wins for the latter. */
export const createPrintJob = async (req: Request, res: Response) => {
  try {
    const actorId = (req as any).user?.id;
    if (!actorId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const authority = await resolveSenderAuthority(actorId);
    if (!authority) return res.status(401).json({ success: false, message: 'Unauthorized' });
    if (!authority.ok) {
      return res.status(403).json({ success: false, message: 'You do not have permission to send remote print requests.' });
    }

    const { saleId, targetAgentId, targetLocationId, paperWidth, copies } = req.body as {
      saleId?: string;
      targetAgentId?: string;
      targetLocationId?: string;
      paperWidth?: '58mm' | '80mm';
      copies?: number;
    };

    if (!saleId) return res.status(400).json({ success: false, message: 'saleId is required' });
    if (!targetAgentId && !targetLocationId) {
      return res.status(400).json({ success: false, message: 'Either targetAgentId or targetLocationId is required' });
    }

    // Ownership check: the sale must actually belong to this admin's business, not just any sale
    // whose id happens to be guessable — this is the "authenticate every job creation" boundary.
    const sale = await prisma.sale.findFirst({
      where: { id: saleId, userId: authority.ownerUserId },
      select: { id: true, invoiceNumber: true },
    });
    if (!sale) return res.status(404).json({ success: false, message: 'Sale not found for this business.' });

    let targetAgentName: string | null = null;
    let agentIdsToNotify: string[] = [];

    if (targetAgentId) {
      const isOwner = targetAgentId === authority.ownerUserId;
      const owner = await prisma.user.findUnique({
        where: { id: authority.ownerUserId },
        select: { id: true, uid: true },
      });
      const adminIds = Array.from(new Set([authority.ownerUserId, owner?.uid].filter(Boolean))) as string[];
      const managed = isOwner
        ? null
        : await prisma.managedUser.findFirst({
            where: {
              adminId: { in: adminIds },
              OR: [{ id: targetAgentId }, { uid: targetAgentId }],
            },
          });
      if (!isOwner && !managed) {
        return res.status(404).json({ success: false, message: 'Target agent not found for this business.' });
      }
      const canonicalTargetId = isOwner ? authority.ownerUserId : managed!.id;
      targetAgentName = await resolveActorName(canonicalTargetId);
      agentIdsToNotify = [canonicalTargetId];
    }

    let targetLocationName: string | null = null;
    if (targetLocationId) {
      const location = await prisma.location.findFirst({
        where: { id: targetLocationId, userId: authority.ownerUserId },
        select: { name: true },
      });
      if (!location) return res.status(404).json({ success: false, message: 'Target location not found for this business.' });
      targetLocationName = location.name || null;
      // Everyone with a registered device at this business is a candidate; narrowing to "assigned
      // to this location" specifically depends on how staff-location assignment is modeled, which
      // wasn't found in Step 0 — for now every registered device at the business is notified when
      // a location (not a specific agent) is targeted. Tighten this once that assignment exists.
      const devices = await prisma.deviceToken.findMany({
        where: { ownerUserId: authority.ownerUserId },
        select: { actorId: true },
      });
      agentIdsToNotify = Array.from(new Set(devices.map((d) => d.actorId)));
    }

    const now = new Date();
    const job = await prisma.printJob.create({
      data: {
        userId: authority.ownerUserId,
        saleId: sale.id,
        requestedById: actorId,
        requestedByName: authority.actorName,
        targetAgentId: agentIdsToNotify[0] || targetAgentId || null,
        targetAgentName,
        targetLocationId: targetLocationId || null,
        targetLocationName,
        paperWidth: paperWidth === '58mm' ? '58mm' : '80mm',
        copies: Math.max(1, Math.min(10, Number(copies) || 1)),
        status: 'delivered',
        expiresAt: new Date(now.getTime() + RESPONSE_WINDOW_MS),
      },
      select: jobListSelect,
    });

    await prisma.printJobEvent.create({ data: { printJobId: job.id, status: 'delivered' } });

    const pushPayload = {
      title: 'New receipt to print',
      body: `Invoice ${sale.invoiceNumber} — tap to accept or decline.`,
      channelId: 'remote-print',
      data: { type: 'remote_print_job', printJobId: job.id, screen: `/print-jobs/${job.id}` },
    };
    if (agentIdsToNotify.length === 1) {
      await sendPushToActor(agentIdsToNotify[0], pushPayload);
    } else if (agentIdsToNotify.length > 1) {
      await sendPushToActors(agentIdsToNotify, pushPayload);
    }

    return res.status(201).json({ success: true, data: job });
  } catch (error: any) {
    console.error('[PrintJob] create failed:', error);
    return res.status(500).json({ success: false, message: 'Failed to create print job' });
  }
};

/** Admin-side list — every job this business has sent, most recent first, optionally filtered. */
export const listPrintJobsForAdmin = async (req: Request, res: Response) => {
  try {
    const ownerUserId = await getOwnerUserId((req as any).user?.id);
    const { status, targetAgentId, limit } = req.query as { status?: string; targetAgentId?: string; limit?: string };

    const where: any = { userId: ownerUserId };
    if (status) where.status = status;
    if (targetAgentId) {
      const managed = await prisma.managedUser.findFirst({
        where: { OR: [{ id: targetAgentId }, { uid: targetAgentId }] },
        select: { id: true, uid: true },
      });
      const ids = Array.from(new Set([targetAgentId, managed?.id, managed?.uid].filter(Boolean))) as string[];
      where.targetAgentId = { in: ids };
    }

    const jobs = await prisma.printJob.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: Math.min(500, Math.max(1, Number(limit) || 100)),
      select: jobListSelect,
    });

    const resolved = await Promise.all(jobs.map((j) => withLazyExpiry(j)));
    return res.json({ success: true, data: resolved });
  } catch (error: any) {
    console.error('[PrintJob] list failed:', error);
    return res.status(500).json({ success: false, message: 'Failed to list print jobs' });
  }
};

/** Agent-side: jobs currently addressed to me that still need action — this is what the
 *  Incoming Print Request screen opens with, and what the foreground poll fallback checks (push
 *  delivery isn't guaranteed, especially on iOS with the app fully killed — see Step 4 notes). */
export const listPendingJobsForAgent = async (req: Request, res: Response) => {
  try {
    const actorId = (req as any).user?.id;
    if (!actorId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const managed = await prisma.managedUser.findUnique({
      where: { id: actorId },
      select: { uid: true, adminId: true },
    });
    const actorIds = Array.from(new Set([actorId, managed?.uid].filter(Boolean))) as string[];

    const jobs = await prisma.printJob.findMany({
      where: {
        status: { in: ['queued', 'delivered', 'accepted', 'printer_connect_pending'] },
        OR: [{ targetAgentId: { in: actorIds } }, { targetLocationId: { not: null }, acceptedByAgentId: null }],
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: jobListSelect,
    });

    // For location-wide jobs, only surface ones this actor's business/device is actually eligible
    // for — filtered by ownerUserId matching this agent's business, since the query above can't
    // express that join directly against a plain string id.
    const ownerUserId = await getOwnerUserId(actorId);
    const eligible = jobs.filter((j) => (j.targetAgentId && actorIds.includes(j.targetAgentId)) || j.targetLocationId != null);
    const scoped = await prisma.printJob.findMany({
      where: { id: { in: eligible.map((j) => j.id) }, userId: ownerUserId },
      select: jobListSelect,
      orderBy: { createdAt: 'desc' },
    });

    const resolved = (await Promise.all(scoped.map((j) => withLazyExpiry(j)))).filter(
      (j) => j.status === 'queued' || j.status === 'delivered' || j.status === 'accepted' || j.status === 'printer_connect_pending'
    );
    return res.json({ success: true, data: resolved });
  } catch (error: any) {
    console.error('[PrintJob] list-for-agent failed:', error);
    return res.status(500).json({ success: false, message: 'Failed to list pending jobs' });
  }
};

/** Single job — polled by both sides for live status without a manual refresh. */
export const getPrintJob = async (req: Request, res: Response) => {
  try {
    const ownerUserId = await getOwnerUserId((req as any).user?.id);
    const job = await prisma.printJob.findFirst({
      where: { id: String(req.params.id), userId: ownerUserId },
      select: { ...jobListSelect, events: { orderBy: { createdAt: 'asc' } } },
    });
    if (!job) return res.status(404).json({ success: false, message: 'Print job not found' });
    const resolved = await withLazyExpiry(job);
    return res.json({ success: true, data: resolved });
  } catch (error: any) {
    console.error('[PrintJob] get failed:', error);
    return res.status(500).json({ success: false, message: 'Failed to load print job' });
  }
};

/** Agent-side status transitions: accept, reject, printer_connect_pending, printing, completed,
 *  failed. Every transition is authenticated against the job's own target — an agent can only
 *  move a job that was actually addressed to them (or, for a location-wide job, the first agent
 *  to accept becomes the owner of every subsequent transition on it). */
export const updatePrintJobStatus = async (req: Request, res: Response) => {
  try {
    const actorId = (req as any).user?.id;
    if (!actorId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const { status, failureReason } = req.body as { status?: PrintJobStatus; failureReason?: string };
    if (!status || !VALID_STATUSES.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const job = await prisma.printJob.findUnique({ where: { id: String(req.params.id) } });
    if (!job) return res.status(404).json({ success: false, message: 'Print job not found' });

    const managedActor = await prisma.managedUser.findUnique({
      where: { id: actorId },
      select: { uid: true },
    });
    const actorIds = Array.from(new Set([actorId, managedActor?.uid].filter(Boolean))) as string[];
    const isDirectTarget = !!(job.targetAgentId && actorIds.includes(job.targetAgentId));
    const isLocationJobUnclaimed = job.targetLocationId != null && job.acceptedByAgentId == null;
    const isLocationJobOwner = !!(job.acceptedByAgentId && actorIds.includes(job.acceptedByAgentId));
    if (!isDirectTarget && !isLocationJobUnclaimed && !isLocationJobOwner) {
      // #region agent log
      debugFa19Log({
        hypothesisId: 'D',
        location: 'printJobController.ts:updatePrintJobStatus:forbidden',
        message: 'Print job status denied',
        data: {
          actorId,
          actorIds,
          targetAgentId: job.targetAgentId,
          requestedStatus: status,
          jobStatus: job.status,
        },
      });
      // #endregion
      return res.status(403).json({ success: false, message: 'This job is not addressed to you.' });
    }

    if (job.status === 'expired' || job.status === 'cancelled') {
      return res.status(409).json({ success: false, message: `This job was already ${job.status}.` });
    }

    const actorName = await resolveActorName(actorId);
    const data: any = { status, updatedAt: new Date() };

    if (status === 'accepted' || status === 'rejected') {
      data.respondedAt = new Date();
      if (status === 'accepted') {
        data.acceptedByAgentId = actorId;
        data.acceptedByAgentName = actorName;
      }
    }
    if (status === 'failed' && failureReason) {
      data.failureReason = String(failureReason).slice(0, 500);
    }
    if (status === 'completed') {
      data.completedAt = new Date();
    }

    // #region agent log
    debugFa19Log({
      hypothesisId: 'C',
      location: 'printJobController.ts:updatePrintJobStatus:ok',
      message: 'Print job status updated',
      data: {
        jobId: job.id,
        from: job.status,
        to: status,
        actorId,
        isDirectTarget,
        isLocationJobUnclaimed,
        isLocationJobOwner,
      },
    });
    // #endregion
    const updated = await prisma.printJob.update({ where: { id: job.id }, data, select: jobListSelect });
    await prisma.printJobEvent.create({
      data: { printJobId: job.id, status, note: status === 'failed' ? data.failureReason || null : null },
    });

    if (status === 'completed') {
      await prisma.sale.update({
        where: { id: job.saleId },
        data: { isRemotePrint: true, lastRemotePrintJobId: job.id },
      });
    }

    return res.json({ success: true, data: updated });
  } catch (error: any) {
    console.error('[PrintJob] status update failed:', error);
    return res.status(500).json({ success: false, message: 'Failed to update print job status' });
  }
};

/** Admin cancels a job that hasn't printed yet. */
export const cancelPrintJob = async (req: Request, res: Response) => {
  try {
    const ownerUserId = await getOwnerUserId((req as any).user?.id);
    const job = await prisma.printJob.findFirst({ where: { id: String(req.params.id), userId: ownerUserId } });
    if (!job) return res.status(404).json({ success: false, message: 'Print job not found' });
    if (['completed', 'printing', 'cancelled'].includes(job.status)) {
      return res.status(409).json({ success: false, message: `Cannot cancel a job that is already ${job.status}.` });
    }

    const updated = await prisma.printJob.update({
      where: { id: job.id },
      data: { status: 'cancelled' },
      select: jobListSelect,
    });
    await prisma.printJobEvent.create({ data: { printJobId: job.id, status: 'cancelled' } });
    return res.json({ success: true, data: updated });
  } catch (error: any) {
    console.error('[PrintJob] cancel failed:', error);
    return res.status(500).json({ success: false, message: 'Failed to cancel print job' });
  }
};

/** Admin reassigns an expired/rejected job to a different agent — creates a fresh job rather than
 *  mutating the old one, so the original stays in the audit trail exactly as it happened. */
export const reassignPrintJob = async (req: Request, res: Response) => {
  try {
    const actorId = (req as any).user?.id;
    const authority = await resolveSenderAuthority(actorId);
    if (!authority?.ok) return res.status(403).json({ success: false, message: 'Not permitted.' });

    const original = await prisma.printJob.findFirst({ where: { id: String(req.params.id), userId: authority.ownerUserId } });
    if (!original) return res.status(404).json({ success: false, message: 'Print job not found' });
    if (!['expired', 'rejected', 'failed'].includes(original.status)) {
      return res.status(409).json({ success: false, message: `Cannot reassign a job that is ${original.status}.` });
    }

    const { targetAgentId } = req.body as { targetAgentId?: string };
    if (!targetAgentId) return res.status(400).json({ success: false, message: 'targetAgentId is required' });

    const targetAgentName = await resolveActorName(targetAgentId);
    const now = new Date();
    const job = await prisma.printJob.create({
      data: {
        userId: authority.ownerUserId,
        saleId: original.saleId,
        requestedById: actorId,
        requestedByName: authority.actorName,
        targetAgentId,
        targetAgentName,
        paperWidth: original.paperWidth,
        copies: original.copies,
        status: 'delivered',
        expiresAt: new Date(now.getTime() + RESPONSE_WINDOW_MS),
      },
      select: jobListSelect,
    });
    await prisma.printJobEvent.create({
      data: { printJobId: job.id, status: 'delivered', note: `Reassigned from job ${original.id}` },
    });

    await sendPushToActor(targetAgentId, {
      title: 'New receipt to print',
      body: `Invoice ${job.sale.invoiceNumber} — tap to accept or decline.`,
      channelId: 'remote-print',
      data: { type: 'remote_print_job', printJobId: job.id, screen: `/print-jobs/${job.id}` },
    });

    return res.status(201).json({ success: true, data: job });
  } catch (error: any) {
    console.error('[PrintJob] reassign failed:', error);
    return res.status(500).json({ success: false, message: 'Failed to reassign print job' });
  }
};
