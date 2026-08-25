import React, { useCallback, useMemo, useState } from 'react';
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
import { useFocusEffect } from 'expo-router';
import {
  Search,
  Receipt,
  X,
  CreditCard,
  Banknote,
  QrCode,
  UserCheck,
  Printer,
  Download,
  Eye,
  Calendar,
  SlidersHorizontal,
  Bluetooth,
} from 'lucide-react-native';
import { useSales } from '@/hooks/useSales';
import { Sale } from '@/types/sale';
import { useAppTheme } from '@/hooks/useAppTheme';
import { ScreenBackground } from '@/components/ui/ScreenBackground';
import { SalesListSkeleton } from '@/components/ui/ScreenSkeleton';
import { ScreenLoadingState, ScreenErrorState } from '@/components/ui/ScreenLoadingState';
import { ReceiptPreviewModal } from '@/components/ui/ReceiptPreviewModal';
import { BRAND_COLORS } from '@/constants/theme';
import { useTranslation } from '@/store/useLanguageStore';
import { useStoreProfile } from '@/hooks/useStoreProfile';
import { usePrinterStore } from '@/store/usePrinterStore';
import { DirectPrinterConnectModal } from '@/components/printers/DirectPrinterConnectModal';
import { getTemplateById } from '@/constants/receiptTemplates';
import { parseGstBilling, gstPrintOptionOverrides } from '@/constants/gstBilling';
import type { PrintSaleData } from '@/services/PrinterService';
import {
  formatInvoiceDateTime,
  printInvoiceReceipt,
  saveInvoicePdfLocally,
  saleToPrintSaleData,
} from '@/utils/invoiceActions';
import {
  DateRangePreset,
  formatDateInputValue,
  formatTimeInputValue,
  getDateRangeForPreset,
  parseDateTimeInput,
  saleInDateRange,
} from '@/utils/invoiceDateFilters';

type SortOption = 'newest' | 'oldest' | 'amount_high' | 'amount_low';

const DATE_PRESETS: { id: DateRangePreset; labelKey: string; fallback: string }[] = [
  { id: 'all', labelKey: 'all', fallback: 'All' },
  { id: 'today', labelKey: 'today', fallback: 'Today' },
  { id: 'yesterday', labelKey: 'invoiceYesterday', fallback: 'Yesterday' },
  { id: 'week', labelKey: 'invoiceLast7Days', fallback: '7 Days' },
  { id: 'month', labelKey: 'invoiceThisMonth', fallback: 'This Month' },
  { id: 'custom', labelKey: 'invoiceCustomRange', fallback: 'Custom' },
];

