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
import { X, RotateCcw, Box, Check, AlertCircle, Printer } from 'lucide-react-native';
import { salesApi } from '@/api/sales';
import type { Sale, ReturnedItemLine, CreateSaleReturnPayload } from '@/types/sale';
import { calculateReturnSummary, ReturnItemRequest } from '@shared/saleReturnCalculator';
import { BRAND_COLORS } from '@/constants/theme';
import { useAppTheme } from '@/hooks/useAppTheme';

interface ProcessReturnModalProps {
  visible: boolean;
  sale: Sale | null;
  onClose: () => void;
  onSuccess: (newReturn: any) => void;
}

export function ProcessReturnModal({
  visible,
  sale,
  onClose,
  onSuccess,
}: ProcessReturnModalProps) {
  const theme = useAppTheme();
  const [loadingPastReturns, setLoadingPastReturns] = useState(false);
  const [pastReturns, setPastReturns] = useState<any[]>([]);
  const [selectedItems, setSelectedItems] = useState<
    Record<string, { selected: boolean; quantity: number; restock: boolean }>
  >({});
  const [refundMethod, setRefundMethod] = useState<'cash' | 'upi' | 'card' | 'store_credit' | 'credit_reversal'>(
    'cash'
  );
  const [reason, setReason] = useState('customer_changed_mind');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!visible || !sale?.id) return;

    setRefundMethod(sale.paymentMethod === 'credit' ? 'credit_reversal' : 'cash');
    setLoadingPastReturns(true);
    salesApi
      .getReturnsForSale(sale.id)
      .then((returns) => {
        setPastReturns(returns || []);
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
        setSelectedItems(initial);
      })
      .catch((err) => console.error('Failed to load past returns', err))
      .finally(() => setLoadingPastReturns(false));
  }, [visible, sale]);

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
    })
    return map;
  }, [sale?.items, pastReturns]);

  const computedSummary = useMemo(() => {
    if (!sale) return { items: [], subtotal: 0, totalTax: 0, extraChargesRefunded: 0, refundAmount: 0 };
    const items = Array.isArray(sale.items) ? sale.items : [];
    const requests: ReturnItemRequest[] = [];

    items.forEach((item, index) => {
      const key = item.productId || item.productName || `item-${index}`;
      const state = selectedItems[key];
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
      return calculateReturnSummary(items as any, requests, 0);
    } catch {
      return { items: [], subtotal: 0, totalTax: 0, extraChargesRefunded: 0, refundAmount: 0 };
    }
  }, [sale, selectedItems]);

  const handleToggleSelect = (key: string) => {
    setSelectedItems((prev) => {
      const curr = prev[key] || { selected: false, quantity: 1, restock: true };
      return {
        ...prev,
        [key]: { ...curr, selected: !curr.selected },
      };
    });
  };

  const handleQuantityChange = (key: string, val: number) => {
    const max = itemRemainingMap.get(key) || 1;
    const cleanVal = Math.max(1, Math.min(val, max));
    setSelectedItems((prev) => {
      const curr = prev[key] || { selected: true, quantity: 1, restock: true };
      return {
        ...prev,
        [key]: { ...curr, quantity: cleanVal },
      };
    });
  };

  const handleToggleRestock = (key: string) => {
    setSelectedItems((prev) => {
      const curr = prev[key] || { selected: true, quantity: 1, restock: true };
      return {
        ...prev,
        [key]: { ...curr, restock: !curr.restock },
      };
    });
  };

  const handleSubmit = async () => {
    if (!sale) return;
    if (computedSummary.items.length === 0) {
      Alert.alert('No Items Selected', 'Please select at least one item to return.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: CreateSaleReturnPayload = {
        items: computedSummary.items.map((i) => ({
          productId: i.productId,
          productName: i.productName,
          quantity: i.quantity,
          restock: i.restock,
        })),
        refundMethod,
        reason,
        notes,
        extraChargesRefunded: computedSummary.extraChargesRefunded,
      };

      const res = await salesApi.createSaleReturn(sale.id, payload);
      Alert.alert('Return Processed', `Credit Note ${res.saleReturn?.returnNumber || ''} created successfully.`);
      onSuccess(res.saleReturn);
      onClose();
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to process sales return.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!sale) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.modalCard, { backgroundColor: theme.cardBg }]}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: theme.borderColor }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <RotateCcw size={20} color={BRAND_COLORS.rose500} />
              <Text style={[styles.title, { color: theme.textPrimary }]}>
                Process Return #{sale.invoiceNumber}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={20} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} showsVerticalScrollIndicator>
            {loadingPastReturns ? (
              <ActivityIndicator size="large" color={BRAND_COLORS.blue600} style={{ padding: 24 }} />
            ) : (
              <>
                <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>SELECT ITEMS TO RETURN</Text>

                {sale.items?.map((item, idx) => {
                  const key = item.productId || item.productName || `item-${idx}`;
                  const remaining = itemRemainingMap.get(key) || 0;
                  const state = selectedItems[key] || { selected: false, quantity: 1, restock: true };
                  const isAvailable = remaining > 0;

                  return (
                    <View
                      key={key}
                      style={[
                        styles.itemRow,
                        {
                          backgroundColor: state.selected && isAvailable ? 'rgba(37, 99, 235, 0.05)' : theme.bg,
                          borderColor: state.selected && isAvailable ? BRAND_COLORS.blue600 : theme.borderColor,
                          opacity: isAvailable ? 1 : 0.4,
                        },
                      ]}
                    >
                      <TouchableOpacity
                        disabled={!isAvailable}
                        onPress={() => handleToggleSelect(key)}
                        style={styles.itemCheckArea}
                      >
                        <View
                          style={[
                            styles.checkbox,
                            {
                              backgroundColor: state.selected && isAvailable ? BRAND_COLORS.blue600 : 'transparent',
                              borderColor: state.selected && isAvailable ? BRAND_COLORS.blue600 : theme.borderColor,
                            },
                          ]}
                        >
                          {state.selected && isAvailable && <Check size={14} color="#FFF" />}
                        </View>
                        <View style={{ flex: 1, marginLeft: 10 }}>
                          <Text style={[styles.itemName, { color: theme.textPrimary }]}>{item.productName}</Text>
                          <Text style={[styles.itemMeta, { color: theme.textSecondary }]}>
                            Sold: {item.quantity} · Available: {remaining} · ₹{item.unitPrice}
                          </Text>
                        </View>
                      </TouchableOpacity>

                      {isAvailable && state.selected && (
                        <View style={styles.controlsRow}>
                          <View style={styles.qtyControl}>
                            <TouchableOpacity
                              onPress={() => handleQuantityChange(key, state.quantity - 1)}
                              style={[styles.qtyBtn, { backgroundColor: theme.borderColor }]}
                            >
                              <Text style={[styles.qtyBtnText, { color: theme.textPrimary }]}>-</Text>
                            </TouchableOpacity>
                            <Text style={[styles.qtyValue, { color: theme.textPrimary }]}>{state.quantity}</Text>
                            <TouchableOpacity
                              onPress={() => handleQuantityChange(key, state.quantity + 1)}
                              style={[styles.qtyBtn, { backgroundColor: theme.borderColor }]}
                            >
                              <Text style={[styles.qtyBtnText, { color: theme.textPrimary }]}>+</Text>
                            </TouchableOpacity>
                          </View>

                          <TouchableOpacity
                            onPress={() => handleToggleRestock(key)}
                            style={[
                              styles.restockBadge,
                              {
                                backgroundColor: state.restock ? 'rgba(16, 185, 129, 0.12)' : 'rgba(100, 116, 139, 0.12)',
                              },
                            ]}
                          >
                            <Box size={12} color={state.restock ? '#10B981' : '#64748B'} />
                            <Text style={{ fontSize: 11, fontWeight: '600', color: state.restock ? '#10B981' : '#64748B', marginLeft: 4 }}>
                              {state.restock ? 'Restock' : 'No Restock'}
                            </Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  );
                })}

                {/* Refund Totals Card */}
                <View style={[styles.summaryCard, { backgroundColor: '#0F172A' }]}>
                  <View style={styles.summaryLine}>
                    <Text style={styles.summaryLabel}>Taxable Subtotal:</Text>
                    <Text style={styles.summaryVal}>₹{computedSummary.subtotal.toFixed(2)}</Text>
                  </View>
                  <View style={styles.summaryLine}>
                    <Text style={styles.summaryLabel}>GST Reversal:</Text>
                    <Text style={styles.summaryVal}>₹{computedSummary.totalTax.toFixed(2)}</Text>
                  </View>
                  <View style={[styles.summaryLine, styles.totalLine]}>
                    <Text style={styles.totalLabel}>TOTAL REFUND:</Text>
                    <Text style={styles.totalVal}>₹{computedSummary.refundAmount.toFixed(2)}</Text>
                  </View>
                </View>

                {/* Refund Method Chips */}
                <Text style={[styles.sectionLabel, { color: theme.textSecondary, marginTop: 14 }]}>REFUND SETTLEMENT MODE</Text>
                <View style={styles.methodRow}>
                  {[
                    { id: 'cash', label: 'Cash' },
                    { id: 'upi', label: 'UPI / Bank' },
                    { id: 'card', label: 'Card' },
                    { id: 'store_credit', label: 'Store Credit' },
                    { id: 'credit_reversal', label: 'Credit Reversal' },
                  ].map((m) => {
                    const active = refundMethod === m.id;
                    return (
                      <TouchableOpacity
                        key={m.id}
                        onPress={() => setRefundMethod(m.id as any)}
                        style={[
                          styles.methodChip,
                          {
                            backgroundColor: active ? BRAND_COLORS.blue600 : theme.bg,
                            borderColor: active ? BRAND_COLORS.blue600 : theme.borderColor,
                          },
                        ]}
                      >
                        <Text style={{ fontSize: 12, fontWeight: '600', color: active ? '#FFF' : theme.textPrimary }}>
                          {m.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )}
          </ScrollView>

          {/* Actions Footer */}
          <View style={[styles.footer, { borderTopColor: theme.borderColor }]}>
            <TouchableOpacity onPress={onClose} style={[styles.cancelBtn, { borderColor: theme.borderColor }]}>
              <Text style={{ color: theme.textPrimary, fontWeight: '600' }}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleSubmit}
              disabled={isSubmitting || computedSummary.refundAmount <= 0}
              style={[
                styles.confirmBtn,
                { opacity: isSubmitting || computedSummary.refundAmount <= 0 ? 0.5 : 1 },
              ]}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Text style={styles.confirmBtnText}>
                  Confirm Return (₹{computedSummary.refundAmount.toFixed(2)})
                </Text>
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
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    maxHeight: '90%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
  },
  closeBtn: {
    padding: 4,
  },
  body: {
    padding: 16,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  itemRow: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  itemCheckArea: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemName: {
    fontSize: 14,
    fontWeight: '600',
  },
  itemMeta: {
    fontSize: 12,
    marginTop: 2,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(150,150,150,0.2)',
  },
  qtyControl: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  qtyBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyBtnText: {
    fontSize: 16,
    fontWeight: '700',
  },
  qtyValue: {
    fontSize: 14,
    fontWeight: '700',
    minWidth: 20,
    textAlign: 'center',
  },
  restockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  summaryCard: {
    borderRadius: 14,
    padding: 14,
    marginTop: 10,
  },
  summaryLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  summaryLabel: {
    color: '#94A3B8',
    fontSize: 12,
  },
  summaryVal: {
    color: '#E2E8F0',
    fontSize: 12,
    fontWeight: '600',
  },
  totalLine: {
    borderTopWidth: 1,
    borderTopColor: '#334155',
    marginTop: 6,
    paddingTop: 8,
  },
  totalLabel: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '800',
  },
  totalVal: {
    color: '#34D399',
    fontSize: 16,
    fontWeight: '800',
  },
  methodRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 16,
  },
  methodChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  footer: {
    flexDirection: 'row',
    padding: 16,
    borderTopWidth: 1,
    gap: 10,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
  },
  confirmBtn: {
    flex: 2,
    backgroundColor: BRAND_COLORS.rose500,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 10,
  },
  confirmBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
