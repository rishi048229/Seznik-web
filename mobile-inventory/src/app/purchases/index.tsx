import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  Alert,
  StyleSheet,
  StatusBar,
  Platform,
  Modal,
  ScrollView,
  Share,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Search,
  Plus,
  ArrowLeft,
  ShoppingBag,
  Truck,
  Calendar,
  Trash2,
  X,
  CreditCard,
  Banknote,
  QrCode,
  Building2,
  FileText,
  Share2,
  ChevronRight,
  Package,
  Layers,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { usePurchases } from '@/hooks/usePurchases';
import { Purchase } from '@/types/purchase';
import { BRAND_COLORS } from '@/constants/theme';
import { useAppTheme } from '@/hooks/useAppTheme';
import { ScreenBackground } from '@/components/ui/ScreenBackground';
import { ListScreenSkeleton } from '@/components/ui/ScreenSkeleton';
import { useLanguageStore } from '@/store/useLanguageStore';

export default function PurchasesScreen() {
  const router = useRouter();
  const { t } = useLanguageStore();
  const { purchases, isLoading, isRefetching, refetch, deletePurchase } = usePurchases();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string | null>(null);
  const [selectedPurchase, setSelectedPurchase] = useState<Purchase | null>(null);

  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const topPadding = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0, 12);

  const filteredPurchases = purchases.filter((p) => {
    const matchesSearch =
      p.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.supplier && p.supplier.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (p.supplierName && p.supplierName.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesPayment = selectedPaymentMethod ? p.paymentMethod.toLowerCase() === selectedPaymentMethod.toLowerCase() : true;
    return matchesSearch && matchesPayment;
  });

  const totalPurchasesAmount = purchases.reduce((sum, p) => sum + (p.grandTotal || 0), 0);
  const totalInvoicesCount = purchases.length;

  const handleDeletePurchase = (p: Purchase) => {
    Alert.alert(
      'Delete Purchase Record',
      `Delete purchase ${p.invoiceNumber}? Note: Inventory stock will not be reverted.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Record',
          style: 'destructive',
          onPress: async () => {
            try {
              await deletePurchase(p.id);
              if (selectedPurchase?.id === p.id) {
                setSelectedPurchase(null);
              }
            } catch (e: any) {
              Alert.alert('Error', e?.message || 'Failed to delete purchase record');
            }
          },
        },
      ]
    );
  };

  const handleSharePurchase = async (p: Purchase) => {
    try {
      const itemsText = (p.items || [])
        .map((i) => `• ${i.productName}: ${i.quantity} pcs @ ₹${i.costPrice} = ₹${i.total}`)
        .join('\n');

      const message = `📦 PURCHASE INVOICE: ${p.invoiceNumber}\nSupplier: ${p.supplier?.name || p.supplierName || 'General Supplier'}\nDate: ${new Date(p.createdAt).toLocaleDateString()}\nMode: ${p.paymentMethod.toUpperCase()}\n\nItems Purchased:\n${itemsText || 'Standard stock replenishment'}\n\nGrand Total: ₹${p.grandTotal.toFixed(2)}\n\nRecorded via Seznik Inventory`;

      await Share.share({ message });
    } catch {
      // ignore
    }
  };

  const getPaymentIcon = (method: string) => {
    const m = (method || '').toLowerCase();
    if (m === 'cash') return <Banknote size={12} color="#10B981" />;
    if (m === 'upi') return <QrCode size={12} color={BRAND_COLORS.sky500} />;
    if (m === 'bank_transfer' || m === 'card') return <CreditCard size={12} color="#8B5CF6" />;
    return <Building2 size={12} color="#F59E0B" />;
  };

  return (
    <ScreenBackground color={theme.bg}>
      <StatusBar
        barStyle={theme.isDark ? 'light-content' : 'dark-content'}
        backgroundColor={theme.bg}
      />
      <View style={[styles.container, { backgroundColor: 'transparent', paddingTop: topPadding }]}>
        <View style={styles.mainWrapper}>
          {/* Header Row with Logo Badge */}
          <View style={styles.headerRow}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.backBtn}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <ArrowLeft size={20} color={theme.textSecondary} />
              <Text style={[styles.backBtnText, { color: theme.textSecondary }]}>{t('back', 'Back')}</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => router.push('/purchases/new' as any)} style={styles.addBtn}>
              <Plus size={16} color="#FFFFFF" />
              <Text style={styles.addBtnText}>{t('recordPurchase', 'New Purchase')}</Text>
            </TouchableOpacity>
          </View>

          {/* Title & Brand Icon Banner */}
          <View style={styles.titleBannerRow}>
            <View style={styles.brandLogoCircle}>
              <ShoppingBag size={24} color="#FFFFFF" />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[styles.title, { color: theme.textPrimary }]}>{t('purchasesPageTitle', 'Stock Purchases')}</Text>
              <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
                Supplier invoices & inventory purchase history
              </Text>
            </View>
          </View>

          {/* Summary KPI Strip */}
          <View style={styles.metricsGrid}>
            <View style={[styles.metricCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
              <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>Total Purchases</Text>
              <Text style={[styles.metricValue, { color: theme.textPrimary }]}>
                ₹{totalPurchasesAmount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </Text>
              <Text style={[styles.metricSub, { color: theme.textSecondary }]}>{totalInvoicesCount} Invoices Total</Text>
            </View>

            <View style={[styles.metricCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
              <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>Active Invoices</Text>
              <Text style={[styles.metricValue, { color: BRAND_COLORS.blue600 }]}>
                {filteredPurchases.length}
              </Text>
              <Text style={[styles.metricSub, { color: theme.textSecondary }]}>Filtered Records</Text>
            </View>
          </View>

          {/* Search Box */}
          <View style={[styles.searchBox, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
            <Search size={18} color={theme.textSecondary} />
            <TextInput
              style={[styles.searchInput, { color: theme.textPrimary }]}
              placeholder={t('searchProducts', 'Search invoice number or supplier...')}
              placeholderTextColor="#94A3B8"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery ? (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <X size={16} color={theme.textSecondary} />
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Filter Pills */}
          <View style={styles.filterRow}>
            {[
              { label: t('all', 'All'), value: null },
              { label: 'Cash', value: 'cash' },
              { label: 'UPI', value: 'upi' },
              { label: 'Bank Transfer', value: 'bank_transfer' },
              { label: 'Credit', value: 'credit' },
            ].map((f) => {
              const active = selectedPaymentMethod === f.value;
              return (
                <TouchableOpacity
                  key={f.label}
                  onPress={() => setSelectedPaymentMethod(f.value)}
                  style={[
                    styles.filterChip,
                    {
                      backgroundColor: active ? BRAND_COLORS.blue600 : theme.cardBg,
                      borderColor: active ? BRAND_COLORS.blue600 : theme.borderColor,
                    },
                  ]}
                >
                  <Text style={[styles.filterChipText, { color: active ? '#FFFFFF' : theme.textSecondary }]}>
                    {f.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Purchases List */}
          {isLoading ? (
            <ListScreenSkeleton hasSearch={false} hasStats={false} count={5} />
          ) : (
            <FlatList
              data={filteredPurchases}
              keyExtractor={(item) => item.id}
              refreshing={isRefetching}
              onRefresh={refetch}
              contentContainerStyle={{ paddingBottom: 60 }}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <View style={[styles.emptyLogoCircle, { backgroundColor: 'rgba(2, 132, 199, 0.12)' }]}>
                    <ShoppingBag size={38} color={BRAND_COLORS.blue600} />
                  </View>
                  <Text style={[styles.emptyTitle, { color: theme.textPrimary }]}>No Purchases Recorded Yet</Text>
                  <Text style={[styles.emptySub, { color: theme.textSecondary }]}>
                    Record supplier purchases to automatically restock products and update cost valuation.
                  </Text>
                  <TouchableOpacity
                    onPress={() => router.push('/purchases/new' as any)}
                    style={styles.emptyAddBtn}
                  >
                    <Plus size={16} color="#FFFFFF" />
                    <Text style={styles.emptyAddBtnText}>Record First Purchase</Text>
                  </TouchableOpacity>
                </View>
              }
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => setSelectedPurchase(item)}
                  activeOpacity={0.8}
                  style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}
                >
                  {/* Default Logo Box for every Purchase Entry */}
                  <View style={[styles.itemLogoBox, { backgroundColor: 'rgba(2, 132, 199, 0.12)' }]}>
                    <Truck size={20} color={BRAND_COLORS.blue600} />
                  </View>

                  <View style={{ flex: 1, marginHorizontal: 12 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Text style={[styles.invoiceNum, { color: theme.textPrimary }]}>{item.invoiceNumber}</Text>
                      <View style={[styles.paymentBadge, { backgroundColor: 'rgba(37, 99, 235, 0.1)' }]}>
                        {getPaymentIcon(item.paymentMethod)}
                        <Text style={styles.paymentBadgeText}>{(item.paymentMethod || 'cash').toUpperCase()}</Text>
                      </View>
                    </View>
                    <Text style={[styles.supplierText, { color: BRAND_COLORS.sky500 }]} numberOfLines={1}>
                      {item.supplier?.name || item.supplierName || 'General Supplier'}
                    </Text>
                    <Text style={[styles.dateText, { color: theme.textSecondary }]}>
                      {new Date(item.createdAt).toLocaleDateString()} · {(item.items || []).length} items
                    </Text>
                  </View>

                  <View style={{ alignItems: 'flex-end', justifyContent: 'center' }}>
                    <Text style={[styles.totalAmount, { color: theme.textPrimary }]}>
                      ₹{(item.grandTotal || 0).toFixed(2)}
                    </Text>
                    <ChevronRight size={16} color={theme.textSecondary} style={{ marginTop: 4 }} />
                  </View>
                </TouchableOpacity>
              )}
            />
          )}
        </View>
      </View>

      {/* Purchase Detail Modal */}
      <Modal
        visible={!!selectedPurchase}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedPurchase(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.detailModalCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
            {selectedPurchase && (
              <>
                <View style={styles.detailHeader}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={[styles.itemLogoBox, { backgroundColor: 'rgba(2, 132, 199, 0.12)', marginRight: 10 }]}>
                      <ShoppingBag size={20} color={BRAND_COLORS.blue600} />
                    </View>
                    <View>
                      <Text style={[styles.detailInvoice, { color: theme.textPrimary }]}>
                        {selectedPurchase.invoiceNumber}
                      </Text>
                      <Text style={[styles.detailSupplier, { color: BRAND_COLORS.blue600 }]}>
                        {selectedPurchase.supplier?.name || selectedPurchase.supplierName || 'General Supplier'}
                      </Text>
                    </View>
                  </View>

                  <TouchableOpacity
                    onPress={() => setSelectedPurchase(null)}
                    style={[styles.closeBtn, { backgroundColor: theme.bg }]}
                  >
                    <X size={16} color={theme.textPrimary} />
                  </TouchableOpacity>
                </View>

                <ScrollView style={{ maxHeight: 320, marginVertical: 12 }}>
                  <Text style={[styles.itemsHeader, { color: theme.textSecondary }]}>PURCHASED ITEMS</Text>
                  {(selectedPurchase.items || []).map((item, idx) => (
                    <View
                      key={idx}
                      style={[styles.itemRow, { borderBottomColor: theme.borderColor }]}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.itemName, { color: theme.textPrimary }]}>{item.productName}</Text>
                        <Text style={[styles.itemMeta, { color: theme.textSecondary }]}>
                          {item.quantity} pcs @ ₹{item.costPrice} / unit
                        </Text>
                      </View>
                      <Text style={[styles.itemTotal, { color: theme.textPrimary }]}>
                        ₹{(item.total || item.costPrice * item.quantity).toFixed(2)}
                      </Text>
                    </View>
                  ))}

                  <View style={styles.summaryBox}>
                    <View style={styles.summaryRow}>
                      <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Subtotal</Text>
                      <Text style={[styles.summaryVal, { color: theme.textPrimary }]}>
                        ₹{selectedPurchase.subtotal.toFixed(2)}
                      </Text>
                    </View>
                    {selectedPurchase.totalTax > 0 && (
                      <View style={styles.summaryRow}>
                        <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Tax (GST)</Text>
                        <Text style={[styles.summaryVal, { color: theme.textPrimary }]}>
                          +₹{selectedPurchase.totalTax.toFixed(2)}
                        </Text>
                      </View>
                    )}
                    <View style={[styles.summaryRow, { borderTopWidth: 1, borderTopColor: theme.borderColor, paddingTop: 6, marginTop: 4 }]}>
                      <Text style={[styles.summaryTotalLabel, { color: theme.textPrimary }]}>Grand Total</Text>
                      <Text style={[styles.summaryTotalVal, { color: BRAND_COLORS.blue600 }]}>
                        ₹{selectedPurchase.grandTotal.toFixed(2)}
                      </Text>
                    </View>
                  </View>
                </ScrollView>

                {/* Modal Action Buttons */}
                <View style={styles.modalActionsRow}>
                  <TouchableOpacity
                    onPress={() => handleSharePurchase(selectedPurchase)}
                    style={[styles.modalActionBtn, { backgroundColor: '#10B981', flex: 1, marginRight: 8 }]}
                  >
                    <Share2 size={16} color="#FFFFFF" />
                    <Text style={styles.modalActionText}>Share Receipt</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => handleDeletePurchase(selectedPurchase)}
                    style={[styles.modalActionBtn, { backgroundColor: '#EF4444' }]}
                  >
                    <Trash2 size={16} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  mainWrapper: { flex: 1, paddingHorizontal: 16, paddingTop: 4 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  backBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 4, marginLeft: -4 },
  backBtnText: { fontSize: 13, fontWeight: '600', marginLeft: 4 },
  addBtn: { backgroundColor: BRAND_COLORS.navyInk, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, flexDirection: 'row', alignItems: 'center' },
  addBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 12, marginLeft: 4 },

  titleBannerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  brandLogoCircle: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: BRAND_COLORS.navyInk,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 22, fontWeight: '900' },
  subtitle: { fontSize: 11, marginTop: 1 },

  metricsGrid: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  metricCard: { flex: 1, borderRadius: 16, padding: 12, borderWidth: 1 },
  metricLabel: { fontSize: 10.5, fontWeight: '700' },
  metricValue: { fontSize: 17, fontWeight: '900', marginTop: 4 },
  metricSub: { fontSize: 10, fontWeight: '600', marginTop: 2 },

  searchBox: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, height: 46, marginBottom: 10 },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 13.5 },

  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  filterChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, borderWidth: 1 },
  filterChipText: { fontSize: 11, fontWeight: '700' },

  card: { borderRadius: 16, padding: 12, borderWidth: 1, marginBottom: 10, flexDirection: 'row', alignItems: 'center' },
  itemLogoBox: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  invoiceNum: { fontSize: 14, fontWeight: '800' },
  paymentBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, marginLeft: 6 },
  paymentBadgeText: { fontSize: 9, fontWeight: '800', color: BRAND_COLORS.blue600, marginLeft: 3 },
  supplierText: { fontSize: 12, fontWeight: '700', marginTop: 2 },
  dateText: { fontSize: 10.5, marginTop: 2 },
  totalAmount: { fontSize: 15, fontWeight: '900' },

  emptyContainer: { alignItems: 'center', paddingVertical: 40, paddingHorizontal: 20 },
  emptyLogoCircle: { width: 72, height: 72, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  emptyTitle: { fontSize: 16, fontWeight: '800', marginBottom: 6 },
  emptySub: { fontSize: 12, textAlign: 'center', marginBottom: 16, lineHeight: 18 },
  emptyAddBtn: { backgroundColor: BRAND_COLORS.navyInk, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, flexDirection: 'row', alignItems: 'center' },
  emptyAddBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 13, marginLeft: 6 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 18 },
  detailModalCard: { borderRadius: 20, borderWidth: 1, padding: 18 },
  detailHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: 'rgba(100,116,139,0.15)', paddingBottom: 12 },
  detailInvoice: { fontSize: 16, fontWeight: '900' },
  detailSupplier: { fontSize: 12, fontWeight: '700', marginTop: 2 },
  closeBtn: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  itemsHeader: { fontSize: 11, fontWeight: '800', marginBottom: 8 },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1 },
  itemName: { fontSize: 13, fontWeight: '700' },
  itemMeta: { fontSize: 11, marginTop: 2 },
  itemTotal: { fontSize: 13, fontWeight: '800' },
  summaryBox: { marginTop: 12, padding: 10, borderRadius: 12, backgroundColor: 'rgba(100,116,139,0.06)' },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 2 },
  summaryLabel: { fontSize: 11.5, fontWeight: '600' },
  summaryVal: { fontSize: 12, fontWeight: '700' },
  summaryTotalLabel: { fontSize: 13, fontWeight: '800' },
  summaryTotalVal: { fontSize: 15, fontWeight: '900' },
  modalActionsRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
  modalActionBtn: { borderRadius: 12, paddingVertical: 11, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  modalActionText: { color: '#FFFFFF', fontWeight: '800', fontSize: 13, marginLeft: 6 },
});
