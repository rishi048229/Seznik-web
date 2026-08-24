import type { 
  UserRecord, 
  SectionUsage, 
  DashboardMetrics,
  HeatmapCell,
  HeatmapResponse,
  DeviceSessionBreakdownData,
  InvoiceRecord,
  AdminProduct,
  HealthCheckResult,
} from '../types/admin';

const getApiBaseUrl = () => {
  const envUrl = ((import.meta.env.VITE_API_URL as string) || 'http://localhost:5005/api').trim().replace(/\/$/, '');
  return envUrl.endsWith('/admin') ? envUrl : `${envUrl}/admin`;
};

const API_BASE_URL = getApiBaseUrl();

function isLocalDev(): boolean {
  return (
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  );
}

async function fetchAdminEndpoint<T>(path: string): Promise<T> {
  const localUrl = `/api/admin${path}`;
  const remoteUrl = API_BASE_URL && !API_BASE_URL.startsWith('/api') ? `${API_BASE_URL}${path}` : null;

  // Dev: Vite middleware talks directly to RDS — never fall back to a remote URL
  // (avoids masking local DB errors with an 8s timeout to an unrelated server).
  if (isLocalDev()) {
    const res = await fetch(localUrl);
    if (res.ok) return (await res.json()) as T;
    const errData = await res.json().catch(() => null);
    throw new Error(errData?.error || `Server error (${res.status}) on ${path}`);
  }

  // Production: try configured remote admin API, then same-origin fallback
  if (remoteUrl) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(remoteUrl, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (res.ok) return (await res.json()) as T;
      const errData = await res.json().catch(() => null);
      throw new Error(errData?.error || `Remote server error (${res.status}) on ${path}`);
    } catch (err: any) {
      throw new Error(err.message || `Failed to connect to backend server on ${path}`);
    }
  }

  const res = await fetch(localUrl);
  if (res.ok) return (await res.json()) as T;
  const errData = await res.json().catch(() => null);
  throw new Error(errData?.error || `Server error (${res.status}) on ${path}`);
}

async function postAdminEndpoint<T>(path: string, body?: unknown): Promise<T> {
  const localUrl = `/api/admin${path}`;
  const remoteUrl = API_BASE_URL && !API_BASE_URL.startsWith('/api') ? `${API_BASE_URL}${path}` : null;
  const url = isLocalDev() ? localUrl : remoteUrl || localUrl;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error((errorData as { error?: string }).error || `Request failed (HTTP ${response.status})`);
  }

  return (await response.json()) as T;
}

export async function fetchDashboardMetrics(timeRange: string = '7d'): Promise<DashboardMetrics> {
  const data = await fetchAdminEndpoint<any>(`/metrics?timeRange=${encodeURIComponent(timeRange)}`);
  return {
    totalUsers: data.totalUsers ?? 0,
    totalUsersTrend: data.totalUsersTrend ?? 0,
    invoicesTodayCount: data.invoicesTodayCount ?? 0,
    invoicesTodayTrend: data.invoicesTodayTrend ?? 0,
    activeInvoicingUsersToday: data.activeInvoicingUsersToday ?? 0,
    activeInvoicingUsersTrend: data.activeInvoicingUsersTrend ?? 0,
    loginsTodayCount: data.loginsTodayCount ?? 0,
    loginsTodayTrend: data.loginsTodayTrend ?? 0,
    topSection: data.topSection || 'N/A (0%)',
    topSectionShare: data.topSectionShare ?? 0,
    topSectionTrend: data.topSectionTrend ?? 0,
    verifiedUserPercentage: data.verifiedUserPercentage ?? 0,
    freePlanCount: data.freePlanCount ?? 0,
    proPlanCount: data.proPlanCount ?? 0,
    enterprisePlanCount: data.enterprisePlanCount ?? 0,
    timeRange: data.timeRange || timeRange,
    timeWindowLabel: data.timeWindowLabel,
    webInvoicesCount: data.webInvoicesCount,
    mobileInvoicesCount: data.mobileInvoicesCount,
    webInvoicesPercent: data.webInvoicesPercent,
    mobileInvoicesPercent: data.mobileInvoicesPercent,
    mobileRevenue: data.mobileRevenue,
    webRevenue: data.webRevenue,
  };
}

