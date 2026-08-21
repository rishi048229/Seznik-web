import React from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet } from 'react-native';
import { UserCircle2, ChevronDown } from 'lucide-react-native';
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

  return (
    <View style={[styles.stickyTenderFooter, { backgroundColor: BRAND_COLORS.navyInk }]}>
      <TouchableOpacity onPress={onOpenCustomerPicker} style={styles.customerRow}>
        <UserCircle2 size={14} color="#94A3B8" />
        <Text style={styles.customerRowText} numberOfLines={1}>
          {selectedCustomerName || t('walkInCustomer', 'Walk-in Customer')}
        </Text>
        <ChevronDown size={13} color="#94A3B8" />
      </TouchableOpacity>

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
            ₹{creditRemaining.toFixed(2)} to {(selectedCustomerName || t('customer', 'customer')).split(' ')[0]}&apos;s credit
          </Text>
        </View>
      ) : null}

      <View style={styles.tenderPillsRow}>
        {(['cash', 'upi', 'card', 'credit'] as PaymentMethod[]).map((method) => (
          <TouchableOpacity
            key={method}
            onPress={() => onSelectPaymentMethod(method)}
            style={[
              styles.tenderChip,
              paymentMethod === method && { backgroundColor: BRAND_COLORS.blue600, borderColor: BRAND_COLORS.blue600 },
            ]}
          >
            <Text style={[styles.tenderChipText, paymentMethod === method ? { color: '#FFFFFF' } : { color: '#94A3B8' }]}>
              {method === 'credit' ? t('credit', 'CREDIT') : method.toUpperCase()}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.footerMainRow}>
        <TouchableOpacity onPress={onOpenCheckout} style={{ flex: 1, marginRight: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={styles.tenderTotalLabel}>
              {t('total', 'TOTAL')}: {cartTotalCount} {cartTotalCount === 1 ? t('item', 'ITEM') : t('items', 'ITEMS')}
            </Text>
            {totalDiscount > 0 ? (
              <View style={{ backgroundColor: '#10B981', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6, marginLeft: 6 }}>
                <Text style={{ color: '#FFFFFF', fontSize: 9, fontWeight: '800' }}>Save ₹{totalDiscount.toFixed(0)}</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.tenderTotalPrice}>₹{grandTotalNow.toFixed(2)}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={onOpenCheckout}
          disabled={cartItems.length === 0}
          style={[styles.checkoutActionBtn, cartItems.length === 0 && { opacity: 0.5 }]}
        >
          <Text style={styles.checkoutActionText}>{t('payNow', 'Pay Now')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  stickyTenderFooter: { position: 'absolute', bottom: 12, left: 16, right: 16, borderRadius: 20, padding: 12, elevation: 12 },
  customerRow: { flexDirection: 'row', alignItems: 'center', paddingBottom: 8, marginBottom: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.12)' },
  customerRowText: { flex: 1, fontSize: 12, fontWeight: '700', color: '#E2E8F0', marginLeft: 6, marginRight: 4 },
  creditRow: { flexDirection: 'row', alignItems: 'center', paddingBottom: 8, marginBottom: 4 },
  creditLabel: { fontSize: 11, fontWeight: '700', color: '#94A3B8' },
  creditInput: { backgroundColor: 'rgba(255,255,255,0.1)', color: '#FFFFFF', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, fontSize: 12, fontWeight: '800', width: 70, marginLeft: 4, marginRight: 10 },
  creditRemainingText: { flex: 1, fontSize: 10, fontWeight: '700', color: '#F59E0B' },
  tenderPillsRow: { flexDirection: 'row', marginBottom: 10 },
  tenderChip: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 10, borderWidth: 1, borderColor: '#334155', marginRight: 6 },
  tenderChipText: { fontSize: 11, fontWeight: '800' },
  footerMainRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tenderTotalLabel: { fontSize: 9, fontWeight: '800', color: '#94A3B8' },
  tenderTotalPrice: { fontSize: 18, fontWeight: '900', color: '#FFFFFF' },
  checkoutActionBtn: { backgroundColor: BRAND_COLORS.blue600, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12, minWidth: 64, alignItems: 'center' },
  checkoutActionText: { color: '#FFFFFF', fontWeight: '900', fontSize: 12 },
});
