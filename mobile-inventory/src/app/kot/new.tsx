import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
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
import ThermalPrinterService from '@/services/PrinterService';
import { useSettings } from '@/hooks/useSettings';
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

export default function NewKotOrderScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const topPadding = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0, 12);

  const { products } = useProducts();
  const { categories } = useCategories();
  const { tables } = useRestaurantTables();
  const { createOrder, isCreating } = useKotOrders();
  const { connectionState, paperWidth } = usePrinterStore();
  const { settings } = useSettings();

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
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Modals
  const [showAddFoodModal, setShowAddFoodModal] = useState(false);
  const [showSettleModal, setShowSettleModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'upi' | 'card'>('cash');
  const [discountAmount, setDiscountAmount] = useState('');

  // Filter food products
  const filteredProducts = products.filter((p: Product) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.barcode && p.barcode.includes(searchQuery));
    const matchesCat =
      selectedCategory === 'all' ||
      p.categoryId === selectedCategory ||
      (p.category && p.category.name.toLowerCase() === selectedCategory.toLowerCase());
    return matchesSearch && matchesCat;
  });

  const totalItemsCount = selectedItems.reduce((sum, it) => sum + it.quantity, 0);
  const subtotal = selectedItems.reduce((acc, it) => acc + it.unitPrice * it.quantity, 0);
  const taxTotal = selectedItems.reduce((acc, it) => acc + (it.unitPrice * it.quantity * (it.taxRate || 0)) / 100, 0);
  const discountVal = parseFloat(discountAmount) || 0;
  const grandTotal = Math.max(0, subtotal + taxTotal - discountVal);

  const handleAddProduct = (product: Product) => {
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
  };

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

      // Fire KOT Print via Thermal Printer
      try {
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

      Alert.alert('KOT Sent to Kitchen! 👨‍🍳', `KOT #${created.orderNumber} dispatched to kitchen stations.`, [
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

      // Auto print customer receipt if connected
      try {
        await ThermalPrinterService.printSaleReceipt(
          {
            storeName: settings?.businessName || 'SEZNIK RESTAURANT',
            storeAddress: settings?.businessAddress || '',
            storePhone: settings?.businessPhone || '',
            invoiceNumber: `INV-${created.orderNumber}`,
            date: new Date().toLocaleDateString('en-GB'),
            customerName: effectivePartyLabel,
            items: selectedItems.map((it) => ({
              productName: it.productName,
              quantity: it.quantity,
              unitPrice: it.unitPrice,
              total: it.unitPrice * it.quantity,
            })),
            subtotal,
            totalTax: taxTotal,
            totalDiscount: discountVal,
            grandTotal,
            amountPaid: grandTotal,
            changeReturned: 0,
            paymentMethod: paymentMethod.toUpperCase(),
          },
          { paperWidth: paperWidth || '58mm' }
        );
      } catch (printErr) {
        console.warn('Customer Receipt print warning:', printErr);
      }

      setShowSettleModal(false);
      Alert.alert('Bill Settled! 🧾', `Order #${created.orderNumber} successfully paid via ${paymentMethod.toUpperCase()}.`, [
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

            {/* Category Pills */}
            <View style={styles.categoryPillsWrapper}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                <TouchableOpacity
                  onPress={() => setSelectedCategory('all')}
                  style={[
                    styles.catPill,
                    selectedCategory === 'all'
                      ? { backgroundColor: BRAND_COLORS.navyInk, borderColor: BRAND_COLORS.navyInk }
                      : { backgroundColor: theme.cardBg, borderColor: theme.borderColor },
                  ]}
                >
                  <Text
                    style={[
                      styles.catPillText,
                      { color: selectedCategory === 'all' ? '#FFFFFF' : theme.textPrimary },
                    ]}
                  >
                    All
                  </Text>
                </TouchableOpacity>

                {categories.map((cat) => {
                  const active = selectedCategory === cat.id;
                  return (
                    <TouchableOpacity
                      key={cat.id}
                      onPress={() => setSelectedCategory(cat.id)}
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
            <ScrollView
              style={{ flex: 1, paddingHorizontal: 14 }}
              contentContainerStyle={{ paddingBottom: 100 }}
            >
              <View style={styles.foodGrid}>
                {filteredProducts.map((p) => {
                  const cartLine = selectedItems.find((it) => it.productId === p.id);
                  const inCartQty = cartLine?.quantity || 0;
                  const stock = typeof p.currentStock === 'number' ? p.currentStock : 99;
                  const isOut = stock <= 0;
                  const dietary = (p as any).dietaryType || 'veg';

                  return (
                    <TouchableOpacity
                      key={p.id}
                      onPress={() => handleAddProduct(p)}
                      activeOpacity={0.8}
                      style={[
                        styles.foodCard,
                        {
                          backgroundColor: theme.cardBg,
                          borderColor: inCartQty > 0 ? BRAND_COLORS.blue600 : theme.borderColor,
                          borderWidth: inCartQty > 0 ? 1.5 : 1,
                        },
                      ]}
                    >
                      {/* Image / Letter Box */}
                      <View style={styles.cardImageContainer}>
                        {p.imageUrl ? (
                          <Image source={{ uri: p.imageUrl }} style={styles.cardImage} resizeMode="cover" />
                        ) : (
                          <View style={[styles.cardPlaceholder, { backgroundColor: theme.isDark ? 'rgba(255,255,255,0.05)' : '#F1F5F9' }]}>
                            <Text style={[styles.cardPlaceholderText, { color: theme.textSecondary }]}>
                              {p.name.slice(0, 1).toUpperCase()}
                            </Text>
                          </View>
                        )}

                        {/* Veg / Non-Veg Indicator Badge */}
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

                        {/* Cart Badge */}
                        {inCartQty > 0 && (
                          <View style={styles.cartBadge}>
                            <Text style={styles.cartBadgeText}>{inCartQty}</Text>
                          </View>
                        )}
                      </View>

                      {/* Content */}
                      <View style={styles.cardBody}>
                        <Text style={[styles.dishName, { color: theme.textPrimary }]} numberOfLines={2}>
                          {p.name}
                        </Text>

                        <View style={styles.cardFooterRow}>
                          <Text style={[styles.dishPrice, { color: theme.textPrimary }]}>
                            ₹{p.sellingPrice.toFixed(2)}
                          </Text>

                          <Text
                            style={[
                              styles.stockBadgeText,
                              { color: isOut ? '#EF4444' : theme.textSecondary },
                            ]}
                          >
                            {isOut ? 'Out' : `Stk ${stock}`}
                          </Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>

            {/* Sticky Floating Ticket Bar if items exist */}
            {totalItemsCount > 0 && (
              <View style={[styles.floatingTicketBar, { backgroundColor: BRAND_COLORS.navyInk }]}>
                <View>
                  <Text style={styles.floatingTicketTitle}>
                    {totalItemsCount} Item{totalItemsCount > 1 ? 's' : ''} in Ticket
                  </Text>
                  <Text style={styles.floatingTicketPrice}>₹{grandTotal.toFixed(2)}</Text>
                </View>

                <TouchableOpacity
                  onPress={() => setActiveTab('ticket')}
                  style={styles.floatingTicketBtn}
                >
                  <Text style={styles.floatingTicketBtnText}>View Ticket ➔</Text>
                </TouchableOpacity>
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
        <AddFoodItemModal
          visible={showAddFoodModal}
          onClose={() => setShowAddFoodModal(false)}
          onItemCreated={(newItem) => {
            if (newItem) handleAddProduct(newItem);
          }}
        />

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
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 10,
  },
  foodCard: {
    width: '48.5%',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 6,
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
    top: 8,
    right: 8,
    backgroundColor: BRAND_COLORS.blue600,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartBadgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '900' },
  cardBody: { padding: 10 },
  dishName: { fontSize: 13, fontWeight: '800', minHeight: 34 },
  cardFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  dishPrice: { fontSize: 13.5, fontWeight: '900' },
  stockBadgeText: { fontSize: 10.5, fontWeight: '700' },
  floatingTicketBar: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    elevation: 8,
  },
  floatingTicketTitle: { color: '#94A3B8', fontSize: 11, fontWeight: '700' },
  floatingTicketPrice: { color: '#FFFFFF', fontSize: 18, fontWeight: '900' },
  floatingTicketBtn: {
    backgroundColor: BRAND_COLORS.blue600,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
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
