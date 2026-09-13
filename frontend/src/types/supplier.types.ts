import type { Purchase } from './purchase.types'
import type { PurchaseReturn } from './purchaseReturn.types'

export interface Supplier {
  id: string
  name: string
  contactPerson?: string | null
  email?: string | null
  phone?: string | null
  address?: string | null
  gstin?: string | null
  payableBalance?: number
  productsSuppliedCount?: number
  purchaseCount?: number
  returnCount?: number
  unpaidPurchasesCount?: number
  oldestUnpaidDueDate?: string | null
  totalPurchaseValue?: number
  totalPaidValue?: number
  lastPurchaseAt?: string | null
  createdAt?: string | Date
  updatedAt?: string | Date
}

export interface SupplierTransaction {
  id: string
  supplierId: string
  amount: number
  type: 'purchase' | 'payment' | 'debit_note_reversal'
  paymentMethod?: string | null
  referenceId?: string | null
  notes?: string | null
  userId?: string
  createdAt: string | Date
}

export interface SupplierLedgerStats {
  payableBalance: number
  totalPurchaseValue: number
  totalPaidValue: number
  totalReturnedValue: number
  unpaidPurchasesCount: number
  overdueCount: number
  overdueAmount: number
}

export interface SupplierLedger {
  supplier: Supplier & {
    productsCount?: number
    purchasesCount?: number
    returnsCount?: number
  }
  stats: SupplierLedgerStats
  purchases: Purchase[]
  transactions: SupplierTransaction[]
  returns: PurchaseReturn[]
}

export interface SupplierReminderItem {
  purchaseId: string
  invoiceNumber: string
  supplierBillNumber?: string | null
  supplierId: string
  supplierName: string
  supplierPhone: string
  grandTotal: number
  amountPaid: number
  outstandingAmount: number
  paymentDueDate: string
  isOverdue: boolean
}

export interface SupplierRemindersResponse {
  overdue: SupplierReminderItem[]
  upcoming: SupplierReminderItem[]
  totalActionItems: number
}

