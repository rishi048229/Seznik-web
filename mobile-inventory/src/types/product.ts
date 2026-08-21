export interface Category {
  id: string;
  name: string;
  parentId?: string | null;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface Product {
  id: string;
  name: string;
  sku?: string | null;
  barcode?: string | null;
  barcodeType?: string | null;
  categoryId?: string | null;
  supplierId?: string | null;
  costPrice: number;
  sellingPrice: number;
  taxRate: number;
  priceIncludesGst: boolean;
  currentStock: number;
  lowStockThreshold: number;
  unit: string;
  imageUrl?: string | null;
  isActive: boolean;
  discountType?: 'flat' | 'percent';
  discountValue?: number;
  createdAt?: string;
  updatedAt?: string;
  category?: Category | null;
}

export interface CreateProductPayload {
  name: string;
  sku?: string;
  barcode?: string;
  barcodeType?: string;
  categoryId?: string;
  supplierId?: string;
  costPrice: number;
  sellingPrice: number;
  taxRate: number;
  priceIncludesGst: boolean;
  currentStock: number;
  lowStockThreshold: number;
  unit: string;
  imageUrl?: string;
  isActive?: boolean;
  discountType?: 'flat' | 'percent';
  discountValue?: number;
}

export interface StockAdjustmentPayload {
  change: number; // positive to add stock, negative to reduce
  reason: string;
}
