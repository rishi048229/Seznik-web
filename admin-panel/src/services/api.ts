import type { 
  UserRecord, 
  UserLoginLog, 
  SectionUsage, 
  LocationMetric, 
  DashboardMetrics,
  HeatmapCell,
  DeviceSessionBreakdownData,
  SecurityAnomalyData,
} from '../types/admin';

const API_BASE_URL = 'http://localhost:5005/api/admin';

const MOCK_LOGIN_LOGS: UserLoginLog[] = [
  {
    id: 'log-1',
    userId: 'uid-1',
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
    actionType: 'billing',
    actionDetails: 'Generated POS Lite tax invoice receipt #POS-1049 (₹2,450)',
  },
  {
    id: 'log-2',
    userId: 'uid-1',
    userName: 'Aaditya Basisth',
    userEmail: 'aaditya@seznik.com',
    userRole: 'Owner / Admin',
    ipAddress: '103.22.140.12',
    city: 'Mumbai',
    country: 'India',
    countryCode: 'IN',
    device: 'Desktop (macOS Sonoma)',
    browser: 'Chrome 127.0',
    loginAt: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
    status: 'success',
    actionType: 'export',
    actionDetails: 'Exported 150 thermal barcode labels in Label Studio',
  },
  {
    id: 'log-3',
    userId: 'uid-2',
    userName: 'Priya Sharma',
    userEmail: 'priya@seznik.com',
    userRole: 'Store Manager',
    ipAddress: '49.36.22.88',
    city: 'Delhi',
    country: 'India',
    countryCode: 'IN',
    device: 'Mobile (Android 14)',
    browser: 'Chrome Mobile',
    loginAt: new Date(Date.now() - 1 * 3600 * 1000).toISOString(),
    status: 'active',
    actionType: 'billing',
    actionDetails: 'Completed mobile checkout billing order #POS-1048 (₹1,120)',
  },
  {
    id: 'log-4',
    userId: 'uid-2',
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
    actionType: 'module_access',
    actionDetails: 'Updated inventory product pricing & stock levels (14 SKUs)',
  },
  {
    id: 'log-5',
    userId: 'uid-2',
    userName: 'Priya Sharma',
    userEmail: 'priya@seznik.com',
    userRole: 'Store Manager',
    ipAddress: '49.36.22.88',
    city: 'Delhi',
    country: 'India',
    countryCode: 'IN',
    device: 'Mobile (Android 14)',
    browser: 'Chrome Mobile',
    loginAt: new Date(Date.now() - 4 * 3600 * 1000).toISOString(),
    status: 'success',
    actionType: 'login',
    actionDetails: 'Authenticated session login via 2FA SMS OTP',
  },
  {
    id: 'log-6',
    userId: 'uid-3',
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
    actionType: 'billing',
    actionDetails: 'Created quick token counter order #TKN-882 (₹450)',
  },
  {
    id: 'log-7',
    userId: 'uid-3',
    userName: 'Rahul Verma',
    userEmail: 'rahul@seznik.com',
    userRole: 'Billing Cashier',
    ipAddress: '157.48.91.102',
    city: 'Bengaluru',
    country: 'India',
    countryCode: 'IN',
    device: 'Desktop (Windows 11)',
    browser: 'Edge 126.0',
    loginAt: new Date(Date.now() - 6 * 3600 * 1000).toISOString(),
    status: 'success',
    actionType: 'module_access',
    actionDetails: 'Accessed Sales & Expense Reports module',
  },
  {
    id: 'log-8',
    userId: 'uid-4',
    userName: 'QuickMart Retail',
    userEmail: 'contact@quickmart.in',
    userRole: 'Admin',
    ipAddress: '103.22.140.12',
    city: 'Mumbai',
    country: 'India',
    countryCode: 'IN',
    device: 'Desktop (Windows 10)',
    browser: 'Firefox 125.0',
    loginAt: new Date(Date.now() - 8 * 3600 * 1000).toISOString(),
    status: 'success',
    actionType: 'module_access',
    actionDetails: 'Configured GST Tax Rate rules & HSN code templates',
  },
  {
    id: 'log-9',
    userId: 'uid-4',
    userName: 'QuickMart Retail',
    userEmail: 'contact@quickmart.in',
    userRole: 'Admin',
    ipAddress: '103.22.140.12',
    city: 'Mumbai',
    country: 'India',
    countryCode: 'IN',
    device: 'Desktop (Windows 10)',
    browser: 'Firefox 125.0',
    loginAt: new Date(Date.now() - 10 * 3600 * 1000).toISOString(),
    status: 'success',
    actionType: 'export',
    actionDetails: 'Exported quarterly tax summary PDF report',
  },
  {
    id: 'log-10',
    userId: 'user-0',
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
    actionType: 'security_flag',
    actionDetails: 'Failed authentication attempt: invalid credentials from unapproved IP region',
  },
  {
    id: 'log-11',
    userId: 'uid-1',
    userName: 'Aaditya Basisth',
    userEmail: 'aaditya@seznik.com',
    userRole: 'Owner / Admin',
    ipAddress: '103.22.140.12',
    city: 'Mumbai',
    country: 'India',
    countryCode: 'IN',
    device: 'Desktop (macOS Sonoma)',
    browser: 'Chrome 127.0',
    loginAt: new Date(Date.now() - 14 * 3600 * 1000).toISOString(),
    status: 'success',
    actionType: 'module_access',
    actionDetails: 'Created new staff role permissions: Store Manager',
  },
  {
    id: 'log-12',
    userId: 'uid-2',
    userName: 'Priya Sharma',
    userEmail: 'priya@seznik.com',
    userRole: 'Store Manager',
    ipAddress: '49.36.22.88',
    city: 'Delhi',
    country: 'India',
    countryCode: 'IN',
    device: 'Mobile (Android 14)',
    browser: 'Chrome Mobile',
    loginAt: new Date(Date.now() - 18 * 3600 * 1000).toISOString(),
    status: 'success',
    actionType: 'billing',
    actionDetails: 'Processed POS cash refund request #RFD-0042 (₹320)',
  },
  {
    id: 'log-13',
    userId: 'uid-3',
    userName: 'Rahul Verma',
    userEmail: 'rahul@seznik.com',
    userRole: 'Billing Cashier',
    ipAddress: '157.48.91.102',
    city: 'Bengaluru',
    country: 'India',
    countryCode: 'IN',
    device: 'Desktop (Windows 11)',
    browser: 'Edge 126.0',
    loginAt: new Date(Date.now() - 20 * 3600 * 1000).toISOString(),
    status: 'success',
    actionType: 'billing',
    actionDetails: 'Generated POS Lite tax invoice receipt #POS-1042 (₹890)',
  },
  {
    id: 'log-14',
    userId: 'uid-1',
    userName: 'Aaditya Basisth',
    userEmail: 'aaditya@seznik.com',
    userRole: 'Owner / Admin',
    ipAddress: '103.22.140.12',
    city: 'Mumbai',
    country: 'India',
    countryCode: 'IN',
    device: 'Desktop (macOS Sonoma)',
    browser: 'Chrome 127.0',
    loginAt: new Date(Date.now() - 22 * 3600 * 1000).toISOString(),
    status: 'success',
    actionType: 'export',
    actionDetails: 'Downloaded daily sales CSV data export',
  },
  {
    id: 'log-15',
    userId: 'uid-4',
    userName: 'QuickMart Retail',
    userEmail: 'contact@quickmart.in',
    userRole: 'Admin',
    ipAddress: '103.22.140.12',
    city: 'Mumbai',
    country: 'India',
    countryCode: 'IN',
    device: 'Desktop (Windows 10)',
    browser: 'Firefox 125.0',
    loginAt: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
    status: 'success',
    actionType: 'login',
    actionDetails: 'Authenticated session login success',
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
  { id: 'sec-6', sectionName: 'Customer CRM & Loyalty', path: '/crm/customers', iconName: 'Users', viewCount: 14, uniqueUsers: 2, avgDurationMinutes: 7.2, percentageShare: 4.2, trend: 'up', trendPercent: 8.4 },
  { id: 'sec-7', sectionName: 'GST Tax & Invoice Settings', path: '/settings/tax-invoice', iconName: 'FileText', viewCount: 10, uniqueUsers: 1, avgDurationMinutes: 5.0, percentageShare: 3.1, trend: 'neutral', trendPercent: 0.0 },
  { id: 'sec-8', sectionName: 'Staff Access & Roles', path: '/settings/staff-roles', iconName: 'Shield', viewCount: 8, uniqueUsers: 1, avgDurationMinutes: 4.5, percentageShare: 2.4, trend: 'up', trendPercent: 5.0 },
  { id: 'sec-9', sectionName: 'Audit & Security Log Viewer', path: '/admin/logs', iconName: 'ShieldAlert', viewCount: 6, uniqueUsers: 1, avgDurationMinutes: 9.0, percentageShare: 1.8, trend: 'up', trendPercent: 12.0 },
];

const MOCK_LOCATION_METRICS: LocationMetric[] = [
  { country: 'India', countryCode: 'IN', state: 'Maharashtra', city: 'Mumbai', userCount: 2, activeSessions: 1, percentageShare: 50.0, flagEmoji: '🇮🇳' },
  { country: 'India', countryCode: 'IN', state: 'Delhi NCR', city: 'Delhi', userCount: 1, activeSessions: 1, percentageShare: 25.0, flagEmoji: '🇮🇳' },
  { country: 'India', countryCode: 'IN', state: 'Karnataka', city: 'Bengaluru', userCount: 1, activeSessions: 0, percentageShare: 25.0, flagEmoji: '🇮🇳' },
  { country: 'Germany', countryCode: 'DE', state: 'Hessen', city: 'Frankfurt', userCount: 0, activeSessions: 0, percentageShare: 0.0, flagEmoji: '🇩🇪' },
];

const MOCK_HEATMAP: HeatmapCell[] = [
  { day: 'Mon', hour: 10, count: 4 },
  { day: 'Mon', hour: 11, count: 6 },
  { day: 'Mon', hour: 14, count: 8 },
  { day: 'Tue', hour: 10, count: 5 },
  { day: 'Tue', hour: 12, count: 12 },
  { day: 'Tue', hour: 15, count: 7 },
  { day: 'Wed', hour: 11, count: 9 },
  { day: 'Wed', hour: 16, count: 14 },
  { day: 'Thu', hour: 10, count: 6 },
  { day: 'Thu', hour: 14, count: 10 },
  { day: 'Fri', hour: 11, count: 15 },
  { day: 'Fri', hour: 17, count: 18 },
  { day: 'Sat', hour: 12, count: 4 },
  { day: 'Sun', hour: 18, count: 2 },
];

const MOCK_DEVICE_BREAKDOWN: DeviceSessionBreakdownData = {
  desktopCount: 3,
  desktopPercent: 75,
  mobileCount: 1,
  mobilePercent: 25,
  tabletCount: 0,
  tabletPercent: 0,
  newUsersCount: 1,
  newUsersPercent: 25,
  returningUsersCount: 3,
  returningUsersPercent: 75,
};

const MOCK_SECURITY_ANOMALY: SecurityAnomalyData = {
  failedLoginCount: 1,
  failedLoginTrend: -50,
  anomalousLoginCount: 1,
  anomalousLoginTrend: 0,
  recentFlaggedEvents: [
    {
      id: 'sec-evt-1',
      timestamp: new Date(Date.now() - 12 * 3600 * 1000).toISOString(),
      location: 'Frankfurt, Germany',
      ipAddress: '185.220.101.5',
      reason: 'Failed credentials from unexpected country',
      severity: 'warning',
    },
  ],
};

export async function fetchDashboardMetrics(): Promise<DashboardMetrics> {
  try {
    const res = await fetch(`${API_BASE_URL}/metrics`);
    if (!res.ok) throw new Error('API request failed');
    const data = await res.json();
    return {
      totalUsers: data.totalUsers ?? 4,
      totalUsersTrend: 14.2,
      activeNowCount: data.activeNowCount ?? 1,
      activeNowTrend: 0,
      loginsTodayCount: data.loginsTodayCount ?? 4,
      loginsTodayTrend: 25.0,
      topSection: 'POS Lite Billing (42.5%)',
      topSectionShare: 42.5,
      topSectionTrend: 14.5,
      topLocation: 'Mumbai, India (75.0%)',
      topLocationShare: 75.0,
      topLocationTrend: 5.0,
      verifiedUserPercentage: data.verifiedUserPercentage ?? 25,
      freePlanCount: data.freePlanCount ?? 4,
      proPlanCount: data.proPlanCount ?? 0,
      enterprisePlanCount: data.enterprisePlanCount ?? 0,
    };
  } catch (err) {
    console.warn('Falling back to direct DB fetch or mock:', err);
    return {
      totalUsers: 4,
      totalUsersTrend: 14.2,
      activeNowCount: 1,
      activeNowTrend: 0,
      loginsTodayCount: 4,
      loginsTodayTrend: 25.0,
      topSection: 'POS Lite Billing (42.5%)',
      topSectionShare: 42.5,
      topSectionTrend: 14.5,
      topLocation: 'Mumbai, India (75.0%)',
      topLocationShare: 75.0,
      topLocationTrend: 5.0,
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

export async function fetchHeatmapData(): Promise<HeatmapCell[]> {
  return MOCK_HEATMAP;
}

export async function fetchDeviceSessionBreakdown(): Promise<DeviceSessionBreakdownData> {
  return MOCK_DEVICE_BREAKDOWN;
}

export async function fetchSecurityAnomalyData(): Promise<SecurityAnomalyData> {
  return MOCK_SECURITY_ANOMALY;
}


