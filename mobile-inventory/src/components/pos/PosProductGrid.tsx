import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Vibration,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { PackageSearch, LayoutGrid, List, PlusCircle } from 'lucide-react-native';
import { Product } from '@/types/product';
import { useCartStore } from '@/store/useCartStore';
import { PosProductTile } from '@/components/pos/PosProductTile';
import { BRAND_COLORS } from '@/constants/theme';

interface PosProductGridProps {
  products: Product[];
  isDark: boolean;
  cardBg: string;
  borderColor: string;
  textPrimary: string;
  textSecondary: string;
  lowStockLabel: string;
  searchQuery?: string;
  onClearFilters?: () => void;
  onProductLongPress?: (product: Product) => void;
  onAddProductPress?: () => void;
}

export const PosProductGrid = React.memo(function PosProductGrid({
  products,
  isDark,
  cardBg,
  borderColor,
  textPrimary,
  textSecondary,
  lowStockLabel,
  searchQuery,
  onClearFilters,
  onProductLongPress,
  onAddProductPress,
}: PosProductGridProps) {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const cartQtySignature = useCartStore((state) =>
    state.items.map((item) => `${item.product.id}:${item.quantity}`).join('|')
  );
  const addItem = useCartStore((state) => state.addItem);
  const updateQuantity = useCartStore((state) => state.updateQuantity);

  const cartQtyMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const part of cartQtySignature.split('|')) {
      if (!part) continue;
      const [id, qty] = part.split(':');
      if (id) map.set(id, Number(qty) || 0);
    }
    return map;
  }, [cartQtySignature]);

  const PAGE_SIZE = 40;
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const [pagedProducts, setPagedProducts] = useState(products);
  if (pagedProducts !== products) {
    setPagedProducts(products);
    setVisibleCount(PAGE_SIZE);
  }

  const visibleProducts = useMemo(
    () => (products.length > visibleCount ? products.slice(0, visibleCount) : products),
    [products, visibleCount]
  );

  const hasMore = visibleProducts.length < products.length;

  const loadMore = useCallback(() => {
    if (!hasMore) return;
    setVisibleCount((n) => n + PAGE_SIZE);
  }, [hasMore]);

  const handleQuickAdd = useCallback(
    (product: Product) => {
      addItem(product, 1);
      Vibration.vibrate(10);
    },
    [addItem]
  );

  const handleQuickDecrement = useCallback(
    (productId: string) => {
      const current = cartQtyMap.get(productId) || 0;
      updateQuantity(productId, current - 1);
      Vibration.vibrate(10);
    },
    [cartQtyMap, updateQuantity]
  );

  const isSparse = products.length > 0 && products.length <= 2 && !searchQuery;

  return (
    <View style={{ flex: 1 }}>
      {/* Top Bar: Item count & Grid/List View Switcher */}
      <View style={styles.gridHeaderBar}>
        <Text style={[styles.catalogCountText, { color: textSecondary }]}>
          {products.length} {products.length === 1 ? 'Product' : 'Products'}
        </Text>

        <View style={[styles.viewModePill, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#E2E8F0' }]}>
          <TouchableOpacity
            onPress={() => setViewMode('grid')}
            style={[styles.viewModeBtn, viewMode === 'grid' && { backgroundColor: BRAND_COLORS.blue600 }]}
          >
            <LayoutGrid size={13} color={viewMode === 'grid' ? '#FFFFFF' : textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setViewMode('list')}
            style={[styles.viewModeBtn, viewMode === 'list' && { backgroundColor: BRAND_COLORS.blue600 }]}
          >
            <List size={14} color={viewMode === 'list' ? '#FFFFFF' : textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        key={viewMode} // Re-mounts FlatList cleanly when switching column count
        data={visibleProducts}
        keyExtractor={(item) => item.id}
        numColumns={viewMode === 'grid' ? 2 : 1}
        initialNumToRender={12}
        maxToRenderPerBatch={10}
        windowSize={6}
        updateCellsBatchingPeriod={40}
        removeClippedSubviews={Platform.OS === 'android'}
        columnWrapperStyle={viewMode === 'grid' ? { justifyContent: 'space-between' } : undefined}
        contentContainerStyle={
          products.length === 0
            ? { flexGrow: 1, paddingBottom: 150 }
            : { paddingBottom: 150, paddingHorizontal: 2 }
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <View
              style={[
                styles.emptyIconCircle,
                { backgroundColor: isDark ? 'rgba(148,163,184,0.12)' : 'rgba(100,116,139,0.10)' },
              ]}
            >
              <PackageSearch size={30} color={textSecondary} />
            </View>
            <Text style={[styles.emptyTitle, { color: textPrimary }]}>
              {searchQuery ? 'No matching products' : 'No products found'}
            </Text>
            <Text style={[styles.emptySubtitle, { color: textSecondary }]}>
              {searchQuery
                ? `Nothing matched "${searchQuery}". Check spelling or try searching by SKU / Barcode.`
                : 'Add products to this category or store to start ring-ups.'}
            </Text>
            {onClearFilters ? (
              <TouchableOpacity onPress={onClearFilters} style={styles.clearFiltersBtn}>
                <Text style={styles.clearFiltersText}>Clear search & filters</Text>
              </TouchableOpacity>
            ) : null}
            {onAddProductPress && !searchQuery ? (
              <TouchableOpacity
                onPress={onAddProductPress}
                style={[styles.addProductPromptBtn, { backgroundColor: BRAND_COLORS.blue600 }]}
              >
                <PlusCircle size={15} color="#FFFFFF" />
                <Text style={styles.addProductPromptText}>Add First Product</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        }
        extraData={cartQtySignature}
        onEndReached={loadMore}
        onEndReachedThreshold={0.6}
        ListFooterComponent={
          <>
            {hasMore ? (
              <View style={{ paddingVertical: 18, alignItems: 'center' }}>
                <ActivityIndicator size="small" color={textSecondary} />
                <Text style={{ fontSize: 11, color: textSecondary, marginTop: 6, fontWeight: '700' }}>
                  {products.length - visibleProducts.length} more
                </Text>
              </View>
            ) : null}

            {/* If sparse catalog (1 or 2 items), show a helpful quick add card */}
            {isSparse && onAddProductPress ? (
              <TouchableOpacity
                onPress={onAddProductPress}
                style={[
                  styles.sparseAddCard,
                  { backgroundColor: cardBg, borderColor: borderColor },
                ]}
              >
                <PlusCircle size={20} color={BRAND_COLORS.blue600} />
                <Text style={[styles.sparseAddText, { color: textPrimary }]}>Add Another Product</Text>
                <Text style={[styles.sparseAddSub, { color: textSecondary }]}>
                  Expand your store catalog for faster checkout
                </Text>
              </TouchableOpacity>
            ) : null}
          </>
        }
        renderItem={({ item, index }) => (
          <PosProductTile
            product={item}
            cartQty={cartQtyMap.get(item.id) || 0}
            codeNumber={item.barcode ? item.barcode.slice(-4) : String(index + 101)}
            isDark={isDark}
            cardBg={cardBg}
            borderColor={borderColor}
            textPrimary={textPrimary}
            textSecondary={textSecondary}
            lowStockLabel={lowStockLabel}
            viewMode={viewMode}
            onAdd={handleQuickAdd}
            onDecrement={handleQuickDecrement}
            onLongPress={onProductLongPress}
          />
        )}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  gridHeaderBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  catalogCountText: {
    fontSize: 11.5,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  viewModePill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    padding: 2,
  },
  viewModeBtn: {
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 6,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingVertical: 48,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 12.5,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
  clearFiltersBtn: {
    marginTop: 14,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  clearFiltersText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#2563EB',
  },
  addProductPromptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 14,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  addProductPromptText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '800',
  },
  sparseAddCard: {
    marginTop: 10,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sparseAddText: {
    fontSize: 13,
    fontWeight: '800',
    marginTop: 6,
  },
  sparseAddSub: {
    fontSize: 11,
    marginTop: 2,
  },
});
