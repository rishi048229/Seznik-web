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
import { useAppTheme } from '@/hooks/useAppTheme';

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
  const theme = useAppTheme();
  const isDark = theme.isDark;

  const cartItems = useCartStore((state) => state.items);
  const getGrandTotal = useCartStore((state) => state.getGrandTotal);
  const getTotalDiscount = useCartStore((state) => state.getTotalDiscount);

  const cartTotalCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const grandTotalNow = getGrandTotal();
  const totalDiscount = getTotalDiscount();
  const creditRemaining = Math.max(0, grandTotalNow - (parseFloat(creditAmountReceivedInput) || 0));

  const PAYMENT_OPTIONS: { method: PaymentMethod; label: string; icon: (color: string) => React.ReactNode }[] = [
    { method: 'cash', label: 'CASH', icon: (color) => <Banknote size={13} color={color} /> },
    { method: 'upi', label: 'UPI', icon: (color) => <QrCode size={13} color={color} /> },
    { method: 'card', label: 'CARD', icon: (color) => <CreditCard size={13} color={color} /> },
    { method: 'credit', label: 'CREDIT', icon: (color) => <BookOpen size={13} color={color} /> },
  ];

  return (
    <View
      style={[
        styles.stickyTenderFooter,
        {
          backgroundColor: isDark ? '#0F172A' : '#FFFFFF',
          borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : BRAND_COLORS.slate200,
          shadowColor: isDark ? '#000000' : '#0F172A',
          shadowOpacity: isDark ? 0.4 : 0.08,
          shadowOffset: { width: 0, height: 4 },
          shadowRadius: 16,
        },
      ]}
    >
      {/* Customer Selector Row */}
      <TouchableOpacity
        onPress={onOpenCustomerPicker}
        style={[
          styles.customerRow,
          { borderBottomColor: isDark ? 'rgba(255, 255, 255, 0.08)' : BRAND_COLORS.slate100 },
        ]}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
          <UserCircle2 size={16} color={isDark ? '#60A5FA' : BRAND_COLORS.blue600} />
          <Text
            style={[
              styles.customerRowText,
              { color: theme.textPrimary },
            ]}
            numberOfLines={1}
          >
            {selectedCustomerName || t('walkInCustomer', 'Walk-in Customer')}
          </Text>
        </View>
        <View
          style={[
            styles.customerChangeBadge,
            { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : BRAND_COLORS.slate100 },
          ]}
        >
          <Text
            style={[
              styles.customerChangeText,
              { color: theme.textSecondary },
            ]}
          >
            {t('change', 'Change')}
          </Text>
          <ChevronDown size={12} color={theme.textSecondary} />
        </View>
      </TouchableOpacity>

      {/* Credit Partial Amount Input */}
      {paymentMethod === 'credit' ? (
        <View style={styles.creditRow}>
          <Text style={[styles.creditLabel, { color: theme.textSecondary }]}>{t('receivedNow', 'Received Now')} ₹</Text>
          <TextInput
            style={[
              styles.creditInput,
              {
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : BRAND_COLORS.slate100,
                color: theme.textPrimary,
                borderColor: isDark ? 'rgba(255, 255, 255, 0.15)' : BRAND_COLORS.slate200,
                borderWidth: 1,
              },
            ]}
            keyboardType="numeric"
            value={creditAmountReceivedInput}
            onChangeText={onCreditAmountChange}
            placeholder="0"
            placeholderTextColor={theme.textSecondary}
          />
          <Text
            style={[
              styles.creditRemainingText,
              { color: isDark ? '#F59E0B' : '#D97706' },
            ]}
            numberOfLines={1}
          >
            ₹{creditRemaining.toFixed(2)} to credit
          </Text>
        </View>
      ) : null}

      {/* Tactile Payment Method Chips */}
      <View style={styles.tenderPillsRow}>
        {PAYMENT_OPTIONS.map(({ method, label, icon }) => {
          const isSelected = paymentMethod === method;
          const chipColor = isSelected
            ? '#FFFFFF'
            : isDark
            ? '#94A3B8'
            : '#475569';
          return (
            <TouchableOpacity
              key={method}
              onPress={() => onSelectPaymentMethod(method)}
              style={[
                styles.tenderChip,
                {
                  backgroundColor: isSelected
                    ? BRAND_COLORS.blue600
                    : isDark
                    ? 'rgba(255, 255, 255, 0.06)'
                    : BRAND_COLORS.slate50,
                  borderColor: isSelected
                    ? BRAND_COLORS.blue600
                    : isDark
                    ? '#1E293B'
                    : BRAND_COLORS.slate200,
                },
              ]}
            >
              {icon(chipColor)}
              <Text
                style={[
                  styles.tenderChipText,
                  {
                    color: chipColor,
                    fontWeight: isSelected ? '800' : '700',
                  },
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
            <Text style={[styles.tenderTotalLabel, { color: theme.textSecondary }]}>
              {cartTotalCount} {cartTotalCount === 1 ? 'ITEM' : 'ITEMS'}
            </Text>
            {totalDiscount > 0 ? (
              <View
                style={[
                  styles.savingsPill,
                  {
                    backgroundColor: isDark ? 'rgba(16, 185, 129, 0.2)' : 'rgba(16, 185, 129, 0.12)',
                    borderColor: isDark ? 'rgba(16, 185, 129, 0.3)' : 'rgba(16, 185, 129, 0.25)',
                    borderWidth: 1,
                  },
                ]}
              >
                <Sparkles size={9} color="#10B981" />
                <Text style={styles.savingsText}>Save ₹{totalDiscount.toFixed(0)}</Text>
              </View>
            ) : null}
          </View>
          <Text style={[styles.tenderTotalPrice, { color: theme.textPrimary }]}>₹{grandTotalNow.toFixed(2)}</Text>
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
    elevation: 8,
    borderWidth: 1,
  },
  customerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 8,
    marginBottom: 8,
    borderBottomWidth: 1,
  },
  customerRowText: {
    fontSize: 12.5,
    fontWeight: '800',
    marginLeft: 6,
  },
  customerChangeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  customerChangeText: {
    fontSize: 10.5,
    fontWeight: '700',
  },
  creditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 8,
    marginBottom: 4,
  },
  creditLabel: { fontSize: 11, fontWeight: '700' },
  creditInput: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 12,
    fontWeight: '800',
    width: 70,
    marginLeft: 4,
    marginRight: 10,
  },
  creditRemainingText: { flex: 1, fontSize: 10.5, fontWeight: '700' },
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
    letterSpacing: 0.5,
  },
  savingsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
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
