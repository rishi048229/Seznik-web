import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  StyleSheet,
  StatusBar,
  Platform,
} from 'react-native';
import { useSafeAreaInsets, SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Search, X, Pencil, Trash2, Package, Check, MoreVertical } from 'lucide-react-native';
import { useLocations, useLocationStock, useUpsertProductLocationStock } from '@/hooks/useLocations';
import { useProducts } from '@/hooks/useProducts';
import { Product } from '@/types/product';
import { BRAND_COLORS } from '@/constants/theme';
import { useAppTheme } from '@/hooks/useAppTheme';
import { ScreenBackground } from '@/components/ui/ScreenBackground';
import { ScreenLoadingState } from '@/components/ui/ScreenLoadingState';
import { KeyboardAvoidingWrapper } from '@/components/ui/KeyboardAvoidingWrapper';

export default function StoreDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const topPadding = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0, 12);

  const { locations, updateLocation, toggleLocationActive, deleteLocation } = useLocations();
  const { products } = useProducts();
  const { locationStock, isLoading: isStockLoading } = useLocationStock(id || null);
  const { upsertStock } = useUpsertProductLocationStock();

  const store = locations.find((l) => l.id === id) || null;

  const [search, setSearch] = useState('');
  const [onlyCarried, setOnlyCarried] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  // Rename
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);

  // Edit one product's stock/price at this store
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [editStock, setEditStock] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const stockByProductId = useMemo(
    () => new Map(locationStock.map((s) => [s.productId, s])),
    [locationStock]
  );

  const activeProducts = useMemo(() => products.filter((p) => p.isActive !== false), [products]);

  const visibleProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return activeProducts.filter((p) => {
      const matchesSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        (p.sku && p.sku.toLowerCase().includes(q)) ||
        (p.barcode && p.barcode.toLowerCase().includes(q));
      const matchesCarried = !onlyCarried || stockByProductId.has(p.id);
      return matchesSearch && matchesCarried;
    });
  }, [activeProducts, search, onlyCarried, stockByProductId]);

  // Summary of what this store actually holds
  const summary = useMemo(() => {
    let units = 0;
    let value = 0;
    for (const row of locationStock) {
      units += row.stock;
      const product = products.find((p) => p.id === row.productId);
      const price = row.priceOverride ?? product?.sellingPrice ?? 0;
      value += price * row.stock;
    }
    return { carried: locationStock.length, units, value };
  }, [locationStock, products]);

  const openEdit = (product: Product) => {
    const row = stockByProductId.get(product.id);
    setEditProduct(product);
    setEditStock(row ? String(row.stock) : '0');
    setEditPrice(row?.priceOverride != null ? String(row.priceOverride) : '');
  };

  const handleSaveEdit = async () => {
    if (!editProduct || !id) return;
    const stockNum = editStock.trim() === '' ? 0 : Number(editStock);
    if (Number.isNaN(stockNum)) {
      Alert.alert('Invalid stock', 'Enter a number for stock.');
      return;
    }
    const priceNum = editPrice.trim() === '' ? null : Number(editPrice);
    if (priceNum !== null && Number.isNaN(priceNum)) {
      Alert.alert('Invalid price', 'Enter a number for price, or leave it blank to use the normal price.');
      return;
    }

    setIsSavingEdit(true);
    try {
      await upsertStock({
        productId: editProduct.id,
        locationId: id,
        data: { stock: stockNum, priceOverride: priceNum },
      });
      setEditProduct(null);
    } catch (e: any) {
      Alert.alert('Could Not Save', e?.message || 'Please try again.');
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleRename = async () => {
    if (!renameValue.trim() || !id) {
      Alert.alert('Name required', 'Please enter a store name.');
      return;
    }
    setIsRenaming(true);
    try {
      await updateLocation({ locationId: id, name: renameValue.trim() });
      setRenameOpen(false);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to rename store');
    } finally {
      setIsRenaming(false);
    }
  };

  const handleToggleActive = async () => {
    if (!store || !id) return;
    setMenuOpen(false);
    try {
      await toggleLocationActive({ locationId: id, isActive: !store.isActive });
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to update store');
    }
  };

  const handleDelete = () => {
    if (!store || !id) return;
    setMenuOpen(false);
    Alert.alert('Delete Store', `Delete "${store.name}"? Its stock records will be removed too.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteLocation(id);
            router.back();
          } catch (e: any) {
            Alert.alert('Error', e?.message || 'Failed to delete store');
          }
        },
      },
    ]);
  };

  if (!store) {
    return (
      <ScreenBackground color={theme.bg}>
        <SafeAreaView style={[styles.container, { paddingTop: topPadding }]}>
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <ArrowLeft size={20} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>
          <ScreenLoadingState message="Loading store..." />
        </SafeAreaView>
      </ScreenBackground>
    );
  }

  return (
    <ScreenBackground color={theme.bg}>
      <StatusBar barStyle={theme.isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
      <SafeAreaView style={[styles.container, { paddingTop: topPadding }]}>
        {/* Header */}
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <ArrowLeft size={20} color={theme.textSecondary} />
          </TouchableOpacity>
          <View style={{ flex: 1, marginLeft: 14 }}>
            <Text style={[styles.headerTitle, { color: theme.textPrimary }]} numberOfLines={1}>
              {store.name}
            </Text>
            {!store.isActive ? <Text style={styles.offBadge}>Turned off</Text> : null}
          </View>
          <TouchableOpacity onPress={() => setMenuOpen(true)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <MoreVertical size={20} color={theme.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Summary */}
        <View style={styles.summaryRow}>
          <View style={[styles.summaryTile, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
            <Text style={[styles.summaryValue, { color: theme.textPrimary }]}>{summary.carried}</Text>
            <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Products</Text>
          </View>
          <View style={[styles.summaryTile, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
            <Text style={[styles.summaryValue, { color: theme.textPrimary }]}>{summary.units}</Text>
            <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Units</Text>
          </View>
          <View style={[styles.summaryTile, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
            <Text style={[styles.summaryValue, { color: theme.textPrimary }]} numberOfLines={1}>
              ₹{summary.value.toFixed(0)}
            </Text>
            <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Value</Text>
          </View>
        </View>

        {/* Search */}
        <View style={styles.controlsWrap}>
          <View style={[styles.searchBox, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
            <Search size={16} color={theme.textSecondary} />
            <TextInput
              style={[styles.searchInput, { color: theme.textPrimary }]}
              placeholder="Search products..."
              placeholderTextColor="#94A3B8"
              value={search}
              onChangeText={setSearch}
            />
            {search ? (
              <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <X size={15} color={theme.textSecondary} />
              </TouchableOpacity>
            ) : null}
          </View>

          <View style={styles.filterRow}>
            {(
              [
                { key: false, label: 'All products' },
                { key: true, label: 'Only in this store' },
              ] as const
            ).map((opt) => (
              <TouchableOpacity
                key={String(opt.key)}
                onPress={() => setOnlyCarried(opt.key)}
                style={[
                  styles.filterChip,
                  { borderColor: theme.borderColor },
                  onlyCarried === opt.key && { backgroundColor: BRAND_COLORS.blue600, borderColor: BRAND_COLORS.blue600 },
                ]}
              >
                <Text style={{ fontSize: 11.5, fontWeight: '800', color: onlyCarried === opt.key ? '#FFF' : theme.textSecondary }}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Product list */}
        {isStockLoading ? (
          <ScreenLoadingState message="Loading stock..." />
        ) : (
          <FlatList
            data={visibleProducts}
            keyExtractor={(item) => item.id}
            initialNumToRender={12}
            maxToRenderPerBatch={12}
            windowSize={7}
            removeClippedSubviews={Platform.OS === 'android'}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              <View style={styles.emptyWrap}>
                <Package size={32} color={theme.textSecondary} />
                <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                  {onlyCarried
                    ? 'This store has no products yet. Switch to "All products" and set stock for the ones it sells.'
                    : 'No products match your search.'}
                </Text>
              </View>
            }
            renderItem={({ item }) => {
              const row = stockByProductId.get(item.id);
              const carried = !!row;
              const price = row?.priceOverride ?? item.sellingPrice;
              const overridden = row?.priceOverride != null;

              return (
                <TouchableOpacity
                  onPress={() => openEdit(item)}
                  activeOpacity={0.75}
                  style={[
                    styles.productCard,
                    { backgroundColor: theme.cardBg, borderColor: carried ? theme.borderColor : 'transparent', opacity: carried ? 1 : 0.62 },
                  ]}
                >
                  <View style={{ flex: 1, marginRight: 12 }}>
                    <Text style={[styles.productName, { color: theme.textPrimary }]} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text style={[styles.productMeta, { color: theme.textSecondary }]} numberOfLines={1}>
                      {carried ? (
                        <>
                          ₹{price.toFixed(2)}
                          {overridden ? <Text style={{ color: BRAND_COLORS.blue600, fontWeight: '800' }}> · own price</Text> : null}
                        </>
                      ) : (
                        'Not sold here — tap to add'
                      )}
                    </Text>
                  </View>

                  {carried ? (
                    <View style={[styles.stockChip, { backgroundColor: row!.stock > 0 ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)' }]}>
                      <Text style={[styles.stockChipText, { color: row!.stock > 0 ? '#10B981' : '#EF4444' }]}>
                        {row!.stock} {item.unit || 'pcs'}
                      </Text>
                    </View>
                  ) : (
                    <View style={[styles.stockChip, { backgroundColor: 'rgba(100,116,139,0.12)' }]}>
                      <Text style={[styles.stockChipText, { color: '#64748B' }]}>—</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            }}
          />
        )}

        {/* ---------- Edit stock/price sheet ---------- */}
        <Modal visible={!!editProduct} animationType="fade" transparent onRequestClose={() => setEditProduct(null)}>
          <KeyboardAvoidingWrapper inModal>
            <View style={styles.modalOverlay}>
              <View style={[styles.sheet, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
                <View style={styles.sheetHeader}>
                  <View style={{ flex: 1, marginRight: 10 }}>
                    <Text style={[styles.sheetTitle, { color: theme.textPrimary }]} numberOfLines={1}>
                      {editProduct?.name}
                    </Text>
                    <Text style={[styles.sheetSub, { color: theme.textSecondary }]}>at {store.name}</Text>
                  </View>
                  <TouchableOpacity onPress={() => setEditProduct(null)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <X size={20} color={theme.textSecondary} />
                  </TouchableOpacity>
                </View>

                <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Stock in this store</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.bg, color: theme.textPrimary, borderColor: theme.borderColor }]}
                  placeholder="0"
                  placeholderTextColor="#94A3B8"
                  keyboardType="numeric"
                  value={editStock}
                  onChangeText={setEditStock}
                  autoFocus
                />

                <Text style={[styles.inputLabel, { color: theme.textSecondary, marginTop: 14 }]}>Price in this store</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.bg, color: theme.textPrimary, borderColor: theme.borderColor }]}
                  placeholder={`Normal price — ₹${editProduct?.sellingPrice.toFixed(2) ?? '0.00'}`}
                  placeholderTextColor="#94A3B8"
                  keyboardType="numeric"
                  value={editPrice}
                  onChangeText={setEditPrice}
                />
                <Text style={[styles.inputHint, { color: theme.textSecondary }]}>
                  Leave blank to use the normal price for this product.
                </Text>

                <TouchableOpacity
                  onPress={handleSaveEdit}
                  disabled={isSavingEdit}
                  style={[styles.primaryBtn, { backgroundColor: BRAND_COLORS.blue600, opacity: isSavingEdit ? 0.6 : 1 }]}
                >
                  {isSavingEdit ? <ActivityIndicator color="#FFF" /> : <Text style={styles.primaryBtnText}>Save</Text>}
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingWrapper>
        </Modal>

        {/* ---------- Store menu ---------- */}
        <Modal visible={menuOpen} animationType="fade" transparent onRequestClose={() => setMenuOpen(false)}>
          <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setMenuOpen(false)}>
            <View style={[styles.menuSheet, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
              <TouchableOpacity
                onPress={() => {
                  setMenuOpen(false);
                  setRenameValue(store.name);
                  setRenameOpen(true);
                }}
                style={[styles.menuItem, { borderBottomColor: theme.borderColor }]}
              >
                <Pencil size={17} color={theme.textSecondary} />
                <Text style={[styles.menuText, { color: theme.textPrimary }]}>Rename store</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={handleToggleActive} style={[styles.menuItem, { borderBottomColor: theme.borderColor }]}>
                <Check size={17} color={theme.textSecondary} />
                <Text style={[styles.menuText, { color: theme.textPrimary }]}>
                  {store.isActive ? 'Turn off this store' : 'Turn on this store'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={handleDelete} style={styles.menuItem}>
                <Trash2 size={17} color="#EF4444" />
                <Text style={[styles.menuText, { color: '#EF4444' }]}>Delete store</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>

        {/* ---------- Rename ---------- */}
        <Modal visible={renameOpen} animationType="fade" transparent onRequestClose={() => setRenameOpen(false)}>
          <KeyboardAvoidingWrapper inModal>
            <View style={styles.modalOverlay}>
              <View style={[styles.sheet, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
                <View style={styles.sheetHeader}>
                  <Text style={[styles.sheetTitle, { color: theme.textPrimary }]}>Rename Store</Text>
                  <TouchableOpacity onPress={() => setRenameOpen(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <X size={20} color={theme.textSecondary} />
                  </TouchableOpacity>
                </View>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.bg, color: theme.textPrimary, borderColor: theme.borderColor }]}
                  value={renameValue}
                  onChangeText={setRenameValue}
                  autoFocus
                />
                <TouchableOpacity
                  onPress={handleRename}
                  disabled={isRenaming}
                  style={[styles.primaryBtn, { backgroundColor: BRAND_COLORS.blue600, opacity: isRenaming ? 0.6 : 1 }]}
                >
                  {isRenaming ? <ActivityIndicator color="#FFF" /> : <Text style={styles.primaryBtnText}>Save</Text>}
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingWrapper>
        </Modal>
      </SafeAreaView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 10 },
  headerTitle: { fontSize: 17, fontWeight: '900' },
  offBadge: { fontSize: 10.5, fontWeight: '800', color: '#F59E0B', marginTop: 2 },

  summaryRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, marginBottom: 14 },
  summaryTile: { flex: 1, borderRadius: 14, borderWidth: 1, paddingVertical: 12, alignItems: 'center' },
  summaryValue: { fontSize: 16, fontWeight: '900' },
  summaryLabel: { fontSize: 10, fontWeight: '700', marginTop: 3 },

  controlsWrap: { paddingHorizontal: 16, marginBottom: 12 },
  searchBox: { flexDirection: 'row', alignItems: 'center', borderRadius: 13, borderWidth: 1, paddingHorizontal: 13, paddingVertical: 11 },
  searchInput: { flex: 1, fontSize: 13, marginLeft: 9 },
  filterRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  filterChip: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 8 },

  productCard: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 13, marginBottom: 9 },
  productName: { fontSize: 13.5, fontWeight: '800' },
  productMeta: { fontSize: 11.5, marginTop: 3 },
  stockChip: { borderRadius: 10, paddingHorizontal: 11, paddingVertical: 7, minWidth: 62, alignItems: 'center' },
  stockChipText: { fontSize: 12, fontWeight: '900' },

  emptyWrap: { alignItems: 'center', paddingVertical: 50, paddingHorizontal: 30 },
  emptyText: { fontSize: 12.5, textAlign: 'center', marginTop: 12, lineHeight: 18 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 18 },
  sheet: { width: '100%', maxWidth: 420, borderRadius: 22, borderWidth: 1, padding: 20 },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  sheetTitle: { fontSize: 16.5, fontWeight: '900' },
  sheetSub: { fontSize: 11.5, marginTop: 3 },

  inputLabel: { fontSize: 11, fontWeight: '700', marginBottom: 7 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, fontWeight: '700' },
  inputHint: { fontSize: 11, marginTop: 7, lineHeight: 15 },

  primaryBtn: { borderRadius: 14, paddingVertical: 14, alignItems: 'center', justifyContent: 'center', marginTop: 20 },
  primaryBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 14 },

  menuSheet: { width: '100%', maxWidth: 340, borderRadius: 18, borderWidth: 1, overflow: 'hidden' },
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 16, borderBottomWidth: 1 },
  menuText: { fontSize: 13.5, fontWeight: '700', marginLeft: 13 },
});
