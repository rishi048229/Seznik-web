export interface UserRecord {
  id: string;
  uid: string;
  email: string | null;
  phone: string | null;
  displayName: string | null;
  businessName: string | null;
  plan: 'free' | 'pro' | 'enterprise';
  role: string;
  emailVerified: boolean;
  onboardingCompleted: boolean;
  createdAt: string;
  lastLoginAt: string;
  location: string;
  city: string;
  country: string;
  countryCode: string;
  ipAddress: string;
}

export interface UserLoginLog {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  userRole: string;
  ipAddress: string;
  city: string;
  country: string;
  countryCode: string;
  device: string;
  browser: string;
  loginAt: string;
  status: 'success' | 'failed' | 'active';
}

export interface SectionUsage {
  id: string;
  sectionName: string;
  path: string;
  iconName: string;
  viewCount: number;
  uniqueUsers: number;
  avgDurationMinutes: number;
  percentageShare: number;
  trend: 'up' | 'down' | 'neutral';
  trendPercent: number;
}

export interface LocationMetric {
  country: string;
  countryCode: string;
  city: string;
  userCount: number;
  activeSessions: number;
  percentageShare: number;
  flagEmoji: string;
}

export interface DashboardMetrics {
  totalUsers: number;
  activeNowCount: number;
  loginsTodayCount: number;
  topSection: string;
  topLocation: string;
  verifiedUserPercentage: number;
  freePlanCount: number;
  proPlanCount: number;
  enterprisePlanCount: number;
}
