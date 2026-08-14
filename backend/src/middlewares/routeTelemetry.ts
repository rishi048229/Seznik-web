import { Request, Response, NextFunction } from 'express';
import prisma from '../config/db';

export const ROUTE_FEATURE_MAP: Array<{ prefix: string; name: string; path: string }> = [
  { prefix: '/api/sales', name: 'POS Lite Billing', path: '/pos-lite' },
  { prefix: '/api/products', name: 'Products & Inventory', path: '/products' },
  { prefix: '/api/tokens', name: 'Quick Token Generator', path: '/tokens' },
  { prefix: '/api/token-types', name: 'Quick Token Generator', path: '/tokens' },
  { prefix: '/api/customers', name: 'Customer CRM & Loyalty', path: '/customers' },
  { prefix: '/api/reports', name: 'Sales & Expense Reports', path: '/reports' },
  { prefix: '/api/categories', name: 'Categories & Tax Classes', path: '/categories' },
  { prefix: '/api/settings', name: 'Store Settings & Receipt Config', path: '/settings' },
  { prefix: '/api/expenses', name: 'Expense Tracker', path: '/expenses' },
  { prefix: '/api/purchases', name: 'Purchase Orders & Stock In', path: '/purchases' },
  { prefix: '/api/suppliers', name: 'Supplier Management', path: '/suppliers' },
  { prefix: '/api/feedback', name: 'Customer Feedback', path: '/feedback' },
  { prefix: '/api/auth', name: 'Merchant Auth & Login', path: '/auth' },
];

export const routeTelemetryMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // Only track /api routes, ignore static assets and health checks
  if (!req.path.startsWith('/api') || req.path.includes('/health')) {
    return next();
  }

  const startTime = Date.now();

  res.on('finish', async () => {
    try {
      const durationMs = Date.now() - startTime;
      const matched = ROUTE_FEATURE_MAP.find((m) => req.path.startsWith(m.prefix));
      const featureName = matched ? matched.name : req.path.split('/')[2] || 'General API';
      const routePath = matched ? matched.path : req.path;
      const userId = (req as any).user?.id || null;

      // Asynchronously record into PostgreSQL RouteTelemetry table
      await prisma.$executeRawUnsafe(
        `INSERT INTO "RouteTelemetry" ("routePath", "featureName", "method", "userId", "durationMs", "statusCode")
         VALUES ($1, $2, $3, $4, $5, $6)`,
        routePath,
        featureName,
        req.method,
        userId,
        durationMs,
        res.statusCode
      );
    } catch {
      // Non-blocking catch to avoid affecting request flow
    }
  });

  next();
};
