

export interface Customer {
  id: string
  name: string
  phone: string
  email?: string
  address?: string
  creditBalance: number
  creditLimit: number
  createdAt: Date
}

export interface CreditTransaction {
  id: string
  customerId: string
  amount: number
  type: 'credit' | 'payment'
  referenceId?: string
  notes?: string
  createdAt: Date
}
