import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  StyleSheet,
  Switch,
  TextInput,
} from 'react-native';
import { X, ArrowRightLeft, Box, Check, Plus, Trash2, Search, Sparkles } from 'lucide-react-native';
import { salesApi } from '@/api/sales';
import { productsApi } from '@/api/products';
import type { Sale } from '@/types/sale';
import type { Product } from '@/types/product';
import { calculateReturnSummary, ReturnItemRequest } from '@shared/saleReturnCalculator';
import { calculateGstBill, round2 } from '@shared/gstTaxEngine';
import { BRAND_COLORS } from '@/constants/theme';
import { useAppTheme } from '@/hooks/useAppTheme';
import { sanitizeErrorMessage } from '@/utils/errorHandler';

interface ProcessExchangeModalProps {
  visible: boolean;
  sale: Sale | null;
  onClose: () => void;
  onSuccess: (result: any) => void;
}

interface NewExchangeItem {
  id: string;
  productId?: string;
  name: string;
  price: number;
  quantity: number;
  taxRate: number;
  priceIncludesGst: boolean;
}

export function ProcessExchangeModal({
  visible,
  sale,
  onClose,
  onSuccess,
}: ProcessExchangeModalProps) {
  const theme = useAppTheme();
  const [loadingPastReturns, setLoadingPastReturns] = useState(false);
  const [pastReturns, setPastReturns] = useState<any[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Return Selection State (Inward Leg)
  const [returnSelection, setReturnSelection] = useState<
    Record<string, { selected: boolean; quantity: number; restock: boolean }>
  >({});

  // Replacement Items State (Outward Leg)
  const [newItems, setNewItems] = useState<NewExchangeItem[]>([]);

  // Settlement & Metadata
  const [settlementMethod, setSettlementMethod] = useState<'cash' | 'upi' | 'card' | 'store_credit' | 'credit_ledger'>('cash');
  const [exchangeDiscount, setExchangeDiscount] = useState('');
  const [reason, setReason] = useState('size_fit_change');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch returns and product catalog
  useEffect(() => {
    if (!visible || !sale?.id) return;

    setLoadingPastReturns(true);
    Promise.all([
      salesApi.getReturnsForSale(sale.id),
      productsApi.getProducts().catch(() => []),
    ])
      .then(([returns, prods]) => {
        setPastReturns(returns || []);
        setProducts(prods || []);
        const initial: Record<string, { selected: boolean; quantity: number; restock: boolean }> = {};
        const items = Array.isArray(sale.items) ? sale.items : [];

        items.forEach((item, index) => {
          const key = item.productId || item.productName || `item-${index}`;
          let returnedQty = 0;
          for (const past of returns || []) {
            const pastItems = Array.isArray(past.items) ? past.items : [];
            for (const p of pastItems) {
              if (p.productId === item.productId || p.productName === item.productName) {
                returnedQty += Number(p.quantity) || 0;
              }
            }
          }
          const remaining = Math.max(0, (Number(item.quantity) || 1) - returnedQty);
          initial[key] = {
            selected: remaining > 0,
            quantity: remaining,
            restock: true,
          };
        });
        setReturnSelection(initial);
      })
      .catch((err) => console.error('Failed to load exchange data', err))
      .finally(() => setLoadingPastReturns(false));
  }, [visible, sale]);

  // Remaining quantities per line item
  const itemRemainingMap = useMemo(() => {
    const map = new Map<string, number>();
    const items = Array.isArray(sale?.items) ? sale!.items : [];

    items.forEach((item, index) => {
      const key = item.productId || item.productName || `item-${index}`;
      let returnedQty = 0;
      for (const past of pastReturns) {
        const pastItems = Array.isArray(past.items) ? past.items : [];
        for (const p of pastItems) {
          if (p.productId === item.productId || p.productName === item.productName) {
            returnedQty += Number(p.quantity) || 0;
          }
        }
      }
      const remaining = Math.max(0, (Number(item.quantity) || 1) - returnedQty);
      map.set(key, remaining);
    });
    return map;
  }, [sale?.items, pastReturns]);

  // Inward Leg Return Summary Calculation
  const returnSummary = useMemo(() => {
    if (!sale) return { items: [], subtotal: 0, totalTax: 0, extraChargesRefunded: 0, refundAmount: 0 };
    const items = Array.isArray(sale.items) ? sale.items : [];
    const requests: ReturnItemRequest[] = [];

    items.forEach((item, index) => {
      const key = item.productId || item.productName || `item-${index}`;
      const state = returnSelection[key];
      if (state && state.selected && state.quantity > 0) {
        requests.push({
          productId: item.productId,
          productName: item.productName,
          quantity: state.quantity,
          restock: state.restock,
        });
      }
    });

    try {
      return calculateReturnSummary(items as any, requests, 0, {
        subtotal: sale.subtotal,
        totalDiscount: sale.totalDiscount,
        totalTax: sale.totalTax,
        grandTotal: sale.grandTotal,
        extraChargesTotal: sale.extraChargesTotal,
        pastReturns,
      });
    } catch {
      return { items: [], subtotal: 0, totalTax: 0, extraChargesRefunded: 0, refundAmount: 0 };
    }
  }, [sale, returnSelection, pastReturns]);

  // Outward Leg New Sale Calculation
  const newSaleSummary = useMemo(() => {
    if (newItems.length === 0) {
      return { subtotal: 0, totalTax: 0, grandTotal: 0 };
    }

    const billResult = calculateGstBill({
      lineItems: newItems.map((item) => ({
        id: item.productId || item.id,
        name: item.name,
        price: item.price,
        qty: item.quantity,
        gstRate: item.taxRate,
        priceType: item.priceIncludesGst ? 'inclusive' : 'exclusive',
      })),
      roundingMode: 'none',
    });

    return {
      subtotal: billResult.totalTaxableValue,
      totalTax: billResult.totalTax,
      grandTotal: billResult.finalInvoiceTotal,
      billResult,
    };
  }, [newItems]);

  // Difference Amount & Settlement Calculation (Incorporating goodwill discount)
  const cleanExchangeDiscount = useMemo(() => {
    return Math.max(0, Number(exchangeDiscount) || 0);
  }, [exchangeDiscount]);

  const differenceAmount = useMemo(() => {
    return round2(newSaleSummary.grandTotal - returnSummary.refundAmount - cleanExchangeDiscount);
  }, [newSaleSummary.grandTotal, returnSummary.refundAmount, cleanExchangeDiscount]);

  const isEven = Math.abs(differenceAmount) < 0.01;
  const isUpgrade = differenceAmount > 0;
  const isDowngrade = differenceAmount < 0;

  // Filter products for search
  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return products
      .filter((p) => p.name.toLowerCase().includes(q) || (p.sku && p.sku.toLowerCase().includes(q)))
      .slice(0, 5);
  }, [products, searchQuery]);

  const handleAddProduct = (product: Product) => {
    const existingIndex = newItems.findIndex((i) => i.productId === product.id);
    if (existingIndex >= 0) {
      setNewItems((prev) =>
        prev.map((item, idx) => (idx === existingIndex ? { ...item, quantity: item.quantity + 1 } : item))
      );
    } else {
      setNewItems((prev) => [
        ...prev,
        {
          id: `new-${Date.now()}-${Math.random()}`,
          productId: product.id,
          name: product.name,
          price: Number(product.sellingPrice) || 0,
          quantity: 1,
          taxRate: Number(product.taxRate) || 0,
          priceIncludesGst: Boolean(product.priceIncludesGst),
        },
      ]);
    }
    setSearchQuery('');
  };

  const handleRemoveNewItem = (id: string) => {
    setNewItems((prev) => prev.filter((i) => i.id !== id));
  };

  const handleUpdateNewItemQty = (id: string, qty: number) => {
    if (qty <= 0) {
      handleRemoveNewItem(id);
    } else {
      setNewItems((prev) => prev.map((i) => (i.id === id ? { ...i, quantity: qty } : i)));
    }
  };

  const handleToggleReturnSelect = (key: string) => {
    setReturnSelection((prev) => {
      const curr = prev[key] || { selected: false, quantity: 1, restock: true };
      return { ...prev, [key]: { ...curr, selected: !curr.selected } };
    });
  };

  const handleUpdateReturnQty = (key: string, val: number) => {
    const max = itemRemainingMap.get(key) || 1;
    const clamped = Math.max(1, Math.min(val, max));
    setReturnSelection((prev) => {
      const curr = prev[key] || { selected: true, quantity: 1, restock: true };
      return { ...prev, [key]: { ...curr, quantity: clamped } };
    });
  };

  const handleToggleRestock = (key: string, val: boolean) => {
    setReturnSelection((prev) => {
      const curr = prev[key] || { selected: true, quantity: 1, restock: true };
      return { ...prev, [key]: { ...curr, restock: val } };
    });
  };

  const handleSubmit = async () => {
    if (!sale) return;

    if (returnSummary.items.length === 0) {
      Alert.alert('Validation Error', 'Please select at least one item to return.');
      return;
    }

    if (newItems.length === 0) {
      Alert.alert('Validation Error', 'Please add at least one replacement item.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        originalSaleId: sale.id,
        returnedItems: returnSummary.items.map((i) => ({
          productId: i.productId,
          productName: i.productName,
          quantity: i.quantity,
          restock: i.restock,
        })),
        newItems: newItems.map((i) => ({
          productId: i.productId,
          name: i.name,
          quantity: i.quantity,
          unitPrice: i.price,
          sellingPrice: i.price,
          taxRate: i.taxRate,
          priceIncludesGst: i.priceIncludesGst,
          total: i.price * i.quantity,
        })),
        newSubtotal: newSaleSummary.subtotal,
        newTotalDiscount: 0,
        newTotalTax: newSaleSummary.totalTax,
        newGrandTotal: newSaleSummary.grandTotal,
        differenceAmount,
        exchangeDiscount: cleanExchangeDiscount,
        settlementMethod: isEven ? 'even_exchange' : settlementMethod,
        reason,
        notes,
      };

      const res = await salesApi.createSaleExchange(sale.id, payload);
      Alert.alert(
        'Exchange Processed',
        `Exchange Voucher ${res.exchange?.exchangeNumber || ''} created successfully.`,
        [{ text: 'OK', onPress: () => onSuccess(res) }]
      );
    } catch (err: any) {
      Alert.alert('Exchange Failed', sanitizeErrorMessage(err, 'Unable to process exchange. Please review exchange items and try again.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!sale) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.container, { backgroundColor: theme.cardBg }]}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: theme.borderColor }]}>
            <View style={styles.headerLeft}>
              <ArrowRightLeft size={20} color={BRAND_COLORS.navyInk} />
              <View>
                <Text style={[styles.title, { color: theme.textPrimary }]}>Exchange Items</Text>
                <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
                  Invoice #{sale.invoiceNumber}
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={20} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>

          {loadingPastReturns ? (
            <View style={styles.centerLoading}>
              <ActivityIndicator size="large" color={BRAND_COLORS.navyInk} />
              <Text style={{ marginTop: 8, color: theme.textSecondary, fontSize: 13 }}>
                Loading details...
              </Text>
            </View>
          ) : (
            <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
              {/* 1. Inward Return Leg */}
              <View style={[styles.sectionBox, { backgroundColor: '#fff5f5', borderColor: '#fed7d7' }]}>
                <View style={styles.sectionHeaderRow}>
                  <Text style={[styles.sectionTitle, { color: '#c53030' }]}>
                    1. Return Items (Inward)
                  </Text>
                  <Text style={[styles.sectionValueBadge, { color: '#c53030' }]}>
                    Credit: ₹{returnSummary.refundAmount.toFixed(2)}
                  </Text>
                </View>

                {sale.items.map((item, index) => {
                  const key = item.productId || item.productName || `item-${index}`;
                  const remaining = itemRemainingMap.get(key) ?? item.quantity;
                  const isExhausted = remaining <= 0;
                  const state = returnSelection[key] || { selected: false, quantity: 1, restock: true };

                  return (
                    <View
                      key={key}
                      style={[
                        styles.itemCard,
                        {
                          backgroundColor: state.selected ? '#fff' : '#fcfcfc',
                          borderColor: state.selected ? '#feb2b2' : theme.borderColor,
                          opacity: isExhausted ? 0.4 : 1,
                        },
                      ]}
                    >
                      <TouchableOpacity
                        disabled={isExhausted}
                        onPress={() => handleToggleReturnSelect(key)}
                        style={styles.itemRowTop}
                      >
                        <View
                          style={[
                            styles.checkbox,
                            {
                              backgroundColor: state.selected ? '#e53e3e' : '#fff',
                              borderColor: state.selected ? '#e53e3e' : theme.borderColor,
                            },
                          ]}
                        >
                          {state.selected && <Check size={12} color="#fff" />}
                        </View>
                        <View style={{ flex: 1, marginLeft: 10 }}>
                          <Text style={[styles.itemName, { color: theme.textPrimary }]}>
                            {item.productName}
                          </Text>
                          <Text style={[styles.itemSub, { color: theme.textSecondary }]}>
                            Billed: {item.quantity} | Available: {remaining} | Price: ₹{item.unitPrice || item.total}
                          </Text>
                        </View>
                      </TouchableOpacity>

                      {state.selected && !isExhausted && (
                        <View style={styles.itemControlsRow}>
                          <View style={styles.qtyControl}>
                            <Text style={[styles.ctrlLabel, { color: theme.textSecondary }]}>Return Qty:</Text>
                            <TouchableOpacity
                              onPress={() => handleUpdateReturnQty(key, state.quantity - 1)}
                              style={styles.qtyBtn}
                            >
                              <Text style={styles.qtyBtnText}>-</Text>
                            </TouchableOpacity>
                            <Text style={styles.qtyVal}>{state.quantity}</Text>
                            <TouchableOpacity
                              onPress={() => handleUpdateReturnQty(key, state.quantity + 1)}
                              style={styles.qtyBtn}
                            >
                              <Text style={styles.qtyBtnText}>+</Text>
                            </TouchableOpacity>
                          </View>

                          <View style={styles.restockSwitch}>
                            <Text style={[styles.ctrlLabel, { color: theme.textSecondary }]}>Restock:</Text>
                            <Switch
                              value={state.restock}
                              onValueChange={(val) => handleToggleRestock(key, val)}
                              trackColor={{ false: '#cbd5e0', true: '#48bb78' }}
                              thumbColor="#fff"
                            />
                          </View>
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>

              {/* 2. Outward Replacement Leg */}
              <View style={[styles.sectionBox, { backgroundColor: '#ebf8ff', borderColor: '#bee3f8', marginTop: 12 }]}>
                <View style={styles.sectionHeaderRow}>
                  <Text style={[styles.sectionTitle, { color: '#2b6cb0' }]}>
                    2. Replacement Items (Outward)
                  </Text>
                  <Text style={[styles.sectionValueBadge, { color: '#2b6cb0' }]}>
                    Total: ₹{newSaleSummary.grandTotal.toFixed(2)}
                  </Text>
                </View>

                {/* Product Search */}
                <View style={styles.searchContainer}>
                  <Search size={14} color="#a0aec0" style={styles.searchIcon} />
                  <TextInput
                    placeholder="Search product from catalog..."
                    placeholderTextColor="#a0aec0"
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    style={[styles.searchInput, { backgroundColor: '#fff', borderColor: '#bee3f8' }]}
                  />
                </View>

                {filteredProducts.length > 0 && (
                  <View style={styles.searchDropdown}>
                    {filteredProducts.map((p) => (
                      <TouchableOpacity
                        key={p.id}
                        onPress={() => handleAddProduct(p)}
                        style={styles.searchResultItem}
                      >
                        <View>
                          <Text style={styles.searchResultTitle}>{p.name}</Text>
                          <Text style={styles.searchResultSub}>Stock: {p.currentStock} {p.unit}</Text>
                        </View>
                        <Text style={styles.searchResultPrice}>₹{p.sellingPrice}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                {/* Added Replacement Items */}
                {newItems.length === 0 ? (
                  <Text style={styles.emptyItemsText}>Search and add replacement items above</Text>
                ) : (
                  newItems.map((item) => {
                    const calcLine = newSaleSummary.billResult?.lines?.find(
                      (l) => l.id === (item.productId || item.id)
                    );
                    const lineFinal = calcLine ? calcLine.lineFinalAmount : (item.price * item.quantity);
                    const hasTax = item.taxRate > 0;

                    return (
                      <View key={item.id} style={styles.addedItemCard}>
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            <Text style={styles.addedItemName}>{item.name}</Text>
                            {hasTax && (
                              <View
                                style={{
                                  backgroundColor: item.priceIncludesGst ? '#c6f6d5' : '#edf2f7',
                                  paddingHorizontal: 5,
                                  paddingVertical: 1,
                                  borderRadius: 4,
                                }}
                              >
                                <Text
                                  style={{
                                    fontSize: 9,
                                    fontWeight: '700',
                                    color: item.priceIncludesGst ? '#22543d' : '#4a5568',
                                  }}
                                >
                                  {item.priceIncludesGst ? `Incl. ${item.taxRate}% GST` : `+${item.taxRate}% GST`}
                                </Text>
                              </View>
                            )}
                          </View>
                          <Text style={styles.addedItemSub}>
                            ₹{item.price} × {item.quantity} = <Text style={{ fontWeight: '700', color: theme.textPrimary }}>₹{lineFinal.toFixed(2)}</Text>
                          </Text>
                        </View>
                        <View style={styles.qtyControl}>
                          <TouchableOpacity
                            onPress={() => handleUpdateNewItemQty(item.id, item.quantity - 1)}
                            style={styles.qtyBtn}
                          >
                            <Text style={styles.qtyBtnText}>-</Text>
                          </TouchableOpacity>
                          <Text style={styles.qtyVal}>{item.quantity}</Text>
                          <TouchableOpacity
                            onPress={() => handleUpdateNewItemQty(item.id, item.quantity + 1)}
                            style={styles.qtyBtn}
                          >
                            <Text style={styles.qtyBtnText}>+</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => handleRemoveNewItem(item.id)}
                            style={{ marginLeft: 8, padding: 4 }}
                          >
                            <Trash2 size={16} color="#e53e3e" />
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  })
                )}
              </View>

              {/* 3. Settlement Breakdown */}
              <View style={[styles.settleBox, { backgroundColor: '#f7fafc', borderColor: theme.borderColor, marginTop: 12 }]}>
                <View style={styles.settleRow}>
                  <Text style={styles.settleLabel}>New Items Total:</Text>
                  <Text style={styles.settleVal}>₹{newSaleSummary.grandTotal.toFixed(2)}</Text>
                </View>
                <View style={styles.settleRow}>
                  <Text style={styles.settleLabel}>Less Return Credit:</Text>
                  <Text style={[styles.settleVal, { color: '#38a169' }]}>
                    -₹{returnSummary.refundAmount.toFixed(2)}
                  </Text>
                </View>
                <View style={[styles.settleRow, styles.settleTotalRow]}>
                  <Text style={styles.settleTotalLabel}>
                    {isEven ? 'Net Difference:' : isUpgrade ? 'Customer Pays:' : 'Store Refunds:'}
                  </Text>
                  <Text
                    style={[
                      styles.settleTotalVal,
                      { color: isUpgrade ? '#3182ce' : isDowngrade ? '#38a169' : theme.textPrimary },
                    ]}
                  >
                    {isEven ? '₹0.00' : `₹${Math.abs(differenceAmount).toFixed(2)}`}
                  </Text>
                </View>

                {/* Goodwill / Exchange Discount Row */}
                <View style={{ marginTop: 8, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#e2e8f0' }}>
                  <Text style={styles.ctrlLabel}>Goodwill / Exchange Discount (₹):</Text>
                  <TextInput
                    placeholder="0.00 (optional discount)"
                    placeholderTextColor="#a0aec0"
                    keyboardType="numeric"
                    value={exchangeDiscount}
                    onChangeText={setExchangeDiscount}
                    style={[styles.notesInput, { color: '#38a169', fontWeight: '700' }]}
                  />
                </View>

                {/* Settlement Method Selector */}
                {!isEven && (
                  <View style={{ marginTop: 10 }}>
                    <Text style={styles.ctrlLabel}>
                      {isUpgrade ? 'Collect Difference Via:' : 'Refund Difference Via:'}
                    </Text>
                    <View style={styles.methodRow}>
                      {(['cash', 'upi', 'card', 'store_credit', 'credit_ledger'] as const).map((m) => (
                        <TouchableOpacity
                          key={m}
                          onPress={() => setSettlementMethod(m)}
                          style={[
                            styles.methodBtn,
                            settlementMethod === m && styles.methodBtnActive,
                          ]}
                        >
                          <Text
                            style={[
                              styles.methodBtnText,
                              settlementMethod === m && styles.methodBtnTextActive,
                            ]}
                          >
                            {m.replace('_', ' ').toUpperCase()}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}

                {/* Exchange Reason */}
                <View style={{ marginTop: 10 }}>
                  <Text style={styles.ctrlLabel}>Exchange Notes / Reason:</Text>
                  <TextInput
                    placeholder="e.g. Size M swapped for Size L"
                    placeholderTextColor="#a0aec0"
                    value={notes}
                    onChangeText={setNotes}
                    style={styles.notesInput}
                  />
                </View>
              </View>

              <View style={{ height: 24 }} />
            </ScrollView>
          )}

          {/* Footer Action */}
          <View style={[styles.footer, { borderTopColor: theme.borderColor }]}>
            <TouchableOpacity onPress={onClose} style={styles.cancelBtn}>
              <Text style={{ color: theme.textSecondary, fontWeight: '600' }}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleSubmit}
              disabled={isSubmitting || returnSummary.items.length === 0 || newItems.length === 0}
              style={[
                styles.confirmBtn,
                (isSubmitting || returnSummary.items.length === 0 || newItems.length === 0) && {
                  opacity: 0.5,
                },
              ]}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.confirmBtnText}>Confirm Exchange</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    maxHeight: '90%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 12,
  },
  closeBtn: {
    padding: 4,
  },
  centerLoading: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    padding: 16,
  },
  sectionBox: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  sectionValueBadge: {
    fontSize: 12,
    fontWeight: '700',
  },
  itemCard: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 10,
    marginBottom: 8,
  },
  itemRowTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  itemName: {
    fontSize: 13,
    fontWeight: '600',
  },
  itemSub: {
    fontSize: 11,
    marginTop: 2,
  },
  itemControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e2e8f0',
  },
  qtyControl: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  ctrlLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  qtyBtn: {
    width: 24,
    height: 24,
    borderRadius: 4,
    backgroundColor: '#edf2f7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2d3748',
  },
  qtyVal: {
    fontSize: 13,
    fontWeight: '700',
    minWidth: 16,
    textAlign: 'center',
  },
  restockSwitch: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  searchContainer: {
    position: 'relative',
    marginBottom: 8,
  },
  searchIcon: {
    position: 'absolute',
    left: 10,
    top: 10,
    zIndex: 1,
  },
  searchInput: {
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    paddingLeft: 30,
    paddingRight: 10,
    fontSize: 12,
  },
  searchDropdown: {
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 8,
    overflow: 'hidden',
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#edf2f7',
  },
  searchResultTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2d3748',
  },
  searchResultSub: {
    fontSize: 10,
    color: '#718096',
  },
  searchResultPrice: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2b6cb0',
  },
  emptyItemsText: {
    textAlign: 'center',
    paddingVertical: 12,
    fontSize: 11,
    color: '#718096',
  },
  addedItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 8,
    marginBottom: 6,
  },
  addedItemName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2d3748',
  },
  addedItemSub: {
    fontSize: 10,
    color: '#718096',
    marginTop: 1,
  },
  settleBox: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
  },
  settleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  settleLabel: {
    fontSize: 12,
    color: '#718096',
  },
  settleVal: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2d3748',
  },
  settleTotalRow: {
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingTop: 6,
    marginTop: 4,
  },
  settleTotalLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1a202c',
  },
  settleTotalVal: {
    fontSize: 15,
    fontWeight: '800',
  },
  methodRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  methodBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#cbd5e0',
    backgroundColor: '#fff',
  },
  methodBtnActive: {
    backgroundColor: BRAND_COLORS.navyInk,
    borderColor: BRAND_COLORS.navyInk,
  },
  methodBtnText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#4a5568',
  },
  methodBtnTextActive: {
    color: '#fff',
  },
  notesInput: {
    height: 34,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#fff',
    paddingHorizontal: 8,
    fontSize: 12,
    marginTop: 4,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
  },
  cancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  confirmBtn: {
    backgroundColor: BRAND_COLORS.navyInk,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  confirmBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
});
