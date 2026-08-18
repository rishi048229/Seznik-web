import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StyleSheet,
  StatusBar,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Search,
  Plus,
  ArrowLeft,
  ShoppingBag,
  Truck,
  Calendar,
  Trash2,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { usePurchases } from '@/hooks/usePurchases';
import { Purchase } from '@/types/purchase';
import { BRAND_COLORS } from '@/constants/theme';
import { useAppTheme } from '@/hooks/useAppTheme';
import { ScreenBackground } from '@/components/ui/ScreenBackground';
import { useLanguageStore } from '@/store/useLanguageStore';

export default function PurchasesScreen() {
  const router = useRouter();
  const { t } = useLanguageStore();
  const { purchases, isLoading, deletePurchase } = usePurchases();

  const [searchQuery, setSearchQuery] = useState('');

  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const topPadding = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0, 12);

  const filteredPurchases = purchases.filter(
    (p) =>
      p.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.supplier && p.supplier.name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleDeletePurchase = (p: Purchase) => {
    Alert.alert(
      'Delete Purchase Record',
      `Delete purchase ${p.invoiceNumber}? Note: Inventory stock will NOT be reverted.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Record',
          style: 'destructive',
          onPress: async () => {
            try {
              await deletePurchase(p.id);
            } catch (e: any) {
              Alert.alert('Error', e?.message || 'Failed to delete purchase record');
            }
          },
        },
      ]
    );
  };

  return (
    <ScreenBackground color={theme.bg}>
      <StatusBar
        barStyle={theme.isDark ? 'light-content' : 'dark-content'}
        backgroundColor={theme.bg}
      />
      <View style={[styles.container, { backgroundColor: 'transparent', paddingTop: topPadding }]}>
        <View style={styles.mainWrapper}>
          <View style={styles.headerRow}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.backBtn}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <ArrowLeft size={20} color={theme.textSecondary} />
              <Text style={[styles.backBtnText, { color: theme.textSecondary }]}>{t('back', 'Back')}</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => router.push('/purchases/new' as any)} style={styles.addBtn}>
              <Plus size={16} color="#FFFFFF" />
              <Text style={styles.addBtnText}>{t('recordPurchase', 'New Purchase')}</Text>
            </TouchableOpacity>
          </View>

          <Text style={[styles.title, { color: theme.textPrimary }]}>{t('purchasesPageTitle', 'Stock Purchases')}</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            Supplier invoices & inventory purchase history
          </Text>

          <View style={[styles.searchBox, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
            <Search size={18} color={theme.textSecondary} />
            <TextInput
              style={[styles.searchInput, { color: theme.textPrimary }]}
              placeholder={t('searchProducts', 'Search invoice number or supplier...')}
              placeholderTextColor="#94A3B8"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          {isLoading ? (
            <ActivityIndicator size="large" color={BRAND_COLORS.blue600} style={{ marginVertical: 40 }} />
          ) : (
            <FlatList
              data={filteredPurchases}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ paddingBottom: 40 }}
              renderItem={({ item }) => (
                <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
                  <View style={{ flex: 1, marginRight: 12 }}>
                    <Text style={[styles.invoiceNum, { color: theme.textPrimary }]}>{item.invoiceNumber}</Text>
                    <Text style={[styles.supplierText, { color: BRAND_COLORS.blue600 }]}>
                      🚚 {item.supplier?.name || 'General Supplier'}
                    </Text>
                    <Text style={[styles.dateText, { color: theme.textSecondary }]}>
                      {new Date(item.createdAt).toLocaleDateString()} | Mode: {item.paymentMethod.toUpperCase()}
                    </Text>
                  </View>

                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[styles.totalAmount, { color: theme.textPrimary }]}>
                      ₹{item.grandTotal.toFixed(2)}
                    </Text>
                    <TouchableOpacity onPress={() => handleDeletePurchase(item)} style={styles.deleteBtn}>
                      <Trash2 size={14} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            />
          )}
        </View>
      </View>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  mainWrapper: { flex: 1, paddingHorizontal: 16, paddingTop: 4 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  backBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 4, marginLeft: -4 },
  backBtnText: { fontSize: 13, fontWeight: '600', marginLeft: 4 },
  addBtn: { backgroundColor: BRAND_COLORS.navyInk, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, flexDirection: 'row', alignItems: 'center' },
  addBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 12, marginLeft: 4 },
  title: { fontSize: 24, fontWeight: '900' },
  subtitle: { fontSize: 12, marginTop: 2, marginBottom: 16 },
  searchBox: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 14 },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 14 },
  card: { borderRadius: 16, padding: 14, borderWidth: 1, marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  invoiceNum: { fontSize: 15, fontWeight: '800' },
  supplierText: { fontSize: 12, fontWeight: '700', marginTop: 2 },
  dateText: { fontSize: 11, marginTop: 4 },
  totalAmount: { fontSize: 16, fontWeight: '900' },
  deleteBtn: { padding: 6, borderRadius: 8, backgroundColor: 'rgba(239, 68, 68, 0.12)', marginTop: 6 },
});
