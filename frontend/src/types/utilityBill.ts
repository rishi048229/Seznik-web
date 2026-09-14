export type UtilityBillType = 'ELECTRICITY' | 'WATER' | 'GAS' | 'BROADBAND' | 'UTILITY'
export type UtilityPaymentMode = 'CASH' | 'UPI' | 'CARD'

export interface UtilityBill {
  id: string
  userId: string
  receiptNumber: string
  kioskName: string
  billType: UtilityBillType
  provider: string
  consumerNumber: string
  consumerName: string
  dueDate?: string | null
  billDate?: string | null
  unitsConsumed?: string | null
  billAmount: number
  convenienceFee: number
  totalAmount: number
  status: string
  paymentMode: string
  customerPhone?: string | null
  operatorName?: string | null
  createdAt: string
  updatedAt: string
}

export interface UtilityBillStats {
  totalBills: number
  totalCollected: number
  totalConvenienceFee: number
  totalBillAmount: number
  todayCount: number
  todayCollected: number
  todayFee: number
  topProviders: Array<{ provider: string; count: number; amount: number }>
  typeCounts: Record<string, number>
}

export interface UtilityBillExtractResult {
  billType: string
  provider: string
  consumerNumber: string
  consumerName: string
  dueDate: string
  billDate: string
  unitsConsumed: string
  billAmount: number
  rawTextSnippet?: string
}

export interface UtilityBillListResponse {
  bills: UtilityBill[]
  total: number
  page: number
  limit: number
}

export interface CreateUtilityBillPayload {
  kioskName: string
  billType: UtilityBillType | string
  provider: string
  consumerNumber: string
  consumerName: string
  dueDate?: string
  billDate?: string
  unitsConsumed?: string
  billAmount: number
  convenienceFee: number
  totalAmount: number
  paymentMode: UtilityPaymentMode | string
  customerPhone?: string
  operatorName?: string
}
