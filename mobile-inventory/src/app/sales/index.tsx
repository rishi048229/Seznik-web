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
  Alert,
  StyleSheet,
  StatusBar,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
  Printer,
  Download,
  FileText,
  Bluetooth,
} from 'lucide-react-native';
import { useSales } from '@/hooks/useSales';
import { Sale } from '@/types/sale';
import { useAppTheme } from '@/hooks/useAppTheme';
import { ScreenBackground } from '@/components/ui/ScreenBackground';
import { SidebarDrawer } from '@/components/ui/SidebarDrawer';
import { SalesListSkeleton } from '@/components/ui/ScreenSkeleton';
import { ScreenLoadingState, ScreenErrorState } from '@/components/ui/ScreenLoadingState';
import { BRAND_COLORS } from '@/constants/theme';
import { parseGstBilling, gstPrintOptionOverrides, shouldShowGstBreakdown } from '@/constants/gstBilling';
import { computeGstBillSummary, gstLinesFromSaleItems } from '@/utils/gst';
import { BillGstBreakdown } from '@/components/billing/BillGstBreakdown';
import { BillChargesBreakdown } from '@/components/billing/BillChargesBreakdown';
import { useLanguageStore } from '@/store/useLanguageStore';
import { useStoreProfile } from '@/hooks/useStoreProfile';
import { usePrinterStore } from '@/store/usePrinterStore';
import { useShallow } from 'zustand/react/shallow';
import ThermalPrinterService from '@/services/PrinterService';
import { DirectPrinterConnectModal } from '@/components/printers/DirectPrinterConnectModal';
import { A4InvoicePreviewModal } from '@/components/ui/A4InvoicePreviewModal';
import { printInvoiceA4, downloadInvoicePdf, shareInvoicePdf } from '@/utils/invoiceActions';
import { sanitizeErrorMessage } from '@/utils/errorHandler';

