export interface DashboardStats {
  todayRevenue: number
  todayInvoices: number
  lowStockCount: number
  lowStockProducts: LowStockProduct[]
  recentSales: RecentSale[]
}

export interface LowStockProduct {
  id: string
  name: string
  currentStock: number
  threshold: number
}

export interface RecentSale {
  id: string
  invoiceNumber: string
  grandTotal: number
  createdAt: number
}

export interface SalesReportData {
  labels: string[]
  revenue: number[]
  invoiceCount: number[]
}

export interface PLReportData {
  totalRevenue: number
  totalCost: number
  totalExpenses: number
  netProfit: number
  period: string
}

export interface TaxReportData {
  totalOutputTax: number
  taxableSales: number
  period: string
}

export interface RevenueTrendData {
  labels: string[]
  revenue: number[]
  profit: number[]
}

export interface TopCustomer {
  id: string
  name: string
  totalSpent: number
  invoiceCount: number
  lastPurchase: number
}

export interface PaymentModeBreakdown {
  totalSales: number
  modes: { method: string; amount: number; count: number; percent: number }[]
}

export interface ProfitBreakdownData {
  revenue: number
  tax: number
  cost: number
  profit: number
  marginPercent: number
}

export interface TopProduct {
  id: string
  name: string
  unitsSold: number
  revenue: number
}

export interface TopCategory {
  name: string
  revenue: number
}

export interface ExpenseSummaryData {
  today: number
  thisMonth: number
  collectionsNonCredit: number
  net: number
}
