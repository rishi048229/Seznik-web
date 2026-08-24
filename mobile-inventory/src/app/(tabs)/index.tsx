import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Modal,
  TextInput,
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
  Receipt,
  AlertTriangle,
  ShoppingBag,
  PlusCircle,
  ArrowRight,
  Printer,
  Bluetooth,
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
  Mic,
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
  Trash2,
  ChefHat,
} from 'lucide-react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter, useFocusEffect } from 'expo-router';
import { useDashboard, useRevenueTrend } from '@/hooks/useDashboard';
import { useAuth } from '@/hooks/useAuth';
import { useSettings } from '@/hooks/useSettings';
import { usePrinterStore } from '@/store/usePrinterStore';
import { useStoreProfile } from '@/hooks/useStoreProfile';
import ThermalPrinterService from '@/services/PrinterService';
import {
  buildReceiptPrintOptions,
  generateProvisionalInvoice,
  printSaleReceiptNow,
} from '@/utils/fastSaleCheckout';
import { useCartStore } from '@/store/useCartStore';
import { useSales } from '@/hooks/useSales';
import { useProducts } from '@/hooks/useProducts';
import { useCustomers } from '@/hooks/useCustomers';
import { SidebarDrawer } from '@/components/ui/SidebarDrawer';
import { matchProductByCode } from '@/utils/productBarcodeMatch';
import { useAppTheme } from '@/hooks/useAppTheme';
import { ScreenBackground } from '@/components/ui/ScreenBackground';
import { KeyboardAvoidingWrapper } from '@/components/ui/KeyboardAvoidingWrapper';
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

