import React, { memo } from 'react';
import { View, Text, Image, Pressable, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Plus, Minus, Trash2, Tag, AlertTriangle, Layers } from 'lucide-react-native';
import { Product } from '@/types/product';
import { BRAND_COLORS } from '@/constants/theme';
import { isProductAvailable } from '@/utils/businessFeatures';

const CATEGORY_PALETTES = [
  { bg: 'rgba(59, 130, 246, 0.14)', text: '#3B82F6', border: 'rgba(59, 130, 246, 0.28)' }, // Blue
  { bg: 'rgba(16, 185, 129, 0.14)', text: '#10B981', border: 'rgba(16, 185, 129, 0.28)' }, // Emerald
  { bg: 'rgba(139, 92, 246, 0.14)', text: '#8B5CF6', border: 'rgba(139, 92, 246, 0.28)' }, // Purple
  { bg: 'rgba(245, 158, 11, 0.14)', text: '#F59E0B', border: 'rgba(245, 158, 11, 0.28)' }, // Amber
  { bg: 'rgba(236, 72, 153, 0.14)', text: '#EC4899', border: 'rgba(236, 72, 153, 0.28)' }, // Pink
  { bg: 'rgba(14, 165, 233, 0.14)', text: '#0EA5E9', border: 'rgba(14, 165, 233, 0.28)' }, // Sky
  { bg: 'rgba(249, 115, 22, 0.14)', text: '#F97316', border: 'rgba(249, 115, 22, 0.28)' }, // Orange
  { bg: 'rgba(99, 102, 241, 0.14)', text: '#6366F1', border: 'rgba(99, 102, 241, 0.28)' }, // Indigo
];

function getCategoryPalette(name: string = '') {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return CATEGORY_PALETTES[Math.abs(hash) % CATEGORY_PALETTES.length];
}

function getInitials(name: string = '') {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return (name.slice(0, 2) || 'PR').toUpperCase();
}

