import { fetchApi } from './client';

export type AgeingBucket = '0-7' | '8-15' | '16-30' | '30+';

export interface CreditTransaction {
  id: string;
  customerId: string;
  amount: number;
  type: 'credit' | 'payment';
  referenceId?: string | null;
  notes?: string | null;
  userId: string;
  createdAt: string;
  runningBalance?: number;
}

export interface CreateCreditTransactionPayload {
  customerId: string;
  amount: number;
  type: 'credit' | 'payment';
  referenceId?: string;
  notes?: string;
}

export interface SaleItemLine {
  productId?: string;
  productName: string;
  quantity: number;
  unitPrice?: number;
  total?: number;
}

export interface CustomerBill {
  id: string;
  type: 'sale' | 'manual';
  invoiceNumber: string | null;
  items: SaleItemLine[] | null;
  notes?: string | null;
  originalAmount: number;
  outstandingAmount: number;
  isPaid: boolean;
  date: string;
}

export interface CustomerInvoice {
  id: string;
  invoiceNumber: string;
  items: SaleItemLine[];
  grandTotal: number;
  paymentMethod: string;
  amountPaid: number;
  createdAt: string;
}

export interface CustomerLedger {
  customer: {
    id: string;
    name: string;
    phone: string;
    address?: string | null;
    creditBalance: number;
    creditLimit: number;
    oldestUnpaidSince: string | null;
    daysOverdue: number;
    ageingBucket: AgeingBucket | null;
    customerSince: string;
    totalSpent: number;
    totalVisits: number;
    lastVisitAt: string | null;
  };
  transactions: CreditTransaction[];
  bills: CustomerBill[];
  sales: CustomerInvoice[];
}

export interface ReminderDue {
  id: string;
  name: string;
  phone: string;
  creditBalance: number;
  oldestUnpaidSince: string;
  daysOverdue: number;
  ageingBucket: AgeingBucket;
  lastReminderSentAt: string | null;
  oldestUnpaidBill: CustomerBill | null;
}

export interface ReminderLogEntry {
  id: string;
  customerId: string;
  amount: number;
  sentAt: string;
  customer?: { name: string; phone: string };
}

export const creditsApi = {
  getTransactions: async (customerId?: string): Promise<CreditTransaction[]> => {
    const query = customerId ? `?customerId=${customerId}` : '';
    return fetchApi<CreditTransaction[]>(`/credits${query}`);
  },

  createTransaction: async (payload: CreateCreditTransactionPayload): Promise<CreditTransaction> => {
    return fetchApi<CreditTransaction>('/credits', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  deleteTransaction: async (id: string): Promise<{ success: boolean }> => {
    return fetchApi<{ success: boolean }>(`/credits/${id}`, { method: 'DELETE' });
  },

  getCustomerLedger: async (customerId: string): Promise<CustomerLedger> => {
    return fetchApi<CustomerLedger>(`/credits/customer/${customerId}`);
  },

  getRemindersDue: async (thresholdDays = 30, cooldownDays = 7): Promise<ReminderDue[]> => {
    return fetchApi<ReminderDue[]>(`/credits/reminders/due?thresholdDays=${thresholdDays}&cooldownDays=${cooldownDays}`);
  },

  logReminderSent: async (customerId: string, amount: number): Promise<ReminderLogEntry> => {
    return fetchApi<ReminderLogEntry>('/credits/reminders', {
      method: 'POST',
      body: JSON.stringify({ customerId, amount }),
    });
  },

  getReminderHistory: async (date?: string): Promise<ReminderLogEntry[]> => {
    const query = date ? `?date=${date}` : '';
    return fetchApi<ReminderLogEntry[]>(`/credits/reminders${query}`);
  },
};
