import type { 
  UserRecord, 
  UserLoginLog, 
  SectionUsage, 
  DashboardMetrics,
  HeatmapCell,
  HeatmapResponse,
  DeviceSessionBreakdownData,
  InvoiceRecord,
  AdminProduct,
} from '../types/admin';

const getApiBaseUrl = () => {
  const envUrl = ((import.meta.env.VITE_API_URL as string) || 'http://localhost:5005/api').trim().replace(/\/$/, '');
  return envUrl.endsWith('/admin') ? envUrl : `${envUrl}/admin`;
};

const API_BASE_URL = getApiBaseUrl();

async function fetchAdminEndpoint<T>(path: string): Promise<T> {
  const localUrl = `/api/admin${path}`;
  const remoteUrl = API_BASE_URL && !API_BASE_URL.startsWith('/api') ? `${API_BASE_URL}${path}` : null;

  // 1. If running on localhost / dev, local dev server middleware is connected to RDS
  if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
    try {
      const res = await fetch(localUrl);
      if (res.ok) return (await res.json()) as T;
      const errData = await res.json().catch(() => null);
      throw new Error(errData?.error || `Server error (${res.status}) on ${path}`);
    } catch (err: any) {
      if (remoteUrl) {
        // fallback to remote if local fails
      } else {
        throw err;
      }
    }
  }

  // 2. Try remote backend if configured
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

  // 3. Fallback to local route
  const res = await fetch(localUrl);
  if (res.ok) return (await res.json()) as T;
  const errData = await res.json().catch(() => null);
  throw new Error(errData?.error || `Server error (${res.status}) on ${path}`);
}

export async function fetchDashboardMetrics(timeRange: string = '24h'): Promise<DashboardMetrics> {
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

export async function fetchUserRecords(timeRange: string = '24h'): Promise<UserRecord[]> {
  return await fetchAdminEndpoint<UserRecord[]>(`/users?timeRange=${encodeURIComponent(timeRange)}`);
}

export async function fetchLoginLogs(): Promise<UserLoginLog[]> {
  return await fetchAdminEndpoint<UserLoginLog[]>('/logins');
}

export async function fetchSectionUsage(timeRange: string = '24h'): Promise<SectionUsage[]> {
  return await fetchAdminEndpoint<SectionUsage[]>(`/sections?timeRange=${encodeURIComponent(timeRange)}`);
}

export async function fetchHeatmapData(timeRange: string = '24h'): Promise<HeatmapResponse> {
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

export async function fetchDeviceSessionBreakdown(timeRange: string = '24h'): Promise<DeviceSessionBreakdownData> {
  return await fetchAdminEndpoint<DeviceSessionBreakdownData>(`/devices?timeRange=${encodeURIComponent(timeRange)}`);
}

export async function fetchProducts(limit: number = 100): Promise<AdminProduct[]> {
  return await fetchAdminEndpoint<AdminProduct[]>(`/products?limit=${limit}`);
}

export async function fetchInvoices(timeRange: string = '24h', platform: string = 'all', limit: number = 100): Promise<InvoiceRecord[]> {
  return await fetchAdminEndpoint<InvoiceRecord[]>(`/invoices?timeRange=${encodeURIComponent(timeRange)}&platform=${encodeURIComponent(platform)}&limit=${limit}`);
}

export async function banUser(userId: string | number, reason: string): Promise<any> {
  const url = `${API_BASE_URL}/users/${encodeURIComponent(String(userId))}/ban`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason }),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to ban user (HTTP ${response.status})`);
  }
  return await response.json();
}

export async function unbanUser(userId: string | number): Promise<any> {
  const url = `${API_BASE_URL}/users/${encodeURIComponent(String(userId))}/unban`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to unban user (HTTP ${response.status})`);
  }
  return await response.json();
}
