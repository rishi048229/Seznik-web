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
  lastUpdatedAt?: string;
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
  device?: string;
  browser?: string;
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
  avgDurationMinutes?: number;
  percentageShare: number;
  trend: 'up' | 'down' | 'neutral';
  trendPercent: number;
}

export interface DashboardMetrics {
  totalUsers: number;
  totalUsersTrend: number;
  invoicesTodayCount?: number;
  invoicesTodayTrend?: number;
  mobileInvoicesCount?: number;
  webInvoicesCount?: number;
  mobileInvoicesPercent?: number;
  webInvoicesPercent?: number;
  mobileRevenue?: number;
  webRevenue?: number;
  totalMobileInvoices?: number;
  totalWebInvoices?: number;
  totalSalesCount?: number;
  totalRevenue?: number;
  activeInvoicingUsersToday?: number;
  activeInvoicingUsersTrend?: number;
  activeNowCount?: number;
  activeNowTrend?: number;
  loginsTodayCount?: number;
  loginsTodayTrend?: number;
  topSection: string;
  topSectionShare: number;
  topSectionTrend: number;
  verifiedUserPercentage: number;
  freePlanCount?: number;
  proPlanCount?: number;
  enterprisePlanCount?: number;
  timeRange?: string;
  timeWindowLabel?: string;
}

export interface InvoiceRecord {
  id: string;
  invoiceNumber: string;
  platform: 'mobile' | 'web';
  grandTotal: number;
  subtotal: number;
  totalTax: number;
  totalDiscount: number;
  paymentMethod: string;
  isQuickBill: boolean;
  createdAt: string;
  userId?: string;
  userName?: string;
  userEmail?: string;
  customerName?: string;
  customerPhone?: string;
}

export interface HeatmapCell {
  /** ISO calendar date (YYYY-MM-DD) in IST — primary row key */
  date?: string;
  /** Short weekday label (Mon, Tue, …) */
  day: string;
  hour: number;
  count: number;
  uniqueUsers?: number;
}

export interface HeatmapResponse {
  cells: HeatmapCell[];
  requestsToday: number;
  requestsThisHour: number;
  requestsThisWeek: number;
  totalAllTime: number;
  currentWeekRange: string;
  /** Present when hour buckets are already Asia/Kolkata wall-clock hours. */
  hoursTimezone?: 'IST' | 'UTC';
}

export interface DeviceSessionBreakdownData {
  desktopCount: number;
  desktopPercent: number;
  mobileCount: number;
  mobilePercent: number;
  totalInvoices?: number;
}

export interface AdminProduct {
  id: string;
  name: string;
  sku: string;
  sellingPrice: number;
  categoryName: string;
  createdAt: string;
}

export interface HealthDatabaseStatus {
  status: 'connected' | 'disconnected';
  latencyMs?: number;
  error?: string;
}

export interface HealthCheckResult {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  uptimeSeconds?: number;
  database?: HealthDatabaseStatus;
  environment?: string;
  memoryUsageMb?: number;
  port?: number;
  serverLatencyMs?: number;
  error?: string;
}

export interface FeedbackRecord {
  id: string;
  area: string;
  rating: number | null;
  message: string;
  platform: string;
  productId: string;
  productName: string;
  createdAt: string;
  displayName: string | null;
  phone: string | null;
  email: string | null;
  businessName: string | null;
}

export interface FeedbackListResponse {
  items: FeedbackRecord[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

