import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Switch,
  Modal,
  StyleSheet,
  StatusBar,
  Platform,
} from 'react-native';
import { useSafeAreaInsets, SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  ArrowLeft,
  Store,
  Plus,
  Pencil,
  Trash2,
  ArrowRightLeft,
  Package,
  Search,
  ChevronLeft,
  ChevronRight,
  Check,
  X,
} from 'lucide-react-native';
import { useSettings } from '@/hooks/useSettings';
import { settingsApi } from '@/api/settings';
import { useQueryClient } from '@tanstack/react-query';
import {
  useLocations,
  useLocationStock,
  useUpsertProductLocationStock,
  useCreateStockTransfer,
  useStockTransfers,
} from '@/hooks/useLocations';
import { useProducts } from '@/hooks/useProducts';
import { Location } from '@/types/location';
import { BRAND_COLORS } from '@/constants/theme';
import { useAppTheme } from '@/hooks/useAppTheme';
import { ScreenBackground } from '@/components/ui/ScreenBackground';
import { ScreenLoadingState, ScreenErrorState } from '@/components/ui/ScreenLoadingState';
import { KeyboardAvoidingWrapper } from '@/components/ui/KeyboardAvoidingWrapper';
import { useLanguageStore } from '@/store/useLanguageStore';

const PAGE_SIZE = 20;

