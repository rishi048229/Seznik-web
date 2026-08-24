import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  Modal,
  ScrollView,
  ActivityIndicator,
  Linking,
  Alert,
  StyleSheet,
  StatusBar,
  Platform,
} from 'react-native';
import { useSafeAreaInsets, SafeAreaView } from 'react-native-safe-area-context';
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
      <StatusBar
        barStyle={theme.isDark ? 'light-content' : 'dark-content'}
        backgroundColor={theme.bg}
      />
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
                  {sales.length} Invoices recorded
                </Text>
              </View>
            </View>
          </View>

        {/* Search */}
        <View style={[styles.searchBox, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
          <Search size={18} color={theme.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: theme.textPrimary }]}
            placeholder={t('searchProducts', 'Search invoice number or customer...')}
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {/* Sales List */}
        {isLoading ? (
          <ScreenLoadingState
            message={t('loadingSales', 'Loading sales...')}
            hint={t('loadingSalesHint', 'Fetching recent bills and transactions')}
            skeleton={<SalesListSkeleton count={6} />}
          />
        ) : isError ? (
          <ScreenErrorState
            message={t('salesLoadFailed', "Couldn't load sales")}
            hint={t('salesLoadFailedHint', 'Check your connection to the server and try again.')}
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
                <View style={{ flex: 1, marginRight: 12 }}>
                  <View style={styles.invoiceRow}>
                    <Text style={[styles.invoiceNum, { color: theme.textPrimary }]}>
                      {item.invoiceNumber}
                    </Text>
                    <View style={[styles.paymentBadge, { backgroundColor: theme.isDark ? '#334155' : '#F1F5F9' }]}>
                      {getPaymentIcon(item.paymentMethod)}
                      <Text style={[styles.paymentBadgeText, { color: theme.textPrimary }]}>
                        {item.paymentMethod}
                      </Text>
                    </View>
                  </View>

                  <Text style={[styles.dateText, { color: theme.textSecondary }]}>
                    {new Date(item.createdAt).toLocaleDateString()} at{' '}
                    {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>

                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[styles.grandTotalText, { color: theme.textPrimary }]}>
                    ₹{item.grandTotal.toFixed(2)}
                  </Text>
                  <TouchableOpacity
                    onPress={() => handleShareWhatsApp(item)}
                    style={styles.shareBtn}
                  >
                    <Share2 size={13} color="#10B981" />
                    <Text style={styles.shareBtnText}>Share</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            )}
          />
        )}
      </View>

      {/* Sale Detail Modal */}
      <Modal visible={!!selectedSale} animationType="slide">
        <SafeAreaView style={[styles.modalSafeArea, { backgroundColor: theme.bg }]}>
          {selectedSale && (
            <ScrollView style={{ flex: 1, padding: 16 }}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>
                  Invoice {selectedSale.invoiceNumber}
                </Text>
                <TouchableOpacity onPress={() => setSelectedSale(null)}>
                  <X size={24} color={theme.textSecondary} />
                </TouchableOpacity>
              </View>

              <View style={[styles.detailCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
                <Text style={styles.cardSectionHeader}>Line Items</Text>
                {selectedSale.items && selectedSale.items.map((it, idx) => (
                  <View key={idx} style={[styles.itemLine, { borderBottomColor: theme.borderColor }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.itemLineName, { color: theme.textPrimary }]}>{it.productName}</Text>
                      <Text style={[styles.itemLineSub, { color: theme.textSecondary }]}>
                        {it.quantity} x ₹{it.unitPrice.toFixed(2)}
                      </Text>
                    </View>
                    <Text style={[styles.itemLineTotal, { color: theme.textPrimary }]}>
                      ₹{it.total.toFixed(2)}
                    </Text>
                  </View>
                ))}
              </View>

              <View style={[styles.detailCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
                <View style={styles.summaryRow}>
                  <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Grand Total</Text>
                  <Text style={styles.summaryTotal}>₹{selectedSale.grandTotal.toFixed(2)}</Text>
                </View>
              </View>

              <View style={{ flexDirection: 'row', marginTop: 16 }}>
                <TouchableOpacity
                  onPress={() => handleShareWhatsApp(selectedSale)}
                  style={styles.shareInvoiceBtn}
                >
                  <Share2 size={18} color="#FFFFFF" />
                  <Text style={styles.shareInvoiceBtnText}>Share via WhatsApp</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleDeleteSale(selectedSale)}
                  style={styles.deleteInvoiceBtn}
                >
                  <Trash2 size={18} color="#EF4444" />
                </TouchableOpacity>
              </View>
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>

      {/* Sidebar Drawer */}
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
  headerTitle: { fontSize: 20, fontWeight: '900' },
  headerSub: { fontSize: 11 },
  searchBox: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 14 },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 14 },
  loaderCenter: { paddingVertical: 60, alignItems: 'center' },
  saleCard: { borderRadius: 16, padding: 14, borderWidth: 1, marginBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  invoiceRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  invoiceNum: { fontSize: 15, fontWeight: '800', marginRight: 8 },
  paymentBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  paymentBadgeText: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', marginLeft: 4 },
  dateText: { fontSize: 11 },
  grandTotalText: { fontSize: 16, fontWeight: '900' },
  shareBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, backgroundColor: 'rgba(16, 185, 129, 0.15)', borderRadius: 8, marginTop: 6 },
  shareBtnText: { fontSize: 10, fontWeight: '800', color: '#10B981', marginLeft: 4 },
  modalSafeArea: { flex: 1 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 20, fontWeight: '900' },
  detailCard: { borderRadius: 16, padding: 16, borderWidth: 1, marginBottom: 16 },
  cardSectionHeader: { fontSize: 11, fontWeight: '800', color: '#94A3B8', textTransform: 'uppercase', marginBottom: 10 },
  itemLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1 },
  itemLineName: { fontSize: 14, fontWeight: '700' },
  itemLineSub: { fontSize: 11, marginTop: 2 },
  itemLineTotal: { fontSize: 14, fontWeight: '800' },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryLabel: { fontSize: 14, fontWeight: '700' },
  summaryTotal: { fontSize: 20, fontWeight: '900', color: '#2563EB' },
  shareInvoiceBtn: { flex: 1, backgroundColor: '#10B981', borderRadius: 14, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  shareInvoiceBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 14, marginLeft: 8 },
  deleteInvoiceBtn: { backgroundColor: 'rgba(239, 68, 68, 0.15)', paddingHorizontal: 16, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
});