export interface PosProductTileProps {
  product: Product;
  cartQty: number;
  codeNumber: string;
  isDark: boolean;
  cardBg: string;
  borderColor: string;
  textPrimary: string;
  textSecondary: string;
  lowStockLabel?: string;
  /** When false (restaurant/cafe), hide qty stock badges and gate on isAvailable. */
  trackStock?: boolean;
  viewMode?: 'grid' | 'list';
  onAdd: (product: Product) => void;
  onDecrement: (productId: string) => void;
  onLongPress?: (product: Product) => void;
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
  lowStockLabel = 'Low Stock',
  trackStock = true,
  viewMode = 'grid',
  onAdd,
  onDecrement,
  onLongPress,
}: PosProductTileProps) {
  const inCart = cartQty > 0;
  const palette = getCategoryPalette(product.category?.name || product.categoryId || product.name);
  const initials = getInitials(product.name);

  const rawStock =
    typeof product.currentStock === 'number'
      ? product.currentStock
      : typeof (product as any).stockQty === 'number'
      ? (product as any).stockQty
      : undefined;

  const stock = rawStock !== undefined ? Math.max(0, rawStock) : undefined;
  const threshold = product.lowStockThreshold ?? (product as any).reorderThreshold ?? 5;
  const isUnavailable = !isProductAvailable(product);
  const isOutOfStock = trackStock && stock !== undefined && stock <= 0;
  const isLowStock = trackStock && !isOutOfStock && stock !== undefined && stock <= threshold;
  const isDisabled = trackStock ? isOutOfStock : isUnavailable;

  const stockMeta = () => {
    if (!trackStock) {
      if (isUnavailable) {
        return (
          <View style={[styles.stockBadge, { backgroundColor: 'rgba(239, 68, 68, 0.15)' }]}>
            <Text style={[styles.stockBadgeText, { color: '#EF4444' }]}>Not available</Text>
          </View>
        );
      }
      return null;
    }
    if (isOutOfStock) {
      return (
        <View style={[styles.stockBadge, { backgroundColor: 'rgba(239, 68, 68, 0.15)' }]}>
          <Text style={[styles.stockBadgeText, { color: '#EF4444' }]}>Out of Stock</Text>
        </View>
      );
    }
    if (isLowStock) {
      return (
        <View style={[styles.stockBadge, { backgroundColor: 'rgba(245, 158, 11, 0.15)' }]}>
          <Text style={[styles.stockBadgeText, { color: '#F59E0B' }]}>
            {lowStockLabel}: {stock}
          </Text>
        </View>
      );
    }
    if (stock !== undefined) {
      return (
        <Text style={[styles.stockCountText, { color: textSecondary }]}>
          Stock: {stock}
        </Text>
      );
    }
    return null;
  };

  const gridStockMeta = () => {
    if (!trackStock) {
      if (isUnavailable) {
        return (
          <View style={[styles.stockBadge, { backgroundColor: 'rgba(239, 68, 68, 0.15)' }]}>
            <Text style={[styles.stockBadgeText, { color: '#EF4444' }]}>Not available</Text>
          </View>
        );
      }
      return null;
    }
    if (isOutOfStock) {
      return (
        <View style={[styles.stockBadge, { backgroundColor: 'rgba(239, 68, 68, 0.15)' }]}>
          <Text style={[styles.stockBadgeText, { color: '#EF4444' }]}>Out of Stock</Text>
        </View>
      );
    }
    if (isLowStock) {
      return (
        <View style={[styles.stockBadge, { backgroundColor: 'rgba(245, 158, 11, 0.15)' }]}>
          <Text style={[styles.stockBadgeText, { color: '#F59E0B' }]}>
            {lowStockLabel}: {stock}
          </Text>
        </View>
      );
    }
    if (stock !== undefined) {
      return (
        <Text style={[styles.stockCountText, { color: textSecondary }]}>
          {stock} left
        </Text>
      );
    }
    return null;
  };

  const handleAddPress = () => {
    if (isDisabled) return;
    onAdd(product);
  };

  if (viewMode === 'list') {
    return (
      <Pressable
        onPress={handleAddPress}
        onLongPress={onLongPress ? () => onLongPress(product) : undefined}
        delayLongPress={350}
        android_ripple={{ color: 'rgba(37, 99, 235, 0.16)' }}
        style={({ pressed }) => [
          styles.listRow,
          {
            backgroundColor: inCart
              ? isDark
                ? 'rgba(37, 99, 235, 0.16)'
                : 'rgba(37, 99, 235, 0.08)'
              : cardBg,
            borderColor: inCart ? BRAND_COLORS.blue600 : borderColor,
            opacity: pressed ? 0.92 : isDisabled ? 0.7 : 1,
          },
        ]}
      >
        {/* Left Thumbnail or Initial Badge */}
        <View style={styles.listThumbWrapper}>
          {product.imageUrl ? (
            <Image source={{ uri: product.imageUrl }} style={styles.listThumbImage} resizeMode="cover" />
          ) : (
            <View style={[styles.listThumbBadge, { backgroundColor: palette.bg, borderColor: palette.border }]}>
              <Text style={[styles.initialsText, { color: palette.text, fontSize: 13 }]}>{initials}</Text>
            </View>
          )}
          {inCart ? (
            <View style={styles.qtyBubble}>
              <Text style={styles.qtyBubbleText}>{cartQty}</Text>
            </View>
          ) : null}
        </View>

        {/* Center Details */}
        <View style={styles.listContent}>
          <Text style={[styles.listName, { color: textPrimary }]} numberOfLines={1}>
            {product.name}
          </Text>
          <View style={styles.listMetaRow}>
            <Text style={[styles.codeTagText, { color: textSecondary }]}>#{codeNumber}</Text>
            {stockMeta()}
          </View>
        </View>

        {/* Right Price & Stepper Action */}
        <View style={styles.listRight}>
          <Text style={[styles.tilePrice, { textAlign: 'right' }]}>₹{product.sellingPrice.toFixed(2)}</Text>
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
                  handleAddPress();
                }}
                style={[styles.tileStepBtn, { backgroundColor: BRAND_COLORS.blue600 }]}
                hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }}
              >
                <Plus size={12} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              onPress={(e) => {
                e.stopPropagation?.();
                handleAddPress();
              }}
              style={[styles.addBtnSmall, { backgroundColor: BRAND_COLORS.blue600, opacity: isDisabled ? 0.5 : 1 }]}
              disabled={isDisabled}
            >
              <Plus size={13} color="#FFFFFF" />
              <Text style={styles.addBtnSmallText}>Add</Text>
            </TouchableOpacity>
          )}
        </View>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={handleAddPress}
      onLongPress={onLongPress ? () => onLongPress(product) : undefined}
      delayLongPress={350}
      android_ripple={{ color: 'rgba(37, 99, 235, 0.18)' }}
      style={({ pressed }) => [
        styles.productTile,
        {
          backgroundColor: inCart
            ? isDark
              ? 'rgba(37, 99, 235, 0.14)'
              : 'rgba(37, 99, 235, 0.08)'
            : cardBg,
          borderColor: inCart ? BRAND_COLORS.blue600 : borderColor,
          borderWidth: inCart ? 1.5 : 1,
          opacity: pressed ? 0.92 : isDisabled ? 0.72 : 1,
        },
      ]}
    >
      {/* Top Header: Code Tag & Stock/Discount Badges */}
      <View style={styles.tileHeaderRow}>
        <Text style={[styles.codeTagText, { color: textSecondary }]}>#{codeNumber}</Text>
        <View style={styles.badgesRow}>
          {product.discountValue && product.discountValue > 0 ? (
            <View style={[styles.stockBadge, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
              <Text style={[styles.stockBadgeText, { color: '#10B981' }]}>
                {product.discountType === 'percent' ? `${product.discountValue}% OFF` : `₹${product.discountValue} OFF`}
              </Text>
            </View>
          ) : null}

          {gridStockMeta()}
        </View>
      </View>

      {/* Visual Center: Product Image OR Vibrant Category Initial Badge */}
      <View style={styles.tileImageWrapper}>
        {product.imageUrl ? (
          <Image source={{ uri: product.imageUrl }} style={styles.tileProductImage} resizeMode="cover" />
        ) : (
          <View style={[styles.initialsHeroBadge, { backgroundColor: palette.bg, borderColor: palette.border }]}>
            <Text style={[styles.initialsText, { color: palette.text }]}>{initials}</Text>
            {product.category?.name ? (
              <Text style={[styles.categoryBadgeSub, { color: palette.text }]} numberOfLines={1}>
                {product.category.name}
              </Text>
            ) : null}
          </View>
        )}

        {/* Quantity Indicator Bubble on top-right of image */}
        {inCart ? (
          <View style={styles.tileQtyBubble}>
            <Text style={styles.tileQtyBubbleText}>{cartQty}</Text>
          </View>
        ) : null}
      </View>

      {/* Product Title */}
      <Text style={[styles.tileName, { color: textPrimary }]} numberOfLines={2}>
        {product.name}
      </Text>

      {/* Footer: Price & Responsive Stepper */}
      <View style={styles.tileFooterRow}>
        <Text style={styles.tilePrice}>₹{product.sellingPrice.toFixed(2)}</Text>

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
                handleAddPress();
              }}
              style={[styles.tileStepBtn, { backgroundColor: BRAND_COLORS.blue600 }]}
              hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }}
            >
              <Plus size={12} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={[styles.addCircle, { backgroundColor: isDark ? '#334155' : '#E2E8F0', opacity: isDisabled ? 0.5 : 1 }]}>
            <Plus size={14} color={BRAND_COLORS.blue600} />
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
    marginBottom: 10,
    justifyContent: 'space-between',
    minHeight: 172,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  tileHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  badgesRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  codeTagText: { fontSize: 9.5, fontWeight: '700' },
  stockCountText: { fontSize: 9.5, fontWeight: '600' },
  stockBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  stockBadgeText: { fontSize: 9, fontWeight: '800' },

  /* Image & Hero Initial Badge */
  tileImageWrapper: {
    width: '100%',
    height: 70,
    borderRadius: 12,
    overflow: 'hidden',
    marginVertical: 4,
    position: 'relative',
  },
  tileProductImage: { width: '100%', height: '100%', borderRadius: 12 },
  initialsHeroBadge: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  initialsText: {
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 1,
  },
  categoryBadgeSub: {
    fontSize: 8.5,
    fontWeight: '700',
    marginTop: 2,
    textTransform: 'uppercase',
  },
  tileQtyBubble: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: BRAND_COLORS.blue600,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    elevation: 3,
  },
  tileQtyBubbleText: { color: '#FFFFFF', fontSize: 10.5, fontWeight: '900' },

  tileName: {
    fontSize: 12.5,
    fontWeight: '700',
    lineHeight: 16,
    marginVertical: 4,
  },
  tileFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 'auto',
    paddingTop: 2,
  },
  tilePrice: {
    fontSize: 14.5,
    fontWeight: '900',
    color: BRAND_COLORS.sky500,
  },
  inCartStepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.06)',
    borderRadius: 10,
    padding: 2,
  },
  tileStepBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inCartQtyText: {
    fontSize: 11.5,
    fontWeight: '900',
    marginHorizontal: 6,
    minWidth: 16,
    textAlign: 'center',
  },
  addCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* List Row View Mode Styles */
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    padding: 10,
    borderWidth: 1,
    marginBottom: 8,
    elevation: 1,
  },
  listThumbWrapper: {
    width: 48,
    height: 48,
    borderRadius: 10,
    overflow: 'hidden',
    position: 'relative',
    marginRight: 10,
  },
  listThumbImage: { width: '100%', height: '100%', borderRadius: 10 },
  listThumbBadge: {
    width: '100%',
    height: '100%',
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyBubble: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: BRAND_COLORS.blue600,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  qtyBubbleText: { color: '#FFFFFF', fontSize: 9, fontWeight: '900' },
  listContent: { flex: 1, marginRight: 8 },
  listName: { fontSize: 13, fontWeight: '700' },
  listMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 },
  listRight: { alignItems: 'flex-end', gap: 4 },
  addBtnSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  addBtnSmallText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
});
