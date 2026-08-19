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
    getTotalTax,
    getGrandTotal,
  } = useCartStore();

  const [showAddSheet, setShowAddSheet] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [lastScannedCode, setLastScannedCode] = useState<string | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [checkoutSuccess, setCheckoutSuccess] = useState(false);
  const [lastInvoiceNumber, setLastInvoiceNumber] = useState<string | null>(null);

  // Receipt Preview Modal State
  const [previewSaleData, setPreviewSaleData] = useState<PrintSaleData | null>(null);
  const [showReceiptPreviewModal, setShowReceiptPreviewModal] = useState(false);

  // Quick Manual Item Form
  const [itemName, setItemName] = useState('');
  const [itemPrice, setItemPrice] = useState('');
  const [itemQty, setItemQty] = useState('1');
  const [gstRate, setGstRate] = useState('18');
  const [priceIncludesGst, setPriceIncludesGst] = useState(true);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');

  const theme = useAppTheme();
  const isDark = theme.isDark;

  // Handle Instant Scan-to-Cart for POS Lite
  const handleBarCodeScannedToCart = async ({ data }: { data: string }) => {
    if (data === lastScannedCode) return;
    setLastScannedCode(data);
    Vibration.vibrate(100);

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
      Alert.alert('Item Added to Cart!', `${matched.name} (₹${matched.sellingPrice.toFixed(2)}) added.`);
    } else {
      Alert.alert('Unrecognized Barcode', `No product found matching barcode ${raw}.`);
    }

    setTimeout(() => setLastScannedCode(null), 1500);
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
    const fallbackInv = `INV-${Math.floor(1000 + Math.random() * 9000)}`;

    const subtotal = getSubtotal();
    const totalTax = getTotalTax();
    const taxableAmt = subtotal;
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
      amountPaid: grandTotal,
      changeReturned: 0,
      paymentMethod,
    };

    try {
      const sale = await createSale({
        items: cartItems.map((i) => ({
          productId: i.product.id,
          productName: i.product.name,
          quantity: i.quantity,
          unitPrice: i.product.sellingPrice,
          total: i.product.sellingPrice * i.quantity,
        })),
        subtotal: getSubtotal(),
        totalDiscount: 0,
        totalTax: getTotalTax(),
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
            <TouchableOpacity onPress={() => setShowPaymentModal(true)} style={styles.checkoutBtn}>
              <Text style={styles.checkoutBtnText}>Checkout</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* FAB + Button for manual item bottom sheet */}
        <TouchableOpacity onPress={() => setShowAddSheet(true)} style={styles.fabBtn}>
          <Plus size={28} color="#FFFFFF" />
        </TouchableOpacity>
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
});
