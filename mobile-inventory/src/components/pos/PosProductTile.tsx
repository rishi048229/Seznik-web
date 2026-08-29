import React, { memo } from 'react';
import { View, Text, Image, Pressable, TouchableOpacity, StyleSheet } from 'react-native';
import { Plus, Minus, Trash2, Package } from 'lucide-react-native';
import { Product } from '@/types/product';
import { BRAND_COLORS } from '@/constants/theme';

interface PosProductTileProps {
  product: Product;
  cartQty: number;
  codeNumber: string;
  isDark: boolean;
  cardBg: string;
  borderColor: string;
  textPrimary: string;
  textSecondary: string;
  lowStockLabel: string;
  onAdd: (product: Product) => void;
  onDecrement: (productId: string) => void;
}

export const PosProductTile = memo(function PosProductTile({
  product,
  cartQty,
  codeNumber,
  isDark,
  cardBg,
  borderColor,
  textPrimary,
  textSecondary,
  lowStockLabel,
  onAdd,
  onDecrement,
}: PosProductTileProps) {
  const inCart = cartQty > 0;
  const rawStock = typeof product.currentStock === 'number'
    ? product.currentStock
    : typeof (product as any).stockQty === 'number'
    ? (product as any).stockQty
    : undefined;

  const stock = rawStock !== undefined ? Math.max(0, rawStock) : undefined;
  const threshold = product.lowStockThreshold ?? (product as any).reorderThreshold ?? 5;
  const isOutOfStock = stock !== undefined && stock <= 0;
  const isLowStock = !isOutOfStock && stock !== undefined && stock <= threshold;

  return (
    <Pressable
      onPress={inCart ? undefined : () => onAdd(product)}
      android_ripple={inCart ? undefined : { color: isOutOfStock ? 'rgba(239, 68, 68, 0.12)' : 'rgba(37, 99, 235, 0.18)' }}
      style={({ pressed }) => [
        styles.productTile,
        {
          backgroundColor: inCart
            ? 'rgba(37, 99, 235, 0.12)'
            : isOutOfStock
            ? (isDark ? '#231515' : '#FFF5F5')
            : cardBg,
          borderColor: inCart
            ? BRAND_COLORS.blue600
            : isOutOfStock
            ? 'rgba(239, 68, 68, 0.35)'
            : borderColor,
          opacity: isOutOfStock && !inCart ? 0.78 : pressed ? 0.92 : 1,
        },
      ]}
    >
      <View style={styles.tileHeaderRow}>
        <Text style={[styles.codeTagText, { color: textSecondary }]}>#{codeNumber}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          {product.discountValue && product.discountValue > 0 ? (
            <View style={[styles.stockBadge, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
              <Text style={[styles.stockBadgeText, { color: '#10B981' }]}>
                {product.discountType === 'percent' ? `${product.discountValue}% OFF` : `₹${product.discountValue} OFF`}
              </Text>
            </View>
          ) : null}
          {isOutOfStock ? (
            <View style={[styles.stockBadge, { backgroundColor: 'rgba(239, 68, 68, 0.2)' }]}>
              <Text style={[styles.stockBadgeText, { color: '#EF4444' }]}>
                🚨 Out
              </Text>
            </View>
          ) : isLowStock ? (
            <View style={styles.stockBadge}>
              <Text style={styles.stockBadgeText}>
                {lowStockLabel}: {stock}
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      <View style={styles.tileImageWrapper}>
        {product.imageUrl ? (
          <Image source={{ uri: product.imageUrl }} style={styles.tileProductImage} resizeMode="cover" />
        ) : (
          <View style={[styles.tileImagePlaceholder, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' }]}>
            <Package size={22} color={textSecondary} />
          </View>
        )}
      </View>

      <Text style={[styles.tileName, { color: isOutOfStock ? textSecondary : textPrimary }]} numberOfLines={2}>
        {product.name}
      </Text>

      <View style={styles.tileFooterRow}>
        <Text style={[styles.tilePrice, isOutOfStock && { color: textSecondary }]}>₹{product.sellingPrice.toFixed(2)}</Text>

        {inCart ? (
          <View style={styles.inCartStepperRow}>
            <TouchableOpacity
              onPress={(e) => {
                e.stopPropagation?.();
                onDecrement(product.id);
              }}
              style={styles.tileStepBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 4 }}
            >
              {cartQty === 1 ? <Trash2 size={12} color="#FFFFFF" /> : <Minus size={12} color="#FFFFFF" />}
            </TouchableOpacity>
            <Text style={[styles.inCartQtyText, { color: textPrimary }]}>{cartQty}</Text>
            <TouchableOpacity
              onPress={(e) => {
                e.stopPropagation?.();
                onAdd(product);
              }}
              style={[styles.tileStepBtn, { backgroundColor: BRAND_COLORS.blue600 }]}
              hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }}
            >
              <Plus size={12} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        ) : isOutOfStock ? (
          <View style={[styles.outOfStockPill, { backgroundColor: 'rgba(239, 68, 68, 0.15)' }]}>
            <Text style={styles.outOfStockPillText}>0 in stock</Text>
          </View>
        ) : (
          <View style={[styles.addCircle, { backgroundColor: isDark ? '#334155' : '#F1F5F9' }]}>
            <Plus size={14} color={textSecondary} />
          </View>
        )}
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  productTile: {
    width: '48.5%',
    borderRadius: 16,
    padding: 10,
    borderWidth: 1,
    marginBottom: 10,
    justifyContent: 'space-between',
    minHeight: 165,
  },
  tileHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  tileImageWrapper: {
    width: '100%',
    height: 65,
    borderRadius: 10,
    overflow: 'hidden',
    marginVertical: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileProductImage: { width: '100%', height: '100%', borderRadius: 10 },
  tileImagePlaceholder: { width: '100%', height: '100%', borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  codeTagText: { fontSize: 9, fontWeight: '700' },
  stockBadge: { backgroundColor: 'rgba(239, 68, 68, 0.15)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  stockBadgeText: { fontSize: 9, fontWeight: '800', color: '#EF4444' },
  tileName: { fontSize: 12, fontWeight: '700', marginBottom: 6 },
  tileFooterRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto' },
  tilePrice: { fontSize: 14, fontWeight: '900', color: BRAND_COLORS.sky500 },
  inCartStepperRow: { flexDirection: 'row', alignItems: 'center' },
  tileStepBtn: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inCartQtyText: { fontSize: 11, fontWeight: '900', marginHorizontal: 6, minWidth: 14, textAlign: 'center' },
  addCircle: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  outOfStockPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  outOfStockPillText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#EF4444',
  },
});
