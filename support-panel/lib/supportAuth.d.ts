export function createSupportSessionToken(agentId: string): string;
export function verifySupportSessionToken(token: string | null | undefined): { agentId: string } | null;
export function supportSessionCookieHeader(token: string, secure: boolean): string;
export function clearSupportSessionCookieHeader(secure: boolean): string;
export function getSupportSession(req: { headers?: Record<string, string | string[] | undefined> }): { agentId: string } | null;
export function isSecureRequest(req: { headers?: Record<string, string | string[] | undefined> }): boolean;
export function parseCookies(req: { headers?: Record<string, string | string[] | undefined> }): Record<string, string>;
export const SUPPORT_COOKIE_NAME: string;
