import { create } from 'zustand';
import { Product } from '@/types/product';
import { PaymentMethod, SaleItem } from '@/types/sale';

export interface CartItem {
  product: Product;
  quantity: number;
  discountType?: 'flat' | 'percent';
  discountValue?: number;
  discountApplied?: boolean;
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

  // Item-level discount actions
  toggleItemDiscount: (productId: string) => void;
  setItemDiscountApplied: (productId: string, applied: boolean) => void;
  updateItemDiscount: (productId: string, type: 'flat' | 'percent', value: number) => void;
  adjustItemDiscountValue: (productId: string, delta: number) => void;

  // Calculators
  getItemDiscount: (item: CartItem) => number;
  getTotalItemDiscount: () => number;
  getBillDiscount: () => number;
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
      const hasProductDiscount = typeof product.discountValue === 'number' && product.discountValue > 0;
      const newItem: CartItem = {
        product,
        quantity,
        discountType: product.discountType || 'percent',
        discountValue: hasProductDiscount ? product.discountValue : 0,
        discountApplied: hasProductDiscount,
      };
      set({ items: [...items, newItem] });
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

  toggleItemDiscount: (productId: string) => {
    set({
      items: get().items.map((i) => {
        if (i.product.id !== productId) return i;
        const currentApplied = i.discountApplied ?? ((i.discountValue || 0) > 0);
        return {
          ...i,
          discountApplied: !currentApplied,
          discountValue:
            !currentApplied && (!i.discountValue || i.discountValue === 0)
              ? i.product.discountValue || 10
              : i.discountValue,
          discountType: i.discountType || i.product.discountType || 'percent',
        };
      }),
    });
  },

  setItemDiscountApplied: (productId: string, applied: boolean) => {
    set({
      items: get().items.map((i) =>
        i.product.id === productId ? { ...i, discountApplied: applied } : i
      ),
    });
  },

  updateItemDiscount: (productId: string, type: 'flat' | 'percent', value: number) => {
    set({
      items: get().items.map((i) => {
        if (i.product.id !== productId) return i;
        const safeVal = Math.max(0, value);
        return {
          ...i,
          discountType: type,
          discountValue: safeVal,
          discountApplied: safeVal > 0 ? true : i.discountApplied,
        };
      }),
    });
  },

  adjustItemDiscountValue: (productId: string, delta: number) => {
    set({
      items: get().items.map((i) => {
        if (i.product.id !== productId) return i;
        const currentVal = i.discountValue || 0;
        const maxVal = i.discountType === 'flat' ? i.product.sellingPrice : 100;
        const newVal = Math.max(0, Math.min(maxVal, currentVal + delta));
        return {
          ...i,
          discountValue: newVal,
          discountApplied: newVal > 0 ? true : false,
        };
      }),
    });
  },

  getItemDiscount: (item: CartItem) => {
    if (!item.discountApplied || !item.discountValue || item.discountValue <= 0) {
      return 0;
    }
    const price = item.product.sellingPrice;
    const qty = item.quantity;
    const lineGross = price * qty;

    if (item.discountType === 'percent') {
      const pct = Math.min(100, Math.max(0, item.discountValue));
      return (lineGross * pct) / 100;
    } else {
      const flatPerUnit = Math.min(price, Math.max(0, item.discountValue));
      return flatPerUnit * qty;
    }
  },

  getTotalItemDiscount: () => {
    const { items, getItemDiscount } = get();
    return items.reduce((sum, item) => sum + getItemDiscount(item), 0);
  },

  getBillDiscount: () => {
    const { discount, items, getTotalItemDiscount } = get();
    if (!discount || discount.value <= 0) return 0;

    const rawSubtotal = items.reduce((sum, item) => sum + item.product.sellingPrice * item.quantity, 0);
    const itemDiscount = getTotalItemDiscount();
    const remaining = Math.max(0, rawSubtotal - itemDiscount);

    if (discount.type === 'percent') {
      const pct = Math.min(100, Math.max(0, discount.value));
      return (remaining * pct) / 100;
    }
    return Math.min(discount.value, remaining);
  },

  getSubtotal: () => {
    const { items, gstMode } = get();
    return items.reduce((sum, item) => {
      const price = item.product.sellingPrice;
      const taxRate = item.product.taxRate || 0;

      if (gstMode === 'inclusive' && item.product.priceIncludesGst && taxRate > 0) {
        const basePrice = price / (1 + taxRate / 100);
        return sum + basePrice * item.quantity;
      }
      return sum + price * item.quantity;
    }, 0);
  },

  getTotalDiscount: () => {
    const { getTotalItemDiscount, getBillDiscount } = get();
    return getTotalItemDiscount() + getBillDiscount();
  },

  getTotalTax: () => {
    const { items, gstMode, getItemDiscount, getBillDiscount } = get();
    const rawGross = items.reduce((sum, item) => sum + item.product.sellingPrice * item.quantity, 0);
    const totalItemDisc = items.reduce((sum, item) => sum + getItemDiscount(item), 0);
    const billDisc = getBillDiscount();
    const totalDisc = totalItemDisc + billDisc;
    const discountFactor = rawGross > 0 ? Math.max(0, rawGross - totalDisc) / rawGross : 1;

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
    const { items, getItemDiscount } = get();
    return items.map((item) => {
      const discountAmt = getItemDiscount(item);
      const lineTotal = Math.max(0, item.product.sellingPrice * item.quantity - discountAmt);
      return {
        productId: item.product.id,
        productName: item.product.name,
        barcode: item.product.barcode || undefined,
        quantity: item.quantity,
        unitPrice: item.product.sellingPrice,
        costPrice: item.product.costPrice,
        taxRate: item.product.taxRate,
        discountType: item.discountType,
        discountValue: item.discountValue,
        discountAmount: discountAmt,
        discountApplied: item.discountApplied,
        total: lineTotal,
      };
    });
  },
}));
