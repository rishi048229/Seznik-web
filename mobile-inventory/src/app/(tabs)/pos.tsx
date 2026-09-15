import React, { useCallback, useDeferredValue, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Modal,
  ScrollView,
  ActivityIndicator,
  Alert,
  StyleSheet,
  StatusBar,
  Vibration,
  Image,
  Platform,
} from 'react-native';
import { useSafeAreaInsets, SafeAreaView } from 'react-native-safe-area-context';
import {
  Menu,
  Search,
  Camera,
  Plus,
  Minus,
  Trash2,
  X,
  UserCircle2,
  ChevronDown,
  Barcode,
  PackagePlus,
  Package,
  Layers,
  Printer,
  Bluetooth,
  Tag,
  Percent,
  CheckCircle2,
  AlertCircle,
  Flashlight,
  FlashlightOff,
  QrCode,
  Edit3,
  Banknote,
  CreditCard,
  BookOpen,
} from 'lucide-react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useProducts } from '@/hooks/useProducts';
import { useCategories } from '@/hooks/useCategories';
import { useSales } from '@/hooks/useSales';
import { useStoreProfile } from '@/hooks/useStoreProfile';
import { useCartStore } from '@/store/useCartStore';
import { usePrinterStore } from '@/store/usePrinterStore';
import { PaymentMethod } from '@/types/sale';
import { SidebarDrawer } from '@/components/ui/SidebarDrawer';
import { useAppTheme } from '@/hooks/useAppTheme';
import { ScreenBackground } from '@/components/ui/ScreenBackground';
import { KeyboardAvoidingWrapper } from '@/components/ui/KeyboardAvoidingWrapper';
import { BRAND_COLORS } from '@/constants/theme';
import ThermalPrinterService, { type PrintSaleData } from '@/services/PrinterService';
import { ReceiptPreviewModal } from '@/components/ui/ReceiptPreviewModal';
import { applyStoreProfileToPrintData } from '@/utils/invoiceActions';
import { BillGstBreakdown } from '@/components/billing/BillGstBreakdown';
import { BillChargesBreakdown } from '@/components/billing/BillChargesBreakdown';
import { parseGstBilling, gstPrintOptionOverrides, shouldShowGstBreakdown } from '@/constants/gstBilling';
import {
  computeChargeAmount,
  getEnabledPresets,
  parseRestaurantBilling,
  shouldShowBillCharges,
} from '@/constants/restaurantBilling';
import { computeGstBillSummary } from '@/utils/gst';
import {
  buildReceiptPrintOptions,
  generateProvisionalInvoice,
} from '@/utils/fastSaleCheckout';
import { Product } from '@/types/product';
import { PosProductSheet } from '@/components/pos/PosProductSheet';
import { CustomerPickerModal } from '@/components/ui/CustomerPickerModal';
import { DirectPrinterConnectModal } from '@/components/printers/DirectPrinterConnectModal';
import { PosGridSkeleton } from '@/components/ui/ScreenSkeleton';
import { ScreenLoadingState } from '@/components/ui/ScreenLoadingState';
import { useLanguageStore } from '@/store/useLanguageStore';
import { matchProductByCode } from '@/utils/productBarcodeMatch';
import { DynamicUpiPaymentModal } from '@/components/ui/DynamicUpiPaymentModal';
import { PosProductGrid } from '@/components/pos/PosProductGrid';
import { useTabTransitionReady } from '@/hooks/useTabTransitionReady';
import { CartItem } from '@/store/useCartStore';
import { useNavigation, router } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { useSettings } from '@/hooks/useSettings';
import { isProductAvailable, usesStockTracking } from '@/utils/businessFeatures';

const EMPTY_CART: CartItem[] = [];

function PosScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { t } = useLanguageStore();
  const { user } = useAuth();
  const { settings } = useSettings();
  const trackStock = usesStockTracking(user?.businessType, settings?.trackStock);
  const { contentReady } = useTabTransitionReady();
  const cartItemsCount = useCartStore((s) => s.items.reduce((sum, item) => sum + item.quantity, 0));

  useLayoutEffect(() => {
    navigation.setOptions({
      tabBarBadge: cartItemsCount > 0 ? cartItemsCount : undefined,
      tabBarBadgeStyle: {
        backgroundColor: BRAND_COLORS.blue600,
        color: '#FFFFFF',
        fontSize: 10,
        fontWeight: 'bold',
      },
    });
  }, [navigation, cartItemsCount]);

  const {
    products,
    isInitialLoading: loadingProducts,
    isError: productsError,
    error: productsLoadError,
    refetch: refetchProducts,
    getByBarcode,
    createProduct,
    updateProduct,
    adjustStock,
  } = useProducts();

  // Add or correct a product without leaving the counter. null = creating a new one.
  const [productSheetOpen, setProductSheetOpen] = useState(false);
  const [productSheetTarget, setProductSheetTarget] = useState<Product | null>(null);

  const openNewProductSheet = () => {
    setProductSheetTarget(null);
    setProductSheetOpen(true);
  };
  const openEditProductSheet = (product: Product) => {
    setProductSheetTarget(product);
    setProductSheetOpen(true);
  };
  const { categories } = useCategories();
  const { persistSaleInBackground, isCreating } = useSales();
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
    receiptLogoSize,
    receiptQrSize,
  } = usePrinterStore();
  const [permission, requestPermission] = useCameraPermissions();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [showDirectPrinterModal, setShowDirectPrinterModal] = useState(false);

  const addItem = useCartStore((s) => s.addItem);
  const removeItem = useCartStore((s) => s.removeItem);
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const clearCart = useCartStore((s) => s.clearCart);
  const cartDiscount = useCartStore((s) => s.discount);
  const setCartDiscount = useCartStore((s) => s.setDiscount);
  const toggleItemDiscount = useCartStore((s) => s.toggleItemDiscount);
  const updateItemDiscount = useCartStore((s) => s.updateItemDiscount);
  const adjustItemDiscountValue = useCartStore((s) => s.adjustItemDiscountValue);
  const getItemDiscount = useCartStore((s) => s.getItemDiscount);
  const getTotalItemDiscount = useCartStore((s) => s.getTotalItemDiscount);
  const getBillDiscount = useCartStore((s) => s.getBillDiscount);
  const getSubtotal = useCartStore((s) => s.getSubtotal);
  const getTotalDiscount = useCartStore((s) => s.getTotalDiscount);
  const getTotalTax = useCartStore((s) => s.getTotalTax);
  const getGrandTotal = useCartStore((s) => s.getGrandTotal);
  const getGrossSubtotalForCharges = useCartStore((s) => s.getGrossSubtotalForCharges);
  const getNetSubtotalForCharges = useCartStore((s) => s.getNetSubtotalForCharges);
  const getResolvedBillCharges = useCartStore((s) => s.getResolvedBillCharges);
  const getExtraChargesTotal = useCartStore((s) => s.getExtraChargesTotal);
  const setChargePresets = useCartStore((s) => s.setChargePresets);
  const initDefaultSelectedCharges = useCartStore((s) => s.initDefaultSelectedCharges);
  const toggleChargePreset = useCartStore((s) => s.toggleChargePreset);
  const clearCharges = useCartStore((s) => s.clearCharges);
  const chargePresets = useCartStore((s) => s.chargePresets);
  const selectedChargePresetIds = useCartStore((s) => s.selectedChargePresetIds);
  const toSaleItems = useCartStore((s) => s.toSaleItems);
  const selectedCustomerId = useCartStore((s) => s.selectedCustomerId);
  const selectedCustomerName = useCartStore((s) => s.selectedCustomerName);
  const setCustomer = useCartStore((s) => s.setCustomer);
  const checkoutModalOpen = useCartStore((s) => s.checkoutModalOpen);
  const setCheckoutModalOpen = useCartStore((s) => s.setCheckoutModalOpen);

  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showScanner, setShowScanner] = useState(false);
  const [lastScannedCode, setLastScannedCode] = useState<string | null>(null);
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [scanToast, setScanToast] = useState<{ message: string; isError?: boolean } | null>(null);

  // Category Search Modal State
  const [showCategorySearchModal, setShowCategorySearchModal] = useState(false);
  const [categorySearchQuery, setCategorySearchQuery] = useState('');

  // Cart & Checkout State
  const [showCustomerPicker, setShowCustomerPicker] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [creditAmountReceivedInput, setCreditAmountReceivedInput] = useState('0');
  const [billDiscountType, setBillDiscountType] = useState<'flat' | 'percent'>('percent');
  const [billDiscountInput, setBillDiscountInput] = useState('');

  // Receipt Preview Modal State
  const [previewSaleData, setPreviewSaleData] = useState<PrintSaleData | null>(null);
  // The sale payload is held until the bill is actually confirmed from the preview.
  // It is no longer persisted at "Pay Now", because the preview can send the user
  // back to the cart to edit — saving first would leave a committed sale that no
  // longer matches what gets printed.
  const pendingSalePayloadRef = useRef<any | null>(null);
  const saleCommittedRef = useRef(false);
  const directSaveRequestedRef = useRef(false);
  const [showReceiptPreviewModal, setShowReceiptPreviewModal] = useState(false);
  const [showUpiModal, setShowUpiModal] = useState(false);
  const [isSavingSalePreview, setIsSavingSalePreview] = useState(false);
  const checkoutLockRef = useRef(false);

  // Hold Orders State
  const [heldOrders, setHeldOrders] = useState<any[]>([]);

  const theme = useAppTheme();
  // Kept as a local alias — this screen references bare `isDark` in several inline styles below.
  const isDark = theme.isDark;

  // Deferred, not the raw keystroke value: at a few thousand products this filter is a
  // real, measurable cost (three .includes() checks per item), and re-running it inside
  // every keystroke's own render — the previous behavior — was blocking the same JS thread
  // the TextInput needs to show the character you just typed, which is exactly what read
  // as "lag" while searching. useDeferredValue keeps the input itself always immediately
  // responsive and lets React drop a still-in-flight filter pass for a newer keystroke
  // instead of finishing stale work, rather than a fixed debounce delay which cannot.
  const deferredSearchQuery = useDeferredValue(searchQuery);

  const filteredProducts = useMemo(() => products.filter((p) => {
    if (!p.isActive) return false;
    const matchesCategory = selectedCategoryId ? p.categoryId === selectedCategoryId : true;
    const q = deferredSearchQuery.trim().toLowerCase();
    const matchesQuery = !q
      ? true
      : p.name.toLowerCase().includes(q) ||
        (p.barcode && p.barcode.toLowerCase().includes(q)) ||
        (p.sku && p.sku.toLowerCase().includes(q));
    return matchesCategory && matchesQuery;
  }), [products, selectedCategoryId, deferredSearchQuery]);

  const categoryProductCounts = useMemo(() => {
    const byCategory = new Map<string, number>();
    let activeTotal = 0;
    for (const p of products) {
      if (!p.isActive) continue;
      activeTotal++;
      if (p.categoryId) {
        byCategory.set(p.categoryId, (byCategory.get(p.categoryId) || 0) + 1);
      }
    }
    return { byCategory, activeTotal };
  }, [products]);

  const cartItems = useCartStore((s) => (s.checkoutModalOpen ? s.items : EMPTY_CART));
  const getCartItems = useCallback(() => useCartStore.getState().items, []);

  const gstBilling = useMemo(
    () => parseGstBilling(storeProfile.settings?.invoiceConfig),
    [storeProfile.settings?.invoiceConfig],
  );

  const restaurantBilling = useMemo(
    () => parseRestaurantBilling(storeProfile.settings?.invoiceConfig),
    [storeProfile.settings?.invoiceConfig],
  );

  const showBillCharges = shouldShowBillCharges(restaurantBilling);

  const openCheckoutModal = useCallback(() => {
    if (shouldShowBillCharges(restaurantBilling)) {
      setChargePresets(getEnabledPresets(restaurantBilling));
      initDefaultSelectedCharges();
    } else {
      setChargePresets([]);
      clearCharges();
    }
    setCheckoutModalOpen(true);
  }, [restaurantBilling, setChargePresets, initDefaultSelectedCharges, clearCharges, setCheckoutModalOpen]);

  const gstSummary = useMemo(() => {
    const rawGross = cartItems.reduce((sum, ci) => sum + ci.product.sellingPrice * ci.quantity, 0);
    const totalDisc = getTotalDiscount();
    const discountFactor = rawGross > 0 ? Math.max(0, rawGross - totalDisc) / rawGross : 1;
    return computeGstBillSummary(
      cartItems.map((ci) => ({
        sellingPrice: ci.product.sellingPrice * discountFactor,
        quantity: ci.quantity,
        discount: 0,
        taxRate: ci.product.taxRate || 0,
        priceIncludesGst: Boolean(ci.product.priceIncludesGst),
      })),
    );
  }, [cartItems, getTotalDiscount]);
  const liveCartItems = useCartStore((s) => s.items);
  const cartTotalCount = liveCartItems.reduce((sum, item) => sum + item.quantity, 0);
  const grandTotalNow = getGrandTotal();
  const creditRemaining = Math.max(0, grandTotalNow - (parseFloat(creditAmountReceivedInput) || 0));

  const handleClearCart = useCallback(() => {
    Alert.alert(
      t('clearCart', 'Clear Cart'),
      t('clearCartConfirm', 'Remove all items from the cart?'),
      [
        { text: t('cancel', 'Cancel'), style: 'cancel' },
        {
          text: t('clear', 'Clear'),
          style: 'destructive',
          onPress: () => {
            clearCart();
            setBillDiscountInput('');
            setCreditAmountReceivedInput('0');
          },
        },
      ]
    );
  }, [clearCart, t]);

  const filteredCategoriesForModal = categories.filter((cat) => {
    if (!cat.isActive) return false;
    const q = categorySearchQuery.trim().toLowerCase();
    return !q || cat.name.toLowerCase().includes(q);
  });

  // Instant Scan-to-Cart for Split-Screen Live Camera
  const handleBarCodeScannedToCart = async ({ data }: { data: string }) => {
    if (data === lastScannedCode) return;
    setLastScannedCode(data);
    Vibration.vibrate(60);

    const raw = String(data || '').trim();

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

    if (matched) {
      if (!trackStock) {
        if (!isProductAvailable(matched)) {
          setScanToast({ message: `"${matched.name}" is not available on the menu`, isError: true });
        } else {
          addItem(matched, 1);
          setScanToast({ message: `+1 ${matched.name} (₹${matched.sellingPrice.toFixed(2)})` });
        }
      } else if ((typeof matched.currentStock === 'number' && matched.currentStock <= 0) || !isProductAvailable(matched)) {
        setScanToast({ message: `Out of Stock: "${matched.name}" (0 remaining)`, isError: true });
      } else {
        addItem(matched, 1);
        setScanToast({ message: `+1 ${matched.name} (₹${matched.sellingPrice.toFixed(2)})` });
      }
    } else {
      setScanToast({ message: `Unrecognized: "${raw.length > 20 ? raw.slice(0, 20) + '...' : raw}"`, isError: true });
    }

    setTimeout(() => setLastScannedCode(null), 1000);
    setTimeout(() => setScanToast(null), 2200);
  };

  const handleHoldOrder = () => {
    const cartItems = getCartItems();
    if (cartItems.length === 0) return;
    const newHold = {
      id: `HOLD-${Date.now()}`,
      items: [...cartItems],
      total: getGrandTotal(),
      createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setHeldOrders([newHold, ...heldOrders]);
    clearCart();
    Alert.alert('Order Held', 'Current cart items have been saved to Held Orders.');
  };

  const handleRestoreHoldOrder = (holdObj: any) => {
    clearCart();
    holdObj.items.forEach((i: any) => addItem(i.product, i.quantity));
    setHeldOrders(heldOrders.filter((h) => h.id !== holdObj.id));
  };

  const handleSelectPaymentMethod = (method: PaymentMethod) => {
    setPaymentMethod(method);
    // Credit has to belong to somebody — prompt for a customer right away if still Walk-in.
    if (method === 'credit' && !selectedCustomerId) {
      setShowCustomerPicker(true);
    } else if (method === 'upi' && cartItems.length > 0) {
      if (!storeProfile.upiId) {
        Alert.alert(
          'Business UPI ID Missing',
          'Please add your Business UPI ID in Settings to display dynamic payment QR codes.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => router.push('/settings') },
          ]
        );
      } else {
        setShowUpiModal(true);
      }
    }
  };

  const buildSaleData = useCallback((invoiceNumber = `INV-${Math.floor(1000 + Math.random() * 9000)}`): PrintSaleData => {
    const cartItems = getCartItems();
    const grandTotal = getGrandTotal();
    const totalDiscount = getTotalDiscount();
    const totalTax = getTotalTax();
    const resolvedCharges = getResolvedBillCharges();
    const extraChargesTotal = getExtraChargesTotal();
    const grossSubtotal = cartItems.reduce((sum, ci) => sum + ci.product.sellingPrice * ci.quantity, 0);
    const amountPaid = paymentMethod === 'credit' ? Math.max(0, Math.min(grandTotal, parseFloat(creditAmountReceivedInput) || 0)) : grandTotal;
    const changeReturned = Math.max(0, amountPaid - grandTotal);
    const customerName = selectedCustomerName || 'Walk-in Customer';
    const discountFactor = grossSubtotal > 0 ? Math.max(0, grossSubtotal - totalDiscount) / grossSubtotal : 1;
    const summary = computeGstBillSummary(
      cartItems.map((ci) => ({
        sellingPrice: ci.product.sellingPrice * discountFactor,
        quantity: ci.quantity,
        discount: 0,
        taxRate: ci.product.taxRate || 0,
        priceIncludesGst: Boolean(ci.product.priceIncludesGst),
      })),
    );
    const taxableAmt = summary.taxableValue || Math.max(0, grossSubtotal - totalDiscount);
    const halfTax = totalTax / 2;

    return {
      storeName: storeProfile.storeName,
      storeAddress: storeProfile.storeAddress,
      storePhone: storeProfile.storePhone,
      storeGstin: storeProfile.storeGstin,
      storeLogoUrl: storeProfile.storeLogoUrl,
      upiId: storeProfile.upiId,
      invoiceNumber,
      date: new Date().toLocaleDateString('en-GB'),
      customerName,
      items: cartItems.map((ci) => {
        const itemDisc = getItemDiscount(ci);
        return {
          productName: ci.product.name,
          quantity: ci.quantity,
          unitPrice: ci.product.sellingPrice,
          total: Math.max(0, ci.product.sellingPrice * ci.quantity - itemDisc),
          unit: ci.product.unit || 'Pc',
          gstRate: ci.product.taxRate || 18,
          discount: itemDisc > 0 ? itemDisc : undefined,
        };
      }),
      subtotal: grossSubtotal,
      taxableAmt,
      sgst: summary.sgstAmount || halfTax,
      cgst: summary.cgstAmount || halfTax,
      gstStyle: gstBilling.printOnReceipt ? gstBilling.style : undefined,
      gstSlabs: summary.slabs,
      totalDiscount: totalDiscount > 0 ? totalDiscount : 0,
      totalTax,
      billCharges: resolvedCharges,
      extraChargesTotal,
      grandTotal,
      amountPaid,
      changeReturned,
      paymentMethod,
    };
  }, [
    getCartItems,
    creditAmountReceivedInput,
    getGrandTotal,
    getResolvedBillCharges,
    getExtraChargesTotal,
    getItemDiscount,
    getTotalDiscount,
    getTotalTax,
    gstBilling,
    paymentMethod,
    selectedCustomerName,
    storeProfile,
  ]);

  /** Build the pending sale once so print and no-print checkout share validation and totals. */
  const prepareCheckout = () => {
    if (getCartItems().length === 0 || checkoutLockRef.current || isCreating) return;

    if (paymentMethod === 'credit' && !selectedCustomerId) {
      Alert.alert('Customer Required', 'Credit sales need a customer attached. Tap the Customer row to select or add one.');
      setShowCustomerPicker(true);
      return;
    }

    checkoutLockRef.current = true;
    setCheckoutModalOpen(false);

    const provisionalInv = generateProvisionalInvoice();
    const saleData = buildSaleData(provisionalInv);
    const rawItems = toSaleItems();
    const cleanSaleItems = rawItems
      .filter((i) => i.productId && i.quantity > 0)
      .map((i) => ({
        productId: String(i.productId),
        productName: String(i.productName || 'Item'),
        barcode: i.barcode || undefined,
        quantity: Number(i.quantity) || 1,
        unitPrice: Number(i.unitPrice) || 0,
        costPrice: typeof i.costPrice === 'number' ? i.costPrice : 0,
        taxRate: typeof i.taxRate === 'number' ? i.taxRate : 0,
        priceIncludesGst: Boolean(i.priceIncludesGst),
        discountType: i.discountType,
        discountValue: typeof i.discountValue === 'number' ? i.discountValue : 0,
        discountAmount: typeof i.discountAmount === 'number' ? i.discountAmount : 0,
        discountApplied: Boolean(i.discountApplied),
        total: Number(i.total) || 0,
      }));

    if (cleanSaleItems.length === 0) {
      checkoutLockRef.current = false;
      Alert.alert('Empty Cart', 'Please add at least one item to complete the sale.');
      return;
    }

    const validCustomerId =
      selectedCustomerId &&
      selectedCustomerId.trim() !== '' &&
      selectedCustomerId !== 'walkin' &&
      !selectedCustomerId.startsWith('temp-')
        ? selectedCustomerId.trim()
        : undefined;

    const salePayload = {
      items: cleanSaleItems,
      subtotal: saleData.subtotal,
      totalDiscount: saleData.totalDiscount,
      totalTax: saleData.totalTax,
      billCharges: saleData.billCharges,
      extraChargesTotal: saleData.extraChargesTotal,
      grandTotal: saleData.grandTotal,
      paymentMethod,
      amountPaid: saleData.amountPaid ?? grandTotalNow,
      changeReturned: saleData.changeReturned ?? 0,
      customerId: validCustomerId,
      isQuickBill: false,
    };

    // Pay Now opens the preview and auto-prints the thermal slip. Saving still waits
    // until the bill is confirmed (print / share) so Edit Bill can still go back to the cart.
    pendingSalePayloadRef.current = { payload: salePayload, provisionalInv };
    saleCommittedRef.current = false;
    setPreviewSaleData(saleData);
    return true;
  };

  /** Print to thermal, open preview, and save the invoice when the bill is confirmed. */
  const handlePrintCheckout = () => {
    directSaveRequestedRef.current = false;
    if (!prepareCheckout()) return;
    setShowReceiptPreviewModal(true);
  };

  /** Standalone POS path: save the sale directly without opening any printer flow. */
  const handleDirectSaveCheckout = () => {
    if (!prepareCheckout()) return;
    directSaveRequestedRef.current = true;
    setCheckoutModalOpen(false);
    commitPendingSale();
  };

  /**
   * Commits the pending sale exactly once, whatever confirms it (thermal print,
   * A4 print or WhatsApp share). Guarded by a ref because the preview stays open
   * afterwards and a reprint must not create a second sale.
   */
  const commitPendingSale = () => {
    const pending = pendingSalePayloadRef.current;
    if (!pending || saleCommittedRef.current) return;
    saleCommittedRef.current = true;
    setIsSavingSalePreview(true);

    persistSaleInBackground(pending.payload, {
      onSuccess: (sale) => {
        const finalInv = sale.invoiceNumber || pending.provisionalInv;
        checkoutLockRef.current = false;
        setPreviewSaleData((prev) => (prev ? { ...prev, invoiceNumber: finalInv } : prev));
        setIsSavingSalePreview(false);
        // Only clear once the sale is actually recorded, so a failed save leaves
        // the cart intact to retry from instead of losing the basket.
        setCreditAmountReceivedInput('0');
        setBillDiscountInput('');
        clearCart();
        if (directSaveRequestedRef.current) {
          directSaveRequestedRef.current = false;
          Alert.alert(t('saleSavedSuccess', 'Sale saved'), `${t('invoiceNumber', 'Invoice')} #${finalInv}`);
        }
      },
      onError: (err) => {
        checkoutLockRef.current = false;
        setIsSavingSalePreview(false);
        // Allow another attempt — the bill printed but nothing was recorded.
        saleCommittedRef.current = false;
        directSaveRequestedRef.current = false;
        Alert.alert(
          t('saleFailed', 'Sale Not Saved'),
          err.message ||
            t(
              'saleFailedHint',
              'Receipt may have printed, but this sale was not saved. Dashboard and stock will not update until it is recorded.'
            )
        );
      },
    });
  };

  return (
    <ScreenBackground color={theme.bg}>
    <View style={[styles.container, { backgroundColor: 'transparent', paddingTop: insets.top || 12 }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={theme.bg} />
      <KeyboardAvoidingWrapper>

      {/* Top Header Bar */}
      <View style={[styles.headerRow, { borderBottomColor: theme.borderColor }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity
            onPress={() => setIsDrawerOpen(true)}
            style={[styles.menuBtn, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}
          >
            <Menu size={20} color={theme.textPrimary} />
          </TouchableOpacity>
          <View style={{ marginLeft: 10 }}>
            <Text style={styles.headerBadge}>{storeProfile.storeName || 'Point of Sale'}</Text>
            <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>{t('pos', 'Billing Counter')}</Text>
          </View>
        </View>

        {/* Secondary tools — uniform neutral buttons so they read as a toolbar, not a
            competing set of colored calls-to-action next to the primary search/browse flow. */}
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {/* Add a product mid-sale. The counter case is an item that was never
              entered, and leaving for the Products tab loses the cart. */}
          <TouchableOpacity
            onPress={openNewProductSheet}
            style={[styles.toolBtn, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}
          >
            <PackagePlus size={16} color={theme.textPrimary} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={async () => {
              if (!permission?.granted) await requestPermission();
              setShowScanner(true);
            }}
            style={[styles.toolBtn, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}
          >
            <Camera size={16} color={theme.textPrimary} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setShowDirectPrinterModal(true)}
            style={[
              styles.toolBtn,
              {
                backgroundColor:
                  activeDevice && connectionState === 'connected'
                    ? 'rgba(16, 185, 129, 0.12)'
                    : theme.cardBg,
                borderColor:
                  activeDevice && connectionState === 'connected' ? '#10B981' : theme.borderColor,
              },
            ]}
          >
            <Printer
              size={16}
              color={activeDevice && connectionState === 'connected' ? '#10B981' : theme.textPrimary}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* One search box — matches name, barcode, or SKU together, so there's no need to know
          in advance whether you're typing a product name or a scanned/typed code. */}
      <View style={styles.searchRowContainer}>
        <View style={[styles.searchInputFull, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
          <Search size={16} color={theme.textSecondary} />
          <TextInput
            style={[styles.inputField, { color: theme.textPrimary }]}
            placeholder={t('searchProducts', 'Search by name, barcode, or SKU...')}
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <X size={15} color={theme.textSecondary} />
            </TouchableOpacity>
          ) : (
            /* Scanning is the fastest way to find one item, and it was only
               reachable from the header toolbar before. */
            <TouchableOpacity
              onPress={async () => {
                if (!permission?.granted) await requestPermission();
                setShowScanner(true);
              }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={styles.searchScanBtn}
            >
              <Barcode size={16} color={BRAND_COLORS.blue600} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Category chips — horizontal, with Category Search button */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.categoryChipRow}
        contentContainerStyle={{ paddingHorizontal: 16, alignItems: 'center' }}
      >
        {/* Category Search & Picker Button */}
        <TouchableOpacity
          onPress={() => setShowCategorySearchModal(true)}
          style={[
            styles.categorySearchBtn,
            { backgroundColor: theme.cardBg, borderColor: selectedCategoryId ? BRAND_COLORS.blue600 : theme.borderColor },
          ]}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Search size={13} color={selectedCategoryId ? BRAND_COLORS.blue600 : theme.textSecondary} />
          <Text style={[styles.categorySearchBtnText, { color: selectedCategoryId ? BRAND_COLORS.blue600 : theme.textPrimary }]}>
            {t('categories', 'Categories')}
          </Text>
          <ChevronDown size={13} color={selectedCategoryId ? BRAND_COLORS.blue600 : theme.textSecondary} style={{ marginLeft: 2 }} />
        </TouchableOpacity>

        <View style={[styles.categoryDivider, { backgroundColor: theme.borderColor }]} />

        <TouchableOpacity
          onPress={() => setSelectedCategoryId(null)}
          style={[
            styles.categoryChip,
            { backgroundColor: theme.cardBg, borderColor: theme.borderColor },
            !selectedCategoryId && { backgroundColor: BRAND_COLORS.blue600, borderColor: BRAND_COLORS.blue600 },
          ]}
        >
          <Text style={[styles.categoryChipText, !selectedCategoryId ? { color: '#FFFFFF' } : { color: theme.textPrimary }]}>
            {t('allItems', 'All Items')}
          </Text>
          <Text style={[styles.categoryChipCount, !selectedCategoryId ? { color: 'rgba(255,255,255,0.8)' } : { color: theme.textSecondary }]}>
            {categoryProductCounts.activeTotal}
          </Text>
        </TouchableOpacity>

        {categories.map((cat) => {
          const selected = selectedCategoryId === cat.id;
          const count = categoryProductCounts.byCategory.get(cat.id) || 0;

          return (
            <TouchableOpacity
              key={cat.id}
              onPress={() => setSelectedCategoryId(cat.id)}
              style={[
                styles.categoryChip,
                { backgroundColor: theme.cardBg, borderColor: theme.borderColor },
                selected && { backgroundColor: BRAND_COLORS.blue600, borderColor: BRAND_COLORS.blue600 },
              ]}
            >
              <Text style={[styles.categoryChipText, selected ? { color: '#FFFFFF' } : { color: theme.textPrimary }]}>
                {cat.name}
              </Text>
              <Text style={[styles.categoryChipCount, selected ? { color: 'rgba(255,255,255,0.8)' } : { color: theme.textSecondary }]}>
                {count}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Full-width Product Grid */}
      <View style={styles.productGridContainer}>
          {loadingProducts ? (
            <ScreenLoadingState
              message={t('loadingProducts', 'Loading products...')}
              hint={t('loadingProductsHint', 'Fetching your store catalog from the server. Large inventories may take a moment.')}
              skeleton={<PosGridSkeleton />}
            />
          ) : !contentReady ? (
            <PosGridSkeleton />
          ) : productsError ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
              <Text style={{ color: theme.textPrimary, fontWeight: '800', fontSize: 15, textAlign: 'center' }}>
                Products could not be loaded
              </Text>
              <Text style={{ color: theme.textSecondary, fontSize: 12, marginTop: 8, textAlign: 'center', lineHeight: 18 }}>
                {(productsLoadError as Error)?.message || 'Ensure the backend is running and reachable from this device.'}
              </Text>
              <TouchableOpacity
                onPress={() => refetchProducts()}
                style={{ marginTop: 16, backgroundColor: BRAND_COLORS.blue600, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 12 }}
              >
                <Text style={{ color: '#FFFFFF', fontWeight: '800' }}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <PosProductGrid
              products={filteredProducts}
              isDark={isDark}
              cardBg={theme.cardBg}
              borderColor={theme.borderColor}
              textPrimary={theme.textPrimary}
              textSecondary={theme.textSecondary}
              lowStockLabel={t('lowStock', 'Low')}
              trackStock={trackStock}
              searchQuery={searchQuery}
              onClearFilters={() => {
                setSearchQuery('');
                setSelectedCategoryId(null);
              }}
              onProductLongPress={openEditProductSheet}
              onAddProductPress={() => router.push('/products' as any)}
            />
          )}
        </View>

      {/* Sticky Bottom Checkout Footer — customer row, credit amount (when applicable), totals, tender, PRINT */}
      <View
        style={[
          styles.stickyTenderFooter,
          {
            backgroundColor: theme.isDark ? '#0F172A' : '#FFFFFF',
            borderColor: theme.isDark ? 'rgba(255, 255, 255, 0.1)' : BRAND_COLORS.slate200,
            shadowColor: theme.isDark ? '#000000' : '#0F172A',
            shadowOpacity: theme.isDark ? 0.4 : 0.08,
            shadowOffset: { width: 0, height: 4 },
            shadowRadius: 16,
          },
        ]}
      >
        <TouchableOpacity
          onPress={() => setShowCustomerPicker(true)}
          style={[
            styles.customerRow,
            { borderBottomColor: theme.isDark ? 'rgba(255, 255, 255, 0.08)' : BRAND_COLORS.slate100 },
          ]}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
            <UserCircle2 size={15} color={theme.isDark ? '#60A5FA' : BRAND_COLORS.blue600} />
            <Text
              style={[
                styles.customerRowText,
                { color: theme.textPrimary },
              ]}
              numberOfLines={1}
            >
              {selectedCustomerName || t('walkInCustomer', 'Walk-in Customer')}
            </Text>
          </View>
          <View
            style={[
              styles.customerChangeBadge,
              {
                backgroundColor: theme.isDark ? 'rgba(255, 255, 255, 0.08)' : BRAND_COLORS.slate100,
              },
            ]}
          >
            <Text
              style={[
                styles.customerChangeText,
                { color: theme.textSecondary },
              ]}
            >
              {t('change', 'Change')}
            </Text>
            <ChevronDown size={11} color={theme.textSecondary} />
          </View>
        </TouchableOpacity>

        {paymentMethod === 'credit' ? (
          <View style={styles.creditRow}>
            <Text style={[styles.creditLabel, { color: theme.textSecondary }]}>{t('receivedNow', 'Received Now')} ₹</Text>
            <TextInput
              style={[
                styles.creditInput,
                {
                  backgroundColor: theme.isDark ? 'rgba(255, 255, 255, 0.08)' : BRAND_COLORS.slate100,
                  color: theme.textPrimary,
                  borderColor: theme.isDark ? 'rgba(255, 255, 255, 0.15)' : BRAND_COLORS.slate200,
                  borderWidth: 1,
                },
              ]}
              keyboardType="numeric"
              value={creditAmountReceivedInput}
              onChangeText={setCreditAmountReceivedInput}
              placeholder="0"
              placeholderTextColor={theme.textSecondary}
            />
            <Text
              style={[
                styles.creditRemainingText,
                { color: theme.isDark ? '#F59E0B' : '#D97706' },
              ]}
              numberOfLines={1}
            >
              ₹{creditRemaining.toFixed(2)} to {(selectedCustomerName || t('customer', 'customer')).split(' ')[0]}&apos;s credit
            </Text>
          </View>
        ) : null}

        <View style={styles.tenderPillsRow}>
          {([
            { method: 'cash' as const, label: 'CASH', Icon: Banknote },
            { method: 'upi' as const, label: 'UPI', Icon: QrCode },
            { method: 'card' as const, label: 'CARD', Icon: CreditCard },
            { method: 'credit' as const, label: t('credit', 'CREDIT'), Icon: BookOpen },
          ] as const).map(({ method, label, Icon }) => {
            const isSelected = paymentMethod === method;
            return (
              <TouchableOpacity
                key={method}
                onPress={() => handleSelectPaymentMethod(method)}
                style={[
                  styles.tenderChip,
                  {
                    backgroundColor: isSelected
                      ? BRAND_COLORS.blue600
                      : theme.isDark
                      ? 'rgba(255, 255, 255, 0.06)'
                      : BRAND_COLORS.slate50,
                    borderColor: isSelected
                      ? BRAND_COLORS.blue600
                      : theme.isDark
                      ? '#1E293B'
                      : BRAND_COLORS.slate200,
                  },
                ]}
              >
                <Icon
                  size={12}
                  color={
                    isSelected
                      ? '#FFFFFF'
                      : theme.isDark
                      ? '#94A3B8'
                      : '#64748B'
                  }
                  style={{ marginRight: 4 }}
                />
                <Text
                  style={[
                    styles.tenderChipText,
                    {
                      color: isSelected
                        ? '#FFFFFF'
                        : theme.isDark
                        ? '#94A3B8'
                        : '#475569',
                      fontWeight: isSelected ? '800' : '700',
                    },
                  ]}
                >
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.footerMainRow}>
          <TouchableOpacity onPress={openCheckoutModal} style={{ flex: 1, marginRight: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={[styles.tenderTotalLabel, { color: theme.textSecondary }]}>
                {t('total', 'TOTAL')}: {cartTotalCount} {cartTotalCount === 1 ? t('item', 'ITEM') : t('items', 'ITEMS')}
              </Text>
              {getTotalDiscount() > 0 ? (
                <View
                  style={{
                    backgroundColor: theme.isDark ? 'rgba(16, 185, 129, 0.2)' : 'rgba(16, 185, 129, 0.12)',
                    borderColor: theme.isDark ? 'rgba(16, 185, 129, 0.3)' : 'rgba(16, 185, 129, 0.25)',
                    borderWidth: 1,
                    paddingHorizontal: 6,
                    paddingVertical: 1.5,
                    borderRadius: 6,
                    marginLeft: 6,
                  }}
                >
                  <Text style={{ color: '#10B981', fontSize: 9, fontWeight: '800' }}>
                    Save ₹{getTotalDiscount().toFixed(0)}
                  </Text>
                </View>
              ) : null}
            </View>
            <Text style={[styles.tenderTotalPrice, { color: theme.textPrimary }]}>₹{grandTotalNow.toFixed(2)}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              if (!storeProfile.upiId) {
                Alert.alert(
                  'Business UPI ID Missing',
                  'Please add your Business UPI ID in Settings to display dynamic payment QR codes.',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Open Settings', onPress: () => router.push('/settings') },
                  ]
                );
                return;
              }
              setPaymentMethod('upi');
              setShowUpiModal(true);
            }}
            disabled={liveCartItems.length === 0}
            style={[
              styles.qrPayQuickBtn,
              liveCartItems.length === 0 && { opacity: 0.4 },
            ]}
          >
            <QrCode size={15} color="#FFFFFF" />
            <Text style={styles.qrPayQuickBtnText}>QR PAY</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handlePrintCheckout}
            disabled={liveCartItems.length === 0 || isCreating}
            style={[styles.checkoutActionBtn, (liveCartItems.length === 0 || isCreating) && { opacity: 0.5 }]}
          >
            {isCreating ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Printer size={15} color="#FFFFFF" style={{ marginRight: 5 }} />
                <Text style={styles.checkoutActionText}>{t('payNow', 'PRINT')}</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* SPLIT-SCREEN CAMERA SCANNER + LIVE CHECKOUT MODAL */}
      <Modal visible={showScanner} animationType="slide" onRequestClose={() => setShowScanner(false)}>
        <View style={[styles.splitScannerContainer, { backgroundColor: '#000000' }]}>
          <StatusBar barStyle="light-content" backgroundColor="#000000" />

          {/* TOP HALF: LIVE CAMERA SCANNER (46% HEIGHT) */}
          <View style={styles.scannerTopSection}>
            <CameraView
              style={StyleSheet.absoluteFill}
              facing="back"
              enableTorch={isTorchOn}
              onBarcodeScanned={handleBarCodeScannedToCart}
              barcodeScannerSettings={{
                barcodeTypes: [
                  'qr',
                  'ean13',
                  'ean8',
                  'code128',
                  'code39',
                  'upc_a',
                  'upc_e',
                  'itf14',
                  'codabar',
                  'pdf417',
                  'aztec',
                  'datamatrix',
                ],
              }}
            />

            {/* Viewfinder Reticle Overlay */}
            <View style={styles.viewfinderOverlay} pointerEvents="none">
              <View style={styles.reticleFrame}>
                <View style={[styles.reticleCorner, styles.reticleTopLeft]} />
                <View style={[styles.reticleCorner, styles.reticleTopRight]} />
                <View style={[styles.reticleCorner, styles.reticleBottomLeft]} />
                <View style={[styles.reticleCorner, styles.reticleBottomRight]} />
                <View style={styles.reticleLaserLine} />
              </View>
            </View>

            {/* Top Toolbar Overlay */}
            <SafeAreaView edges={['top']} style={styles.scannerTopToolbar}>
              <View style={styles.scannerTitleBox}>
                <Barcode size={18} color="#10B981" />
                <Text style={styles.scannerTitleText}>Live POS Scanner</Text>
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <TouchableOpacity
                  onPress={() => setIsTorchOn((prev) => !prev)}
                  style={[styles.scannerToolBtn, isTorchOn && { backgroundColor: '#F59E0B' }]}
                >
                  {isTorchOn ? <Flashlight size={16} color="#000" /> : <FlashlightOff size={16} color="#FFF" />}
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setShowScanner(false)}
                  style={[styles.scannerToolBtn, { backgroundColor: 'rgba(239, 68, 68, 0.85)' }]}
                >
                  <X size={18} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            </SafeAreaView>

            {/* Floating Scan Toast Banner */}
            {scanToast && (
              <View style={[styles.scanToastPill, { backgroundColor: scanToast.isError ? 'rgba(239, 68, 68, 0.95)' : 'rgba(16, 185, 129, 0.95)' }]}>
                {scanToast.isError ? (
                  <AlertCircle size={14} color="#FFF" style={{ marginRight: 6 }} />
                ) : (
                  <CheckCircle2 size={14} color="#FFF" style={{ marginRight: 6 }} />
                )}
                <Text style={styles.scanToastText} numberOfLines={1}>
                  {scanToast.message}
                </Text>
              </View>
            )}
          </View>

          {/* BOTTOM HALF: LIVE CART & INSTANT CHECKOUT (54% HEIGHT) */}
          <View style={[styles.scannerBottomSection, { backgroundColor: theme.bg, borderColor: theme.borderColor }]}>
            {/* Header: Customer & Clear Cart */}
            <View style={[styles.scannerCartHeader, { borderBottomColor: theme.borderColor }]}>
              <TouchableOpacity
                onPress={() => setShowCustomerPicker(true)}
                style={[styles.scannerCustomerChip, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}
              >
                <UserCircle2 size={14} color={BRAND_COLORS.blue600} />
                <Text style={[styles.scannerCustomerText, { color: theme.textPrimary }]} numberOfLines={1}>
                  {selectedCustomerName || t('walkInCustomer', 'Walk-in Customer')}
                </Text>
                <ChevronDown size={12} color={theme.textSecondary} />
              </TouchableOpacity>

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={[styles.scannerItemCountBadge, { color: theme.textSecondary }]}>
                  {cartTotalCount} {cartTotalCount === 1 ? t('item', 'item') : t('items', 'items')}
                </Text>
                {cartItems.length > 0 && (
                  <TouchableOpacity onPress={clearCart} style={styles.scannerClearBtn}>
                    <Trash2 size={14} color="#EF4444" />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Scrollable Live Cart Items */}
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{ padding: 12, paddingBottom: 10 }}
              showsVerticalScrollIndicator={false}
            >
              {cartItems.length === 0 ? (
                <View style={styles.scannerEmptyCartBox}>
                  <Barcode size={32} color={theme.textSecondary} />
                  <Text style={[styles.scannerEmptyTitle, { color: theme.textPrimary }]}>Ready to Scan</Text>
                  <Text style={[styles.scannerEmptySub, { color: theme.textSecondary }]}>
                    Point camera at products to add them to cart instantly.
                  </Text>
                </View>
              ) : (
                cartItems.map((item) => (
                  <TouchableOpacity
                    key={item.product.id}
                    activeOpacity={0.85}
                    delayLongPress={300}
                    onLongPress={() => openEditProductSheet(item.product)}
                    style={[styles.scannerCartItemRow, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}
                  >
                    <TouchableOpacity
                      activeOpacity={0.7}
                      onPress={() => openEditProductSheet(item.product)}
                      onLongPress={() => openEditProductSheet(item.product)}
                      delayLongPress={300}
                      style={{ flex: 1, marginRight: 8 }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                        <Text style={[styles.scannerCartItemName, { color: theme.textPrimary, flex: 1 }]} numberOfLines={1}>
                          {item.product.name}
                        </Text>
                        <Edit3 size={12} color={theme.textSecondary} />
                      </View>
                      <Text style={[styles.scannerCartItemPrice, { color: theme.textSecondary }]}>
                        ₹{item.product.sellingPrice.toFixed(2)} × {item.quantity} = <Text style={{ fontWeight: '900', color: BRAND_COLORS.blue600 }}>₹{(item.product.sellingPrice * item.quantity).toFixed(2)}</Text>
                      </Text>
                    </TouchableOpacity>

                    <View style={styles.scannerQtyStepper}>
                      <TouchableOpacity
                        onPress={() => updateQuantity(item.product.id, item.quantity - 1)}
                        style={[styles.scannerStepBtn, { backgroundColor: isDark ? '#334155' : '#E2E8F0' }]}
                      >
                        {item.quantity === 1 ? <Trash2 size={12} color="#EF4444" /> : <Minus size={12} color={theme.textPrimary} />}
                      </TouchableOpacity>
                      <Text style={[styles.scannerQtyNumber, { color: theme.textPrimary }]}>{item.quantity}</Text>
                      <TouchableOpacity
                        onPress={() => addItem(item.product, 1)}
                        style={[styles.scannerStepBtn, { backgroundColor: BRAND_COLORS.blue600 }]}
                      >
                        <Plus size={12} color="#FFFFFF" />
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>

            {/* Bottom Checkout Controls */}
            <View style={[styles.scannerCheckoutFooter, { backgroundColor: theme.cardBg, borderTopColor: theme.borderColor }]}>
              {/* Payment Mode Selector */}
              <View style={styles.scannerPayPillsRow}>
                {(['cash', 'upi', 'card', 'credit'] as const).map((mode) => {
                  const active = paymentMethod === mode;
                  return (
                    <TouchableOpacity
                      key={mode}
                      onPress={() => handleSelectPaymentMethod(mode)}
                      style={[
                        styles.scannerPayChip,
                        {
                          backgroundColor: active ? BRAND_COLORS.blue600 : theme.bg,
                          borderColor: active ? BRAND_COLORS.blue600 : theme.borderColor,
                        },
                      ]}
                    >
                      <Text style={[styles.scannerPayChipText, { color: active ? '#FFF' : theme.textSecondary }]}>
                        {mode.toUpperCase()}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Total & 1-Tap Print Button with QR Code button */}
              <View style={styles.scannerActionMainRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.scannerFooterTotalLabel, { color: theme.textSecondary }]}>{t('total', 'TOTAL PAYABLE')}</Text>
                  <Text style={[styles.scannerFooterTotalPrice, { color: BRAND_COLORS.blue600 }]}>
                    ₹{grandTotalNow.toFixed(2)}
                  </Text>
                </View>

                <TouchableOpacity
                  onPress={() => {
                    setPaymentMethod('upi');
                    setShowUpiModal(true);
                  }}
                  disabled={cartItems.length === 0}
                  style={[
                    styles.scannerQrBtn,
                    cartItems.length === 0 && { opacity: 0.4 },
                  ]}
                >
                  <QrCode size={16} color="#FFFFFF" />
                  <Text style={styles.scannerQrBtnText}>QR</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handlePrintCheckout}
                  disabled={cartItems.length === 0 || isCreating}
                  style={[
                    styles.scannerPrintChargeBtn,
                    { backgroundColor: BRAND_COLORS.blue600 },
                    (cartItems.length === 0 || isCreating) && { opacity: 0.5 },
                  ]}
                >
                  {isCreating ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Printer size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                      <Text style={styles.scannerPrintChargeBtnText}>{t('payNow', 'PRINT & CHARGE')}</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {checkoutModalOpen ? (
      <Modal visible animationType="slide">
        <SafeAreaView style={[styles.modalSafeArea, { backgroundColor: theme.bg }]}>
          <View style={{ flex: 1, padding: 16 }}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>
                {t('reviewBill', 'Review Bill')} ({cartItems.reduce((sum, item) => sum + item.quantity, 0)})
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                {cartItems.length > 0 ? (
                  <TouchableOpacity onPress={handleClearCart} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Text style={{ fontSize: 12, fontWeight: '800', color: '#EF4444' }}>{t('clearCart', 'Clear Cart')}</Text>
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity onPress={() => setCheckoutModalOpen(false)}>
                  <X size={24} color={theme.textSecondary} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Customer row */}
            <TouchableOpacity
              onPress={() => setShowCustomerPicker(true)}
              style={[styles.checkoutCustomerRow, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}
            >
              <UserCircle2 size={16} color={theme.textSecondary} />
              <Text style={[styles.checkoutCustomerText, { color: theme.textPrimary }]} numberOfLines={1}>
                {selectedCustomerName || t('walkInCustomer', 'Walk-in Customer')}
              </Text>
              <ChevronDown size={14} color={theme.textSecondary} />
            </TouchableOpacity>

            {/* Payment method */}
            <View style={styles.checkoutTenderRow}>
              {(['cash', 'upi', 'card', 'credit'] as PaymentMethod[]).map((method) => (
                <TouchableOpacity
                  key={method}
                  onPress={() => handleSelectPaymentMethod(method)}
                  style={[
                    styles.checkoutTenderChip,
                    {
                      backgroundColor: paymentMethod === method ? BRAND_COLORS.blue600 : theme.cardBg,
                      borderColor: paymentMethod === method ? BRAND_COLORS.blue600 : theme.borderColor,
                    },
                  ]}
                >
                  <Text style={[styles.checkoutTenderChipText, { color: paymentMethod === method ? '#FFFFFF' : theme.textPrimary }]}>
                    {method === 'credit' ? t('credit', 'Credit') : method.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {paymentMethod === 'credit' ? (
              <View style={[styles.checkoutCreditRow, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
                <Text style={[styles.checkoutCreditLabel, { color: theme.textSecondary }]}>{t('receivedNow', 'Received Now')} ₹</Text>
                <TextInput
                  style={[styles.checkoutCreditInput, { color: theme.textPrimary, borderColor: theme.borderColor }]}
                  keyboardType="numeric"
                  value={creditAmountReceivedInput}
                  onChangeText={setCreditAmountReceivedInput}
                  placeholder="0"
                  placeholderTextColor={theme.textSecondary}
                />
              </View>
            ) : null}

            <ScrollView style={{ flex: 1, marginBottom: 16 }} keyboardShouldPersistTaps="handled">
              {cartItems.map((item) => {
                const itemDiscAmount = getItemDiscount(item);
                const isDiscActive = Boolean(item.discountApplied && (item.discountValue || 0) > 0);
                const grossLineTotal = item.product.sellingPrice * item.quantity;
                const netLineTotal = Math.max(0, grossLineTotal - itemDiscAmount);

                return (
                  <View
                    key={item.product.id}
                    style={[styles.cartRowCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      {/* Item Image Thumbnail & Info Touch Target (tap or hold to edit) */}
                      <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => openEditProductSheet(item.product)}
                        onLongPress={() => openEditProductSheet(item.product)}
                        delayLongPress={300}
                        style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 10 }}
                      >
                        {item.product.imageUrl ? (
                          <Image source={{ uri: item.product.imageUrl }} style={{ width: 44, height: 44, borderRadius: 8, marginRight: 10 }} resizeMode="cover" />
                        ) : (
                          <View style={{ width: 44, height: 44, borderRadius: 8, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)', alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
                            <Package size={18} color={theme.textSecondary} />
                          </View>
                        )}

                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Text style={[styles.itemTitle, { color: theme.textPrimary, flex: 1 }]} numberOfLines={1}>
                              {item.product.name}
                            </Text>
                            <Edit3 size={13} color={theme.textSecondary} />
                          </View>
                          <Text style={[styles.itemSub, { color: theme.textSecondary }]}>
                            ₹{item.product.sellingPrice.toFixed(2)} each · <Text style={{ color: BRAND_COLORS.blue600, fontWeight: '700' }}>Hold to edit</Text>
                          </Text>
                        </View>
                      </TouchableOpacity>

                      <View style={styles.qtyControls}>
                        <TouchableOpacity
                          onPress={() => updateQuantity(item.product.id, item.quantity - 1)}
                          style={[styles.qtyBtn, { backgroundColor: isDark ? '#334155' : '#F1F5F9' }]}
                        >
                          <Minus size={14} color={theme.textPrimary} />
                        </TouchableOpacity>
                        <Text style={[styles.qtyText, { color: theme.textPrimary }]}>{item.quantity}</Text>
                        <TouchableOpacity
                          onPress={() => updateQuantity(item.product.id, item.quantity + 1)}
                          style={[styles.qtyBtn, { backgroundColor: isDark ? '#334155' : '#F1F5F9' }]}
                        >
                          <Plus size={14} color={theme.textPrimary} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => removeItem(item.product.id)} style={{ padding: 6, marginLeft: 6 }}>
                          <Trash2 size={16} color="#EF4444" />
                        </TouchableOpacity>
                      </View>
                    </View>

                    {/* ITEM DISCOUNT ROW & CONTROLS */}
                    <View style={[styles.itemDiscountControlRow, { borderTopColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)' }]}>
                      {/* Toggle / Mark to Apply or Remove Discount */}
                      <TouchableOpacity
                        onPress={() => toggleItemDiscount(item.product.id)}
                        style={[
                          styles.itemDiscountToggleBtn,
                          isDiscActive
                            ? { backgroundColor: 'rgba(16, 185, 129, 0.15)', borderColor: '#10B981' }
                            : { backgroundColor: theme.bg, borderColor: theme.borderColor }
                        ]}
                      >
                        <Tag size={12} color={isDiscActive ? '#10B981' : theme.textSecondary} />
                        <Text style={[styles.itemDiscountToggleText, { color: isDiscActive ? '#10B981' : theme.textSecondary }]}>
                          {isDiscActive ? 'Discount Applied' : 'Add Discount'}
                        </Text>
                      </TouchableOpacity>

                      {/* Stepper / Type switcher to increase or decrease discount as per will */}
                      {isDiscActive ? (
                        <View style={styles.itemDiscountAdjustRow}>
                          <TouchableOpacity
                            onPress={() => updateItemDiscount(item.product.id, item.discountType === 'percent' ? 'flat' : 'percent', item.discountValue || 10)}
                            style={[styles.miniTypeBtn, { backgroundColor: isDark ? '#334155' : '#E2E8F0' }]}
                          >
                            <Text style={[styles.miniTypeBtnText, { color: theme.textPrimary }]}>
                              {item.discountType === 'percent' ? '%' : '₹'}
                            </Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            onPress={() => adjustItemDiscountValue(item.product.id, -1)}
                            style={[styles.miniStepBtn, { backgroundColor: isDark ? '#334155' : '#E2E8F0' }]}
                          >
                            <Minus size={11} color={theme.textPrimary} />
                          </TouchableOpacity>

                          <Text style={[styles.miniStepValueText, { color: '#10B981' }]}>
                            {item.discountType === 'percent' ? `${item.discountValue || 0}%` : `₹${item.discountValue || 0}`}
                          </Text>

                          <TouchableOpacity
                            onPress={() => adjustItemDiscountValue(item.product.id, 1)}
                            style={[styles.miniStepBtn, { backgroundColor: isDark ? '#334155' : '#E2E8F0' }]}
                          >
                            <Plus size={11} color={theme.textPrimary} />
                          </TouchableOpacity>
                        </View>
                      ) : null}

                      {/* Line Total Calculation */}
                      <View style={{ marginLeft: 'auto', alignItems: 'flex-end' }}>
                        {itemDiscAmount > 0 ? (
                          <Text style={{ fontSize: 10, color: theme.textSecondary, textDecorationLine: 'line-through' }}>
                            ₹{grossLineTotal.toFixed(2)}
                          </Text>
                        ) : null}
                        <Text style={{ fontSize: 13, fontWeight: '800', color: isDiscActive ? '#10B981' : theme.textPrimary }}>
                          ₹{netLineTotal.toFixed(2)}
                        </Text>
                      </View>
                    </View>
                  </View>
                );
              })}

              {cartItems.length === 0 ? (
                <Text style={{ textAlign: 'center', color: theme.textSecondary, marginTop: 40 }}>Cart is empty. Tap a product to add it.</Text>
              ) : null}

              {/* OVERALL BILL DISCOUNT SECTION */}
              {cartItems.length > 0 ? (
                <View style={[styles.overallDiscountCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Tag size={15} color={BRAND_COLORS.blue600} style={{ marginRight: 6 }} />
                      <Text style={[styles.overallDiscountTitle, { color: theme.textPrimary }]}>Overall Bill Discount</Text>
                    </View>
                    {/* Segmented % vs ₹ */}
                    <View style={{ flexDirection: 'row', backgroundColor: theme.bg, borderRadius: 8, padding: 2, borderWidth: 1, borderColor: theme.borderColor }}>
                      <TouchableOpacity
                        onPress={() => {
                          setBillDiscountType('percent');
                          setCartDiscount('percent', parseFloat(billDiscountInput) || 0);
                        }}
                        style={[styles.billTypeBtn, billDiscountType === 'percent' && { backgroundColor: BRAND_COLORS.blue600 }]}
                      >
                        <Text style={[styles.billTypeBtnText, { color: billDiscountType === 'percent' ? '#FFFFFF' : theme.textSecondary }]}>% Percent</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => {
                          setBillDiscountType('flat');
                          setCartDiscount('flat', parseFloat(billDiscountInput) || 0);
                        }}
                        style={[styles.billTypeBtn, billDiscountType === 'flat' && { backgroundColor: BRAND_COLORS.blue600 }]}
                      >
                        <Text style={[styles.billTypeBtnText, { color: billDiscountType === 'flat' ? '#FFFFFF' : theme.textSecondary }]}>₹ Flat (Rs.)</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  <TextInput
                    style={[styles.overallDiscountInput, { backgroundColor: theme.bg, borderColor: theme.borderColor, color: theme.textPrimary }]}
                    value={billDiscountInput}
                    onChangeText={(val) => {
                      setBillDiscountInput(val);
                      setCartDiscount(billDiscountType, parseFloat(val) || 0);
                    }}
                    keyboardType="numeric"
                    placeholder={billDiscountType === 'percent' ? 'Enter overall discount in % (e.g. 5 or 10)' : 'Enter overall discount in ₹ (e.g. 50 or 100)'}
                    placeholderTextColor="#94A3B8"
                  />

                  {/* Quick Preset Chips */}
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 6 }} contentContainerStyle={{ gap: 6 }}>
                    {(billDiscountType === 'percent' ? ['5', '10', '15', '20'] : ['20', '50', '100', '200']).map((preset) => (
                      <TouchableOpacity
                        key={preset}
                        onPress={() => {
                          setBillDiscountInput(preset);
                          setCartDiscount(billDiscountType, parseFloat(preset));
                        }}
                        style={[
                          styles.discountPresetChip,
                          { backgroundColor: billDiscountInput === preset ? BRAND_COLORS.blue600 : theme.bg, borderColor: theme.borderColor }
                        ]}
                      >
                        <Text style={{ fontSize: 11, fontWeight: '800', color: billDiscountInput === preset ? '#FFFFFF' : theme.textPrimary }}>
                          {billDiscountType === 'percent' ? `${preset}%` : `₹${preset}`}
                        </Text>
                      </TouchableOpacity>
                    ))}
                    {billDiscountInput ? (
                      <TouchableOpacity
                        onPress={() => {
                          setBillDiscountInput('');
                          setCartDiscount('percent', 0);
                        }}
                        style={[styles.discountPresetChip, { backgroundColor: 'rgba(239, 68, 68, 0.15)', borderColor: '#EF4444' }]}
                      >
                        <Text style={{ fontSize: 11, fontWeight: '800', color: '#EF4444' }}>Clear</Text>
                      </TouchableOpacity>
                    ) : null}
                  </ScrollView>
                </View>
              ) : null}

              {cartItems.length > 0 && showBillCharges && chargePresets.length > 0 ? (
                <View style={[styles.overallDiscountCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                    <Percent size={15} color="#7C3AED" style={{ marginRight: 6 }} />
                    <Text style={[styles.overallDiscountTitle, { color: theme.textPrimary }]}>Bill Charges</Text>
                  </View>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                    {chargePresets.map((preset) => {
                      const selected = selectedChargePresetIds.includes(preset.id);
                      const previewAmount = computeChargeAmount(
                        preset,
                        getNetSubtotalForCharges(),
                        getGrossSubtotalForCharges(),
                      );
                      return (
                        <TouchableOpacity
                          key={preset.id}
                          onPress={() => toggleChargePreset(preset.id)}
                          style={[
                            styles.discountPresetChip,
                            {
                              backgroundColor: selected ? '#7C3AED' : theme.bg,
                              borderColor: selected ? '#7C3AED' : theme.borderColor,
                            },
                          ]}
                        >
                          <Text style={{ fontSize: 11, fontWeight: '800', color: selected ? '#FFFFFF' : theme.textPrimary }}>
                            {preset.label}
                          </Text>
                          <Text style={{ fontSize: 9, fontWeight: '700', color: selected ? 'rgba(255,255,255,0.85)' : theme.textSecondary, marginTop: 1 }}>
                            {preset.type === 'percent' ? `${preset.value}%` : `₹${preset.value}`} · ₹{previewAmount.toFixed(0)}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              ) : null}

              {/* BILL SUMMARY / END SECTION (After Subtotal and before Grand Total) */}
              {cartItems.length > 0 ? (
                <View style={[styles.billSummarySection, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
                  <Text style={[styles.billSummaryHeader, { color: theme.textSecondary }]}>BILL BREAKDOWN</Text>

                  {/* 1. Item Subtotal / Total */}
                  <View style={styles.billSummaryRow}>
                    <Text style={[styles.billSummaryLabel, { color: theme.textPrimary }]}>Item Subtotal (Total)</Text>
                    <Text style={[styles.billSummaryValue, { color: theme.textPrimary }]}>₹{getSubtotal().toFixed(2)}</Text>
                  </View>

                  {/* 2. DISCOUNT SECTION (Added in the bill end, after total and before grand total) */}
                  {getTotalDiscount() > 0 ? (
                    <View style={[styles.discountBreakdownBox, { backgroundColor: 'rgba(16, 185, 129, 0.08)', borderColor: 'rgba(16, 185, 129, 0.25)' }]}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                        <Tag size={13} color="#10B981" />
                        <Text style={[styles.discountSectionTitle, { color: '#10B981', marginLeft: 4 }]}>
                          Discounts Applied
                        </Text>
                      </View>

                      {getTotalItemDiscount() > 0 ? (
                        <View style={styles.discountSubRow}>
                          <Text style={[styles.discountSubLabel, { color: theme.textSecondary }]}>• Product Discounts</Text>
                          <Text style={[styles.discountSubValue, { color: '#10B981' }]}>-₹{getTotalItemDiscount().toFixed(2)}</Text>
                        </View>
                      ) : null}

                      {getBillDiscount() > 0 ? (
                        <View style={styles.discountSubRow}>
                          <Text style={[styles.discountSubLabel, { color: theme.textSecondary }]}>
                            • Overall Bill Discount ({cartDiscount.type === 'percent' ? `${cartDiscount.value}%` : `₹${cartDiscount.value}`})
                          </Text>
                          <Text style={[styles.discountSubValue, { color: '#10B981' }]}>-₹{getBillDiscount().toFixed(2)}</Text>
                        </View>
                      ) : null}

                      <View style={[styles.discountSubRow, { borderTopWidth: 1, borderTopColor: 'rgba(16, 185, 129, 0.2)', paddingTop: 4, marginTop: 4 }]}>
                        <Text style={[styles.discountTotalLabel, { color: '#10B981' }]}>Total Discount Savings</Text>
                        <Text style={[styles.discountTotalValue, { color: '#10B981' }]}>-₹{getTotalDiscount().toFixed(2)}</Text>
                      </View>
                    </View>
                  ) : null}

                  {/* 3. Tax / GST */}
                  {shouldShowGstBreakdown(gstBilling) && gstSummary.taxableValue > 0 ? (
                    <BillGstBreakdown summary={gstSummary} style={gstBilling.style} theme={theme} />
                  ) : getTotalTax() > 0 ? (
                    <View style={styles.billSummaryRow}>
                      <Text style={[styles.billSummaryLabel, { color: theme.textSecondary }]}>GST / Taxes</Text>
                      <Text style={[styles.billSummaryValue, { color: '#3B82F6' }]}>+₹{getTotalTax().toFixed(2)}</Text>
                    </View>
                  ) : null}

                  {showBillCharges ? (
                    <BillChargesBreakdown charges={getResolvedBillCharges()} theme={theme} />
                  ) : null}

                  {/* 4. Grand Total */}
                  <View style={[styles.billSummaryGrandRow, { borderTopColor: theme.borderColor }]}>
                    <Text style={[styles.billGrandLabel, { color: theme.textPrimary }]}>Grand Total</Text>
                    <Text style={[styles.billGrandValue, { color: BRAND_COLORS.blue600 }]}>₹{getGrandTotal().toFixed(2)}</Text>
                  </View>
                </View>
              ) : null}
            </ScrollView>

            <View style={styles.checkoutActionRow}>
              <TouchableOpacity
                onPress={handleDirectSaveCheckout}
                disabled={cartItems.length === 0 || isCreating}
                style={[styles.skipCheckoutBtn, { flex: 1 }, (cartItems.length === 0 || isCreating) && { opacity: 0.5 }]}
              >
                <CheckCircle2 size={16} color="#10B981" style={{ marginRight: 6 }} />
                <Text style={styles.skipCheckoutBtnText}>{t('saveWithoutPrinting', 'Save (No Print)')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handlePrintCheckout}
                disabled={cartItems.length === 0 || isCreating}
                style={[styles.submitBtn, { flex: 1 }, (cartItems.length === 0 || isCreating) && { opacity: 0.5 }]}
              >
                {isCreating ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Printer size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                    <Text style={styles.submitBtnText}>{t('printBill', 'Print Bill')}</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </Modal>
      ) : null}

      {/* Customer Picker — Walk-in by default, searchable known customers, quick-add */}
      <CustomerPickerModal
        visible={showCustomerPicker}
        onClose={() => setShowCustomerPicker(false)}
        onSelect={(id, name) => setCustomer(id, name)}
      />

      {/* LIVE THERMAL RECEIPT PREVIEW MODAL — opens immediately after Print, closing it returns to POS */}
      <PosProductSheet
        visible={productSheetOpen}
        product={productSheetTarget}
        onClose={() => setProductSheetOpen(false)}
        onCreate={(payload) => createProduct(payload as any)}
        onUpdate={async ({ id, payload }) => {
          await updateProduct({ id, payload: payload as any });
          if (payload.isAvailable === false) {
            removeItem(id);
          }
        }}
        onAdjustStock={({ id, quantity, reason }) => adjustStock({ id, payload: { change: quantity, reason } })}
      />

      <ReceiptPreviewModal
        visible={showReceiptPreviewModal}
        saleData={previewSaleData}
        isSaleSaving={isSavingSalePreview}
        autoCloseAfterPrint={false}
        autoPrintOnOpen={true}
        onConfirmed={commitPendingSale}
        onEdit={() => {
          // Straight back to the cart, which was never cleared, so the basket is
          // still exactly as it was. Nothing has been saved or printed yet.
          setShowReceiptPreviewModal(false);
          checkoutLockRef.current = false;
          pendingSalePayloadRef.current = null;
          setTimeout(() => setPreviewSaleData(null), 350);
        }}
        onClose={() => {
          const dismiss = () => {
            setShowReceiptPreviewModal(false);
            setIsSavingSalePreview(false);
            checkoutLockRef.current = false;
            pendingSalePayloadRef.current = null;
            // Defer clearing receipt data so the preview modal can finish its close animation
            // without crashing on a null saleData mid-render.
            setTimeout(() => setPreviewSaleData(null), 350);
          };

          // Nothing is recorded until the bill is printed or shared, so closing
          // before that would look like a completed sale while leaving no record.
          // The basket is still intact, so the honest option is to say so.
          if (!saleCommittedRef.current && getCartItems().length > 0) {
            Alert.alert(
              'Bill Not Completed',
              'This bill has not been printed or saved yet. Your items are still in the cart.',
              [
                { text: 'Keep Bill Open', style: 'cancel' },
                { text: 'Back to Cart', style: 'destructive', onPress: dismiss },
              ]
            );
            return;
          }
          dismiss();
        }}
      />

      {/* CATEGORY SEARCH & QUICK PICKER MODAL */}
      <Modal
        visible={showCategorySearchModal}
        animationType="fade"
        transparent
        onRequestClose={() => {
          setShowCategorySearchModal(false);
          setCategorySearchQuery('');
        }}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => {
            setShowCategorySearchModal(false);
            setCategorySearchQuery('');
          }}
        >
          <TouchableOpacity
            activeOpacity={1}
            style={[
              styles.categoryModalSheet,
              { backgroundColor: theme.cardBg, borderColor: theme.borderColor },
            ]}
          >
            <View style={styles.catModalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Layers size={18} color={BRAND_COLORS.blue600} />
                <Text style={[styles.catModalTitle, { color: theme.textPrimary, marginLeft: 8 }]}>
                  Categories ({categories.length})
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => {
                  setShowCategorySearchModal(false);
                  setCategorySearchQuery('');
                }}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <X size={20} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Category Search Input */}
            <View
              style={[
                styles.catSearchInputBox,
                {
                  backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                  borderColor: theme.borderColor,
                },
              ]}
            >
              <Search size={16} color={theme.textSecondary} />
              <TextInput
                style={[styles.catSearchInputField, { color: theme.textPrimary }]}
                placeholder="Search category name..."
                placeholderTextColor="#94A3B8"
                value={categorySearchQuery}
                onChangeText={setCategorySearchQuery}
                autoFocus
              />
              {categorySearchQuery ? (
                <TouchableOpacity onPress={() => setCategorySearchQuery('')}>
                  <X size={14} color={theme.textSecondary} />
                </TouchableOpacity>
              ) : null}
            </View>

            {/* Category Options List */}
            <ScrollView style={{ maxHeight: 360 }} showsVerticalScrollIndicator={false}>
              {/* All Items Option */}
              <TouchableOpacity
                onPress={() => {
                  setSelectedCategoryId(null);
                  setShowCategorySearchModal(false);
                  setCategorySearchQuery('');
                }}
                style={[
                  styles.catOptionRow,
                  { borderBottomColor: theme.borderColor },
                  !selectedCategoryId && {
                    backgroundColor: isDark ? 'rgba(37,99,235,0.18)' : 'rgba(37,99,235,0.08)',
                  },
                ]}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View
                    style={[
                      styles.catBullet,
                      !selectedCategoryId && { backgroundColor: BRAND_COLORS.blue600 },
                    ]}
                  />
                  <Text
                    style={[
                      styles.catOptionName,
                      {
                        color: !selectedCategoryId ? BRAND_COLORS.blue600 : theme.textPrimary,
                        fontWeight: !selectedCategoryId ? '800' : '600',
                      },
                    ]}
                  >
                    All Items
                  </Text>
                </View>
                <View
                  style={[
                    styles.catCountBadge,
                    {
                      backgroundColor: !selectedCategoryId
                        ? BRAND_COLORS.blue600
                        : isDark
                        ? 'rgba(255,255,255,0.1)'
                        : 'rgba(0,0,0,0.06)',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.catCountText,
                      { color: !selectedCategoryId ? '#FFFFFF' : theme.textSecondary },
                    ]}
                  >
                    {categoryProductCounts.activeTotal}
                  </Text>
                </View>
              </TouchableOpacity>

              {filteredCategoriesForModal.map((cat) => {
                const isSelected = selectedCategoryId === cat.id;
                const count = categoryProductCounts.byCategory.get(cat.id) || 0;

                return (
                  <TouchableOpacity
                    key={cat.id}
                    onPress={() => {
                      setSelectedCategoryId(cat.id);
                      setShowCategorySearchModal(false);
                      setCategorySearchQuery('');
                    }}
                    style={[
                      styles.catOptionRow,
                      { borderBottomColor: theme.borderColor },
                      isSelected && {
                        backgroundColor: isDark ? 'rgba(37,99,235,0.18)' : 'rgba(37,99,235,0.08)',
                      },
                    ]}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <View
                        style={[
                          styles.catBullet,
                          isSelected && { backgroundColor: BRAND_COLORS.blue600 },
                        ]}
                      />
                      <Text
                        style={[
                          styles.catOptionName,
                          {
                            color: isSelected ? BRAND_COLORS.blue600 : theme.textPrimary,
                            fontWeight: isSelected ? '800' : '600',
                          },
                        ]}
                      >
                        {cat.name}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.catCountBadge,
                        {
                          backgroundColor: isSelected
                            ? BRAND_COLORS.blue600
                            : isDark
                            ? 'rgba(255,255,255,0.1)'
                            : 'rgba(0,0,0,0.06)',
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.catCountText,
                          { color: isSelected ? '#FFFFFF' : theme.textSecondary },
                        ]}
                      >
                        {count}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}

              {filteredCategoriesForModal.length === 0 ? (
                <View style={{ paddingVertical: 28, alignItems: 'center' }}>
                  <Text style={{ fontSize: 13, color: theme.textSecondary }}>
                    No categories found matching "{categorySearchQuery}"
                  </Text>
                </View>
              ) : null}
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* DYNAMIC UPI PAYMENT MODAL */}
      <DynamicUpiPaymentModal
        visible={showUpiModal}
        onClose={() => setShowUpiModal(false)}
        amount={grandTotalNow}
        customerName={selectedCustomerName || undefined}
        onPaymentConfirmed={handlePrintCheckout}
      />

      {/* DIRECT PRINTER CONNECT MODAL */}
      <DirectPrinterConnectModal
        visible={showDirectPrinterModal}
        onClose={() => setShowDirectPrinterModal(false)}
      />

      <SidebarDrawer visible={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} />
      </KeyboardAvoidingWrapper>
    </View>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  menuBtn: { padding: 9, borderRadius: 12, borderWidth: 1 },
  headerBadge: { fontSize: 9, fontWeight: '800', color: BRAND_COLORS.sky500, textTransform: 'uppercase', letterSpacing: 0.5 },
  headerTitle: { fontSize: 19, fontWeight: '900', letterSpacing: -0.3 },
  toolBtn: { padding: 9, borderRadius: 12, borderWidth: 1, marginLeft: 6 },
  toolBtnBadge: { position: 'absolute', top: -4, right: -4, backgroundColor: '#EF4444', borderRadius: 8, minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  toolBtnBadgeText: { color: '#FFFFFF', fontSize: 9, fontWeight: '900' },
  searchRowContainer: { flexDirection: 'row', paddingHorizontal: 16, marginTop: 12, marginBottom: 12 },
  searchInputFull: { flex: 1, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 13, elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 5, shadowOffset: { width: 0, height: 2 } },
  inputField: { flex: 1, marginLeft: 10, fontSize: 14.5, fontWeight: '600' },
  categoryChipRow: { flexGrow: 0, marginBottom: 12 },
  categorySearchBtn: { flexDirection: 'row', alignItems: 'center', borderRadius: 999, borderWidth: 1.5, paddingVertical: 10, paddingHorizontal: 14, marginRight: 8 },
  categorySearchBtnText: { fontSize: 12, fontWeight: '800', marginHorizontal: 4 },
  categoryDivider: { width: 1, height: 20, marginRight: 8 },
  categoryChip: { borderRadius: 999, borderWidth: 1, paddingVertical: 10, paddingHorizontal: 16, alignItems: 'center', marginRight: 8, flexDirection: 'row' },
  categoryChipText: { fontSize: 12.5, fontWeight: '800' },
  chipSelectedLift: { elevation: 3, shadowColor: BRAND_COLORS.blue600, shadowOpacity: 0.35, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
  searchScanBtn: { paddingLeft: 8 },
  categoryChipCount: { fontSize: 10.5, fontWeight: '800', marginLeft: 6, opacity: 0.85 },
  productGridContainer: { flex: 1, paddingHorizontal: 16 },
  productTile: { width: '48.5%', borderRadius: 16, padding: 10, borderWidth: 1, marginBottom: 10, justifyContent: 'space-between', minHeight: 165 },
  tileHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  tileImageWrapper: { width: '100%', height: 65, borderRadius: 10, overflow: 'hidden', marginVertical: 4, alignItems: 'center', justifyContent: 'center' },
  tileProductImage: { width: '100%', height: '100%', borderRadius: 10 },
  tileImagePlaceholder: { width: '100%', height: '100%', borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  codeTagText: { fontSize: 9, fontWeight: '700' },
  stockBadge: { backgroundColor: 'rgba(239, 68, 68, 0.15)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  stockBadgeText: { fontSize: 9, fontWeight: '800', color: '#EF4444' },
  tileName: { fontSize: 12, fontWeight: '700', marginBottom: 6 },
  tileFooterRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto' },
  tilePrice: { fontSize: 14, fontWeight: '900', color: BRAND_COLORS.sky500 },
  inCartStepperRow: { flexDirection: 'row', alignItems: 'center' },
  tileStepBtn: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#EF4444', alignItems: 'center', justifyContent: 'center' },
  inCartQtyText: { fontSize: 11, fontWeight: '900', marginHorizontal: 6, minWidth: 14, textAlign: 'center' },
  addCircle: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  stickyTenderFooter: {
    position: 'absolute',
    bottom: 12,
    left: 14,
    right: 14,
    borderRadius: 22,
    padding: 12,
    borderWidth: 1,
    elevation: 8,
  },
  customerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 8,
    marginBottom: 8,
    borderBottomWidth: 1,
  },
  customerRowText: { flex: 1, fontSize: 13, fontWeight: '700', marginLeft: 6, marginRight: 4 },
  customerChangeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  customerChangeText: {
    fontSize: 10.5,
    fontWeight: '700',
  },
  creditRow: { flexDirection: 'row', alignItems: 'center', paddingBottom: 8, marginBottom: 4 },
  creditLabel: { fontSize: 11, fontWeight: '700' },
  creditInput: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 12,
    fontWeight: '800',
    width: 70,
    marginLeft: 4,
    marginRight: 10,
  },
  creditRemainingText: { flex: 1, fontSize: 10, fontWeight: '700' },
  footerMainRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tenderTotalLabel: { fontSize: 9.5, fontWeight: '800', letterSpacing: 0.3 },
  tenderTotalPrice: { fontSize: 19, fontWeight: '900' },
  tenderPillsRow: { flexDirection: 'row', marginBottom: 10 },
  tenderChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    marginRight: 6,
  },
  tenderChipText: { fontSize: 11, fontWeight: '800' },
  checkoutActionBtn: {
    backgroundColor: BRAND_COLORS.blue600,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    minWidth: 68,
  },
  checkoutActionText: { color: '#FFFFFF', fontWeight: '900', fontSize: 12 },
  scannerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  modalSafeArea: { flex: 1 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 20, fontWeight: '900' },
  cartRow: { borderRadius: 16, padding: 14, borderWidth: 1, marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  itemTitle: { fontSize: 14, fontWeight: '700' },
  itemSub: { fontSize: 12, marginTop: 2 },
  qtyControls: { flexDirection: 'row', alignItems: 'center' },
  qtyBtn: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  qtyText: { fontSize: 14, fontWeight: '800', paddingHorizontal: 8 },
  submitBtn: { backgroundColor: BRAND_COLORS.blue600, borderRadius: 14, paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
  submitBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },
  checkoutCustomerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
    gap: 8,
  },
  checkoutCustomerText: { flex: 1, fontSize: 13, fontWeight: '700' },
  checkoutTenderRow: { flexDirection: 'row', gap: 6, marginBottom: 10 },
  checkoutTenderChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  checkoutTenderChipText: { fontSize: 10, fontWeight: '800' },
  checkoutCreditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 10,
  },
  checkoutCreditLabel: { fontSize: 12, fontWeight: '700', marginRight: 8 },
  checkoutCreditInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 13,
    fontWeight: '800',
  },
  checkoutActionRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  skipCheckoutBtn: { borderWidth: 1, borderColor: '#10B981', backgroundColor: 'rgba(16, 185, 129, 0.08)', borderRadius: 14, paddingVertical: 14, alignItems: 'center', justifyContent: 'center', flexDirection: 'row' },
  skipCheckoutBtnText: { color: '#059669', fontWeight: '800', fontSize: 13 },
  previewBtn: {
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewBtnText: { fontWeight: '800', fontSize: 14 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  categoryModalSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, borderWidth: 1, maxHeight: '80%' },
  catModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  catModalTitle: { fontSize: 17, fontWeight: '800' },
  catSearchInputBox: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 14 },
  catSearchInputField: { flex: 1, marginLeft: 8, fontSize: 14 },
  catOptionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 12, borderBottomWidth: 1, borderRadius: 12, marginBottom: 4 },
  catBullet: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'transparent', marginRight: 10 },
  catOptionName: { fontSize: 14 },
  catCountBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  catCountText: { fontSize: 11, fontWeight: '700' },
  cartRowCard: { borderRadius: 16, padding: 14, borderWidth: 1, marginBottom: 12 },
  itemDiscountControlRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10, paddingTop: 10, borderTopWidth: 1, flexWrap: 'wrap', gap: 6 },
  itemDiscountToggleBtn: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  itemDiscountToggleText: { fontSize: 11, fontWeight: '800', marginLeft: 4 },
  itemDiscountAdjustRow: { flexDirection: 'row', alignItems: 'center', borderRadius: 8, padding: 2 },
  miniTypeBtn: { paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6, marginRight: 4 },
  miniTypeBtnText: { fontSize: 10, fontWeight: '900' },
  miniStepBtn: { width: 22, height: 22, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  miniStepValueText: { fontSize: 11, fontWeight: '900', marginHorizontal: 6, minWidth: 26, textAlign: 'center' },
  overallDiscountCard: { borderRadius: 16, padding: 14, borderWidth: 1, marginBottom: 14 },
  overallDiscountTitle: { fontSize: 13, fontWeight: '800' },
  billTypeBtn: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  billTypeBtnText: { fontSize: 10, fontWeight: '800' },
  overallDiscountInput: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, fontSize: 13 },
  discountPresetChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  billSummarySection: { borderRadius: 16, padding: 14, borderWidth: 1, marginBottom: 16 },
  billSummaryHeader: { fontSize: 11, fontWeight: '900', letterSpacing: 0.5, marginBottom: 8 },
  billSummaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  billSummaryLabel: { fontSize: 13, fontWeight: '600' },
  billSummaryValue: { fontSize: 13, fontWeight: '700' },
  discountBreakdownBox: { borderRadius: 12, padding: 10, borderWidth: 1, marginVertical: 6 },
  discountSectionTitle: { fontSize: 12, fontWeight: '800' },
  discountSubRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 3 },
  discountSubLabel: { fontSize: 11, fontWeight: '600' },
  discountSubValue: { fontSize: 11, fontWeight: '800' },
  discountTotalLabel: { fontSize: 12, fontWeight: '900' },
  discountTotalValue: { fontSize: 12, fontWeight: '900' },
  billSummaryGrandRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, paddingTop: 8, borderTopWidth: 1 },
  billGrandLabel: { fontSize: 15, fontWeight: '900' },
  billGrandValue: { fontSize: 18, fontWeight: '900' },

  // Split-Screen POS Scanner Styles
  splitScannerContainer: { flex: 1 },
  scannerTopSection: { height: '46%', width: '100%', position: 'relative', overflow: 'hidden' },
  viewfinderOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  reticleFrame: { width: 220, height: 130, position: 'relative', justifyContent: 'center', alignItems: 'center' },
  reticleCorner: { position: 'absolute', width: 22, height: 22, borderColor: '#10B981' },
  reticleTopLeft: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 6 },
  reticleTopRight: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 6 },
  reticleBottomLeft: { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 6 },
  reticleBottomRight: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 6 },
  reticleLaserLine: { width: '90%', height: 2, backgroundColor: '#EF4444', opacity: 0.85, shadowColor: '#EF4444', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 1, shadowRadius: 6, elevation: 6 },
  scannerTopToolbar: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, zIndex: 20 },
  scannerTitleBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.65)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  scannerTitleText: { color: '#FFFFFF', fontWeight: '800', fontSize: 13, marginLeft: 6 },
  scannerToolBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(0,0,0,0.65)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  scanToastPill: { position: 'absolute', bottom: 12, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, elevation: 8, zIndex: 30 },
  scanToastText: { color: '#FFFFFF', fontWeight: '800', fontSize: 12 },
  scannerBottomSection: { height: '54%', width: '100%', borderTopLeftRadius: 24, borderTopRightRadius: 24, borderTopWidth: 1, overflow: 'hidden' },
  scannerCartHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1 },
  scannerCustomerChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, borderWidth: 1, maxWidth: '60%' },
  scannerCustomerText: { fontSize: 12, fontWeight: '700', marginHorizontal: 6 },
  scannerItemCountBadge: { fontSize: 12, fontWeight: '700' },
  scannerClearBtn: { padding: 6 },
  scannerEmptyCartBox: { alignItems: 'center', justifyContent: 'center', paddingVertical: 28 },
  scannerEmptyTitle: { fontSize: 15, fontWeight: '800', marginTop: 10 },
  scannerEmptySub: { fontSize: 12, marginTop: 4, textAlign: 'center', paddingHorizontal: 20 },
  scannerCartItemRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 10, borderRadius: 12, borderWidth: 1, marginBottom: 8 },
  scannerCartItemName: { fontSize: 13, fontWeight: '800' },
  scannerCartItemPrice: { fontSize: 11, marginTop: 2 },
  scannerQtyStepper: { flexDirection: 'row', alignItems: 'center' },
  scannerStepBtn: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  scannerQtyNumber: { fontSize: 13, fontWeight: '900', marginHorizontal: 8, minWidth: 16, textAlign: 'center' },
  scannerCheckoutFooter: { paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: 1 },
  scannerPayPillsRow: { flexDirection: 'row', gap: 6, marginBottom: 10 },
  scannerPayChip: { flex: 1, alignItems: 'center', paddingVertical: 7, borderRadius: 8, borderWidth: 1 },
  scannerPayChipText: { fontSize: 10, fontWeight: '800' },
  scannerActionMainRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  scannerFooterTotalLabel: { fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  scannerFooterTotalPrice: { fontSize: 19, fontWeight: '900' },
  scannerPrintChargeBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 11, paddingHorizontal: 16, borderRadius: 12 },
  scannerPrintChargeBtnText: { color: '#FFFFFF', fontWeight: '900', fontSize: 12, letterSpacing: 0.5 },
  qrPayQuickBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#10B981', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, marginRight: 8 },
  qrPayQuickBtnText: { color: '#FFFFFF', fontWeight: '900', fontSize: 11, marginLeft: 4 },
  scannerQrBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#10B981', paddingVertical: 11, paddingHorizontal: 12, borderRadius: 12, marginRight: 8 },
  scannerQrBtnText: { color: '#FFFFFF', fontWeight: '900', fontSize: 11, marginLeft: 4 },
});

export default React.memo(PosScreen);
