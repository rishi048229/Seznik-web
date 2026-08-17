export interface PurchaseItem {
  productId?: string;
  productName: string;
  quantity: number;
  costPrice: number;
  unitPrice?: number;
  total: number;
}

export interface Purchase {
  id: string;
  invoiceNumber: string;
  supplierId?: string | null;
  supplierName?: string | null;
  supplier?: { id: string; name: string } | null;
  items: PurchaseItem[];
  subtotal: number;
  totalDiscount?: number;
  totalTax: number;
  grandTotal: number;
  paymentMethod: string;
  amountPaid: number;
  createdAt: string;
}

export interface CreatePurchasePayload {
  supplierId?: string;
  items: PurchaseItem[];
  subtotal: number;
  totalDiscount?: number;
  totalTax: number;
  grandTotal: number;
  paymentMethod: string;
  amountPaid?: number;
}
