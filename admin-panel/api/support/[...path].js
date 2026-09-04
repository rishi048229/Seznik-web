import { getPool, sendJson, readJsonBody } from '../lib/adminDb.js';
import {
  authenticateSupportAgent,
  getSupportAgentById,
} from '../lib/supportAgents.js';
import {
  createSupportSessionToken,
  getSupportSession,
  supportSessionCookieHeader,
  clearSupportSessionCookieHeader,
  isSecureRequest,
} from '../lib/supportAuth.js';

function pathSegments(req) {
  const rawUrl = req.url || '';
  const pathname = new URL(rawUrl, 'http://localhost').pathname;
  const trimmed = pathname.replace(/^\/api\/support\/?/, '');
  if (trimmed) return trimmed.split('/').filter(Boolean);

  const raw = req.query?.path;
  if (Array.isArray(raw)) return raw.filter(Boolean);
  if (typeof raw === 'string' && raw.length > 0) return raw.split('/').filter(Boolean);
  return [];
}

export default async function handler(req, res) {
  const segments = pathSegments(req);
  const route = segments.join('/');
  const method = req.method || 'GET';
  const secure = isSecureRequest(req);

  try {
    if (method === 'POST' && route === 'login') {
      const payload = await readJsonBody(req);
      const pool = getPool();
      const agent = await authenticateSupportAgent(pool, payload.username, payload.password);
      const token = createSupportSessionToken(agent.id);
      res.setHeader('Set-Cookie', supportSessionCookieHeader(token, secure));
      return sendJson(res, 200, { success: true, agent });
    }

    if (method === 'POST' && route === 'logout') {
      res.setHeader('Set-Cookie', clearSupportSessionCookieHeader(secure));
      return sendJson(res, 200, { success: true });
    }

    if (method === 'GET' && route === 'me') {
      const session = getSupportSession(req);
      if (!session) return sendJson(res, 401, { error: 'Unauthorized' });
      const pool = getPool();
      const agent = await getSupportAgentById(pool, session.agentId);
      if (!agent) return sendJson(res, 401, { error: 'Unauthorized' });
      if (agent.isDisabled) {
        res.setHeader('Set-Cookie', clearSupportSessionCookieHeader(secure));
        return sendJson(res, 403, { error: 'Access disabled. Contact an administrator.' });
      }
      return sendJson(res, 200, { agent });
    }

    return sendJson(res, 404, { error: `Unknown support route: ${method} /api/support/${route}` });
  } catch (err) {
    console.error(`Support API error on /${route}:`, err);
    const message = err instanceof Error ? err.message : 'Request failed';
    if (err?.statusCode) return sendJson(res, err.statusCode, { error: message });
    if (message === 'DATABASE_URL is not set') {
      return sendJson(res, 500, { error: 'DATABASE_URL is not set on Vercel' });
    }
    return sendJson(res, 500, { error: message });
  }
}
