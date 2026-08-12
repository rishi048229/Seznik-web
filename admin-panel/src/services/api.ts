import type { UserRecord, UserLoginLog, SectionUsage, LocationMetric, DashboardMetrics } from '../types/admin';

const API_BASE_URL = 'http://localhost:5005/api/admin';

const MOCK_LOGIN_LOGS: UserLoginLog[] = [
  {
    id: 'log-1',
    userId: 'user-1',
    userName: 'Aaditya Basisth',
    userEmail: 'aaditya@seznik.com',
    userRole: 'Owner / Admin',
    ipAddress: '103.22.140.12',
    city: 'Mumbai',
    country: 'India',
    countryCode: 'IN',
    device: 'Desktop (macOS Sonoma)',
    browser: 'Chrome 127.0',
    loginAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    status: 'active',
  },
  {
    id: 'log-2',
    userId: 'user-2',
    userName: 'Priya Sharma',
    userEmail: 'priya@seznik.com',
    userRole: 'Store Manager',
    ipAddress: '49.36.22.88',
    city: 'Delhi',
    country: 'India',
    countryCode: 'IN',
    device: 'Mobile (Android 14)',
    browser: 'Chrome Mobile',
    loginAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
    status: 'success',
  },
  {
    id: 'log-3',
    userId: 'user-3',
    userName: 'Rahul Verma',
    userEmail: 'rahul@seznik.com',
    userRole: 'Billing Cashier',
    ipAddress: '157.48.91.102',
    city: 'Bengaluru',
    country: 'India',
    countryCode: 'IN',
    device: 'Desktop (Windows 11)',
    browser: 'Edge 126.0',
    loginAt: new Date(Date.now() - 5 * 3600 * 1000).toISOString(),
    status: 'success',
  },
  {
    id: 'log-4',
    userId: 'user-4',
    userName: 'Security Audit',
    userEmail: 'admin_test@unknown.com',
    userRole: 'Guest',
    ipAddress: '185.220.101.5',
    city: 'Frankfurt',
    country: 'Germany',
    countryCode: 'DE',
    device: 'Unknown Linux Device',
    browser: 'Firefox 125.0',
    loginAt: new Date(Date.now() - 12 * 3600 * 1000).toISOString(),
    status: 'failed',
  },
];

const MOCK_USERS: UserRecord[] = [
  {
    id: 1,
    uid: 'uid-1',
    email: 'aaditya@seznik.com',
    phone: '+91 9876543210',
    displayName: 'Aaditya Basisth',
    businessName: 'Seznik Flagship Store',
    plan: 'enterprise',
    role: 'Owner',
    emailVerified: true,
    onboardingCompleted: true,
    createdAt: new Date(Date.now() - 30 * 86400 * 1000).toISOString(),
    lastLoginAt: new Date().toISOString(),
    location: 'Mumbai, India',
    city: 'Mumbai',
    country: 'India',
    countryCode: 'IN',
    ipAddress: '103.22.140.12',
  },
  {
    id: 2,
    uid: 'uid-2',
    email: 'priya@seznik.com',
    phone: '+91 9812345678',
    displayName: 'Priya Sharma',
    businessName: 'Priya Electronics',
    plan: 'pro',
    role: 'Store Manager',
    emailVerified: true,
    onboardingCompleted: true,
    createdAt: new Date(Date.now() - 20 * 86400 * 1000).toISOString(),
    lastLoginAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
    location: 'Delhi, India',
    city: 'Delhi',
    country: 'India',
    countryCode: 'IN',
    ipAddress: '49.36.22.88',
  },
  {
    id: 3,
    uid: 'uid-3',
    email: 'rahul@seznik.com',
    phone: '+91 9765432109',
    displayName: 'Rahul Verma',
    businessName: 'Verma Traders',
    plan: 'free',
    role: 'Billing Cashier',
    emailVerified: false,
    onboardingCompleted: true,
    createdAt: new Date(Date.now() - 10 * 86400 * 1000).toISOString(),
    lastLoginAt: new Date(Date.now() - 5 * 3600 * 1000).toISOString(),
    location: 'Bengaluru, India',
    city: 'Bengaluru',
    country: 'India',
    countryCode: 'IN',
    ipAddress: '157.48.91.102',
  },
  {
    id: 4,
    uid: 'uid-4',
    email: 'contact@quickmart.in',
    phone: '+91 9654321098',
    displayName: 'QuickMart Retail',
    businessName: 'QuickMart Retail Ltd',
    plan: 'free',
    role: 'Admin',
    emailVerified: true,
    onboardingCompleted: false,
    createdAt: new Date(Date.now() - 2 * 86400 * 1000).toISOString(),
    lastLoginAt: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
    location: 'Mumbai, India',
    city: 'Mumbai',
    country: 'India',
    countryCode: 'IN',
    ipAddress: '103.22.140.12',
  },
];

const MOCK_SECTION_USAGE: SectionUsage[] = [
  { id: 'sec-1', sectionName: 'POS Lite Billing', path: '/pos-lite', iconName: 'ShoppingBag', viewCount: 142, uniqueUsers: 4, avgDurationMinutes: 18.5, percentageShare: 42.5, trend: 'up', trendPercent: 14.5 },
  { id: 'sec-2', sectionName: 'Label Studio & Barcode Designer', path: '/printers/label-studio', iconName: 'Printer', viewCount: 98, uniqueUsers: 3, avgDurationMinutes: 12.0, percentageShare: 28.1, trend: 'up', trendPercent: 22.1 },
  { id: 'sec-3', sectionName: 'Products & Inventory', path: '/products', iconName: 'Package', viewCount: 56, uniqueUsers: 4, avgDurationMinutes: 8.4, percentageShare: 16.2, trend: 'neutral', trendPercent: 1.2 },
  { id: 'sec-4', sectionName: 'Sales & Expense Reports', path: '/reports', iconName: 'BarChart3', viewCount: 28, uniqueUsers: 2, avgDurationMinutes: 10.3, percentageShare: 8.1, trend: 'neutral', trendPercent: 0.5 },
  { id: 'sec-5', sectionName: 'Quick Token Generator', path: '/tokens', iconName: 'Ticket', viewCount: 18, uniqueUsers: 2, avgDurationMinutes: 6.1, percentageShare: 5.1, trend: 'up', trendPercent: 18.0 },
];

const MOCK_LOCATION_METRICS: LocationMetric[] = [
  { country: 'India', countryCode: 'IN', city: 'Mumbai', userCount: 3, activeSessions: 1, percentageShare: 75.0, flagEmoji: '🇮🇳' },
  { country: 'India', countryCode: 'IN', city: 'Delhi', userCount: 1, activeSessions: 1, percentageShare: 25.0, flagEmoji: '🇮🇳' },
];

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
    return MOCK_USERS;
  }
}

export async function fetchLoginLogs(): Promise<UserLoginLog[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/logins`);
    if (!res.ok) throw new Error('API request failed');
    return await res.json();
  } catch (err) {
    console.warn('Falling back for login logs:', err);
    return MOCK_LOGIN_LOGS;
  }
}

export async function fetchSectionUsage(): Promise<SectionUsage[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/sections`);
    if (!res.ok) throw new Error('API request failed');
    return await res.json();
  } catch (err) {
    console.warn('Falling back for section usage:', err);
    return MOCK_SECTION_USAGE;
  }
}

export async function fetchLocationMetrics(): Promise<LocationMetric[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/locations`);
    if (!res.ok) throw new Error('API request failed');
    return await res.json();
  } catch (err) {
    console.warn('Falling back for location metrics:', err);
    return MOCK_LOCATION_METRICS;
  }
}

