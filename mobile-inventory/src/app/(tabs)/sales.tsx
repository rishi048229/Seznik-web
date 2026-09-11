import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  Modal,
  ScrollView,
  Alert,
  StyleSheet,
  StatusBar,
  Platform,
  Linking,
} from 'react-native';
import { useSafeAreaInsets, SafeAreaView } from 'react-native-safe-area-context';
import {
  Menu,
  Search,
  Share2,
  Trash2,
  X,
  CreditCard,
  Banknote,
  QrCode,
  UserCheck,
  User,
  Receipt,
  ChevronRight,
} from 'lucide-react-native';
import { useSales } from '@/hooks/useSales';
import { Sale } from '@/types/sale';
import { useAppTheme } from '@/hooks/useAppTheme';
import { ScreenBackground } from '@/components/ui/ScreenBackground';
import { SidebarDrawer } from '@/components/ui/SidebarDrawer';
import { SalesListSkeleton } from '@/components/ui/ScreenSkeleton';
import { ScreenLoadingState, ScreenErrorState } from '@/components/ui/ScreenLoadingState';
import { useLanguageStore } from '@/store/useLanguageStore';

export default function SalesHistoryTabScreen() {
  const { sales, isLoading, isRefetching, isError, refetch, deleteSale } = useSales();
  const { t } = useLanguageStore();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string | null>(null);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);

  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const topPadding = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0, 12);

  const filteredSales = sales.filter((sale) => {
    const matchesSearch =
      sale.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (sale.customerName && sale.customerName.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesPayment = selectedPaymentMethod ? sale.paymentMethod === selectedPaymentMethod : true;
    return matchesSearch && matchesPayment;
  });

  const handleShareWhatsApp = (sale: Sale) => {
    const text = `*Invoice: ${sale.invoiceNumber}*\nDate: ${new Date(sale.createdAt).toLocaleDateString('en-IN')}\nTotal: Rs.${sale.grandTotal.toFixed(2)}\nPayment: ${sale.paymentMethod.toUpperCase()}\n\nThank you for your business!`;
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    Linking.openURL(url).catch(() => Alert.alert('Sharing Error', 'Unable to open WhatsApp.'));
  };

  const handleDeleteSale = (sale: Sale) => {
    Alert.alert('Delete Sale', `Delete invoice ${sale.invoiceNumber}?`, [
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
      case 'upi': return <QrCode size={15} color="#0284C7" />;
      case 'card': return <CreditCard size={15} color="#2563EB" />;
      case 'credit': return <UserCheck size={15} color="#D97706" />;
      default: return <Banknote size={15} color="#16A34A" />;
    }
  };

  const formatPayment = (method: string) => method.charAt(0).toUpperCase() + method.slice(1);

  return (
    <ScreenBackground color={theme.bg}>
      <StatusBar barStyle={theme.isDark ? 'light-content' : 'dark-content'} backgroundColor={theme.bg} />
      <View style={[styles.container, { backgroundColor: 'transparent', paddingTop: topPadding }]}>
        <View style={styles.mainWrapper}>
          <View style={styles.headerRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <TouchableOpacity
                onPress={() => setIsDrawerOpen(true)}
                style={[styles.menuBtn, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Menu size={20} color={theme.textPrimary} />
              </TouchableOpacity>
              <View style={{ marginLeft: 10 }}>
                <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>
                  {t('salesPageTitle', 'Sales History')}
                </Text>
                <Text style={[styles.headerSub, { color: theme.textSecondary }]}>
                  {sales.length} {t('invoicesRecorded', 'invoices recorded')}
                </Text>
              </View>
            </View>
          </View>

          <View style={[styles.searchBox, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
            <Search size={18} color={theme.textSecondary} />
            <TextInput
              style={[styles.searchInput, { color: theme.textPrimary }]}
              placeholder={t('searchSales', 'Search by invoice or customer...')}
              placeholderTextColor="#94A3B8"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          {isLoading ? (
            <ScreenLoadingState
              message={t('loadingSales', 'Loading sales...')}
              hint={t('loadingSalesHint', 'Fetching recent bills and transactions')}
              skeleton={<SalesListSkeleton count={6} />}
            />
          ) : isError ? (
            <ScreenErrorState
              message={t('salesLoadFailed', "Couldn't load sales")}
              hint={t('salesLoadFailedHint', 'Check your connection and try again.')}
              onRetry={refetch}
              isRetrying={isRefetching}
            />
          ) : (
            <FlatList
              data={filteredSales}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ paddingBottom: 30 }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => setSelectedSale(item)}
                  style={[styles.saleCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}
                >
                  <View style={{ flex: 1, marginRight: 10 }}>
                    <View style={styles.invoiceRow}>
                      <Receipt size={14} color={theme.textSecondary} style={{ marginRight: 5 }} />
                      <Text style={[styles.invoiceNum, { color: theme.textPrimary }]}>{item.invoiceNumber}</Text>
                      <View style={[styles.paymentBadge, { backgroundColor: theme.isDark ? '#334155' : '#F1F5F9' }]}>
                        {getPaymentIcon(item.paymentMethod)}
                        <Text style={[styles.paymentBadgeText, { color: theme.textPrimary }]}>
                          {formatPayment(item.paymentMethod)}
                        </Text>
                      </View>
                    </View>

                    {item.customerName && item.customerName !== 'Walk-in Customer' && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 3 }}>
                        <User size={12} color={theme.textSecondary} style={{ marginRight: 4 }} />
                        <Text style={[styles.customerText, { color: theme.textSecondary }]}>{item.customerName}</Text>
                      </View>
                    )}

                    <Text style={[styles.dateText, { color: theme.textSecondary }]}>
                      {new Date(item.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}{' '}
                      {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>

                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[styles.grandTotalText, { color: theme.textPrimary }]}>Rs.{item.grandTotal.toFixed(2)}</Text>
                    <ChevronRight size={14} color={theme.textSecondary} style={{ marginTop: 4 }} />
                  </View>
                </TouchableOpacity>
              )}
            />
          )}
        </View>

        {/* Sale Detail Modal — mirrors web invoice structure */}
        <Modal visible={!!selectedSale} animationType="slide">
          <SafeAreaView style={[styles.modalSafeArea, { backgroundColor: theme.bg }]}>
            {selectedSale && (
              <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20 }}>
                <View style={styles.modalHeader}>
                  <View>
                    <Text style={[styles.modalSupTitle, { color: theme.textSecondary }]}>Invoice</Text>
                    <Text style={[styles.modalInvoiceNum, { color: '#2563EB' }]}>{selectedSale.invoiceNumber}</Text>
                  </View>
                  <TouchableOpacity onPress={() => setSelectedSale(null)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <X size={26} color={theme.textSecondary} />
                  </TouchableOpacity>
                </View>

                {/* Meta card: date / customer / payment */}
                <View style={[styles.metaCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
                  <View style={styles.metaRow}>
                    <Text style={[styles.metaLabel, { color: theme.textSecondary }]}>Date</Text>
                    <Text style={[styles.metaValue, { color: theme.textPrimary }]}>
                      {new Date(selectedSale.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                      {' at '}
                      {new Date(selectedSale.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                  <View style={[styles.metaDivider, { backgroundColor: theme.borderColor }]} />
                  <View style={styles.metaRow}>
                    <Text style={[styles.metaLabel, { color: theme.textSecondary }]}>Customer</Text>
                    <Text style={[styles.metaValue, { color: theme.textPrimary }]} numberOfLines={1}>
                      {selectedSale.customerName || 'Walk-in Customer'}
                    </Text>
                  </View>
                  <View style={[styles.metaDivider, { backgroundColor: theme.borderColor }]} />
                  <View style={styles.metaRow}>
                    <Text style={[styles.metaLabel, { color: theme.textSecondary }]}>Payment</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      {getPaymentIcon(selectedSale.paymentMethod)}
                      <Text style={[styles.metaValue, { color: theme.textPrimary }]}>
                        {formatPayment(selectedSale.paymentMethod)}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Line Items */}
                <View style={[styles.detailCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
                  <Text style={styles.cardSectionHeader}>Items</Text>
                  {selectedSale.items && selectedSale.items.map((it: any, idx: number) => (
                    <View key={idx} style={[styles.itemLine, { borderBottomColor: theme.borderColor }]}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.itemLineName, { color: theme.textPrimary }]}>{it.productName}</Text>
                        <Text style={[styles.itemLineSub, { color: theme.textSecondary }]}>
                          {it.quantity} x Rs.{(it.unitPrice ?? it.sellingPrice ?? 0).toFixed(2)}
                          {it.taxRate ? `  |  GST ${it.taxRate}%` : ''}
                        </Text>
                      </View>
                      <Text style={[styles.itemLineTotal, { color: theme.textPrimary }]}>Rs.{it.total.toFixed(2)}</Text>
                    </View>
                  ))}
                </View>

                {/* Bill Summary */}
                <View style={[styles.detailCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
                  <Text style={styles.cardSectionHeader}>Summary</Text>
                  <View style={styles.summaryRow}>
                    <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Subtotal</Text>
                    <Text style={[styles.summaryValue, { color: theme.textPrimary }]}>Rs.{(selectedSale.subtotal ?? 0).toFixed(2)}</Text>
                  </View>
                  {(selectedSale.totalDiscount ?? 0) > 0 && (
                    <View style={styles.summaryRow}>
                      <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Discount</Text>
                      <Text style={[styles.summaryValue, { color: '#EF4444' }]}>-Rs.{(selectedSale.totalDiscount ?? 0).toFixed(2)}</Text>
                    </View>
                  )}
                  {(selectedSale.totalTax ?? 0) > 0 && (
                    <View style={styles.summaryRow}>
                      <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>GST</Text>
                      <Text style={[styles.summaryValue, { color: theme.textPrimary }]}>Rs.{(selectedSale.totalTax ?? 0).toFixed(2)}</Text>
                    </View>
                  )}
                  <View style={[styles.grandTotalRow, { borderTopColor: theme.borderColor }]}>
                    <Text style={[styles.grandTotalLabel, { color: theme.textPrimary }]}>Grand Total</Text>
                    <Text style={styles.grandTotalAmount}>Rs.{selectedSale.grandTotal.toFixed(2)}</Text>
                  </View>
                  {selectedSale.amountPaid != null && Math.abs(selectedSale.amountPaid - selectedSale.grandTotal) > 0.01 && (
                    <View style={[styles.summaryRow, { marginTop: 8 }]}>
                      <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Amount Paid</Text>
                      <Text style={[styles.summaryValue, { color: '#10B981' }]}>Rs.{selectedSale.amountPaid.toFixed(2)}</Text>
                    </View>
                  )}
                </View>

                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <TouchableOpacity onPress={() => handleShareWhatsApp(selectedSale)} style={styles.shareInvoiceBtn}>
                    <Share2 size={18} color="#FFFFFF" />
                    <Text style={styles.shareInvoiceBtnText}>Share via WhatsApp</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleDeleteSale(selectedSale)} style={styles.deleteInvoiceBtn}>
                    <Trash2 size={18} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              </ScrollView>
            )}
          </SafeAreaView>
        </Modal>

        <SidebarDrawer visible={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} />
      </View>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  mainWrapper: { flex: 1, paddingHorizontal: 16, paddingTop: 4 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  menuBtn: { padding: 9, borderRadius: 12, borderWidth: 1 },
  headerTitle: { fontSize: 22, fontWeight: '900' },
  headerSub: { fontSize: 12, marginTop: 1 },
  searchBox: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 14 },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 15 },
  saleCard: { borderRadius: 16, padding: 16, borderWidth: 1, marginBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  invoiceRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 5, flexWrap: 'wrap', gap: 4 },
  invoiceNum: { fontSize: 17, fontWeight: '800' },
  paymentBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 9, paddingVertical: 4, borderRadius: 10 },
  paymentBadgeText: { fontSize: 12, fontWeight: '700', textTransform: 'capitalize', marginLeft: 4 },
  customerText: { fontSize: 12, fontWeight: '500' },
  dateText: { fontSize: 12, marginTop: 4 },
  grandTotalText: { fontSize: 20, fontWeight: '900' },
  modalSafeArea: { flex: 1 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 },
  modalSupTitle: { fontSize: 13, fontWeight: '500' },
  modalInvoiceNum: { fontSize: 24, fontWeight: '900', marginTop: 2 },
  metaCard: { borderRadius: 16, borderWidth: 1, marginBottom: 14, overflow: 'hidden' },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  metaLabel: { fontSize: 13, fontWeight: '600' },
  metaValue: { fontSize: 13, fontWeight: '700', flexShrink: 1, textAlign: 'right', marginLeft: 8 },
  metaDivider: { height: 1, marginHorizontal: 16 },
  detailCard: { borderRadius: 16, padding: 16, borderWidth: 1, marginBottom: 14 },
  cardSectionHeader: { fontSize: 11, fontWeight: '800', color: '#94A3B8', textTransform: 'uppercase', marginBottom: 12, letterSpacing: 0.5 },
  itemLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1 },
  itemLineName: { fontSize: 15, fontWeight: '700' },
  itemLineSub: { fontSize: 12, marginTop: 2 },
  itemLineTotal: { fontSize: 15, fontWeight: '800' },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  summaryLabel: { fontSize: 14, fontWeight: '500' },
  summaryValue: { fontSize: 14, fontWeight: '700' },
  grandTotalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, marginTop: 8, paddingTop: 12 },
  grandTotalLabel: { fontSize: 16, fontWeight: '800' },
  grandTotalAmount: { fontSize: 22, fontWeight: '900', color: '#2563EB' },
  shareInvoiceBtn: { flex: 1, backgroundColor: '#10B981', borderRadius: 14, paddingVertical: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  shareInvoiceBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },
  deleteInvoiceBtn: { backgroundColor: 'rgba(239, 68, 68, 0.12)', paddingHorizontal: 18, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
});
