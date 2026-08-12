export interface UserRecord {
  id: string | number;
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
  isBanned?: boolean;
  banReason?: string;
  bannedAt?: string;
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
  actionType?: 'login' | 'module_access' | 'billing' | 'export' | 'security_flag';
  actionDetails?: string;
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
  flagEmoji?: string;
}

export interface DashboardMetrics {
  totalUsers: number;
  totalUsersTrend: number;
  activeNowCount: number;
  activeNowTrend: number;
  loginsTodayCount: number;
  loginsTodayTrend: number;
  topSection: string;
  topSectionShare: number;
  topSectionTrend: number;
  topLocation: string;
  topLocationShare: number;
  topLocationTrend: number;
  verifiedUserPercentage: number;
  freePlanCount: number;
  proPlanCount: number;
  enterprisePlanCount: number;
}

export interface HeatmapCell {
  day: string;
  hour: number;
  count: number;
}

export interface DeviceSessionBreakdownData {
  desktopCount: number;
  desktopPercent: number;
  mobileCount: number;
  mobilePercent: number;
  tabletCount: number;
  tabletPercent: number;
  newUsersCount: number;
  newUsersPercent: number;
  returningUsersCount: number;
  returningUsersPercent: number;
}

export interface FlaggedSecurityEvent {
  id: string;
  timestamp: string;
  location: string;
  ipAddress: string;
  reason: string;
  severity: 'warning' | 'critical';
}

export interface SecurityAnomalyData {
  failedLoginCount: number;
  failedLoginTrend: number;
  anomalousLoginCount: number;
  anomalousLoginTrend: number;
  recentFlaggedEvents: FlaggedSecurityEvent[];
}

