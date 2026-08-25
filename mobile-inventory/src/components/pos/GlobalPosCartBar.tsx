import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, Platform } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { ShoppingBag, Trash2, ChevronRight } from 'lucide-react-native';
import { useCartStore } from '@/store/useCartStore';
import { useAppTheme } from '@/hooks/useAppTheme';
import { BRAND_COLORS } from '@/constants/theme';
import { useTranslation } from '@/store/useLanguageStore';

function GlobalPosCartBarInner() {
  const theme = useAppTheme();
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useTranslation();

  const clearCart = useCartStore((s) => s.clearCart);
  const setCheckoutModalOpen = useCartStore((s) => s.setCheckoutModalOpen);
  const cartCount = useCartStore((s) => s.items.reduce((sum, item) => sum + item.quantity, 0));
  const grandTotal = useCartStore((s) => s.getGrandTotal());
  const isOnPos = pathname.includes('/pos');

  if (cartCount === 0 || isOnPos) return null;

  const openCheckout = () => {
    setCheckoutModalOpen(true);
    router.push('/(tabs)/pos' as any);
  };

  const handleClearCart = () => {
    Alert.alert(
      t('clearCart', 'Clear Cart'),
      t('clearCartConfirm', 'Remove all items from the cart?'),
      [
        { text: t('cancel', 'Cancel'), style: 'cancel' },
        {
          text: t('clear', 'Clear'),
          style: 'destructive',
          onPress: () => clearCart(),
        },
      ]
    );
  };

  return (
    <View
      style={[
        styles.bar,
        {
          backgroundColor: theme.cardBg,
          borderColor: theme.borderColor,
          bottom: Platform.OS === 'ios' ? 78 : 72,
        },
      ]}
    >
      <TouchableOpacity onPress={openCheckout} style={styles.mainTap} activeOpacity={0.85}>
        <View style={styles.iconBadge}>
          <ShoppingBag size={16} color="#FFFFFF" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.countText, { color: theme.textSecondary }]}>
            {cartCount} {cartCount === 1 ? t('item', 'item') : t('items', 'items')} · {t('pos', 'POS')}
          </Text>
          <Text style={styles.totalText}>₹{grandTotal.toFixed(2)}</Text>
        </View>
        <View style={styles.reviewBtn}>
          <Text style={styles.reviewBtnText}>{t('reviewBill', 'Review Bill')}</Text>
          <ChevronRight size={14} color="#FFFFFF" />
        </View>
      </TouchableOpacity>

      <TouchableOpacity onPress={handleClearCart} style={[styles.clearBtn, { borderColor: theme.borderColor }]} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Trash2 size={16} color="#EF4444" />
      </TouchableOpacity>
    </View>
  );
}

export const GlobalPosCartBar = React.memo(GlobalPosCartBarInner);

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 12,
    right: 12,
    borderRadius: 16,
    borderWidth: 1,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    zIndex: 100,
  },
  mainTap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconBadge: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: BRAND_COLORS.blue600,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countText: { fontSize: 11, fontWeight: '600' },
  totalText: { fontSize: 16, fontWeight: '900', color: BRAND_COLORS.blue600, marginTop: 1 },
  reviewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: BRAND_COLORS.navyInk,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    gap: 2,
  },
  reviewBtnText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
  clearBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
