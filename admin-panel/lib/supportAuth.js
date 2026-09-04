import { createHmac, timingSafeEqual } from 'node:crypto';
import { parseCookies, isSecureRequest } from './adminAuth.js';

const COOKIE_NAME = 'seznik_support_session';
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function getSessionSecret() {
  return process.env.ADMIN_SESSION_SECRET || 'seznik-admin-session-secret-v1';
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function sign(value) {
  return createHmac('sha256', getSessionSecret()).update(`support:${value}`).digest('base64url');
}

export function createSupportSessionToken(agentId) {
  const payload = Buffer.from(JSON.stringify({
    a: agentId,
    r: 'support',
    exp: Date.now() + SESSION_TTL_MS,
  })).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

export function verifySupportSessionToken(token) {
  if (!token || typeof token !== 'string') return null;
  const sep = token.lastIndexOf('.');
  if (sep <= 0) return null;
  const payload = token.slice(0, sep);
  const signature = token.slice(sep + 1);
  if (!safeEqual(signature, sign(payload))) return null;

  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (!data?.a || data.r !== 'support' || !Number.isFinite(data.exp) || Date.now() > data.exp) {
      return null;
    }
    return { agentId: data.a };
  } catch {
    return null;
  }
}

export function supportSessionCookieHeader(token, secure) {
  return `${COOKIE_NAME}=${encodeURIComponent(token)}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}${secure ? '; Secure' : ''}`;
}

export function clearSupportSessionCookieHeader(secure) {
  return `${COOKIE_NAME}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0${secure ? '; Secure' : ''}`;
}

export function getSupportSession(req) {
  return verifySupportSessionToken(parseCookies(req)[COOKIE_NAME]);
}

export { isSecureRequest, COOKIE_NAME as SUPPORT_COOKIE_NAME };
