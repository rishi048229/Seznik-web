// ─── Connection & Printer ───────────────────────────────────────────────────

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'warning' | 'scanning';

export interface PrinterDevice {
  id: string;
  name: string;
  macAddress?: string;
  signalStrength?: number;
  type?: 'receipt' | 'label' | 'dual';
}

export interface PrintResult {
  success: boolean;
  error?: string;
}

// ─── Business Mode ──────────────────────────────────────────────────────────

export type BusinessMode = 'fixed' | 'product' | 'hybrid';

// ─── Shop Profile ───────────────────────────────────────────────────────────

export interface ShopProfile {
  name: string;
  logoUri?: string;
  address?: string;
  phone?: string;
  taxId?: string;
}

// ─── Rate Tiles (Fixed-Price Mode) ──────────────────────────────────────────

export interface RateTile {
  id: string;
  label: string;
  price: number;
  order: number;
  color?: string;
}

// ─── Categories (First-Class) ───────────────────────────────────────────────

export interface Category {
  id: string;
  name: string;
  order: number;
}

// ─── Vendors ────────────────────────────────────────────────────────────────

export interface Vendor {
  id: string;
  name: string;
  contact: string;
  email?: string;
  address?: string;
  taxId?: string;
}

// ─── Products ───────────────────────────────────────────────────────────────

export interface Product {
  id: string;
  name: string;
  barcode: string;
  sku?: string;
  categoryId?: string;
  /** @deprecated Use categoryId instead. Kept for migration compatibility. */
  category?: string;
  unit?: string;
  price: number;
  costPrice?: number;
  stockQty: number;
  reorderThreshold: number;
  vendorId?: string;
  imageUri?: string;
  archived?: boolean;
  createdAt: string;
  updatedAt: string;
}

// ─── Customers ──────────────────────────────────────────────────────────────

export interface Customer {
  id: string;
  name: string;
  phone: string;
  address?: string;
  totalSpend: number;
  visitCount: number;
  lastVisitAt: string;
  isMonthlyPass?: boolean;
  passExpiryDate?: string;
  creditBalance?: number;
  notes?: string;
  createdAt: string;
}

// ─── Expenses ───────────────────────────────────────────────────────────────

export interface Expense {
  id: string;
  category: string;
  amount: number;
  note?: string;
  date: string;
}

// ─── Billing ────────────────────────────────────────────────────────────────

export type BillType = 'fixed' | 'product';
export type PaymentMethod = 'cash' | 'card' | 'upi' | 'other';

export interface BillItem {
  productId: string;
  name: string;
  categoryId?: string;
  unit?: string;
  qty: number;
  unitPrice: number;
  costPrice?: number;
  lineTotal: number;
}

export interface QuickBillItem {
  tileId: string;
  label: string;
  price: number;
}

export interface Bill {
  id: string;
  type: BillType;
  items: BillItem[] | QuickBillItem[];
  subtotal: number;
  gstMode?: 'inclusive' | 'exclusive';
  taxPercent: number;
  discount: { type: 'flat' | 'percent'; value: number };
  total: number;
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  paymentMethod?: PaymentMethod;
  amountReceived?: number;
  customField?: string;
  notes?: string;
  printStatus: 'not_printed' | 'printed' | 'failed';
  createdAt: string;
}

// ─── Stock History ──────────────────────────────────────────────────────────

export type StockActionType = 'restock' | 'sale' | 'deduct';

export interface StockHistoryItem {
  id: string;
  productId: string;
  type: StockActionType;
  qty: number;
  date: string;
  description: string;
  reasonCode?: 'damaged' | 'expired' | 'returned' | 'correction' | 'sold_outside';
}

// ─── Staff / Roles ──────────────────────────────────────────────────────────

export type UserRole = 'Owner' | 'Manager' | 'Staff';

export interface StaffAccount {
  id: string;
  name: string;
  role: UserRole;
  pin?: string;
}
