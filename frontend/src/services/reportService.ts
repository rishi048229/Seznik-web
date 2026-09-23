import { fetchApi } from './api'
import type {
  DashboardStats,
  SalesReportData,
  PLReportData,
  TaxReportData,
  RevenueTrendData,
  TopCustomer,
  PaymentModeBreakdown,
  ProfitBreakdownData,
  TopProduct,
  TopCategory,
  ExpenseSummaryData,
} from '@/types/report.types'

export const getDashboardStats = async (_uid: string): Promise<DashboardStats> => {
  return await fetchApi('/reports/dashboard')
}

export interface RestaurantDashboard {
  runningCount: number
  ordersToday: number
  revenueToday: number
  occupancyPct: number
  avgWaitMinutes: number
  runningOrders: Array<{ id: string; orderNumber: number; status: string; tableName: string; createdAt: string; itemCount: number }>
  topItems: Array<{ name: string; qty: number; amount: number; category: string }>
  categories: Array<{ name: string; amount: number }>
  kitchen: { lowStock: number; outOfStock: number; tracked: number }
  recentSales: Array<{ id: string; invoiceNumber: string; grandTotal: number; createdAt: string }>
}

export const getRestaurantDashboard = async (): Promise<RestaurantDashboard> => {
  return await fetchApi('/reports/restaurant-dashboard')
}

export const getSalesReport = async (_uid: string, startDate: Date, endDate: Date): Promise<SalesReportData> => {
  return await fetchApi(`/reports/sales?start=${encodeURIComponent(startDate.toISOString())}&end=${encodeURIComponent(endDate.toISOString())}`)
}

export const getPLReport = async (_uid: string, startDate: Date, endDate: Date): Promise<PLReportData> => {
  return await fetchApi(`/reports/pl?start=${encodeURIComponent(startDate.toISOString())}&end=${encodeURIComponent(endDate.toISOString())}`)
}

export const getTaxReport = async (_uid: string, startDate: Date, endDate: Date): Promise<TaxReportData> => {
  return await fetchApi(`/reports/tax?start=${encodeURIComponent(startDate.toISOString())}&end=${encodeURIComponent(endDate.toISOString())}`)
}

export const getRevenueTrend = async (_uid: string, days: number): Promise<RevenueTrendData> => {
  return await fetchApi(`/reports/trend?days=${days}`)
}

export const getTopCustomers = async (_uid: string, limit = 10): Promise<TopCustomer[]> => {
  return await fetchApi(`/reports/top-customers?limit=${limit}`)
}

export const getPaymentModeBreakdown = async (_uid: string): Promise<PaymentModeBreakdown> => {
  return await fetchApi('/reports/payment-modes')
}

export const getProfitBreakdown = async (_uid: string): Promise<ProfitBreakdownData> => {
  return await fetchApi('/reports/profit-breakdown')
}

export const getTopProducts = async (_uid: string, limit = 5): Promise<TopProduct[]> => {
  return await fetchApi(`/reports/top-products?limit=${limit}`)
}

export const getTopCategories = async (_uid: string, limit = 3): Promise<TopCategory[]> => {
  return await fetchApi(`/reports/top-categories?limit=${limit}`)
}

export const getExpenseSummary = async (_uid: string): Promise<ExpenseSummaryData> => {
  return await fetchApi('/reports/expense-summary')
}