export default function InvoicesTabScreen() {
  const { t } = useTranslation();
  const storeProfile = useStoreProfile();
  const {
    activeDevice,
    connectionState,
    paperWidth,
    topMargin,
    autoCut,
    fontSize,
    printCopies,
    activeTemplateId,
    customTemplates,
    activeCustomTemplateId,
    enableBillQrCode,
  } = usePrinterStore();
  const { sales, isLoading, isRefetching, isError, refetch } = useSales();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string | null>(null);
  const [datePreset, setDatePreset] = useState<DateRangePreset>('all');
  const [customStartDate, setCustomStartDate] = useState(formatDateInputValue(new Date()));
  const [customStartTime, setCustomStartTime] = useState('00:00');
  const [customEndDate, setCustomEndDate] = useState(formatDateInputValue(new Date()));
  const [customEndTime, setCustomEndTime] = useState('23:59');
  const [showDateModal, setShowDateModal] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [showSortMenu, setShowSortMenu] = useState(false);

  const [previewSaleData, setPreviewSaleData] = useState<PrintSaleData | null>(null);
  const [showReceiptPreview, setShowReceiptPreview] = useState(false);
  const [showPrinterModal, setShowPrinterModal] = useState(false);
  const [pendingPrintSale, setPendingPrintSale] = useState<Sale | null>(null);
  const [busySaleId, setBusySaleId] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<'print' | 'download' | null>(null);

  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const topPadding = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0, 14);

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch])
  );

  const activeDateRange = useMemo(() => {
    if (datePreset === 'custom') {
      const start = parseDateTimeInput(customStartDate, customStartTime);
      const end = parseDateTimeInput(customEndDate, customEndTime);
      if (end) end.setSeconds(59, 999);
      return { start, end };
    }
    return getDateRangeForPreset(datePreset);
  }, [datePreset, customStartDate, customStartTime, customEndDate, customEndTime]);

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(val || 0);

  const filteredSales = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    let list = sales.filter((sale) => {
      const matchesSearch =
        !q ||
        sale.invoiceNumber.toLowerCase().includes(q) ||
        (sale.customerName && sale.customerName.toLowerCase().includes(q));
      const matchesPayment = selectedPaymentMethod ? sale.paymentMethod === selectedPaymentMethod : true;
      const matchesDate = saleInDateRange(sale.createdAt, activeDateRange);
      return matchesSearch && matchesPayment && matchesDate;
    });

    list = [...list].sort((a, b) => {
      if (sortBy === 'oldest') return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      if (sortBy === 'amount_high') return b.grandTotal - a.grandTotal;
      if (sortBy === 'amount_low') return a.grandTotal - b.grandTotal;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return list;
  }, [sales, searchQuery, selectedPaymentMethod, activeDateRange, sortBy]);

  const buildPrintOptions = useCallback(() => {
    const template = getTemplateById(activeTemplateId);
    const customTemplate = customTemplates?.find((t) => t.id === activeCustomTemplateId) || null;
    const gstBilling = parseGstBilling(storeProfile.settings?.invoiceConfig);
    return {
      template,
      customTemplate,
      includeBillQr: enableBillQrCode,
      topMargin,
      autoCut,
      fontSize,
      copies: printCopies,
      storeName: storeProfile.storeName,
      storeAddress: storeProfile.storeAddress,
      storePhone: storeProfile.storePhone,
      storeGstin: storeProfile.storeGstin,
      storeLogoUrl: storeProfile.storeLogoUrl,
      upiId: storeProfile.upiId,
      ...gstPrintOptionOverrides(gstBilling),
    };
  }, [
    activeTemplateId,
    customTemplates,
    activeCustomTemplateId,
    enableBillQrCode,
    topMargin,
    autoCut,
    fontSize,
    printCopies,
    storeProfile,
  ]);

  const openReceiptPreview = useCallback(
    (sale: Sale) => {
      setPreviewSaleData(saleToPrintSaleData(sale, storeProfile));
      setShowReceiptPreview(true);
    },
    [storeProfile]
  );

  const handlePrint = async (sale: Sale) => {
    if (connectionState !== 'connected') {
      Alert.alert(
        t('noPrinterConnected', 'No Printer Connected'),
        t('noPrinterConnectedHint', 'Connect a Bluetooth thermal printer to print this invoice.'),
        [
          { text: t('cancel', 'Cancel'), style: 'cancel' },
          {
            text: t('connectPrinter', 'Connect Printer'),
            onPress: () => {
              setPendingPrintSale(sale);
              setShowPrinterModal(true);
            },
          },
        ]
      );
      return;
    }

    setBusySaleId(sale.id);
    setBusyAction('print');
    try {
      const ok = await printInvoiceReceipt(sale, storeProfile, paperWidth, buildPrintOptions(), connectionState);
      if (ok) {
        Alert.alert(t('printSent', 'Print Sent'), t('printSentHint', 'Receipt sent to your thermal printer.'));
      }
    } catch (err: any) {
      Alert.alert(t('printError', 'Print Error'), err?.message || 'Failed to print invoice');
    } finally {
      setBusySaleId(null);
      setBusyAction(null);
    }
  };

  const handleDownload = async (sale: Sale) => {
    setBusySaleId(sale.id);
    setBusyAction('download');
    try {
      const fileUri = await saveInvoicePdfLocally(sale, storeProfile);
      Alert.alert(
        t('invoiceSaved', 'Invoice Saved'),
        `${t('invoiceSavedHint', 'PDF saved on this device')}:\n${fileUri}`
      );
    } catch (err: any) {
      Alert.alert(t('pdfError', 'PDF Error'), err?.message || 'Failed to save PDF');
    } finally {
      setBusySaleId(null);
      setBusyAction(null);
    }
  };

  const getPaymentIcon = (method: string) => {
    switch (method) {
      case 'upi':
        return <QrCode size={12} color="#0284C7" />;
      case 'card':
        return <CreditCard size={12} color="#2563EB" />;
      case 'credit':
        return <UserCheck size={12} color="#D97706" />;
      default:
        return <Banknote size={12} color="#16A34A" />;
    }
  };

  const bottomPad = Math.max(insets.bottom, 12) + 72;

  const renderFilters = () => (
    <View style={[styles.filtersPanel, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
      <Text style={[styles.filterSectionLabel, { color: theme.textPrimary }]}>{t('filterByDate', 'Filter by date')}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator style={styles.presetScroll} contentContainerStyle={styles.presetRow}>
        {DATE_PRESETS.map((preset) => {
          const active = datePreset === preset.id;
          return (
            <TouchableOpacity
              key={preset.id}
              onPress={() => {
                if (preset.id === 'custom') setShowDateModal(true);
                setDatePreset(preset.id);
              }}
              style={[
                styles.presetChip,
                {
                  backgroundColor: active ? BRAND_COLORS.blue600 : theme.bg,
                  borderColor: active ? BRAND_COLORS.blue600 : theme.borderColor,
                },
              ]}
            >
              {preset.id === 'custom' ? (
                <Calendar size={13} color={active ? '#FFF' : BRAND_COLORS.sky500} style={{ marginRight: 5 }} />
              ) : null}
              <Text style={[styles.presetChipText, { color: active ? '#FFFFFF' : theme.textPrimary }]}>
                {t(preset.labelKey, preset.fallback)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {datePreset === 'custom' ? (
        <TouchableOpacity
          onPress={() => setShowDateModal(true)}
          style={[styles.customRangeHint, { backgroundColor: theme.bg, borderColor: theme.borderColor }]}
        >
          <Calendar size={14} color={BRAND_COLORS.sky500} />
          <Text style={[styles.customRangeText, { color: theme.textPrimary }]}>
            {customStartDate} {customStartTime} → {customEndDate} {customEndTime}
          </Text>
        </TouchableOpacity>
      ) : null}

      <View style={styles.filterSectionHeader}>
        <Text style={[styles.filterSectionLabel, { color: theme.textPrimary }]}>{t('filterByPayment', 'Payment mode')}</Text>
        <TouchableOpacity
          onPress={() => setShowSortMenu(true)}
          style={[styles.sortBtn, { backgroundColor: theme.bg, borderColor: theme.borderColor }]}
        >
          <SlidersHorizontal size={14} color={BRAND_COLORS.blue600} />
          <Text style={[styles.sortBtnText, { color: BRAND_COLORS.blue600 }]}>{t('sort', 'Sort')}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={styles.filterRow}>
        {[
          { label: t('all', 'All'), value: null },
          { label: t('cash', 'Cash'), value: 'cash' },
          { label: t('upi', 'UPI'), value: 'upi' },
          { label: t('card', 'Card'), value: 'card' },
          { label: t('udhaar', 'Udhaar'), value: 'credit' },
        ].map((filter) => {
          const active = selectedPaymentMethod === filter.value;
          return (
            <TouchableOpacity
              key={filter.label}
              onPress={() => setSelectedPaymentMethod(filter.value)}
              style={[
                styles.filterChip,
                {
                  backgroundColor: active ? BRAND_COLORS.navyInk : theme.bg,
                  borderColor: active ? BRAND_COLORS.navyInk : theme.borderColor,
                },
              ]}
            >
              <Text style={[styles.filterChipText, { color: active ? '#FFFFFF' : theme.textPrimary }]}>{filter.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );

  return (
    <ScreenBackground color={theme.bg}>
      <StatusBar barStyle={theme.isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
      <View style={[styles.container, { paddingTop: topPadding }]}>
        <View style={styles.mainWrapper}>
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.headerBadge}>{t('billing', 'Billing')}</Text>
              <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>{t('invoices', 'Invoices')}</Text>
            </View>
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
                {connectionState === 'connected'
                  ? activeDevice?.name || t('printerConnected', 'Printer Ready')
                  : t('connectPrinter', 'Connect')}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.searchBox, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
            <Search size={16} color={theme.textSecondary} />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder={t('searchInvoicesPlaceholder', 'Search invoice # or customer...')}
              placeholderTextColor={theme.textSecondary}
              style={[styles.searchInput, { color: theme.textPrimary }]}
            />
            {searchQuery ? (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <X size={16} color={theme.textSecondary} />
              </TouchableOpacity>
            ) : null}
          </View>

          {renderFilters()}

          {isLoading ? (
            <View style={styles.list}>
              <ScreenLoadingState
                message={t('loadingInvoices', 'Loading invoices...')}
                hint={t('loadingInvoicesHint', 'Fetching your complete invoice history')}
                skeleton={<SalesListSkeleton count={8} />}
              />
            </View>
          ) : isError ? (
            <View style={styles.list}>
              <ScreenErrorState
                message={t('invoicesLoadFailed', "Couldn't load invoices")}
                hint={t('invoicesLoadFailedHint', 'Check your connection to the server and try again.')}
                onRetry={refetch}
                isRetrying={isRefetching}
              />
            </View>
          ) : (
            <FlatList
              style={styles.list}
              data={filteredSales}
              keyExtractor={(item) => item.id}
              refreshing={isRefetching}
              onRefresh={refetch}
              contentContainerStyle={{ paddingBottom: bottomPad, paddingTop: 4 }}
              showsVerticalScrollIndicator
              renderItem={({ item }) => {
                const isBusy = busySaleId === item.id;
                return (
                  <View style={[styles.invoiceCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
                    <TouchableOpacity style={styles.invoiceMain} onPress={() => openReceiptPreview(item)} activeOpacity={0.85}>
                      <View style={{ flex: 1 }}>
                        <View style={styles.invoiceTopRow}>
                          <Text style={[styles.invoiceNumber, { color: theme.textPrimary }]}>{item.invoiceNumber}</Text>
                          <View style={styles.paymentBadge}>
                            {getPaymentIcon(item.paymentMethod)}
                            <Text style={styles.paymentBadgeText}>{item.paymentMethod.toUpperCase()}</Text>
                          </View>
                        </View>
                        <Text style={[styles.invoiceMeta, { color: theme.textSecondary }]}>
                          {formatInvoiceDateTime(item.createdAt)}
                          {item.customerName ? ` · ${item.customerName}` : ''}
                        </Text>
                        <Text style={[styles.itemCount, { color: theme.textSecondary }]}>{item.items?.length || 0} items</Text>
                      </View>
                      <Text style={[styles.invoiceAmount, { color: BRAND_COLORS.blue600 }]}>{formatCurrency(item.grandTotal)}</Text>
                    </TouchableOpacity>

                    <View style={[styles.actionRow, { borderTopColor: theme.borderColor, backgroundColor: theme.bg }]}>
                      <TouchableOpacity
                        onPress={() => openReceiptPreview(item)}
                        style={[styles.rowActionBtn, styles.viewBtn, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}
                      >
                        <Eye size={16} color={theme.textPrimary} />
                        <Text style={[styles.rowActionText, { color: theme.textPrimary }]}>{t('view', 'View')}</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() => handleDownload(item)}
                        disabled={isBusy}
                        style={[styles.rowActionBtn, styles.downloadBtn]}
                      >
                        {isBusy && busyAction === 'download' ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <>
                            <Download size={16} color="#FFFFFF" />
                            <Text style={[styles.rowActionText, styles.rowActionTextLight]}>{t('download', 'Download')}</Text>
                          </>
                        )}
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() => handlePrint(item)}
                        disabled={isBusy}
                        style={[styles.rowActionBtn, styles.printBtn]}
                      >
                        {isBusy && busyAction === 'print' ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <>
                            <Printer size={16} color="#FFFFFF" />
                            <Text style={[styles.rowActionText, styles.rowActionTextLight]}>{t('print', 'Print')}</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              }}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Receipt size={40} color={theme.textSecondary} />
                  <Text style={[styles.emptyTitle, { color: theme.textPrimary }]}>{t('noInvoices', 'No Invoices Found')}</Text>
                  <Text style={[styles.emptySub, { color: theme.textSecondary }]}>
                    {t('noInvoicesHint', 'Try changing filters or complete a sale from POS.')}
                  </Text>
                </View>
              }
            />
          )}
        </View>

        <ReceiptPreviewModal
          visible={showReceiptPreview}
          saleData={previewSaleData}
          autoCloseAfterPrint={false}
          onClose={() => {
            setShowReceiptPreview(false);
            setPreviewSaleData(null);
          }}
        />

        {/* Custom date & time range */}
        <Modal visible={showDateModal} transparent animationType="fade" onRequestClose={() => setShowDateModal(false)}>
          <View style={styles.overlay}>
            <View style={[styles.dateModalCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
              <Text style={[styles.dateModalTitle, { color: theme.textPrimary }]}>{t('invoiceCustomRange', 'Custom Date & Time')}</Text>
              <Text style={[styles.dateFieldLabel, { color: theme.textSecondary }]}>{t('from', 'From')}</Text>
              <View style={styles.dateTimeRow}>
                <TextInput value={customStartDate} onChangeText={setCustomStartDate} placeholder="YYYY-MM-DD" placeholderTextColor={theme.textSecondary} style={[styles.dateInput, { color: theme.textPrimary, borderColor: theme.borderColor, backgroundColor: theme.bg }]} />
                <TextInput value={customStartTime} onChangeText={setCustomStartTime} placeholder="HH:MM" placeholderTextColor={theme.textSecondary} style={[styles.timeInput, { color: theme.textPrimary, borderColor: theme.borderColor, backgroundColor: theme.bg }]} />
              </View>
              <Text style={[styles.dateFieldLabel, { color: theme.textSecondary }]}>{t('to', 'To')}</Text>
              <View style={styles.dateTimeRow}>
                <TextInput value={customEndDate} onChangeText={setCustomEndDate} placeholder="YYYY-MM-DD" placeholderTextColor={theme.textSecondary} style={[styles.dateInput, { color: theme.textPrimary, borderColor: theme.borderColor, backgroundColor: theme.bg }]} />
                <TextInput value={customEndTime} onChangeText={setCustomEndTime} placeholder="HH:MM" placeholderTextColor={theme.textSecondary} style={[styles.timeInput, { color: theme.textPrimary, borderColor: theme.borderColor, backgroundColor: theme.bg }]} />
              </View>
              <Text style={[styles.dateHint, { color: theme.textSecondary }]}>{t('dateFormatHint', 'Use YYYY-MM-DD and 24h time HH:MM')}</Text>
              <View style={styles.dateModalActions}>
                <TouchableOpacity onPress={() => setShowDateModal(false)} style={[styles.dateModalBtn, { borderColor: theme.borderColor, borderWidth: 1 }]}>
                  <Text style={{ color: theme.textPrimary, fontWeight: '800' }}>{t('cancel', 'Cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    setDatePreset('custom');
                    setShowDateModal(false);
                  }}
                  style={[styles.dateModalBtn, { backgroundColor: BRAND_COLORS.blue600 }]}
                >
                  <Text style={{ color: '#FFF', fontWeight: '800' }}>{t('apply', 'Apply')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Sort menu */}
        <Modal visible={showSortMenu} transparent animationType="fade" onRequestClose={() => setShowSortMenu(false)}>
          <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setShowSortMenu(false)}>
            <View style={[styles.sortMenuCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
              <Text style={[styles.sortMenuTitle, { color: theme.textPrimary }]}>{t('sortBy', 'Sort by')}</Text>
              {(['newest', 'oldest', 'amount_high', 'amount_low'] as SortOption[]).map((opt) => (
                <TouchableOpacity
                  key={opt}
                  onPress={() => {
                    setSortBy(opt);
                    setShowSortMenu(false);
                  }}
                  style={[styles.sortOption, sortBy === opt && { backgroundColor: 'rgba(37,99,235,0.1)' }]}
                >
                  <Text style={{ color: sortBy === opt ? BRAND_COLORS.blue600 : theme.textPrimary, fontWeight: '800', fontSize: 13 }}>
                    {opt === 'newest'
                      ? t('sortNewest', 'Newest first')
                      : opt === 'oldest'
                        ? t('sortOldest', 'Oldest first')
                        : opt === 'amount_high'
                          ? t('sortAmountHigh', 'Highest amount')
                          : t('sortAmountLow', 'Lowest amount')}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </TouchableOpacity>
        </Modal>

        <DirectPrinterConnectModal
          visible={showPrinterModal}
          onClose={() => {
            setShowPrinterModal(false);
            setPendingPrintSale(null);
          }}
          onConnected={() => {
            if (pendingPrintSale) {
              const sale = pendingPrintSale;
              setPendingPrintSale(null);
              setShowPrinterModal(false);
              setTimeout(() => handlePrint(sale), 400);
            }
          }}
        />
      </View>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  mainWrapper: { flex: 1, paddingHorizontal: 16, paddingTop: 6 },
  list: { flex: 1 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  headerBadge: { fontSize: 10, fontWeight: '800', color: BRAND_COLORS.sky500, textTransform: 'uppercase', letterSpacing: 0.5 },
  headerTitle: { fontSize: 22, fontWeight: '900' },
  printerStatusChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10, borderWidth: 1, maxWidth: '52%' },
  printerStatusText: { fontSize: 11, fontWeight: '800', marginLeft: 4, flexShrink: 1 },
  searchBox: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 14, borderWidth: 1, marginBottom: 10 },
  searchInput: { flex: 1, fontSize: 13, marginLeft: 8 },
  filtersPanel: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    marginBottom: 12,
    gap: 8,
  },
  filterSectionLabel: { fontSize: 12, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.4 },
  filterSectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 },
  presetScroll: { flexGrow: 0, minHeight: 42 },
  presetRow: { gap: 8, paddingVertical: 2, paddingRight: 8 },
  presetChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    minHeight: 40,
  },
  presetChipText: { fontSize: 12, fontWeight: '800' },
  filterRow: { gap: 8, paddingVertical: 2, paddingRight: 8 },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    minHeight: 40,
    justifyContent: 'center',
  },
  filterChipText: { fontSize: 12, fontWeight: '800' },
  sortBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
  },
  sortBtnText: { fontSize: 11, fontWeight: '800' },
  customRangeHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  customRangeText: { fontSize: 12, fontWeight: '700', flex: 1 },
  invoiceCard: { borderRadius: 16, borderWidth: 1, marginBottom: 12, overflow: 'hidden' },
  invoiceMain: { flexDirection: 'row', alignItems: 'flex-start', padding: 14 },
  invoiceTopRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  invoiceNumber: { fontSize: 15, fontWeight: '900' },
  paymentBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, backgroundColor: 'rgba(37,99,235,0.1)' },
  paymentBadgeText: { fontSize: 9, fontWeight: '900', color: BRAND_COLORS.blue600, marginLeft: 3 },
  invoiceMeta: { fontSize: 11, marginTop: 4 },
  itemCount: { fontSize: 10, marginTop: 2 },
  invoiceAmount: { fontSize: 16, fontWeight: '900', marginLeft: 8 },
  actionRow: { flexDirection: 'row', borderTopWidth: 1, padding: 8, gap: 8 },
  rowActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    minHeight: 44,
  },
  viewBtn: { borderWidth: 1.5 },
  downloadBtn: { backgroundColor: BRAND_COLORS.blue600 },
  printBtn: { backgroundColor: BRAND_COLORS.navyInk },
  rowActionText: { fontSize: 12, fontWeight: '900' },
  rowActionTextLight: { color: '#FFFFFF' },
  emptyContainer: { paddingVertical: 60, alignItems: 'center' },
  emptyTitle: { fontSize: 16, fontWeight: '800', marginTop: 12 },
  emptySub: { fontSize: 12, textAlign: 'center', marginTop: 4, paddingHorizontal: 24 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  detailModalCard: { width: '100%', maxWidth: 440, borderRadius: 24, padding: 18, borderWidth: 1 },
  detailHeader: { flexDirection: 'row', alignItems: 'flex-start' },
  detailInvoice: { fontSize: 18, fontWeight: '900' },
  detailDate: { fontSize: 11, marginTop: 2 },
  closeBtn: { padding: 6, borderRadius: 10, borderWidth: 1 },
  detailItemRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 7, borderBottomWidth: 1 },
  detailItemName: { fontSize: 13, fontWeight: '700' },
  detailItemSub: { fontSize: 11, marginTop: 2 },
  detailItemTotal: { fontSize: 13, fontWeight: '800' },
  detailSummary: { borderRadius: 14, padding: 12, borderWidth: 1 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 2 },
  summaryLabel: { fontSize: 12, fontWeight: '600' },
  summaryVal: { fontSize: 12, fontWeight: '800' },
  grandRow: { marginTop: 4, paddingTop: 6, borderTopWidth: 1 },
  summaryGrandLabel: { fontSize: 13, fontWeight: '800' },
  summaryGrandVal: { fontSize: 15, fontWeight: '900' },
  detailActions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  detailActionBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 12, flexDirection: 'row', gap: 5 },
  detailActionBtnText: { color: '#FFF', fontSize: 12, fontWeight: '800' },
  dateModalCard: { width: '100%', maxWidth: 400, borderRadius: 20, padding: 18, borderWidth: 1 },
  dateModalTitle: { fontSize: 16, fontWeight: '900', marginBottom: 12 },
  dateFieldLabel: { fontSize: 11, fontWeight: '700', marginBottom: 4, marginTop: 6 },
  dateTimeRow: { flexDirection: 'row', gap: 8 },
  dateInput: { flex: 1.4, borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 10, fontSize: 13, fontWeight: '600' },
  timeInput: { flex: 0.8, borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 10, fontSize: 13, fontWeight: '600' },
  dateHint: { fontSize: 10, marginTop: 8 },
  dateModalActions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  dateModalBtn: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 12 },
  sortMenuCard: { width: '100%', maxWidth: 320, borderRadius: 16, padding: 12, borderWidth: 1 },
  sortMenuTitle: { fontSize: 14, fontWeight: '900', marginBottom: 8, paddingHorizontal: 4 },
  sortOption: { paddingVertical: 12, paddingHorizontal: 10, borderRadius: 10 },
});
