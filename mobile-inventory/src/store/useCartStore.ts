import { create } from 'zustand';
import { Alert } from 'react-native';
import { Product } from '@/types/product';
import { PaymentMethod, SaleItem } from '@/types/sale';
import {
  AppliedBillCharge,
  BillChargePreset,
  defaultSelectedPresetIds,
  resolveBillCharges,
} from '@/constants/restaurantBilling';
import { useAuthStore } from '@/store/useAuthStore';
import { getCachedTrackStockSetting } from '@/hooks/useSettings';
import { isProductAvailable, usesStockTracking } from '@/utils/businessFeatures';

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
  checkoutModalOpen: boolean;
  chargePresets: BillChargePreset[];
  selectedChargePresetIds: string[];

  addItem: (product: Product, quantity?: number) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  setDiscount: (type: 'flat' | 'percent', value: number) => void;
  setGstMode: (mode: 'inclusive' | 'exclusive') => void;
  setCustomer: (id: string | null, name: string | null) => void;
  setCheckoutModalOpen: (open: boolean) => void;
  setChargePresets: (presets: BillChargePreset[]) => void;
  initDefaultSelectedCharges: () => void;
  toggleChargePreset: (presetId: string) => void;
  clearCharges: () => void;

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
  getGrossSubtotalForCharges: () => number;
  getNetSubtotalForCharges: () => number;
  getResolvedBillCharges: () => AppliedBillCharge[];
  getExtraChargesTotal: () => number;
  getGrandTotal: () => number;
  toSaleItems: () => SaleItem[];
}

