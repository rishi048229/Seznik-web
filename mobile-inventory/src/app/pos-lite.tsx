import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Modal,
  StyleSheet,
  Alert,
  Switch,
  StatusBar,
  Vibration,
  Image,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets, SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Plus,
  Trash2,
  X,
  Camera,
  Banknote,
  QrCode,
  CreditCard,
  UserCheck,
  CheckCircle2,
  Zap,
  ShoppingBag,
  Barcode,
  Package,
  Mic,
  MicOff,
  Printer,
  Minus,
  Flashlight,
  FlashlightOff,
  AlertCircle,
} from 'lucide-react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { useCartStore } from '@/store/useCartStore';
import { useProducts } from '@/hooks/useProducts';
import { useSales } from '@/hooks/useSales';
import { useSettings } from '@/hooks/useSettings';
import { PaymentMethod } from '@/types/sale';
import { BRAND_COLORS } from '@/constants/theme';
import { useAppTheme } from '@/hooks/useAppTheme';
import { ScreenBackground } from '@/components/ui/ScreenBackground';
import { KeyboardAvoidingWrapper } from '@/components/ui/KeyboardAvoidingWrapper';
import ThermalPrinterService, { PrintSaleData } from '@/services/PrinterService';
import { ReceiptPreviewModal } from '@/components/ui/ReceiptPreviewModal';
import { useVoiceCart, VOICE_LANGUAGES } from '@/hooks/useVoiceCart';
import type { ParsedVoiceCommand } from '@/utils/voiceCommandParser';
import { useLanguageStore } from '@/store/useLanguageStore';
import { usePrinterStore } from '@/store/usePrinterStore';
import { matchProductByCode } from '@/utils/productBarcodeMatch';
import { DynamicUpiPaymentModal } from '@/components/ui/DynamicUpiPaymentModal';

