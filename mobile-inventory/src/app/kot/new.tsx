import React, { useState, useMemo, useCallback, useDeferredValue, memo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  FlatList,
  TextInput,
  StyleSheet,
  StatusBar,
  Platform,
  Alert,
  ActivityIndicator,
  Modal,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  X,
  ChevronLeft,
  Utensils,
  ShoppingBag,
  Truck,
  Plus,
  Minus,
  Trash2,
  Printer,
  Search,
  CheckCircle2,
  PlusCircle,
  CreditCard,
  Banknote,
  QrCode,
  Layers,
  Sparkles,
} from 'lucide-react-native';
import { useProducts } from '@/hooks/useProducts';
import { useRestaurantTables } from '@/hooks/useRestaurantTables';
import { useKotOrders } from '@/hooks/useKotOrders';
import { useCategories } from '@/hooks/useCategories';
import { KOTOrderType, KOTPriority } from '@/types/kot';
import { Product } from '@/types/product';
import { useAppTheme } from '@/hooks/useAppTheme';
import { ScreenBackground } from '@/components/ui/ScreenBackground';
import { BRAND_COLORS } from '@/constants/theme';
import { usePrinterStore } from '@/store/usePrinterStore';
import { useSettings } from '@/hooks/useSettings';
import { useStoreProfile } from '@/hooks/useStoreProfile';
import { isProductAvailable } from '@/utils/businessFeatures';
import { parseGstBilling, gstPrintOptionOverrides } from '@/constants/gstBilling';
import type { Sale } from '@/types/sale';
import { AddFoodItemModal } from '@/components/kot/AddFoodItemModal';
import { StoreSwitcher } from '@/components/pos/StoreSwitcher';

interface SelectedItemLine {
  productId?: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  dietaryType?: 'veg' | 'non_veg' | 'egg';
  notes?: string;
}

