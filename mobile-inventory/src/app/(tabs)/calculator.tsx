import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Modal,
  StyleSheet,
  Alert,
  Vibration,
  Platform,
  Keyboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  Menu,
  Calculator as CalcIcon,
  ShoppingBag,
  Plus,
  Minus,
  Search,
  Package,
  Check,
  X,
  Bluetooth,
  ChevronRight,
  ArrowRight,
  Users,
  Wallet,
  UserCheck,
} from 'lucide-react-native';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useProducts } from '@/hooks/useProducts';
import { useCustomers } from '@/hooks/useCustomers';
import { useCartStore } from '@/store/useCartStore';
import { usePrinterStore } from '@/store/usePrinterStore';
import { useSettings } from '@/hooks/useSettings';
import { Product } from '@/types/product';
import { Customer } from '@/types/customer';
import { BRAND_COLORS } from '@/constants/theme';
import { ScreenBackground } from '@/components/ui/ScreenBackground';
import { SidebarDrawer } from '@/components/ui/SidebarDrawer';
import { DirectPrinterConnectModal } from '@/components/printers/DirectPrinterConnectModal';

/**
 * Interactive Customer Balance Row with Quick Full-Balance Add and Custom Amount Typing
 */
function CustomerBalanceRow({
  customer,
  isSelected,
  onAddBalance,
  theme,
  isDark,
}: {
  customer: Customer;
  isSelected: boolean;
  onAddBalance: (customer: Customer, amount: number) => void;
  theme: any;
  isDark: boolean;
}) {
  const [customAmount, setCustomAmount] = useState('');
  const [isCustomOpen, setIsCustomOpen] = useState(false);

  const due = customer.creditBalance || 0;
  const hasDue = due > 0;

  const handleAddFull = () => {
    if (due <= 0) {
      Alert.alert('No Due Balance', `${customer.name} has zero outstanding balance. You can enter a custom amount.`);
      return;
    }
    onAddBalance(customer, due);
  };

  const handleAddCustom = () => {
    const parsed = parseFloat(customAmount);
    if (!parsed || isNaN(parsed) || parsed <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid balance amount greater than 0.');
      return;
    }
    onAddBalance(customer, parsed);
    setCustomAmount('');
    setIsCustomOpen(false);
  };

  return (
    <View
      style={[
        styles.custCard,
        {
          backgroundColor: isSelected
            ? isDark
              ? 'rgba(37, 99, 235, 0.15)'
              : 'rgba(37, 99, 235, 0.06)'
            : theme.cardBg,
          borderColor: isSelected ? BRAND_COLORS.blue600 : theme.borderColor,
        },
      ]}
    >
      {/* Customer Header Info */}
      <View style={styles.custHeaderRow}>
        <View
          style={[
            styles.custAvatar,
            { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(37, 99, 235, 0.1)' },
          ]}
        >
          <Text style={[styles.custAvatarText, { color: BRAND_COLORS.blue600 }]}>
            {customer.name.slice(0, 2).toUpperCase()}
          </Text>
        </View>

        <View style={{ flex: 1, marginLeft: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={[styles.custName, { color: theme.textPrimary }]} numberOfLines={1}>
              {customer.name}
            </Text>
            {isSelected ? (
              <View style={styles.selectedBadge}>
                <Text style={styles.selectedBadgeText}>Linked</Text>
              </View>
            ) : null}
          </View>
          <Text style={[styles.custPhone, { color: theme.textSecondary }]}>
            {customer.phone || 'No phone number'}
          </Text>
        </View>

        {/* Due Balance Status Badge */}
        <View
          style={[
            styles.dueBadge,
            {
              backgroundColor: hasDue
                ? isDark
                  ? 'rgba(239, 68, 68, 0.18)'
                  : 'rgba(239, 68, 68, 0.1)'
                : isDark
                ? 'rgba(255,255,255,0.06)'
                : 'rgba(0,0,0,0.04)',
              borderColor: hasDue ? 'rgba(239, 68, 68, 0.3)' : theme.borderColor,
            },
          ]}
        >
          <Text
            style={[
              styles.dueBadgeText,
              { color: hasDue ? '#EF4444' : theme.textSecondary },
            ]}
          >
            {hasDue ? `₹${due.toFixed(2)} Due` : 'No Due'}
          </Text>
        </View>
      </View>

      {/* Action Buttons: Add Full Balance or Custom */}
      <View style={styles.custActionRow}>
        {hasDue ? (
          <TouchableOpacity
            onPress={handleAddFull}
            style={[styles.addFullDueBtn, { backgroundColor: BRAND_COLORS.blue600 }]}
            activeOpacity={0.8}
          >
            <Wallet size={13} color="#FFFFFF" />
            <Text style={styles.addFullDueBtnText}>
              Add Full Due (₹{due.toFixed(2)})
            </Text>
          </TouchableOpacity>
        ) : null}

        <TouchableOpacity
          onPress={() => setIsCustomOpen(!isCustomOpen)}
          style={[
            styles.customDueToggleBtn,
            {
              borderColor: theme.borderColor,
              backgroundColor: isCustomOpen
                ? isDark
                  ? 'rgba(255,255,255,0.1)'
                  : 'rgba(0,0,0,0.05)'
                : 'transparent',
            },
          ]}
          activeOpacity={0.8}
        >
          <Text style={[styles.customDueToggleText, { color: theme.textPrimary }]}>
            {isCustomOpen ? 'Cancel' : '+ Custom Amount'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Custom Amount Input Row (Expandable) */}
      {isCustomOpen ? (
        <View style={styles.customAmountBox}>
          <View
            style={[
              styles.customAmountInputWrap,
              { backgroundColor: theme.bg, borderColor: BRAND_COLORS.blue600 },
            ]}
          >
            <Text style={[styles.currencyPrefix, { color: BRAND_COLORS.blue600 }]}>₹</Text>
            <TextInput
              value={customAmount}
              onChangeText={(t) => setCustomAmount(t.replace(/[^0-9.]/g, ''))}
              placeholder="Enter amount..."
              placeholderTextColor={theme.textSecondary}
              keyboardType="numeric"
              style={[styles.customAmountInput, { color: theme.textPrimary }]}
              autoFocus
            />
          </View>
          <TouchableOpacity
            onPress={handleAddCustom}
            style={[styles.addCustomBtn, { backgroundColor: '#10B981' }]}
            activeOpacity={0.8}
          >
            <Plus size={14} color="#FFFFFF" />
            <Text style={styles.addCustomBtnText}>Add</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}

/**
 * Interactive Product Row with Quantity Selector (synced to cart in real-time)
 */
function ProductPickerRow({
  product,
  cartQuantity,
  onUpdateCartQuantity,
  theme,
}: {
  product: Product;
  cartQuantity: number;
  onUpdateCartQuantity: (p: Product, qty: number) => void;
  theme: any;
}) {
  const [localInput, setLocalInput] = useState<string | null>(null);

  // If localInput is active (user is typing), use localInput; otherwise reflect cartQuantity
  const displayQtyStr = localInput !== null ? localInput : String(cartQuantity);
  const effectiveQty = localInput !== null ? parseInt(localInput, 10) || 0 : cartQuantity;
  const lineTotal = product.sellingPrice * effectiveQty;
  const isInCart = cartQuantity > 0;

  const handleMinus = () => {
    Vibration.vibrate(25);
    const newQty = Math.max(0, cartQuantity - 1);
    setLocalInput(null);
    onUpdateCartQuantity(product, newQty);
  };

  const handlePlus = () => {
    Vibration.vibrate(25);
    const newQty = cartQuantity + 1;
    setLocalInput(null);
    onUpdateCartQuantity(product, newQty);
  };

  const handleTextChange = (text: string) => {
    const cleaned = text.replace(/[^0-9]/g, '');
    setLocalInput(cleaned);
    const parsed = parseInt(cleaned, 10) || 0;
    onUpdateCartQuantity(product, parsed);
  };

  const handleBlur = () => {
    setLocalInput(null);
  };

  const handleQuickAdd = () => {
    Vibration.vibrate(30);
    const newQty = cartQuantity > 0 ? cartQuantity + 1 : 1;
    setLocalInput(null);
    onUpdateCartQuantity(product, newQty);
  };

  return (
    <View
      style={[
        styles.productItemCard,
        {
          backgroundColor: isInCart
            ? theme.isDark
              ? 'rgba(37, 99, 235, 0.15)'
              : 'rgba(37, 99, 235, 0.06)'
            : theme.cardBg,
          borderColor: isInCart ? BRAND_COLORS.blue600 : theme.borderColor,
        },
      ]}
    >
      <View style={{ flex: 1, marginRight: 10 }}>
        <Text style={[styles.prodName, { color: theme.textPrimary }]} numberOfLines={1}>
          {product.name}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 3 }}>
          <Text style={[styles.prodPrice, { color: BRAND_COLORS.blue600 }]}>
            ₹{product.sellingPrice.toFixed(2)}
          </Text>
          <Text style={[styles.prodMeta, { color: theme.textSecondary, marginLeft: 6 }]} numberOfLines={1}>
            • Total: ₹{lineTotal.toFixed(2)} • Stock: {product.currentStock}
          </Text>
        </View>
      </View>

      {/* Quantity Controls & Real-Time Stepper */}
      <View style={styles.prodActionRow}>
        <View
          style={[
            styles.prodQtyBox,
            {
              borderColor: isInCart ? BRAND_COLORS.blue600 : theme.borderColor,
              backgroundColor: theme.bg,
            },
          ]}
        >
          <TouchableOpacity
            onPress={handleMinus}
            style={styles.prodQtyBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Minus size={13} color={isInCart ? BRAND_COLORS.blue600 : theme.textPrimary} />
          </TouchableOpacity>
          <TextInput
            value={displayQtyStr}
            onChangeText={handleTextChange}
            onBlur={handleBlur}
            keyboardType="number-pad"
            style={[
              styles.prodQtyInput,
              { color: theme.textPrimary, fontWeight: isInCart ? '900' : '600' },
            ]}
            selectTextOnFocus
          />
          <TouchableOpacity
            onPress={handlePlus}
            style={styles.prodQtyBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Plus size={13} color={isInCart ? BRAND_COLORS.blue600 : theme.textPrimary} />
          </TouchableOpacity>
        </View>

        {/* 1-Tap Add/Increment Button */}
        <TouchableOpacity
          onPress={handleQuickAdd}
          activeOpacity={0.8}
          style={[
            styles.addProdBtn,
            { backgroundColor: isInCart ? '#10B981' : BRAND_COLORS.blue600 },
          ]}
        >
          {isInCart ? (
            <>
              <Check size={13} color="#FFFFFF" />
              <Text style={styles.addProdBtnText}>{cartQuantity}</Text>
            </>
          ) : (
            <>
              <Plus size={13} color="#FFFFFF" />
              <Text style={styles.addProdBtnText}>Add</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function DedicatedCalculatorTabScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const theme = useAppTheme();
  const isDark = theme.isDark;

  const { products } = useProducts();
  const { customers } = useCustomers();
  const {
    items: cartItems,
    addItem: addCartItem,
    updateQuantity: updateCartQuantity,
    removeItem: removeCartItem,
    selectedCustomerId,
    selectedCustomerName,
    setCustomer: setCartCustomer,
    getGrandTotal,
  } = useCartStore();
  const { activeDevice, connectionState } = usePrinterStore();
  const { settings } = useSettings();

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Standard Fast Math Calc State (Active by Default)
  const [calcDisplay, setCalcDisplay] = useState('0');
  const [calcFormula, setCalcFormula] = useState('');
  const [memoryValue, setMemoryValue] = useState<number | null>(null);

  // Product Dropdown / Picker Modal State
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [productSearchQuery, setProductSearchQuery] = useState('');

  // Customer Balance & Khata Modal State
  const [showCustomerBalanceModal, setShowCustomerBalanceModal] = useState(false);
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [customerFilterOnlyDue, setCustomerFilterOnlyDue] = useState(false);

  // Printer Connect Modal State
  const [showPrinterConnectModal, setShowPrinterConnectModal] = useState(false);

  // Filtered store products for quick picker
  const filteredProducts = useMemo(() => {
    if (!productSearchQuery.trim()) return products.slice(0, 50);
    const q = productSearchQuery.toLowerCase();
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.barcode && p.barcode.includes(q)) ||
        (p.sku && p.sku.toLowerCase().includes(q))
    );
  }, [products, productSearchQuery]);

  // Filtered customers for customer balance modal
  const filteredCustomers = useMemo(() => {
    let list = customers;
    if (customerFilterOnlyDue) {
      list = list.filter((c) => (c.creditBalance || 0) > 0);
    }
    if (!customerSearchQuery.trim()) return list;
    const q = customerSearchQuery.toLowerCase();
    return list.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.phone && c.phone.includes(q))
    );
  }, [customers, customerSearchQuery, customerFilterOnlyDue]);

  const totalCartCount = useMemo(() => {
    return cartItems.reduce((sum, item) => sum + item.quantity, 0);
  }, [cartItems]);

  const cartGrandTotal = useMemo(() => {
    return getGrandTotal();
  }, [cartItems, getGrandTotal]);

  // -------------------------------------------------------------
  // Real-Time Cart Quantity Updater
  // -------------------------------------------------------------
  const handleUpdateCartQuantity = (product: Product, newQuantity: number) => {
    if (newQuantity <= 0) {
      removeCartItem(product.id);
    } else {
      const existing = cartItems.find((i) => i.product.id === product.id);
      if (existing) {
        updateCartQuantity(product.id, newQuantity);
      } else {
        addCartItem(product, newQuantity);
      }
    }
  };

  // -------------------------------------------------------------
  // Customer Due Balance Adder (Adds to calculation & active bill)
  // -------------------------------------------------------------
  const handleAddCustomerBalance = (customer: Customer, amount: number) => {
    Vibration.vibrate(40);
    // 1. Link customer to the active cart / bill
    setCartCustomer(customer.id, customer.name);

    // 2. Add previous balance item to cart / bill
    const balanceProduct: Product = {
      id: `prev-bal-${customer.id}`,
      name: `Prev Balance (${customer.name})`,
      sellingPrice: amount,
      costPrice: 0,
      taxRate: 0,
      priceIncludesGst: false,
      currentStock: 9999,
      lowStockThreshold: 0,
      unit: 'pcs',
      isActive: true,
      categoryId: null,
    };
    addCartItem(balanceProduct, 1);

    // 3. Update Fast Math Pad calculator with the balance amount
    const currentNum = parseFloat(calcDisplay) || 0;
    if (currentNum === 0) {
      setCalcDisplay(String(Math.round(amount * 100) / 100));
      setCalcFormula(`Prev Bal: ₹${amount.toFixed(2)} (${customer.name})`);
    } else {
      const newTotal = currentNum + amount;
      setCalcFormula(`${calcDisplay} + ${amount} (Prev Bal)`);
      setCalcDisplay(String(Math.round(newTotal * 100) / 100));
    }

    // 4. Close modal and show feedback
    setShowCustomerBalanceModal(false);
    Alert.alert(
      'Balance Added to Bill & Calculator',
      `₹${amount.toFixed(2)} previous balance for ${customer.name} has been added to the calculation and linked to the active POS bill.`,
      [{ text: 'OK' }]
    );
  };

  // -------------------------------------------------------------
  // Safe Math Expression Evaluator
  // -------------------------------------------------------------
  const safeEvaluate = (expr: string): string => {
    try {
      let sanitized = expr
        .replace(/×/g, '*')
        .replace(/÷/g, '/')
        .replace(/%/g, '*0.01')
        .replace(/,/g, '');

      // Strip out all non-math characters
      sanitized = sanitized.replace(/[^0-9+\-*/.()]/g, '');

      // Trim trailing operators (e.g. "350+" -> "350")
      sanitized = sanitized.replace(/[+\-*/.]+$/, '');

      if (!sanitized) return '0';

      // eslint-disable-next-line no-eval
      const result = Function(`'use strict'; return (${sanitized})`)();
      if (!Number.isFinite(result) || isNaN(result)) return '0';

      const rounded = Math.round(result * 100) / 100;
      return String(rounded);
    } catch {
      return '0';
    }
  };

  // -------------------------------------------------------------
  // Transfer Products Total into Fast Math Pad Calculator
  // -------------------------------------------------------------
  const handleInsertAmountToCalculator = (amount: number) => {
    Vibration.vibrate(40);
    const rounded = Math.round(amount * 100) / 100;
    const roundedStr = String(rounded);

    if (
      calcFormula.endsWith('+ ') ||
      calcFormula.endsWith('- ') ||
      calcFormula.endsWith('× ') ||
      calcFormula.endsWith('÷ ')
    ) {
      setCalcDisplay(roundedStr);
    } else {
      setCalcDisplay(roundedStr);
      setCalcFormula('');
    }
    setShowProductPicker(false);
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
      setMemoryValue(null);
    } else if (val === '⌫') {
      if (calcDisplay === 'Error' || calcDisplay.length <= 1) {
        setCalcDisplay('0');
      } else {
        setCalcDisplay(calcDisplay.slice(0, -1));
      }
    } else if (val === '=') {
      const fullExpr = calcFormula ? `${calcFormula}${calcDisplay}` : calcDisplay;
      const resStr = safeEvaluate(fullExpr);
      setCalcDisplay(resStr);
      setCalcFormula('');
    } else if (['+', '-', '×', '÷'].includes(val)) {
      if (calcDisplay === 'Error') {
        setCalcDisplay('0');
        return;
      }
      if (calcDisplay === '0' && calcFormula.length > 0) {
        setCalcFormula(calcFormula.replace(/ [+\-×÷] $/, ` ${val} `));
      } else {
        setCalcFormula(`${calcFormula}${calcDisplay} ${val} `);
        setCalcDisplay('0');
      }
    } else if (val === '%') {
      const num = parseFloat(calcDisplay) || 0;
      const pct = Math.round((num / 100) * 10000) / 10000;
      setCalcDisplay(String(pct));
    } else if (val === '.') {
      if (calcDisplay === 'Error' || calcDisplay === '0') {
        setCalcDisplay('0.');
      } else if (!calcDisplay.includes('.')) {
        setCalcDisplay(calcDisplay + '.');
      }
    } else if (val === '00') {
      if (calcDisplay === 'Error' || calcDisplay === '0') {
        setCalcDisplay('0');
      } else {
        setCalcDisplay(calcDisplay + '00');
      }
    } else {
      if (calcDisplay === '0' || calcDisplay === 'Error') {
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

  return (
    <ScreenBackground color={theme.bg}>
      <View style={[styles.container, { backgroundColor: 'transparent', paddingTop: insets.top || 12 }]}>
        <SidebarDrawer visible={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} />

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
              <Text style={styles.headerBadge}>{settings?.businessName || 'Store Toolkit'}</Text>
              <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>Fast Math Pad</Text>
            </View>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            {/* Direct Printer Pill */}
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
                size={13}
                color={activeDevice && connectionState === 'connected' ? '#10B981' : '#D97706'}
              />
              <Text
                style={[
                  styles.printerPillText,
                  { color: activeDevice && connectionState === 'connected' ? '#10B981' : '#D97706' },
                ]}
              >
                {activeDevice && connectionState === 'connected' ? 'Online' : 'Printer'}
              </Text>
            </TouchableOpacity>

            {/* POS Cart Shortcut Pill */}
            <TouchableOpacity
              onPress={() => router.push('/(tabs)/pos' as any)}
              style={[
                styles.cartPill,
                {
                  backgroundColor: totalCartCount > 0 ? BRAND_COLORS.blue600 : theme.cardBg,
                  borderColor: totalCartCount > 0 ? BRAND_COLORS.blue600 : theme.borderColor,
                },
              ]}
            >
              <ShoppingBag size={14} color={totalCartCount > 0 ? '#FFFFFF' : theme.textPrimary} />
              {totalCartCount > 0 ? (
                <Text style={styles.cartPillCount}>{totalCartCount}</Text>
              ) : null}
            </TouchableOpacity>
          </View>
        </View>

        {/* ========================================================= */}
        {/* FAST MATH PAD CALCULATOR VIEW (DEFAULT & EXCLUSIVE) */}
        {/* ========================================================= */}
        <View style={styles.mathContainer}>
          {/* Digital Display Box */}
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

          {/* Action Row: "Add Products" + "Customer Balance" + "Go to POS" */}
          <View style={styles.actionRow}>
            {/* 1. Add Products Button */}
            <TouchableOpacity
              onPress={() => setShowProductPicker(true)}
              style={[styles.addProductsBtn, { backgroundColor: BRAND_COLORS.blue600 }]}
              activeOpacity={0.8}
            >
              <Package size={15} color="#FFFFFF" />
              <Text style={styles.addProductsBtnText}>Add Products</Text>
            </TouchableOpacity>

            {/* 2. Customer Balance Due Button */}
            <TouchableOpacity
              onPress={() => setShowCustomerBalanceModal(true)}
              style={[
                styles.customerBalanceBtn,
                {
                  backgroundColor: selectedCustomerName
                    ? isDark
                      ? 'rgba(16, 185, 129, 0.15)'
                      : 'rgba(16, 185, 129, 0.1)'
                    : theme.cardBg,
                  borderColor: selectedCustomerName ? '#10B981' : theme.borderColor,
                },
              ]}
              activeOpacity={0.8}
            >
              <Users
                size={15}
                color={selectedCustomerName ? '#10B981' : BRAND_COLORS.blue600}
              />
              <Text
                style={[
                  styles.customerBalanceBtnText,
                  { color: selectedCustomerName ? '#10B981' : theme.textPrimary },
                ]}
                numberOfLines={1}
              >
                {selectedCustomerName ? selectedCustomerName : 'Customer Due'}
              </Text>
            </TouchableOpacity>

            {/* 3. Go to POS Button (when items selected) */}
            {totalCartCount > 0 ? (
              <TouchableOpacity
                onPress={() => router.push('/(tabs)/pos' as any)}
                style={[
                  styles.goToPosMainBtn,
                  {
                    backgroundColor: BRAND_COLORS.navyInk,
                    borderColor: theme.borderColor,
                  },
                ]}
                activeOpacity={0.8}
              >
                <ShoppingBag size={15} color="#FFFFFF" />
                <Text style={styles.goToPosMainBtnText}>POS ({totalCartCount})</Text>
                <ArrowRight size={13} color="#94A3B8" style={{ marginLeft: 2 }} />
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Memory Row */}
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

        {/* ========================================================= */}
        {/* MODAL: PRODUCT DROPDOWN & QUANTITY PICKER */}
        {/* ========================================================= */}
        <Modal
          visible={showProductPicker}
          animationType="slide"
          onRequestClose={() => setShowProductPicker(false)}
        >
          <ScreenBackground color={theme.bg}>
            <View style={[styles.modalContainer, { paddingTop: insets.top || 12 }]}>
              {/* Modal Header */}
              <View style={[styles.modalHeader, { borderBottomColor: theme.borderColor }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Package size={20} color={BRAND_COLORS.blue600} />
                  <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>Add Products</Text>
                  <View style={[styles.countBadge, { backgroundColor: 'rgba(37, 99, 235, 0.12)' }]}>
                    <Text style={[styles.countBadgeText, { color: BRAND_COLORS.blue600 }]}>
                      {filteredProducts.length} items
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  onPress={() => {
                    Keyboard.dismiss();
                    setShowProductPicker(false);
                  }}
                  style={styles.closeBtn}
                  hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
                  activeOpacity={0.6}
                >
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
                />
                {productSearchQuery ? (
                  <TouchableOpacity
                    onPress={() => setProductSearchQuery('')}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <X size={16} color={theme.textSecondary} />
                  </TouchableOpacity>
                ) : null}
              </View>

              {/* Product List with interactive Quantity (+/- & typing in real-time) */}
              <FlatList
                data={filteredProducts}
                extraData={cartItems}
                keyExtractor={(p) => p.id}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}
                renderItem={({ item }) => {
                  const cartQty = cartItems.find((i) => i.product.id === item.id)?.quantity || 0;
                  return (
                    <ProductPickerRow
                      product={item}
                      cartQuantity={cartQty}
                      onUpdateCartQuantity={handleUpdateCartQuantity}
                      theme={theme}
                    />
                  );
                }}
                ListEmptyComponent={
                  <View style={styles.emptySearchBox}>
                    <Text style={{ color: theme.textSecondary, textAlign: 'center' }}>
                      No matching store products found.
                    </Text>
                  </View>
                }
              />

              {/* Floating Bottom Action Bar: Go to Calculator & Go to POS Cart */}
              {totalCartCount > 0 ? (
                <View
                  style={[
                    styles.floatingCartBar,
                    { backgroundColor: theme.cardBg, borderTopColor: theme.borderColor },
                  ]}
                >
                  <View style={{ flex: 1, marginRight: 10 }}>
                    <Text style={[styles.floatingCartCount, { color: theme.textSecondary }]}>
                      {totalCartCount} {totalCartCount === 1 ? 'item' : 'items'} in Cart
                    </Text>
                    <Text style={[styles.floatingCartTotal, { color: BRAND_COLORS.blue600 }]} numberOfLines={1}>
                      ₹{cartGrandTotal.toFixed(2)}
                    </Text>
                  </View>

                  <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                    {/* Option 1: Go to Calculator with Product Total */}
                    <TouchableOpacity
                      onPress={() => {
                        handleInsertAmountToCalculator(cartGrandTotal);
                      }}
                      style={[
                        styles.goToCalcBtn,
                        {
                          borderColor: BRAND_COLORS.blue600,
                          backgroundColor: isDark ? 'rgba(37, 99, 235, 0.2)' : 'rgba(37, 99, 235, 0.1)',
                        },
                      ]}
                      activeOpacity={0.8}
                    >
                      <CalcIcon size={15} color={BRAND_COLORS.blue600} />
                      <Text style={[styles.goToCalcBtnText, { color: BRAND_COLORS.blue600 }]}>
                        Go to Calculator
                      </Text>
                    </TouchableOpacity>

                    {/* Option 2: Go to POS Cart */}
                    <TouchableOpacity
                      onPress={() => {
                        setShowProductPicker(false);
                        router.push('/(tabs)/pos' as any);
                      }}
                      style={[styles.goToPosBtn, { backgroundColor: BRAND_COLORS.blue600 }]}
                      activeOpacity={0.8}
                    >
                      <ShoppingBag size={14} color="#FFFFFF" style={{ marginRight: 4 }} />
                      <Text style={styles.goToPosBtnText}>POS Cart</Text>
                      <ArrowRight size={13} color="#FFFFFF" style={{ marginLeft: 2 }} />
                    </TouchableOpacity>
                  </View>
                </View>
              ) : null}
            </View>
          </ScreenBackground>
        </Modal>

        {/* ========================================================= */}
        {/* CUSTOMER BALANCE & KHATA DUE MODAL */}
        {/* ========================================================= */}
        <Modal
          visible={showCustomerBalanceModal}
          animationType="slide"
          onRequestClose={() => {
            Keyboard.dismiss();
            setShowCustomerBalanceModal(false);
          }}
        >
          <ScreenBackground color={theme.bg}>
            <View style={[styles.modalContainer, { paddingTop: insets.top || 12 }]}>
              {/* Modal Header */}
              <View style={[styles.modalHeader, { borderBottomColor: theme.borderColor }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Users size={20} color={BRAND_COLORS.blue600} />
                  <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>Customer Due Balance</Text>
                  <View style={[styles.countBadge, { backgroundColor: 'rgba(37, 99, 235, 0.12)' }]}>
                    <Text style={[styles.countBadgeText, { color: BRAND_COLORS.blue600 }]}>
                      {filteredCustomers.length}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  onPress={() => {
                    Keyboard.dismiss();
                    setShowCustomerBalanceModal(false);
                  }}
                  style={styles.closeBtn}
                  hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
                  activeOpacity={0.6}
                >
                  <X size={22} color={theme.textSecondary} />
                </TouchableOpacity>
              </View>

              {/* Search Bar */}
              <View style={[styles.searchBox, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
                <Search size={16} color={theme.textSecondary} />
                <TextInput
                  value={customerSearchQuery}
                  onChangeText={setCustomerSearchQuery}
                  placeholder="Search customer name or phone..."
                  placeholderTextColor={theme.textSecondary}
                  style={[styles.searchInput, { color: theme.textPrimary }]}
                />
                {customerSearchQuery ? (
                  <TouchableOpacity
                    onPress={() => setCustomerSearchQuery('')}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <X size={16} color={theme.textSecondary} />
                  </TouchableOpacity>
                ) : null}
              </View>

              {/* Filter Tabs: All vs Has Due */}
              <View style={styles.filterTabsRow}>
                <TouchableOpacity
                  onPress={() => setCustomerFilterOnlyDue(false)}
                  style={[
                    styles.filterTab,
                    !customerFilterOnlyDue && { backgroundColor: BRAND_COLORS.blue600 },
                    { borderColor: !customerFilterOnlyDue ? BRAND_COLORS.blue600 : theme.borderColor },
                  ]}
                >
                  <Text
                    style={[
                      styles.filterTabText,
                      { color: !customerFilterOnlyDue ? '#FFFFFF' : theme.textSecondary },
                    ]}
                  >
                    All ({customers.length})
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setCustomerFilterOnlyDue(true)}
                  style={[
                    styles.filterTab,
                    customerFilterOnlyDue && { backgroundColor: '#EF4444' },
                    { borderColor: customerFilterOnlyDue ? '#EF4444' : theme.borderColor },
                  ]}
                >
                  <Text
                    style={[
                      styles.filterTabText,
                      { color: customerFilterOnlyDue ? '#FFFFFF' : theme.textSecondary },
                    ]}
                  >
                    Has Balance Due ({customers.filter((c) => (c.creditBalance || 0) > 0).length})
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Customer List */}
              <FlatList
                data={filteredCustomers}
                keyExtractor={(c) => c.id}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}
                renderItem={({ item }) => (
                  <CustomerBalanceRow
                    customer={item}
                    isSelected={selectedCustomerId === item.id}
                    onAddBalance={handleAddCustomerBalance}
                    theme={theme}
                    isDark={isDark}
                  />
                )}
                ListEmptyComponent={
                  <View style={styles.emptySearchBox}>
                    <Text style={{ color: theme.textSecondary, textAlign: 'center' }}>
                      No matching customers found.
                    </Text>
                  </View>
                }
              />
            </View>
          </ScreenBackground>
        </Modal>

        {/* ========================================================= */}
        {/* DIRECT PRINTER CONNECT DIALOG MODAL */}
        {/* ========================================================= */}
        <DirectPrinterConnectModal
          visible={showPrinterConnectModal}
          onClose={() => setShowPrinterConnectModal(false)}
          title="Connect Bluetooth Printer"
          subtitle="Pair or select your thermal receipt printer below."
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
  headerBadge: {
    fontSize: 10,
    fontWeight: '800',
    color: BRAND_COLORS.sky500,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  headerTitle: { fontSize: 20, fontWeight: '900' },
  printerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
  },
  printerPillText: {
    fontSize: 11,
    fontWeight: '800',
    marginLeft: 4,
  },
  cartPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
  },
  cartPillCount: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
    marginLeft: 4,
  },
  mathContainer: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
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
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  addProductsBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 14,
    shadowColor: BRAND_COLORS.blue600,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  addProductsBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    marginLeft: 6,
  },
  goToPosMainBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 14,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  goToPosMainBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    marginLeft: 6,
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
    fontSize: 17,
    fontWeight: '900',
    marginLeft: 8,
  },
  countBadge: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginLeft: 8,
  },
  countBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  closeBtn: {
    padding: 6,
    minWidth: 40,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 16,
    marginBottom: 10,
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
    justifyContent: 'space-between',
    padding: 12,
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
  },
  prodPrice: {
    fontSize: 14,
    fontWeight: '900',
  },
  prodActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  prodQtyBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  prodQtyBtn: {
    padding: 4,
  },
  prodQtyInput: {
    width: 32,
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '800',
    paddingVertical: 2,
  },
  addProdBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
  },
  addProdBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    marginLeft: 2,
  },
  emptySearchBox: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  floatingCartBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  floatingCartCount: {
    fontSize: 11,
    fontWeight: '600',
  },
  floatingCartTotal: {
    fontSize: 16,
    fontWeight: '900',
    marginTop: 1,
  },
  goToCalcBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  goToCalcBtnText: {
    fontSize: 13,
    fontWeight: '800',
    marginLeft: 4,
  },
  goToPosBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    shadowColor: BRAND_COLORS.blue600,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  goToPosBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  customerBalanceBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 14,
    borderWidth: 1,
    gap: 6,
  },
  customerBalanceBtnText: {
    fontSize: 13,
    fontWeight: '800',
  },
  filterTabsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  filterTab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterTabText: {
    fontSize: 12,
    fontWeight: '800',
  },
  custCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
  },
  custHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  custAvatar: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  custAvatarText: {
    fontSize: 14,
    fontWeight: '900',
  },
  custName: {
    fontSize: 14,
    fontWeight: '800',
  },
  selectedBadge: {
    backgroundColor: '#10B981',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 1,
    marginLeft: 6,
  },
  selectedBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
  },
  custPhone: {
    fontSize: 12,
    marginTop: 2,
  },
  dueBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  dueBadgeText: {
    fontSize: 12,
    fontWeight: '900',
  },
  custActionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
    alignItems: 'center',
  },
  addFullDueBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: 10,
    gap: 6,
  },
  addFullDueBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  customDueToggleBtn: {
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customDueToggleText: {
    fontSize: 12,
    fontWeight: '700',
  },
  customAmountBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(150, 150, 150, 0.15)',
  },
  customAmountInputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  currencyPrefix: {
    fontSize: 14,
    fontWeight: '900',
    marginRight: 4,
  },
  customAmountInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '800',
    padding: 0,
  },
  addCustomBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
    gap: 4,
  },
  addCustomBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
});
