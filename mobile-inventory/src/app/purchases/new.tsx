import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { ArrowLeft, Plus, Trash2, ShoppingBag, Truck } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { usePurchases } from '@/hooks/usePurchases';
import { useSuppliers } from '@/hooks/useSuppliers';
import { useProducts } from '@/hooks/useProducts';
import { BRAND_COLORS } from '@/constants/theme';
import { useAppTheme } from '@/hooks/useAppTheme';
import { ScreenBackground } from '@/components/ui/ScreenBackground';
import { KeyboardAvoidingWrapper } from '@/components/ui/KeyboardAvoidingWrapper';

export default function NewPurchaseScreen() {
  const router = useRouter();

  const { createPurchase, isCreating } = usePurchases();
  const { suppliers } = useSuppliers();
  const { products } = useProducts();

  const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'upi' | 'card' | 'credit'>('cash');
  const [purchaseItems, setPurchaseItems] = useState<
    { productId: string; productName: string; quantity: number; costPrice: number }[]
  >([]);

  // Item Picker State
  const [selectedProdId, setSelectedProdId] = useState('');
  const [qtyInput, setQtyInput] = useState('1');
  const [costInput, setCostInput] = useState('');

  const theme = useAppTheme();

  const handleAddItem = () => {
    const prod = products.find((p) => p.id === selectedProdId);
    if (!prod) {
      Alert.alert('Select Product', 'Please choose a product from your inventory.');
      return;
    }
    const cost = parseFloat(costInput) || prod.costPrice || prod.sellingPrice * 0.7;
    const qty = parseInt(qtyInput) || 1;

    setPurchaseItems([
      ...purchaseItems,
      { productId: prod.id, productName: prod.name, quantity: qty, costPrice: cost },
    ]);

    setSelectedProdId('');
    setQtyInput('1');
    setCostInput('');
  };

  const handleRemoveItem = (idx: number) => {
    setPurchaseItems(purchaseItems.filter((_, i) => i !== idx));
  };

  const subtotal = purchaseItems.reduce((sum, i) => sum + i.costPrice * i.quantity, 0);
  const totalTax = subtotal * 0.18;
  const grandTotal = subtotal + totalTax;

  const handleSavePurchase = async () => {
    if (purchaseItems.length === 0) {
      Alert.alert('Empty Order', 'Please add at least one item to purchase order.');
      return;
    }

    try {
      await createPurchase({
        supplierId: selectedSupplierId || undefined,
        items: purchaseItems.map((i) => ({
          productId: i.productId,
          productName: i.productName,
          quantity: i.quantity,
          costPrice: i.costPrice,
          unitPrice: i.costPrice,
          total: i.costPrice * i.quantity,
        })),
        subtotal,
        totalDiscount: 0,
        totalTax,
        grandTotal,
        paymentMethod,
        amountPaid: paymentMethod === 'credit' ? 0 : grandTotal,
      });

      Alert.alert('Purchase Recorded!', 'Stock inventory updated automatically.');
      router.back();
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to record purchase order');
    }
  };

  return (
    <ScreenBackground color={theme.bg}>
    <SafeAreaView style={[styles.container, { backgroundColor: 'transparent' }]}>
      <KeyboardAvoidingWrapper>
      <View style={styles.mainWrapper}>
        {/* Header */}
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <ArrowLeft size={20} color={theme.textSecondary} />
            <Text style={[styles.backBtnText, { color: theme.textSecondary }]}>Cancel</Text>
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>New Purchase Order</Text>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 100 }}>
          {/* Supplier Picker */}
          <Text style={[styles.label, { color: theme.textPrimary }]}>Select Supplier</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
            <TouchableOpacity
              onPress={() => setSelectedSupplierId(null)}
              style={[
                styles.supplierChip,
                {
                  backgroundColor: !selectedSupplierId ? BRAND_COLORS.blue600 : theme.cardBg,
                  borderColor: !selectedSupplierId ? BRAND_COLORS.blue600 : theme.borderColor,
                },
              ]}
            >
              <Text style={[styles.chipText, !selectedSupplierId && { color: '#FFFFFF' }]}>General Supplier</Text>
            </TouchableOpacity>

            {suppliers.map((s) => {
              const selected = selectedSupplierId === s.id;
              return (
                <TouchableOpacity
                  key={s.id}
                  onPress={() => setSelectedSupplierId(s.id)}
                  style={[
                    styles.supplierChip,
                    {
                      backgroundColor: selected ? BRAND_COLORS.blue600 : theme.cardBg,
                      borderColor: selected ? BRAND_COLORS.blue600 : theme.borderColor,
                    },
                  ]}
                >
                  <Text style={[styles.chipText, selected && { color: '#FFFFFF' }]}>{s.name}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Payment Method Selector */}
          <Text style={[styles.label, { color: theme.textPrimary }]}>Payment Mode</Text>
          <View style={styles.paymentRow}>
            {[
              { id: 'cash', label: 'Cash' },
              { id: 'upi', label: 'UPI' },
              { id: 'card', label: 'Card' },
              { id: 'credit', label: 'Pay Later (Credit)' },
            ].map((m) => {
              const selected = paymentMethod === m.id;
              return (
                <TouchableOpacity
                  key={m.id}
                  onPress={() => setPaymentMethod(m.id as any)}
                  style={[
                    styles.paymentChip,
                    {
                      backgroundColor: selected ? 'rgba(37, 99, 235, 0.15)' : theme.cardBg,
                      borderColor: selected ? BRAND_COLORS.blue600 : theme.borderColor,
                    },
                  ]}
                >
                  <Text style={[styles.paymentChipText, { color: selected ? BRAND_COLORS.blue600 : theme.textPrimary }]}>
                    {m.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Add Product Line Item */}
          <Text style={[styles.sectionHeader, { color: theme.textSecondary }]}>ADD INVENTORY ITEMS</Text>
          <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
            <Text style={[styles.label, { color: theme.textPrimary }]}>Choose Inventory Product</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
              {products.map((p) => {
                const selected = selectedProdId === p.id;
                return (
                  <TouchableOpacity
                    key={p.id}
                    onPress={() => {
                      setSelectedProdId(p.id);
                      setCostInput(String(p.costPrice || p.sellingPrice * 0.7));
                    }}
                    style={[
                      styles.prodChip,
                      {
                        backgroundColor: selected ? BRAND_COLORS.navyInk : theme.bg,
                        borderColor: selected ? BRAND_COLORS.navyInk : theme.borderColor,
                      },
                    ]}
                  >
                    <Text style={[styles.prodChipText, selected && { color: '#FFFFFF' }]}>{p.name}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
              <View style={{ flex: 1, marginRight: 6 }}>
                <Text style={[styles.label, { color: theme.textPrimary }]}>Unit Cost (₹)</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.bg, borderColor: theme.borderColor, color: theme.textPrimary }]}
                  value={costInput}
                  onChangeText={setCostInput}
                  keyboardType="numeric"
                  placeholder="0.00"
                  placeholderTextColor="#94A3B8"
                />
              </View>

              <View style={{ flex: 1, marginLeft: 6 }}>
                <Text style={[styles.label, { color: theme.textPrimary }]}>Restock Quantity</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.bg, borderColor: theme.borderColor, color: theme.textPrimary }]}
                  value={qtyInput}
                  onChangeText={setQtyInput}
                  keyboardType="numeric"
                  placeholder="10"
                  placeholderTextColor="#94A3B8"
                />
              </View>
            </View>

            <TouchableOpacity onPress={handleAddItem} style={styles.addLineBtn}>
              <Plus size={16} color="#FFFFFF" />
              <Text style={styles.addLineBtnText}>Add Item to Purchase</Text>
            </TouchableOpacity>
          </View>

          {/* Line Items List */}
          <Text style={[styles.sectionHeader, { color: theme.textSecondary, marginTop: 16 }]}>
            ORDER LINE ITEMS ({purchaseItems.length})
          </Text>
          {purchaseItems.map((item, idx) => (
            <View key={idx} style={[styles.lineCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.itemTitle, { color: theme.textPrimary }]}>{item.productName}</Text>
                <Text style={[styles.itemSub, { color: theme.textSecondary }]}>
                  {item.quantity} x ₹{item.costPrice.toFixed(2)}
                </Text>
              </View>
              <Text style={[styles.lineTotal, { color: theme.textPrimary }]}>
                ₹{(item.costPrice * item.quantity).toFixed(2)}
              </Text>
              <TouchableOpacity onPress={() => handleRemoveItem(idx)} style={{ padding: 6, marginLeft: 8 }}>
                <Trash2 size={16} color="#EF4444" />
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>

        {/* Sticky Footer Bar with Running Total */}
        <View style={[styles.footerBar, { backgroundColor: BRAND_COLORS.navyInk }]}>
          <View>
            <Text style={styles.footerLabel}>Total Purchase Cost</Text>
            <Text style={styles.footerPrice}>₹{grandTotal.toFixed(2)}</Text>
          </View>
          <TouchableOpacity onPress={handleSavePurchase} disabled={isCreating} style={styles.saveBtn}>
            {isCreating && <ActivityIndicator color="#FFF" style={{ marginRight: 8 }} />}
            <Text style={styles.saveBtnText}>Record Purchase</Text>
          </TouchableOpacity>
        </View>
      </View>
      </KeyboardAvoidingWrapper>
    </SafeAreaView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  mainWrapper: { flex: 1, paddingHorizontal: 16, paddingTop: 12 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  backBtn: { paddingVertical: 6, paddingRight: 10 },
  backBtnText: { fontSize: 13, fontWeight: '700' },
  headerTitle: { fontSize: 18, fontWeight: '900' },
  label: { fontSize: 12, fontWeight: '700', marginBottom: 6 },
  supplierChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, borderWidth: 1, marginRight: 8 },
  chipText: { fontSize: 12, fontWeight: '700' },
  paymentRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 16 },
  paymentChip: { width: '48.5%', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, alignItems: 'center', marginBottom: 8 },
  paymentChipText: { fontSize: 12, fontWeight: '700' },
  sectionHeader: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5, marginBottom: 8 },
  card: { borderRadius: 18, padding: 14, borderWidth: 1, marginBottom: 12 },
  prodChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, borderWidth: 1, marginRight: 6 },
  prodChipText: { fontSize: 11, fontWeight: '700' },
  input: { borderWidth: 1, borderRadius: 12, padding: 12, fontSize: 14 },
  addLineBtn: { backgroundColor: BRAND_COLORS.blue600, paddingVertical: 12, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  addLineBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 13, marginLeft: 6 },
  lineCard: { borderRadius: 14, padding: 12, borderWidth: 1, marginBottom: 8, flexDirection: 'row', alignItems: 'center' },
  itemTitle: { fontSize: 13, fontWeight: '700' },
  itemSub: { fontSize: 11, marginTop: 2 },
  lineTotal: { fontSize: 14, fontWeight: '900' },
  footerBar: { position: 'absolute', bottom: 16, left: 16, right: 16, borderRadius: 20, padding: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', elevation: 10 },
  footerLabel: { fontSize: 10, color: '#94A3B8', textTransform: 'uppercase', fontWeight: '700' },
  footerPrice: { fontSize: 18, fontWeight: '900', color: '#FFFFFF' },
  saveBtn: { backgroundColor: BRAND_COLORS.blue600, paddingVertical: 12, paddingHorizontal: 18, borderRadius: 12, flexDirection: 'row', alignItems: 'center' },
  saveBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 14 },
});
