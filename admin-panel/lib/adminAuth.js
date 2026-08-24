import { createHmac, timingSafeEqual } from 'node:crypto';

const COOKIE_NAME = 'seznik_admin_session';
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function getAdminUserId() {
  return process.env.ADMIN_USER_ID || 'SezAdmin';
}

export function getAdminPassword() {
  return process.env.ADMIN_PASSWORD || 'SeznikAdmin310!';
}

function getSessionSecret() {
  return process.env.ADMIN_SESSION_SECRET || 'seznik-admin-session-secret-v1';
}

export function safeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function parseCookies(req) {
  const header = req.headers?.cookie || req.headers?.Cookie || '';
  const out = {};
  String(header)
    .split(';')
    .forEach((part) => {
      const [key, ...rest] = part.trim().split('=');
      if (!key) return;
      out[key] = decodeURIComponent(rest.join('=') || '');
    });
  return out;
}

function sign(value) {
  return createHmac('sha256', getSessionSecret()).update(value).digest('base64url');
}

export function createSessionToken(userId) {
  const payload = Buffer.from(JSON.stringify({
    u: userId,
    exp: Date.now() + SESSION_TTL_MS,
  })).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

export function verifySessionToken(token) {
  if (!token || typeof token !== 'string') return null;
  const sep = token.lastIndexOf('.');
  if (sep <= 0) return null;
  const payload = token.slice(0, sep);
  const signature = token.slice(sep + 1);
  if (!safeEqual(signature, sign(payload))) return null;

  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (!data?.u || !Number.isFinite(data.exp) || Date.now() > data.exp) return null;
    if (data.u !== getAdminUserId()) return null;
    return { userId: data.u };
  } catch {
    return null;
  }
}

export function isSecureRequest(req) {
  const proto = String(req.headers?.['x-forwarded-proto'] || '');
  return proto.includes('https');
}

export function sessionCookieHeader(token, secure) {
  return `${COOKIE_NAME}=${encodeURIComponent(token)}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}${secure ? '; Secure' : ''}`;
}

export function clearSessionCookieHeader(secure) {
  return `${COOKIE_NAME}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0${secure ? '; Secure' : ''}`;
}

export function getSessionUser(req) {
  return verifySessionToken(parseCookies(req)[COOKIE_NAME]);
}

export function credentialsMatch(userId, password) {
  return safeEqual(userId, getAdminUserId()) && safeEqual(password, getAdminPassword());
}
