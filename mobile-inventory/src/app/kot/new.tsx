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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  ChevronLeft,
  Utensils,
  ShoppingBag,
  Truck,
  Plus,
  Minus,
  Trash2,
  Flame,
  Printer,
  Search,
  CheckCircle2,
} from 'lucide-react-native';
import { useProducts } from '@/hooks/useProducts';
import { useRestaurantTables } from '@/hooks/useRestaurantTables';
import { useKotOrders } from '@/hooks/useKotOrders';
import { KOTOrderType, KOTPriority } from '@/types/kot';
import { Product } from '@/types/product';
import { useAppTheme } from '@/hooks/useAppTheme';
import { ScreenBackground } from '@/components/ui/ScreenBackground';
import { KeyboardAvoidingWrapper } from '@/components/ui/KeyboardAvoidingWrapper';
import { BRAND_COLORS } from '@/constants/theme';
import { usePrinterStore } from '@/store/usePrinterStore';
import ThermalPrinterService from '@/services/PrinterService';
import { useSettings } from '@/hooks/useSettings';

interface SelectedItemLine {
  productId?: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  notes?: string;
}

export default function NewKotOrderScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const topPadding = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0, 14);

  const { products } = useProducts();
  const { tables } = useRestaurantTables();
  const { createOrder, isCreating } = useKotOrders();
  const { connectionState, paperWidth } = usePrinterStore();
  const { settings } = useSettings();

  const [orderType, setOrderType] = useState<KOTOrderType>('dine_in');
  const [selectedTableId, setSelectedTableId] = useState<string>('');
  const [partyLabel, setPartyLabel] = useState('');
  const [guestCount, setGuestCount] = useState('2');
  const [contactNumber, setContactNumber] = useState('');
  const [orderNotes, setOrderNotes] = useState('');
  const [priority, setPriority] = useState<KOTPriority>('normal');

  const [selectedItems, setSelectedItems] = useState<SelectedItemLine[]>([]);
  const [searchProduct, setSearchProduct] = useState('');

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2,
    }).format(val || 0);
  };

  const filteredProducts = products.filter((p: Product) =>
    p.name.toLowerCase().includes(searchProduct.toLowerCase()) ||
    (p.barcode && p.barcode.includes(searchProduct))
  );

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

  const handleUpdateItemNotes = (idx: number, text: string) => {
    setSelectedItems((prev) =>
      prev.map((it, i) => (i === idx ? { ...it, notes: text } : it))
    );
  };

  const subtotal = selectedItems.reduce((acc, it) => acc + it.unitPrice * it.quantity, 0);

  const handleCreateOrder = async () => {
    if (selectedItems.length === 0) {
      Alert.alert('Empty Order', 'Please add at least one item to the KOT order.');
      return;
    }

    if (orderType === 'dine_in' && !selectedTableId && !partyLabel.trim()) {
      Alert.alert('Table Required', 'Please select a dining table or specify a party/guest name.');
      return;
    }

    try {
      const selectedTable = tables.find((t) => t.id === selectedTableId);

      const created = await createOrder({
        orderType,
        tableId: selectedTableId || undefined,
        partyLabel: partyLabel.trim() || undefined,
        guestCount: parseInt(guestCount) || undefined,
        contactNumber: contactNumber.trim() || undefined,
        notes: orderNotes.trim() || undefined,
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

      // Auto-print KOT Kitchen Slip
      try {
        await ThermalPrinterService.printKotTicket(
          {
            storeName: settings?.businessName || 'SEZNIK KITCHEN',
            orderNumber: created.orderNumber,
            orderType,
            tableName: selectedTable?.name,
            partyLabel: partyLabel.trim() || undefined,
            guestCount: parseInt(guestCount) || undefined,
            contactNumber: contactNumber.trim() || undefined,
            priority,
            notes: orderNotes.trim() || undefined,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            items: selectedItems.map((it) => ({
              productName: it.productName,
              quantity: it.quantity,
              notes: it.notes,
            })),
          },
          paperWidth
        );
      } catch (printErr) {
        console.warn('Auto print KOT failed:', printErr);
      }

      Alert.alert('KOT Sent to Kitchen! 👨‍🍳', `KOT #${created.orderNumber} fired successfully.`, [
        {
          text: 'View Order',
          onPress: () => router.replace(`/kot/${created.id}` as any),
        },
        {
          text: 'Orders Board',
          onPress: () => router.replace('/kot' as any),
        },
      ]);
    } catch (err: any) {
      Alert.alert('Order Error', err?.message || 'Failed to create KOT order');
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
        <KeyboardAvoidingWrapper>
          <ScrollView style={styles.mainWrapper} contentContainerStyle={{ paddingBottom: 40 }}>
            {/* Header Row */}
            <View style={styles.headerRow}>
              <TouchableOpacity
                onPress={() => router.back()}
                style={[styles.backBtn, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}
              >
                <ChevronLeft size={20} color={theme.textPrimary} />
              </TouchableOpacity>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.headerBadge}>NEW KITCHEN ORDER</Text>
                <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>Fire KOT Ticket</Text>
              </View>

              <TouchableOpacity
                onPress={() => setPriority(priority === 'urgent' ? 'normal' : 'urgent')}
                style={[
                  styles.priorityBtn,
                  {
                    backgroundColor: priority === 'urgent' ? 'rgba(239, 68, 68, 0.15)' : theme.cardBg,
                    borderColor: priority === 'urgent' ? '#EF4444' : theme.borderColor,
                  },
                ]}
              >
                <Flame size={14} color={priority === 'urgent' ? '#EF4444' : theme.textSecondary} />
                <Text
                  style={[
                    styles.priorityBtnText,
                    { color: priority === 'urgent' ? '#EF4444' : theme.textSecondary },
                  ]}
                >
                  {priority === 'urgent' ? 'URGENT' : 'Normal'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Order Type Toggle */}
            <View style={styles.typeRow}>
              {[
                { id: 'dine_in' as const, label: 'Dine-In', icon: Utensils },
                { id: 'takeaway' as const, label: 'Takeaway', icon: ShoppingBag },
                { id: 'delivery' as const, label: 'Delivery', icon: Truck },
              ].map((tMode) => {
                const active = orderType === tMode.id;
                const Icon = tMode.icon;
                return (
                  <TouchableOpacity
                    key={tMode.id}
                    onPress={() => setOrderType(tMode.id)}
                    style={[
                      styles.typeChip,
                      {
                        backgroundColor: active ? BRAND_COLORS.navyInk : theme.cardBg,
                        borderColor: active ? BRAND_COLORS.navyInk : theme.borderColor,
                      },
                    ]}
                  >
                    <Icon size={14} color={active ? '#FFF' : theme.textSecondary} />
                    <Text style={[styles.typeChipText, { color: active ? '#FFF' : theme.textSecondary }]}>
                      {tMode.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Dine-in Table Picker or Party Info */}
            {orderType === 'dine_in' ? (
              <View style={[styles.sectionCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
                <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Select Dining Table</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 8 }}>
                  {tables.map((tbl) => {
                    const selected = selectedTableId === tbl.id;
                    return (
                      <TouchableOpacity
                        key={tbl.id}
                        onPress={() => setSelectedTableId(tbl.id)}
                        style={[
                          styles.tableChip,
                          {
                            backgroundColor: selected ? BRAND_COLORS.blue600 : theme.bg,
                            borderColor: selected ? BRAND_COLORS.blue600 : theme.borderColor,
                          },
                        ]}
                      >
                        <Text style={[styles.tableChipText, { color: selected ? '#FFF' : theme.textPrimary }]}>
                          {tbl.name}
                        </Text>
                        {tbl.isOccupied && !selected && (
                          <View style={styles.occupiedDot} />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
                  <View style={{ flex: 1.5 }}>
                    <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Party / Customer Name</Text>
                    <TextInput
                      style={[styles.input, { backgroundColor: theme.bg, borderColor: theme.borderColor, color: theme.textPrimary }]}
                      value={partyLabel}
                      onChangeText={setPartyLabel}
                      placeholder="e.g. Sharma Family"
                      placeholderTextColor="#94A3B8"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Guests</Text>
                    <TextInput
                      style={[styles.input, { backgroundColor: theme.bg, borderColor: theme.borderColor, color: theme.textPrimary }]}
                      value={guestCount}
                      onChangeText={setGuestCount}
                      keyboardType="numeric"
                      placeholder="2"
                      placeholderTextColor="#94A3B8"
                    />
                  </View>
                </View>
              </View>
            ) : (
              <View style={[styles.sectionCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
                <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Customer / Delivery Details</Text>
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
                  <View style={{ flex: 1.5 }}>
                    <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Customer Name</Text>
                    <TextInput
                      style={[styles.input, { backgroundColor: theme.bg, borderColor: theme.borderColor, color: theme.textPrimary }]}
                      value={partyLabel}
                      onChangeText={setPartyLabel}
                      placeholder="e.g. Rahul Verma"
                      placeholderTextColor="#94A3B8"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Phone</Text>
                    <TextInput
                      style={[styles.input, { backgroundColor: theme.bg, borderColor: theme.borderColor, color: theme.textPrimary }]}
                      value={contactNumber}
                      onChangeText={setContactNumber}
                      keyboardType="phone-pad"
                      placeholder="9876543210"
                      placeholderTextColor="#94A3B8"
                    />
                  </View>
                </View>
              </View>
            )}

            {/* Selected Items Box */}
            <View style={[styles.sectionCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>
                  Order Items ({selectedItems.length})
                </Text>
                <Text style={{ fontSize: 13, fontWeight: '900', color: BRAND_COLORS.blue600 }}>
                  Subtotal: {formatCurrency(subtotal)}
                </Text>
              </View>

              {selectedItems.length === 0 ? (
                <Text style={{ fontSize: 12, color: theme.textSecondary, textAlign: 'center', paddingVertical: 14 }}>
                  No items added yet. Tap items from the menu catalog below!
                </Text>
              ) : (
                selectedItems.map((item, idx) => (
                  <View key={idx} style={[styles.selectedItemCard, { backgroundColor: theme.bg, borderColor: theme.borderColor }]}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={[styles.selectedItemName, { color: theme.textPrimary }]} numberOfLines={1}>
                        {item.productName}
                      </Text>
                      <Text style={[styles.selectedItemPrice, { color: theme.textPrimary }]}>
                        {formatCurrency(item.unitPrice * item.quantity)}
                      </Text>
                    </View>

                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
                      <TextInput
                        style={[styles.noteInput, { backgroundColor: theme.cardBg, borderColor: theme.borderColor, color: theme.textPrimary }]}
                        value={item.notes || ''}
                        onChangeText={(txt) => handleUpdateItemNotes(idx, txt)}
                        placeholder="Kitchen note (e.g. Less Spicy, No Onion)..."
                        placeholderTextColor="#94A3B8"
                      />

                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: 8 }}>
                        <TouchableOpacity
                          onPress={() => handleUpdateQty(idx, -1)}
                          style={[styles.qtyBtn, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}
                        >
                          <Minus size={13} color={theme.textPrimary} />
                        </TouchableOpacity>

                        <Text style={{ fontSize: 13, fontWeight: '800', minWidth: 20, textAlign: 'center', color: theme.textPrimary }}>
                          {item.quantity}
                        </Text>

                        <TouchableOpacity
                          onPress={() => handleUpdateQty(idx, 1)}
                          style={[styles.qtyBtn, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}
                        >
                          <Plus size={13} color={theme.textPrimary} />
                        </TouchableOpacity>

                        <TouchableOpacity onPress={() => handleRemoveItem(idx)} style={{ padding: 4 }}>
                          <Trash2 size={15} color="#EF4444" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                ))
              )}
            </View>

            {/* Menu Items Catalog Picker */}
            <View style={[styles.sectionCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
              <Text style={[styles.sectionTitle, { color: theme.textPrimary, marginBottom: 8 }]}>
                Add Items from Menu Catalog
              </Text>

              <View style={[styles.searchBox, { backgroundColor: theme.bg, borderColor: theme.borderColor }]}>
                <Search size={15} color={theme.textSecondary} />
                <TextInput
                  value={searchProduct}
                  onChangeText={setSearchProduct}
                  placeholder="Search dishes, drinks, items..."
                  placeholderTextColor={theme.textSecondary}
                  style={[styles.searchInput, { color: theme.textPrimary }]}
                />
              </View>

              <View style={{ maxHeight: 220 }}>
                <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false}>
                  {filteredProducts.slice(0, 15).map((prod: Product) => (
                    <TouchableOpacity
                      key={prod.id}
                      onPress={() => handleAddProduct(prod)}
                      style={[styles.menuItemRow, { borderBottomColor: theme.borderColor }]}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.menuItemName, { color: theme.textPrimary }]}>{prod.name}</Text>
                        <Text style={{ fontSize: 11, color: theme.textSecondary }}>{prod.unit || 'portion'}</Text>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <Text style={[styles.menuItemPrice, { color: BRAND_COLORS.blue600 }]}>
                          {formatCurrency(prod.sellingPrice || 0)}
                        </Text>
                        <View style={[styles.addItemBadge, { backgroundColor: 'rgba(37, 99, 235, 0.12)' }]}>
                          <Plus size={14} color={BRAND_COLORS.blue600} />
                        </View>
                      </View>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>

            {/* Kitchen Slip Fire Button */}
            <TouchableOpacity
              onPress={handleCreateOrder}
              disabled={isCreating}
              style={[styles.fireKotBtn, { backgroundColor: BRAND_COLORS.navyInk }]}
            >
              {isCreating ? (
                <ActivityIndicator color="#FFF" style={{ marginRight: 8 }} />
              ) : (
                <Printer size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
              )}
              <Text style={styles.fireKotBtnText}>
                Fire KOT & Print Kitchen Slip ({formatCurrency(subtotal)})
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingWrapper>
      </View>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  mainWrapper: { flex: 1, paddingHorizontal: 16, paddingTop: 4 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  backBtn: { padding: 8, borderRadius: 12, borderWidth: 1 },
  headerBadge: { fontSize: 9, fontWeight: '900', color: BRAND_COLORS.sky500, letterSpacing: 0.5 },
  headerTitle: { fontSize: 20, fontWeight: '900' },
  priorityBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, borderWidth: 1, gap: 4 },
  priorityBtnText: { fontSize: 11, fontWeight: '900' },
  typeRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  typeChip: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 8, borderRadius: 12, borderWidth: 1, gap: 6 },
  typeChipText: { fontSize: 12, fontWeight: '800' },
  sectionCard: { borderRadius: 18, padding: 14, borderWidth: 1, marginBottom: 12 },
  sectionTitle: { fontSize: 13, fontWeight: '900' },
  tableChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1, marginRight: 8, position: 'relative' },
  tableChipText: { fontSize: 13, fontWeight: '800' },
  occupiedDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#EF4444', position: 'absolute', top: 4, right: 4 },
  inputLabel: { fontSize: 11, fontWeight: '700', marginBottom: 4 },
  input: { borderWidth: 1, borderRadius: 10, padding: 10, fontSize: 13 },
  selectedItemCard: { borderRadius: 12, padding: 10, borderWidth: 1, marginBottom: 8 },
  selectedItemName: { fontSize: 13, fontWeight: '800', flex: 1 },
  selectedItemPrice: { fontSize: 13, fontWeight: '900' },
  noteInput: { flex: 1, borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5, fontSize: 11 },
  qtyBtn: { padding: 6, borderRadius: 8, borderWidth: 1 },
  searchBox: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10, borderWidth: 1, marginBottom: 8 },
  searchInput: { flex: 1, fontSize: 12, marginLeft: 6 },
  menuItemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1 },
  menuItemName: { fontSize: 13, fontWeight: '700' },
  menuItemPrice: { fontSize: 13, fontWeight: '800' },
  addItemBadge: { padding: 6, borderRadius: 8 },
  fireKotBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 16, marginTop: 4 },
  fireKotBtnText: { color: '#FFF', fontSize: 14, fontWeight: '900' },
});
