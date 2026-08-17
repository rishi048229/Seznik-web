import React, { useCallback, useState } from 'react';
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
  Package,
  Mic,
  MicOff,
  Layers,
  Printer,
  Bluetooth,
} from 'lucide-react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useProducts } from '@/hooks/useProducts';
import { useCategories } from '@/hooks/useCategories';
import { useSales } from '@/hooks/useSales';
import { useSettings } from '@/hooks/useSettings';
import { useCartStore } from '@/store/useCartStore';
import { usePrinterStore } from '@/store/usePrinterStore';
import { PaymentMethod } from '@/types/sale';
import { SidebarDrawer } from '@/components/ui/SidebarDrawer';
import { useAppTheme } from '@/hooks/useAppTheme';
import { ScreenBackground } from '@/components/ui/ScreenBackground';
import { KeyboardAvoidingWrapper } from '@/components/ui/KeyboardAvoidingWrapper';
import { BRAND_COLORS } from '@/constants/theme';
import type { PrintSaleData } from '@/services/PrinterService';
import { ReceiptPreviewModal } from '@/components/ui/ReceiptPreviewModal';
import { CustomerPickerModal } from '@/components/ui/CustomerPickerModal';
import { DirectPrinterConnectModal } from '@/components/printers/DirectPrinterConnectModal';
import { useVoiceCart, VOICE_LANGUAGES } from '@/hooks/useVoiceCart';
import type { ParsedVoiceCommand } from '@/utils/voiceCommandParser';

