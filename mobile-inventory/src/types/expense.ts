export interface Expense {
  id: string;
  amount: number;
  category: string;
  description?: string | null;
  notes?: string | null;
  paymentMethod?: string;
  receiptImageURL?: string | null;
  receiptImageUrl?: string | null;
  expenseDate?: string;
  date?: string;
  createdAt?: string;
}

export interface CreateExpensePayload {
  amount: number;
  category: string;
  description?: string;
  notes?: string;
  paymentMethod?: string;
  receiptImageURL?: string;
  receiptImageUrl?: string;
  expenseDate?: string;
  date?: string;
}
