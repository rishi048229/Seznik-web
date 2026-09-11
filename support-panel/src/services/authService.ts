import type { AccessCodeListResponse, AccessCodeRecord, AccessCodeLookupResult, SupportAgentRecord } from '../types/support';

function isLocalDev(): boolean {
  return (
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  );
}

function usesSameOriginApi(): boolean {
  if (typeof window === 'undefined') return true;
  if (isLocalDev()) return true;
  return window.location.protocol === 'https:';
}

export function getSupportApiBase(): string {
  if (usesSameOriginApi()) return '/api/support';
  const envUrl = ((import.meta.env.VITE_API_URL as string) || '').trim().replace(/\/$/, '');
  if (!envUrl) return '/api/support';
  return envUrl.endsWith('/support') ? envUrl : `${envUrl.replace(/\/admin$/, '')}/support`;
}

function notifyUnauthorized(status: number) {
  if ((status === 401 || status === 403) && typeof window !== 'undefined') {
    window.dispatchEvent(new Event('support-auth-required'));
  }
}

async function parseError(res: Response, fallback: string) {
  const data = await res.json().catch(() => null);
  return (data as { error?: string } | null)?.error || fallback;
}

export async function fetchSupportSession(): Promise<{ agent: SupportAgentRecord }> {
  const res = await fetch(`${getSupportApiBase()}/me`, { credentials: 'include' });
  if (!res.ok) {
    notifyUnauthorized(res.status);
    throw new Error(await parseError(res, 'Not signed in'));
  }
  return (await res.json()) as { agent: SupportAgentRecord };
}

export async function loginSupport(
  username: string,
  password: string
): Promise<{ success: boolean; agent: SupportAgentRecord }> {
  const res = await fetch(`${getSupportApiBase()}/login`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) throw new Error(await parseError(res, 'Invalid username or password'));
  return (await res.json()) as { success: boolean; agent: SupportAgentRecord };
}

export async function logoutSupport(): Promise<void> {
  await fetch(`${getSupportApiBase()}/logout`, {
    method: 'POST',
    credentials: 'include',
  });
}

export async function issueSupportAccessCode(payload: {
  customerName: string;
  invoiceNumber: string;
  phone: string;
  printer: string;
}): Promise<{ success: boolean; record: AccessCodeRecord }> {
  const res = await fetch(`${getSupportApiBase()}/access-codes/issue`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    notifyUnauthorized(res.status);
    throw new Error(await parseError(res, 'Failed to issue code'));
  }
  return (await res.json()) as { success: boolean; record: AccessCodeRecord };
}

export async function fetchSupportAccessCodes(params: {
  page?: number;
  limit?: number;
  search?: string;
} = {}): Promise<AccessCodeListResponse> {
  const searchParams = new URLSearchParams();
  if (params.page) searchParams.set('page', String(params.page));
  if (params.limit) searchParams.set('limit', String(params.limit));
  if (params.search) searchParams.set('search', params.search);
  const qs = searchParams.toString();
  const res = await fetch(`${getSupportApiBase()}/access-codes${qs ? `?${qs}` : ''}`, {
    credentials: 'include',
  });
  if (!res.ok) {
    notifyUnauthorized(res.status);
    throw new Error(await parseError(res, 'Failed to load access codes'));
  }
  return (await res.json()) as AccessCodeListResponse;
}

export async function lookupSupportAccessCode(code: string): Promise<AccessCodeLookupResult> {
  const res = await fetch(`${getSupportApiBase()}/access-codes/search?code=${encodeURIComponent(code.trim())}`, {
    credentials: 'include',
  });
  if (!res.ok) {
    notifyUnauthorized(res.status);
    throw new Error(await parseError(res, 'Failed to search access code'));
  }
  return (await res.json()) as AccessCodeLookupResult;
}

