

export interface Expense {
  id: string
  category: 'rent' | 'utilities' | 'salaries' | 'inventory' | 'marketing' | 'maintenance' | 'other'
  amount: number
  description: string
  paymentMethod: 'cash' | 'bank' | 'upi' | 'card'
  receiptImageURL?: string
  expenseDate: Date
  createdAt: Date
}