export default function PosLiteScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useLanguageStore();
  const { products, getByBarcode } = useProducts();
  const { createSale, isCreating } = useSales();
  const { settings } = useSettings();
  const { connectionState, paperWidth, topMargin, autoCut, fontSize, printCopies } = usePrinterStore();
  const [permission, requestPermission] = useCameraPermissions();

  const {
    items: cartItems,
    addItem,
    removeItem,
    updateQuantity,
    clearCart,
    getSubtotal,
    getTotalDiscount,
    getTotalTax,
    getGrandTotal,
    toSaleItems,
  } = useCartStore();

  const [showAddSheet, setShowAddSheet] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [lastScannedCode, setLastScannedCode] = useState<string | null>(null);
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [scanToast, setScanToast] = useState<{ message: string; isError?: boolean } | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [checkoutSuccess, setCheckoutSuccess] = useState(false);
  const [lastInvoiceNumber, setLastInvoiceNumber] = useState<string | null>(null);

  // Receipt Preview Modal State
  const [previewSaleData, setPreviewSaleData] = useState<PrintSaleData | null>(null);
  const [showReceiptPreviewModal, setShowReceiptPreviewModal] = useState(false);
  const [showUpiModal, setShowUpiModal] = useState(false);

  // Quick Manual Item Form
  const [itemName, setItemName] = useState('');
  const [itemPrice, setItemPrice] = useState('');
  const [itemQty, setItemQty] = useState('1');
  const [gstRate, setGstRate] = useState('18');
  const [priceIncludesGst, setPriceIncludesGst] = useState(true);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');

  const theme = useAppTheme();
  const isDark = theme.isDark;

  // Handle Instant Scan-to-Cart for Split-Screen Live Camera
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
      addItem(matched, 1);
      setScanToast({ message: `+1 ${matched.name} (₹${matched.sellingPrice.toFixed(2)})` });
    } else {
      setScanToast({ message: `Unrecognized: "${raw.length > 20 ? raw.slice(0, 20) + '...' : raw}"`, isError: true });
    }

    setTimeout(() => setLastScannedCode(null), 1000);
    setTimeout(() => setScanToast(null), 2200);
  };

  const handleAddManualItem = () => {
    if (!itemName.trim() || !itemPrice.trim()) {
      Alert.alert('Required Fields', 'Please enter item name and price.');
      return;
    }
    const price = parseFloat(itemPrice) || 0;
    const qty = parseInt(itemQty) || 1;
    const tax = parseFloat(gstRate) || 0;

    const manualProduct: any = {
      id: `manual-${Date.now()}`,
      name: itemName.trim(),
      sellingPrice: price,
      costPrice: price * 0.7,
      currentStock: 999,
      lowStockThreshold: 0,
      unit: 'pcs',
      taxRate: tax,
      priceIncludesGst,
      isActive: true,
    };

    addItem(manualProduct, qty);

    setItemName('');
    setItemPrice('');
    setItemQty('1');
    setShowAddSheet(false);
  };

  const handleCompleteSale = async () => {
    if (cartItems.length === 0) return;
    const grandTotal = getGrandTotal();
    const subtotal = getSubtotal();
    const totalDiscount = getTotalDiscount();
    const totalTax = getTotalTax();
    const fallbackInv = `INV-${Math.floor(1000 + Math.random() * 9000)}`;

    const taxableAmt = Math.max(0, subtotal - totalDiscount);
    const halfTax = totalTax / 2;

    const saleData = {
      storeName: settings?.businessName || 'Your Store Name',
      storeAddress: settings?.businessAddress || '',
      storePhone: settings?.businessPhone || '',
      storeGstin: settings?.businessGSTIN || '',
      storeLogoUrl: settings?.businessLogoURL || undefined,
      upiId: settings?.upiId || undefined,
      invoiceNumber: fallbackInv,
      date: new Date().toLocaleDateString('en-GB'),
      customerName: 'Cash Sale',
      items: cartItems.map((ci) => {
        const itemDisc = typeof ci.discountValue === 'number' && ci.discountApplied ? (ci.discountType === 'percent' ? (ci.product.sellingPrice * ci.quantity * ci.discountValue) / 100 : Math.min(ci.product.sellingPrice, ci.discountValue) * ci.quantity) : 0;
        return {
          productName: ci.product.name,
          quantity: ci.quantity,
          unitPrice: ci.product.sellingPrice,
          total: Math.max(0, ci.product.sellingPrice * ci.quantity - itemDisc),
          unit: ci.product.unit || 'Pc',
          gstRate: ci.product.taxRate || 18,
          discount: itemDisc,
        };
      }),
      subtotal,
      taxableAmt,
      sgst: halfTax,
      cgst: halfTax,
      totalDiscount,
      totalTax,
      grandTotal,
      amountPaid: grandTotal,
      changeReturned: 0,
      paymentMethod,
    };

    try {
      const sale = await createSale({
        items: toSaleItems(),
        subtotal,
        totalDiscount,
        totalTax,
        grandTotal,
        paymentMethod,
        amountPaid: grandTotal,
        changeReturned: 0,
        isQuickBill: true,
      }).catch(() => ({ invoiceNumber: fallbackInv }));

      const finalInv = (sale as any)?.invoiceNumber || fallbackInv;
      saleData.invoiceNumber = finalInv;

      setLastInvoiceNumber(finalInv);
      setPreviewSaleData(saleData);
      setShowReceiptPreviewModal(true);
      setCheckoutSuccess(true);
      setShowPaymentModal(false);
      clearCart();
    } catch (err: any) {
      setLastInvoiceNumber(fallbackInv);
      setPreviewSaleData(saleData);
      setShowReceiptPreviewModal(true);
      setCheckoutSuccess(true);
      setShowPaymentModal(false);
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

  return (
    <ScreenBackground color={theme.bg}>
    <View style={[styles.container, { backgroundColor: 'transparent', paddingTop: insets.top || 12 }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={theme.bg} />
      <View style={styles.mainWrapper}>
        {/* Header Row */}
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <ArrowLeft size={20} color={theme.textSecondary} />
            <Text style={[styles.backBtnText, { color: theme.textSecondary }]}>{t('back', 'Back')}</Text>
          </TouchableOpacity>

          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            {/* Voice Language Toggle — tap to cycle English/Hindi/Gujarati/Marathi recognition */}
            <TouchableOpacity
              onPress={cycleVoiceLang}
              disabled={isVoiceListening}
              style={[styles.voiceLangBadge, { backgroundColor: theme.cardBg, borderColor: theme.borderColor, opacity: isVoiceListening ? 0.5 : 1 }]}
            >
              <Text style={[styles.voiceLangBadgeText, { color: theme.textPrimary }]}>{currentVoiceLangLabel}</Text>
            </TouchableOpacity>

            {/* Voice-to-Cart Mic Button */}
            <TouchableOpacity
              onPress={toggleVoice}
              style={[styles.scanCartHeaderBtn, { backgroundColor: isVoiceListening ? '#EF4444' : BRAND_COLORS.blue600, paddingHorizontal: 8 }]}
            >
              {isVoiceListening ? <MicOff size={14} color="#FFFFFF" /> : <Mic size={14} color="#FFFFFF" />}
            </TouchableOpacity>

            {/* Scan-to-Cart Camera Button */}
            <TouchableOpacity
              onPress={async () => {
                if (!permission?.granted) await requestPermission();
                setShowScanner(true);
              }}
              style={styles.scanCartHeaderBtn}
            >
              <Camera size={14} color="#FFFFFF" />
              <Text style={styles.scanCartHeaderBtnText}>Scan to Cart</Text>
            </TouchableOpacity>

            <View style={styles.badge}>
              <Zap size={14} color="#FFFFFF" />
              <Text style={styles.badgeText}>POS Lite</Text>
            </View>
          </View>
        </View>

        {/* Voice-to-cart status/feedback banner */}
        {isVoiceListening || voiceFeedback ? (
          <View
            style={[
              styles.voiceBanner,
              voiceFeedback ? { backgroundColor: voiceFeedback.ok ? 'rgba(16,185,129,0.96)' : 'rgba(239,68,68,0.96)' } : { backgroundColor: 'rgba(37,99,235,0.96)' },
            ]}
          >
            <Text style={styles.voiceBannerText} numberOfLines={1}>
              {voiceFeedback ? voiceFeedback.message : 'Listening... say an item, e.g. "2 bread"'}
            </Text>
          </View>
        ) : null}

        <Text style={[styles.pageTitle, { color: theme.textPrimary }]}>Quick Rest Cart</Text>
        <Text style={[styles.pageSub, { color: theme.textSecondary }]}>
          Scan barcodes or manually add line-items with instant calculations
        </Text>

        <ScrollView style={{ flex: 1, marginTop: 16 }} contentContainerStyle={{ paddingBottom: 100 }}>
          {cartItems.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                Cart is empty. Tap "Scan to Cart" or "+" to add items.
              </Text>
            </View>
          ) : (
            cartItems.map((item) => (
              <View key={item.product.id} style={[styles.itemCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
                {item.product.imageUrl ? (
                  <Image source={{ uri: item.product.imageUrl }} style={{ width: 44, height: 44, borderRadius: 8, marginRight: 10 }} resizeMode="cover" />
                ) : (
                  <View style={{ width: 44, height: 44, borderRadius: 8, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)', alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
                    <Package size={18} color={theme.textSecondary} />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={[styles.itemTitle, { color: theme.textPrimary }]}>{item.product.name}</Text>
                  <Text style={[styles.itemSub, { color: theme.textSecondary }]}>
                    {item.quantity} x ₹{item.product.sellingPrice.toFixed(2)}
                  </Text>
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={[styles.itemTotal, { color: theme.textPrimary }]}>
                    ₹{(item.product.sellingPrice * item.quantity).toFixed(2)}
                  </Text>
                  <TouchableOpacity onPress={() => removeItem(item.product.id)} style={{ padding: 6, marginLeft: 10 }}>
                    <Trash2 size={16} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </ScrollView>

        {/* Sticky Total Footer */}
        {cartItems.length > 0 ? (
          <View style={styles.footerBar}>
            <View>
              <Text style={styles.footerLabel}>Total Amount</Text>
              <Text style={styles.footerPrice}>₹{getGrandTotal().toFixed(2)}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <TouchableOpacity
                onPress={() => {
                  setPaymentMethod('upi');
                  setShowUpiModal(true);
                }}
                style={styles.qrPayQuickBtn}
              >
                <QrCode size={16} color="#FFFFFF" />
                <Text style={styles.qrPayQuickBtnText}>QR PAY</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setShowPaymentModal(true)} style={styles.checkoutBtn}>
                <Text style={styles.checkoutBtnText}>Checkout</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        {/* FAB + Button for manual item bottom sheet */}
        <TouchableOpacity onPress={() => setShowAddSheet(true)} style={styles.fabBtn}>
          <Plus size={28} color="#FFFFFF" />
        </TouchableOpacity>
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
            {/* Header: Item count & Clear Cart */}
            <View style={[styles.scannerCartHeader, { borderBottomColor: theme.borderColor }]}>
              <Text style={[styles.scannerCartHeaderTitle, { color: theme.textPrimary }]}>
                Cart ({cartItems.length} items)
              </Text>
              {cartItems.length > 0 && (
                <TouchableOpacity onPress={clearCart} style={styles.scannerClearBtn}>
                  <Trash2 size={14} color="#EF4444" />
                </TouchableOpacity>
              )}
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
                  <View
                    key={item.product.id}
                    style={[styles.scannerCartItemRow, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}
                  >
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <Text style={[styles.scannerCartItemName, { color: theme.textPrimary }]} numberOfLines={1}>
                        {item.product.name}
                      </Text>
                      <Text style={[styles.scannerCartItemPrice, { color: theme.textSecondary }]}>
                        ₹{item.product.sellingPrice.toFixed(2)} × {item.quantity} = <Text style={{ fontWeight: '900', color: BRAND_COLORS.blue600 }}>₹{(item.product.sellingPrice * item.quantity).toFixed(2)}</Text>
                      </Text>
                    </View>

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
                  </View>
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
                      onPress={() => setPaymentMethod(mode)}
                      style={[
                        styles.scannerPayChip,
                        {
                          backgroundColor: active ? BRAND_COLORS.navyInk : theme.bg,
                          borderColor: active ? BRAND_COLORS.navyInk : theme.borderColor,
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

              {/* Total & 1-Tap Print Button */}
              <View style={styles.scannerActionMainRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.scannerFooterTotalLabel, { color: theme.textSecondary }]}>TOTAL</Text>
                  <Text style={[styles.scannerFooterTotalPrice, { color: BRAND_COLORS.blue600 }]}>
                    ₹{getGrandTotal().toFixed(2)}
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
                  onPress={handleCompleteSale}
                  disabled={cartItems.length === 0 || isCreating}
                  style={[
                    styles.scannerPrintChargeBtn,
                    { backgroundColor: BRAND_COLORS.navyInk },
                    (cartItems.length === 0 || isCreating) && { opacity: 0.5 },
                  ]}
                >
                  {isCreating ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Printer size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                      <Text style={styles.scannerPrintChargeBtnText}>PRINT BILL & CHARGE</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* Manual Item Add Sheet */}
      <Modal visible={showAddSheet} animationType="slide" transparent>
        <KeyboardAvoidingWrapper inModal>
        <View style={styles.modalOverlay}>
          <View style={[styles.bottomSheet, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
            <View style={styles.sheetHeader}>
              <Text style={[styles.sheetTitle, { color: theme.textPrimary }]}>Add Line Item</Text>
              <TouchableOpacity onPress={() => setShowAddSheet(false)}>
                <X size={24} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.label, { color: theme.textPrimary }]}>Item Name *</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.bg, borderColor: theme.borderColor, color: theme.textPrimary }]}
              value={itemName}
              onChangeText={setItemName}
              placeholder="e.g. Custom Repair Service"
              placeholderTextColor="#94A3B8"
            />

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 }}>
              <View style={{ flex: 1, marginRight: 6 }}>
                <Text style={[styles.label, { color: theme.textPrimary }]}>Price (₹) *</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.bg, borderColor: theme.borderColor, color: theme.textPrimary }]}
                  value={itemPrice}
                  onChangeText={setItemPrice}
                  keyboardType="numeric"
                  placeholder="250.00"
                  placeholderTextColor="#94A3B8"
                />
              </View>
              <View style={{ flex: 1, marginLeft: 6 }}>
                <Text style={[styles.label, { color: theme.textPrimary }]}>Quantity</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.bg, borderColor: theme.borderColor, color: theme.textPrimary }]}
                  value={itemQty}
                  onChangeText={setItemQty}
                  keyboardType="numeric"
                  placeholder="1"
                  placeholderTextColor="#94A3B8"
                />
              </View>
            </View>

            <TouchableOpacity onPress={handleAddManualItem} style={styles.submitBtn}>
              <Text style={styles.submitBtnText}>Add Item to Cart</Text>
            </TouchableOpacity>
          </View>
        </View>
        </KeyboardAvoidingWrapper>
      </Modal>

      {/* Payment Modal */}
      <Modal visible={showPaymentModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.bottomSheet, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
            <View style={styles.sheetHeader}>
              <Text style={[styles.sheetTitle, { color: theme.textPrimary }]}>Complete Sale</Text>
              <TouchableOpacity onPress={() => setShowPaymentModal(false)}>
                <X size={24} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.grandTotalText}>₹{getGrandTotal().toFixed(2)}</Text>

            <TouchableOpacity onPress={handleCompleteSale} disabled={isCreating} style={styles.submitBtn}>
              <Text style={styles.submitBtnText}>Confirm Cash / UPI Checkout</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Success Modal */}
      <Modal visible={checkoutSuccess} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.successCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
            <CheckCircle2 size={40} color="#10B981" />
            <Text style={[styles.successTitle, { color: theme.textPrimary }]}>Quick Sale Completed!</Text>
            <Text style={[styles.successSub, { color: theme.textSecondary }]}>Invoice #{lastInvoiceNumber}</Text>
            <TouchableOpacity onPress={() => setShowReceiptPreviewModal(true)} style={[styles.submitBtn, { backgroundColor: BRAND_COLORS.blue600, marginBottom: 8 }]}>
              <Text style={styles.submitBtnText}>Preview & Print Bill</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setCheckoutSuccess(false)} style={[styles.submitBtn, { backgroundColor: BRAND_COLORS.navyInk }]}>
              <Text style={styles.submitBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* DYNAMIC UPI PAYMENT MODAL */}
      <DynamicUpiPaymentModal
        visible={showUpiModal}
        onClose={() => setShowUpiModal(false)}
        amount={getGrandTotal()}
        onPaymentConfirmed={handleCompleteSale}
      />

      {/* LIVE THERMAL RECEIPT PREVIEW MODAL */}
      <ReceiptPreviewModal
        visible={showReceiptPreviewModal}
        saleData={previewSaleData}
        onClose={() => setShowReceiptPreviewModal(false)}
      />
    </View>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  mainWrapper: { flex: 1, paddingHorizontal: 16 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  backBtn: { flexDirection: 'row', alignItems: 'center' },
  backBtnText: { fontSize: 13, fontWeight: '600', marginLeft: 4 },
  scanCartHeaderBtn: { backgroundColor: BRAND_COLORS.blue600, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, flexDirection: 'row', alignItems: 'center', marginRight: 8 },
  scanCartHeaderBtnText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800', marginLeft: 4 },
  voiceBanner: { borderRadius: 12, paddingVertical: 9, paddingHorizontal: 14, marginTop: 10 },
  voiceBannerText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800', textAlign: 'center' },
  voiceLangBadge: { paddingHorizontal: 8, paddingVertical: 5, borderRadius: 10, borderWidth: 1, marginRight: 8 },
  voiceLangBadgeText: { fontSize: 10, fontWeight: '900' },
  badge: { backgroundColor: BRAND_COLORS.navyInk, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, flexDirection: 'row', alignItems: 'center' },
  badgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800', marginLeft: 4 },
  pageTitle: { fontSize: 24, fontWeight: '900' },
  pageSub: { fontSize: 12, marginTop: 2 },
  emptyContainer: { paddingVertical: 60, alignItems: 'center' },
  emptyText: { fontSize: 13, fontWeight: '600', textAlign: 'center' },
  itemCard: { borderRadius: 16, padding: 14, borderWidth: 1, marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  itemTitle: { fontSize: 14, fontWeight: '700' },
  itemSub: { fontSize: 11, marginTop: 2 },
  itemTotal: { fontSize: 15, fontWeight: '900' },
  footerBar: { position: 'absolute', bottom: 16, left: 16, right: 16, backgroundColor: BRAND_COLORS.navyInk, padding: 14, borderRadius: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  footerLabel: { fontSize: 10, color: '#94A3B8', textTransform: 'uppercase', fontWeight: '700' },
  footerPrice: { fontSize: 18, fontWeight: '900', color: '#FFFFFF' },
  checkoutBtn: { backgroundColor: BRAND_COLORS.blue600, paddingVertical: 10, paddingHorizontal: 18, borderRadius: 12 },
  checkoutBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 13 },
  fabBtn: { position: 'absolute', bottom: 84, right: 16, width: 56, height: 56, borderRadius: 28, backgroundColor: BRAND_COLORS.blue600, alignItems: 'center', justifyContent: 'center', elevation: 8 },
  scannerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' },
  bottomSheet: { borderRadius: 24, padding: 20, borderWidth: 1 },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sheetTitle: { fontSize: 18, fontWeight: '900' },
  label: { fontSize: 12, fontWeight: '700', marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: 12, padding: 12, fontSize: 14, marginBottom: 14 },
  submitBtn: { backgroundColor: BRAND_COLORS.navyInk, borderRadius: 14, paddingVertical: 14, alignItems: 'center', justifyContent: 'center', width: '100%', marginTop: 8 },
  submitBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 14 },
  grandTotalText: { fontSize: 28, fontWeight: '900', color: BRAND_COLORS.blue600, textAlign: 'center', marginBottom: 20 },
  successCard: { borderRadius: 24, padding: 24, alignItems: 'center', borderWidth: 1, marginHorizontal: 20, marginBottom: 100 },
  successTitle: { fontSize: 20, fontWeight: '900', marginTop: 10 },
  successSub: { fontSize: 12, marginBottom: 16 },

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
  scannerCartHeaderTitle: { fontSize: 14, fontWeight: '800' },
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
  qrPayQuickBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#10B981', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12 },
  qrPayQuickBtnText: { color: '#FFFFFF', fontWeight: '900', fontSize: 11, marginLeft: 4 },
  scannerQrBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#10B981', paddingVertical: 11, paddingHorizontal: 12, borderRadius: 12, marginRight: 8 },
  scannerQrBtnText: { color: '#FFFFFF', fontWeight: '900', fontSize: 11, marginLeft: 4 },
});