export default function DashboardScreen() {
  const router = useRouter();
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

  useFocusEffect(
    useCallback(() => {
      refetch();
      refetchTrend();
    }, [refetch, refetchTrend])
  );
  const {
    connectionState,
    activeDevice,
    paperWidth,
    setPaperWidth,
    topMargin,
    autoCut,
    fontSize,
    printCopies,
    activeTemplateId,
    customTemplates,
    activeCustomTemplateId,
    enableBillQrCode,
  } = usePrinterStore();
  const storeProfile = useStoreProfile();
  const { persistSaleInBackground, isCreating } = useSales();
  const { products, updateProduct, getByBarcode, refetch: refetchProducts } = useProducts();
  const { customers, refetch: refetchCustomers } = useCustomers();
  const [permission, requestPermission] = useCameraPermissions();

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [showMoreTools, setShowMoreTools] = useState(false);
  const [restockingId, setRestockingId] = useState<string | null>(null);

  // Modals & Action States
  const [showQuickBillModal, setShowQuickBillModal] = useState(false);
  const [showAiImportModal, setShowAiImportModal] = useState(false);
  const [showDirectPrinterModal, setShowDirectPrinterModal] = useState(false);
  const [showScanModal, setShowScanModal] = useState(false);
  const [scanMode, setScanMode] = useState<'bill' | 'stock'>('bill');
  const [showVoiceModal, setShowVoiceModal] = useState(false);
  const [voiceText, setVoiceText] = useState('');

  // Multi-Product Instant Quick Bill Inputs
  interface QuickBillRow {
    id: string;
    name: string;
    price: string;
    qty: string;
  }
  const [quickBillItems, setQuickBillItems] = useState<QuickBillRow[]>([
    { id: '1', name: '', price: '', qty: '1' },
  ]);
  const [quickCustomerName, setQuickCustomerName] = useState('');
  const [quickPaymentMethod, setQuickPaymentMethod] = useState<'cash' | 'upi' | 'card'>('cash');

  const handleAddQuickBillRow = () => {
    setQuickBillItems((prev) => [
      ...prev,
      { id: Date.now().toString(), name: '', price: '', qty: '1' },
    ]);
  };

  const handleUpdateQuickBillRow = (id: string, field: 'name' | 'price' | 'qty', value: string) => {
    setQuickBillItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const handleRemoveQuickBillRow = (id: string) => {
    if (quickBillItems.length <= 1) {
      setQuickBillItems([{ id: '1', name: '', price: '', qty: '1' }]);
      return;
    }
    setQuickBillItems((prev) => prev.filter((item) => item.id !== id));
  };

  const calculateQuickBillTotal = () => {
    return quickBillItems.reduce((acc, item) => {
      const p = parseFloat(item.price) || 0;
      const q = parseInt(item.qty) || 1;
      return acc + p * q;
    }, 0);
  };

  const theme = useAppTheme();

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(val || 0);
  };

  // Customers with pending credit balance (Udhaar)
  const creditCustomers = (customers || []).filter((c: Customer) => (c.creditBalance || 0) > 0);
  const totalOutstandingCredit = creditCustomers.reduce((acc, c) => acc + (c.creditBalance || 0), 0);

  // Low stock products
  const lowStockProducts = (products || []).filter(
    (p: Product) => (p.currentStock || 0) <= (p.lowStockThreshold ?? 5)
  );

  // Inventory valuation — prefer server-side cost-based total; fall back to local active products
  const localCatalogValue = (products || [])
    .filter((p: Product) => p.isActive !== false)
    .reduce((acc, p) => acc + ((p.costPrice || p.sellingPrice || 0) * (p.currentStock || 0)), 0);
  const totalCatalogValue = stats.totalStockValue ?? localCatalogValue;

  const handleQuickBill = () => {
    const validItems = quickBillItems
      .filter((item) => item.name.trim().length > 0 && parseFloat(item.price) > 0)
      .map((item) => {
        const p = parseFloat(item.price) || 0;
        const q = Math.max(1, parseInt(item.qty) || 1);
        return {
          productName: item.name.trim(),
          quantity: q,
          unitPrice: p,
          total: p * q,
        };
      });

    if (validItems.length === 0) {
      Alert.alert('Missing Info', 'Please enter at least one product with name and price.');
      return;
    }

    const total = validItems.reduce((acc, i) => acc + i.total, 0);
    const provisionalInv = generateProvisionalInvoice();
    const customerName = quickCustomerName.trim() || 'Quick Walk-in Customer';
    const printOptions = buildReceiptPrintOptions({
      activeTemplateId,
      customTemplates,
      activeCustomTemplateId,
      enableBillQrCode,
      topMargin,
      autoCut,
      fontSize,
      printCopies,
      storeName: settings?.businessName || storeProfile.storeName,
      storeAddress: settings?.businessAddress || storeProfile.storeAddress,
      storePhone: settings?.businessPhone || storeProfile.storePhone,
      storeGstin: settings?.businessGSTIN || storeProfile.storeGstin,
      storeLogoUrl: settings?.businessLogoURL || storeProfile.storeLogoUrl,
      upiId: settings?.upiId || storeProfile.upiId,
    });

    // Close the form and print immediately — don't wait on the server round-trip.
    setShowQuickBillModal(false);
    setQuickBillItems([{ id: '1', name: '', price: '', qty: '1' }]);
    setQuickCustomerName('');

    if (connectionState === 'connected') {
      printSaleReceiptNow(
        {
          storeName: settings?.businessName || 'SEZNIK STORE',
          storeAddress: settings?.businessAddress || '',
          storePhone: settings?.businessPhone || '',
          invoiceNumber: provisionalInv,
          date: new Date().toLocaleDateString('en-GB'),
          customerName,
          items: validItems,
          subtotal: total,
          totalTax: 0,
          totalDiscount: 0,
          grandTotal: total,
          amountPaid: total,
          changeReturned: 0,
          paymentMethod: quickPaymentMethod.toUpperCase(),
        },
        paperWidth,
        printOptions
      );
    }

    persistSaleInBackground(
      {
        items: validItems,
        subtotal: total,
        totalDiscount: 0,
        totalTax: 0,
        grandTotal: total,
        paymentMethod: quickPaymentMethod,
        amountPaid: total,
        changeReturned: 0,
        isQuickBill: true,
      },
      {
        onSuccess: (sale) => {
          refetch();
          Alert.alert(
            'Bill Generated! 🧾',
            `Invoice #${sale.invoiceNumber} recorded with ${validItems.length} products (${formatCurrency(total)}).`
          );
        },
        onError: (err) => {
          Alert.alert(
            'Bill Not Saved',
            connectionState === 'connected'
              ? `${err.message}\n\nThe receipt may have printed, but this sale was not saved.`
              : err.message || 'Failed to save this quick bill.'
          );
        },
      }
    );
  };

  const handleBarcodeScanned = async ({ data }: { data: string }) => {
    setShowScanModal(false);
    if (!data) return;

    const raw = String(data).trim();

    let matched = matchProductByCode(products, raw);

    if (!matched) {
      try {
        const remote = await getByBarcode(raw);
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
            { text: 'Quick Bill', onPress: () => { setQuickBillItems([{ id: '1', name: `Item ${raw}`, price: '', qty: '1' }]); setShowQuickBillModal(true); } },
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
              await updateProduct({ id: matched!.id, payload: { currentStock: matched!.currentStock + addQty } });
              refetchProducts();
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

  const handleVoiceAddProduct = () => {
    if (!voiceText.trim()) {
      Alert.alert('Voice Input Empty', 'Please speak or type product details.');
      return;
    }
    const name = voiceText.trim();
    setShowVoiceModal(false);
    setVoiceText('');
    setQuickBillItems([{ id: '1', name, price: '', qty: '1' }]);
    setShowQuickBillModal(true);
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

  const handleQuickRestock = async (product: Product, delta = 10) => {
    setRestockingId(product.id);
    try {
      const newStock = (product.currentStock || 0) + delta;
      await updateProduct({ id: product.id, payload: { currentStock: newStock } });
      refetchProducts();
      Alert.alert('Restock Successful! 📦', `Added +${delta} ${product.unit || 'units'} to ${product.name}.\nNew In-Stock: ${newStock}`);
    } catch (err: any) {
      Alert.alert('Stock Update Failed', err?.message || 'Could not update stock.');
    } finally {
      setRestockingId(null);
    }
  };

  const handleTestPrint = async () => {
    if (connectionState !== 'connected') {
      setShowDirectPrinterModal(true);
      return;
    }
    try {
      await ThermalPrinterService.printSaleReceipt({
        storeName: settings?.businessName || 'SEZNIK TEST STORE',
        storeAddress: settings?.businessAddress || 'Thermal Print Diagnostic',
        storePhone: settings?.businessPhone || '+91 98765 43210',
        invoiceNumber: `TEST-${Date.now().toString().slice(-4)}`,
        date: new Date().toLocaleDateString('en-GB'),
        customerName: 'Hardware Diagnostic Check',
        items: [
          { productName: 'Alignment & Text Density', quantity: 1, unitPrice: 100, total: 100 },
          { productName: 'Paper Feed Speed Test', quantity: 1, unitPrice: 50, total: 50 },
        ],
        subtotal: 150,
        totalTax: 0,
        totalDiscount: 0,
        grandTotal: 150,
        amountPaid: 150,
        changeReturned: 0,
        paymentMethod: 'TEST PRINT',
      });
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

            <TouchableOpacity
              onPress={() => setShowVoiceModal(true)}
              style={[styles.headerPillBtn, { backgroundColor: 'rgba(239, 68, 68, 0.15)', marginRight: 6 }]}
            >
              <Mic size={14} color="#EF4444" />
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setShowQuickBillModal(true)} style={styles.billNowBtn}>
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
              refreshing={isRefetching}
              onRefresh={() => {
                refetch();
                refetchTrend();
                refetchProducts();
                refetchCustomers();
              }}
              tintColor={BRAND_COLORS.sky500}
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
                {/* 1. Day Book */}
                <FeatureGridTile
                  label={t('dayBook', 'Day Book')}
                  icon={BookOpen}
                  color="#10B981"
                  onPress={() => router.push('/credits' as any)}
                  theme={theme}
                />

                {/* 2. Invoices */}
                <FeatureGridTile
                  label={t('invoices', 'Invoices')}
                  icon={Receipt}
                  color="#0284C7"
                  onPress={() => router.push('/(tabs)/invoices' as any)}
                  theme={theme}
                />

                {/* 3. Scan Stock */}
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

                {/* 4. AI */}
                <FeatureGridTile
                  label={t('aiImport', 'AI Import')}
                  badge="AI"
                  icon={Sparkles}
                  color="#8B5CF6"
                  onPress={() => setShowAiImportModal(true)}
                  theme={theme}
                />

                {/* Hidden tools revealed on Show More */}
                {showMoreTools && (
                  <>
                    {hasPermission('canAccessKOT') && (
                      <FeatureGridTile
                        label={t('kotOrders', 'KOT Orders')}
                        badge="NEW"
                        icon={ChefHat}
                        color="#F97316"
                        onPress={() => router.push('/kot' as any)}
                        theme={theme}
                      />
                    )}
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
                      label={t('voiceAdd', 'Voice Add')}
                      icon={Mic}
                      color="#EF4444"
                      onPress={() => setShowVoiceModal(true)}
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
                    <FeatureGridTile
                      label={t('quickTokens', 'Quick Tokens')}
                      icon={Ticket}
                      color="#F59E0B"
                      onPress={() => router.push('/quick-tokens' as any)}
                      theme={theme}
                    />
                    <FeatureGridTile
                      label={t('calculator', 'Calculator')}
                      badge="NEW"
                      icon={Calculator}
                      color="#6366F1"
                      onPress={() => router.push('/(tabs)/calculator' as any)}
                      theme={theme}
                    />
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
                  {showMoreTools ? t('showLessOptions', 'Show Less Options') : t('showMoreOptions', 'Show More Options (13)')}
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
                  <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                    <View style={[styles.printerIconBadge, { backgroundColor: connectionState === 'connected' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(100, 116, 139, 0.15)' }]}>
                      <Printer size={20} color={connectionState === 'connected' ? '#10B981' : '#64748B'} />
                    </View>
                    <View style={{ marginLeft: 10, flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={[styles.printerCardTitle, { color: theme.textPrimary }]}>
                          {t('thermalPrinter', 'Thermal POS Printer')}
                        </Text>
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
                          : t('noBluetoothFound', 'Tap Scan & Connect to link Bluetooth/USB receipt printer')}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Action Buttons: Scan/Connect + Test Print + Paper Switch */}
                <View style={styles.printerActionRow}>
                  <TouchableOpacity
                    style={[styles.printerConnectBtn, { backgroundColor: connectionState === 'connected' ? BRAND_COLORS.blue600 : '#10B981' }]}
                    onPress={() => setShowDirectPrinterModal(true)}
                    activeOpacity={0.8}
                  >
                    <Bluetooth size={14} color="#FFF" style={{ marginRight: 6 }} />
                    <Text style={styles.printerConnectBtnText}>
                      {connectionState === 'connected' ? t('changeReconnect', 'Change / Reconnect') : t('scanAndConnect', 'Scan & Connect')}
                    </Text>
                  </TouchableOpacity>

                  {connectionState === 'connected' ? (
                    <TouchableOpacity
                      style={[styles.printerTestBtn, { borderColor: theme.borderColor, backgroundColor: theme.cardBg }]}
                      onPress={handleTestPrint}
                      activeOpacity={0.8}
                    >
                      <Zap size={14} color={BRAND_COLORS.sky500} style={{ marginRight: 4 }} />
                      <Text style={[styles.printerTestBtnText, { color: theme.textPrimary }]}>{t('testPrint', 'Test Print')}</Text>
                    </TouchableOpacity>
                  ) : null}

                  {/* 58mm / 80mm toggle */}
                  <View style={[styles.paperToggleContainer, { borderColor: theme.borderColor, backgroundColor: theme.cardBg }]}>
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
                      <Receipt size={16} color={BRAND_COLORS.sky500} />
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
                  <Text style={[styles.kpiSub, { color: theme.textSecondary }]}>{(products || []).length} SKUs Listed ➔</Text>
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

              {/* 7.5 DEDICATED EXPENSE TRACKER & OUTFLOW CARD */}
              <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.borderColor, marginBottom: 16 }]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: 'rgba(236, 72, 153, 0.15)', alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
                      <Wallet size={18} color="#EC4899" />
                    </View>
                    <View>
                      <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>{t('expenses', 'Expense Tracker & Outflow')}</Text>
                      <Text style={{ fontSize: 11, color: theme.textSecondary }}>Live Business Spending</Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    onPress={() => router.push('/expenses' as any)}
                    style={{ backgroundColor: 'rgba(236, 72, 153, 0.12)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, flexDirection: 'row', alignItems: 'center' }}
                  >
                    <Plus size={13} color="#EC4899" style={{ marginRight: 4 }} />
                    <Text style={{ fontSize: 11, fontWeight: '800', color: '#EC4899' }}>+ Add Expense</Text>
                  </TouchableOpacity>
                </View>

                <View style={{ flexDirection: 'row', justifyContent: 'space-between', backgroundColor: theme.bg, padding: 12, borderRadius: 14, marginBottom: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 10, fontWeight: '700', color: theme.textSecondary, textTransform: 'uppercase' }}>Today&apos;s Expense</Text>
                    <Text style={{ fontSize: 18, fontWeight: '900', color: '#EC4899', marginTop: 2 }}>
                      {formatCurrency(expenseSummary.today)}
                    </Text>
                  </View>
                  <View style={{ width: 1, backgroundColor: theme.borderColor, marginHorizontal: 12 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 10, fontWeight: '700', color: theme.textSecondary, textTransform: 'uppercase' }}>This Month Outflow</Text>
                    <Text style={{ fontSize: 18, fontWeight: '900', color: theme.textPrimary, marginTop: 2 }}>
                      {formatCurrency(expenseSummary.thisMonth)}
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  onPress={() => router.push('/expenses' as any)}
                  style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 4 }}
                >
                  <Text style={{ fontSize: 11, fontWeight: '700', color: BRAND_COLORS.sky500 }}>
                    Manage Expense Categories & Cash Outflows ➔
                  </Text>
                  <ArrowRight size={14} color={BRAND_COLORS.sky500} />
                </TouchableOpacity>
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

        {/* Multi-Product Instant "Bill Now" Modal */}
        <Modal visible={showQuickBillModal} animationType="slide" transparent>
          <KeyboardAvoidingWrapper inModal>
            <View style={styles.modalOverlay}>
              <View style={[styles.bottomSheet, { backgroundColor: theme.cardBg, borderColor: theme.borderColor, maxHeight: '88%' }]}>
                <View style={styles.sheetHeader}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Zap size={20} color={BRAND_COLORS.blue600} />
                    <Text style={[styles.sheetTitle, { color: theme.textPrimary, marginLeft: 8 }]}>
                      Multi-Product Quick Bill
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => setShowQuickBillModal(false)}>
                    <X size={22} color={theme.textSecondary} />
                  </TouchableOpacity>
                </View>

                {/* Optional Customer Name */}
                <Text style={[styles.inputLabel, { color: theme.textPrimary }]}>Customer Name (Optional)</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.bg, borderColor: theme.borderColor, color: theme.textPrimary, marginBottom: 12 }]}
                  value={quickCustomerName}
                  onChangeText={setQuickCustomerName}
                  placeholder="Walk-in Customer"
                  placeholderTextColor="#94A3B8"
                />

                {/* Item List */}
                <Text style={[styles.inputLabel, { color: theme.textPrimary, marginBottom: 8 }]}>Products / Items ({quickBillItems.length})</Text>
                <ScrollView style={{ maxHeight: 240, marginBottom: 10 }} showsVerticalScrollIndicator={false}>
                  {quickBillItems.map((item, idx) => {
                    const rowSubtotal = (parseFloat(item.price) || 0) * (parseInt(item.qty) || 1);
                    return (
                      <View key={item.id} style={[styles.quickItemRowCard, { backgroundColor: theme.bg, borderColor: theme.borderColor }]}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                          <Text style={{ fontSize: 11, fontWeight: '800', color: BRAND_COLORS.sky500 }}>
                            Item #{idx + 1}
                          </Text>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Text style={{ fontSize: 11, fontWeight: '800', color: theme.textPrimary }}>
                              = {formatCurrency(rowSubtotal)}
                            </Text>
                            {quickBillItems.length > 1 && (
                              <TouchableOpacity onPress={() => handleRemoveQuickBillRow(item.id)} style={{ padding: 4 }}>
                                <Trash2 size={15} color="#EF4444" />
                              </TouchableOpacity>
                            )}
                          </View>
                        </View>

                        <TextInput
                          style={[styles.input, { backgroundColor: theme.cardBg, borderColor: theme.borderColor, color: theme.textPrimary, marginBottom: 8, paddingVertical: 8 }]}
                          value={item.name}
                          onChangeText={(v) => handleUpdateQuickBillRow(item.id, 'name', v)}
                          placeholder="e.g. Rice 1kg, Chai, Notebook"
                          placeholderTextColor="#94A3B8"
                        />

                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                          <View style={{ flex: 1.5 }}>
                            <Text style={{ fontSize: 10, fontWeight: '700', color: theme.textSecondary, marginBottom: 4 }}>Price (₹) *</Text>
                            <TextInput
                              style={[styles.input, { backgroundColor: theme.cardBg, borderColor: theme.borderColor, color: theme.textPrimary, marginBottom: 0, paddingVertical: 8 }]}
                              value={item.price}
                              onChangeText={(v) => handleUpdateQuickBillRow(item.id, 'price', v)}
                              keyboardType="numeric"
                              placeholder="100.00"
                              placeholderTextColor="#94A3B8"
                            />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 10, fontWeight: '700', color: theme.textSecondary, marginBottom: 4 }}>Qty</Text>
                            <TextInput
                              style={[styles.input, { backgroundColor: theme.cardBg, borderColor: theme.borderColor, color: theme.textPrimary, marginBottom: 0, paddingVertical: 8 }]}
                              value={item.qty}
                              onChangeText={(v) => handleUpdateQuickBillRow(item.id, 'qty', v)}
                              keyboardType="numeric"
                              placeholder="1"
                              placeholderTextColor="#94A3B8"
                            />
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </ScrollView>

                {/* Add Next Product Row Button */}
                <TouchableOpacity
                  onPress={handleAddQuickBillRow}
                  style={[styles.addQuickItemBtn, { borderColor: BRAND_COLORS.blue600, backgroundColor: 'rgba(37, 99, 235, 0.08)' }]}
                >
                  <Plus size={16} color={BRAND_COLORS.blue600} style={{ marginRight: 6 }} />
                  <Text style={{ color: BRAND_COLORS.blue600, fontWeight: '800', fontSize: 12 }}>
                    + Add Next Product / Item
                  </Text>
                </TouchableOpacity>

                {/* Payment Method & Total Bar */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 10 }}>
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    {(['cash', 'upi', 'card'] as const).map((mode) => (
                      <TouchableOpacity
                        key={mode}
                        onPress={() => setQuickPaymentMethod(mode)}
                        style={[
                          styles.payModeChip,
                          quickPaymentMethod === mode && { backgroundColor: BRAND_COLORS.navyInk },
                          { borderColor: theme.borderColor },
                        ]}
                      >
                        <Text
                          style={[
                            styles.payModeChipText,
                            quickPaymentMethod === mode ? { color: '#FFF' } : { color: theme.textSecondary },
                          ]}
                        >
                          {mode.toUpperCase()}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ fontSize: 10, fontWeight: '700', color: theme.textSecondary }}>Grand Total</Text>
                    <Text style={{ fontSize: 18, fontWeight: '900', color: '#10B981' }}>
                      {formatCurrency(calculateQuickBillTotal())}
                    </Text>
                  </View>
                </View>

                <TouchableOpacity onPress={handleQuickBill} disabled={isCreating} style={styles.instantBillBtn}>
                  {isCreating && <ActivityIndicator color="#FFF" style={{ marginRight: 8 }} />}
                  <Text style={styles.instantBillBtnText}>{t('printAndRecordBill', 'Print & Record Bill Now')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingWrapper>
        </Modal>

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

        {/* Voice AI Add Modal */}
        <Modal visible={showVoiceModal} transparent animationType="fade">
          <KeyboardAvoidingWrapper inModal>
          <View style={styles.modalOverlay}>
            <View style={[styles.bottomSheet, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
              <View style={styles.sheetHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Mic size={20} color="#EF4444" />
                  <Text style={[styles.sheetTitle, { color: theme.textPrimary, marginLeft: 8 }]}>{t('voiceAiAddTitle', 'Voice AI Add Product')}</Text>
                </View>
                <TouchableOpacity onPress={() => setShowVoiceModal(false)}>
                  <X size={22} color={theme.textSecondary} />
                </TouchableOpacity>
              </View>

              <Text style={{ fontSize: 12, color: theme.textSecondary, marginBottom: 12 }}>
                {t('voiceAiAddSubtitle', 'Speak item name and price (e.g. "Amul Butter 100 rupees") or type below:')}
              </Text>

              <TextInput
                style={[styles.input, { backgroundColor: theme.bg, borderColor: theme.borderColor, color: theme.textPrimary }]}
                value={voiceText}
                onChangeText={setVoiceText}
                placeholder={t('voiceAiPlaceholder', 'Say or type product details...')}
                placeholderTextColor="#94A3B8"
              />

              <TouchableOpacity onPress={handleVoiceAddProduct} style={[styles.instantBillBtn, { backgroundColor: '#EF4444' }]}>
                <Text style={styles.instantBillBtnText}>{t('addProductToBill', 'Add Product to Bill')}</Text>
              </TouchableOpacity>
            </View>
          </View>
          </KeyboardAvoidingWrapper>
        </Modal>

        {/* AI Catalog Bulk Import Modal */}
        <AiProductImportModal
          visible={showAiImportModal}
          onClose={() => setShowAiImportModal(false)}
          onSuccessImport={() => {
            refetch();
            refetchProducts();
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
    marginTop: 2,
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
  printerActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  printerConnectBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: 12,
  },
  printerConnectBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 12,
  },
  printerTestBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
  },
  printerTestBtnText: {
    fontSize: 12,
    fontWeight: '800',
  },
  paperToggleContainer: {
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
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' },
  bottomSheet: { borderRadius: 24, padding: 20, borderWidth: 1 },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sheetTitle: { fontSize: 18, fontWeight: '900' },
  inputLabel: { fontSize: 12, fontWeight: '700', marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: 12, padding: 12, fontSize: 14, marginBottom: 14 },
  instantBillBtn: { backgroundColor: BRAND_COLORS.navyInk, borderRadius: 14, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 6 },
  instantBillBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 14 },
  scannerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingTop: 40, backgroundColor: '#000' },
  quickItemRowCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 10,
    marginBottom: 8,
  },
  addQuickItemBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    marginBottom: 8,
  },
  payModeChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  payModeChipText: {
    fontSize: 10,
    fontWeight: '800',
  },
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
