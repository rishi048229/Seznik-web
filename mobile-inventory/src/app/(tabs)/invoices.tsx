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
  TrendingUp,
  X,
  CreditCard,
  Banknote,
  QrCode,
  UserCheck,
  Printer,
  Download,
  Eye,
  Share2,
  Calendar,
  SlidersHorizontal,
  Bluetooth,
  RotateCcw,
  ArrowRightLeft,
} from 'lucide-react-native';
import { useSales } from '@/hooks/useSales';
import { Sale } from '@/types/sale';
import { useAppTheme } from '@/hooks/useAppTheme';
import { ScreenBackground } from '@/components/ui/ScreenBackground';
import { SalesListSkeleton } from '@/components/ui/ScreenSkeleton';
import { ScreenLoadingState, ScreenErrorState } from '@/components/ui/ScreenLoadingState';
import { A4InvoicePreviewModal } from '@/components/ui/A4InvoicePreviewModal';
import { ProcessReturnModal } from '@/components/sales/ProcessReturnModal';
import { ProcessExchangeModal } from '@/components/sales/ProcessExchangeModal';
import { BRAND_COLORS } from '@/constants/theme';
import { useTranslation } from '@/store/useLanguageStore';
import { useStoreProfile } from '@/hooks/useStoreProfile';
import { usePrinterStore } from '@/store/usePrinterStore';
import { useShallow } from 'zustand/react/shallow';
import { DirectPrinterConnectModal } from '@/components/printers/DirectPrinterConnectModal';
import { getTemplateById } from '@/constants/receiptTemplates';
import { parseGstBilling, gstPrintOptionOverrides } from '@/constants/gstBilling';
import {
  formatInvoiceDateTime,
  printInvoiceReceipt,
  downloadInvoicePdf,
  shareInvoicePdf,
} from '@/utils/invoiceActions';
import {
  DateRangePreset,
  formatDateInputValue,
  formatTimeInputValue,
  getDateRangeForPreset,
  parseDateTimeInput,
  saleInDateRange,
} from '@/utils/invoiceDateFilters';
import { sanitizeErrorMessage } from '@/utils/errorHandler';

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
  } = usePrinterStore(
    useShallow((s) => ({
    activeDevice: s.activeDevice,
    connectionState: s.connectionState,
    paperWidth: s.paperWidth,
    topMargin: s.topMargin,
    autoCut: s.autoCut,
    fontSize: s.fontSize,
    printCopies: s.printCopies,
    activeTemplateId: s.activeTemplateId,
    customTemplates: s.customTemplates,
    activeCustomTemplateId: s.activeCustomTemplateId,
    enableBillQrCode: s.enableBillQrCode,
    }))
  );
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

  const [previewSale, setPreviewSale] = useState<Sale | null>(null);
  const [showA4Preview, setShowA4Preview] = useState(false);
  const [returnSale, setReturnSale] = useState<Sale | null>(null);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [exchangeSale, setExchangeSale] = useState<Sale | null>(null);
  const [showExchangeModal, setShowExchangeModal] = useState(false);
  const [showPrinterModal, setShowPrinterModal] = useState(false);
  const [pendingPrintSale, setPendingPrintSale] = useState<Sale | null>(null);
  const [busySaleId, setBusySaleId] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<'print' | 'download' | 'share' | null>(null);

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
    `₹${Number(val || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

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

  const openA4Preview = useCallback((sale: Sale) => {
    setPreviewSale(sale);
    setShowA4Preview(true);
  }, []);

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
      Alert.alert(t('printError', 'Print Error'), sanitizeErrorMessage(err, 'Failed to print invoice. Please check printer connection.'));
    } finally {
      setBusySaleId(null);
      setBusyAction(null);
    }
  };

  const handleDownload = (sale: Sale) => {
    const template = getTemplateById(activeTemplateId);
    const customTemplate = customTemplates?.find((item) => item.id === activeCustomTemplateId) || null;
    openA4Preview(sale);
    downloadInvoicePdf(sale, storeProfile, { template, customTemplate }).catch(() => {});
  };

  const handleShare = async (sale: Sale) => {
    setBusySaleId(sale.id);
    setBusyAction('share');
    try {
      await shareInvoicePdf(sale, storeProfile, buildPrintOptions());
    } catch (err: any) {
      Alert.alert(
        t('shareFailed', 'Share Failed'),
        sanitizeErrorMessage(err, t('shareFailedHint', 'Could not share the A4 invoice PDF.'))
      );
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
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              <View style={[styles.pageLogo, { backgroundColor: 'rgba(37, 99, 235, 0.12)' }]}>
                <TrendingUp size={22} color={BRAND_COLORS.blue600} strokeWidth={2.4} />
              </View>
              <View style={{ marginLeft: 10 }}>
                <Text style={styles.headerBadge}>{t('salesRecords', 'Sales & Revenue')}</Text>
                <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>{t('sales', 'Sales')}</Text>
              </View>
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
            <Search size={18} color={theme.textSecondary} />
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
                    {/* Top Info Section: Invoice Number, Payment Badge, Customer & Amount */}
                    <TouchableOpacity
                      style={styles.invoiceCardHeader}
                      onPress={() => openA4Preview(item)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.invoiceHeaderTop}>
                        <View style={styles.invoiceHeaderLeft}>
                          <Text style={[styles.invoiceNumber, { color: theme.textPrimary }]} numberOfLines={1}>
                            {item.invoiceNumber}
                          </Text>
                          <View style={styles.paymentBadge}>
                            {getPaymentIcon(item.paymentMethod)}
                            <Text style={styles.paymentBadgeText}>{item.paymentMethod.toUpperCase()}</Text>
                          </View>
                          {item.returnStatus === 'full' && (
                            <View style={[styles.returnBadge, { backgroundColor: 'rgba(239, 68, 68, 0.12)' }]}>
                              <Text style={[styles.returnBadgeText, { color: '#EF4444' }]}>RETURNED</Text>
                            </View>
                          )}
                          {item.returnStatus === 'partial' && (
                            <View style={[styles.returnBadge, { backgroundColor: 'rgba(245, 158, 11, 0.12)' }]}>
                              <Text style={[styles.returnBadgeText, { color: '#F59E0B' }]}>PARTIAL</Text>
                            </View>
                          )}
                        </View>
                        <Text style={[styles.invoiceAmount, { color: BRAND_COLORS.blue600 }]}>
                          {formatCurrency(item.grandTotal)}
                        </Text>
                      </View>

                      <Text style={[styles.invoiceMeta, { color: theme.textSecondary }]} numberOfLines={1}>
                        {formatInvoiceDateTime(item.createdAt)}
                        {item.customerName ? ` · ${item.customerName}` : ''}
                        {` · ${item.items?.length || 0} items`}
                      </Text>
                    </TouchableOpacity>

                    {/* Bottom Actions Row Below */}
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={[styles.cardActionsRow, { borderTopColor: theme.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }]}
                    >
                      <TouchableOpacity
                        onPress={() => openA4Preview(item)}
                        style={[styles.cardActionBtn, { backgroundColor: theme.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)' }]}
                        accessibilityRole="button"
                        accessibilityLabel={t('view', 'View')}
                        activeOpacity={0.7}
                      >
                        <Eye size={15} color={theme.textPrimary} />
                        <Text style={[styles.cardActionBtnText, { color: theme.textPrimary }]}>
                          {t('preview', 'Preview')}
                        </Text>
                      </TouchableOpacity>

                      {item.returnStatus !== 'full' && (
                        <>
                          <TouchableOpacity
                            onPress={() => {
                              setExchangeSale(item);
                              setShowExchangeModal(true);
                            }}
                            style={[styles.cardActionBtn, { backgroundColor: 'rgba(2, 132, 199, 0.08)' }]}
                            accessibilityRole="button"
                            accessibilityLabel="Exchange"
                            activeOpacity={0.7}
                          >
                            <ArrowRightLeft size={14} color="#0284c7" />
                            <Text style={[styles.cardActionBtnText, { color: '#0284c7' }]}>
                              Exchange
                            </Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            onPress={() => {
                              setReturnSale(item);
                              setShowReturnModal(true);
                            }}
                            style={[styles.cardActionBtn, { backgroundColor: 'rgba(239, 68, 68, 0.08)' }]}
                            accessibilityRole="button"
                            accessibilityLabel="Return"
                            activeOpacity={0.7}
                          >
                            <RotateCcw size={14} color={BRAND_COLORS.rose500} />
                            <Text style={[styles.cardActionBtnText, { color: BRAND_COLORS.rose500 }]}>
                              Return
                            </Text>
                          </TouchableOpacity>
                        </>
                      )}

                      <TouchableOpacity
                        onPress={() => handleDownload(item)}
                        disabled={isBusy}
                        style={[styles.cardActionBtn, styles.downloadIconBtn]}
                        accessibilityRole="button"
                        accessibilityLabel={t('download', 'Download')}
                        activeOpacity={0.7}
                      >
                        {isBusy && busyAction === 'download' ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <>
                            <Download size={15} color="#FFFFFF" />
                            <Text style={[styles.cardActionBtnText, { color: '#FFFFFF' }]}>
                              {t('pdf', 'PDF')}
                            </Text>
                          </>
                        )}
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() => handleShare(item)}
                        disabled={isBusy}
                        style={[styles.cardActionBtn, styles.whatsappIconBtn]}
                        accessibilityRole="button"
                        accessibilityLabel={t('shareInvoice', 'Share invoice PDF')}
                        activeOpacity={0.7}
                      >
                        {isBusy && busyAction === 'share' ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <>
                            <Share2 size={15} color="#FFFFFF" />
                            <Text style={[styles.cardActionBtnText, { color: '#FFFFFF' }]}>
                              {t('share', 'Share')}
                            </Text>
                          </>
                        )}
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() => handlePrint(item)}
                        disabled={isBusy}
                        style={[styles.cardActionBtn, styles.printIconBtn]}
                        accessibilityRole="button"
                        accessibilityLabel={t('printInvoice', 'Print invoice receipt')}
                        activeOpacity={0.7}
                      >
                        {isBusy && busyAction === 'print' ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <>
                            <Printer size={15} color="#FFFFFF" />
                            <Text style={[styles.cardActionBtnText, { color: '#FFFFFF' }]}>
                              {t('print', 'Print')}
                            </Text>
                          </>
                        )}
                      </TouchableOpacity>
                    </ScrollView>
                  </View>
                );
              }}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <TrendingUp size={40} color={BRAND_COLORS.blue600} strokeWidth={2} />
                  <Text style={[styles.emptyTitle, { color: theme.textPrimary }]}>{t('noSales', 'No Sales Found')}</Text>
                  <Text style={[styles.emptySub, { color: theme.textSecondary }]}>
                    {t('noSalesHint', 'Try changing filters or complete a sale from POS.')}
                  </Text>
                </View>
              }
            />
          )}
        </View>

        <A4InvoicePreviewModal
          visible={showA4Preview}
          sale={previewSale}
          onClose={() => {
            setShowA4Preview(false);
            setPreviewSale(null);
          }}
        />

        <ProcessReturnModal
          visible={showReturnModal}
          sale={returnSale}
          onClose={() => {
            setShowReturnModal(false);
            setReturnSale(null);
          }}
          onSuccess={() => {
            refetch();
          }}
        />

        <ProcessExchangeModal
          visible={showExchangeModal}
          sale={exchangeSale}
          onClose={() => {
            setShowExchangeModal(false);
            setExchangeSale(null);
          }}
          onSuccess={() => {
            refetch();
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
  pageLogo: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBadge: { fontSize: 10, fontWeight: '800', color: BRAND_COLORS.sky500, textTransform: 'uppercase', letterSpacing: 0.5 },
  headerTitle: { fontSize: 22, fontWeight: '900' },
  printerStatusChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10, borderWidth: 1, maxWidth: '52%' },
  printerStatusText: { fontSize: 11, fontWeight: '800', marginLeft: 4, flexShrink: 1 },
  searchBox: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 11, borderRadius: 14, borderWidth: 1, marginBottom: 10 },
  searchInput: { flex: 1, fontSize: 15, marginLeft: 8 },
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
  invoiceCard: {
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
    overflow: 'hidden',
  },
  invoiceCardHeader: {
    padding: 14,
  },
  invoiceHeaderTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  invoiceHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    marginRight: 8,
  },
  invoiceNumber: {
    fontSize: 16,
    fontWeight: '900',
  },
  paymentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 7,
    backgroundColor: 'rgba(37,99,235,0.1)',
  },
  paymentBadgeText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: BRAND_COLORS.blue600,
    marginLeft: 3,
  },
  invoiceAmount: {
    fontSize: 16.5,
    fontWeight: '900',
  },
  invoiceMeta: {
    fontSize: 12,
    lineHeight: 16,
  },
  cardActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    padding: 8,
    gap: 6,
  },
  cardActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 10,
    gap: 5,
    minHeight: 34,
    flexShrink: 0,
  },
  cardActionBtnText: {
    fontSize: 11.5,
    fontWeight: '800',
  },
  returnBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 6,
  },
  returnBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
  },
  downloadIconBtn: { backgroundColor: BRAND_COLORS.blue600 },
  whatsappIconBtn: { backgroundColor: '#16A34A' },
  printIconBtn: { backgroundColor: BRAND_COLORS.navyInk },
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
