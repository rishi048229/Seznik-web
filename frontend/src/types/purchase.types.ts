

import type { PurchaseReturn } from './purchaseReturn.types'
import type { Supplier } from './supplier.types'

export type PurchasePaymentMethod = 'cash' | 'bank' | 'upi' | 'cheque' | 'credit'
export type PurchasePaymentStatus = 'paid' | 'partial' | 'pending'

export interface Purchase {
  id: string
  invoiceNumber: string
  supplierBillNumber?: string | null
  supplierId: string
  supplier?: Partial<Supplier> | null
  items: PurchaseItem[]
  subtotal: number
  totalTax: number
  grandTotal: number
  paymentMethod: PurchasePaymentMethod
  paymentStatus?: PurchasePaymentStatus
  amountPaid: number
  paymentDueDate?: string | Date | null
  notes?: string | null
  returnStatus?: 'none' | 'partial' | 'full'
  totalReturned?: number
  returns?: PurchaseReturn[]
  createdAt: Date | string
}

export interface PurchaseItem {
  productId?: string
  id?: string
  productName: string
  name?: string
  sku?: string
  quantity: number
  costPrice: number
  unitPrice?: number
  taxRate?: number
  taxAmount?: number
  taxableAmount?: number
  gstAmount?: number
  priceIncludesGst?: boolean
  total: number
}


