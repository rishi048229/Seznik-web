import { create } from 'zustand';
import { Bill, BillItem, BillType, PaymentMethod, Product, QuickBillItem, StockHistoryItem } from '../types';
import * as db from '../services/db';
import { calculateBillTotals } from '../utils/billing';
import { useInventoryStore } from './useInventoryStore';
import { useCustomerStore } from './useCustomerStore';

interface BillState {
  bills: Bill[];
  cart: BillItem[];
  customerName: string;
  customerPhone: string;
  customerId: string;
  taxPercent: number;
  discount: { type: 'flat' | 'percent'; value: number };
  paymentMethod: PaymentMethod;
  customField: string;
  isLoading: boolean;

  loadBills: () => Promise<void>;
  addToCart: (product: Product | { name: string; price: number; id?: string; costPrice?: number }, qty: number) => void;
  removeFromCart: (productId: string) => void;
  updateCartQty: (productId: string, qty: number) => void;
  clearCart: () => void;
  setCustomerInfo: (name: string, phone: string) => void;
  setCustomerId: (id: string) => void;
  setTaxPercent: (percent: number) => void;
  setDiscount: (discount: { type: 'flat' | 'percent'; value: number }) => void;
  setPaymentMethod: (method: PaymentMethod) => void;
  setCustomField: (value: string) => void;

  createBill: (printImmediately?: boolean) => Promise<string | null>;
  createQuickBill: (tileId: string, tileLabel: string, tilePrice: number, opts?: {
    customerId?: string;
    customerName?: string;
    customerPhone?: string;
    customField?: string;
    paymentMethod?: PaymentMethod;
  }) => Promise<string | null>;
  updatePrintStatus: (billId: string, status: 'not_printed' | 'printed' | 'failed') => Promise<void>;
}

