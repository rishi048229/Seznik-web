import React, { useState, useMemo, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  FlatList,
  Modal,
  StyleSheet,
  Alert,
  Vibration,
  Platform,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  Menu,
  Calculator as CalcIcon,
  ShoppingBag,
  Printer,
  Share2,
  Trash2,
  Plus,
  Minus,
  Search,
  Package,
  Sparkles,
  Tag,
  Percent,
  Receipt,
  RotateCcw,
  Check,
  X,
  FileText,
  Layers,
  ArrowRight,
  Bluetooth,
} from 'lucide-react-native';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useProducts } from '@/hooks/useProducts';
import { useCartStore } from '@/store/useCartStore';
import { usePrinterStore } from '@/store/usePrinterStore';
import { useSettings } from '@/hooks/useSettings';
import { Product } from '@/types/product';
import { BRAND_COLORS } from '@/constants/theme';
import { ScreenBackground } from '@/components/ui/ScreenBackground';
import { SidebarDrawer } from '@/components/ui/SidebarDrawer';
import { DirectPrinterConnectModal } from '@/components/printers/DirectPrinterConnectModal';
import { ReceiptPreviewModal } from '@/components/ui/ReceiptPreviewModal';
import ThermalPrinterService, { PrintSaleData } from '@/services/PrinterService';
import { getTemplateById } from '@/constants/receiptTemplates';

export interface CalcTapeItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  taxRate: number; // 0, 5, 12, 18, 28
  discountPct: number; // 0..100
  isProduct: boolean;
  product?: Product;
}

export default function DedicatedCalculatorTabScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const theme = useAppTheme();
  const isDark = theme.isDark;

  const { products } = useProducts();
  const { addItem: addCartItem, clearCart } = useCartStore();
  const { activeDevice, connectionState, paperWidth, topMargin, autoCut, fontSize, printCopies, activeTemplateId } = usePrinterStore();
  const { settings } = useSettings();

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [activeMode, setActiveMode] = useState<'retail' | 'standard'>('retail');

  // Tape / Ledger items state
  const [tapeItems, setTapeItems] = useState<CalcTapeItem[]>([]);

  // Standard Calc State
  const [calcDisplay, setCalcDisplay] = useState('0');
  const [calcFormula, setCalcFormula] = useState('');
  const [memoryValue, setMemoryValue] = useState<number | null>(null);
  const [historyLedger, setHistoryLedger] = useState<string[]>([]);

  // Product Picker Modal State
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [productSearchQuery, setProductSearchQuery] = useState('');

  // Custom / Non-Product Modal State
  const [showCustomItemModal, setShowCustomItemModal] = useState(false);
  const [customItemName, setCustomItemName] = useState('');
  const [customItemPrice, setCustomItemPrice] = useState('');
  const [customItemQty, setCustomItemQty] = useState('1');
  const [customItemGst, setCustomItemGst] = useState('0');

  // Printer Connect & Receipt Preview Modal States
  const [showPrinterConnectModal, setShowPrinterConnectModal] = useState(false);
  const [showReceiptPreview, setShowReceiptPreview] = useState(false);
  const [previewData, setPreviewData] = useState<PrintSaleData | null>(null);
  const [isPrintingDirect, setIsPrintingDirect] = useState(false);

  // Filtered store products for quick picker
  const filteredProducts = useMemo(() => {
    if (!productSearchQuery.trim()) return products.slice(0, 30);
    const q = productSearchQuery.toLowerCase();
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.barcode && p.barcode.includes(q)) ||
        (p.sku && p.sku.toLowerCase().includes(q))
    );
  }, [products, productSearchQuery]);

  // Calculations for Retail Tape
  const subtotal = useMemo(() => {
    return tapeItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  }, [tapeItems]);

  const totalDiscount = useMemo(() => {
    return tapeItems.reduce((sum, item) => {
      const lineBase = item.price * item.quantity;
      return sum + (lineBase * (item.discountPct || 0)) / 100;
    }, 0);
  }, [tapeItems]);

  const totalTax = useMemo(() => {
    return tapeItems.reduce((sum, item) => {
      const lineBase = item.price * item.quantity;
      const discountedLine = lineBase - (lineBase * (item.discountPct || 0)) / 100;
      return sum + (discountedLine * (item.taxRate || 0)) / 100;
    }, 0);
  }, [tapeItems]);

  const grandTotal = Math.max(0, subtotal - totalDiscount + totalTax);

  // -------------------------------------------------------------
  // Retail Tape Handlers
  // -------------------------------------------------------------
  const handleAddProductToTape = (p: Product) => {
    Vibration.vibrate(50);
    const existingIndex = tapeItems.findIndex((item) => item.product?.id === p.id);
    if (existingIndex >= 0) {
      const updated = [...tapeItems];
      updated[existingIndex].quantity += 1;
      setTapeItems(updated);
    } else {
      const newItem: CalcTapeItem = {
        id: `tape-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        name: p.name,
        price: p.sellingPrice,
        quantity: 1,
        taxRate: p.taxRate || 0,
        discountPct: 0,
        isProduct: true,
        product: p,
      };
      setTapeItems([...tapeItems, newItem]);
    }
    setShowProductPicker(false);
    setProductSearchQuery('');
  };

  const handleAddCustomItem = () => {
    const priceNum = parseFloat(customItemPrice);
    if (isNaN(priceNum) || priceNum <= 0) {
      Alert.alert('Invalid Price', 'Please enter a valid price greater than 0.');
      return;
    }
    const qtyNum = parseFloat(customItemQty) || 1;
    const gstNum = parseFloat(customItemGst) || 0;
    const nameStr = customItemName.trim() || `Manual Item (₹${priceNum})`;

    Vibration.vibrate(50);
    const newItem: CalcTapeItem = {
      id: `custom-${Date.now()}`,
      name: nameStr,
      price: priceNum,
      quantity: qtyNum,
      taxRate: gstNum,
      discountPct: 0,
      isProduct: false,
    };

    setTapeItems([...tapeItems, newItem]);
    setCustomItemName('');
    setCustomItemPrice('');
    setCustomItemQty('1');
    setCustomItemGst('0');
    setShowCustomItemModal(false);
  };

  const handleUpdateItemQty = (id: string, delta: number) => {
    Vibration.vibrate(30);
    setTapeItems((prev) =>
      prev
        .map((item) => {
          if (item.id === id) {
            const newQ = item.quantity + delta;
            return newQ > 0 ? { ...item, quantity: newQ } : null;
          }
          return item;
        })
        .filter(Boolean) as CalcTapeItem[]
    );
  };

  const handleApplyTaxToItem = (id: string, taxRate: number) => {
    Vibration.vibrate(40);
    setTapeItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, taxRate } : item))
    );
  };

  const handleApplyDiscountToItem = (id: string, discountPct: number) => {
    Vibration.vibrate(40);
    setTapeItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, discountPct } : item))
    );
  };

  const handleRemoveTapeItem = (id: string) => {
    Vibration.vibrate(40);
    setTapeItems((prev) => prev.filter((i) => i.id !== id));
  };

  const handleClearTape = () => {
    Vibration.vibrate(60);
    setTapeItems([]);
  };

  // -------------------------------------------------------------
  // Standard Calculator Keypad Logic
  // -------------------------------------------------------------
  const handleKeypadPress = (val: string) => {
    Vibration.vibrate(20);
    if (val === 'C') {
      setCalcDisplay('0');
      setCalcFormula('');
    } else if (val === 'AC') {
      setCalcDisplay('0');
      setCalcFormula('');
      setHistoryLedger([]);
    } else if (val === '⌫') {
      if (calcDisplay.length > 1) {
        setCalcDisplay(calcDisplay.slice(0, -1));
      } else {
        setCalcDisplay('0');
      }
    } else if (val === '=') {
      try {
        const sanitized = (calcFormula + calcDisplay)
          .replace(/×/g, '*')
          .replace(/÷/g, '/')
          .replace(/%/g, '*0.01');
        // eslint-disable-next-line no-eval
        const result = Function(`'use strict'; return (${sanitized})`)();
        const resStr = Number.isFinite(result) ? String(Math.round(result * 100) / 100) : '0';
        setHistoryLedger((prev) => [`${calcFormula + calcDisplay} = ${resStr}`, ...prev.slice(0, 15)]);
        setCalcDisplay(resStr);
        setCalcFormula('');
      } catch (e) {
        setCalcDisplay('Error');
      }
    } else if (['+', '-', '×', '÷'].includes(val)) {
      setCalcFormula(`${calcFormula}${calcDisplay} ${val} `);
      setCalcDisplay('0');
    } else if (val === '%') {
      const num = parseFloat(calcDisplay) || 0;
      setCalcDisplay(String(num / 100));
    } else if (val === '.') {
      if (!calcDisplay.includes('.')) {
        setCalcDisplay(calcDisplay + '.');
      }
    } else if (val === '00') {
      if (calcDisplay !== '0') {
        setCalcDisplay(calcDisplay + '00');
      }
    } else {
      if (calcDisplay === '0') {
        setCalcDisplay(val);
      } else {
        setCalcDisplay(calcDisplay + val);
      }
    }
  };

  const handleMemoryOp = (op: 'MC' | 'MR' | 'M+' | 'M-') => {
    Vibration.vibrate(30);
    const curr = parseFloat(calcDisplay) || 0;
    if (op === 'MC') {
      setMemoryValue(null);
    } else if (op === 'MR') {
      if (memoryValue !== null) setCalcDisplay(String(memoryValue));
    } else if (op === 'M+') {
      setMemoryValue((prev) => (prev || 0) + curr);
    } else if (op === 'M-') {
      setMemoryValue((prev) => (prev || 0) - curr);
    }
  };

  const handleAddCalculatedValueToTape = () => {
    const val = parseFloat(calcDisplay);
    if (isNaN(val) || val <= 0) {
      Alert.alert('No Amount', 'Please compute or enter an amount first.');
      return;
    }
    Vibration.vibrate(50);
    const newItem: CalcTapeItem = {
      id: `calc-${Date.now()}`,
      name: calcFormula ? `Math (${calcFormula}${calcDisplay})` : `Calc Value`,
      price: val,
      quantity: 1,
      taxRate: 0,
      discountPct: 0,
      isProduct: false,
    };
    setTapeItems([...tapeItems, newItem]);
    setActiveMode('retail');
    setCalcDisplay('0');
    setCalcFormula('');
  };

  // -------------------------------------------------------------
  // Push to POS & Quick Actions
  // -------------------------------------------------------------
  const handlePushToPOS = () => {
    if (tapeItems.length === 0) {
      Alert.alert('Empty Calculator', 'Add some products or manual calculations before pushing to POS.');
      return;
    }
    clearCart();
    tapeItems.forEach((item) => {
      if (item.isProduct && item.product) {
        addCartItem(item.product, item.quantity);
      } else {
        const dummyProduct: Product = {
          id: `custom-prod-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
          name: item.name,
          sellingPrice: item.price,
          costPrice: item.price,
          currentStock: 999,
          lowStockThreshold: 0,
          barcode: '',
          taxRate: item.taxRate,
          priceIncludesGst: true,
          unit: 'Piece',
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        addCartItem(dummyProduct, item.quantity);
      }
    });

    Vibration.vibrate(80);
    router.push('/(tabs)/pos' as any);
  };

  const buildPrintSaleData = (): PrintSaleData => {
    const fallbackInv = `EST-${Date.now().toString().slice(-6)}`;
    const halfTax = totalTax / 2;

    return {
      invoiceNumber: fallbackInv,
      date: `${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
      storeName: settings?.businessName || 'SEZNIK RETAIL',
      storeAddress: settings?.businessAddress || 'Retail Store Outlet',
      storePhone: settings?.businessPhone || '',
      storeGstin: (settings as any)?.gstin || (settings as any)?.taxNumber || '',
      items: tapeItems.map((item) => ({
        productName: item.name,
        quantity: item.quantity,
        unitPrice: item.price,
        total: (item.price * item.quantity) - ((item.price * item.quantity * (item.discountPct || 0)) / 100),
        gstRate: item.taxRate,
      })),
      subtotal,
      taxableAmt: subtotal - totalDiscount,
      sgst: halfTax,
      cgst: halfTax,
      totalDiscount,
      totalTax,
      grandTotal,
      amountPaid: grandTotal,
      changeReturned: 0,
      paymentMethod: 'CASH',
    };
  };

  const handlePrintEstimateOrBill = async () => {
    if (tapeItems.length === 0) {
      Alert.alert('Empty Calculator', 'Add some items or calculations first.');
      return;
    }

    const saleData = buildPrintSaleData();
    setPreviewData(saleData);

    if (!activeDevice || connectionState !== 'connected') {
      setShowPrinterConnectModal(true);
      return;
    }

    setIsPrintingDirect(true);
    try {
      const template = getTemplateById(activeTemplateId);
      const printOptions = { template, topMargin, autoCut, fontSize, copies: printCopies };
      const ok = await ThermalPrinterService.printReceipt(saleData, paperWidth, printOptions);
      if (ok) {
        Alert.alert('Estimate Printed!', 'Calculation receipt sent to thermal printer.');
      }
    } catch (e: any) {
      Alert.alert('Print Error', e?.message || 'Could not print calculator receipt.');
    } finally {
      setIsPrintingDirect(false);
    }
  };

  const handleShareWhatsAppQuote = () => {
    if (tapeItems.length === 0) {
      Alert.alert('Empty Calculator', 'Add some items or calculations first.');
      return;
    }

    let itemLines = tapeItems
      .map(
        (i, idx) =>
          `${idx + 1}. *${i.name}*\n   ${i.quantity} × ₹${i.price.toFixed(2)} = ₹${(i.price * i.quantity).toFixed(2)}${
            i.taxRate > 0 ? ` (GST +${i.taxRate}%)` : ''
          }`
      )
      .join('\n');

    const quoteText = `*${settings?.businessName || 'SEZNIK STORE'} - Price Estimate / Bill*\n` +
      `Date: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}\n\n` +
      `*ITEMS BREAKDOWN:*\n${itemLines}\n\n` +
      `----------------------------\n` +
      `*Subtotal:* ₹${subtotal.toFixed(2)}\n` +
      (totalDiscount > 0 ? `*Discount:* -₹${totalDiscount.toFixed(2)}\n` : '') +
      (totalTax > 0 ? `*GST / Taxes:* +₹${totalTax.toFixed(2)}\n` : '') +
      `*GRAND TOTAL: ₹${grandTotal.toFixed(2)}*\n\n` +
      `Thank you! Please visit again.`;

    const url = `https://wa.me/?text=${encodeURIComponent(quoteText)}`;
    Linking.openURL(url).catch(() => {
      Alert.alert('WhatsApp Error', 'Could not open WhatsApp on this device.');
    });
  };

  return (
    <ScreenBackground color={theme.bg}>
      <View style={[styles.container, { backgroundColor: 'transparent', paddingTop: insets.top || 12 }]}>
        <SidebarDrawer visible={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} />

        {/* Top Header */}
        <View style={[styles.headerRow, { borderBottomColor: theme.borderColor }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TouchableOpacity
              onPress={() => setIsDrawerOpen(true)}
              style={[styles.menuBtn, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}
            >
              <Menu size={20} color={theme.textPrimary} />
            </TouchableOpacity>
            <View style={{ marginLeft: 10 }}>
              <Text style={styles.headerBadge}>{settings?.businessName || 'Retail Toolkit'}</Text>
              <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>POS Calculator</Text>
            </View>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            {/* Direct Printer Connection Pill */}
            <TouchableOpacity
              onPress={() => setShowPrinterConnectModal(true)}
              activeOpacity={0.8}
              style={[
                styles.printerPill,
                {
                  backgroundColor:
                    activeDevice && connectionState === 'connected'
                      ? 'rgba(16, 185, 129, 0.12)'
                      : 'rgba(245, 158, 11, 0.12)',
                  borderColor:
                    activeDevice && connectionState === 'connected' ? '#10B981' : '#F59E0B',
                },
              ]}
            >
              <Bluetooth
                size={14}
                color={activeDevice && connectionState === 'connected' ? '#10B981' : '#D97706'}
              />
              <Text
                style={[
                  styles.printerPillText,
                  { color: activeDevice && connectionState === 'connected' ? '#10B981' : '#D97706' },
                ]}
              >
                {activeDevice && connectionState === 'connected' ? 'Printer Online' : 'Connect Printer'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Dual Mode Switcher Tab Bar */}
        <View style={[styles.modeToggleBar, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
          <TouchableOpacity
            onPress={() => setActiveMode('retail')}
            style={[
              styles.modeTabBtn,
              activeMode === 'retail' && { backgroundColor: BRAND_COLORS.blue600 },
            ]}
          >
            <Layers size={15} color={activeMode === 'retail' ? '#FFFFFF' : theme.textSecondary} />
            <Text
              style={[
                styles.modeTabText,
                { color: activeMode === 'retail' ? '#FFFFFF' : theme.textSecondary },
              ]}
            >
              Retail Bill Tape ({tapeItems.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setActiveMode('standard')}
            style={[
              styles.modeTabBtn,
              activeMode === 'standard' && { backgroundColor: BRAND_COLORS.blue600 },
            ]}
          >
            <CalcIcon size={15} color={activeMode === 'standard' ? '#FFFFFF' : theme.textSecondary} />
            <Text
              style={[
                styles.modeTabText,
                { color: activeMode === 'standard' ? '#FFFFFF' : theme.textSecondary },
              ]}
            >
              Fast Math Pad
            </Text>
          </TouchableOpacity>
        </View>

        {/* ========================================================= */}
        {/* MODE 1: RETAIL BILL TAPE & ITEM CALCULATOR */}
        {/* ========================================================= */}
        {activeMode === 'retail' ? (
          <View style={{ flex: 1 }}>
            {/* Quick Add Bar: Store Products + Custom Open Item */}
            <View style={styles.quickAddBar}>
              <TouchableOpacity
                onPress={() => setShowProductPicker(true)}
                style={[styles.quickAddBtn, { backgroundColor: BRAND_COLORS.blue600 }]}
              >
                <Package size={16} color="#FFFFFF" />
                <Text style={styles.quickAddBtnText}>+ Store Product</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setShowCustomItemModal(true)}
                style={[styles.quickAddBtn, { backgroundColor: '#10B981' }]}
              >
                <Plus size={16} color="#FFFFFF" />
                <Text style={styles.quickAddBtnText}>+ Open Custom Item</Text>
              </TouchableOpacity>

              {tapeItems.length > 0 ? (
                <TouchableOpacity
                  onPress={handleClearTape}
                  style={[styles.quickClearBtn, { borderColor: theme.borderColor }]}
                >
                  <RotateCcw size={15} color="#EF4444" />
                </TouchableOpacity>
              ) : null}
            </View>

            {/* Tape Items List */}
            {tapeItems.length === 0 ? (
              <View style={styles.emptyTapeContainer}>
                <View style={[styles.emptyIconCircle, { backgroundColor: 'rgba(37, 99, 235, 0.1)' }]}>
                  <Receipt size={32} color={BRAND_COLORS.blue600} />
                </View>
                <Text style={[styles.emptyTapeTitle, { color: theme.textPrimary }]}>Calculator Tape is Empty</Text>
                <Text style={[styles.emptyTapeSub, { color: theme.textSecondary }]}>
                  Add products from your store catalog or enter custom prices with quantity & GST to compute running totals.
                </Text>

                <View style={styles.emptyActionRow}>
                  <TouchableOpacity
                    onPress={() => setShowProductPicker(true)}
                    style={[styles.emptyActionBtn, { backgroundColor: BRAND_COLORS.blue600 }]}
                  >
                    <Package size={16} color="#FFFFFF" />
                    <Text style={styles.emptyActionText}>Browse Products</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => setShowCustomItemModal(true)}
                    style={[styles.emptyActionBtn, { backgroundColor: '#10B981' }]}
                  >
                    <Plus size={16} color="#FFFFFF" />
                    <Text style={styles.emptyActionText}>Add Manual Price</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <FlatList
                data={tapeItems}
                keyExtractor={(item) => item.id}
                contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16 }}
                renderItem={({ item, index }) => {
                  const lineTotal =
                    item.price * item.quantity -
                    (item.price * item.quantity * (item.discountPct || 0)) / 100 +
                    (item.price * item.quantity * (item.taxRate || 0)) / 100;

                  return (
                    <View
                      style={[
                        styles.tapeCard,
                        { backgroundColor: theme.cardBg, borderColor: theme.borderColor },
                      ]}
                    >
                      <View style={styles.tapeCardHeader}>
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Text style={styles.tapeIndex}>{index + 1}.</Text>
                            <Text
                              style={[styles.tapeItemName, { color: theme.textPrimary }]}
                              numberOfLines={1}
                            >
                              {item.name}
                            </Text>
                          </View>
                          <Text style={[styles.tapeItemPrice, { color: theme.textSecondary }]}>
                            ₹{item.price.toFixed(2)} each {item.isProduct ? '• Catalog' : '• Manual'}
                          </Text>
                        </View>

                        <Text style={[styles.tapeLineTotal, { color: BRAND_COLORS.blue600 }]}>
                          ₹{lineTotal.toFixed(2)}
                        </Text>
                      </View>

                      {/* Stepper & Slabs Row */}
                      <View style={styles.tapeControlsRow}>
                        {/* Quantity Stepper */}
                        <View style={[styles.stepperContainer, { borderColor: theme.borderColor }]}>
                          <TouchableOpacity
                            onPress={() => handleUpdateItemQty(item.id, -1)}
                            style={styles.stepBtn}
                          >
                            <Minus size={14} color={theme.textPrimary} />
                          </TouchableOpacity>
                          <Text style={[styles.stepQtyText, { color: theme.textPrimary }]}>
                            {item.quantity}
                          </Text>
                          <TouchableOpacity
                            onPress={() => handleUpdateItemQty(item.id, 1)}
                            style={styles.stepBtn}
                          >
                            <Plus size={14} color={theme.textPrimary} />
                          </TouchableOpacity>
                        </View>

                        {/* GST Quick Chips */}
                        <View style={styles.slabChipsRow}>
                          {[0, 5, 12, 18, 28].map((gstVal) => (
                            <TouchableOpacity
                              key={gstVal}
                              onPress={() => handleApplyTaxToItem(item.id, gstVal)}
                              style={[
                                styles.slabChip,
                                {
                                  backgroundColor:
                                    item.taxRate === gstVal ? BRAND_COLORS.blue600 : 'transparent',
                                  borderColor:
                                    item.taxRate === gstVal ? BRAND_COLORS.blue600 : theme.borderColor,
                                },
                              ]}
                            >
                              <Text
                                style={[
                                  styles.slabChipText,
                                  { color: item.taxRate === gstVal ? '#FFFFFF' : theme.textSecondary },
                                ]}
                              >
                                {gstVal}%
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>

                        {/* Delete Line */}
                        <TouchableOpacity
                          onPress={() => handleRemoveTapeItem(item.id)}
                          style={styles.deleteLineBtn}
                        >
                          <Trash2 size={16} color="#EF4444" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                }}
              />
            )}

            {/* Bottom Summary Bar & 1-Tap Execution */}
            {tapeItems.length > 0 ? (
              <View
                style={[
                  styles.bottomBar,
                  { backgroundColor: theme.cardBg, borderTopColor: theme.borderColor },
                ]}
              >
                {/* Financial Summary */}
                <View style={styles.summaryGrid}>
                  <View style={styles.summaryCol}>
                    <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Subtotal</Text>
                    <Text style={[styles.summaryVal, { color: theme.textPrimary }]}>
                      ₹{subtotal.toFixed(2)}
                    </Text>
                  </View>
                  <View style={styles.summaryCol}>
                    <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Tax / GST</Text>
                    <Text style={[styles.summaryVal, { color: '#10B981' }]}>
                      +₹{totalTax.toFixed(2)}
                    </Text>
                  </View>
                  <View style={styles.summaryCol}>
                    <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Grand Total</Text>
                    <Text style={[styles.summaryGrandVal, { color: BRAND_COLORS.blue600 }]}>
                      ₹{grandTotal.toFixed(2)}
                    </Text>
                  </View>
                </View>

                {/* 1-Tap Action Buttons */}
                <View style={styles.actionButtonsRow}>
                  <TouchableOpacity
                    onPress={handlePushToPOS}
                    style={[styles.primaryActionBtn, { backgroundColor: BRAND_COLORS.navyInk }]}
                  >
                    <ShoppingBag size={16} color="#FFFFFF" />
                    <Text style={styles.primaryActionBtnText}>Push to POS Cart</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={handlePrintEstimateOrBill}
                    disabled={isPrintingDirect}
                    style={[styles.primaryActionBtn, { backgroundColor: BRAND_COLORS.blue600 }]}
                  >
                    {isPrintingDirect ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <Printer size={16} color="#FFFFFF" />
                        <Text style={styles.primaryActionBtnText}>Print Bill</Text>
                      </>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={handleShareWhatsAppQuote}
                    style={[styles.iconActionBtn, { backgroundColor: '#10B981' }]}
                  >
                    <Share2 size={16} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              </View>
            ) : null}
          </View>
        ) : (
          /* ========================================================= */
          /* MODE 2: FAST MATH PAD & RUNNING CALCULATOR */
          /* ========================================================= */
          <View style={styles.mathContainer}>
            {/* Screen Display */}
            <View style={[styles.displayBox, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
              {memoryValue !== null ? (
                <View style={styles.memBadge}>
                  <Text style={styles.memBadgeText}>M: {memoryValue}</Text>
                </View>
              ) : null}
              <Text style={[styles.formulaText, { color: theme.textSecondary }]} numberOfLines={1}>
                {calcFormula || ' '}
              </Text>
              <Text style={[styles.mainDisplayText, { color: theme.textPrimary }]} numberOfLines={1}>
                {calcDisplay}
              </Text>
            </View>

            {/* Fast Add to Tape Action */}
            <TouchableOpacity
              onPress={handleAddCalculatedValueToTape}
              style={[styles.addValueToTapeBtn, { backgroundColor: 'rgba(37, 99, 235, 0.1)', borderColor: BRAND_COLORS.blue600 }]}
            >
              <Plus size={16} color={BRAND_COLORS.blue600} />
              <Text style={[styles.addValueToTapeText, { color: BRAND_COLORS.blue600 }]}>
                Add ₹{calcDisplay} to Retail Bill Tape
              </Text>
              <ArrowRight size={16} color={BRAND_COLORS.blue600} />
            </TouchableOpacity>

            {/* Memory & Quick Tax Keys */}
            <View style={styles.quickOpsRow}>
              {(['MC', 'MR', 'M+', 'M-'] as const).map((op) => (
                <TouchableOpacity
                  key={op}
                  onPress={() => handleMemoryOp(op)}
                  style={[styles.memBtn, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}
                >
                  <Text style={[styles.memBtnText, { color: theme.textPrimary }]}>{op}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Keypad Grid */}
            <View style={styles.keypadGrid}>
              {[
                ['C', '⌫', '%', '÷'],
                ['7', '8', '9', '×'],
                ['4', '5', '6', '-'],
                ['1', '2', '3', '+'],
                ['00', '0', '.', '='],
              ].map((row, rIdx) => (
                <View key={rIdx} style={styles.keypadRow}>
                  {row.map((btn) => {
                    const isOp = ['÷', '×', '-', '+', '='].includes(btn);
                    const isEquals = btn === '=';
                    const isClear = ['C', 'AC', '⌫'].includes(btn);

                    return (
                      <TouchableOpacity
                        key={btn}
                        activeOpacity={0.7}
                        onPress={() => handleKeypadPress(btn)}
                        style={[
                          styles.keyBtn,
                          {
                            backgroundColor: isEquals
                              ? BRAND_COLORS.blue600
                              : isOp
                              ? 'rgba(37, 99, 235, 0.15)'
                              : isClear
                              ? 'rgba(239, 68, 68, 0.12)'
                              : theme.cardBg,
                            borderColor: theme.borderColor,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.keyText,
                            {
                              color: isEquals
                                ? '#FFFFFF'
                                : isOp
                                ? BRAND_COLORS.blue600
                                : isClear
                                ? '#EF4444'
                                : theme.textPrimary,
                            },
                          ]}
                        >
                          {btn}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ========================================================= */}
        {/* MODAL 1: STORE PRODUCTS QUICK PICKER */}
        {/* ========================================================= */}
        <Modal visible={showProductPicker} animationType="slide" onRequestClose={() => setShowProductPicker(false)}>
          <ScreenBackground color={theme.bg}>
            <View style={[styles.modalContainer, { paddingTop: insets.top || 12 }]}>
              {/* Header */}
              <View style={[styles.modalHeader, { borderBottomColor: theme.borderColor }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Package size={20} color={BRAND_COLORS.blue600} />
                  <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>Add Store Product</Text>
                </View>
                <TouchableOpacity onPress={() => setShowProductPicker(false)} style={styles.closeBtn}>
                  <X size={22} color={theme.textSecondary} />
                </TouchableOpacity>
              </View>

              {/* Search Bar */}
              <View style={[styles.searchBox, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
                <Search size={16} color={theme.textSecondary} />
                <TextInput
                  value={productSearchQuery}
                  onChangeText={setProductSearchQuery}
                  placeholder="Search product name, barcode, SKU..."
                  placeholderTextColor={theme.textSecondary}
                  style={[styles.searchInput, { color: theme.textPrimary }]}
                  autoFocus
                />
                {productSearchQuery ? (
                  <TouchableOpacity onPress={() => setProductSearchQuery('')}>
                    <X size={16} color={theme.textSecondary} />
                  </TouchableOpacity>
                ) : null}
              </View>

              {/* Product List */}
              <FlatList
                data={filteredProducts}
                keyExtractor={(p) => p.id}
                contentContainerStyle={{ padding: 16 }}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    onPress={() => handleAddProductToTape(item)}
                    activeOpacity={0.8}
                    style={[styles.productItemCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.prodName, { color: theme.textPrimary }]}>{item.name}</Text>
                      <Text style={[styles.prodMeta, { color: theme.textSecondary }]}>
                        Stock: {item.currentStock} {item.unit || 'pcs'} • GST: {item.taxRate || 0}%
                        {item.barcode ? ` • Barcode: ${item.barcode}` : ''}
                      </Text>
                    </View>

                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={[styles.prodPrice, { color: BRAND_COLORS.blue600 }]}>
                        ₹{item.sellingPrice.toFixed(2)}
                      </Text>
                      <View style={styles.addPill}>
                        <Plus size={12} color="#FFFFFF" />
                        <Text style={styles.addPillText}>Add</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                )}
                ListEmptyComponent={
                  <View style={styles.emptySearchBox}>
                    <Text style={{ color: theme.textSecondary, textAlign: 'center' }}>
                      No matching store products found.
                    </Text>
                  </View>
                }
              />
            </View>
          </ScreenBackground>
        </Modal>

        {/* ========================================================= */}
        {/* MODAL 2: CUSTOM / OPEN NON-PRODUCT ITEM */}
        {/* ========================================================= */}
        <Modal visible={showCustomItemModal} transparent animationType="fade" onRequestClose={() => setShowCustomItemModal(false)}>
          <View style={styles.overlay}>
            <View style={[styles.cardModal, { backgroundColor: theme.bg, borderColor: theme.borderColor }]}>
              <View style={styles.cardModalHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Tag size={18} color="#10B981" />
                  <Text style={[styles.cardModalTitle, { color: theme.textPrimary }]}>Add Custom / Open Item</Text>
                </View>
                <TouchableOpacity onPress={() => setShowCustomItemModal(false)}>
                  <X size={20} color={theme.textSecondary} />
                </TouchableOpacity>
              </View>

              <Text style={[styles.formLabel, { color: theme.textPrimary }]}>Item Name / Description</Text>
              <TextInput
                value={customItemName}
                onChangeText={setCustomItemName}
                placeholder="e.g. Labor Charge, Extra Packing, Stitching"
                placeholderTextColor={theme.textSecondary}
                style={[styles.formInput, { backgroundColor: theme.cardBg, borderColor: theme.borderColor, color: theme.textPrimary }]}
              />

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.formLabel, { color: theme.textPrimary }]}>Price (₹) *</Text>
                  <TextInput
                    value={customItemPrice}
                    onChangeText={setCustomItemPrice}
                    placeholder="0.00"
                    placeholderTextColor={theme.textSecondary}
                    keyboardType="decimal-pad"
                    style={[styles.formInput, { backgroundColor: theme.cardBg, borderColor: theme.borderColor, color: theme.textPrimary }]}
                    autoFocus
                  />
                </View>

                <View style={{ width: 100 }}>
                  <Text style={[styles.formLabel, { color: theme.textPrimary }]}>Quantity</Text>
                  <TextInput
                    value={customItemQty}
                    onChangeText={setCustomItemQty}
                    placeholder="1"
                    placeholderTextColor={theme.textSecondary}
                    keyboardType="number-pad"
                    style={[styles.formInput, { backgroundColor: theme.cardBg, borderColor: theme.borderColor, color: theme.textPrimary }]}
                  />
                </View>
              </View>

              {/* GST Slab Selector */}
              <Text style={[styles.formLabel, { color: theme.textPrimary }]}>GST Slab Rate</Text>
              <View style={styles.gstSlabRow}>
                {['0', '5', '12', '18', '28'].map((slab) => (
                  <TouchableOpacity
                    key={slab}
                    onPress={() => setCustomItemGst(slab)}
                    style={[
                      styles.gstBtn,
                      {
                        backgroundColor: customItemGst === slab ? BRAND_COLORS.blue600 : theme.cardBg,
                        borderColor: customItemGst === slab ? BRAND_COLORS.blue600 : theme.borderColor,
                      },
                    ]}
                  >
                    <Text style={[styles.gstBtnText, { color: customItemGst === slab ? '#FFFFFF' : theme.textPrimary }]}>
                      {slab}%
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity
                onPress={handleAddCustomItem}
                style={[styles.submitCustomBtn, { backgroundColor: '#10B981' }]}
              >
                <Check size={18} color="#FFFFFF" />
                <Text style={styles.submitCustomBtnText}>Add to Calculation Tape</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* ========================================================= */}
        {/* DIRECT PRINTER CONNECT DIALOG MODAL */}
        {/* ========================================================= */}
        <DirectPrinterConnectModal
          visible={showPrinterConnectModal}
          onClose={() => setShowPrinterConnectModal(false)}
          onConnected={() => {
            if (previewData) {
              setTimeout(() => {
                handlePrintEstimateOrBill();
              }, 400);
            }
          }}
          title="Connect Bluetooth Printer"
          subtitle="Pair or select your thermal receipt printer below to print this calculation."
        />

        {/* Receipt Preview Modal */}
        <ReceiptPreviewModal
          visible={showReceiptPreview}
          saleData={previewData}
          onClose={() => setShowReceiptPreview(false)}
        />
      </View>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
  },
  menuBtn: { padding: 9, borderRadius: 12, borderWidth: 1 },
  headerBadge: { fontSize: 10, fontWeight: '800', color: BRAND_COLORS.sky500, textTransform: 'uppercase', letterSpacing: 0.5 },
  headerTitle: { fontSize: 20, fontWeight: '900' },
  printerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
  },
  printerPillText: {
    fontSize: 11,
    fontWeight: '800',
    marginLeft: 5,
  },
  modeToggleBar: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 8,
    borderRadius: 14,
    padding: 3,
    borderWidth: 1,
  },
  modeTabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 11,
  },
  modeTabText: {
    fontSize: 12,
    fontWeight: '800',
    marginLeft: 6,
  },
  quickAddBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 10,
    gap: 8,
  },
  quickAddBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 12,
  },
  quickAddBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    marginLeft: 6,
  },
  quickClearBtn: {
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTapeContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
  },
  emptyIconCircle: {
    width: 68,
    height: 68,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyTapeTitle: {
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 6,
  },
  emptyTapeSub: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
  },
  emptyActionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  emptyActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
  },
  emptyActionText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    marginLeft: 6,
  },
  tapeCard: {
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  tapeCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  tapeIndex: {
    fontSize: 12,
    fontWeight: '800',
    color: '#94A3B8',
    marginRight: 6,
  },
  tapeItemName: {
    fontSize: 14,
    fontWeight: '800',
    flex: 1,
  },
  tapeItemPrice: {
    fontSize: 11,
    marginTop: 2,
  },
  tapeLineTotal: {
    fontSize: 15,
    fontWeight: '900',
    marginLeft: 10,
  },
  tapeControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(150, 150, 150, 0.1)',
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
  },
  stepBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  stepQtyText: {
    fontSize: 12,
    fontWeight: '800',
    paddingHorizontal: 4,
  },
  slabChipsRow: {
    flexDirection: 'row',
    gap: 4,
  },
  slabChip: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  slabChipText: {
    fontSize: 10,
    fontWeight: '800',
  },
  deleteLineBtn: {
    padding: 6,
  },
  bottomBar: {
    padding: 16,
    borderTopWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 8,
  },
  summaryGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  summaryCol: {
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  summaryVal: {
    fontSize: 14,
    fontWeight: '800',
    marginTop: 2,
  },
  summaryGrandVal: {
    fontSize: 18,
    fontWeight: '900',
    marginTop: 2,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  primaryActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 14,
  },
  primaryActionBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    marginLeft: 6,
  },
  iconActionBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mathContainer: {
    flex: 1,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  displayBox: {
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    marginBottom: 10,
    position: 'relative',
  },
  memBadge: {
    position: 'absolute',
    top: 10,
    left: 14,
    backgroundColor: '#10B981',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  memBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
  },
  formulaText: {
    fontSize: 13,
    textAlign: 'right',
    minHeight: 18,
  },
  mainDisplayText: {
    fontSize: 34,
    fontWeight: '900',
    textAlign: 'right',
    marginTop: 4,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  addValueToTapeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
  },
  addValueToTapeText: {
    fontSize: 13,
    fontWeight: '800',
  },
  quickOpsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  memBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
  memBtnText: {
    fontSize: 11,
    fontWeight: '800',
  },
  keypadGrid: {
    flex: 1,
    justifyContent: 'space-between',
  },
  keypadRow: {
    flexDirection: 'row',
    gap: 8,
    flex: 1,
    marginBottom: 6,
  },
  keyBtn: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyText: {
    fontSize: 20,
    fontWeight: '800',
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '900',
    marginLeft: 8,
  },
  closeBtn: {
    padding: 4,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 16,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    marginLeft: 8,
  },
  productItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 8,
  },
  prodName: {
    fontSize: 14,
    fontWeight: '800',
  },
  prodMeta: {
    fontSize: 11,
    marginTop: 3,
  },
  prodPrice: {
    fontSize: 15,
    fontWeight: '900',
  },
  addPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: BRAND_COLORS.blue600,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginTop: 4,
  },
  addPillText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    marginLeft: 2,
  },
  emptySearchBox: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  cardModal: {
    width: '100%',
    maxWidth: 440,
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
  },
  cardModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardModalTitle: {
    fontSize: 16,
    fontWeight: '900',
    marginLeft: 8,
  },
  formLabel: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
    marginTop: 8,
  },
  formInput: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    fontSize: 14,
  },
  gstSlabRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 14,
  },
  gstBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
  gstBtnText: {
    fontSize: 12,
    fontWeight: '800',
  },
  submitCustomBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 6,
  },
  submitCustomBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    marginLeft: 6,
  },
});
