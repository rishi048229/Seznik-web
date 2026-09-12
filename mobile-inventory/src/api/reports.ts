import { fetchApi } from './client';
import { DashboardStats } from '@/types/dashboard';

export interface SalesReportData {
  labels: string[];
  revenue: number[];
  invoiceCount: number[];
}

export interface PLReportData {
  grossBilled: number;
  taxCollected: number;
  returnsDeducted: number;
  netRevenue: number;
  totalRevenue: number;
  totalCost: number;
  grossProfit: number;
  totalExpenses: number;
  netProfit: number;
  period: string;
}

export interface TaxReportData {
  totalOutputTax: number;
  taxableSales: number;
  period: string;
}

export interface RevenueTrendData {
  labels: string[];
  revenue: number[];
  profit: number[];
}

export interface TopCustomerData {
  id: string;
  name: string;
  totalSpent: number;
  invoiceCount: number;
  lastPurchase: number;
}

export interface PaymentModeBreakdownData {
  totalSales: number;
  modes: { method: string; amount: number; count: number; percent: number }[];
}

export interface ProfitBreakdownData {
  revenue: number;
  tax: number;
  cost: number;
  profit: number;
  marginPercent: number;
}

export interface TopProductData {
  id: string;
  name: string;
  categoryName?: string;
  unitsSold: number;
  revenue: number;
  averagePrice?: number;
}

export interface TopCategoryData {
  name: string;
  revenue: number;
}

export interface ExpenseSummaryData {
  today: number;
  thisMonth: number;
  collectionsNonCredit: number;
  net: number;
}

export interface DaybookTransaction {
  type: 'sale' | 'expense' | 'credit_payment' | 'credit_given';
  amount: number;
  isCredit: boolean;
  description: string;
  createdAt: string;
}

export interface GstProductDetail {
  name: string;
  quantity: number;
  taxRate: number;
  taxableAmount: number;
  cgst: number;
  sgst: number;
  totalGst: number;
  totalAmount: number;
}

export interface DaybookGstSummary {
  collected: number;
  paid: number;
  net: number;
  cgstCollected: number;
  sgstCollected: number;
  products: GstProductDetail[];
}

export interface DaybookData {
  date: string;
  moneyIn: number;
  moneyOut: number;
  netBalance: number;
  creditGiven: number;
  creditCollectedToday: number;
  paymentModeBreakdown: { method: string; amount: number }[];
  gstSummary?: DaybookGstSummary;
  gstCollectedToday: { total: number; cgst: number; sgst: number };
  topSellingItemToday: { name: string; unitsSold: number; revenue: number } | null;
  remindersSentToday: number;
  lowStockAlertCount: number;
  transactions: DaybookTransaction[];
}

export interface DayCloseRecord {
  id: string;
  closeDate: string;
  expectedCash: number;
  countedCash: number;
  variance: number;
  notes?: string | null;
  createdAt: string;
}

export const reportsApi = {
  getDashboardStats: async (): Promise<DashboardStats> => {
    return fetchApi<DashboardStats>('/reports/dashboard');
  },

  getSalesReport: async (start?: string, end?: string): Promise<SalesReportData> => {
    const params = new URLSearchParams();
    if (start) params.append('start', start);
    if (end) params.append('end', end);
    return fetchApi<SalesReportData>(`/reports/sales?${params.toString()}`);
  },

  getPLReport: async (start?: string, end?: string): Promise<PLReportData> => {
    const params = new URLSearchParams();
    if (start) params.append('start', start);
    if (end) params.append('end', end);
    return fetchApi<PLReportData>(`/reports/pl?${params.toString()}`);
  },

  getTaxReport: async (start?: string, end?: string): Promise<TaxReportData> => {
    const params = new URLSearchParams();
    if (start) params.append('start', start);
    if (end) params.append('end', end);
    return fetchApi<TaxReportData>(`/reports/tax?${params.toString()}`);
  },

  /** period: 'month' (this calendar month, daily) | 'daily' (last N days) | 'weekly' | 'monthly' (last N months) */
  getRevenueTrend: async (period: 'month' | 'daily' | 'weekly' | 'monthly' = 'month', span?: number): Promise<RevenueTrendData> => {
    const daysCount =
      period === 'monthly'
        ? span ? span * 30 : 90
        : period === 'weekly'
          ? span ? span * 7 : 28
          : period === 'month'
            ? 0
            : span || 7;
    const params = new URLSearchParams({ period, days: String(daysCount) });
    return fetchApi<RevenueTrendData>(`/reports/trend?${params.toString()}`);
  },

  getTopCustomers: async (limit = 10): Promise<TopCustomerData[]> => {
    return fetchApi<TopCustomerData[]>(`/reports/top-customers?limit=${limit}`);
  },

  getPaymentModeBreakdown: async (): Promise<PaymentModeBreakdownData> => {
    return fetchApi<PaymentModeBreakdownData>('/reports/payment-modes');
  },

  getProfitBreakdown: async (): Promise<ProfitBreakdownData> => {
    return fetchApi<ProfitBreakdownData>('/reports/profit-breakdown');
  },

  getTopProducts: async (limit = 100, start?: string, end?: string): Promise<TopProductData[]> => {
    const params = new URLSearchParams({ limit: String(limit) });
    if (start) params.append('start', start);
    if (end) params.append('end', end);
    return fetchApi<TopProductData[]>(`/reports/top-products?${params.toString()}`);
  },

  getTopCategories: async (limit = 3): Promise<TopCategoryData[]> => {
    return fetchApi<TopCategoryData[]>(`/reports/top-categories?limit=${limit}`);
  },

  getExpenseSummary: async (): Promise<ExpenseSummaryData> => {
    return fetchApi<ExpenseSummaryData>('/reports/expense-summary');
  },

  getDaybook: async (date?: string): Promise<DaybookData> => {
    const query = date ? `?date=${date}` : '';
    return fetchApi<DaybookData>(`/reports/daybook${query}`);
  },

  getDayCloseStatus: async (date?: string): Promise<DayCloseRecord | null> => {
    const query = date ? `?date=${date}` : '';
    return fetchApi<DayCloseRecord | null>(`/reports/day-close${query}`);
  },

  closeDayRegister: async (countedCash: number, notes?: string): Promise<DayCloseRecord> => {
    return fetchApi<DayCloseRecord>('/reports/day-close', {
      method: 'POST',
      body: JSON.stringify({ countedCash, notes }),
    });
  },
};
