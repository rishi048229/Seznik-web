export interface LowStockProductItem {
  id: string;
  name: string;
  currentStock: number;
  threshold: number;
}

export interface RecentSaleItem {
  id: string;
  invoiceNumber: string;
  grandTotal: number;
  createdAt: number;
}

export interface DashboardStats {
  todayRevenue: number;
  todayInvoices: number;
  todayGrossProfit: number;
  totalCustomers: number;
  totalProductCount?: number;
  totalStockValue?: number;
  lowStockCount: number;
  lowStockProducts: LowStockProductItem[];
  recentSales: RecentSaleItem[];
}
