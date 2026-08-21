import React, { useCallback, useMemo } from 'react';
import { FlatList, Platform, Vibration } from 'react-native';
import { Product } from '@/types/product';
import { useCartStore } from '@/store/useCartStore';
import { PosProductTile } from '@/components/pos/PosProductTile';

interface PosProductGridProps {
  products: Product[];
  isDark: boolean;
  cardBg: string;
  borderColor: string;
  textPrimary: string;
  textSecondary: string;
  lowStockLabel: string;
}

export const PosProductGrid = React.memo(function PosProductGrid({
  products,
  isDark,
  cardBg,
  borderColor,
  textPrimary,
  textSecondary,
  lowStockLabel,
}: PosProductGridProps) {
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

  return (
    <FlatList
      data={products}
      keyExtractor={(item) => item.id}
      numColumns={2}
      initialNumToRender={10}
      maxToRenderPerBatch={8}
      windowSize={5}
      updateCellsBatchingPeriod={50}
      removeClippedSubviews={Platform.OS === 'android'}
      columnWrapperStyle={{ justifyContent: 'space-between' }}
      contentContainerStyle={{ paddingBottom: 150 }}
      extraData={cartQtySignature}
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
          onAdd={handleQuickAdd}
          onDecrement={handleQuickDecrement}
        />
      )}
    />
  );
});
