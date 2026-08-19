export type KOTOrderStatus =
  | 'open'
  | 'sent_to_kitchen'
  | 'preparing'
  | 'ready'
  | 'served'
  | 'billed'
  | 'cancelled';

export type KOTOrderType = 'dine_in' | 'takeaway' | 'delivery';

export type KOTPriority = 'normal' | 'urgent';

export interface RestaurantTable {
  id: string;
  name: string;
  isActive: boolean;
  sortOrder: number;
  isOccupied?: boolean;
  activeOrder?: {
    id: string;
    orderNumber: number;
    status: KOTOrderStatus;
    itemsCount: number;
    totalAmount: number;
    createdAt: string;
  } | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface KOTOrderItem {
  id: string;
  orderId: string;
  productId?: string | null;
  productName: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  notes?: string | null;
  modifiers: string[];
  status?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface KOTOrder {
  id: string;
  orderNumber: number;
  orderType: KOTOrderType;
  tableId?: string | null;
  table?: RestaurantTable | null;
  partyLabel?: string | null;
  guestCount?: number | null;
  customerId?: string | null;
  customer?: { id: string; name: string; phone?: string } | null;
  status: KOTOrderStatus;
  notes?: string | null;
  priority: KOTPriority;
  contactNumber?: string | null;
  sentToKitchenAt?: string | null;
  saleId?: string | null;
  sale?: any;
  items: KOTOrderItem[];
  subtotal?: number;
  totalTax?: number;
  grandTotal?: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateKOTOrderPayload {
  orderType?: KOTOrderType;
  tableId?: string;
  partyLabel?: string;
  guestCount?: number;
  customerId?: string;
  contactNumber?: string;
  notes?: string;
  priority?: KOTPriority;
  status?: KOTOrderStatus;
  items: {
    productId?: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    taxRate?: number;
    notes?: string;
    modifiers?: string[];
  }[];
}

export interface GenerateKOTBillPayload {
  paymentMethod?: string;
  discount?: number;
  amountPaid?: number;
}
