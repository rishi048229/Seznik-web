import type { IncomingMessage } from 'node:http';

export function createSupportSessionToken(agentId: string): string;
export function verifySupportSessionToken(token: string): { agentId: string } | null;
export function supportSessionCookieHeader(token: string, secure: boolean): string;
export function clearSupportSessionCookieHeader(secure: boolean): string;
export function getSupportSession(req: IncomingMessage | { headers?: Record<string, unknown> }): { agentId: string } | null;
export function isSecureRequest(req: IncomingMessage | { headers?: Record<string, unknown> }): boolean;
export const SUPPORT_COOKIE_NAME: string;
