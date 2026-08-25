export type KOTOrderStatus =
  | 'open'
  | 'sent_to_kitchen'
  | 'preparing'
  | 'ready'
  | 'served'
  | 'billed'
  | 'cancelled'

export type KOTOrderType = 'dine_in' | 'takeaway' | 'delivery'

export type KOTPriority = 'normal' | 'urgent'

export interface RestaurantTableActiveOrder {
  id: string
  orderNumber: number
  status: KOTOrderStatus
  itemsCount: number
  totalAmount: number
  createdAt: string
}

export interface RestaurantTable {
  id: string
  name: string
  capacity: number | null
  isActive: boolean
  sortOrder: number
  isOccupied: boolean
  activeOrder: RestaurantTableActiveOrder | null
  createdAt?: string
  updatedAt?: string
}

export interface KOTOrderItem {
  id: string
  orderId: string
  productId: string | null
  productName: string
  quantity: number
  unitPrice: number
  taxRate: number
  notes: string | null
  modifiers: string[]
  status: string
  sentToKitchenAt: string | null
  userId: string
  createdAt: string
  updatedAt: string
}

export interface KOTTableRef {
  id: string
  name: string
  capacity?: number | null
}

export interface KOTCustomerRef {
  id: string
  name: string
  phone?: string | null
}

export interface KOTOrder {
  id: string
  orderNumber: number
  orderType: KOTOrderType | string
  tableId: string | null
  table: KOTTableRef | null
  partyLabel: string | null
  guestCount: number | null
  customerId: string | null
  customer: KOTCustomerRef | null
  status: KOTOrderStatus | string
  notes: string | null
  priority: KOTPriority | string
  contactNumber: string | null
  waiterName: string | null
  locationId: string | null
  sentToKitchenAt: string | null
  saleId: string | null
  sale?: unknown
  items: KOTOrderItem[]
  userId: string
  createdAt: string
  updatedAt: string
  subtotal: number
  totalTax: number
  grandTotal: number
}

export interface KOTDraftItem {
  tempId: string
  productId?: string
  productName: string
  quantity: number
  unitPrice: number
  taxRate: number
  notes?: string
  modifiers: string[]
  imageURL?: string
}

export interface CreateKOTOrderPayload {
  orderType?: KOTOrderType
  tableId?: string
  partyLabel?: string
  guestCount?: number
  customerId?: string
  contactNumber?: string
  notes?: string
  waiterName?: string
  locationId?: string
  priority?: KOTPriority
  status?: KOTOrderStatus
  items: Array<{
    productId?: string
    productName: string
    quantity: number
    unitPrice: number
    taxRate?: number
    notes?: string
    modifiers?: string[]
  }>
}

export interface KOTBillPayload {
  paymentMethod: 'cash' | 'card' | 'upi' | 'credit'
  discount?: number
  amountPaid?: number
  customerId?: string
}

export interface SendToKitchenResult extends KOTOrder {
  newlySentItems: KOTOrderItem[]
}

export interface KOTBillResult {
  order: KOTOrder
  sale: {
    id: string
    invoiceNumber: string
    customerId?: string | null
    items: unknown
    subtotal: number
    totalDiscount: number
    totalTax: number
    grandTotal: number
    paymentMethod: string
    amountPaid: number
    changeReturned: number
    createdAt: string
  }
}
