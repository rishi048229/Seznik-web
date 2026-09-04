import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import prisma from '../config/db';
import {
  resolveApiFeature,
  shouldSkipApiUsageTracking,
} from '../constants/apiFeatureCatalog';
import { isValidBusinessType } from '../constants/businessTypes';

function floorToHourUtc(date: Date): Date {
  const d = new Date(date);
  d.setUTCMinutes(0, 0, 0);
  d.setUTCMilliseconds(0);
  return d;
}

function normalizeBusinessType(value: unknown): string {
  if (typeof value === 'string' && isValidBusinessType(value)) return value;
  return 'unknown';
}

/**
 * Fire-and-forget hourly API usage aggregation.
 * Mount early (before routes) so every response is observed; feature is resolved from req.path.
 */
export const trackApiUsage = (req: Request, res: Response, next: NextFunction) => {
  const pathname = req.originalUrl || req.url || req.path || '';

  if (shouldSkipApiUsageTracking(pathname) || req.method === 'OPTIONS') {
    return next();
  }

  const feature = resolveApiFeature(pathname);
  if (!feature) {
    return next();
  }

  const method = (req.method || 'GET').toUpperCase();
  const startedAt = Date.now();

  res.on('finish', () => {
    // Skip very early disconnects with no meaningful response
    if (Date.now() - startedAt < 0) return;

    const user = (req as any).user as { businessType?: string | null } | undefined;
    const businessType = normalizeBusinessType(user?.businessType);
    const bucketStart = floorToHourUtc(new Date());

    void (async () => {
      try {
        await (prisma as any).apiUsageBucket.upsert({
          where: {
            bucketStart_featureKey_routePrefix_method_businessType: {
              bucketStart,
              featureKey: feature.id,
              routePrefix: feature.routePrefix,
              method,
              businessType,
            },
          },
          create: {
            id: randomUUID(),
            bucketStart,
            featureKey: feature.id,
            routePrefix: feature.routePrefix,
            method,
            businessType,
            callCount: 1,
          },
          update: {
            callCount: { increment: 1 },
          },
        });
      } catch (err) {
        // Table may not exist yet, or DB briefly unavailable — never fail the request.
        try {
          await prisma.$executeRawUnsafe(
            `
            INSERT INTO "ApiUsageBucket" (
              "id", "bucketStart", "featureKey", "routePrefix", "method", "businessType", "callCount", "createdAt", "updatedAt"
            ) VALUES (
              $1, $2, $3, $4, $5, $6, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
            )
            ON CONFLICT ("bucketStart", "featureKey", "routePrefix", "method", "businessType")
            DO UPDATE SET
              "callCount" = "ApiUsageBucket"."callCount" + 1,
              "updatedAt" = CURRENT_TIMESTAMP
            `,
            randomUUID(),
            bucketStart,
            feature.id,
            feature.routePrefix,
            method,
            businessType
          );
        } catch {
          // swallow
        }
      }
    })();
  });

  next();
};
