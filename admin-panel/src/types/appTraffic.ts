export type TrafficTimeFrame = '24h' | '7d' | '30d' | 'all';

export type TrafficPlatform = 'mobile' | 'web';

export interface InvoiceTrafficLog {
  id: string;
  invoiceNumber: string;
  platform: TrafficPlatform;
  deviceInfo: string;
  userName: string;
  userEmail: string;
  amount: number;
  itemsCount: number;
  timestamp: string;
  status: 'completed' | 'synced' | 'pending';
}

export interface TelemetryEvent {
  id: string;
  eventName: string;
  platform: TrafficPlatform;
  category: 'invoice' | 'session' | 'sync' | 'security';
  details: string;
  timestamp: string;
  severity: 'info' | 'success' | 'warning';
}

export interface PlatformTrafficMetrics {
  mobileInvoices: number;
  mobileRevenue: number;
  mobileActiveUsers: number;
  webInvoices: number;
  webRevenue: number;
  webActiveUsers: number;
}
