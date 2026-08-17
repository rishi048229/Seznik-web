export interface Supplier {
  id: string;
  name: string;
  // Required at the database level — always present on records returned from the backend.
  phone: string;
  email?: string | null;
  address?: string | null;
  gstin?: string | null;
  // Aggregate stats computed server-side (see backend/src/controllers/supplierController.ts).
  productsSuppliedCount: number;
  totalPurchaseValue: number;
  purchaseCount: number;
  lastPurchaseAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateSupplierPayload {
  name: string;
  phone: string;
  email?: string;
  address?: string;
  gstin?: string;
}
