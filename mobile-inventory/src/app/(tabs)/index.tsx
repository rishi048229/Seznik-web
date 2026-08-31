import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Modal,
  Alert,
  StyleSheet,
  StatusBar,
  Linking,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Menu,
  TrendingUp,
  IndianRupee,
  AlertTriangle,
  ShoppingBag,
  PlusCircle,
  ArrowRight,
  Printer,
  Bluetooth,
  PowerOff,
  Users,
  PieChart,
  DollarSign,
  ChevronRight,
  Zap,
  X,
  Plus,
  Ticket,
  Settings as SettingsIcon,
  RefreshCw,
  Sparkles,
  Tag,
  Truck,
  BarChart3,
  Layers,
  Camera,
  Barcode,
  Wallet,
  CreditCard,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  PhoneCall,
  MessageCircle,
  Package,
  Calculator,
  Boxes,
  BookOpen,
  ChevronDown,
  ChevronUp,
  LayoutGrid,
  MessageSquarePlus,
  ChefHat,
  Store,
} from 'lucide-react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useDashboard, useRevenueTrend } from '@/hooks/useDashboard';
import { useAuth } from '@/hooks/useAuth';
import { useSettings } from '@/hooks/useSettings';
import { usePrinterStore } from '@/store/usePrinterStore';
import ThermalPrinterService from '@/services/PrinterService';
import { buildTestReceiptPrintOptions } from '@/utils/fastSaleCheckout';
import { useCartStore } from '@/store/useCartStore';
import { useCustomers } from '@/hooks/useCustomers';
import { productsApi } from '@/api/products';
import { productsQueryKey } from '@/services/prefetchAppData';
import { SidebarDrawer } from '@/components/ui/SidebarDrawer';
import { matchProductByCode } from '@/utils/productBarcodeMatch';
import { useAppTheme } from '@/hooks/useAppTheme';
import { ScreenBackground } from '@/components/ui/ScreenBackground';
import { AiProductImportModal } from '@/components/products/AiProductImportModal';
import { DirectPrinterConnectModal } from '@/components/printers/DirectPrinterConnectModal';
import { FeatureGridTile } from '@/components/ui/FeatureGridTile';
import { DashboardSkeleton } from '@/components/ui/ScreenSkeleton';
import { ScreenLoadingState, ScreenErrorState } from '@/components/ui/ScreenLoadingState';
import { BRAND_COLORS } from '@/constants/theme';
import type { Customer } from '@/types/customer';
import type { Product } from '@/types/product';
import { useTranslation } from '@/store/useLanguageStore';
import { RevenueTrendChart } from '@/components/dashboard/RevenueTrendChart';
import { isNavFeatureVisible } from '@/utils/businessFeatures';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { useNotificationStore } from '@/store/useNotificationStore';

