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
  ArrowRightLeft,
  ChevronRight,
  Check,
  X,
  Search,
} from 'lucide-react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useSettings } from '@/hooks/useSettings';
import { settingsApi } from '@/api/settings';
import { useLocations, useCreateStockTransfer, useStockTransfers } from '@/hooks/useLocations';
import { useProducts } from '@/hooks/useProducts';
import { BRAND_COLORS } from '@/constants/theme';
import { useAppTheme } from '@/hooks/useAppTheme';
import { ScreenBackground } from '@/components/ui/ScreenBackground';
import { ScreenLoadingState, ScreenErrorState } from '@/components/ui/ScreenLoadingState';
import { KeyboardAvoidingWrapper } from '@/components/ui/KeyboardAvoidingWrapper';
import { useLanguageStore } from '@/store/useLanguageStore';

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
  } = useLocations();
  const { products } = useProducts();
  const { transfers } = useStockTransfers();
  const { createTransfer, isTransferring } = useCreateStockTransfer();

  // Add-store modal
  const [addOpen, setAddOpen] = useState(false);
  const [formName, setFormName] = useState('');
  const [seedFromCurrentStock, setSeedFromCurrentStock] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Move-stock modal
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferSearch, setTransferSearch] = useState('');
  const [transferProductId, setTransferProductId] = useState('');
  const [transferFromId, setTransferFromId] = useState('');
  const [transferToId, setTransferToId] = useState('');
  const [transferQty, setTransferQty] = useState('');

  const activeStores = locations.filter((l) => l.isActive);

  const openAdd = () => {
    setFormName('');
    // Defaults on for the very first store: if products were added before any store existed,
    // their stock isn't attached to a store at all — this gives it a real home.
    setSeedFromCurrentStock(locations.length === 0);
    setAddOpen(true);
  };

  const handleCreate = async () => {
    if (!formName.trim()) {
      Alert.alert('Store name required', 'Please enter a name for this store.');
      return;
    }
    setIsSaving(true);
    try {
      const created = await createLocation({
        name: formName.trim(),
        sortOrder: locations.length,
        seedFromCurrentStock,
      });
      setAddOpen(false);
      router.push(`/stores/${created.id}` as any);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to add store');
    } finally {
      setIsSaving(false);
    }
  };

  const openTransfer = () => {
    setTransferProductId('');
    setTransferFromId(activeStores[0]?.id || '');
    setTransferToId(activeStores[1]?.id || '');
    setTransferQty('');
    setTransferSearch('');
    setTransferOpen(true);
  };

  const handleTransfer = async () => {
    const qty = Number(transferQty);
    if (!transferProductId || !transferFromId || !transferToId || !qty || qty <= 0) {
      Alert.alert('Missing details', 'Pick a product, both stores, and a quantity.');
      return;
    }
    if (transferFromId === transferToId) {
      Alert.alert('Same store', 'Pick two different stores.');
      return;
    }
    try {
      await createTransfer({
        productId: transferProductId,
        fromLocationId: transferFromId,
        toLocationId: transferToId,
        quantity: qty,
      });
      setTransferOpen(false);
      Alert.alert('Stock Moved', 'The stock has been moved between stores.');
    } catch (e: any) {
      // The server owns stock validation — show exactly what it said.
      Alert.alert('Could Not Move Stock', e?.message || 'Not enough stock at the source store.');
    }
  };

  const transferProduct = products.find((p) => p.id === transferProductId);
  const fromStoreName = locations.find((l) => l.id === transferFromId)?.name ?? '';
  const toStoreName = locations.find((l) => l.id === transferToId)?.name ?? '';

  return (
    <ScreenBackground color={theme.bg}>
      <StatusBar barStyle={theme.isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
      <SafeAreaView style={[styles.container, { paddingTop: topPadding }]}>
        {/* Header */}
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <ArrowLeft size={20} color={theme.textSecondary} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>{t('stores', 'Stores')}</Text>
          <View style={{ width: 20 }} />
        </View>

        {isSettingsLoading ? (
          <ScreenLoadingState message="Loading..." />
        ) : !enabled ? (
          /* ---------- Feature is off: one clear explanation + one switch ---------- */
          <ScrollView contentContainerStyle={styles.scrollBody}>
            <View style={[styles.heroCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
              <View style={styles.heroIcon}>
                <Store size={26} color={BRAND_COLORS.blue600} />
              </View>
              <Text style={[styles.heroTitle, { color: theme.textPrimary }]}>Run more than one shop?</Text>
              <Text style={[styles.heroDesc, { color: theme.textSecondary }]}>
                Turn this on to keep separate stock — and separate prices, if you want — for each shop or
                godown. Then pick which shop you are billing from on the POS screen.
              </Text>
              <Text style={[styles.heroNote, { color: theme.textSecondary }]}>
                Leave it off if you have just one shop. Nothing changes.
              </Text>

              <TouchableOpacity
                onPress={() => toggleFeature(true)}
                disabled={isTogglingFeature}
                style={[styles.primaryBtn, { backgroundColor: BRAND_COLORS.blue600, opacity: isTogglingFeature ? 0.6 : 1 }]}
              >
                {isTogglingFeature ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={styles.primaryBtnText}>Turn On Multi-Store</Text>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        ) : isLocationsLoading ? (
          <ScreenLoadingState message="Loading stores..." />
        ) : isLocationsError ? (
          <ScreenErrorState
            message="Could not load stores"
            hint="Check your connection and try again"
            onRetry={refetchLocations}
          />
        ) : (
          /* ---------- Feature is on ---------- */
          <ScrollView contentContainerStyle={styles.scrollBody}>
            {locations.length === 0 ? (
              <View style={[styles.heroCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
                <View style={styles.heroIcon}>
                  <Store size={26} color={BRAND_COLORS.blue600} />
                </View>
                <Text style={[styles.heroTitle, { color: theme.textPrimary }]}>Add your first store</Text>
                <Text style={[styles.heroDesc, { color: theme.textSecondary }]}>
                  {products.some((p) => p.currentStock > 0)
                    ? 'Your products already have stock. Adding your first store can take that stock with it, so nothing is lost.'
                    : 'Give each shop or godown a name, like "Main Shop" or "Godown".'}
                </Text>
                <TouchableOpacity onPress={openAdd} style={[styles.primaryBtn, { backgroundColor: BRAND_COLORS.blue600 }]}>
                  <Plus size={16} color="#FFF" />
                  <Text style={[styles.primaryBtnText, { marginLeft: 6 }]}>Add Store</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                {/* Store cards */}
                <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>YOUR STORES</Text>
                {locations.map((loc) => (
                  <TouchableOpacity
                    key={loc.id}
                    onPress={() => router.push(`/stores/${loc.id}` as any)}
                    activeOpacity={0.75}
                    style={[styles.storeCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}
                  >
                    <View style={[styles.storeIcon, { backgroundColor: loc.isActive ? 'rgba(37,99,235,0.12)' : 'rgba(100,116,139,0.12)' }]}>
                      <Store size={18} color={loc.isActive ? BRAND_COLORS.blue600 : '#64748B'} />
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={[styles.storeName, { color: theme.textPrimary }]} numberOfLines={1}>
                        {loc.name}
                      </Text>
                      <Text style={[styles.storeSub, { color: theme.textSecondary }]}>
                        {loc.isActive ? 'Tap to manage stock' : 'Turned off — not shown while billing'}
                      </Text>
                    </View>
                    <ChevronRight size={18} color={theme.textSecondary} />
                  </TouchableOpacity>
                ))}

                {/* Actions */}
                <View style={styles.actionRow}>
                  <TouchableOpacity
                    onPress={openAdd}
                    style={[styles.actionBtn, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}
                  >
                    <Plus size={16} color={BRAND_COLORS.blue600} />
                    <Text style={[styles.actionBtnText, { color: theme.textPrimary }]}>Add Store</Text>
                  </TouchableOpacity>

                  {activeStores.length >= 2 ? (
                    <TouchableOpacity
                      onPress={openTransfer}
                      style={[styles.actionBtn, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}
                    >
                      <ArrowRightLeft size={16} color={BRAND_COLORS.blue600} />
                      <Text style={[styles.actionBtnText, { color: theme.textPrimary }]}>Move Stock</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>

                {/* Recent movements */}
                {transfers.length > 0 ? (
                  <>
                    <Text style={[styles.sectionLabel, { color: theme.textSecondary, marginTop: 22 }]}>RECENT STOCK MOVES</Text>
                    <View style={[styles.movesCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
                      {transfers.slice(0, 5).map((tr, idx) => (
                        <View
                          key={tr.id}
                          style={[
                            styles.moveRow,
                            idx < Math.min(transfers.length, 5) - 1 && { borderBottomWidth: 1, borderBottomColor: theme.borderColor },
                          ]}
                        >
                          <Text style={[styles.moveProduct, { color: theme.textPrimary }]} numberOfLines={1}>
                            {tr.product?.name || 'Product'}
                          </Text>
                          <Text style={[styles.moveDetail, { color: theme.textSecondary }]} numberOfLines={1}>
                            {tr.quantity} moved · {tr.fromLocation?.name} → {tr.toLocation?.name}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </>
                ) : null}

                {/* Turn off */}
                <View style={[styles.offRow, { borderColor: theme.borderColor }]}>
                  <View style={{ flex: 1, marginRight: 12 }}>
                    <Text style={[styles.offTitle, { color: theme.textPrimary }]}>Multi-store is on</Text>
                    <Text style={[styles.offSub, { color: theme.textSecondary }]}>
                      Turn off to go back to a single shop. Your stores are kept.
                    </Text>
                  </View>
                  {isTogglingFeature ? (
                    <ActivityIndicator size="small" color={BRAND_COLORS.blue600} />
                  ) : (
                    <Switch
                      value={enabled}
                      onValueChange={toggleFeature}
                      trackColor={{ false: '#64748B', true: BRAND_COLORS.blue600 }}
                    />
                  )}
                </View>
              </>
            )}
          </ScrollView>
        )}

        {/* ---------- Add store modal ---------- */}
        <Modal visible={addOpen} animationType="fade" transparent onRequestClose={() => setAddOpen(false)}>
          <KeyboardAvoidingWrapper inModal>
            <View style={styles.modalOverlay}>
              <View style={[styles.sheet, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
                <View style={styles.sheetHeader}>
                  <Text style={[styles.sheetTitle, { color: theme.textPrimary }]}>Add Store</Text>
                  <TouchableOpacity onPress={() => setAddOpen(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <X size={20} color={theme.textSecondary} />
                  </TouchableOpacity>
                </View>

                <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Store name</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.bg, color: theme.textPrimary, borderColor: theme.borderColor }]}
                  placeholder={locations.length === 0 ? 'Main Shop' : 'Godown'}
                  placeholderTextColor="#94A3B8"
                  value={formName}
                  onChangeText={setFormName}
                  autoFocus
                />

                <TouchableOpacity
                  onPress={() => setSeedFromCurrentStock((v) => !v)}
                  activeOpacity={0.8}
                  style={[
                    styles.seedRow,
                    {
                      backgroundColor: seedFromCurrentStock ? 'rgba(37,99,235,0.08)' : 'transparent',
                      borderColor: seedFromCurrentStock ? BRAND_COLORS.blue600 : theme.borderColor,
                    },
                  ]}
                >
                  <View style={[styles.checkbox, seedFromCurrentStock && { backgroundColor: BRAND_COLORS.blue600, borderColor: BRAND_COLORS.blue600 }]}>
                    {seedFromCurrentStock ? <Check size={11} color="#FFF" /> : null}
                  </View>
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={[styles.seedTitle, { color: theme.textPrimary }]}>Move my current stock here</Text>
                    <Text style={[styles.seedSub, { color: theme.textSecondary }]}>
                      {locations.length === 0
                        ? 'Recommended for your first store, so existing stock has a home.'
                        : 'Copies the stock numbers your products show today.'}
                    </Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleCreate}
                  disabled={isSaving}
                  style={[styles.primaryBtn, { backgroundColor: BRAND_COLORS.blue600, opacity: isSaving ? 0.6 : 1, marginTop: 4 }]}
                >
                  {isSaving ? <ActivityIndicator color="#FFF" /> : <Text style={styles.primaryBtnText}>Add Store</Text>}
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingWrapper>
        </Modal>

        {/* ---------- Move stock modal ---------- */}
        <Modal visible={transferOpen} animationType="fade" transparent onRequestClose={() => setTransferOpen(false)}>
          <KeyboardAvoidingWrapper inModal>
            <View style={styles.modalOverlay}>
              <View style={[styles.sheet, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
                <View style={styles.sheetHeader}>
                  <Text style={[styles.sheetTitle, { color: theme.textPrimary }]}>Move Stock</Text>
                  <TouchableOpacity onPress={() => setTransferOpen(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <X size={20} color={theme.textSecondary} />
                  </TouchableOpacity>
                </View>

                {/* Step 1 — product */}
                <Text style={[styles.stepLabel, { color: theme.textSecondary }]}>1. WHICH PRODUCT?</Text>
                {transferProduct ? (
                  <TouchableOpacity
                    onPress={() => setTransferProductId('')}
                    style={[styles.pickedRow, { borderColor: BRAND_COLORS.blue600, backgroundColor: 'rgba(37,99,235,0.08)' }]}
                  >
                    <Text style={[styles.pickedText, { color: theme.textPrimary }]} numberOfLines={1}>
                      {transferProduct.name}
                    </Text>
                    <Text style={[styles.changeText, { color: BRAND_COLORS.blue600 }]}>Change</Text>
                  </TouchableOpacity>
                ) : (
                  <>
                    <View style={[styles.searchBox, { backgroundColor: theme.bg, borderColor: theme.borderColor }]}>
                      <Search size={14} color={theme.textSecondary} />
                      <TextInput
                        style={[styles.searchInput, { color: theme.textPrimary }]}
                        placeholder="Search product..."
                        placeholderTextColor="#94A3B8"
                        value={transferSearch}
                        onChangeText={setTransferSearch}
                      />
                    </View>
                    <ScrollView style={styles.productList} nestedScrollEnabled keyboardShouldPersistTaps="handled">
                      {products
                        .filter(
                          (p) =>
                            p.isActive !== false &&
                            (!transferSearch.trim() ||
                              p.name.toLowerCase().includes(transferSearch.toLowerCase()) ||
                              (p.sku && p.sku.toLowerCase().includes(transferSearch.toLowerCase())) ||
                              (p.barcode && p.barcode.toLowerCase().includes(transferSearch.toLowerCase())))
                        )
                        .slice(0, 30)
                        .map((p) => (
                          <TouchableOpacity
                            key={p.id}
                            onPress={() => setTransferProductId(p.id)}
                            style={[styles.productRow, { borderBottomColor: theme.borderColor }]}
                          >
                            <Text style={{ fontSize: 12.5, fontWeight: '700', color: theme.textPrimary }} numberOfLines={1}>
                              {p.name}
                            </Text>
                          </TouchableOpacity>
                        ))}
                    </ScrollView>
                  </>
                )}

                {/* Step 2 — stores */}
                <Text style={[styles.stepLabel, { color: theme.textSecondary, marginTop: 14 }]}>2. FROM WHICH STORE?</Text>
                <View style={styles.chipWrap}>
                  {activeStores.map((l) => (
                    <TouchableOpacity
                      key={l.id}
                      onPress={() => setTransferFromId(l.id)}
                      style={[
                        styles.chip,
                        { borderColor: theme.borderColor },
                        transferFromId === l.id && { backgroundColor: BRAND_COLORS.navyInk, borderColor: BRAND_COLORS.navyInk },
                      ]}
                    >
                      <Text style={{ fontSize: 11.5, fontWeight: '700', color: transferFromId === l.id ? '#FFF' : theme.textSecondary }}>
                        {l.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={[styles.stepLabel, { color: theme.textSecondary, marginTop: 12 }]}>3. TO WHICH STORE?</Text>
                <View style={styles.chipWrap}>
                  {activeStores
                    .filter((l) => l.id !== transferFromId)
                    .map((l) => (
                      <TouchableOpacity
                        key={l.id}
                        onPress={() => setTransferToId(l.id)}
                        style={[
                          styles.chip,
                          { borderColor: theme.borderColor },
                          transferToId === l.id && { backgroundColor: BRAND_COLORS.blue600, borderColor: BRAND_COLORS.blue600 },
                        ]}
                      >
                        <Text style={{ fontSize: 11.5, fontWeight: '700', color: transferToId === l.id ? '#FFF' : theme.textSecondary }}>
                          {l.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                </View>

                {/* Step 3 — qty */}
                <Text style={[styles.stepLabel, { color: theme.textSecondary, marginTop: 12 }]}>4. HOW MANY?</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.bg, color: theme.textPrimary, borderColor: theme.borderColor }]}
                  placeholder="0"
                  placeholderTextColor="#94A3B8"
                  keyboardType="numeric"
                  value={transferQty}
                  onChangeText={setTransferQty}
                />

                {transferProduct && transferFromId && transferToId && transferQty ? (
                  <Text style={[styles.summaryLine, { color: theme.textSecondary }]}>
                    Moving <Text style={{ fontWeight: '800', color: theme.textPrimary }}>{transferQty} {transferProduct.unit || 'pcs'}</Text> of{' '}
                    <Text style={{ fontWeight: '800', color: theme.textPrimary }}>{transferProduct.name}</Text> from {fromStoreName} to {toStoreName}.
                  </Text>
                ) : null}

                <TouchableOpacity
                  onPress={handleTransfer}
                  disabled={isTransferring || !transferProductId || !transferFromId || !transferToId || !transferQty}
                  style={[
                    styles.primaryBtn,
                    {
                      backgroundColor: BRAND_COLORS.blue600,
                      opacity: isTransferring || !transferProductId || !transferFromId || !transferToId || !transferQty ? 0.45 : 1,
                      marginTop: 6,
                    },
                  ]}
                >
                  {isTransferring ? <ActivityIndicator color="#FFF" /> : <Text style={styles.primaryBtnText}>Move Stock</Text>}
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
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 6 },
  backBtn: { width: 20 },
  headerTitle: { fontSize: 17, fontWeight: '900' },
  scrollBody: { padding: 16, paddingBottom: 50 },

  heroCard: { borderRadius: 20, borderWidth: 1, padding: 22, alignItems: 'center' },
  heroIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: 'rgba(37,99,235,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  heroTitle: { fontSize: 17, fontWeight: '900', textAlign: 'center' },
  heroDesc: { fontSize: 13, textAlign: 'center', lineHeight: 19, marginTop: 8 },
  heroNote: { fontSize: 11.5, textAlign: 'center', lineHeight: 17, marginTop: 10, fontStyle: 'italic' },

  primaryBtn: { flexDirection: 'row', borderRadius: 14, paddingVertical: 14, paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center', marginTop: 18, alignSelf: 'stretch' },
  primaryBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 14 },

  sectionLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 0.6, marginBottom: 10 },

  storeCard: { flexDirection: 'row', alignItems: 'center', borderRadius: 16, borderWidth: 1, padding: 14, marginBottom: 10 },
  storeIcon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  storeName: { fontSize: 14.5, fontWeight: '800' },
  storeSub: { fontSize: 11.5, marginTop: 3 },

  actionRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 14, borderWidth: 1, paddingVertical: 13 },
  actionBtnText: { fontSize: 12.5, fontWeight: '800', marginLeft: 7 },

  movesCard: { borderRadius: 16, borderWidth: 1, paddingHorizontal: 14 },
  moveRow: { paddingVertical: 11 },
  moveProduct: { fontSize: 12.5, fontWeight: '700' },
  moveDetail: { fontSize: 11, marginTop: 2 },

  offRow: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, marginTop: 26, paddingTop: 18 },
  offTitle: { fontSize: 13, fontWeight: '800' },
  offSub: { fontSize: 11.5, marginTop: 3, lineHeight: 16 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 18 },
  sheet: { width: '100%', maxWidth: 430, maxHeight: '88%', borderRadius: 22, borderWidth: 1, padding: 20 },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sheetTitle: { fontSize: 17, fontWeight: '900' },

  inputLabel: { fontSize: 11, fontWeight: '700', marginBottom: 7 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, fontWeight: '600' },

  seedRow: { flexDirection: 'row', alignItems: 'flex-start', borderRadius: 14, borderWidth: 1, padding: 13, marginTop: 14, marginBottom: 4 },
  checkbox: { width: 18, height: 18, borderRadius: 5, borderWidth: 1.5, borderColor: '#94A3B8', alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  seedTitle: { fontSize: 12.5, fontWeight: '800' },
  seedSub: { fontSize: 11, marginTop: 3, lineHeight: 15 },

  stepLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5, marginBottom: 8 },
  searchBox: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10 },
  searchInput: { flex: 1, fontSize: 13, marginLeft: 8 },
  productList: { maxHeight: 140, marginTop: 8 },
  productRow: { paddingVertical: 11, borderBottomWidth: 1 },
  pickedRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 12, borderWidth: 1.5, paddingHorizontal: 14, paddingVertical: 13 },
  pickedText: { flex: 1, fontSize: 13, fontWeight: '800', marginRight: 10 },
  changeText: { fontSize: 11.5, fontWeight: '800' },

  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 9 },

  summaryLine: { fontSize: 12, lineHeight: 17, marginTop: 12 },
});
