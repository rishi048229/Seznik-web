import { randomUUID } from 'crypto';
import { Request } from 'express';

export type RegistrationPlatform = 'web' | 'mobile';

export function generateUserId(platform: RegistrationPlatform): string {
  const prefix = platform === 'web' ? 'w' : 'm';
  return `${prefix}${randomUUID()}`;
}

export function resolveRegistrationPlatform(req: Request): RegistrationPlatform {
  const body = req.body ?? {};
  const fromBody = body.registrationSource ?? body.platform;
  if (fromBody === 'mobile') return 'mobile';
  if (fromBody === 'web') return 'web';
  const header = String(req.headers['x-client-platform'] ?? '').toLowerCase();
  if (header === 'mobile') return 'mobile';
  return 'web';
}