export default function DashboardScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const { user, hasPermission } = useAuth();
  const { settings } = useSettings();
  const { t, currentLanguage } = useTranslation();
  const {
    stats,
    paymentModes,
    expenseSummary,
    topCustomers,
    isLoading,
    isRefetching,
    isError,
    refetch,
  } = useDashboard();
  const [timeframe, setTimeframe] = useState<'month' | 'daily' | 'monthly'>('month');
  const { trend, isLoading: isTrendLoading, refetch: refetchTrend } = useRevenueTrend(timeframe);
  const [isManualRefreshing, setIsManualRefreshing] = useState(false);

  // Automatically evaluate and notify low-stock items on dashboard data load
  useEffect(() => {
    if (stats?.lowStockProducts && stats.lowStockProducts.length > 0) {
      useNotificationStore.getState().evaluateStockConditions(stats.lowStockProducts).catch(() => {});
    }
  }, [stats?.lowStockProducts]);

  const handleManualRefresh = async () => {
    setIsManualRefreshing(true);
    try {
      await Promise.allSettled([
        refetch(),
        refetchTrend(),
        queryClient.invalidateQueries({ queryKey: ['products'] }),
        refetchCustomers(),
      ]);
    } finally {
      setIsManualRefreshing(false);
    }
  };

  const {
    connectionState,
    activeDevice,
    paperWidth,
    setPaperWidth,
  disconnectDevice,
  topMargin,
  autoCut,
  fontSize,
  printCopies,
  activeTemplateId,
  customTemplates,
  activeCustomTemplateId,
  enableBillQrCode,
} = usePrinterStore();
  const { customers, refetch: refetchCustomers } = useCustomers();
  const [permission, requestPermission] = useCameraPermissions();

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [showMoreTools, setShowMoreTools] = useState(false);
  const [restockingId, setRestockingId] = useState<string | null>(null);

  // Modals & Action States
  const [showAiImportModal, setShowAiImportModal] = useState(false);
  const [showDirectPrinterModal, setShowDirectPrinterModal] = useState(false);
  const [showScanModal, setShowScanModal] = useState(false);
  const [scanMode, setScanMode] = useState<'bill' | 'stock'>('bill');

  const showKot =
    isNavFeatureVisible(user?.businessType, 'kot') && hasPermission('canAccessKOT');
  const showTokens = isNavFeatureVisible(user?.businessType, 'tokens');
  const showCalculator = isNavFeatureVisible(user?.businessType, 'calculator');

  const theme = useAppTheme();

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(val || 0);
  };

  // Customers with pending credit balance
  const creditCustomers = (customers || []).filter((c: Customer) => (c.creditBalance || 0) > 0);
  const totalOutstandingCredit = creditCustomers.reduce((acc, c) => acc + (c.creditBalance || 0), 0);

  // Inventory valuation from server-side aggregate (no need to load full catalog on dashboard).
  const totalCatalogValue = stats.totalStockValue ?? 0;
  const totalSkuCount = stats.totalProductCount ?? 0;

  const handleBarcodeScanned = async ({ data }: { data: string }) => {
    setShowScanModal(false);
    if (!data) return;

    const raw = String(data).trim();
    const cachedProducts =
      user?.id ? queryClient.getQueryData<Product[]>(productsQueryKey(user.id)) || [] : [];

    let matched = matchProductByCode(cachedProducts, raw);

    if (!matched) {
      try {
        const remote = await productsApi.getProductByBarcode(raw);
        if (remote) {
          matched = remote;
        }
      } catch (err) {
        // Not in backend
      }
    }

    if (scanMode === 'bill') {
      if (matched) {
        router.push(`/(tabs)/pos?barcode=${encodeURIComponent(raw)}` as any);
      } else {
        Alert.alert(
          'Product Not Found',
          `Barcode "${raw}" is not in catalog. Would you like to create this product or add to Quick Bill?`,
          [
            { text: 'Quick Bill', onPress: () => router.push('/quick-bill' as any) },
            { text: 'Add to Inventory', onPress: () => router.push('/products' as any) },
          ]
        );
      }
    } else {
      // Stock Mode
      if (matched) {
        Alert.prompt(
          `Stock Update: ${matched.name}`,
          `Current Stock: ${matched.currentStock} ${matched.unit || 'units'}. Enter quantity to add:`,
          async (qtyText) => {
            const addQty = parseInt(qtyText || '0');
            if (addQty > 0) {
              await productsApi.updateProduct(matched!.id, { currentStock: matched!.currentStock + addQty });
              queryClient.invalidateQueries({ queryKey: ['products'] });
              Alert.alert('Stock Updated', `Added +${addQty} units to ${matched!.name}. New Stock: ${matched!.currentStock + addQty}`);
            }
          },
          'plain-text',
          '10',
          'number-pad'
        );
      } else {
        Alert.alert('Product Not Found', `No catalog item matches barcode ${raw}.`);
      }
    }
  };

  const handleSendWhatsAppReminder = async (customer: Customer) => {
    if (!customer.phone) {
      Alert.alert('Missing Phone Number', `No mobile number is registered for ${customer.name}.`);
      return;
    }
    const cleanPhone = customer.phone.replace(/[^0-9]/g, '');
    const targetPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
    const storeName = settings?.businessName || 'Our Store';
    const upiId = settings?.upiId ? `\n\n💳 Pay via UPI: ${settings.upiId}` : '';
    const text = `Namaste ${customer.name} ji,\n\nThis is a polite reminder from *${storeName}* regarding your pending store credit balance of *₹${customer.creditBalance.toFixed(2)}*.${upiId}\n\nKindly settle the dues at your earliest convenience. Thank you! 🙏`;
    
    const url = `whatsapp://send?phone=${targetPhone}&text=${encodeURIComponent(text)}`;
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
      } else {
        await Linking.openURL(`https://wa.me/${targetPhone}?text=${encodeURIComponent(text)}`);
      }
    } catch {
      await Linking.openURL(`https://wa.me/${targetPhone}?text=${encodeURIComponent(text)}`);
    }
  };

  // Narrowed from `Product` to just the fields it actually touches, so the
  // dashboard's low-stock items (which are a slimmer shape) can use it too.
  const handleQuickRestock = async (
    product: { id: string; name: string; currentStock: number; unit?: string },
    delta = 10
  ) => {
    setRestockingId(product.id);
    try {
      const newStock = Math.max(0, (product.currentStock || 0) + delta);
      await productsApi.updateProduct(product.id, { currentStock: newStock });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      // The dashboard's own low-stock list comes from the reports query, so it
      // has to be refreshed too or the restocked row lingers until next reload.
      queryClient.invalidateQueries({ queryKey: ['reports', 'dashboard'] });
      Alert.alert('Restock Successful! 📦', `Added +${delta} ${product.unit || 'units'} to ${product.name}.\nNew In-Stock: ${newStock}`);
    } catch (err: any) {
      Alert.alert('Stock Update Failed', err?.message || 'Could not update stock.');
    } finally {
      setRestockingId(null);
    }
  };

  const handleDisconnectPrinter = () => {
    Alert.alert(
      t('disconnectPrinter', 'Disconnect Printer'),
      `${activeDevice?.name || t('thermalPrinter', 'Thermal POS Printer')} ${t('disconnectPrinterBody', 'will be unlinked. Receipts cannot print until you connect again.')}`,
      [
        { text: t('cancel', 'Cancel'), style: 'cancel' },
        {
          text: t('disconnect', 'Disconnect'),
          style: 'destructive',
          onPress: async () => {
            try {
              await disconnectDevice();
            } catch (e: any) {
              Alert.alert(t('printerError', 'Printer Error'), e?.message || 'Could not disconnect the printer.');
            }
          },
        },
      ]
    );
  };

  const handleTestPrint = async () => {
    if (connectionState !== 'connected') {
      setShowDirectPrinterModal(true);
      return;
    }
    try {
      await ThermalPrinterService.printTestReceipt(
        paperWidth,
        buildTestReceiptPrintOptions({
          activeTemplateId,
          customTemplates,
          activeCustomTemplateId,
          enableBillQrCode,
          topMargin,
          autoCut,
          fontSize,
          settings,
          copies: 1,
        })
      );
      Alert.alert('Test Receipt Sent! 🖨️', 'Diagnostic print job sent to your thermal printer.');
    } catch (err: any) {
      Alert.alert('Print Error', err?.message || 'Failed to print test receipt.');
    }
  };

  const grossProfitMargin = stats.todayRevenue > 0 ? Math.round((stats.todayGrossProfit / stats.todayRevenue) * 100) : 0;

  return (
    <ScreenBackground color={theme.bg}>
      <View style={[styles.container, { backgroundColor: 'transparent', paddingTop: insets.top || 12 }]}>
        <StatusBar barStyle={theme.isDark ? 'light-content' : 'dark-content'} backgroundColor={theme.bg} />

        {/* 1. STORE EXECUTIVE HEADER & SMART QUICK BAR */}
        <View style={[styles.headerBar, { borderBottomColor: theme.borderColor }]}>
          <View style={styles.headerLeft}>
            <TouchableOpacity
              onPress={() => setIsDrawerOpen(true)}
              style={[styles.menuBtn, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}
            >
              <Menu size={20} color={theme.textPrimary} />
            </TouchableOpacity>

            <View style={{ marginLeft: 12 }}>
              <Text style={styles.storeTag}>{settings?.businessName || user?.displayName || 'Seznik Store Admin'}</Text>
              <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>{t('dashboard', 'Dashboard')}</Text>
            </View>
          </View>

          {/* Quick Header Actions Strip */}
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <NotificationBell style={{ marginRight: 6 }} />

            <TouchableOpacity
              onPress={() => {
                if (!permission?.granted) requestPermission();
                setScanMode('bill');
                setShowScanModal(true);
              }}
              style={[styles.headerPillBtn, { backgroundColor: 'rgba(2, 132, 199, 0.15)', marginRight: 6 }]}
            >
              <Camera size={14} color={BRAND_COLORS.sky500} />
            </TouchableOpacity>

            <TouchableOpacity onPress={() => router.push('/quick-bill' as any)} style={styles.billNowBtn}>
              <Zap size={14} color="#FFFFFF" />
              <Text style={styles.billNowText}>{t('billNow', 'Bill Now')}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={isManualRefreshing}
              onRefresh={handleManualRefresh}
              tintColor={BRAND_COLORS.sky500}
              colors={[BRAND_COLORS.sky500]}
            />
          }
        >
          {isLoading ? (
            <ScreenLoadingState
              message={t('loadingDashboard', 'Loading dashboard...')}
              hint={t('loadingDashboardHint', 'Fetching today’s sales, stock alerts, and store metrics')}
              skeleton={<DashboardSkeleton />}
            />
          ) : isError ? (
            <ScreenErrorState
              message={t('dashboardLoadFailed', "Couldn't load the dashboard")}
              hint={t('dashboardLoadFailedHint', 'Check your connection to the server and try again.')}
              onRetry={refetch}
              isRetrying={isRefetching}
            />
          ) : (
            <>
              {/* 2. APP LAUNCHER — Primary 4 Tools with Show More Menu */}
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionHeader}>{t('quickAccess', 'QUICK ACCESS')}</Text>
                <TouchableOpacity
                  onPress={() => setShowMoreTools((prev) => !prev)}
                  style={styles.toggleHeaderBtn}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.toggleHeaderText, { color: BRAND_COLORS.sky500 }]}>
                    {showMoreTools ? t('showLessOptions', 'Show Less') : t('showMoreOptions', 'Show More')}
                  </Text>
                  {showMoreTools ? (
                    <ChevronUp size={14} color={BRAND_COLORS.sky500} style={{ marginLeft: 2 }} />
                  ) : (
                    <ChevronDown size={14} color={BRAND_COLORS.sky500} style={{ marginLeft: 2 }} />
                  )}
                </TouchableOpacity>
              </View>

              {/* Primary 4 Actions + Expandable Grid */}
              <View style={styles.compactGridRow}>
                {showKot ? (
                  <>
                    <FeatureGridTile
                      label={t('kotOrders', 'KOT Orders')}
                      badge="NEW"
                      icon={ChefHat}
                      color="#F97316"
                      onPress={() => router.push('/kot' as any)}
                      theme={theme}
                    />
                    <FeatureGridTile
                      label={t('restaurantTables', 'Tables')}
                      icon={LayoutGrid}
                      color="#7C3AED"
                      onPress={() => router.push('/kot/tables' as any)}
                      theme={theme}
                    />
                    <FeatureGridTile
                      label={t('dayBook', 'Day Book')}
                      icon={BookOpen}
                      color="#10B981"
                      onPress={() => router.push('/credits' as any)}
                      theme={theme}
                    />
                    <FeatureGridTile
                      label={t('invoices', 'Invoices')}
                      icon={IndianRupee}
                      color="#0284C7"
                      onPress={() => router.push('/(tabs)/invoices' as any)}
                      theme={theme}
                    />
                  </>
                ) : (
                  <>
                    <FeatureGridTile
                      label={t('dayBook', 'Day Book')}
                      icon={BookOpen}
                      color="#10B981"
                      onPress={() => router.push('/credits' as any)}
                      theme={theme}
                    />
                    <FeatureGridTile
                      label={t('invoices', 'Invoices')}
                      icon={IndianRupee}
                      color="#0284C7"
                      onPress={() => router.push('/(tabs)/invoices' as any)}
                      theme={theme}
                    />
                    <FeatureGridTile
                      label={t('scanStock', 'Scan Stock')}
                      icon={Barcode}
                      color={BRAND_COLORS.sky500}
                      onPress={() => {
                        if (!permission?.granted) requestPermission();
                        setScanMode('stock');
                        setShowScanModal(true);
                      }}
                      theme={theme}
                    />
                    <FeatureGridTile
                      label={t('stores', 'Stores')}
                      badge="NEW"
                      icon={Store}
                      color="#2563EB"
                      onPress={() => router.push('/stores' as any)}
                      theme={theme}
                    />
                  </>
                )}

                {/* Hidden tools revealed on Show More */}
                {showMoreTools && (
                  <>
                    {showKot ? (
                      <FeatureGridTile
                        label={t('scanStock', 'Scan Stock')}
                        icon={Barcode}
                        color={BRAND_COLORS.sky500}
                        onPress={() => {
                          if (!permission?.granted) requestPermission();
                          setScanMode('stock');
                          setShowScanModal(true);
                        }}
                        theme={theme}
                      />
                    ) : null}
                    <FeatureGridTile
                      label={t('aiImport', 'AI Import')}
                      badge="AI"
                      icon={Sparkles}
                      color="#8B5CF6"
                      onPress={() => setShowAiImportModal(true)}
                      theme={theme}
                    />
                    <FeatureGridTile
                      label={t('reports', 'Reports')}
                      icon={BarChart3}
                      color="#8B5CF6"
                      onPress={() => router.push('/reports' as any)}
                      theme={theme}
                    />
                    <FeatureGridTile
                      label={t('labelStudio', 'Label Studio')}
                      badge="NEW"
                      icon={Tag}
                      color="#10B981"
                      onPress={() => router.push('/printers/label-studio' as any)}
                      theme={theme}
                    />
                    <FeatureGridTile
                      label={t('customers', 'Customers')}
                      icon={Users}
                      color="#F59E0B"
                      onPress={() => router.push('/customers' as any)}
                      theme={theme}
                    />
                    <FeatureGridTile
                      label={t('suppliers', 'Suppliers')}
                      icon={Truck}
                      color="#14B8A6"
                      onPress={() => router.push('/suppliers' as any)}
                      theme={theme}
                    />
                    {showKot ? (
                      <FeatureGridTile
                        label={t('stores', 'Stores')}
                        badge="NEW"
                        icon={Store}
                        color="#2563EB"
                        onPress={() => router.push('/stores' as any)}
                        theme={theme}
                      />
                    ) : null}
                    <FeatureGridTile
                      label={t('thermalPrinter', 'Thermal Printer')}
                      icon={Printer}
                      color={BRAND_COLORS.blue600}
                      onPress={() => setShowDirectPrinterModal(true)}
                      theme={theme}
                    />
                    <FeatureGridTile
                      label={t('expenses', 'Expenses')}
                      icon={Wallet}
                      color="#EC4899"
                      onPress={() => router.push('/expenses' as any)}
                      theme={theme}
                    />
                    <FeatureGridTile
                      label={t('purchases', 'Purchases')}
                      icon={ShoppingBag}
                      color="#14B8A6"
                      onPress={() => router.push('/purchases' as any)}
                      theme={theme}
                    />
                    {showTokens ? (
                      <FeatureGridTile
                        label={t('quickTokens', 'Quick Tokens')}
                        icon={Ticket}
                        color="#F59E0B"
                        onPress={() => router.push('/quick-tokens' as any)}
                        theme={theme}
                      />
                    ) : null}
                    {showCalculator ? (
                      <FeatureGridTile
                        label={t('calculator', 'Calculator')}
                        badge="NEW"
                        icon={Calculator}
                        color="#6366F1"
                        onPress={() => router.push('/(tabs)/calculator' as any)}
                        theme={theme}
                      />
                    ) : null}
                    <FeatureGridTile
                      label={t('settings', 'Settings')}
                      icon={SettingsIcon}
                      color={theme.textSecondary}
                      onPress={() => router.push('/settings' as any)}
                      theme={theme}
                    />
                    <FeatureGridTile
                      label={t('feedback', 'Feedback')}
                      icon={MessageSquarePlus}
                      color="#0284C7"
                      onPress={() => router.push('/feedback' as any)}
                      theme={theme}
                    />
                  </>
                )}
              </View>

              {/* Show More / Show Less Toggle Button */}
              <TouchableOpacity
                onPress={() => setShowMoreTools((prev) => !prev)}
                style={[
                  styles.showMoreBtn,
                  {
                    backgroundColor: theme.cardBg,
                    borderColor: theme.borderColor,
                  },
                ]}
                activeOpacity={0.7}
              >
                <LayoutGrid size={14} color={BRAND_COLORS.sky500} style={{ marginRight: 6 }} />
                <Text style={[styles.showMoreBtnText, { color: theme.textPrimary }]}>
                  {showMoreTools ? t('showLessOptions', 'Show Less Options') : t('showMoreOptions', 'Show More Options (14)')}
                </Text>
                {showMoreTools ? (
                  <ChevronUp size={14} color={theme.textSecondary} style={{ marginLeft: 4 }} />
                ) : (
                  <ChevronDown size={14} color={theme.textSecondary} style={{ marginLeft: 4 }} />
                )}
              </TouchableOpacity>

              {/* 2.5 LIVE THERMAL & BLUETOOTH PRINTER HARDWARE STATUS CARD */}
              <View style={[styles.printerCard, { backgroundColor: theme.cardBg, borderColor: connectionState === 'connected' ? '#10B981' : theme.borderColor }]}>
                <View style={styles.printerCardHeader}>
                  <View style={[styles.printerIconBadge, { backgroundColor: connectionState === 'connected' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(100, 116, 139, 0.15)' }]}>
                    <Printer size={18} color={connectionState === 'connected' ? '#10B981' : '#64748B'} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 10, marginRight: 8 }}>
                    <Text style={[styles.printerCardTitle, { color: theme.textPrimary }]} numberOfLines={1}>
                      {t('thermalPrinter', 'Thermal POS Printer')}
                    </Text>
                  </View>
                  <View style={[styles.statusPill, { backgroundColor: connectionState === 'connected' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)' }]}>
                    <View style={[styles.statusDot, { backgroundColor: connectionState === 'connected' ? '#10B981' : '#EF4444' }]} />
                    <Text style={[styles.statusPillText, { color: connectionState === 'connected' ? '#10B981' : '#EF4444' }]}>
                      {connectionState === 'connected' ? (activeDevice?.name || t('connected', 'Connected')) : t('disconnected', 'Disconnected')}
                    </Text>
                  </View>
                </View>

                <Text style={[styles.printerCardSub, { color: theme.textSecondary }]}>
                  {connectionState === 'connected' 
                    ? `${activeDevice?.name || 'Bluetooth/USB'} • ${paperWidth} ${t('printerReady', 'Paper Ready')}` 
                    : t('noBluetoothFound', 'No Bluetooth device linked. Tap Scan & Connect to link receipt printer.')}
                </Text>

                {/* Action Buttons: Connect, paper width, then test/disconnect when linked */}
                <View style={styles.printerActionsWrap}>
                  <View style={styles.printerPrimaryRow}>
                    <TouchableOpacity
                      style={[styles.printerConnectBtn, { backgroundColor: connectionState === 'connected' ? BRAND_COLORS.blue600 : '#10B981' }]}
                      onPress={() => setShowDirectPrinterModal(true)}
                      activeOpacity={0.8}
                    >
                      <Bluetooth size={14} color="#FFF" style={styles.printerConnectBtnIcon} />
                      <Text style={styles.printerConnectBtnText} numberOfLines={1}>
                        {connectionState === 'connected' ? t('changeReconnect', 'Change / Reconnect') : t('scanAndConnect', 'Scan & Connect')}
                      </Text>
                    </TouchableOpacity>

                    <View style={[styles.paperToggleContainer, { borderColor: theme.borderColor, backgroundColor: theme.isDark ? '#1E293B' : '#F1F5F9' }]}>
                      <TouchableOpacity
                        style={[styles.paperToggleBtn, paperWidth === '58mm' && styles.paperToggleActive]}
                        onPress={() => setPaperWidth('58mm')}
                      >
                        <Text style={[styles.paperToggleText, paperWidth === '58mm' ? styles.paperToggleTextActive : { color: theme.textSecondary }]}>58mm</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.paperToggleBtn, paperWidth === '80mm' && styles.paperToggleActive]}
                        onPress={() => setPaperWidth('80mm')}
                      >
                        <Text style={[styles.paperToggleText, paperWidth === '80mm' ? styles.paperToggleTextActive : { color: theme.textSecondary }]}>80mm</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {connectionState === 'connected' ? (
                    <View style={styles.printerSecondaryRow}>
                      <TouchableOpacity
                        style={[styles.printerTestBtn, { borderColor: theme.borderColor, backgroundColor: theme.cardBg }]}
                        onPress={handleTestPrint}
                        activeOpacity={0.8}
                      >
                        <Zap size={14} color={BRAND_COLORS.sky500} style={styles.printerSecondaryBtnIcon} />
                        <Text style={[styles.printerTestBtnText, { color: theme.textPrimary }]} numberOfLines={1}>
                          {t('testPrint', 'Test Print')}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.printerDisconnectBtn, { borderColor: 'rgba(239, 68, 68, 0.35)', backgroundColor: 'rgba(239, 68, 68, 0.12)' }]}
                        onPress={handleDisconnectPrinter}
                        activeOpacity={0.8}
                      >
                        <PowerOff size={14} color="#EF4444" style={styles.printerSecondaryBtnIcon} />
                        <Text style={styles.printerDisconnectBtnText} numberOfLines={1}>
                          {t('disconnect', 'Disconnect')}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  ) : null}
                </View>
              </View>

              {/* 2.6 LIVE BUSINESS SPENDING & OUTFLOW CARD */}
              <View style={[styles.expenseCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
                <View style={styles.expenseCardHeader}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                    <View style={[styles.expenseIconBadge, { backgroundColor: 'rgba(236, 72, 153, 0.12)' }]}>
                      <Wallet size={18} color="#EC4899" />
                    </View>
                    <View style={{ marginLeft: 10, flex: 1 }}>
                      <Text style={[styles.expenseCardTitle, { color: theme.textPrimary }]}>
                        {t('expenses', 'Business Spending & Outflow')}
                      </Text>
                      <Text style={[styles.expenseCardSub, { color: theme.textSecondary }]}>
                        {t('spendingTracker', 'Live cash outflow & net daily balance')}
                      </Text>
                    </View>
                  </View>

                  <TouchableOpacity
                    onPress={() => router.push('/expenses' as any)}
                    style={[styles.addExpenseQuickBtn, { backgroundColor: '#EC4899' }]}
                    activeOpacity={0.8}
                  >
                    <Plus size={13} color="#FFF" />
                    <Text style={styles.addExpenseQuickBtnText}>{t('addExpense', '+ Expense')}</Text>
                  </TouchableOpacity>
                </View>

                <View style={[styles.expenseStatsRow, { backgroundColor: theme.bg, borderColor: theme.borderColor }]}>
                  <View style={styles.expenseStatCol}>
                    <Text style={[styles.expenseStatLabel, { color: theme.textSecondary }]}>{t('today', "Today's Outflow")}</Text>
                    <Text style={[styles.expenseStatVal, { color: '#EF4444' }]}>
                      {formatCurrency(expenseSummary.today)}
                    </Text>
                  </View>

                  <View style={[styles.expenseStatDivider, { backgroundColor: theme.borderColor }]} />

                  <View style={styles.expenseStatCol}>
                    <Text style={[styles.expenseStatLabel, { color: theme.textSecondary }]}>{t('thisMonth', 'This Month')}</Text>
                    <Text style={[styles.expenseStatVal, { color: theme.textPrimary }]}>
                      {formatCurrency(expenseSummary.thisMonth)}
                    </Text>
                  </View>

                  <View style={[styles.expenseStatDivider, { backgroundColor: theme.borderColor }]} />

                  <View style={styles.expenseStatCol}>
                    <Text style={[styles.expenseStatLabel, { color: theme.textSecondary }]}>{t('netCashflow', 'Net Flow')}</Text>
                    <Text style={[styles.expenseStatVal, { color: expenseSummary.net >= 0 ? '#10B981' : '#EF4444' }]}>
                      {formatCurrency(expenseSummary.net)}
                    </Text>
                  </View>
                </View>
              </View>

              {/* 3. EXECUTIVE METRICS STRIP */}
              <Text style={styles.sectionHeader}>{t('todayPerformance', "TODAY'S PERFORMANCE & P&L")}</Text>
              <View style={styles.kpiGrid}>
                {/* Revenue */}
                <View style={[styles.kpiCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text style={[styles.kpiLabel, { color: theme.textSecondary }]}>{t('todayRevenue', "Today's Revenue")}</Text>
                    <View style={[styles.kpiIconCircle, { backgroundColor: 'rgba(37, 99, 235, 0.15)' }]}>
                      <TrendingUp size={16} color={BRAND_COLORS.blue600} />
                    </View>
                  </View>
                  <Text style={[styles.kpiValue, { color: theme.textPrimary }]}>{formatCurrency(stats.todayRevenue)}</Text>
                  <Text style={[styles.kpiSub, { color: theme.textSecondary }]}>{stats.todayInvoices} {t('invoicesToday', 'Invoices Today')}</Text>
                </View>

                {/* Net Profit */}
                <View style={[styles.kpiCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text style={[styles.kpiLabel, { color: theme.textSecondary }]}>{t('grossMargin', 'Net Profit (P&L)')}</Text>
                    <View style={[styles.kpiIconCircle, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
                      <DollarSign size={16} color="#10B981" />
                    </View>
                  </View>
                  <Text style={[styles.kpiValue, { color: '#10B981' }]}>{formatCurrency(stats.todayGrossProfit)}</Text>
                  <Text style={[styles.kpiSub, { color: theme.textSecondary }]}>{grossProfitMargin}% {t('grossMargin', 'Margin Today')}</Text>
                </View>

                {/* Invoices */}
                <View style={[styles.kpiCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text style={[styles.kpiLabel, { color: theme.textSecondary }]}>{t('invoicesToday', 'Invoices Count')}</Text>
                    <View style={[styles.kpiIconCircle, { backgroundColor: 'rgba(2, 132, 199, 0.15)' }]}>
                      <IndianRupee size={16} color={BRAND_COLORS.sky500} />
                    </View>
                  </View>
                  <Text style={[styles.kpiValue, { color: theme.textPrimary }]}>{stats.todayInvoices}</Text>
                  <Text style={[styles.kpiSub, { color: theme.textSecondary }]}>{t('completedBills', 'Completed Bills')}</Text>
                </View>

                {/* Catalog Asset Valuation */}
                <TouchableOpacity
                  onPress={() => router.push('/products' as any)}
                  style={[styles.kpiCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text style={[styles.kpiLabel, { color: theme.textSecondary }]}>{t('inventoryAsset', 'Inventory Asset')}</Text>
                    <View style={[styles.kpiIconCircle, { backgroundColor: 'rgba(139, 92, 246, 0.15)' }]}>
                      <Boxes size={16} color="#8B5CF6" />
                    </View>
                  </View>
                  <Text style={[styles.kpiValue, { color: '#8B5CF6' }]}>{formatCurrency(totalCatalogValue)}</Text>
                  <Text style={[styles.kpiSub, { color: theme.textSecondary }]}>{totalSkuCount} SKUs Listed ➔</Text>
                </TouchableOpacity>
              </View>

              {/* 7. PAYMENT MODES & EXPENSES SUMMARY */}
              <Text style={styles.sectionHeader}>{t('paymentModesTitle', 'PAYMENT MODES & EXPENSES OUTFLOW')}</Text>
              <View style={styles.dualSectionRow}>
                {/* Payment Modes Breakdown */}
                <TouchableOpacity
                  onPress={() => router.push('/reports' as any)}
                  style={[styles.halfCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}
                  activeOpacity={0.7}
                >
                  <View style={styles.cardHeaderRow}>
                    <Text style={[styles.cardTitle, { color: theme.textPrimary }]} numberOfLines={1}>
                      {t('payments', 'Payments')}
                    </Text>
                    <View style={[styles.miniIconCircle, { backgroundColor: theme.isDark ? 'rgba(56, 189, 248, 0.2)' : 'rgba(2, 132, 199, 0.12)' }]}>
                      <PieChart size={17} color={theme.isDark ? '#38BDF8' : BRAND_COLORS.blue600} />
                    </View>
                  </View>

                  <View style={styles.halfCardBody}>
                    {paymentModes.length === 0 ? (
                      <View style={{ flex: 1, justifyContent: 'center' }}>
                        <Text style={{ fontSize: 11, color: theme.textSecondary }}>{t('noSalesToday', 'No sales recorded yet')}</Text>
                      </View>
                    ) : (
                      paymentModes.slice(0, 3).map((mode) => (
                        <View key={mode.method} style={{ marginBottom: 6 }}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Text style={{ fontSize: 11, fontWeight: '700', color: theme.textPrimary, textTransform: 'capitalize' }}>
                              {mode.method}
                            </Text>
                            <Text style={{ fontSize: 11, fontWeight: '800', color: theme.textSecondary }}>
                              ₹{mode.amount.toFixed(0)} ({mode.percent}%)
                            </Text>
                          </View>
                          <View style={styles.progressBarBg}>
                            <View style={[styles.progressBarFill, { width: `${Math.min(100, mode.percent)}%`, backgroundColor: BRAND_COLORS.blue600 }]} />
                          </View>
                        </View>
                      ))
                    )}
                  </View>
                </TouchableOpacity>

                {/* Expense Summary */}
                <TouchableOpacity
                  onPress={() => router.push('/expenses' as any)}
                  style={[styles.halfCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}
                  activeOpacity={0.7}
                >
                  <View style={styles.cardHeaderRow}>
                    <Text style={[styles.cardTitle, { color: theme.textPrimary }]} numberOfLines={1}>
                      {t('expenses', 'Expenses')}
                    </Text>
                    <View style={[styles.miniIconCircle, { backgroundColor: theme.isDark ? 'rgba(244, 114, 182, 0.2)' : 'rgba(236, 72, 153, 0.12)' }]}>
                      <Wallet size={17} color={theme.isDark ? '#F472B6' : '#EC4899'} />
                    </View>
                  </View>

                  <View style={styles.halfCardBody}>
                    <View style={{ flex: 1, justifyContent: 'center' }}>
                      <Text style={{ fontSize: 11, color: theme.textSecondary }}>Today&apos;s Outflow</Text>
                      <Text style={{ fontSize: 18, fontWeight: '900', color: '#EC4899', marginVertical: 2 }}>
                        ₹{expenseSummary.today.toFixed(2)}
                      </Text>
                    </View>
                    <Text style={{ fontSize: 10, color: theme.textSecondary, marginTop: 4 }}>
                      This Month: ₹{expenseSummary.thisMonth.toFixed(0)} ➔
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>

              {/* 7.5 LOW STOCK / REORDER CARD
                  Replaced a third expense card that repeated the same today/this-month
                  figures already shown in the Business Spending card above. Reorder is
                  the thing a shop owner actually acts on daily, and the data was already
                  being fetched by the dashboard query without ever being displayed. */}
              <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: stats.lowStockCount > 0 ? '#F59E0B' : theme.borderColor, marginBottom: 16 }]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 10 }}>
                    <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: stats.lowStockCount > 0 ? 'rgba(245, 158, 11, 0.15)' : 'rgba(16, 185, 129, 0.15)', alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
                      {stats.lowStockCount > 0 ? (
                        <AlertTriangle size={18} color="#F59E0B" />
                      ) : (
                        <CheckCircle2 size={18} color="#10B981" />
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.cardTitle, { color: theme.textPrimary }]} numberOfLines={1}>
                        {t('lowStockTitle', 'Running Low — Reorder')}
                      </Text>
                      <Text style={{ fontSize: 11, color: theme.textSecondary }} numberOfLines={1}>
                        {stats.lowStockCount > 0
                          ? `${stats.lowStockCount} ${t('itemsNeedRestock', 'item(s) need restocking')}`
                          : t('allStocked', 'Everything is well stocked')}
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    onPress={() => router.push('/(tabs)/products' as any)}
                    style={{ backgroundColor: 'rgba(245, 158, 11, 0.12)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, flexDirection: 'row', alignItems: 'center' }}
                  >
                    <Package size={13} color="#F59E0B" style={{ marginRight: 4 }} />
                    <Text style={{ fontSize: 11, fontWeight: '800', color: '#F59E0B' }} numberOfLines={1}>
                      {t('viewStock', 'Stock')}
                    </Text>
                  </TouchableOpacity>
                </View>

                {stats.lowStockProducts.length === 0 ? (
                  <Text style={{ fontSize: 11.5, color: theme.textSecondary, paddingVertical: 10 }}>
                    {t('noLowStock', 'No items below their reorder level right now.')}
                  </Text>
                ) : (
                  stats.lowStockProducts.slice(0, 4).map((item) => {
                    const isOut = item.currentStock <= 0;
                    return (
                      <TouchableOpacity
                        key={item.id}
                        onPress={() => router.push('/(tabs)/products' as any)}
                        activeOpacity={0.7}
                        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: theme.borderColor }}
                      >
                        <View style={{ flex: 1, marginRight: 10 }}>
                          <Text style={{ fontSize: 12.5, fontWeight: '700', color: theme.textPrimary }} numberOfLines={1}>
                            {item.name}
                          </Text>
                          <Text style={{ fontSize: 10.5, color: theme.textSecondary, marginTop: 2 }} numberOfLines={1}>
                            {t('reorderAt', 'Reorder at')} {item.threshold}
                          </Text>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <View style={{ backgroundColor: isOut ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, minWidth: 62, alignItems: 'center' }}>
                            <Text style={{ fontSize: 11.5, fontWeight: '900', color: isOut ? '#EF4444' : '#F59E0B' }} numberOfLines={1}>
                              {isOut ? t('outOfStock', 'Out') : `${item.currentStock} ${t('left', 'left')}`}
                            </Text>
                          </View>

                          {/* Restock without leaving the dashboard — the common case is
                              topping up a handful of items after a delivery. */}
                          <TouchableOpacity
                            onPress={() => handleQuickRestock(item)}
                            disabled={restockingId === item.id}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            style={{ backgroundColor: BRAND_COLORS.blue600, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, minWidth: 44, alignItems: 'center', opacity: restockingId === item.id ? 0.6 : 1 }}
                          >
                            {restockingId === item.id ? (
                              <ActivityIndicator size="small" color="#FFF" />
                            ) : (
                              <Text style={{ fontSize: 11, fontWeight: '900', color: '#FFF' }}>+10</Text>
                            )}
                          </TouchableOpacity>
                        </View>
                      </TouchableOpacity>
                    );
                  })
                )}

                {stats.lowStockCount > 4 ? (
                  <TouchableOpacity
                    onPress={() => router.push('/(tabs)/products' as any)}
                    style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 10 }}
                  >
                    <Text style={{ fontSize: 11, fontWeight: '700', color: BRAND_COLORS.sky500 }}>
                      {t('viewAllLowStock', 'View all')} {stats.lowStockCount} {t('itemsToReorder', 'items to reorder')} ➔
                    </Text>
                    <ArrowRight size={14} color={BRAND_COLORS.sky500} />
                  </TouchableOpacity>
                ) : null}
              </View>

              <RevenueTrendChart
                timeframe={timeframe}
                onTimeframeChange={setTimeframe}
                trend={trend}
                isLoading={isTrendLoading}
                textPrimary={theme.textPrimary}
                textSecondary={theme.textSecondary}
                cardBg={theme.cardBg}
                borderColor={theme.borderColor}
                surfaceBg={theme.bg}
              />

              {/* 9. RECENT SALES FEED */}
              <View style={styles.sectionContainer}>
                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.sectionHeader}>{t('recentSales', 'RECENT SALES TRANSACTIONS')}</Text>
                  <TouchableOpacity onPress={() => router.push('/(tabs)/invoices' as any)}>
                    <Text style={styles.viewAllBtn}>{t('viewAll', 'View All ➔')}</Text>
                  </TouchableOpacity>
                </View>

                <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
                  {stats.recentSales.length === 0 ? (
                    <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                      {t('noRecentSales', 'No sales recorded yet. Complete a POS sale to see transactions here.')}
                    </Text>
                  ) : (
                    stats.recentSales.slice(0, 4).map((sale) => (
                      <View key={sale.id} style={[styles.listRow, { borderBottomColor: theme.borderColor }]}>
                        <View>
                          <Text style={[styles.itemTitle, { color: theme.textPrimary }]}>{sale.invoiceNumber}</Text>
                          <Text style={[styles.itemSub, { color: theme.textSecondary }]}>
                            {new Date(sale.createdAt).toLocaleString([], { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          </Text>
                        </View>
                        <Text style={[styles.itemValue, { color: theme.textPrimary }]}>
                          {formatCurrency(sale.grandTotal)}
                        </Text>
                      </View>
                    ))
                  )}
                </View>
              </View>
            </>
          )}
        </ScrollView>

        {/* Camera Barcode Scanner Modal */}
        <Modal visible={showScanModal} animationType="slide">
          <View style={{ flex: 1, backgroundColor: '#000' }}>
            <View style={styles.scannerHeader}>
              <Text style={{ color: '#FFF', fontSize: 16, fontWeight: '800' }}>
                {scanMode === 'bill' ? t('scanStockToBill', 'Scan Product Barcode to Bill') : t('scanStockToAdd', 'Scan Barcode to Add Stock')}
              </Text>
              <TouchableOpacity onPress={() => setShowScanModal(false)}>
                <X size={24} color="#FFF" />
              </TouchableOpacity>
            </View>
            {permission?.granted ? (
              <CameraView
                style={{ flex: 1 }}
                barcodeScannerSettings={{
                  barcodeTypes: ['qr', 'ean13', 'ean8', 'code128', 'code39', 'upc_a', 'upc_e'],
                }}
                onBarcodeScanned={handleBarcodeScanned}
              />
            ) : (
              <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
                <Text style={{ color: '#FFF', textAlign: 'center', marginBottom: 12 }}>{t('permissionRequired', 'Camera permission required')}</Text>
                <TouchableOpacity onPress={requestPermission} style={{ backgroundColor: BRAND_COLORS.blue600, padding: 12, borderRadius: 10 }}>
                  <Text style={{ color: '#FFF', fontWeight: 'bold' }}>{t('grantPermission', 'Grant Permission')}</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </Modal>

        {/* AI Catalog Bulk Import Modal */}
        <AiProductImportModal
          visible={showAiImportModal}
          onClose={() => setShowAiImportModal(false)}
          onSuccessImport={() => {
            refetch();
            queryClient.invalidateQueries({ queryKey: ['products'] });
          }}
        />

        {/* Direct Bluetooth / Network Thermal Printer Connect Dialog */}
        <DirectPrinterConnectModal
          visible={showDirectPrinterModal}
          onClose={() => setShowDirectPrinterModal(false)}
          onConnected={() => {
            setShowDirectPrinterModal(false);
            // Read through the store: this fires in the same tick the connection lands, before the
            // subscribed `activeDevice` in this closure has been re-rendered with the new printer.
            const connected = usePrinterStore.getState().activeDevice;
            Alert.alert('Printer Linked! 🖨️', `Connected to ${connected?.name || 'thermal printer'}. Ready for instant receipt printing.`);
          }}
        />

        {/* Slide-out Sidebar Drawer */}
        <SidebarDrawer visible={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} />
      </View>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  menuBtn: { padding: 9, borderRadius: 12, borderWidth: 1 },
  storeTag: { fontSize: 10, fontWeight: '800', color: BRAND_COLORS.sky500, textTransform: 'uppercase', letterSpacing: 0.5 },
  headerTitle: { fontSize: 20, fontWeight: '900' },
  headerPillBtn: { padding: 8, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  billNowBtn: { backgroundColor: BRAND_COLORS.navyInk, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, flexDirection: 'row', alignItems: 'center' },
  billNowText: { color: '#FFFFFF', fontWeight: '800', fontSize: 12, marginLeft: 4 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 40 },
  loadingContainer: { paddingVertical: 60, alignItems: 'center' },
  loadingText: { fontSize: 12, fontWeight: '600', marginTop: 12 },
  sectionHeader: { fontSize: 10, fontWeight: '800', color: '#94A3B8', letterSpacing: 0.5, marginBottom: 10 },
  toggleHeaderBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: 2, paddingHorizontal: 4 },
  toggleHeaderText: { fontSize: 11, fontWeight: '800' },
  
  // Compact 4-Column Feature Grid (Frameless / Borderless)
  compactGridRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 6, paddingVertical: 4 },

  // Show More / Less Pill Button
  showMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 2,
    marginBottom: 16,
  },
  showMoreBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },

  // Live Thermal Printer Card
  printerCard: {
    borderRadius: 18,
    padding: 14,
    borderWidth: 1.5,
    marginBottom: 16,
  },
  printerCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  printerIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  printerCardTitle: {
    fontSize: 14,
    fontWeight: '800',
    marginRight: 6,
  },
  printerCardSub: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: -4,
    marginBottom: 12,
    lineHeight: 16,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 5,
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '800',
  },
  printerActionsWrap: {
    gap: 8,
  },
  printerPrimaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  printerSecondaryRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 8,
  },
  printerConnectBtn: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
  },
  printerConnectBtnIcon: {
    marginRight: 6,
    flexShrink: 0,
  },
  printerConnectBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 12,
    flexShrink: 1,
  },
  printerTestBtn: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  printerSecondaryBtnIcon: {
    marginRight: 4,
    flexShrink: 0,
  },
  printerTestBtnText: {
    fontSize: 12,
    fontWeight: '800',
    flexShrink: 1,
  },
  printerDisconnectBtn: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  printerDisconnectBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#EF4444',
    flexShrink: 1,
  },
  paperToggleContainer: {
    flexShrink: 0,
    flexDirection: 'row',
    borderRadius: 10,
    borderWidth: 1,
    padding: 2,
  },
  paperToggleBtn: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
  },
  paperToggleActive: {
    backgroundColor: BRAND_COLORS.navyInk,
  },
  paperToggleText: {
    fontSize: 10,
    fontWeight: '800',
  },
  paperToggleTextActive: {
    color: '#FFFFFF',
  },

  // Executive KPI Grid
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 16 },
  kpiCard: { width: '48.5%', borderRadius: 16, padding: 12, borderWidth: 1, marginBottom: 8 },
  kpiLabel: { fontSize: 11, fontWeight: '700' },
  kpiIconCircle: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  kpiValue: { fontSize: 16, fontWeight: '900', marginTop: 6 },
  kpiSub: { fontSize: 10, fontWeight: '600', marginTop: 2 },

  // Dual Section
  dualSectionRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  halfCard: { width: '48.5%', minHeight: 142, borderRadius: 16, padding: 14, borderWidth: 1, justifyContent: 'space-between' },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  cardTitle: { fontSize: 14, fontWeight: '800', flex: 1, marginRight: 8 },
  miniIconCircle: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  halfCardBody: { flex: 1, justifyContent: 'space-between' },
  progressBarBg: { height: 4, backgroundColor: '#E2E8F0', borderRadius: 2, marginTop: 4, overflow: 'hidden' },
  progressBarFill: { height: '100%', borderRadius: 2 },

  card: { borderRadius: 18, padding: 16, borderWidth: 1, overflow: 'hidden' },

  sectionContainer: { marginBottom: 18 },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  alertCountBadge: { backgroundColor: 'rgba(239, 68, 68, 0.15)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, marginLeft: 8 },
  alertCountText: { fontSize: 9, fontWeight: '800', color: '#EF4444' },
  viewAllBtn: { fontSize: 12, fontWeight: '800', color: BRAND_COLORS.sky500 },
  listRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1 },
  itemTitle: { fontSize: 13, fontWeight: '800' },
  itemSub: { fontSize: 11, marginTop: 2 },
  itemValue: { fontSize: 14, fontWeight: '900' },

  emptyHeadline: { fontSize: 13, fontWeight: '800', marginTop: 6 },
  emptyText: { fontSize: 11, textAlign: 'center', paddingVertical: 4 },
  scannerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingTop: 40, backgroundColor: '#000' },
  expenseCard: {
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    marginBottom: 16,
  },
  expenseCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  expenseIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  expenseCardTitle: {
    fontSize: 14,
    fontWeight: '900',
  },
  expenseCardSub: {
    fontSize: 11,
    marginTop: 1,
  },
  addExpenseQuickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    gap: 4,
  },
  addExpenseQuickBtnText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '800',
  },
  expenseStatsRow: {
    flexDirection: 'row',
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  expenseStatCol: {
    flex: 1,
    alignItems: 'center',
  },
  expenseStatDivider: {
    width: 1,
    height: 28,
  },
  expenseStatLabel: {
    fontSize: 10,
    fontWeight: '700',
    marginBottom: 2,
  },
  expenseStatVal: {
    fontSize: 13,
    fontWeight: '900',
  },
});
