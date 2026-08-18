import React, { useState } from 'react';
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
} from 'lucide-react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { useDashboard, useRevenueTrend } from '@/hooks/useDashboard';
import { useAuth } from '@/hooks/useAuth';
import { useSettings } from '@/hooks/useSettings';
import { usePrinterStore } from '@/store/usePrinterStore';
import ThermalPrinterService from '@/services/PrinterService';
import { useCartStore } from '@/store/useCartStore';
import { useSales } from '@/hooks/useSales';
import { useProducts } from '@/hooks/useProducts';
import { useCustomers } from '@/hooks/useCustomers';
import { SidebarDrawer } from '@/components/ui/SidebarDrawer';
import { useAppTheme } from '@/hooks/useAppTheme';
import { ScreenBackground } from '@/components/ui/ScreenBackground';
import { KeyboardAvoidingWrapper } from '@/components/ui/KeyboardAvoidingWrapper';
import { AiProductImportModal } from '@/components/products/AiProductImportModal';
import { DirectPrinterConnectModal } from '@/components/printers/DirectPrinterConnectModal';
import { FeatureGridTile } from '@/components/ui/FeatureGridTile';
import { BRAND_COLORS } from '@/constants/theme';
import type { Customer } from '@/types/customer';
import type { Product } from '@/types/product';
import { useLanguageStore } from '@/store/useLanguageStore';

