import type { Purchase } from './purchase.types';
import type { Supplier } from './supplier.types';

export interface PurchaseReturnItem {
  productId?: string;
  productName: string;
  quantity: number;
  unitCost: number;
  taxRate: number;
  taxableAmount: number;
  gstAmount: number;
  refundAmount: number;
}

export type PurchaseReturnSettlementMethod =
  | 'cash'
  | 'bank_transfer'
  | 'adjust_against_payable'
  | 'supplier_credit';

export type PurchaseReturnReason =
  | 'damaged'
  | 'wrong_item'
  | 'quality_reject'
  | 'excess_stock'
  | 'other';

export interface PurchaseReturn {
  id: string;
  returnNumber: string;
  purchaseId: string;
  purchase?: Partial<Purchase>;
  supplierId?: string | null;
  supplier?: Partial<Supplier> | null;
  items: PurchaseReturnItem[];
  subtotal: number;
  totalTax: number;
  refundAmount: number;
  settlementMethod: PurchaseReturnSettlementMethod;
  reason?: PurchaseReturnReason | string | null;
  notes?: string | null;
  locationId?: string | null;
  platform?: string;
  userId: string;
  createdAt: string;
}

export interface ReturnPurchaseItemRequest {
  productId?: string;
  productName?: string;
  quantity: number;
  unitCost?: number;
}

export interface CreatePurchaseReturnPayload {
  items: ReturnPurchaseItemRequest[];
  settlementMethod?: PurchaseReturnSettlementMethod;
  reason?: PurchaseReturnReason | string;
  notes?: string;
  createdAt?: string;
}

export interface CreatePurchaseReturnResponse {
  success: boolean;
  purchaseReturn: PurchaseReturn;
  purchaseStatus: 'none' | 'partial' | 'full';
  totalReturned: number;
}