// Helper to extract numeric stock across different product payload shapes
function extractAvailableStock(product: Product | any): number | undefined {
  if (!product) return undefined;
  if (typeof product.currentStock === 'number') return Math.max(0, product.currentStock);
  if (typeof product.stockQty === 'number') return Math.max(0, product.stockQty);
  if (typeof product.currentStock === 'string' && product.currentStock.trim() !== '') {
    const parsed = parseFloat(product.currentStock);
    if (!isNaN(parsed)) return Math.max(0, parsed);
  }
  if (typeof product.stockQty === 'string' && product.stockQty.trim() !== '') {
    const parsed = parseFloat(product.stockQty);
    if (!isNaN(parsed)) return Math.max(0, parsed);
  }
  return undefined;
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  discount: { type: 'flat', value: 0 },
  gstMode: 'inclusive',
  selectedCustomerId: null,
  selectedCustomerName: null,
  checkoutModalOpen: false,
  chargePresets: [],
  selectedChargePresetIds: [],

  addItem: (product: Product, quantity = 1) => {
    const trackStock = usesStockTracking(
      useAuthStore.getState().user?.businessType,
      getCachedTrackStockSetting()
    );

    // Restaurant/cafe: availability is isAvailable (legacy isActive) — never block on quantity.
    if (!trackStock) {
      if (!isProductAvailable(product)) {
        Alert.alert('Not available', `"${product.name}" is marked not available on the menu.`);
        return;
      }
    } else {
      const availableStock = extractAvailableStock(product);
      if ((availableStock !== undefined && availableStock <= 0) || !isProductAvailable(product)) {
        Alert.alert(
          'Out of Stock',
          `Cannot add "${product.name}" to cart because it is currently out of stock (0 ${product.unit || 'units'} left in inventory). Please restock before billing.`
        );
        return;
      }

      set((state) => {
        const existingIndex = state.items.findIndex((i) => i.product.id === product.id);
        if (existingIndex > -1) {
          const currentQty = state.items[existingIndex].quantity;
          const requestedQty = currentQty + quantity;
          const finalQty = availableStock !== undefined ? Math.min(requestedQty, availableStock) : requestedQty;

          if (availableStock !== undefined && requestedQty > availableStock) {
            Alert.alert(
              'Stock Limit Reached ⚠️',
              `Cannot add more units of "${product.name}". Only ${availableStock} ${product.unit || 'units'} available in inventory.`
            );
          }

          return {
            items: state.items.map((item, idx) =>
              idx === existingIndex ? { ...item, quantity: finalQty } : item
            ),
          };
        }

        const initialQty = availableStock !== undefined ? Math.min(quantity, availableStock) : quantity;
        if (availableStock !== undefined && quantity > availableStock) {
          Alert.alert(
            'Stock Limit Reached ⚠️',
            `Cannot add ${quantity} units of "${product.name}". Only ${availableStock} ${product.unit || 'units'} available in inventory.`
          );
        }

        const hasProductDiscount = typeof product.discountValue === 'number' && product.discountValue > 0;
        const newItem: CartItem = {
          product,
          quantity: initialQty,
          discountType: product.discountType || 'percent',
          discountValue: hasProductDiscount ? product.discountValue : 0,
          discountApplied: hasProductDiscount,
        };
        return { items: [...state.items, newItem] };
      });
      return;
    }

    set((state) => {
      const existingIndex = state.items.findIndex((i) => i.product.id === product.id);
      if (existingIndex > -1) {
        return {
          items: state.items.map((item, idx) =>
            idx === existingIndex ? { ...item, quantity: item.quantity + quantity } : item
          ),
        };
      }

      const hasProductDiscount = typeof product.discountValue === 'number' && product.discountValue > 0;
      const newItem: CartItem = {
        product,
        quantity,
        discountType: product.discountType || 'percent',
        discountValue: hasProductDiscount ? product.discountValue : 0,
        discountApplied: hasProductDiscount,
      };
      return { items: [...state.items, newItem] };
    });
  },

  removeItem: (productId: string) => {
    set({ items: get().items.filter((i) => i.product.id !== productId) });
  },

  updateQuantity: (productId: string, quantity: number) => {
    if (quantity <= 0) {
      get().removeItem(productId);
      return;
    }
    const item = get().items.find((i) => i.product.id === productId);
    const trackStock = usesStockTracking(
      useAuthStore.getState().user?.businessType,
      getCachedTrackStockSetting()
    );
    const availableStock =
      trackStock && item ? extractAvailableStock(item.product) : undefined;

    let finalQty = quantity;
    if (availableStock !== undefined && quantity > availableStock) {
      finalQty = availableStock;
      Alert.alert(
        'Stock Limit Reached ⚠️',
        `Cannot increase quantity beyond ${availableStock} ${item?.product.unit || 'units'} currently available in inventory.`
      );
    }

    set({
      items: get().items.map((i) =>
        i.product.id === productId ? { ...i, quantity: finalQty } : i
      ),
    });
  },

  clearCart: () => {
    set({
      items: [],
      discount: { type: 'flat', value: 0 },
      selectedCustomerId: null,
      selectedCustomerName: null,
      selectedChargePresetIds: [],
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

  setCheckoutModalOpen: (open) => {
    set({ checkoutModalOpen: open });
  },

  setChargePresets: (presets) => {
    set({ chargePresets: presets });
  },

  initDefaultSelectedCharges: () => {
    const { chargePresets } = get();
    set({ selectedChargePresetIds: defaultSelectedPresetIds(chargePresets) });
  },

  toggleChargePreset: (presetId) => {
    set((state) => {
      const exists = state.selectedChargePresetIds.includes(presetId);
      return {
        selectedChargePresetIds: exists
          ? state.selectedChargePresetIds.filter((id) => id !== presetId)
          : [...state.selectedChargePresetIds, presetId],
      };
    });
  },

  clearCharges: () => {
    set({ selectedChargePresetIds: [] });
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

  getGrossSubtotalForCharges: () => {
    const { items } = get();
    return items.reduce((sum, item) => sum + item.product.sellingPrice * item.quantity, 0);
  },

  getNetSubtotalForCharges: () => {
    const { getGrossSubtotalForCharges, getTotalDiscount } = get();
    return Math.max(0, getGrossSubtotalForCharges() - getTotalDiscount());
  },

  getResolvedBillCharges: () => {
    const { chargePresets, selectedChargePresetIds, getNetSubtotalForCharges, getGrossSubtotalForCharges } = get();
    return resolveBillCharges(
      chargePresets,
      selectedChargePresetIds,
      getNetSubtotalForCharges(),
      getGrossSubtotalForCharges(),
    );
  },

  getExtraChargesTotal: () => {
    return get().getResolvedBillCharges().reduce((sum, charge) => sum + charge.amount, 0);
  },

  getGrandTotal: () => {
    const subtotal = get().getSubtotal();
    const discount = get().getTotalDiscount();
    const tax = get().getTotalTax();
    const extraCharges = get().getExtraChargesTotal();
    return Math.max(0, subtotal - discount + tax + extraCharges);
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
        priceIncludesGst: Boolean(item.product.priceIncludesGst),
        discountType: item.discountType,
        discountValue: item.discountValue,
        discountAmount: discountAmt,
        discountApplied: item.discountApplied,
        total: lineTotal,
      };
    });
  },
}));
