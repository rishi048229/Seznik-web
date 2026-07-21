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

export const getDashboardStats = async (uid: string): Promise<DashboardStats> => {
  return await fetchApi('/reports/dashboard')
}

export const getSalesReport = async (uid: string, startDate: Date, endDate: Date): Promise<SalesReportData> => {
  return await fetchApi(`/reports/sales?start=${encodeURIComponent(startDate.toISOString())}&end=${encodeURIComponent(endDate.toISOString())}`)
}

export const getPLReport = async (uid: string, startDate: Date, endDate: Date): Promise<PLReportData> => {
  return await fetchApi(`/reports/pl?start=${encodeURIComponent(startDate.toISOString())}&end=${encodeURIComponent(endDate.toISOString())}`)
}

export const getTaxReport = async (uid: string, startDate: Date, endDate: Date): Promise<TaxReportData> => {
  return await fetchApi(`/reports/tax?start=${encodeURIComponent(startDate.toISOString())}&end=${encodeURIComponent(endDate.toISOString())}`)
}

export const getRevenueTrend = async (uid: string, days: number): Promise<RevenueTrendData> => {
  return await fetchApi(`/reports/trend?days=${days}`)
}

export const getTopCustomers = async (uid: string, limit = 10): Promise<TopCustomer[]> => {
  return await fetchApi(`/reports/top-customers?limit=${limit}`)
}

export const getPaymentModeBreakdown = async (uid: string): Promise<PaymentModeBreakdown> => {
  return await fetchApi('/reports/payment-modes')
}

export const getProfitBreakdown = async (uid: string): Promise<ProfitBreakdownData> => {
  return await fetchApi('/reports/profit-breakdown')
}

export const getTopProducts = async (uid: string, limit = 5): Promise<TopProduct[]> => {
  return await fetchApi(`/reports/top-products?limit=${limit}`)
}

export const getTopCategories = async (uid: string, limit = 3): Promise<TopCategory[]> => {
  return await fetchApi(`/reports/top-categories?limit=${limit}`)
}

export const getExpenseSummary = async (uid: string): Promise<ExpenseSummaryData> => {
  return await fetchApi('/reports/expense-summary')
}