export const useBillStore = create<BillState>((set, get) => ({
  bills: [],
  cart: [],
  customerName: '',
  customerPhone: '',
  customerId: '',
  taxPercent: 18,
  discount: { type: 'flat', value: 0 },
  paymentMethod: 'cash',
  customField: '',
  isLoading: false,

  loadBills: async () => {
    set({ isLoading: true });
    try {
      const list = await db.getBills();
      set({ bills: list, isLoading: false });
    } catch (_e) {
      set({ isLoading: false });
    }
  },

  addToCart: (item, qty) => {
    const cart = [...get().cart];
    const isProduct = 'stockQty' in item;
    const itemId = item.id || (isProduct ? (item as Product).id : `custom_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`);
    const itemName = item.name;
    const itemPrice = item.price;
    const itemCostPrice = ('costPrice' in item) ? item.costPrice : undefined;

    const existingIdx = cart.findIndex((i) => i.productId === itemId);

    if (existingIdx >= 0) {
      const newQty = cart[existingIdx].qty + qty;
      cart[existingIdx] = {
        ...cart[existingIdx],
        qty: newQty,
        lineTotal: newQty * itemPrice,
      };
    } else {
      cart.push({
        productId: itemId,
        name: itemName,
        qty,
        unitPrice: itemPrice,
        costPrice: itemCostPrice,
        lineTotal: qty * itemPrice,
      });
    }

    set({ cart });
  },

  removeFromCart: (productId) => {
    const cart = get().cart.filter((item) => item.productId !== productId);
    set({ cart });
  },

  updateCartQty: (productId, qty) => {
    if (qty <= 0) {
      get().removeFromCart(productId);
      return;
    }
    const cart = get().cart.map((item) => {
      if (item.productId === productId) {
        return { ...item, qty, lineTotal: qty * item.unitPrice };
      }
      return item;
    });
    set({ cart });
  },

  clearCart: () => {
    set({ cart: [], customerName: '', customerPhone: '', customerId: '', discount: { type: 'flat', value: 0 }, paymentMethod: 'cash', customField: '' });
  },

  setCustomerInfo: (customerName, customerPhone) => set({ customerName, customerPhone }),
  setCustomerId: (customerId) => set({ customerId }),
  setTaxPercent: (taxPercent) => set({ taxPercent }),
  setDiscount: (discount) => set({ discount }),
  setPaymentMethod: (paymentMethod) => set({ paymentMethod }),
  setCustomField: (customField) => set({ customField }),

  createBill: async (printImmediately = false) => {
    const cart = get().cart;
    if (cart.length === 0) return null;

    set({ isLoading: true });
    const calcTotals = calculateBillTotals({
      items: cart.map(i => ({ qty: i.qty, unitPrice: i.unitPrice || 0 })),
      gstMode: 'exclusive',
      gstRate: get().taxPercent,
      discount: get().discount
    });

    const billId = `INV-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;
    const timestamp = new Date().toISOString();

    const newBill: Bill = {
      id: billId,
      type: 'product',
      items: cart,
      subtotal: calcTotals.rawSubtotal,
      taxPercent: get().taxPercent,
      discount: get().discount,
      total: calcTotals.total,
      customerId: get().customerId || undefined,
      customerName: get().customerName || 'Walk-in Customer',
      customerPhone: get().customerPhone || undefined,
      paymentMethod: get().paymentMethod,
      customField: get().customField || undefined,
      printStatus: 'not_printed',
      createdAt: timestamp,
    };

    try {
      await db.saveBill(newBill);

      // Adjust inventory stock
      const inventoryProducts = useInventoryStore.getState().products;
      for (const item of cart) {
        if (!item.productId.startsWith('custom_')) {
          const product = inventoryProducts.find((p) => p.id === item.productId);
          if (product) {
            const updatedStock = Math.max(0, product.stockQty - item.qty);
            const updatedProduct: Product = { ...product, stockQty: updatedStock, updatedAt: timestamp };
            await db.saveProduct(updatedProduct);

            const historyItem: StockHistoryItem = {
              id: Math.random().toString(36).substring(2, 9),
              productId: item.productId,
              type: 'sale',
              qty: item.qty,
              date: timestamp,
              description: `Sold via Bill #${billId}`,
            };
            await db.addStockHistory(historyItem);
          }
        }
      }

      // Update customer visit if linked
      if (get().customerId) {
        try {
          await useCustomerStore.getState().incrementVisit(get().customerId, Math.max(0, calcTotals.total));
        } catch (_e) {
          // Non-critical
        }
      }

      await useInventoryStore.getState().loadProducts();
      await get().loadBills();
      get().clearCart();
      set({ isLoading: false });
      return billId;
    } catch (_e) {
      set({ isLoading: false });
      return null;
    }
  },

  createQuickBill: async (tileId, tileLabel, tilePrice, opts = {}) => {
    set({ isLoading: true });

    const billId = `QB-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;
    const timestamp = new Date().toISOString();

    const quickItem: QuickBillItem = { tileId, label: tileLabel, price: tilePrice };

    const newBill: Bill = {
      id: billId,
      type: 'fixed',
      items: [quickItem],
      subtotal: tilePrice,
      taxPercent: 0,
      discount: { type: 'flat', value: 0 },
      total: tilePrice,
      customerId: opts.customerId || undefined,
      customerName: opts.customerName || 'Walk-in',
      customerPhone: opts.customerPhone || undefined,
      paymentMethod: opts.paymentMethod || 'cash',
      customField: opts.customField || undefined,
      printStatus: 'not_printed',
      createdAt: timestamp,
    };

    try {
      await db.saveBill(newBill);

      if (opts.customerId) {
        try {
          await useCustomerStore.getState().incrementVisit(opts.customerId, tilePrice);
        } catch (_e) {
          // Non-critical
        }
      }

      await get().loadBills();
      set({ isLoading: false });
      return billId;
    } catch (_e) {
      set({ isLoading: false });
      return null;
    }
  },

  updatePrintStatus: async (billId, status) => {
    try {
      await db.updateBillPrintStatus(billId, status);
      await get().loadBills();
    } catch (_e) {
      // Ignored
    }
  },
}));
