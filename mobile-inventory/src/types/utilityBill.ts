export interface UtilityBill {
  id: string;
  userId: string;
  receiptNumber: string;
  kioskName: string;
  billType: string; // 'ELECTRICITY' | 'WATER' | 'GAS' | 'BROADBAND' | 'UTILITY'
  provider: string; // e.g. 'UPPCL Urban'
  consumerNumber: string;
  consumerName: string;
  dueDate?: string | null;
  billDate?: string | null;
  unitsConsumed?: string | null;
  billAmount: number;
  convenienceFee: number;
  totalAmount: number;
  status: string; // 'SUCCESS'
  paymentMode: string; // 'CASH' | 'UPI' | 'CARD'
  customerPhone?: string | null;
  operatorName?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UtilityBillStats {
  totalBills: number;
  totalCollected: number;
  totalConvenienceFee: number;
  totalBillAmount: number;
  todayCount: number;
  todayCollected: number;
  todayFee: number;
  topProviders: Array<{
    provider: string;
    count: number;
    amount: number;
  }>;
  typeCounts: Record<string, number>;
}

export interface UtilityBillExtractResult {
  billType: string;
  provider: string;
  consumerNumber: string;
  consumerName: string;
  dueDate: string;
  billDate: string;
  unitsConsumed: string;
  billAmount: number;
  rawTextSnippet?: string;
}

export interface CreateUtilityBillPayload {
  receiptNumber?: string;
  kioskName?: string;
  billType: string;
  provider: string;
  consumerNumber: string;
  consumerName: string;
  dueDate?: string;
  billDate?: string;
  unitsConsumed?: string;
  billAmount: number;
  convenienceFee: number;
  paymentMode?: string;
  customerPhone?: string;
  operatorName?: string;
  notes?: string;
}
