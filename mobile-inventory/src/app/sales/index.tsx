import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  Modal,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  Linking,
  Alert,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  Menu,
  Search,
  Receipt,
  Share2,
  Trash2,
  X,
  CreditCard,
  Banknote,
  QrCode,
  UserCheck,
  ChevronLeft,
  Calendar,
  DollarSign,
} from 'lucide-react-native';
import { useSales } from '@/hooks/useSales';
import { Sale } from '@/types/sale';
import { useAppTheme } from '@/hooks/useAppTheme';
import { ScreenBackground } from '@/components/ui/ScreenBackground';
import { SidebarDrawer } from '@/components/ui/SidebarDrawer';
import { BRAND_COLORS } from '@/constants/theme';

export default function SalesHistoryScreen() {
  const router = useRouter();
  const { sales, isLoading, isRefetching, refetch, deleteSale } = useSales();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string | null>(null);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);

  const theme = useAppTheme();

  const filteredSales = sales.filter((sale) => {
    const matchesSearch =
      sale.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (sale.customerName && sale.customerName.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesPayment = selectedPaymentMethod ? sale.paymentMethod === selectedPaymentMethod : true;
    return matchesSearch && matchesPayment;
  });

  const handleShareWhatsApp = (sale: Sale) => {
    const text = `*Seznik POS Invoice: ${sale.invoiceNumber}*\nDate: ${new Date(
      sale.createdAt
    ).toLocaleDateString()}\nTotal Amount: ₹${sale.grandTotal.toFixed(
      2
    )}\nPayment Method: ${sale.paymentMethod.toUpperCase()}\n\nThank you for your business!`;
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    Linking.openURL(url).catch(() => {
      Alert.alert('Sharing Error', 'Unable to open WhatsApp.');
    });
  };

  const handleDeleteSale = (sale: Sale) => {
    Alert.alert('Delete Sale', `Are you sure you want to delete invoice ${sale.invoiceNumber}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteSale(sale.id);
            if (selectedSale?.id === sale.id) setSelectedSale(null);
          } catch (err: any) {
            Alert.alert('Error', err?.message || 'Failed to delete sale');
          }
        },
      },
    ]);
  };

  const getPaymentIcon = (method: string) => {
    switch (method) {
      case 'upi':
        return <QrCode size={14} color="#0284C7" />;
      case 'card':
        return <CreditCard size={14} color="#2563EB" />;
      case 'credit':
        return <UserCheck size={14} color="#D97706" />;
      default:
        return <Banknote size={14} color="#16A34A" />;
    }
  };

  return (
    <ScreenBackground color={theme.bg}>
      <SafeAreaView style={[styles.container, { backgroundColor: 'transparent' }]}>
        <SidebarDrawer visible={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} />

        <View style={styles.mainWrapper}>
          <View style={styles.headerRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <TouchableOpacity
                onPress={() => router.back()}
                style={[styles.backBtn, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}
              >
                <ChevronLeft size={20} color={theme.textPrimary} />
              </TouchableOpacity>
              <View style={{ marginLeft: 10 }}>
                <Text style={styles.headerBadge}>Transactions</Text>
                <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>Sales History</Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={() => setIsDrawerOpen(true)}
              style={[styles.menuBtn, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}
            >
              <Menu size={18} color={theme.textPrimary} />
            </TouchableOpacity>
          </View>

          {/* Search Box */}
          <View style={[styles.searchBox, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
            <Search size={16} color={theme.textSecondary} />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search invoice number or customer..."
              placeholderTextColor={theme.textSecondary}
              style={[styles.searchInput, { color: theme.textPrimary }]}
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
              { label: 'All', value: null },
              { label: 'Cash', value: 'cash' },
              { label: 'UPI', value: 'upi' },
              { label: 'Card', value: 'card' },
              { label: 'Udhaar', value: 'credit' },
            ].map((filter) => {
              const active = selectedPaymentMethod === filter.value;
              return (
                <TouchableOpacity
                  key={filter.label}
                  onPress={() => setSelectedPaymentMethod(filter.value)}
                  style={[
                    styles.filterChip,
                    {
                      backgroundColor: active ? BRAND_COLORS.blue600 : theme.cardBg,
                      borderColor: active ? BRAND_COLORS.blue600 : theme.borderColor,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      { color: active ? '#FFFFFF' : theme.textSecondary },
                    ]}
                  >
                    {filter.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Sales List */}
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={BRAND_COLORS.blue600} />
              <Text style={[styles.loadingText, { color: theme.textSecondary }]}>Loading sales invoices...</Text>
            </View>
          ) : (
            <FlatList
              data={filteredSales}
              keyExtractor={(item) => item.id}
              refreshing={isRefetching}
              onRefresh={refetch}
              contentContainerStyle={{ paddingBottom: 20 }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => setSelectedSale(item)}
                  style={[styles.saleCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}
                >
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Text style={[styles.invoiceNumber, { color: theme.textPrimary }]}>
                        {item.invoiceNumber}
                      </Text>
                      <View style={[styles.paymentBadge, { backgroundColor: 'rgba(37, 99, 235, 0.1)' }]}>
                        {getPaymentIcon(item.paymentMethod)}
                        <Text style={styles.paymentBadgeText}>{item.paymentMethod.toUpperCase()}</Text>
                      </View>
                    </View>
                    <Text style={[styles.saleMeta, { color: theme.textSecondary }]}>
                      {new Date(item.createdAt).toLocaleDateString()} • {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      {item.customerName ? ` • ${item.customerName}` : ''}
                    </Text>
                  </View>

                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[styles.saleAmount, { color: BRAND_COLORS.blue600 }]}>
                      ₹{item.grandTotal.toFixed(2)}
                    </Text>
                    <Text style={[styles.itemCountText, { color: theme.textSecondary }]}>
                      {item.items?.length || 0} items
                    </Text>
                  </View>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Receipt size={40} color={theme.textSecondary} />
                  <Text style={[styles.emptyTitle, { color: theme.textPrimary }]}>No Sales Found</Text>
                  <Text style={[styles.emptySub, { color: theme.textSecondary }]}>
                    No invoices matching your search or filters.
                  </Text>
                </View>
              }
            />
          )}
        </View>

        {/* SALE DETAIL MODAL */}
        <Modal visible={!!selectedSale} transparent animationType="slide" onRequestClose={() => setSelectedSale(null)}>
          <View style={styles.overlay}>
            <View style={[styles.detailModalCard, { backgroundColor: theme.bg, borderColor: theme.borderColor }]}>
              {selectedSale ? (
                <>
                  <View style={styles.detailHeader}>
                    <View>
                      <Text style={[styles.detailInvoice, { color: theme.textPrimary }]}>
                        {selectedSale.invoiceNumber}
                      </Text>
                      <Text style={[styles.detailDate, { color: theme.textSecondary }]}>
                        {new Date(selectedSale.createdAt).toLocaleString()}
                      </Text>
                    </View>
                    <TouchableOpacity onPress={() => setSelectedSale(null)} style={styles.closeBtn}>
                      <X size={20} color={theme.textSecondary} />
                    </TouchableOpacity>
                  </View>

                  <ScrollView style={{ maxHeight: 320, marginVertical: 10 }}>
                    {selectedSale.items?.map((it, idx) => (
                      <View key={idx} style={[styles.detailItemRow, { borderBottomColor: theme.borderColor }]}>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.detailItemName, { color: theme.textPrimary }]}>
                            {it.productName || it.productId || `Item ${idx + 1}`}
                          </Text>
                          <Text style={[styles.detailItemSub, { color: theme.textSecondary }]}>
                            {it.quantity} × ₹{(it.unitPrice || 0).toFixed(2)}
                          </Text>
                        </View>
                        <Text style={[styles.detailItemTotal, { color: theme.textPrimary }]}>
                          ₹{(it.total || it.quantity * (it.unitPrice || 0)).toFixed(2)}
                        </Text>
                      </View>
                    ))}
                  </ScrollView>

                  <View style={[styles.detailSummary, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
                    <View style={styles.summaryRow}>
                      <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Subtotal</Text>
                      <Text style={[styles.summaryVal, { color: theme.textPrimary }]}>₹{selectedSale.subtotal.toFixed(2)}</Text>
                    </View>
                    {selectedSale.totalTax > 0 ? (
                      <View style={styles.summaryRow}>
                        <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Tax / GST</Text>
                        <Text style={[styles.summaryVal, { color: '#10B981' }]}>+₹{selectedSale.totalTax.toFixed(2)}</Text>
                      </View>
                    ) : null}
                    <View style={[styles.summaryRow, { marginTop: 6, paddingTop: 6, borderTopWidth: 1, borderTopColor: theme.borderColor }]}>
                      <Text style={[styles.summaryGrandLabel, { color: theme.textPrimary }]}>Total Paid</Text>
                      <Text style={[styles.summaryGrandVal, { color: BRAND_COLORS.blue600 }]}>₹{selectedSale.grandTotal.toFixed(2)}</Text>
                    </View>
                  </View>

                  <View style={styles.detailActionsRow}>
                    <TouchableOpacity
                      onPress={() => handleShareWhatsApp(selectedSale)}
                      style={[styles.shareBtn, { backgroundColor: '#10B981' }]}
                    >
                      <Share2 size={16} color="#FFFFFF" />
                      <Text style={styles.shareBtnText}>WhatsApp</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => handleDeleteSale(selectedSale)}
                      style={[styles.deleteBtn, { backgroundColor: 'rgba(239, 68, 68, 0.12)' }]}
                    >
                      <Trash2 size={16} color="#EF4444" />
                      <Text style={styles.deleteBtnText}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                </>
              ) : null}
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  mainWrapper: { flex: 1, paddingHorizontal: 16, paddingTop: 10 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  backBtn: { padding: 8, borderRadius: 12, borderWidth: 1 },
  menuBtn: { padding: 9, borderRadius: 12, borderWidth: 1 },
  headerBadge: { fontSize: 10, fontWeight: '800', color: BRAND_COLORS.sky500, textTransform: 'uppercase', letterSpacing: 0.5 },
  headerTitle: { fontSize: 20, fontWeight: '900' },
  searchBox: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 14, borderWidth: 1, marginBottom: 10 },
  searchInput: { flex: 1, fontSize: 13, marginLeft: 8 },
  filterRow: { flexDirection: 'row', gap: 6, marginBottom: 12 },
  filterChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, borderWidth: 1 },
  filterChipText: { fontSize: 11, fontWeight: '800' },
  loadingContainer: { paddingVertical: 60, alignItems: 'center' },
  loadingText: { fontSize: 12, fontWeight: '600', marginTop: 12 },
  saleCard: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 16, borderWidth: 1, marginBottom: 8 },
  invoiceNumber: { fontSize: 14, fontWeight: '800' },
  paymentBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, marginLeft: 8 },
  paymentBadgeText: { fontSize: 9, fontWeight: '900', color: BRAND_COLORS.blue600, marginLeft: 3 },
  saleMeta: { fontSize: 11, marginTop: 4 },
  saleAmount: { fontSize: 15, fontWeight: '900' },
  itemCountText: { fontSize: 10, marginTop: 2 },
  emptyContainer: { paddingVertical: 60, alignItems: 'center' },
  emptyTitle: { fontSize: 16, fontWeight: '800', marginTop: 12 },
  emptySub: { fontSize: 12, textAlign: 'center', marginTop: 4 },
  overlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.7)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  detailModalCard: { width: '100%', maxWidth: 440, borderRadius: 24, padding: 18, borderWidth: 1 },
  detailHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  detailInvoice: { fontSize: 18, fontWeight: '900' },
  detailDate: { fontSize: 11, marginTop: 2 },
  closeBtn: { padding: 4 },
  detailItemRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1 },
  detailItemName: { fontSize: 13, fontWeight: '700' },
  detailItemSub: { fontSize: 11, marginTop: 2 },
  detailItemTotal: { fontSize: 13, fontWeight: '800' },
  detailSummary: { borderRadius: 14, padding: 12, borderWidth: 1, marginTop: 10 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 2 },
  summaryLabel: { fontSize: 12, fontWeight: '600' },
  summaryVal: { fontSize: 12, fontWeight: '800' },
  summaryGrandLabel: { fontSize: 13, fontWeight: '800' },
  summaryGrandVal: { fontSize: 15, fontWeight: '900' },
  detailActionsRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  shareBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 14 },
  shareBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800', marginLeft: 6 },
  deleteBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 14 },
  deleteBtnText: { color: '#EF4444', fontSize: 13, fontWeight: '800', marginLeft: 6 },
});
