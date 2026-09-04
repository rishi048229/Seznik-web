import { getPool, withDbRetry, sendJson, readJsonBody } from '../../lib/supportDb.js';
import {
  authenticateSupportAgent,
  getSupportAgentById,
} from '../../lib/supportAgents.js';
import {
  createSupportSessionToken,
  getSupportSession,
  supportSessionCookieHeader,
  clearSupportSessionCookieHeader,
  isSecureRequest,
} from '../../lib/supportAuth.js';
import {
  issueCustomerAccessCode,
  listAccessCodes,
} from '../../lib/accessCodes.js';

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

async function requireActiveAgent(req, res, secure) {
  const session = getSupportSession(req);
  if (!session) {
    sendJson(res, 401, { error: 'Unauthorized' });
    return null;
  }
  const pool = getPool();
  const agent = await getSupportAgentById(pool, session.agentId);
  if (!agent) {
    sendJson(res, 401, { error: 'Unauthorized' });
    return null;
  }
  if (agent.isDisabled) {
    res.setHeader('Set-Cookie', clearSupportSessionCookieHeader(secure));
    sendJson(res, 403, { error: 'Access disabled. Contact an administrator.' });
    return null;
  }
  return { pool, agent };
}

export default async function handler(req, res) {
  const segments = pathSegments(req);
  const route = segments.join('/');
  const method = req.method || 'GET';
  const secure = isSecureRequest(req);
  const query = req.query || {};

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
      const ctx = await requireActiveAgent(req, res, secure);
      if (!ctx) return;
      return sendJson(res, 200, { agent: ctx.agent });
    }

    if (method === 'POST' && route === 'access-codes/issue') {
      const ctx = await requireActiveAgent(req, res, secure);
      if (!ctx) return;
      const payload = await readJsonBody(req);
      const record = await withDbRetry((pool) =>
        issueCustomerAccessCode(pool, {
          ...payload,
          createdBy: ctx.agent.username,
        })
      );
      return sendJson(res, 200, { success: true, record });
    }

    if (method === 'GET' && route === 'access-codes') {
      const ctx = await requireActiveAgent(req, res, secure);
      if (!ctx) return;
      const result = await withDbRetry((pool) =>
        listAccessCodes(pool, {
          page: query.page,
          limit: query.limit,
          search: query.search,
          createdBy: ctx.agent.username,
          customerOnly: true,
        })
      );
      return sendJson(res, 200, result);
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