export async function fetchUserRecords(timeRange: string = '7d'): Promise<UserRecord[]> {
  return await fetchAdminEndpoint<UserRecord[]>(`/users?timeRange=${encodeURIComponent(timeRange)}`);
}

export async function fetchSectionUsage(timeRange: string = '7d'): Promise<SectionUsage[]> {
  return await fetchAdminEndpoint<SectionUsage[]>(`/sections?timeRange=${encodeURIComponent(timeRange)}`);
}

export async function fetchHeatmapData(timeRange: string = '7d'): Promise<HeatmapResponse> {
  const res = await fetchAdminEndpoint<any>(`/heatmap?timeRange=${encodeURIComponent(timeRange)}`);
  if (Array.isArray(res)) {
    const total = res.reduce((sum: number, c: HeatmapCell) => sum + (c.count || 0), 0);
    return {
      cells: res,
      requestsToday: 0,
      requestsThisHour: 0,
      requestsThisWeek: total,
      totalAllTime: total,
      currentWeekRange: 'Current Week',
    };
  }
  return res;
}

export async function fetchDeviceSessionBreakdown(timeRange: string = '7d'): Promise<DeviceSessionBreakdownData> {
  return await fetchAdminEndpoint<DeviceSessionBreakdownData>(`/devices?timeRange=${encodeURIComponent(timeRange)}`);
}

export async function fetchProducts(limit: number = 100): Promise<AdminProduct[]> {
  return await fetchAdminEndpoint<AdminProduct[]>(`/products?limit=${limit}`);
}

export async function fetchInvoices(timeRange: string = '24h', platform: string = 'all', limit: number = 100): Promise<InvoiceRecord[]> {
  return await fetchAdminEndpoint<InvoiceRecord[]>(`/invoices?timeRange=${encodeURIComponent(timeRange)}&platform=${encodeURIComponent(platform)}&limit=${limit}`);
}

export async function banUser(userId: string | number, reason: string): Promise<any> {
  return postAdminEndpoint(`/users/${encodeURIComponent(String(userId))}/ban`, { reason });
}

export async function unbanUser(userId: string | number): Promise<any> {
  return postAdminEndpoint(`/users/${encodeURIComponent(String(userId))}/unban`);
}

function getBackendBaseUrl(): string {
  const apiUrl = ((import.meta.env.VITE_API_URL as string) || 'http://localhost:5001/api').trim().replace(/\/$/, '');
  return apiUrl.replace(/\/api$/, '');
}

async function fetchHealthEndpoint(url: string): Promise<HealthCheckResult> {
  const start = Date.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    const data = (await res.json().catch(() => ({}))) as HealthCheckResult;
    return {
      ...data,
      status: data.status || (res.ok ? 'healthy' : 'unhealthy'),
      timestamp: data.timestamp || new Date().toISOString(),
      serverLatencyMs: Date.now() - start,
    };
  } catch (err: any) {
    clearTimeout(timeoutId);
    return {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      serverLatencyMs: Date.now() - start,
      error: err?.name === 'AbortError' ? 'Request timed out after 8s' : (err?.message || 'Server unreachable'),
      database: { status: 'disconnected', error: 'Could not reach server' },
    };
  }
}

export async function fetchAdminHealth(): Promise<HealthCheckResult> {
  const localUrl = '/api/admin/health';
  const remoteUrl = API_BASE_URL && !API_BASE_URL.startsWith('/api') ? `${API_BASE_URL}/health` : null;
  const url = isLocalDev() ? localUrl : remoteUrl || localUrl;
  return fetchHealthEndpoint(url);
}

export async function fetchBackendHealth(): Promise<HealthCheckResult> {
  const base = getBackendBaseUrl();
  return fetchHealthEndpoint(`${base}/api/health`);
}