export default function PosScreen() {
  const insets = useSafeAreaInsets();
  const { products, isLoading: loadingProducts } = useProducts();
  const { categories } = useCategories();
  const { createSale, isCreating } = useSales();
  const { settings } = useSettings();
  const { activeDevice, connectionState } = usePrinterStore();
  const [permission, requestPermission] = useCameraPermissions();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [showDirectPrinterModal, setShowDirectPrinterModal] = useState(false);

  const {
    items: cartItems,
    addItem,
    removeItem,
    updateQuantity,
    clearCart,
    getSubtotal,
    getTotalTax,
    getGrandTotal,
    toSaleItems,
    selectedCustomerId,
    selectedCustomerName,
    setCustomer,
  } = useCartStore();

  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showScanner, setShowScanner] = useState(false);
  const [lastScannedCode, setLastScannedCode] = useState<string | null>(null);

  // Category Search Modal State
  const [showCategorySearchModal, setShowCategorySearchModal] = useState(false);
  const [categorySearchQuery, setCategorySearchQuery] = useState('');

  // Cart & Checkout State
  const [showCartModal, setShowCartModal] = useState(false);
  const [showCustomerPicker, setShowCustomerPicker] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [creditAmountReceivedInput, setCreditAmountReceivedInput] = useState('0');

  // Receipt Preview Modal State
  const [previewSaleData, setPreviewSaleData] = useState<PrintSaleData | null>(null);
  const [showReceiptPreviewModal, setShowReceiptPreviewModal] = useState(false);

  // Hold Orders State
  const [heldOrders, setHeldOrders] = useState<any[]>([]);

  const theme = useAppTheme();
  // Kept as a local alias — this screen references bare `isDark` in several inline styles below.
  const isDark = theme.isDark;

  const filteredProducts = products.filter((p) => {
    if (!p.isActive) return false;
    const matchesCategory = selectedCategoryId ? p.categoryId === selectedCategoryId : true;
    const q = searchQuery.trim().toLowerCase();
    // One search box matches name, barcode, or SKU together — no need to know in advance
    // whether you're typing a product name or scanning/typing a code.
    const matchesQuery = !q
      ? true
      : p.name.toLowerCase().includes(q) ||
        (p.barcode && p.barcode.toLowerCase().includes(q)) ||
        (p.sku && p.sku.toLowerCase().includes(q));
    return matchesCategory && matchesQuery;
  });

  const filteredCategoriesForModal = categories.filter((cat) => {
    if (!cat.isActive) return false;
    const q = categorySearchQuery.trim().toLowerCase();
    return !q || cat.name.toLowerCase().includes(q);
  });

  // Instant Scan-to-Cart
  const handleBarCodeScannedToCart = ({ data }: { data: string }) => {
    if (data === lastScannedCode) return;
    setLastScannedCode(data);
    Vibration.vibrate(100);

    const raw = String(data || '').trim();
    const cleanNum = raw.replace(/[^0-9]/g, '');
    const matched = products.find((p) => {
      const pBar = (p.barcode || '').trim();
      const pSku = (p.sku || '').trim();
      return (
        pBar === raw ||
        pSku === raw ||
        p.id === raw ||
        (cleanNum.length > 0 && pBar.replace(/[^0-9]/g, '') === cleanNum)
      );
    });

    if (matched) {
      addItem(matched, 1);
      Alert.alert('Added to Cart!', `${matched.name} (₹${matched.sellingPrice.toFixed(2)})`);
    } else {
      Alert.alert('Unrecognized Barcode', `No product found for "${raw}".`);
    }

    setTimeout(() => setLastScannedCode(null), 1500);
  };

  const handleHoldOrder = () => {
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
    }
  };

  // Print button = the whole checkout. For Cash/UPI/Card this creates the sale and opens the
  // receipt preview in one tap — no intermediate "Payment Method" or "Sale Completed" screens.
  const handlePrintCheckout = async () => {
    if (cartItems.length === 0) return;

    if (paymentMethod === 'credit' && !selectedCustomerId) {
      Alert.alert('Customer Required', 'Credit sales need a customer attached. Tap the Customer row to select or add one.');
      setShowCustomerPicker(true);
      return;
    }

    const grandTotal = getGrandTotal();
    const amountPaid = paymentMethod === 'credit' ? Math.max(0, Math.min(grandTotal, parseFloat(creditAmountReceivedInput) || 0)) : grandTotal;
    const changeReturned = Math.max(0, amountPaid - grandTotal);
    const fallbackInv = `INV-${Math.floor(1000 + Math.random() * 9000)}`;
    const customerName = selectedCustomerName || 'Walk-in Customer';

    const subtotal = getSubtotal();
    const totalTax = getTotalTax();
    const taxableAmt = subtotal;
    const halfTax = totalTax / 2;

    const saleData: PrintSaleData = {
      storeName: settings?.businessName || 'Your Store Name',
      storeAddress: settings?.businessAddress || '',
      storePhone: settings?.businessPhone || '',
      storeGstin: settings?.businessGSTIN || '',
      storeLogoUrl: settings?.businessLogoURL || undefined,
      upiId: settings?.upiId || undefined,
      invoiceNumber: fallbackInv,
      date: new Date().toLocaleDateString('en-GB'),
      customerName,
      items: cartItems.map((ci) => ({
        productName: ci.product.name,
        quantity: ci.quantity,
        unitPrice: ci.product.sellingPrice,
        total: ci.product.sellingPrice * ci.quantity,
        unit: ci.product.unit || 'Pc',
        gstRate: ci.product.taxRate || 18,
        discount: 0,
      })),
      subtotal,
      taxableAmt,
      sgst: halfTax,
      cgst: halfTax,
      totalDiscount: 0,
      totalTax,
      grandTotal,
      amountPaid,
      changeReturned,
      paymentMethod,
    };

    try {
      const sale = await createSale({
        items: toSaleItems(),
        subtotal: getSubtotal(),
        totalDiscount: 0,
        totalTax: getTotalTax(),
        grandTotal,
        paymentMethod,
        amountPaid,
        changeReturned,
        customerId: selectedCustomerId || undefined,
        isQuickBill: false,
      }).catch(() => ({ invoiceNumber: fallbackInv }));

      const finalInv = (sale as any)?.invoiceNumber || fallbackInv;
      saleData.invoiceNumber = finalInv;

      setPreviewSaleData(saleData);
      setShowReceiptPreviewModal(true);
      setCreditAmountReceivedInput('0');
      clearCart();
    } catch (err: any) {
      setPreviewSaleData(saleData);
      setShowReceiptPreviewModal(true);
      setCreditAmountReceivedInput('0');
      clearCart();
    }
  };

  // Voice-to-cart: "2 bread" adds, "remove 2 breads" subtracts, "remove all bread" clears the line.
  const handleVoiceCommand = useCallback(
    (cmd: ParsedVoiceCommand) => {
      if (!cmd.matchedProduct) return;
      const product = products.find((p) => p.id === cmd.matchedProduct!.id);
      if (!product) return;

      if (cmd.action === 'add') {
        addItem(product, cmd.quantity === Infinity ? 1 : cmd.quantity);
      } else if (cmd.action === 'remove') {
        const existing = cartItems.find((i) => i.product.id === product.id);
        if (!existing) return;
        if (cmd.quantity === Infinity) {
          removeItem(product.id);
        } else {
          updateQuantity(product.id, existing.quantity - cmd.quantity);
        }
      }
      Vibration.vibrate(60);
    },
    [products, cartItems, addItem, removeItem, updateQuantity]
  );

  const voiceProducts = React.useMemo(() => products.map((p) => ({ id: p.id, name: p.name })), [products]);
  const [voiceLang, setVoiceLang] = useState('en-IN');
  const { isListening: isVoiceListening, feedback: voiceFeedback, toggle: toggleVoice } = useVoiceCart({
    products: voiceProducts,
    onCommand: handleVoiceCommand,
    lang: voiceLang,
  });
  const cycleVoiceLang = () => {
    const idx = VOICE_LANGUAGES.findIndex((l) => l.code === voiceLang);
    setVoiceLang(VOICE_LANGUAGES[(idx + 1) % VOICE_LANGUAGES.length].code);
  };
  const currentVoiceLangLabel = VOICE_LANGUAGES.find((l) => l.code === voiceLang)?.short || 'EN';

  const cartTotalCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const grandTotalNow = getGrandTotal();
  const creditRemaining = Math.max(0, grandTotalNow - (parseFloat(creditAmountReceivedInput) || 0));

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
            <Text style={styles.headerBadge}>{settings?.businessName || 'Point of Sale'}</Text>
            <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>Billing Counter</Text>
          </View>
        </View>

        {/* Secondary tools — uniform neutral buttons so they read as a toolbar, not a
            competing set of colored calls-to-action next to the primary search/browse flow. */}
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity
            onPress={cycleVoiceLang}
            disabled={isVoiceListening}
            style={[styles.langBtn, { backgroundColor: theme.cardBg, borderColor: theme.borderColor, opacity: isVoiceListening ? 0.4 : 1 }]}
          >
            <Text style={[styles.langBtnText, { color: theme.textPrimary }]}>{currentVoiceLangLabel}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={toggleVoice}
            style={[
              styles.toolBtn,
              isVoiceListening
                ? { backgroundColor: '#EF4444', borderColor: '#EF4444' }
                : { backgroundColor: theme.cardBg, borderColor: theme.borderColor },
            ]}
          >
            {isVoiceListening ? <MicOff size={16} color="#FFFFFF" /> : <Mic size={16} color={theme.textPrimary} />}
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

      {/* Voice-to-cart status/feedback banner — "Listening..." while active, then the last parsed command result */}
      {isVoiceListening || voiceFeedback ? (
        <View
          style={[
            styles.voiceBanner,
            { top: (insets.top || 12) + 54 },
            voiceFeedback ? { backgroundColor: voiceFeedback.ok ? 'rgba(16,185,129,0.96)' : 'rgba(239,68,68,0.96)' } : { backgroundColor: 'rgba(37,99,235,0.96)' },
          ]}
        >
          <Text style={styles.voiceBannerText} numberOfLines={1}>
            {voiceFeedback ? voiceFeedback.message : 'Listening... say an item, e.g. "2 bread"'}
          </Text>
        </View>
      ) : null}

      {/* One search box — matches name, barcode, or SKU together, so there's no need to know
          in advance whether you're typing a product name or a scanned/typed code. */}
      <View style={styles.searchRowContainer}>
        <View style={[styles.searchInputFull, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
          <Search size={16} color={theme.textSecondary} />
          <TextInput
            style={[styles.inputField, { color: theme.textPrimary }]}
            placeholder="Search by name, barcode, or SKU..."
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <X size={14} color={theme.textSecondary} />
            </TouchableOpacity>
          ) : null}
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
            Categories
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
            All Items
          </Text>
          <Text style={[styles.categoryChipCount, !selectedCategoryId ? { color: 'rgba(255,255,255,0.8)' } : { color: theme.textSecondary }]}>
            {products.length}
          </Text>
        </TouchableOpacity>

        {categories.map((cat) => {
          const selected = selectedCategoryId === cat.id;
          const count = products.filter((p) => p.categoryId === cat.id).length;

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
            <ActivityIndicator size="large" color={BRAND_COLORS.blue600} style={{ marginVertical: 60 }} />
          ) : (
            <FlatList
              data={filteredProducts}
              keyExtractor={(item) => item.id}
              numColumns={2}
              columnWrapperStyle={{ justifyContent: 'space-between' }}
              contentContainerStyle={{ paddingBottom: 150 }}
              renderItem={({ item, index }) => {
                const inCart = cartItems.find((i) => i.product.id === item.id);
                const codeNumber = item.barcode ? item.barcode.slice(-4) : String(index + 101);

                return (
                  <TouchableOpacity
                    onPress={() => addItem(item, 1)}
                    activeOpacity={0.75}
                    style={[
                      styles.productTile,
                      {
                        backgroundColor: inCart ? 'rgba(37, 99, 235, 0.12)' : theme.cardBg,
                        borderColor: inCart ? BRAND_COLORS.blue600 : theme.borderColor,
                      },
                    ]}
                  >
                    {/* Code shown as plain muted text (secondary detail); the stock badge only
                        appears at all when it's actually a warning — a calm default, an
                        attention-grabbing exception. */}
                    <View style={styles.tileHeaderRow}>
                      <Text style={[styles.codeTagText, { color: theme.textSecondary }]}>#{codeNumber}</Text>
                      {item.currentStock <= item.lowStockThreshold ? (
                        <View style={styles.stockBadge}>
                          <Text style={styles.stockBadgeText}>Low: {item.currentStock}</Text>
                        </View>
                      ) : null}
                    </View>

                    {/* Product Photo Image Container */}
                    <View style={styles.tileImageWrapper}>
                      {item.imageUrl ? (
                        <Image source={{ uri: item.imageUrl }} style={styles.tileProductImage} resizeMode="cover" />
                      ) : (
                        <View style={[styles.tileImagePlaceholder, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' }]}>
                          <Package size={22} color={theme.textSecondary} />
                        </View>
                      )}
                    </View>

                    <Text style={[styles.tileName, { color: theme.textPrimary }]} numberOfLines={2}>
                      {item.name}
                    </Text>

                    <View style={styles.tileFooterRow}>
                      <Text style={styles.tilePrice}>₹{item.sellingPrice.toFixed(2)}</Text>

                      {inCart ? (
                        <View style={styles.inCartStepperRow}>
                          <TouchableOpacity
                            onPress={() => updateQuantity(item.id, inCart.quantity - 1)}
                            style={styles.tileStepBtn}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 4 }}
                          >
                            {inCart.quantity === 1 ? <Trash2 size={12} color="#FFFFFF" /> : <Minus size={12} color="#FFFFFF" />}
                          </TouchableOpacity>
                          <Text style={styles.inCartQtyText}>{inCart.quantity}</Text>
                          <TouchableOpacity
                            onPress={() => addItem(item, 1)}
                            style={[styles.tileStepBtn, { backgroundColor: BRAND_COLORS.blue600 }]}
                            hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }}
                          >
                            <Plus size={12} color="#FFFFFF" />
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <View style={[styles.addCircle, { backgroundColor: isDark ? '#334155' : '#F1F5F9' }]}>
                          <Plus size={14} color={theme.textSecondary} />
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              }}
            />
          )}
        </View>

      {/* Sticky Bottom Checkout Footer — customer row, credit amount (when applicable), totals, tender, PRINT */}
      <View style={[styles.stickyTenderFooter, { backgroundColor: BRAND_COLORS.navyInk }]}>
        <TouchableOpacity onPress={() => setShowCustomerPicker(true)} style={styles.customerRow}>
          <UserCircle2 size={14} color="#94A3B8" />
          <Text style={styles.customerRowText} numberOfLines={1}>
            {selectedCustomerName || 'Walk-in Customer'}
          </Text>
          <ChevronDown size={13} color="#94A3B8" />
        </TouchableOpacity>

        {paymentMethod === 'credit' ? (
          <View style={styles.creditRow}>
            <Text style={styles.creditLabel}>Received Now ₹</Text>
            <TextInput
              style={styles.creditInput}
              keyboardType="numeric"
              value={creditAmountReceivedInput}
              onChangeText={setCreditAmountReceivedInput}
              placeholder="0"
              placeholderTextColor="#64748B"
            />
            <Text style={styles.creditRemainingText} numberOfLines={1}>
              ₹{creditRemaining.toFixed(2)} to {(selectedCustomerName || 'customer').split(' ')[0]}&apos;s credit
            </Text>
          </View>
        ) : null}

        {/* Tender selection gets its own full-width row — bigger, evenly-spaced chips instead
            of squeezed next to the total and PRINT button. */}
        <View style={styles.tenderPillsRow}>
          {(['cash', 'upi', 'card', 'credit'] as const).map((method) => (
            <TouchableOpacity
              key={method}
              onPress={() => handleSelectPaymentMethod(method)}
              style={[
                styles.tenderChip,
                paymentMethod === method && { backgroundColor: BRAND_COLORS.blue600, borderColor: BRAND_COLORS.blue600 },
              ]}
            >
              <Text style={[styles.tenderChipText, paymentMethod === method ? { color: '#FFFFFF' } : { color: '#94A3B8' }]}>
                {method === 'credit' ? 'CREDIT' : method.toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Total + PRINT — the one unmistakable primary action. Print = the entire checkout,
            in one tap. */}
        <View style={styles.footerMainRow}>
          <TouchableOpacity onPress={() => setShowCartModal(true)} style={{ flex: 1, marginRight: 12 }}>
            <Text style={styles.tenderTotalLabel}>
              TOTAL: {cartTotalCount} {cartTotalCount === 1 ? 'ITEM' : 'ITEMS'}
            </Text>
            <Text style={styles.tenderTotalPrice}>₹{grandTotalNow.toFixed(2)}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handlePrintCheckout}
            disabled={cartItems.length === 0 || isCreating}
            style={[styles.checkoutActionBtn, (cartItems.length === 0 || isCreating) && { opacity: 0.5 }]}
          >
            {isCreating ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.checkoutActionText}>PRINT</Text>}
          </TouchableOpacity>
        </View>
      </View>

      {/* SCAN-TO-CART CAMERA SCANNER MODAL */}
      <Modal visible={showScanner} animationType="slide">
        <SafeAreaView style={{ flex: 1, backgroundColor: '#000000' }}>
          <View style={styles.scannerHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Barcode size={20} color="#10B981" />
              <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 16, marginLeft: 8 }}>
                Scan Barcode to Add Cart
              </Text>
            </View>
            <TouchableOpacity onPress={() => setShowScanner(false)}>
              <X size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
          <CameraView
            style={{ flex: 1 }}
            onBarcodeScanned={handleBarCodeScannedToCart}
            barcodeScannerSettings={{ barcodeTypes: ['qr', 'ean13', 'ean8', 'code128', 'upc_a'] }}
          />
        </SafeAreaView>
      </Modal>

      {/* Cart Detail Modal — optional review step, no longer a mandatory part of checkout */}
      <Modal visible={showCartModal} animationType="slide">
        <SafeAreaView style={[styles.modalSafeArea, { backgroundColor: theme.bg }]}>
          <View style={{ flex: 1, padding: 16 }}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>
                Cart Items ({cartTotalCount})
              </Text>
              <TouchableOpacity onPress={() => setShowCartModal(false)}>
                <X size={24} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ flex: 1, marginBottom: 16 }}>
              {cartItems.map((item) => (
                <View
                  key={item.product.id}
                  style={[styles.cartRow, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}
                >
                  {/* Item Image Thumbnail */}
                  {item.product.imageUrl ? (
                    <Image source={{ uri: item.product.imageUrl }} style={{ width: 44, height: 44, borderRadius: 8, marginRight: 10 }} resizeMode="cover" />
                  ) : (
                    <View style={{ width: 44, height: 44, borderRadius: 8, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)', alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
                      <Package size={18} color={theme.textSecondary} />
                    </View>
                  )}

                  <View style={{ flex: 1, marginRight: 12 }}>
                    <Text style={[styles.itemTitle, { color: theme.textPrimary }]}>{item.product.name}</Text>
                    <Text style={[styles.itemSub, { color: theme.textSecondary }]}>
                      ₹{item.product.sellingPrice.toFixed(2)} each
                    </Text>
                  </View>

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
                    <TouchableOpacity onPress={() => removeItem(item.product.id)} style={{ padding: 6, marginLeft: 8 }}>
                      <Trash2 size={16} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
              {cartItems.length === 0 ? (
                <Text style={{ textAlign: 'center', color: theme.textSecondary, marginTop: 40 }}>Cart is empty. Tap a product to add it.</Text>
              ) : null}
            </ScrollView>

            <TouchableOpacity
              onPress={() => {
                setShowCartModal(false);
                handlePrintCheckout();
              }}
              disabled={cartItems.length === 0}
              style={[styles.submitBtn, cartItems.length === 0 && { opacity: 0.5 }]}
            >
              <Text style={styles.submitBtnText}>Print Bill</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>

      {/* Customer Picker — Walk-in by default, searchable known customers, quick-add */}
      <CustomerPickerModal
        visible={showCustomerPicker}
        onClose={() => setShowCustomerPicker(false)}
        onSelect={(id, name) => setCustomer(id, name)}
      />

      {/* LIVE THERMAL RECEIPT PREVIEW MODAL — opens immediately after Print, closing it returns to POS */}
      <ReceiptPreviewModal
        visible={showReceiptPreviewModal}
        saleData={previewSaleData}
        onClose={() => setShowReceiptPreviewModal(false)}
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
                    {products.length}
                  </Text>
                </View>
              </TouchableOpacity>

              {filteredCategoriesForModal.map((cat) => {
                const isSelected = selectedCategoryId === cat.id;
                const count = products.filter((p) => p.categoryId === cat.id).length;

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
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1 },
  menuBtn: { padding: 9, borderRadius: 12, borderWidth: 1 },
  headerBadge: { fontSize: 9, fontWeight: '800', color: BRAND_COLORS.sky500, textTransform: 'uppercase', letterSpacing: 0.5 },
  headerTitle: { fontSize: 18, fontWeight: '900' },
  toolBtn: { padding: 9, borderRadius: 12, borderWidth: 1, marginLeft: 6 },
  toolBtnBadge: { position: 'absolute', top: -4, right: -4, backgroundColor: '#EF4444', borderRadius: 8, minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  toolBtnBadgeText: { color: '#FFFFFF', fontSize: 9, fontWeight: '900' },
  langBtn: { paddingHorizontal: 10, paddingVertical: 9, borderRadius: 12, borderWidth: 1, marginLeft: 6 },
  langBtnText: { fontSize: 11, fontWeight: '900' },
  voiceBanner: { position: 'absolute', left: 16, right: 16, borderRadius: 12, paddingVertical: 9, paddingHorizontal: 14, zIndex: 50, elevation: 10 },
  voiceBannerText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800', textAlign: 'center' },
  searchRowContainer: { flexDirection: 'row', paddingHorizontal: 16, marginVertical: 10 },
  searchInputFull: { flex: 1, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  inputField: { flex: 1, marginLeft: 8, fontSize: 13 },
  categoryChipRow: { flexGrow: 0, marginBottom: 10 },
  categorySearchBtn: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, borderWidth: 1, paddingVertical: 8, paddingHorizontal: 12, marginRight: 8 },
  categorySearchBtnText: { fontSize: 12, fontWeight: '800', marginHorizontal: 4 },
  categoryDivider: { width: 1, height: 20, marginRight: 8 },
  categoryChip: { borderRadius: 12, borderWidth: 1, paddingVertical: 8, paddingHorizontal: 14, alignItems: 'center', marginRight: 8, flexDirection: 'row' },
  categoryChipText: { fontSize: 12, fontWeight: '800' },
  categoryChipCount: { fontSize: 10, fontWeight: '700', marginLeft: 5 },
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
  stickyTenderFooter: { position: 'absolute', bottom: 12, left: 16, right: 16, borderRadius: 20, padding: 12, elevation: 12 },
  customerRow: { flexDirection: 'row', alignItems: 'center', paddingBottom: 8, marginBottom: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.12)' },
  customerRowText: { flex: 1, fontSize: 12, fontWeight: '700', color: '#E2E8F0', marginLeft: 6, marginRight: 4 },
  creditRow: { flexDirection: 'row', alignItems: 'center', paddingBottom: 8, marginBottom: 4 },
  creditLabel: { fontSize: 11, fontWeight: '700', color: '#94A3B8' },
  creditInput: { backgroundColor: 'rgba(255,255,255,0.1)', color: '#FFFFFF', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, fontSize: 12, fontWeight: '800', width: 70, marginLeft: 4, marginRight: 10 },
  creditRemainingText: { flex: 1, fontSize: 10, fontWeight: '700', color: '#F59E0B' },
  footerMainRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tenderTotalLabel: { fontSize: 9, fontWeight: '800', color: '#94A3B8' },
  tenderTotalPrice: { fontSize: 18, fontWeight: '900', color: '#FFFFFF' },
  tenderPillsRow: { flexDirection: 'row', marginBottom: 10 },
  tenderChip: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 10, borderWidth: 1, borderColor: '#334155', marginRight: 6 },
  tenderChipText: { fontSize: 11, fontWeight: '800' },
  checkoutActionBtn: { backgroundColor: BRAND_COLORS.blue600, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12, minWidth: 64, alignItems: 'center' },
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
  submitBtn: { backgroundColor: BRAND_COLORS.navyInk, borderRadius: 14, paddingVertical: 14, alignItems: 'center', justifyContent: 'center', width: '100%' },
  submitBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },
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
});
