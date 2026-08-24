import type { IncomingMessage } from 'node:http';

export function getAdminUserId(): string;
export function getAdminPassword(): string;
export function safeEqual(a: string, b: string): boolean;
export function parseCookies(req: IncomingMessage | { headers?: Record<string, unknown> }): Record<string, string>;
export function createSessionToken(userId: string): string;
export function verifySessionToken(token: string): { userId: string } | null;
export function isSecureRequest(req: IncomingMessage | { headers?: Record<string, unknown> }): boolean;
export function sessionCookieHeader(token: string, secure: boolean): string;
export function clearSessionCookieHeader(secure: boolean): string;
export function getSessionUser(req: IncomingMessage | { headers?: Record<string, unknown> }): { userId: string } | null;
export function credentialsMatch(userId: string, password: string): boolean;
