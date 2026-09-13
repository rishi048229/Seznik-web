import { fetchApi } from './api'

export interface StoreNotification {
  id: string
  title: string
  message: string
  type: 'out_of_stock' | 'low_stock' | 'credit_due' | 'purchase_due' | 'daily_sales_summary' | 'announcement' | 'supplies_refill' | 'product_launch' | 'feature_tip' | 'weekly_summary'
  severity: 'critical' | 'urgent' | 'warning' | 'info'
  productId?: string
  productName?: string
  currentStock?: number
  lowStockThreshold?: number
  unit?: string
  saleId?: string
  invoiceNumber?: string
  customerId?: string
  customerName?: string
  customerPhone?: string
  supplierId?: string
  supplierName?: string
  supplierPhone?: string
  purchaseId?: string
  amount?: number
  dueDate?: string | null
  isOverdue?: boolean
  totalSales?: number
  ordersCount?: number
  createdAt: string
  read?: boolean
}

export interface NotificationFeedResponse {
  success: boolean
  count: number
  notifications: StoreNotification[]
}

export const getNotificationFeed = async (): Promise<NotificationFeedResponse> => {
  return await fetchApi<NotificationFeedResponse>('/notifications/feed')
}

export const triggerStockCheck = async (): Promise<{ success: boolean; lowStockCount: number }> => {
  return await fetchApi<{ success: boolean; lowStockCount: number }>('/notifications/check-stock', {
    method: 'POST',
  })
}

export const triggerCreditDueCheck = async (): Promise<{ success: boolean; customersDueCount: number }> => {
  return await fetchApi<{ success: boolean; customersDueCount: number }>('/notifications/check-credit-due', {
    method: 'POST',
  })
}

export const triggerSupplierDueCheck = async (): Promise<{ success: boolean; suppliersDueCount: number }> => {
  return await fetchApi<{ success: boolean; suppliersDueCount: number }>('/notifications/check-supplier-due', {
    method: 'POST',
  })
}
