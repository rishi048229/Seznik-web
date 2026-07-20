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
