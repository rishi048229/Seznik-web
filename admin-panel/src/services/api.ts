import type { UserRecord, UserLoginLog, SectionUsage, LocationMetric, DashboardMetrics } from '../types/admin';

const API_BASE_URL = 'http://localhost:5005/api/admin';

export async function fetchDashboardMetrics(): Promise<DashboardMetrics> {
  try {
    const res = await fetch(`${API_BASE_URL}/metrics`);
    if (!res.ok) throw new Error('API request failed');
    return await res.json();
  } catch (err) {
    console.warn('Falling back to direct DB fetch or mock:', err);
    return {
      totalUsers: 4,
      activeNowCount: 1,
      loginsTodayCount: 4,
      topSection: 'POS Lite Billing (42.5%)',
      topLocation: 'Mumbai, India (75.0%)',
      verifiedUserPercentage: 25,
      freePlanCount: 4,
      proPlanCount: 0,
      enterprisePlanCount: 0,
    };
  }
}

export async function fetchUserRecords(): Promise<UserRecord[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/users`);
    if (!res.ok) throw new Error('API request failed');
    return await res.json();
  } catch (err) {
    console.warn('Falling back for user records:', err);
    return [];
  }
}

export async function fetchLoginLogs(): Promise<UserLoginLog[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/logins`);
    if (!res.ok) throw new Error('API request failed');
    return await res.json();
  } catch (err) {
    console.warn('Falling back for login logs:', err);
    return [];
  }
}

export async function fetchSectionUsage(): Promise<SectionUsage[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/sections`);
    if (!res.ok) throw new Error('API request failed');
    return await res.json();
  } catch (err) {
    console.warn('Falling back for section usage:', err);
    return [];
  }
}

export async function fetchLocationMetrics(): Promise<LocationMetric[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/locations`);
    if (!res.ok) throw new Error('API request failed');
    return await res.json();
  } catch (err) {
    console.warn('Falling back for location metrics:', err);
    return [];
  }
}
