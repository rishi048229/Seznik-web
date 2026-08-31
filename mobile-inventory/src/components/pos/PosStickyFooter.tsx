import React from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet } from 'react-native';
import {
  UserCircle2,
  ChevronDown,
  Banknote,
  QrCode,
  CreditCard,
  BookOpen,
  ArrowRight,
  Sparkles,
} from 'lucide-react-native';
import { useCartStore } from '@/store/useCartStore';
import { PaymentMethod } from '@/types/sale';
import { BRAND_COLORS } from '@/constants/theme';
import { useTranslation } from '@/store/useLanguageStore';

interface PosStickyFooterProps {
  paymentMethod: PaymentMethod;
  creditAmountReceivedInput: string;
  selectedCustomerName: string | null;
  onOpenCheckout: () => void;
  onOpenCustomerPicker: () => void;
  onSelectPaymentMethod: (method: PaymentMethod) => void;
  onCreditAmountChange: (value: string) => void;
}

export const PosStickyFooter = React.memo(function PosStickyFooter({
  paymentMethod,
  creditAmountReceivedInput,
  selectedCustomerName,
  onOpenCheckout,
  onOpenCustomerPicker,
  onSelectPaymentMethod,
  onCreditAmountChange,
}: PosStickyFooterProps) {
  const { t } = useTranslation();
  const cartItems = useCartStore((state) => state.items);
  const getGrandTotal = useCartStore((state) => state.getGrandTotal);
  const getTotalDiscount = useCartStore((state) => state.getTotalDiscount);

  const cartTotalCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const grandTotalNow = getGrandTotal();
  const totalDiscount = getTotalDiscount();
  const creditRemaining = Math.max(0, grandTotalNow - (parseFloat(creditAmountReceivedInput) || 0));

  const PAYMENT_OPTIONS: { method: PaymentMethod; label: string; icon: React.ReactNode }[] = [
    { method: 'cash', label: 'CASH', icon: <Banknote size={14} color={paymentMethod === 'cash' ? '#FFFFFF' : '#94A3B8'} /> },
    { method: 'upi', label: 'UPI', icon: <QrCode size={14} color={paymentMethod === 'upi' ? '#FFFFFF' : '#94A3B8'} /> },
    { method: 'card', label: 'CARD', icon: <CreditCard size={14} color={paymentMethod === 'card' ? '#FFFFFF' : '#94A3B8'} /> },
    { method: 'credit', label: 'CREDIT', icon: <BookOpen size={14} color={paymentMethod === 'credit' ? '#FFFFFF' : '#94A3B8'} /> },
  ];

  return (
    <View style={[styles.stickyTenderFooter, { backgroundColor: '#0B132B' }]}>
      {/* Customer Selector Row */}
      <TouchableOpacity onPress={onOpenCustomerPicker} style={styles.customerRow}>
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
          <UserCircle2 size={16} color="#60A5FA" />
          <Text style={styles.customerRowText} numberOfLines={1}>
            {selectedCustomerName || t('walkInCustomer', 'Walk-in Customer')}
          </Text>
        </View>
        <View style={styles.customerChangeBadge}>
          <Text style={styles.customerChangeText}>Change</Text>
          <ChevronDown size={12} color="#94A3B8" />
        </View>
      </TouchableOpacity>

      {/* Credit Partial Amount Input */}
      {paymentMethod === 'credit' ? (
        <View style={styles.creditRow}>
          <Text style={styles.creditLabel}>{t('receivedNow', 'Received Now')} ₹</Text>
          <TextInput
            style={styles.creditInput}
            keyboardType="numeric"
            value={creditAmountReceivedInput}
            onChangeText={onCreditAmountChange}
            placeholder="0"
            placeholderTextColor="#64748B"
          />
          <Text style={styles.creditRemainingText} numberOfLines={1}>
            ₹{creditRemaining.toFixed(2)} to credit
          </Text>
        </View>
      ) : null}

      {/* Tactile Payment Method Chips */}
      <View style={styles.tenderPillsRow}>
        {PAYMENT_OPTIONS.map(({ method, label, icon }) => {
          const isSelected = paymentMethod === method;
          return (
            <TouchableOpacity
              key={method}
              onPress={() => onSelectPaymentMethod(method)}
              style={[
                styles.tenderChip,
                isSelected && {
                  backgroundColor: BRAND_COLORS.blue600,
                  borderColor: BRAND_COLORS.sky400,
                  elevation: 4,
                },
              ]}
            >
              {icon}
              <Text
                style={[
                  styles.tenderChipText,
                  isSelected ? { color: '#FFFFFF', fontWeight: '900' } : { color: '#94A3B8', fontWeight: '700' },
                ]}
              >
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Bottom Main Checkout Row */}
      <View style={styles.footerMainRow}>
        <TouchableOpacity onPress={onOpenCheckout} style={{ flex: 1, marginRight: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={styles.tenderTotalLabel}>
              {cartTotalCount} {cartTotalCount === 1 ? 'ITEM' : 'ITEMS'}
            </Text>
            {totalDiscount > 0 ? (
              <View style={styles.savingsPill}>
                <Sparkles size={9} color="#10B981" />
                <Text style={styles.savingsText}>Save ₹{totalDiscount.toFixed(0)}</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.tenderTotalPrice}>₹{grandTotalNow.toFixed(2)}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={onOpenCheckout}
          disabled={cartItems.length === 0}
          style={[styles.checkoutActionBtn, cartItems.length === 0 && { opacity: 0.45 }]}
        >
          <Text style={styles.checkoutActionText}>{t('payNow', 'Pay Now')}</Text>
          <ArrowRight size={14} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  stickyTenderFooter: {
    position: 'absolute',
    bottom: 12,
    left: 14,
    right: 14,
    borderRadius: 22,
    padding: 12,
    elevation: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  customerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 8,
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  customerRowText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#F1F5F9',
    marginLeft: 6,
  },
  customerChangeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  customerChangeText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#94A3B8',
  },
  creditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 8,
    marginBottom: 4,
  },
  creditLabel: { fontSize: 11, fontWeight: '700', color: '#94A3B8' },
  creditInput: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    color: '#FFFFFF',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 12,
    fontWeight: '800',
    width: 70,
    marginLeft: 4,
    marginRight: 10,
  },
  creditRemainingText: { flex: 1, fontSize: 10.5, fontWeight: '700', color: '#F59E0B' },
  tenderPillsRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 10,
  },
  tenderChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1E293B',
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
  },
  tenderChipText: { fontSize: 11 },
  footerMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 2,
  },
  tenderTotalLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.5,
  },
  savingsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(16, 185, 129, 0.18)',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
  },
  savingsText: {
    color: '#10B981',
    fontSize: 9.5,
    fontWeight: '800',
  },
  tenderTotalPrice: {
    fontSize: 20,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  checkoutActionBtn: {
    backgroundColor: BRAND_COLORS.blue600,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderRadius: 14,
    minWidth: 90,
    justifyContent: 'center',
    elevation: 4,
    shadowColor: BRAND_COLORS.blue600,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
  },
  checkoutActionText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 13,
    letterSpacing: 0.3,
  },
});