const MenuFoodCard = memo(function MenuFoodCard({
  product,
  inCartQty,
  theme,
  unavailable,
  onPress,
  onToggleAvailability,
}: {
  product: Product;
  inCartQty: number;
  theme: ReturnType<typeof useAppTheme>;
  unavailable: boolean;
  onPress: (product: Product) => void;
  onToggleAvailability: (product: Product) => void;
}) {
  const dietary = (product as any).dietaryType || 'veg';

  return (
    <TouchableOpacity
      onPress={() => {
        if (unavailable) return;
        onPress(product);
      }}
      onLongPress={() => onToggleAvailability(product)}
      delayLongPress={350}
      activeOpacity={0.8}
      style={[
        styles.foodCard,
        {
          backgroundColor: theme.cardBg,
          borderColor: unavailable
            ? '#F87171'
            : inCartQty > 0
              ? BRAND_COLORS.blue600
              : theme.borderColor,
          borderWidth: inCartQty > 0 || unavailable ? 1.5 : 1,
          opacity: unavailable ? 0.72 : 1,
        },
      ]}
    >
      <View style={styles.cardImageContainer}>
        {product.imageUrl ? (
          <Image source={{ uri: product.imageUrl }} style={styles.cardImage} resizeMode="cover" />
        ) : (
          <View
            style={[
              styles.cardPlaceholder,
              { backgroundColor: theme.isDark ? 'rgba(255,255,255,0.05)' : '#F1F5F9' },
            ]}
          >
            <Text style={[styles.cardPlaceholderText, { color: theme.textSecondary }]}>
              {product.name.slice(0, 1).toUpperCase()}
            </Text>
          </View>
        )}

        <View style={styles.dietaryBadge}>
          <View
            style={[
              styles.dietaryIconBox,
              {
                borderColor:
                  dietary === 'veg' ? '#10B981' : dietary === 'egg' ? '#F59E0B' : '#EF4444',
              },
            ]}
          >
            <View
              style={[
                styles.dietaryDot,
                {
                  backgroundColor:
                    dietary === 'veg' ? '#10B981' : dietary === 'egg' ? '#F59E0B' : '#EF4444',
                },
              ]}
            />
          </View>
        </View>

        {unavailable ? (
          <View style={styles.unavailableBadge}>
            <Text style={styles.unavailableBadgeText}>N/A</Text>
          </View>
        ) : inCartQty > 0 ? (
          <View style={styles.cartBadge}>
            <Text style={styles.cartBadgeText}>{inCartQty}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.cardBody}>
        <Text style={[styles.dishName, { color: theme.textPrimary }]} numberOfLines={2}>
          {product.name}
        </Text>

        <View style={styles.cardFooterRow}>
          <Text style={[styles.dishPrice, { color: theme.textPrimary }]}>
            ₹{(product.sellingPrice || 0).toFixed(2)}
          </Text>
          <TouchableOpacity
            onPress={() => onToggleAvailability(product)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={styles.availabilityBtn}
          >
            <Text
              style={[
                styles.availabilityBtnText,
                { color: unavailable ? '#10B981' : '#EF4444' },
              ]}
            >
              {unavailable ? 'Mark available' : 'Not available'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
});

export default function NewKotOrderScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const topPadding = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0, 12);

  const { products, updateProduct } = useProducts({ includeLowStock: false });
  const { categories } = useCategories();
  const { tables } = useRestaurantTables();
  const { createOrder, isCreating } = useKotOrders(undefined, { enabled: false });
  const {
    connectionState,
    paperWidth,
    activeTemplateId,
    customTemplates,
    activeCustomTemplateId,
    enableBillQrCode,
    topMargin,
    autoCut,
    fontSize,
    printCopies,
  } = usePrinterStore();
  const { settings } = useSettings();
  const storeProfile = useStoreProfile();

  // Dual Tabs: 'menu' or 'ticket'
  const [activeTab, setActiveTab] = useState<'menu' | 'ticket'>('menu');

  // Order Details
  const [orderType, setOrderType] = useState<KOTOrderType>('takeaway');
  const [selectedTableId, setSelectedTableId] = useState<string>('');
  const [partyLabel, setPartyLabel] = useState('1 no');
  const [waiterName, setWaiterName] = useState('');
  const [guestCount, setGuestCount] = useState('1');
  const [contactNumber, setContactNumber] = useState('');
  const [orderNotes, setOrderNotes] = useState('');
  const [priority] = useState<KOTPriority>('normal');
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);

  // Cart / Items
  const [selectedItems, setSelectedItems] = useState<SelectedItemLine[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const deferredSearch = useDeferredValue(searchQuery);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showUnavailable, setShowUnavailable] = useState(false);

  // Modals
  const [showAddFoodModal, setShowAddFoodModal] = useState(false);
  const [showSettleModal, setShowSettleModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'upi' | 'card'>('cash');
  const [discountAmount, setDiscountAmount] = useState('');

  const cartQtyByProductId = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of selectedItems) {
      if (item.productId) map.set(item.productId, item.quantity);
    }
    return map;
  }, [selectedItems]);

  const filteredProducts = useMemo(() => {
    const q = deferredSearch.trim().toLowerCase();
    return products.filter((p: Product) => {
      // Soft-deleted stay off the menu; availability is isAvailable (legacy isActive fallback)
      if (p.isActive === false) return false;
      const matchesAvailability = showUnavailable ? !isProductAvailable(p) : isProductAvailable(p);
      const matchesSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        (p.barcode && p.barcode.toLowerCase().includes(q));
      const matchesCat =
        selectedCategory === 'all' ||
        p.categoryId === selectedCategory ||
        (p.category && p.category.name.toLowerCase() === selectedCategory.toLowerCase());
      return matchesAvailability && matchesSearch && matchesCat;
    });
  }, [products, deferredSearch, selectedCategory, showUnavailable]);

  const totalItemsCount = selectedItems.reduce((sum, it) => sum + it.quantity, 0);
  const subtotal = selectedItems.reduce((acc, it) => acc + it.unitPrice * it.quantity, 0);
  const taxTotal = selectedItems.reduce((acc, it) => acc + (it.unitPrice * it.quantity * (it.taxRate || 0)) / 100, 0);
  const discountVal = parseFloat(discountAmount) || 0;
  const grandTotal = Math.max(0, subtotal + taxTotal - discountVal);

  const handleAddProduct = useCallback((product: Product) => {
    if (!isProductAvailable(product)) return;
    setSelectedItems((prev) => {
      const existing = prev.find((it) => it.productId === product.id);
      if (existing) {
        return prev.map((it) =>
          it.productId === product.id ? { ...it, quantity: it.quantity + 1 } : it
        );
      }
      return [
        ...prev,
        {
          productId: product.id,
          productName: product.name,
          quantity: 1,
          unitPrice: product.sellingPrice || 0,
          taxRate: product.taxRate || 0,
          dietaryType: (product as any).dietaryType || 'veg',
        },
      ];
    });
  }, []);

  const handleToggleAvailability = useCallback(
    (product: Product) => {
      const nextAvailable = !isProductAvailable(product);
      Alert.alert(
        nextAvailable ? 'Mark available?' : 'Mark not available?',
        nextAvailable
          ? `"${product.name}" will show on the menu again.`
          : `"${product.name}" will be hidden from the live menu until you mark it available.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: nextAvailable ? 'Mark available' : 'Not available',
            style: nextAvailable ? 'default' : 'destructive',
            onPress: async () => {
              try {
                await updateProduct({ id: product.id, payload: { isAvailable: nextAvailable } });
                if (!nextAvailable) {
                  setSelectedItems((prev) => prev.filter((it) => it.productId !== product.id));
                }
              } catch (err: any) {
                Alert.alert('Update failed', err?.message || 'Could not update menu item');
              }
            },
          },
        ]
      );
    },
    [updateProduct]
  );

  const renderMenuItem = useCallback(
    ({ item }: { item: Product }) => (
      <MenuFoodCard
        product={item}
        inCartQty={cartQtyByProductId.get(item.id) || 0}
        theme={theme}
        unavailable={!isProductAvailable(item)}
        onPress={handleAddProduct}
        onToggleAvailability={handleToggleAvailability}
      />
    ),
    [cartQtyByProductId, theme, handleAddProduct, handleToggleAvailability]
  );

  const handleUpdateQty = (idx: number, delta: number) => {
    setSelectedItems((prev) =>
      prev
        .map((it, i) => (i === idx ? { ...it, quantity: it.quantity + delta } : it))
        .filter((it) => it.quantity > 0)
    );
  };

  const handleRemoveItem = (idx: number) => {
    setSelectedItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleUpdateItemNotes = (idx: number, notes: string) => {
    setSelectedItems((prev) =>
      prev.map((it, i) => (i === idx ? { ...it, notes } : it))
    );
  };

  // 1. Send to Kitchen / Print KOT
  const handleSendToKitchen = async () => {
    if (selectedItems.length === 0) {
      Alert.alert('Empty Ticket', 'Please select at least one menu item.');
      return;
    }

    if (orderType === 'dine_in' && !selectedTableId && !partyLabel.trim()) {
      Alert.alert('Table Required', 'Please select a dining table or specify a guest name.');
      return;
    }

    try {
      const selectedTable = tables.find((t) => t.id === selectedTableId);
      const effectivePartyLabel =
        partyLabel.trim() ||
        (orderType === 'dine_in' ? selectedTable?.name || 'Table 1' : 'Takeaway Token');

      const created = await createOrder({
        orderType,
        tableId: selectedTableId || undefined,
        partyLabel: effectivePartyLabel,
        guestCount: parseInt(guestCount, 10) || 1,
        contactNumber: contactNumber.trim() || undefined,
        notes: [waiterName.trim() ? `Server: ${waiterName.trim()}` : '', orderNotes.trim()]
          .filter(Boolean)
          .join(' • ') || undefined,
        priority,
        status: 'sent_to_kitchen',
        items: selectedItems.map((it) => ({
          productId: it.productId,
          productName: it.productName,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          taxRate: it.taxRate,
          notes: it.notes,
        })),
      });

      // Fire KOT Print via Thermal Printer (lazy-load heavy printer module)
      try {
        const { default: ThermalPrinterService } = await import('@/services/PrinterService');
        await ThermalPrinterService.printKotTicket(
          {
            storeName: settings?.businessName || 'SEZNIK KITCHEN',
            orderNumber: created.orderNumber,
            orderType,
            tableName: selectedTable?.name,
            partyLabel: effectivePartyLabel,
            guestCount: parseInt(guestCount, 10) || 1,
            contactNumber: contactNumber.trim() || undefined,
            priority,
            notes: [waiterName.trim() ? `Server: ${waiterName.trim()}` : '', orderNotes.trim()]
              .filter(Boolean)
              .join(' • ') || undefined,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            items: selectedItems.map((it) => ({
              productName: it.productName,
              quantity: it.quantity,
              notes: it.notes,
            })),
          },
          paperWidth || '58mm'
        );
      } catch (printErr) {
        console.warn('KOT Print warning:', printErr);
      }

      Alert.alert('KOT Sent to Kitchen!', `KOT #${created.orderNumber} dispatched to kitchen stations.`, [
        {
          text: 'View KOT Order',
          onPress: () => router.replace(`/kot/${created.id}` as any),
        },
        {
          text: 'KOT Board',
          onPress: () => router.replace('/kot' as any),
        },
      ]);
    } catch (err: any) {
      Alert.alert('Order Error', err?.message || 'Failed to create KOT order');
    }
  };

  // 2. Direct Settle Bill
  const handleSettleBillSubmit = async () => {
    if (selectedItems.length === 0) {
      Alert.alert('Empty Ticket', 'Please select at least one menu item.');
      return;
    }

    try {
      const selectedTable = tables.find((t) => t.id === selectedTableId);
      const effectivePartyLabel =
        partyLabel.trim() ||
        (orderType === 'dine_in' ? selectedTable?.name || 'Table 1' : 'Takeaway Token');

      const created = await createOrder({
        orderType,
        tableId: selectedTableId || undefined,
        partyLabel: effectivePartyLabel,
        guestCount: parseInt(guestCount, 10) || 1,
        contactNumber: contactNumber.trim() || undefined,
        notes: [waiterName.trim() ? `Server: ${waiterName.trim()}` : '', orderNotes.trim()]
          .filter(Boolean)
          .join(' • ') || undefined,
        priority,
        status: 'billed',
        items: selectedItems.map((it) => ({
          productId: it.productId,
          productName: it.productName,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          taxRate: it.taxRate,
          notes: it.notes,
        })),
      });

      // Auto print customer receipt if connected (lazy-load receipt/print modules)
      if (connectionState === 'connected') {
        try {
          const [{ getTemplateById }, { printInvoiceReceipt }] = await Promise.all([
            import('@/constants/receiptTemplates'),
            import('@/utils/invoiceActions'),
          ]);
          const template = getTemplateById(activeTemplateId);
          const customTemplate = customTemplates?.find((t) => t.id === activeCustomTemplateId) || null;
          const gstBilling = parseGstBilling(storeProfile.settings?.invoiceConfig);
          const provisionalSale: Sale = {
            id: created.id,
            invoiceNumber: `INV-${created.orderNumber}`,
            createdAt: new Date().toISOString(),
            customerName: effectivePartyLabel,
            items: selectedItems.map((it) => ({
              productName: it.productName,
              quantity: it.quantity,
              unitPrice: it.unitPrice,
              taxRate: it.taxRate,
              total: it.unitPrice * it.quantity,
            })),
            subtotal,
            totalTax: taxTotal,
            totalDiscount: discountVal,
            grandTotal,
            amountPaid: grandTotal,
            changeReturned: 0,
            paymentMethod,
            isQuickBill: false,
          };
          await printInvoiceReceipt(
            provisionalSale,
            storeProfile,
            paperWidth || '58mm',
            {
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
            },
            connectionState
          );
        } catch (printErr) {
          console.warn('Customer Receipt print warning:', printErr);
        }
      }

      setShowSettleModal(false);
      Alert.alert('Bill Settled!', `Order #${created.orderNumber} successfully paid via ${paymentMethod.toUpperCase()}.`, [
        {
          text: 'New Order',
          onPress: () => {
            setSelectedItems([]);
            setActiveTab('menu');
          },
        },
        {
          text: 'KOT Board',
          onPress: () => router.replace('/kot' as any),
        },
      ]);
    } catch (err: any) {
      Alert.alert('Billing Error', err?.message || 'Failed to settle bill');
    }
  };

  return (
    <ScreenBackground color={theme.bg}>
      <StatusBar
        barStyle={theme.isDark ? 'light-content' : 'dark-content'}
        backgroundColor="transparent"
        translucent
      />
      <View style={[styles.container, { paddingTop: topPadding }]}>
        {/* 1. Header Bar: Title, Store Pills & Close */}
        <View style={[styles.topHeader, { borderBottomColor: theme.borderColor }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.topSubLabel, { color: theme.textSecondary }]}>
              {orderType === 'dine_in' ? 'Dine-in bill' : orderType === 'takeaway' ? 'Takeaway bill' : 'Delivery order'}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 1 }}>
              <Text style={[styles.topTitle, { color: theme.textPrimary }]}>
                {partyLabel || '1 no'}
              </Text>
              <StoreSwitcher onChange={(id) => setSelectedStoreId(id)} />
            </View>
          </View>

          <TouchableOpacity
            onPress={() => router.back()}
            style={[styles.topCloseBtn, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}
          >
            <X size={18} color={theme.textPrimary} />
          </TouchableOpacity>
        </View>

        {/* 2. Dual Tabs: Menu vs Ticket (N) */}
        <View style={[styles.tabsHeader, { borderBottomColor: theme.borderColor }]}>
          <TouchableOpacity
            onPress={() => setActiveTab('menu')}
            style={[
              styles.tabHeaderBtn,
              activeTab === 'menu' && styles.tabHeaderBtnActive,
            ]}
          >
            <Text
              style={[
                styles.tabHeaderText,
                activeTab === 'menu'
                  ? { color: BRAND_COLORS.blue600, fontWeight: '900' }
                  : { color: theme.textSecondary },
              ]}
            >
              Menu
            </Text>
            {activeTab === 'menu' && <View style={styles.tabIndicator} />}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setActiveTab('ticket')}
            style={[
              styles.tabHeaderBtn,
              activeTab === 'ticket' && styles.tabHeaderBtnActive,
            ]}
          >
            <Text
              style={[
                styles.tabHeaderText,
                activeTab === 'ticket'
                  ? { color: BRAND_COLORS.blue600, fontWeight: '900' }
                  : { color: theme.textSecondary },
              ]}
            >
              Ticket {totalItemsCount > 0 ? `(${totalItemsCount})` : ''}
            </Text>
            {activeTab === 'ticket' && <View style={styles.tabIndicator} />}
          </TouchableOpacity>
        </View>

        {/* 3. Tab Content */}
        {activeTab === 'menu' ? (
          /* ================= MENU TAB ================= */
          <View style={{ flex: 1 }}>
            {/* Search Bar & + Add Dish CTA */}
            <View style={styles.searchRow}>
              <View
                style={[
                  styles.searchBar,
                  { backgroundColor: theme.cardBg, borderColor: theme.borderColor },
                ]}
              >
                <Search size={16} color={theme.textSecondary} style={{ marginRight: 8 }} />
                <TextInput
                  style={[styles.searchInput, { color: theme.textPrimary }]}
                  placeholder="Search menu..."
                  placeholderTextColor="#94A3B8"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
                {searchQuery ? (
                  <TouchableOpacity onPress={() => setSearchQuery('')}>
                    <X size={15} color={theme.textSecondary} />
                  </TouchableOpacity>
                ) : null}
              </View>

              <TouchableOpacity
                onPress={() => setShowAddFoodModal(true)}
                style={styles.addDishBtn}
              >
                <Plus size={16} color="#FFFFFF" style={{ marginRight: 4 }} />
                <Text style={styles.addDishBtnText}>Add Item</Text>
              </TouchableOpacity>
            </View>

            {/* Category Pills — KOT is availability-based, no stock filters */}
            <View style={styles.categoryPillsWrapper}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                <TouchableOpacity
                  onPress={() => {
                    setShowUnavailable(false);
                    setSelectedCategory('all');
                  }}
                  style={[
                    styles.catPill,
                    !showUnavailable && selectedCategory === 'all'
                      ? { backgroundColor: BRAND_COLORS.navyInk, borderColor: BRAND_COLORS.navyInk }
                      : { backgroundColor: theme.cardBg, borderColor: theme.borderColor },
                  ]}
                >
                  <Text
                    style={[
                      styles.catPillText,
                      {
                        color:
                          !showUnavailable && selectedCategory === 'all'
                            ? '#FFFFFF'
                            : theme.textPrimary,
                      },
                    ]}
                  >
                    All
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => {
                    setShowUnavailable(true);
                    setSelectedCategory('all');
                  }}
                  style={[
                    styles.catPill,
                    showUnavailable
                      ? { backgroundColor: '#DC2626', borderColor: '#DC2626' }
                      : { backgroundColor: theme.cardBg, borderColor: theme.borderColor },
                  ]}
                >
                  <Text
                    style={[
                      styles.catPillText,
                      { color: showUnavailable ? '#FFFFFF' : theme.textPrimary },
                    ]}
                  >
                    Not available
                  </Text>
                </TouchableOpacity>

                {categories.map((cat) => {
                  const active = !showUnavailable && selectedCategory === cat.id;
                  return (
                    <TouchableOpacity
                      key={cat.id}
                      onPress={() => {
                        setShowUnavailable(false);
                        setSelectedCategory(cat.id);
                      }}
                      style={[
                        styles.catPill,
                        active
                          ? { backgroundColor: BRAND_COLORS.navyInk, borderColor: BRAND_COLORS.navyInk }
                          : { backgroundColor: theme.cardBg, borderColor: theme.borderColor },
                      ]}
                    >
                      <Text
                        style={[
                          styles.catPillText,
                          { color: active ? '#FFFFFF' : theme.textPrimary },
                        ]}
                      >
                        {cat.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* 2-Column Responsive Food Product Grid */}
            <FlatList
              data={filteredProducts}
              keyExtractor={(item) => item.id}
              numColumns={2}
              style={{ flex: 1, paddingHorizontal: 14 }}
              contentContainerStyle={{ paddingBottom: 100 }}
              columnWrapperStyle={styles.foodGrid}
              renderItem={renderMenuItem}
              initialNumToRender={12}
              maxToRenderPerBatch={10}
              windowSize={7}
              removeClippedSubviews
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={
                <Text style={{ textAlign: 'center', color: theme.textSecondary, marginTop: 40 }}>
                  No menu items match this search.
                </Text>
              }
            />

            {/* Sticky Floating Ticket Bar if items exist */}
            {totalItemsCount > 0 && (
              <View style={[styles.floatingTicketBar, { backgroundColor: BRAND_COLORS.navyInk }]}>
                <View style={styles.floatingTicketMeta}>
                  <Text style={styles.floatingTicketTitle}>
                    {totalItemsCount} Item{totalItemsCount > 1 ? 's' : ''} in Ticket
                  </Text>
                  <Text style={styles.floatingTicketPrice}>₹{grandTotal.toFixed(2)}</Text>
                </View>

                <View style={styles.floatingTicketActions}>
                  <TouchableOpacity
                    onPress={() => setActiveTab('ticket')}
                    style={styles.floatingViewTicketBtn}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Text style={styles.floatingViewTicketBtnText}>View Ticket</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={handleSendToKitchen}
                    disabled={isCreating}
                    style={[
                      styles.floatingTicketBtn,
                      isCreating && { opacity: 0.7 },
                    ]}
                  >
                    {isCreating ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <Printer size={14} color="#FFFFFF" style={{ marginRight: 5 }} />
                        <Text style={styles.floatingTicketBtnText}>Print Ticket</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        ) : (
          /* ================= TICKET TAB ================= */
          <ScrollView
            style={{ flex: 1, paddingHorizontal: 14 }}
            contentContainerStyle={{ paddingBottom: 120 }}
          >
            {/* Ticket Header & KOT Badge */}
            <View style={styles.ticketHeaderRow}>
              <Text style={[styles.ticketTitleText, { color: theme.textPrimary }]}>
                {partyLabel || 'Takeaway 1 no'}
              </Text>
              <View style={styles.kotBadgeWrap}>
                <Text style={styles.kotBadgeText}>#KOT-NEW</Text>
              </View>
            </View>

            {/* Order Type Selector Pills: Dine-in, Takeaway, Delivery */}
            <View style={[styles.orderTypeSelector, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
              {(['dine_in', 'takeaway', 'delivery'] as const).map((type) => {
                const active = orderType === type;
                const label = type === 'dine_in' ? 'Dine-in' : type === 'takeaway' ? 'Takeaway' : 'Delivery';
                return (
                  <TouchableOpacity
                    key={type}
                    onPress={() => setOrderType(type)}
                    style={[
                      styles.orderTypePill,
                      active && { backgroundColor: BRAND_COLORS.navyInk },
                    ]}
                  >
                    <Text
                      style={[
                        styles.orderTypePillText,
                        { color: active ? '#FFFFFF' : theme.textSecondary, fontWeight: active ? '900' : '700' },
                      ]}
                    >
                      {label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Server / Waiter Name Input */}
            <TextInput
              style={[
                styles.waiterInput,
                { backgroundColor: theme.cardBg, borderColor: theme.borderColor, color: theme.textPrimary },
              ]}
              placeholder="Waiter / server name (Optional)"
              placeholderTextColor="#94A3B8"
              value={waiterName}
              onChangeText={setWaiterName}
            />

            {/* Table Picker if Dine-In */}
            {orderType === 'dine_in' && (
              <View style={{ marginBottom: 14 }}>
                <Text style={[styles.sectionHeading, { color: theme.textSecondary }]}>SELECT TABLE</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                  {tables.map((t) => {
                    const active = selectedTableId === t.id;
                    return (
                      <TouchableOpacity
                        key={t.id}
                        onPress={() => {
                          setSelectedTableId(t.id);
                          setPartyLabel(t.name);
                        }}
                        style={[
                          styles.tableChip,
                          active
                            ? { backgroundColor: BRAND_COLORS.blue600, borderColor: BRAND_COLORS.blue600 }
                            : { backgroundColor: theme.cardBg, borderColor: theme.borderColor },
                        ]}
                      >
                        <Text style={[styles.tableChipText, { color: active ? '#FFFFFF' : theme.textPrimary }]}>
                          {t.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            )}

            {/* NEW ITEMS TO PRINT (YELLOW HIGHLIGHT CARD) */}
            <Text style={[styles.sectionHeading, { color: '#D97706', marginTop: 10 }]}>
              NEW ITEMS TO PRINT ({selectedItems.length})
            </Text>

            {selectedItems.length === 0 ? (
              <View style={[styles.emptyTicketCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
                <Utensils size={28} color={theme.textSecondary} />
                <Text style={[styles.emptyTicketText, { color: theme.textPrimary }]}>
                  No items in ticket yet
                </Text>
                <TouchableOpacity
                  onPress={() => setActiveTab('menu')}
                  style={styles.emptyAddBtn}
                >
                  <Text style={styles.emptyAddBtnText}>Browse Menu</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.ticketItemsList}>
                {selectedItems.map((item, idx) => (
                  <View
                    key={idx}
                    style={[
                      styles.ticketItemCard,
                      { backgroundColor: theme.isDark ? 'rgba(245, 158, 11, 0.12)' : '#FEFCE8', borderColor: '#FDE047' },
                    ]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.ticketItemTitle, { color: theme.textPrimary }]}>
                        {item.quantity} × {item.productName}
                      </Text>
                      <Text style={[styles.ticketItemPrice, { color: theme.textSecondary }]}>
                        ₹{(item.unitPrice * item.quantity).toFixed(2)}
                      </Text>

                      {/* Item Kitchen Note */}
                      <TextInput
                        style={[styles.itemNoteInput, { color: theme.textPrimary, borderColor: 'rgba(0,0,0,0.1)' }]}
                        placeholder="Add kitchen note (e.g. Less Spicy, No Onion)..."
                        placeholderTextColor="#A1A1AA"
                        value={item.notes || ''}
                        onChangeText={(t) => handleUpdateItemNotes(idx, t)}
                      />
                    </View>

                    {/* Steppers & Delete */}
                    <View style={styles.stepperWrap}>
                      <TouchableOpacity
                        onPress={() => handleUpdateQty(idx, -1)}
                        style={styles.stepBtnSmall}
                      >
                        <Minus size={14} color={theme.textPrimary} />
                      </TouchableOpacity>
                      <Text style={[styles.stepperQty, { color: theme.textPrimary }]}>
                        {item.quantity}
                      </Text>
                      <TouchableOpacity
                        onPress={() => handleUpdateQty(idx, 1)}
                        style={styles.stepBtnSmall}
                      >
                        <Plus size={14} color={theme.textPrimary} />
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() => handleRemoveItem(idx)}
                        style={styles.deleteItemBtn}
                      >
                        <Trash2 size={15} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* Bill Summary */}
            {selectedItems.length > 0 && (
              <View style={[styles.billSummaryCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
                <View style={styles.billRow}>
                  <Text style={[styles.billLabel, { color: theme.textSecondary }]}>Subtotal</Text>
                  <Text style={[styles.billValue, { color: theme.textPrimary }]}>₹{subtotal.toFixed(2)}</Text>
                </View>
                <View style={styles.billRow}>
                  <Text style={[styles.billLabel, { color: theme.textSecondary }]}>Tax / GST</Text>
                  <Text style={[styles.billValue, { color: theme.textPrimary }]}>₹{taxTotal.toFixed(2)}</Text>
                </View>

                <View style={[styles.billRowTotal, { borderTopColor: theme.borderColor }]}>
                  <Text style={[styles.totalLabel, { color: theme.textPrimary }]}>Total</Text>
                  <Text style={[styles.totalValue, { color: theme.textPrimary }]}>₹{grandTotal.toFixed(2)}</Text>
                </View>
              </View>
            )}

            {/* Dual Action Buttons */}
            {selectedItems.length > 0 && (
              <View style={styles.actionButtonsContainer}>
                {/* 1. Send to Kitchen / Print KOT */}
                <TouchableOpacity
                  onPress={handleSendToKitchen}
                  disabled={isCreating}
                  style={[styles.sendKotBtn, { backgroundColor: theme.isDark ? '#1E293B' : '#F1F5F9' }]}
                >
                  <Printer size={17} color={BRAND_COLORS.blue600} style={{ marginRight: 6 }} />
                  <Text style={[styles.sendKotBtnText, { color: theme.textPrimary }]}>
                    Send to Kitchen / Print KOT
                  </Text>
                </TouchableOpacity>

                {/* 2. Settle Bill */}
                <TouchableOpacity
                  onPress={() => setShowSettleModal(true)}
                  style={styles.settleBillBtn}
                >
                  <CreditCard size={17} color="#FFFFFF" style={{ marginRight: 6 }} />
                  <Text style={styles.settleBillBtnText}>Settle Bill</Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        )}

        {/* Modal: Add Food Item on the fly */}
        {showAddFoodModal ? (
          <AddFoodItemModal
            visible={showAddFoodModal}
            onClose={() => setShowAddFoodModal(false)}
            onItemCreated={(newItem) => {
              if (newItem) handleAddProduct(newItem);
            }}
          />
        ) : null}

        {/* Modal: Settle Bill & Payment */}
        <Modal
          visible={showSettleModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowSettleModal(false)}
        >
          <View style={styles.settleModalOverlay}>
            <View style={[styles.settleModalCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
              <View style={styles.settleHeaderRow}>
                <Text style={[styles.settleTitle, { color: theme.textPrimary }]}>Settle & Pay Bill</Text>
                <TouchableOpacity onPress={() => setShowSettleModal(false)}>
                  <X size={18} color={theme.textSecondary} />
                </TouchableOpacity>
              </View>

              <Text style={[styles.settleAmountBig, { color: BRAND_COLORS.blue600 }]}>
                ₹{grandTotal.toFixed(2)}
              </Text>

              {/* Payment Methods: Cash, UPI QR, Card */}
              <View style={styles.paymentMethodsRow}>
                {(['cash', 'upi', 'card'] as const).map((method) => {
                  const active = paymentMethod === method;
                  return (
                    <TouchableOpacity
                      key={method}
                      onPress={() => setPaymentMethod(method)}
                      style={[
                        styles.payMethodTile,
                        active
                          ? { backgroundColor: BRAND_COLORS.blue600, borderColor: BRAND_COLORS.blue600 }
                          : { backgroundColor: theme.bg, borderColor: theme.borderColor },
                      ]}
                    >
                      {method === 'cash' ? (
                        <Banknote size={20} color={active ? '#FFF' : theme.textPrimary} />
                      ) : method === 'upi' ? (
                        <QrCode size={20} color={active ? '#FFF' : theme.textPrimary} />
                      ) : (
                        <CreditCard size={20} color={active ? '#FFF' : theme.textPrimary} />
                      )}
                      <Text
                        style={[
                          styles.payMethodText,
                          { color: active ? '#FFF' : theme.textPrimary, fontWeight: '800' },
                        ]}
                      >
                        {method.toUpperCase()}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Action Buttons */}
              <View style={styles.settleActionsRow}>
                <TouchableOpacity
                  onPress={() => setShowSettleModal(false)}
                  style={[styles.settleCancelBtn, { borderColor: theme.borderColor }]}
                >
                  <Text style={[styles.settleCancelText, { color: theme.textPrimary }]}>Back</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleSettleBillSubmit}
                  disabled={isCreating}
                  style={styles.settleConfirmBtn}
                >
                  {isCreating ? (
                    <ActivityIndicator color="#FFF" />
                  ) : (
                    <Text style={styles.settleConfirmText}>Record Payment</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  topSubLabel: { fontSize: 11, fontWeight: '700' },
  topTitle: { fontSize: 18, fontWeight: '900', marginRight: 10 },
  topCloseBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabsHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tabHeaderBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  tabHeaderBtnActive: {},
  tabHeaderText: { fontSize: 14, fontWeight: '800' },
  tabIndicator: {
    position: 'absolute',
    bottom: -1,
    left: 20,
    right: 20,
    height: 3,
    backgroundColor: BRAND_COLORS.blue600,
    borderRadius: 2,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    height: 42,
  },
  searchInput: { flex: 1, fontSize: 13, fontWeight: '600' },
  addDishBtn: {
    backgroundColor: BRAND_COLORS.navyInk,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    height: 42,
    borderRadius: 12,
  },
  addDishBtnText: { color: '#FFFFFF', fontSize: 12.5, fontWeight: '900' },
  categoryPillsWrapper: {
    paddingHorizontal: 14,
    marginBottom: 10,
  },
  catPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
  },
  catPillText: { fontSize: 12, fontWeight: '800' },
  foodGrid: {
    gap: 10,
    marginBottom: 6,
  },
  foodCard: {
    flex: 1,
    maxWidth: '50%',
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 2,
  },
  cardImageContainer: {
    width: '100%',
    height: 100,
    position: 'relative',
  },
  cardImage: { width: '100%', height: '100%' },
  cardPlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardPlaceholderText: { fontSize: 32, fontWeight: '900', opacity: 0.3 },
  dietaryBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 4,
    padding: 2,
    elevation: 2,
  },
  dietaryIconBox: {
    width: 14,
    height: 14,
    borderRadius: 3,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dietaryDot: { width: 6, height: 6, borderRadius: 3 },
  cartBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: BRAND_COLORS.blue600,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  cartBadgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '900' },
  unavailableBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(220, 38, 38, 0.92)',
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  unavailableBadgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900' },
  cardBody: { paddingHorizontal: 10, paddingTop: 8, paddingBottom: 10 },
  dishName: { fontSize: 13, fontWeight: '800', minHeight: 34 },
  cardFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
    gap: 6,
  },
  dishPrice: { fontSize: 13.5, fontWeight: '900' },
  availabilityBtn: {
    flexShrink: 1,
    paddingVertical: 2,
  },
  availabilityBtnText: {
    fontSize: 10,
    fontWeight: '800',
  },
  floatingTicketBar: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    elevation: 8,
  },
  floatingTicketMeta: {
    flexShrink: 1,
    minWidth: 0,
  },
  floatingTicketTitle: { color: '#94A3B8', fontSize: 11, fontWeight: '700' },
  floatingTicketPrice: { color: '#FFFFFF', fontSize: 18, fontWeight: '900' },
  floatingTicketActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  floatingViewTicketBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
  },
  floatingViewTicketBtnText: {
    color: '#E2E8F0',
    fontSize: 12,
    fontWeight: '800',
  },
  floatingTicketBtn: {
    backgroundColor: BRAND_COLORS.blue600,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 108,
    justifyContent: 'center',
  },
  floatingTicketBtnText: { color: '#FFFFFF', fontSize: 12.5, fontWeight: '900' },
  ticketHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  ticketTitleText: { fontSize: 19, fontWeight: '900' },
  kotBadgeWrap: {},
  kotBadgeText: { color: BRAND_COLORS.blue600, fontSize: 14, fontWeight: '900' },
  orderTypeSelector: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 3,
    borderWidth: 1,
    marginBottom: 12,
  },
  orderTypePill: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 10,
  },
  orderTypePillText: { fontSize: 12 },
  waiterInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 12,
  },
  sectionHeading: { fontSize: 11, fontWeight: '900', letterSpacing: 0.5, marginBottom: 8 },
  tableChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  tableChipText: { fontSize: 12, fontWeight: '800' },
  emptyTicketCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 10,
  },
  emptyTicketText: { fontSize: 14, fontWeight: '800', marginTop: 10 },
  emptyAddBtn: {
    marginTop: 10,
    backgroundColor: BRAND_COLORS.blue600,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
  },
  emptyAddBtnText: { color: '#FFF', fontSize: 12, fontWeight: '800' },
  ticketItemsList: { gap: 8, marginBottom: 14 },
  ticketItemCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  ticketItemTitle: { fontSize: 13.5, fontWeight: '800' },
  ticketItemPrice: { fontSize: 12, marginTop: 2, fontWeight: '700' },
  itemNoteInput: {
    fontSize: 11,
    marginTop: 6,
    borderTopWidth: 1,
    paddingTop: 4,
    fontWeight: '600',
  },
  stepperWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginLeft: 8,
  },
  stepBtnSmall: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: 'rgba(100, 116, 139, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperQty: { fontSize: 13, fontWeight: '900', minWidth: 16, textAlign: 'center' },
  deleteItemBtn: { padding: 6, marginLeft: 2 },
  billSummaryCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginBottom: 14,
  },
  billRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  billLabel: { fontSize: 12, fontWeight: '700' },
  billValue: { fontSize: 12.5, fontWeight: '800' },
  billRowTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
    paddingTop: 8,
    borderTopWidth: 1,
  },
  totalLabel: { fontSize: 15, fontWeight: '900' },
  totalValue: { fontSize: 17, fontWeight: '900' },
  actionButtonsContainer: { gap: 8 },
  sendKotBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
  },
  sendKotBtnText: { fontSize: 14, fontWeight: '800' },
  settleBillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BRAND_COLORS.navyInk,
    paddingVertical: 14,
    borderRadius: 14,
  },
  settleBillBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
  settleModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  settleModalCard: {
    width: '100%',
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
  },
  settleHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  settleTitle: { fontSize: 17, fontWeight: '900' },
  settleAmountBig: { fontSize: 32, fontWeight: '900', textAlign: 'center', marginVertical: 14 },
  paymentMethodsRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  payMethodTile: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    gap: 6,
  },
  payMethodText: { fontSize: 12 },
  settleActionsRow: { flexDirection: 'row', gap: 10 },
  settleCancelBtn: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  settleCancelText: { fontSize: 13, fontWeight: '800' },
  settleConfirmBtn: {
    flex: 2,
    backgroundColor: BRAND_COLORS.navyInk,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  settleConfirmText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
});