export default function SalesHistoryScreen() {
  const router = useRouter();
  const { t } = useLanguageStore();
  const storeProfile = useStoreProfile();
  const {
    connectionState,
  } = usePrinterStore(
    useShallow((s) => ({
    connectionState: s.connectionState,
    }))
  );
  const { sales, isLoading, isRefetching, isError, refetch, deleteSale } = useSales();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [showPrinterModal, setShowPrinterModal] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string | null>(null);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [isPrintingThermal, setIsPrintingThermal] = useState(false);
  const [pdfPreviewSale, setPdfPreviewSale] = useState<Sale | null>(null);

  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const topPadding = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0, 14);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2,
    }).format(val || 0);
  };

  const filteredSales = sales.filter((sale) => {
    const matchesSearch =
      sale.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (sale.customerName && sale.customerName.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesPayment = selectedPaymentMethod ? sale.paymentMethod === selectedPaymentMethod : true;
    return matchesSearch && matchesPayment;
  });

  const handleThermalReprint = async (sale: Sale) => {
    if (connectionState !== 'connected') {
      setShowPrinterModal(true);
      return;
    }

    setIsPrintingThermal(true);
    try {
      const items = (sale.items || []).map((it: any) => ({
        productName: it.productName || it.name || 'Item',
        quantity: it.quantity || 1,
        unitPrice: it.unitPrice || it.price || 0,
        total: it.total || (it.quantity || 1) * (it.unitPrice || 0),
        unit: it.unit || 'piece',
      }));

      const gstBilling = parseGstBilling(storeProfile.settings?.invoiceConfig);
      const summary = computeGstBillSummary(gstLinesFromSaleItems(sale.items || []));

      await ThermalPrinterService.printSaleReceipt({
        storeName: storeProfile.storeName,
        storeAddress: storeProfile.storeAddress,
        storePhone: storeProfile.storePhone,
        storeGstin: storeProfile.storeGstin,
        storeLogoUrl: storeProfile.storeLogoUrl,
        upiId: storeProfile.upiId,
        invoiceNumber: sale.invoiceNumber,
        date: new Date(sale.createdAt).toLocaleDateString('en-GB') + ' ' + new Date(sale.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        customerName: sale.customerName || 'Walk-in Customer',
        items,
        subtotal: sale.subtotal,
        totalTax: sale.totalTax || 0,
        totalDiscount: sale.totalDiscount || 0,
        grandTotal: sale.grandTotal,
        amountPaid: sale.amountPaid !== undefined ? sale.amountPaid : sale.grandTotal,
        changeReturned: sale.changeReturned || 0,
        paymentMethod: (sale.paymentMethod || 'CASH').toUpperCase(),
        taxableAmt: summary.taxableValue,
        cgst: summary.cgstAmount,
        sgst: summary.sgstAmount,
        gstStyle: gstBilling.printOnReceipt ? gstBilling.style : undefined,
        gstSlabs: summary.slabs,
      }, gstPrintOptionOverrides(gstBilling));

      Alert.alert('Reprint Success!', `Receipt #${sale.invoiceNumber} reprinted successfully.`);
    } catch (err: any) {
      Alert.alert('Printer Error', sanitizeErrorMessage(err, 'Failed to reprint receipt. Please check printer connection.'));
    } finally {
      setIsPrintingThermal(false);
    }
  };

  const handleDownloadPdf = (sale: Sale) => {
    setPdfPreviewSale(sale);
    downloadInvoicePdf(sale, storeProfile).catch(() => {});
  };

  const handlePrintA4 = async (sale: Sale) => {
    try {
      await printInvoiceA4(sale, storeProfile);
    } catch (err: any) {
      Alert.alert('A4 Print Error', sanitizeErrorMessage(err, 'Failed to open A4 print dialog.'));
    }
  };

  const handleSharePdf = async (sale: Sale) => {
    try {
      await shareInvoicePdf(sale, storeProfile);
    } catch (err: any) {
      Alert.alert('Share Failed', sanitizeErrorMessage(err, 'Could not share the A4 invoice PDF.'));
    }
  };

  const handleDeleteSale = (sale: Sale) => {
    Alert.alert('Delete Sale', `Are you sure you want to delete invoice ${sale.invoiceNumber}? This will revert stock and records.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteSale(sale.id);
            if (selectedSale?.id === sale.id) setSelectedSale(null);
          } catch (err: any) {
            Alert.alert('Error', sanitizeErrorMessage(err, 'Failed to delete sale. Please try again.'));
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
        backgroundColor="transparent"
        translucent
      />
      <View style={[styles.container, { paddingTop: topPadding }]}>
        <SidebarDrawer visible={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} />

        <View style={styles.mainWrapper}>
          <View style={styles.headerRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <TouchableOpacity
                onPress={() => router.back()}
                style={[styles.backBtn, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <ChevronLeft size={20} color={theme.textPrimary} />
              </TouchableOpacity>
              <View style={{ marginLeft: 10 }}>
                <Text style={styles.headerBadge}>{t('transactions', 'Transactions')}</Text>
                <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>{t('salesPageTitle', 'Sales History')}</Text>
              </View>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <TouchableOpacity
                onPress={() => setShowPrinterModal(true)}
                style={[
                  styles.printerStatusChip,
                  {
                    backgroundColor: connectionState === 'connected' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                    borderColor: connectionState === 'connected' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)',
                  },
                ]}
              >
                <Bluetooth size={14} color={connectionState === 'connected' ? '#10B981' : '#EF4444'} />
                <Text
                  style={[
                    styles.printerStatusText,
                    { color: connectionState === 'connected' ? '#10B981' : '#EF4444' },
                  ]}
                >
                  {connectionState === 'connected' ? 'Printer Ready' : 'Connect'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setIsDrawerOpen(true)}
                style={[styles.menuBtn, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}
              >
                <Menu size={18} color={theme.textPrimary} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Search Box */}
          <View style={[styles.searchBox, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
            <Search size={16} color={theme.textSecondary} />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder={t('searchCustomerPlaceholder', 'Search invoice number or customer...')}
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
              { label: t('all', 'All'), value: null },
              { label: t('cash', 'Cash'), value: 'cash' },
              { label: t('upi', 'UPI'), value: 'upi' },
              { label: t('card', 'Card'), value: 'card' },
              { label: t('credit', 'Credit'), value: 'credit' },
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
            <ScreenLoadingState
              message="Loading sales..."
              hint="Fetching recent bills and transactions"
              skeleton={<SalesListSkeleton count={6} />}
            />
          ) : isError ? (
            <ScreenErrorState
              message="Couldn't load sales"
              hint="Check your connection to the server and try again."
              onRetry={refetch}
              isRetrying={isRefetching}
            />
          ) : (
            <FlatList
              data={filteredSales}
              keyExtractor={(item) => item.id}
              refreshing={isRefetching}
              onRefresh={refetch}
              contentContainerStyle={{ paddingBottom: 24 }}
              renderItem={({ item }) => (
                <View
                  style={[styles.saleCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}
                >
                  <TouchableOpacity
                    onPress={() => setSelectedSale(item)}
                    activeOpacity={0.7}
                    style={styles.saleCardHeader}
                  >
                    <View style={styles.saleHeaderTop}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, marginRight: 8 }}>
                        <Text style={[styles.invoiceNumber, { color: theme.textPrimary }]} numberOfLines={1}>
                          {item.invoiceNumber}
                        </Text>
                        <View style={[styles.paymentBadge, { backgroundColor: 'rgba(37, 99, 235, 0.1)' }]}>
                          {getPaymentIcon(item.paymentMethod)}
                          <Text style={styles.paymentBadgeText}>{item.paymentMethod.toUpperCase()}</Text>
                        </View>
                      </View>
                      <Text style={[styles.saleAmount, { color: BRAND_COLORS.blue600 }]}>
                        {formatCurrency(item.grandTotal)}
                      </Text>
                    </View>

                    <Text style={[styles.saleMeta, { color: theme.textSecondary }]} numberOfLines={1}>
                      {new Date(item.createdAt).toLocaleDateString('en-GB')} • {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      {item.customerName ? ` • ${item.customerName}` : ''} • {item.items?.length || 0} items
                    </Text>
                  </TouchableOpacity>

                  {/* Actions Row Below */}
                  <View style={[styles.saleCardActions, { borderTopColor: theme.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }]}>
                    <TouchableOpacity
                      onPress={() => setSelectedSale(item)}
                      style={[styles.saleActionBtn, { backgroundColor: theme.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)' }]}
                      activeOpacity={0.7}
                    >
                      <FileText size={14} color={theme.textPrimary} />
                      <Text style={[styles.saleActionBtnText, { color: theme.textPrimary }]}>Details</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => setPdfPreviewSale(item)}
                      style={[styles.saleActionBtn, { backgroundColor: theme.isDark ? 'rgba(37, 99, 235, 0.2)' : 'rgba(37, 99, 235, 0.1)' }]}
                      activeOpacity={0.7}
                    >
                      <Receipt size={14} color={BRAND_COLORS.blue600} />
                      <Text style={[styles.saleActionBtnText, { color: BRAND_COLORS.blue600 }]}>A4 Bill</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => handleThermalReprint(item)}
                      style={[styles.saleActionBtn, { backgroundColor: BRAND_COLORS.navyInk }]}
                      activeOpacity={0.7}
                    >
                      <Printer size={14} color="#FFFFFF" />
                      <Text style={[styles.saleActionBtnText, { color: '#FFFFFF' }]}>Print</Text>
                    </TouchableOpacity>
                  </View>
                </View>
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

        {/* SALE DETAIL & REPRINT / DOWNLOAD MODAL */}
        <Modal visible={!!selectedSale} transparent animationType="slide" onRequestClose={() => setSelectedSale(null)}>
          <View style={styles.overlay}>
            <View style={[styles.detailModalCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
              {selectedSale ? (
                <>
                  <View style={styles.detailHeader}>
                    <View>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={[styles.detailInvoice, { color: theme.textPrimary }]}>
                          {selectedSale.invoiceNumber}
                        </Text>
                        <View style={[styles.paymentBadge, { backgroundColor: 'rgba(37, 99, 235, 0.1)', marginLeft: 8 }]}>
                          {getPaymentIcon(selectedSale.paymentMethod)}
                          <Text style={styles.paymentBadgeText}>{selectedSale.paymentMethod.toUpperCase()}</Text>
                        </View>
                      </View>
                      <Text style={[styles.detailDate, { color: theme.textSecondary }]}>
                        {new Date(selectedSale.createdAt).toLocaleString()} • {selectedSale.customerName || 'Walk-in Customer'}
                      </Text>
                    </View>
                    <TouchableOpacity onPress={() => setSelectedSale(null)} style={[styles.closeBtn, { backgroundColor: theme.bg, borderColor: theme.borderColor }]}>
                      <X size={18} color={theme.textSecondary} />
                    </TouchableOpacity>
                  </View>

                  <ScrollView style={{ maxHeight: 220, marginVertical: 8 }}>
                    {selectedSale.items?.map((it: any, idx: number) => {
                      const itemDisc = it.discountAmount || it.discount || 0;
                      return (
                        <View key={idx} style={[styles.detailItemRow, { borderBottomColor: theme.borderColor }]}>
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.detailItemName, { color: theme.textPrimary }]}>
                              {it.productName || it.name || `Item ${idx + 1}`}
                            </Text>
                            <Text style={[styles.detailItemSub, { color: theme.textSecondary }]}>
                              {it.quantity} × {formatCurrency(it.unitPrice || 0)}
                              {itemDisc > 0 ? ` (Save -${formatCurrency(itemDisc)})` : ''}
                            </Text>
                          </View>
                          <Text style={[styles.detailItemTotal, { color: theme.textPrimary }]}>
                            {formatCurrency(it.total || (it.quantity || 1) * (it.unitPrice || 0))}
                          </Text>
                        </View>
                      );
                    })}
                  </ScrollView>

                  <View style={[styles.detailSummary, { backgroundColor: theme.bg, borderColor: theme.borderColor }]}>
                    <View style={styles.summaryRow}>
                      <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Subtotal</Text>
                      <Text style={[styles.summaryVal, { color: theme.textPrimary }]}>{formatCurrency(selectedSale.subtotal)}</Text>
                    </View>
                    {selectedSale.totalTax > 0 ? (
                      shouldShowGstBreakdown(parseGstBilling(storeProfile.settings?.invoiceConfig)) ? (
                        <BillGstBreakdown
                          summary={computeGstBillSummary(gstLinesFromSaleItems(selectedSale.items || []))}
                          style={parseGstBilling(storeProfile.settings?.invoiceConfig).style}
                          theme={theme}
                        />
                      ) : (
                      <View style={styles.summaryRow}>
                        <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Tax / GST</Text>
                        <Text style={[styles.summaryVal, { color: '#10B981' }]}>+{formatCurrency(selectedSale.totalTax)}</Text>
                      </View>
                      )
                    ) : null}
                    {selectedSale.totalDiscount > 0 ? (
                      <View style={styles.summaryRow}>
                        <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Discount</Text>
                        <Text style={[styles.summaryVal, { color: '#EF4444' }]}>-{formatCurrency(selectedSale.totalDiscount)}</Text>
                      </View>
                    ) : null}
                    {Array.isArray(selectedSale.billCharges) && selectedSale.billCharges.length > 0 ? (
                      <BillChargesBreakdown charges={selectedSale.billCharges} theme={theme} />
                    ) : null}
                    <View style={[styles.summaryRow, { marginTop: 4, paddingTop: 6, borderTopWidth: 1, borderTopColor: theme.borderColor }]}>
                      <Text style={[styles.summaryGrandLabel, { color: theme.textPrimary }]}>Grand Total</Text>
                      <Text style={[styles.summaryGrandVal, { color: BRAND_COLORS.blue600 }]}>{formatCurrency(selectedSale.grandTotal)}</Text>
                    </View>
                  </View>

                  {/* ACTION BUTTONS: REPRINT BILL / DOWNLOAD PDF / WHATSAPP */}
                  <View style={{ marginTop: 12, gap: 8 }}>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <TouchableOpacity
                        onPress={() => handleThermalReprint(selectedSale)}
                        disabled={isPrintingThermal}
                        style={[styles.actionBtnPrimary, { backgroundColor: BRAND_COLORS.navyInk }]}
                      >
                        {isPrintingThermal ? (
                          <ActivityIndicator color="#FFF" size="small" />
                        ) : (
                          <Printer size={16} color="#FFFFFF" />
                        )}
                        <Text style={styles.actionBtnPrimaryText}>Reprint Thermal Bill</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() => handleDownloadPdf(selectedSale)}
                        style={[styles.actionBtnSecondary, { backgroundColor: 'rgba(37, 99, 235, 0.12)', borderColor: 'rgba(37, 99, 235, 0.25)' }]}
                      >
                        <Download size={16} color={BRAND_COLORS.blue600} />
                        <Text style={[styles.actionBtnSecondaryText, { color: BRAND_COLORS.blue600 }]}>Download PDF</Text>
                      </TouchableOpacity>
                    </View>

                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <TouchableOpacity
                        onPress={() => handleSharePdf(selectedSale)}
                        style={[styles.actionBtnSecondary, { flex: 1.5, backgroundColor: 'rgba(16, 185, 129, 0.12)', borderColor: 'rgba(16, 185, 129, 0.25)' }]}
                      >
                        <Share2 size={16} color="#10B981" />
                        <Text style={[styles.actionBtnSecondaryText, { color: '#10B981' }]}>Share PDF</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() => handlePrintA4(selectedSale)}
                        style={[styles.actionBtnSecondary, { flex: 1, backgroundColor: 'rgba(100, 116, 139, 0.12)', borderColor: theme.borderColor }]}
                      >
                        <FileText size={15} color={theme.textPrimary} />
                        <Text style={[styles.actionBtnSecondaryText, { color: theme.textPrimary }]}>A4 Invoice</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() => handleDeleteSale(selectedSale)}
                        style={[styles.actionBtnDelete, { backgroundColor: 'rgba(239, 68, 68, 0.12)' }]}
                      >
                        <Trash2 size={16} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  </View>
                </>
              ) : null}
            </View>
          </View>
        </Modal>

        {/* Direct Bluetooth Printer Connect Dialog */}
        <DirectPrinterConnectModal
          visible={showPrinterModal}
          onClose={() => setShowPrinterModal(false)}
        />

        <A4InvoicePreviewModal
          visible={!!pdfPreviewSale}
          sale={pdfPreviewSale}
          onClose={() => setPdfPreviewSale(null)}
        />
      </View>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  mainWrapper: { flex: 1, paddingHorizontal: 16, paddingTop: 6 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  backBtn: { padding: 8, borderRadius: 12, borderWidth: 1 },
  menuBtn: { padding: 9, borderRadius: 12, borderWidth: 1 },
  printerStatusChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 6, borderRadius: 10, borderWidth: 1 },
  printerStatusText: { fontSize: 11, fontWeight: '800', marginLeft: 4 },
  headerBadge: { fontSize: 10, fontWeight: '800', color: BRAND_COLORS.sky500, textTransform: 'uppercase', letterSpacing: 0.5 },
  headerTitle: { fontSize: 20, fontWeight: '900' },
  searchBox: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 14, borderWidth: 1, marginBottom: 10 },
  searchInput: { flex: 1, fontSize: 13, marginLeft: 8 },
  filterRow: { flexDirection: 'row', gap: 6, marginBottom: 12 },
  filterChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, borderWidth: 1 },
  filterChipText: { fontSize: 11, fontWeight: '800' },
  saleCard: {
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 10,
    overflow: 'hidden',
  },
  saleCardHeader: {
    padding: 14,
  },
  saleHeaderTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  invoiceNumber: { fontSize: 15, fontWeight: '900' },
  paymentBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, marginLeft: 6 },
  paymentBadgeText: { fontSize: 9.5, fontWeight: '900', color: BRAND_COLORS.blue600, marginLeft: 3 },
  saleMeta: { fontSize: 11.5, lineHeight: 16 },
  saleAmount: { fontSize: 16, fontWeight: '900' },
  saleCardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    padding: 8,
    gap: 6,
  },
  saleActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    borderRadius: 9,
    gap: 4,
    minHeight: 32,
  },
  saleActionBtnText: {
    fontSize: 11.5,
    fontWeight: '800',
  },
  emptyContainer: { paddingVertical: 60, alignItems: 'center' },
  emptyTitle: { fontSize: 16, fontWeight: '800', marginTop: 12 },
  emptySub: { fontSize: 12, textAlign: 'center', marginTop: 4 },
  overlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.7)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  detailModalCard: { width: '100%', maxWidth: 440, borderRadius: 24, padding: 18, borderWidth: 1 },
  detailHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  detailInvoice: { fontSize: 18, fontWeight: '900' },
  detailDate: { fontSize: 11, marginTop: 2 },
  closeBtn: { padding: 6, borderRadius: 10, borderWidth: 1 },
  detailItemRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 7, borderBottomWidth: 1 },
  detailItemName: { fontSize: 13, fontWeight: '700' },
  detailItemSub: { fontSize: 11, marginTop: 2 },
  detailItemTotal: { fontSize: 13, fontWeight: '800' },
  detailSummary: { borderRadius: 14, padding: 12, borderWidth: 1, marginTop: 8 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 2 },
  summaryLabel: { fontSize: 12, fontWeight: '600' },
  summaryVal: { fontSize: 12, fontWeight: '800' },
  summaryGrandLabel: { fontSize: 13, fontWeight: '800' },
  summaryGrandVal: { fontSize: 15, fontWeight: '900' },
  actionBtnPrimary: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 14, gap: 6 },
  actionBtnPrimaryText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  actionBtnSecondary: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 14, borderWidth: 1, gap: 6 },
  actionBtnSecondaryText: { fontSize: 12, fontWeight: '800' },
  actionBtnDelete: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14, paddingVertical: 12, borderRadius: 14 },
});