export default function StoresScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const { t } = useLanguageStore();
  const queryClient = useQueryClient();
  const topPadding = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0, 12);

  const { settings, isLoading: isSettingsLoading } = useSettings();
  const enabled = settings?.locationConfig?.enabled ?? false;
  const [isTogglingFeature, setIsTogglingFeature] = useState(false);

  const toggleFeature = async (value: boolean) => {
    setIsTogglingFeature(true);
    try {
      if (settings?.id) {
        await settingsApi.updateSettings(settings.id, { locationConfig: { enabled: value } });
      } else {
        await settingsApi.createSettings({ locationConfig: { enabled: value } });
      }
      queryClient.invalidateQueries({ queryKey: ['settings'] });
    } catch (e: any) {
      Alert.alert('Could Not Save', e?.message || 'Please check your connection and try again.');
    } finally {
      setIsTogglingFeature(false);
    }
  };

  const {
    locations,
    isLoading: isLocationsLoading,
    isError: isLocationsError,
    refetch: refetchLocations,
    createLocation,
    isCreating,
    updateLocation,
    toggleLocationActive,
    deleteLocation,
  } = useLocations();
  const { products } = useProducts();
  const { transfers } = useStockTransfers();

  const [modalOpen, setModalOpen] = useState(false);
  const [editLocation, setEditLocation] = useState<Location | null>(null);
  const [formName, setFormName] = useState('');
  const [seedFromCurrentStock, setSeedFromCurrentStock] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [activeLocationId, setActiveLocationId] = useState<string | null>(null);
  const [stockSearch, setStockSearch] = useState('');
  const [showAllProducts, setShowAllProducts] = useState(true);
  const [stockPage, setStockPage] = useState(1);

  const [transferOpen, setTransferOpen] = useState(false);
  const [transferSearch, setTransferSearch] = useState('');
  const [transferProductId, setTransferProductId] = useState('');
  const [transferFromId, setTransferFromId] = useState('');
  const [transferToId, setTransferToId] = useState('');
  const [transferQty, setTransferQty] = useState('');

  const { locationStock, isLoading: isStockLoading } = useLocationStock(activeLocationId);
  const { upsertStock } = useUpsertProductLocationStock();
  const { createTransfer, isTransferring } = useCreateStockTransfer();

  const activeLocation = locations.find((l) => l.id === activeLocationId) || null;
  const stockByProductId = new Map(locationStock.map((s) => [s.productId, s]));

  const filteredProducts = products
    .filter(
      (p) =>
        p.isActive !== false &&
        (p.name.toLowerCase().includes(stockSearch.toLowerCase()) ||
          (p.sku && p.sku.toLowerCase().includes(stockSearch.toLowerCase())) ||
          (p.barcode && p.barcode.toLowerCase().includes(stockSearch.toLowerCase())))
    )
    .filter((p) => showAllProducts || (stockByProductId.get(p.id)?.stock ?? 0) > 0);

  const totalStockPages = Math.max(1, Math.ceil(filteredProducts.length / PAGE_SIZE));
  const paginatedProducts = filteredProducts.slice((stockPage - 1) * PAGE_SIZE, stockPage * PAGE_SIZE);

  const openCreate = () => {
    setEditLocation(null);
    setFormName('');
    // Defaults on for the very first store — the "I already added products before ever
    // creating a store" scenario: without this, existing stock never attaches to any
    // store and can never be picked in the switcher or transferred from.
    setSeedFromCurrentStock(locations.length === 0);
    setModalOpen(true);
  };

  const openEdit = (loc: Location) => {
    setEditLocation(loc);
    setFormName(loc.name);
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!formName.trim()) {
      Alert.alert('Store name required', 'Please enter a name for this store.');
      return;
    }
    setIsSaving(true);
    try {
      if (editLocation) {
        await updateLocation({ locationId: editLocation.id, name: formName.trim() });
      } else {
        const created = await createLocation({ name: formName.trim(), sortOrder: locations.length, seedFromCurrentStock });
        setActiveLocationId(created.id);
      }
      setModalOpen(false);
    } catch (e: any) {
      Alert.alert('Error', e?.message || `Failed to ${editLocation ? 'update' : 'add'} store`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = (loc: Location) => {
    Alert.alert('Delete Store', `Delete "${loc.name}"? Its stock records will be removed too.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteLocation(loc.id);
            if (activeLocationId === loc.id) setActiveLocationId(null);
          } catch (e: any) {
            Alert.alert('Error', e?.message || 'Failed to delete store — it may still have stock or sales history');
          }
        },
      },
    ]);
  };

  const openTransferForProduct = (productId: string) => {
    setTransferProductId(productId);
    setTransferFromId(activeLocationId || '');
    const otherLoc = locations.find((l) => l.id !== activeLocationId && l.isActive);
    setTransferToId(otherLoc?.id || '');
    setTransferQty('');
    setTransferSearch('');
    setTransferOpen(true);
  };

  const handleStockFieldCommit = (productId: string, field: 'stock' | 'priceOverride', value: string) => {
    if (!activeLocationId) return;
    const numValue = value.trim() === '' ? (field === 'priceOverride' ? null : 0) : Number(value);
    if (numValue !== null && Number.isNaN(numValue)) return;
    upsertStock({ productId, locationId: activeLocationId, data: { [field]: numValue } }).catch((e: any) => {
      Alert.alert('Error', e?.message || 'Failed to save');
    });
  };

  const handleTransfer = async () => {
    const qty = Number(transferQty);
    if (!transferProductId || !transferFromId || !transferToId || !qty || qty <= 0) {
      Alert.alert('Missing details', 'Fill in product, both stores, and a positive quantity');
      return;
    }
    if (transferFromId === transferToId) {
      Alert.alert('Invalid transfer', 'Source and destination must be different');
      return;
    }
    try {
      await createTransfer({ productId: transferProductId, fromLocationId: transferFromId, toLocationId: transferToId, quantity: qty });
      setTransferOpen(false);
      setTransferProductId('');
      setTransferQty('');
      setTransferSearch('');
    } catch (e: any) {
      // Server-side stock validation is the source of truth — surface its message directly.
      Alert.alert('Transfer Failed', e?.message || 'Not enough stock at the source location for this transfer');
    }
  };

  return (
    <ScreenBackground color={theme.bg}>
      <StatusBar barStyle={theme.isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
      <SafeAreaView style={[styles.container, { backgroundColor: 'transparent', paddingTop: topPadding }]}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <ArrowLeft size={20} color={theme.textSecondary} />
            <Text style={[styles.backBtnText, { color: theme.textSecondary }]}>{t('back', 'Back')}</Text>
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>{t('stores', 'Stores')}</Text>
          <View style={{ width: 60 }} />
        </View>

        {isSettingsLoading ? (
          <ScreenLoadingState message="Loading..." fullScreen />
        ) : (
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
            {/* Feature toggle */}
            <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
              <View style={{ flex: 1, marginRight: 10 }}>
                <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>
                  {t('enableMultiStore', 'Enable Multi-Store Inventory')}
                </Text>
                <Text style={[styles.cardSub, { color: theme.textSecondary }]}>
                  {t(
                    'enableMultiStoreDesc',
                    'Track separate stock & price per store. Off = billing works exactly as one store.'
                  )}
                </Text>
              </View>
              {isTogglingFeature ? (
                <ActivityIndicator size="small" color={BRAND_COLORS.blue600} />
              ) : (
                <Switch value={enabled} onValueChange={toggleFeature} trackColor={{ false: '#64748B', true: BRAND_COLORS.blue600 }} />
              )}
            </View>

            {!enabled ? (
              <View style={[styles.emptyCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
                <Store size={40} color={theme.textSecondary} />
                <Text style={[styles.emptyTitle, { color: theme.textPrimary }]}>
                  {t('multiStoreOffTitle', 'Multi-store inventory is off')}
                </Text>
                <Text style={[styles.emptyDesc, { color: theme.textSecondary }]}>
                  {t('multiStoreOffDesc', 'Turn it on above to start adding stores like "Main Store" and "Warehouse".')}
                </Text>
              </View>
            ) : isLocationsLoading ? (
              <ScreenLoadingState message="Loading stores..." hint="Fetching your store list" />
            ) : isLocationsError ? (
              <ScreenErrorState message="Could not load stores" hint="Check your connection and try again" onRetry={refetchLocations} />
            ) : (
              <>
                <View style={styles.rowBetween}>
                  <Text style={[styles.sectionHeader, { color: theme.textSecondary }]}>
                    {locations.length === 0 ? 'NO STORES YET' : `STORES (${locations.length})`}
                  </Text>
                  <TouchableOpacity onPress={openCreate} style={[styles.addBtn, { backgroundColor: BRAND_COLORS.navyInk }]}>
                    <Plus size={14} color="#FFFFFF" />
                    <Text style={styles.addBtnText}>{t('addStore', 'Add Store')}</Text>
                  </TouchableOpacity>
                </View>

                {locations.length === 0 ? (
                  <View style={[styles.emptyCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
                    <Store size={36} color={theme.textSecondary} />
                    <Text style={[styles.emptyTitle, { color: theme.textPrimary }]}>{t('noStoresYet', 'No stores yet')}</Text>
                    <Text style={[styles.emptyDesc, { color: theme.textSecondary }]}>
                      {products.some((p) => p.currentStock > 0)
                        ? 'You already have products with stock — creating your first store can adopt that existing stock automatically, so it has a real store to belong to.'
                        : 'Add your first two stores, e.g. "Main Store" and "Warehouse".'}
                    </Text>
                    <TouchableOpacity onPress={openCreate} style={[styles.addBtn, { backgroundColor: BRAND_COLORS.blue600, marginTop: 12 }]}>
                      <Plus size={14} color="#FFFFFF" />
                      <Text style={styles.addBtnText}>{t('addStore', 'Add Store')}</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <>
                    {locations.map((loc) => (
                      <TouchableOpacity
                        key={loc.id}
                        onPress={() => {
                          setActiveLocationId(loc.id);
                          setStockPage(1);
                        }}
                        style={[
                          styles.storeRow,
                          {
                            backgroundColor: theme.cardBg,
                            borderColor: activeLocationId === loc.id ? BRAND_COLORS.blue600 : theme.borderColor,
                            opacity: loc.isActive ? 1 : 0.55,
                          },
                        ]}
                      >
                        <Store size={16} color={theme.textSecondary} />
                        <Text style={[styles.storeRowName, { color: theme.textPrimary }]} numberOfLines={1}>
                          {loc.name}
                        </Text>
                        <TouchableOpacity onPress={() => toggleLocationActive({ locationId: loc.id, isActive: !loc.isActive })}>
                          <View style={[styles.statusPill, { backgroundColor: loc.isActive ? 'rgba(16,185,129,0.15)' : 'rgba(100,116,139,0.15)' }]}>
                            <Text style={{ fontSize: 10, fontWeight: '800', color: loc.isActive ? '#10B981' : '#64748B' }}>
                              {loc.isActive ? 'Active' : 'Off'}
                            </Text>
                          </View>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => openEdit(loc)} style={styles.iconBtn}>
                          <Pencil size={14} color={theme.textSecondary} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => handleDelete(loc)} style={styles.iconBtn}>
                          <Trash2 size={14} color="#EF4444" />
                        </TouchableOpacity>
                      </TouchableOpacity>
                    ))}

                    <TouchableOpacity
                      onPress={() => {
                        setTransferProductId('');
                        setTransferFromId('');
                        setTransferToId('');
                        setTransferQty('');
                        setTransferSearch('');
                        setTransferOpen(true);
                      }}
                      style={[styles.transferShortcut, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}
                    >
                      <ArrowRightLeft size={14} color={BRAND_COLORS.blue600} />
                      <Text style={[styles.transferShortcutText, { color: theme.textPrimary }]}>{t('transferStock', 'Transfer Stock')}</Text>
                    </TouchableOpacity>

                    {transfers.length > 0 && (
                      <View style={{ marginTop: 14 }}>
                        <Text style={[styles.sectionHeader, { color: theme.textSecondary }]}>RECENT TRANSFERS</Text>
                        {transfers.slice(0, 6).map((tr) => (
                          <Text key={tr.id} style={[styles.transferLine, { color: theme.textSecondary }]}>
                            <Text style={{ color: theme.textPrimary, fontWeight: '700' }}>{tr.product?.name}</Text>
                            {'  '}
                            {tr.quantity} · {tr.fromLocation?.name} → {tr.toLocation?.name}
                          </Text>
                        ))}
                      </View>
                    )}

                    {/* Stock table for the selected store */}
                    {!activeLocation ? (
                      <View style={[styles.emptyCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor, marginTop: 14 }]}>
                        <Package size={30} color={theme.textSecondary} />
                        <Text style={[styles.emptyDesc, { color: theme.textSecondary }]}>
                          {t('selectStorePrompt', 'Tap a store above to view/edit its stock')}
                        </Text>
                      </View>
                    ) : (
                      <View style={{ marginTop: 16 }}>
                        <Text style={[styles.sectionHeader, { color: theme.textSecondary }]}>
                          {activeLocation.name.toUpperCase()} — STOCK
                        </Text>

                        <View style={[styles.searchBox, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
                          <Search size={15} color={theme.textSecondary} />
                          <TextInput
                            style={[styles.searchInput, { color: theme.textPrimary }]}
                            placeholder="Search name, SKU or barcode..."
                            placeholderTextColor="#94A3B8"
                            value={stockSearch}
                            onChangeText={(v) => {
                              setStockSearch(v);
                              setStockPage(1);
                            }}
                          />
                        </View>

                        <TouchableOpacity
                          onPress={() => {
                            setShowAllProducts((v) => !v);
                            setStockPage(1);
                          }}
                          style={styles.checkboxRow}
                        >
                          <View style={[styles.checkbox, showAllProducts && { backgroundColor: BRAND_COLORS.blue600, borderColor: BRAND_COLORS.blue600 }]}>
                            {showAllProducts ? <Check size={11} color="#FFF" /> : null}
                          </View>
                          <Text style={[styles.checkboxLabel, { color: theme.textSecondary }]}>
                            Show all products (uncheck for only what this store carries)
                          </Text>
                        </TouchableOpacity>

                        {isStockLoading ? (
                          <ScreenLoadingState message="Loading stock..." />
                        ) : filteredProducts.length === 0 ? (
                          <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                            {showAllProducts ? 'No products match your search.' : "This store doesn't carry any products yet."}
                          </Text>
                        ) : (
                          <>
                            {paginatedProducts.map((p) => {
                              const stockRow = stockByProductId.get(p.id);
                              return (
                                <View key={p.id} style={[styles.stockRow, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
                                  <View style={{ flex: 1, marginRight: 8 }}>
                                    <Text style={[styles.stockRowName, { color: theme.textPrimary }]} numberOfLines={1}>
                                      {p.name}
                                    </Text>
                                    <Text style={[styles.stockRowMeta, { color: theme.textSecondary }]} numberOfLines={1}>
                                      Base: ₹{p.sellingPrice.toFixed(2)}{p.sku ? ` · SKU: ${p.sku}` : ''}
                                    </Text>
                                  </View>
                                  <View style={styles.stockFieldsCol}>
                                    <View style={styles.stockFieldRow}>
                                      <Text style={[styles.stockFieldLabel, { color: theme.textSecondary }]}>Stock</Text>
                                      <TextInput
                                        key={`stock-${p.id}-${activeLocationId}`}
                                        defaultValue={String(stockRow?.stock ?? 0)}
                                        onEndEditing={(e) => handleStockFieldCommit(p.id, 'stock', e.nativeEvent.text)}
                                        keyboardType="numeric"
                                        style={[styles.stockField, { color: theme.textPrimary, borderColor: theme.borderColor }]}
                                      />
                                    </View>
                                    <View style={styles.stockFieldRow}>
                                      <Text style={[styles.stockFieldLabel, { color: theme.textSecondary }]}>Price</Text>
                                      <TextInput
                                        key={`price-${p.id}-${activeLocationId}`}
                                        defaultValue={stockRow?.priceOverride != null ? String(stockRow.priceOverride) : ''}
                                        placeholder={String(p.sellingPrice)}
                                        placeholderTextColor="#94A3B8"
                                        onEndEditing={(e) => handleStockFieldCommit(p.id, 'priceOverride', e.nativeEvent.text)}
                                        keyboardType="numeric"
                                        style={[styles.stockField, { color: theme.textPrimary, borderColor: theme.borderColor }]}
                                      />
                                    </View>
                                  </View>
                                  <TouchableOpacity onPress={() => openTransferForProduct(p.id)} style={styles.transferBtn}>
                                    <ArrowRightLeft size={13} color={BRAND_COLORS.blue600} />
                                  </TouchableOpacity>
                                </View>
                              );
                            })}

                            <View style={styles.paginationRow}>
                              <Text style={[styles.paginationText, { color: theme.textSecondary }]}>
                                Page {stockPage} of {totalStockPages} · {filteredProducts.length} items
                              </Text>
                              <View style={{ flexDirection: 'row', gap: 6 }}>
                                <TouchableOpacity
                                  disabled={stockPage <= 1}
                                  onPress={() => setStockPage((p) => Math.max(1, p - 1))}
                                  style={[styles.pageBtn, { borderColor: theme.borderColor, opacity: stockPage <= 1 ? 0.4 : 1 }]}
                                >
                                  <ChevronLeft size={15} color={theme.textPrimary} />
                                </TouchableOpacity>
                                <TouchableOpacity
                                  disabled={stockPage >= totalStockPages}
                                  onPress={() => setStockPage((p) => Math.min(totalStockPages, p + 1))}
                                  style={[styles.pageBtn, { borderColor: theme.borderColor, opacity: stockPage >= totalStockPages ? 0.4 : 1 }]}
                                >
                                  <ChevronRight size={15} color={theme.textPrimary} />
                                </TouchableOpacity>
                              </View>
                            </View>
                          </>
                        )}
                      </View>
                    )}
                  </>
                )}
              </>
            )}
          </ScrollView>
        )}

        {/* Add/Edit store modal */}
        <Modal visible={modalOpen} animationType="fade" transparent onRequestClose={() => setModalOpen(false)}>
          <KeyboardAvoidingWrapper inModal>
            <View style={styles.modalOverlay}>
              <View style={[styles.payModalSheet, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
                <View style={styles.modalHeaderRow}>
                  <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>{editLocation ? 'Edit Store' : 'Add Store'}</Text>
                  <TouchableOpacity onPress={() => setModalOpen(false)}>
                    <X size={20} color={theme.textSecondary} />
                  </TouchableOpacity>
                </View>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.bg, color: theme.textPrimary, borderColor: theme.borderColor }]}
                  placeholder={locations.length === 0 ? 'e.g. Main Store' : 'e.g. Warehouse'}
                  placeholderTextColor="#94A3B8"
                  value={formName}
                  onChangeText={setFormName}
                />
                {!editLocation ? (
                  <TouchableOpacity
                    onPress={() => setSeedFromCurrentStock((v) => !v)}
                    style={[styles.seedRow, { backgroundColor: theme.isDark ? '#1E293B' : '#EFF6FF', borderColor: BRAND_COLORS.blue600 }]}
                  >
                    <View style={[styles.checkbox, seedFromCurrentStock && { backgroundColor: BRAND_COLORS.blue600, borderColor: BRAND_COLORS.blue600 }]}>
                      {seedFromCurrentStock ? <Check size={11} color="#FFF" /> : null}
                    </View>
                    <Text style={[styles.seedText, { color: theme.textPrimary }]}>
                      <Text style={{ fontWeight: '800' }}>Copy my current product stock into this store</Text>
                      {'\n'}
                      <Text style={{ color: theme.textSecondary, fontWeight: '500' }}>
                        {locations.length === 0
                          ? "Recommended — if you added products before creating a store, this makes this store their real home so you can transfer stock out of it like any other store."
                          : 'Starts this store off with the same stock numbers each product currently shows, as a snapshot.'}
                      </Text>
                    </Text>
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity
                  onPress={handleSave}
                  disabled={isSaving || isCreating}
                  style={[styles.saveBtn, { backgroundColor: BRAND_COLORS.blue600, opacity: isSaving || isCreating ? 0.6 : 1 }]}
                >
                  {isSaving || isCreating ? <ActivityIndicator color="#FFF" /> : <Text style={styles.saveBtnText}>Save</Text>}
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingWrapper>
        </Modal>

        {/* Stock transfer modal */}
        <Modal visible={transferOpen} animationType="fade" transparent onRequestClose={() => setTransferOpen(false)}>
          <KeyboardAvoidingWrapper inModal>
            <View style={styles.modalOverlay}>
              <View style={[styles.payModalSheet, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
                <View style={styles.modalHeaderRow}>
                  <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>Transfer Stock</Text>
                  <TouchableOpacity onPress={() => setTransferOpen(false)}>
                    <X size={20} color={theme.textSecondary} />
                  </TouchableOpacity>
                </View>

                <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Select Product *</Text>
                <View style={[styles.searchBox, { backgroundColor: theme.bg, borderColor: theme.borderColor, marginBottom: 8 }]}>
                  <Search size={14} color={theme.textSecondary} />
                  <TextInput
                    style={[styles.searchInput, { color: theme.textPrimary }]}
                    placeholder="Search by name, SKU or barcode..."
                    placeholderTextColor="#94A3B8"
                    value={transferSearch}
                    onChangeText={setTransferSearch}
                  />
                </View>
                <ScrollView style={styles.transferProductList} nestedScrollEnabled>
                  {products
                    .filter(
                      (p) =>
                        p.isActive !== false &&
                        (!transferSearch.trim() ||
                          p.name.toLowerCase().includes(transferSearch.toLowerCase()) ||
                          (p.sku && p.sku.toLowerCase().includes(transferSearch.toLowerCase())) ||
                          (p.barcode && p.barcode.toLowerCase().includes(transferSearch.toLowerCase())))
                    )
                    .slice(0, 25)
                    .map((p) => {
                      const isSelected = transferProductId === p.id;
                      return (
                        <TouchableOpacity
                          key={p.id}
                          onPress={() => setTransferProductId(p.id)}
                          style={[
                            styles.transferProductRow,
                            { borderColor: theme.borderColor },
                            isSelected && { backgroundColor: BRAND_COLORS.blue600 },
                          ]}
                        >
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 12, fontWeight: '700', color: isSelected ? '#FFFFFF' : theme.textPrimary }} numberOfLines={1}>
                              {p.name}
                            </Text>
                            <Text style={{ fontSize: 10, color: isSelected ? 'rgba(255,255,255,0.8)' : theme.textSecondary }} numberOfLines={1}>
                              {p.sku ? `SKU: ${p.sku}` : ''} {p.barcode ? `• ${p.barcode}` : ''}
                            </Text>
                          </View>
                          {isSelected ? <Check size={14} color="#FFFFFF" /> : null}
                        </TouchableOpacity>
                      );
                    })}
                </ScrollView>

                <Text style={[styles.fieldLabel, { color: theme.textSecondary, marginTop: 10 }]}>Source Store (From) *</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 6 }}>
                  {locations
                    .filter((l) => l.isActive)
                    .map((l) => (
                      <TouchableOpacity
                        key={l.id}
                        onPress={() => setTransferFromId(l.id)}
                        style={[
                          styles.pill,
                          { borderColor: theme.borderColor },
                          transferFromId === l.id && { backgroundColor: BRAND_COLORS.navyInk, borderColor: BRAND_COLORS.navyInk },
                        ]}
                      >
                        <Text style={{ fontSize: 11, fontWeight: '700', color: transferFromId === l.id ? '#FFFFFF' : theme.textPrimary }}>{l.name}</Text>
                      </TouchableOpacity>
                    ))}
                </ScrollView>

                <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Destination Store (To) *</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
                  {locations
                    .filter((l) => l.isActive)
                    .map((l) => (
                      <TouchableOpacity
                        key={l.id}
                        onPress={() => setTransferToId(l.id)}
                        style={[
                          styles.pill,
                          { borderColor: theme.borderColor },
                          transferToId === l.id && { backgroundColor: BRAND_COLORS.blue600, borderColor: BRAND_COLORS.blue600 },
                        ]}
                      >
                        <Text style={{ fontSize: 11, fontWeight: '700', color: transferToId === l.id ? '#FFFFFF' : theme.textPrimary }}>{l.name}</Text>
                      </TouchableOpacity>
                    ))}
                </ScrollView>

                <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Transfer Quantity *</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.bg, color: theme.textPrimary, borderColor: theme.borderColor }]}
                  placeholder="e.g. 10"
                  placeholderTextColor="#94A3B8"
                  keyboardType="numeric"
                  value={transferQty}
                  onChangeText={setTransferQty}
                />

                <TouchableOpacity
                  onPress={handleTransfer}
                  disabled={isTransferring || !transferProductId || !transferFromId || !transferToId || !transferQty}
                  style={[
                    styles.saveBtn,
                    { backgroundColor: BRAND_COLORS.blue600, opacity: isTransferring || !transferProductId || !transferFromId || !transferToId || !transferQty ? 0.5 : 1 },
                  ]}
                >
                  {isTransferring ? <ActivityIndicator color="#FFF" /> : <Text style={styles.saveBtnText}>Transfer Stock</Text>}
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
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  backBtn: { flexDirection: 'row', alignItems: 'center', width: 60 },
  backBtnText: { fontSize: 13, fontWeight: '600', marginLeft: 4 },
  headerTitle: { fontSize: 16, fontWeight: '900' },
  card: { flexDirection: 'row', alignItems: 'center', borderRadius: 18, borderWidth: 1, padding: 14, marginBottom: 14 },
  cardTitle: { fontSize: 14, fontWeight: '800' },
  cardSub: { fontSize: 11, marginTop: 4, lineHeight: 15 },
  emptyCard: { borderRadius: 18, borderWidth: 1, padding: 22, alignItems: 'center' },
  emptyTitle: { fontSize: 14, fontWeight: '800', marginTop: 10, textAlign: 'center' },
  emptyDesc: { fontSize: 11, marginTop: 6, textAlign: 'center', lineHeight: 17 },
  emptyText: { fontSize: 12, textAlign: 'center', paddingVertical: 20 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  sectionHeader: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  addBtn: { flexDirection: 'row', alignItems: 'center', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7 },
  addBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 11, marginLeft: 5 },
  storeRow: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, borderWidth: 1.5, padding: 12, marginBottom: 8 },
  storeRowName: { flex: 1, fontSize: 13, fontWeight: '700', marginLeft: 10, marginRight: 8 },
  statusPill: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, marginRight: 4 },
  iconBtn: { padding: 6 },
  transferShortcut: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderWidth: 1, paddingVertical: 10, marginTop: 4 },
  transferShortcutText: { fontSize: 12, fontWeight: '800', marginLeft: 6 },
  transferLine: { fontSize: 11, marginBottom: 4 },
  searchBox: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 9, marginBottom: 8 },
  searchInput: { flex: 1, fontSize: 12, marginLeft: 8 },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  checkbox: { width: 16, height: 16, borderRadius: 4, borderWidth: 1.5, borderColor: '#94A3B8', alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  checkboxLabel: { fontSize: 10.5, flex: 1, lineHeight: 14 },
  stockRow: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, borderWidth: 1, padding: 10, marginBottom: 8 },
  stockRowName: { fontSize: 12.5, fontWeight: '700' },
  stockRowMeta: { fontSize: 10, marginTop: 2 },
  stockFieldsCol: { marginRight: 8 },
  stockFieldRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  stockFieldLabel: { fontSize: 9, fontWeight: '700', width: 32 },
  stockField: { width: 64, borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, fontSize: 11, fontWeight: '700' },
  transferBtn: { padding: 8, borderRadius: 10, backgroundColor: 'rgba(37, 99, 235, 0.12)' },
  paginationRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4, paddingTop: 8 },
  paginationText: { fontSize: 11, fontWeight: '600' },
  pageBtn: { width: 30, height: 30, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.65)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  payModalSheet: { width: '100%', maxWidth: 420, maxHeight: '86%', borderRadius: 20, borderWidth: 1, padding: 18 },
  modalHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  modalTitle: { fontSize: 16, fontWeight: '900', flex: 1 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, marginBottom: 12 },
  fieldLabel: { fontSize: 11, fontWeight: '700', marginBottom: 6 },
  seedRow: { flexDirection: 'row', alignItems: 'flex-start', borderRadius: 12, borderWidth: 1, padding: 12, marginBottom: 12 },
  seedText: { flex: 1, fontSize: 11.5, lineHeight: 16, marginLeft: 4 },
  saveBtn: { borderRadius: 12, paddingVertical: 13, alignItems: 'center', justifyContent: 'center' },
  saveBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 13 },
  transferProductList: { maxHeight: 150, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(148,163,184,0.3)' },
  transferProductRow: { flexDirection: 'row', alignItems: 'center', padding: 10, borderBottomWidth: 1 },
  pill: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 7, marginRight: 8 },
});
