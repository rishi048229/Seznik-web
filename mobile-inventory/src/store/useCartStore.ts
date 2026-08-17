import { create } from 'zustand';
import { Product } from '@/types/product';
import { PaymentMethod, SaleItem } from '@/types/sale';

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface CartDiscount {
  type: 'flat' | 'percent';
  value: number;
}

interface CartState {
  items: CartItem[];
  discount: CartDiscount;
  gstMode: 'inclusive' | 'exclusive';
  selectedCustomerId: string | null;
  selectedCustomerName: string | null;

  addItem: (product: Product, quantity?: number) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  setDiscount: (type: 'flat' | 'percent', value: number) => void;
  setGstMode: (mode: 'inclusive' | 'exclusive') => void;
  setCustomer: (id: string | null, name: string | null) => void;

  // Calculators
  getSubtotal: () => number;
  getTotalDiscount: () => number;
  getTotalTax: () => number;
  getGrandTotal: () => number;
  toSaleItems: () => SaleItem[];
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  discount: { type: 'flat', value: 0 },
  gstMode: 'inclusive',
  selectedCustomerId: null,
  selectedCustomerName: null,

  addItem: (product: Product, quantity = 1) => {
    const { items } = get();
    const existingIndex = items.findIndex((i) => i.product.id === product.id);

    if (existingIndex > -1) {
      const updated = [...items];
      updated[existingIndex].quantity += quantity;
      set({ items: updated });
    } else {
      set({ items: [...items, { product, quantity }] });
    }
  },

  removeItem: (productId: string) => {
    set({ items: get().items.filter((i) => i.product.id !== productId) });
  },

  updateQuantity: (productId: string, quantity: number) => {
    if (quantity <= 0) {
      get().removeItem(productId);
      return;
    }
    set({
      items: get().items.map((i) =>
        i.product.id === productId ? { ...i, quantity } : i
      ),
    });
  },

  clearCart: () => {
    set({
      items: [],
      discount: { type: 'flat', value: 0 },
      selectedCustomerId: null,
      selectedCustomerName: null,
    });
  },

  setDiscount: (type, value) => {
    set({ discount: { type, value: Math.max(0, value) } });
  },

  setGstMode: (gstMode) => {
    set({ gstMode });
  },

  setCustomer: (id, name) => {
    set({ selectedCustomerId: id, selectedCustomerName: name });
  },

  getSubtotal: () => {
    const { items, gstMode } = get();
    return items.reduce((sum, item) => {
      const price = item.product.sellingPrice;
      const taxRate = item.product.taxRate || 0;

      if (gstMode === 'inclusive' && item.product.priceIncludesGst && taxRate > 0) {
        // Extract base price before GST
        const basePrice = price / (1 + taxRate / 100);
        return sum + basePrice * item.quantity;
      }
      return sum + price * item.quantity;
    }, 0);
  },

  getTotalDiscount: () => {
    const { discount } = get();
    const subtotal = get().getSubtotal();
    if (discount.type === 'percent') {
      return (subtotal * discount.value) / 100;
    }
    return Math.min(discount.value, subtotal);
  },

  getTotalTax: () => {
    const { items, gstMode } = get();
    const subtotal = get().getSubtotal();
    const discount = get().getTotalDiscount();
    const discountFactor = subtotal > 0 ? (subtotal - discount) / subtotal : 1;

    return items.reduce((sum, item) => {
      const price = item.product.sellingPrice;
      const taxRate = item.product.taxRate || 0;
      const itemSubtotal = price * item.quantity * discountFactor;

      if (taxRate <= 0) return sum;

      if (gstMode === 'inclusive' && item.product.priceIncludesGst) {
        const base = itemSubtotal / (1 + taxRate / 100);
        return sum + (itemSubtotal - base);
      } else {
        return sum + (itemSubtotal * taxRate) / 100;
      }
    }, 0);
  },

  getGrandTotal: () => {
    const subtotal = get().getSubtotal();
    const discount = get().getTotalDiscount();
    const tax = get().getTotalTax();
    return Math.max(0, subtotal - discount + tax);
  },

  toSaleItems: () => {
    const { items } = get();
    return items.map((item) => ({
      productId: item.product.id,
      productName: item.product.name,
      barcode: item.product.barcode || undefined,
      quantity: item.quantity,
      unitPrice: item.product.sellingPrice,
      costPrice: item.product.costPrice,
      taxRate: item.product.taxRate,
      total: item.product.sellingPrice * item.quantity,
    }));
  },
}));