export default function DashboardScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { settings } = useSettings();
  const { t } = useLanguageStore();
  const {
    stats,
    paymentModes,
    expenseSummary,
    topCustomers,
    isLoading,
    isRefetching,
    refetch,
  } = useDashboard();
  const [timeframe, setTimeframe] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const { trend, isLoading: isTrendLoading } = useRevenueTrend(timeframe);
  const {
    connectionState,
    activeDevice,
    paperWidth,
    setPaperWidth,
  } = usePrinterStore();
  const { createSale, isCreating } = useSales();
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

  // 2-Click Quick Bill Inputs
  const [quickItemName, setQuickItemName] = useState('');
  const [quickAmount, setQuickAmount] = useState('');
  const [quickQty, setQuickQty] = useState('1');

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

  // Inventory valuation
  const totalCatalogValue = (products || []).reduce(
    (acc, p) => acc + ((p.sellingPrice || 0) * (p.currentStock || 0)),
    0
  );

  const handleQuickBill = async () => {
    if (!quickItemName.trim() || !quickAmount.trim()) {
      Alert.alert('Missing Info', 'Please enter item name and price.');
      return;
    }

    const price = parseFloat(quickAmount) || 0;
    const qty = parseInt(quickQty) || 1;
    const total = price * qty;

    try {
      const sale = await createSale({
        items: [
          {
            productName: quickItemName.trim(),
            quantity: qty,
            unitPrice: price,
            total,
          },
        ],
        subtotal: total,
        totalDiscount: 0,
        totalTax: 0,
        grandTotal: total,
        paymentMethod: 'cash',
        amountPaid: total,
        changeReturned: 0,
        isQuickBill: true,
      });

      // Quick-print thermal receipt automatically if connected
      if (connectionState === 'connected') {
        try {
          await ThermalPrinterService.printSaleReceipt({
            storeName: settings?.businessName || 'SEZNIK STORE',
            storeAddress: settings?.businessAddress || '',
            storePhone: settings?.businessPhone || '',
            invoiceNumber: sale.invoiceNumber,
            date: new Date().toLocaleDateString('en-GB'),
            customerName: 'Quick Walk-in Customer',
            items: [
              {
                productName: quickItemName.trim(),
                quantity: qty,
                unitPrice: price,
                total,
              },
            ],
            subtotal: total,
            totalTax: 0,
            totalDiscount: 0,
            grandTotal: total,
            amountPaid: total,
            changeReturned: 0,
            paymentMethod: 'CASH (Quick Bill)',
          });
        } catch (printErr) {
          console.warn('Auto print failed:', printErr);
        }
      }

      setShowQuickBillModal(false);
      setQuickItemName('');
      setQuickAmount('');
      setQuickQty('1');
      refetch();
      Alert.alert('Bill Generated!', `Invoice #${sale.invoiceNumber} recorded successfully.`);
    } catch (err: any) {
      Alert.alert('Billing Error', err?.message || 'Failed to complete quick bill');
    }
  };

  const handleBarcodeScanned = async ({ data }: { data: string }) => {
    setShowScanModal(false);
    if (!data) return;

    const raw = String(data).trim();
    const cleanNum = raw.replace(/[^0-9]/g, '');

    let matched = products.find((p) => {
      const pBar = (p.barcode || '').trim();
      const pSku = (p.sku || '').trim();
      const pId = String(p.id || '').trim();
      const pDigits = pBar.replace(/[^0-9]/g, '');
      return (
        pBar.toLowerCase() === raw.toLowerCase() ||
        pSku.toLowerCase() === raw.toLowerCase() ||
        pId === raw ||
        (cleanNum.length >= 4 && (
          pDigits === cleanNum ||
          pDigits.replace(/^0+/, '') === cleanNum.replace(/^0+/, '') ||
          cleanNum.endsWith(pDigits) ||
          pDigits.endsWith(cleanNum)
        ))
      );
    });

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
            { text: 'Quick Bill', onPress: () => { setQuickItemName(`Item ${raw}`); setShowQuickBillModal(true); } },
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
    setQuickItemName(name);
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
              <Text style={styles.billNowText}>Bill Now</Text>
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
                refetchProducts();
                refetchCustomers();
              }}
              tintColor={BRAND_COLORS.sky500}
            />
          }
        >
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={BRAND_COLORS.blue600} />
              <Text style={[styles.loadingText, { color: theme.textSecondary }]}>Loading live metrics...</Text>
            </View>
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

                {/* 2. Products */}
                <FeatureGridTile
                  label={t('products', 'Products')}
                  icon={Package}
                  color="#0284C7"
                  onPress={() => router.push('/(tabs)/products' as any)}
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
                      label={t('salesHistory', 'Sales History')}
                      icon={Receipt}
                      color={BRAND_COLORS.blue600}
                      onPress={() => router.push('/sales' as any)}
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
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>{t('paymentModesTitle', 'Payment Modes')}</Text>
                    <PieChart size={16} color={BRAND_COLORS.blue600} />
                  </View>

                  {paymentModes.length === 0 ? (
                    <Text style={{ fontSize: 11, color: theme.textSecondary }}>{t('noSalesToday', 'No sales recorded yet')}</Text>
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
                </TouchableOpacity>

                {/* Expense Summary */}
                <TouchableOpacity
                  onPress={() => router.push('/expenses' as any)}
                  style={[styles.halfCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>{t('expenses', 'Expense Summary')}</Text>
                    <Wallet size={16} color="#EC4899" />
                  </View>
                  <Text style={{ fontSize: 11, color: theme.textSecondary }}>Today&apos;s Outflow</Text>
                  <Text style={{ fontSize: 18, fontWeight: '900', color: '#EC4899', marginVertical: 2 }}>
                    ₹{expenseSummary.today.toFixed(2)}
                  </Text>
                  <Text style={{ fontSize: 10, color: theme.textSecondary }}>
                    This Month: ₹{expenseSummary.thisMonth.toFixed(0)} ➔
                  </Text>
                </TouchableOpacity>
              </View>

              {/* 8. REVENUE TREND CHART */}
              <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.borderColor, marginBottom: 20 }]}>
                <View style={styles.chartHeader}>
                  <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>{t('revenueTrend', 'Revenue Trend')}</Text>
                  <View style={[styles.timeframeRow, { backgroundColor: theme.bg, borderColor: theme.borderColor }]}>
                    {(['daily', 'weekly', 'monthly'] as const).map((tMode) => (
                      <TouchableOpacity
                        key={tMode}
                        onPress={() => setTimeframe(tMode)}
                        style={[styles.timeChip, timeframe === tMode && { backgroundColor: BRAND_COLORS.blue600 }]}
                      >
                        <Text style={[styles.timeChipText, timeframe === tMode ? { color: '#FFFFFF' } : { color: theme.textSecondary }]}>
                          {tMode.charAt(0).toUpperCase() + tMode.slice(1)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {isTrendLoading ? (
                  <View style={[styles.barChartContainer, { alignItems: 'center', justifyContent: 'center' }]}>
                    <ActivityIndicator size="small" color={BRAND_COLORS.blue600} />
                  </View>
                ) : trend.revenue.every((v) => v === 0) ? (
                  <View style={[styles.barChartContainer, { alignItems: 'center', justifyContent: 'center' }]}>
                    <Text style={{ fontSize: 12, color: theme.textSecondary }}>{t('noSalesToday', 'No sales recorded in this period yet.')}</Text>
                  </View>
                ) : (
                  <View style={styles.barChartContainer}>
                    {(() => {
                      const maxRevenue = Math.max(1, ...trend.revenue);
                      return trend.revenue.map((revenue, idx) => {
                        const heightPct = Math.max(4, Math.round((revenue / maxRevenue) * 100));
                        const isLast = idx === trend.revenue.length - 1;
                        return (
                          <View key={idx} style={styles.barCol}>
                            <View style={[styles.barFill, { height: `${heightPct}%`, backgroundColor: isLast ? BRAND_COLORS.sky500 : BRAND_COLORS.navyInk }]} />
                            <Text style={[styles.barLabel, { color: theme.textSecondary }]} numberOfLines={1}>
                              {trend.labels[idx] || ''}
                            </Text>
                          </View>
                        );
                      });
                    })()}
                  </View>
                )}
              </View>

              {/* 9. RECENT SALES FEED */}
              <View style={styles.sectionContainer}>
                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.sectionHeader}>{t('recentSales', 'RECENT SALES TRANSACTIONS')}</Text>
                  <TouchableOpacity onPress={() => router.push('/sales' as any)}>
                    <Text style={styles.viewAllBtn}>{t('viewAll', 'View All ➔')}</Text>
                  </TouchableOpacity>
                </View>

                <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
                  {stats.recentSales.length === 0 ? (
                    <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                      {t('noSalesToday', 'No sales recorded today yet. Start a POS sale!')}
                    </Text>
                  ) : (
                    stats.recentSales.slice(0, 4).map((sale) => (
                      <View key={sale.id} style={[styles.listRow, { borderBottomColor: theme.borderColor }]}>
                        <View>
                          <Text style={[styles.itemTitle, { color: theme.textPrimary }]}>{sale.invoiceNumber}</Text>
                          <Text style={[styles.itemSub, { color: theme.textSecondary }]}>
                            {new Date(sale.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {t('todaySales', 'Completed Invoice')}
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

        {/* 2-Click Instant "Bill Now" Modal */}
        <Modal visible={showQuickBillModal} animationType="slide" transparent>
          <KeyboardAvoidingWrapper inModal>
            <View style={styles.modalOverlay}>
              <View style={[styles.bottomSheet, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
                <View style={styles.sheetHeader}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Zap size={20} color={BRAND_COLORS.blue600} />
                    <Text style={[styles.sheetTitle, { color: theme.textPrimary, marginLeft: 8 }]}>
                      2-Click Instant Bill
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => setShowQuickBillModal(false)}>
                    <X size={22} color={theme.textSecondary} />
                  </TouchableOpacity>
                </View>

                <Text style={[styles.inputLabel, { color: theme.textPrimary }]}>Item Name (Product / Non-Product)</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.bg, borderColor: theme.borderColor, color: theme.textPrimary }]}
                  value={quickItemName}
                  onChangeText={setQuickItemName}
                  placeholder="e.g. General Counter Items"
                  placeholderTextColor="#94A3B8"
                />

                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 }}>
                  <View style={{ flex: 1, marginRight: 6 }}>
                    <Text style={[styles.inputLabel, { color: theme.textPrimary }]}>Total Amount (₹) *</Text>
                    <TextInput
                      style={[styles.input, { backgroundColor: theme.bg, borderColor: theme.borderColor, color: theme.textPrimary }]}
                      value={quickAmount}
                      onChangeText={setQuickAmount}
                      keyboardType="numeric"
                      placeholder="150.00"
                      placeholderTextColor="#94A3B8"
                    />
                  </View>

                  <View style={{ flex: 1, marginLeft: 6 }}>
                    <Text style={[styles.inputLabel, { color: theme.textPrimary }]}>Qty</Text>
                    <TextInput
                      style={[styles.input, { backgroundColor: theme.bg, borderColor: theme.borderColor, color: theme.textPrimary }]}
                      value={quickQty}
                      onChangeText={setQuickQty}
                      keyboardType="numeric"
                      placeholder="1"
                      placeholderTextColor="#94A3B8"
                    />
                  </View>
                </View>

                <TouchableOpacity onPress={handleQuickBill} disabled={isCreating} style={styles.instantBillBtn}>
                  {isCreating && <ActivityIndicator color="#FFF" style={{ marginRight: 8 }} />}
                  <Text style={styles.instantBillBtnText}>Print & Record Bill Now</Text>
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
                {scanMode === 'bill' ? 'Scan Product Barcode to Bill' : 'Scan Barcode to Add Stock'}
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
                <Text style={{ color: '#FFF', textAlign: 'center', marginBottom: 12 }}>Camera permission required</Text>
                <TouchableOpacity onPress={requestPermission} style={{ backgroundColor: BRAND_COLORS.blue600, padding: 12, borderRadius: 10 }}>
                  <Text style={{ color: '#FFF', fontWeight: 'bold' }}>Grant Permission</Text>
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
                  <Text style={[styles.sheetTitle, { color: theme.textPrimary, marginLeft: 8 }]}>Voice AI Add Product</Text>
                </View>
                <TouchableOpacity onPress={() => setShowVoiceModal(false)}>
                  <X size={22} color={theme.textSecondary} />
                </TouchableOpacity>
              </View>

              <Text style={{ fontSize: 12, color: theme.textSecondary, marginBottom: 12 }}>
                Speak item name and price (e.g. &quot;Amul Butter 100 rupees&quot;) or type below:
              </Text>

              <TextInput
                style={[styles.input, { backgroundColor: theme.bg, borderColor: theme.borderColor, color: theme.textPrimary }]}
                value={voiceText}
                onChangeText={setVoiceText}
                placeholder="Say or type product details..."
                placeholderTextColor="#94A3B8"
              />

              <TouchableOpacity onPress={handleVoiceAddProduct} style={[styles.instantBillBtn, { backgroundColor: '#EF4444' }]}>
                <Text style={styles.instantBillBtnText}>Add Product to Bill</Text>
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
            Alert.alert('Printer Linked! 🖨️', `Connected to ${activeDevice?.name || 'thermal printer'}. Ready for instant receipt printing.`);
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

  // Executive KPI Grid
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 16 },
  kpiCard: { width: '48.5%', borderRadius: 16, padding: 12, borderWidth: 1, marginBottom: 8 },
  kpiLabel: { fontSize: 11, fontWeight: '700' },
  kpiIconCircle: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  kpiValue: { fontSize: 16, fontWeight: '900', marginTop: 6 },
  kpiSub: { fontSize: 10, fontWeight: '600', marginTop: 2 },

  // Dual Section
  dualSectionRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  halfCard: { width: '48.5%', borderRadius: 16, padding: 12, borderWidth: 1 },
  progressBarBg: { height: 4, backgroundColor: '#E2E8F0', borderRadius: 2, marginTop: 4, overflow: 'hidden' },
  progressBarFill: { height: '100%', borderRadius: 2 },

  card: { borderRadius: 18, padding: 16, borderWidth: 1, overflow: 'hidden' },
  chartHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  cardTitle: { fontSize: 14, fontWeight: '800' },
  timeframeRow: { flexDirection: 'row', padding: 2, borderRadius: 10, borderWidth: 1 },
  timeChip: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  timeChipText: { fontSize: 10, fontWeight: '700' },
  barChartContainer: { height: 110, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingTop: 10 },
  barCol: { width: 36, height: '100%', justifyContent: 'flex-end', alignItems: 'center' },
  barFill: { width: 16, borderRadius: 6, marginBottom: 6 },
  barLabel: { fontSize: 9, fontWeight: '700' },

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
});
