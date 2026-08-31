import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, Zap, Plus, Trash2 } from 'lucide-react-native';
import { useSettings } from '@/hooks/useSettings';
import { usePrinterStore } from '@/store/usePrinterStore';
import { useStoreProfile } from '@/hooks/useStoreProfile';
import { useSales } from '@/hooks/useSales';
import { useDashboard } from '@/hooks/useDashboard';
import {
  buildReceiptPrintOptions,
  generateProvisionalInvoice,
  printSaleReceiptNow,
} from '@/utils/fastSaleCheckout';
import { useAppTheme } from '@/hooks/useAppTheme';
import { ScreenBackground } from '@/components/ui/ScreenBackground';
import { KeyboardAvoidingWrapper } from '@/components/ui/KeyboardAvoidingWrapper';
import { BRAND_COLORS } from '@/constants/theme';
import { useTranslation } from '@/store/useLanguageStore';

interface QuickBillRow {
  id: string;
  name: string;
  price: string;
  qty: string;
}

export default function QuickBillScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const { t } = useTranslation();
  const { settings } = useSettings();
  const storeProfile = useStoreProfile();
  const { persistSaleInBackground, isCreating } = useSales();
  const { refetch } = useDashboard();

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

  const [quickBillItems, setQuickBillItems] = useState<QuickBillRow[]>([
    { id: '1', name: '', price: '', qty: '1' },
  ]);
  const [quickCustomerName, setQuickCustomerName] = useState('');
  const [quickPaymentMethod, setQuickPaymentMethod] = useState<'cash' | 'upi' | 'card'>('cash');

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(val || 0);

  const handleAddQuickBillRow = () => {
    setQuickBillItems((prev) => [
      ...prev,
      { id: Date.now().toString(), name: '', price: '', qty: '1' },
    ]);
  };

  const handleUpdateQuickBillRow = (id: string, field: 'name' | 'price' | 'qty', value: string) => {
    setQuickBillItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const handleRemoveQuickBillRow = (id: string) => {
    if (quickBillItems.length <= 1) {
      setQuickBillItems([{ id: '1', name: '', price: '', qty: '1' }]);
      return;
    }
    setQuickBillItems((prev) => prev.filter((item) => item.id !== id));
  };

  const calculateQuickBillTotal = () =>
    quickBillItems.reduce((acc, item) => {
      const p = parseFloat(item.price) || 0;
      const q = parseInt(item.qty) || 1;
      return acc + p * q;
    }, 0);

  const resetForm = () => {
    setQuickBillItems([{ id: '1', name: '', price: '', qty: '1' }]);
    setQuickCustomerName('');
    setQuickPaymentMethod('cash');
  };

  const handleQuickBill = () => {
    const validItems = quickBillItems
      .filter((item) => item.name.trim().length > 0 && parseFloat(item.price) > 0)
      .map((item) => {
        const p = parseFloat(item.price) || 0;
        const q = Math.max(1, parseInt(item.qty) || 1);
        return {
          productName: item.name.trim(),
          quantity: q,
          unitPrice: p,
          total: p * q,
        };
      });

    if (validItems.length === 0) {
      Alert.alert('Missing Info', 'Please enter at least one product with name and price.');
      return;
    }

    const total = validItems.reduce((acc, i) => acc + i.total, 0);
    const provisionalInv = generateProvisionalInvoice();
    const customerName = quickCustomerName.trim() || 'Quick Walk-in Customer';
    const printOptions = buildReceiptPrintOptions({
      activeTemplateId,
      customTemplates,
      activeCustomTemplateId,
      enableBillQrCode,
      topMargin,
      autoCut,
      fontSize,
      printCopies,
      storeName: settings?.businessName || storeProfile.storeName,
      storeAddress: settings?.businessAddress || storeProfile.storeAddress,
      storePhone: settings?.businessPhone || storeProfile.storePhone,
      storeGstin: settings?.businessGSTIN || storeProfile.storeGstin,
      storeLogoUrl: settings?.businessLogoURL || storeProfile.storeLogoUrl,
      upiId: settings?.upiId || storeProfile.upiId,
      footerMessage: storeProfile.footerMessage,
    });

    resetForm();

    if (connectionState === 'connected') {
      printSaleReceiptNow(
        {
          storeName: settings?.businessName || 'SEZNIK STORE',
          storeAddress: settings?.businessAddress || '',
          storePhone: settings?.businessPhone || '',
          invoiceNumber: provisionalInv,
          date: new Date().toLocaleDateString('en-GB'),
          customerName,
          items: validItems,
          subtotal: total,
          totalTax: 0,
          totalDiscount: 0,
          grandTotal: total,
          amountPaid: total,
          changeReturned: 0,
          paymentMethod: quickPaymentMethod.toUpperCase(),
        },
        paperWidth,
        printOptions
      );
    }

    persistSaleInBackground(
      {
        items: validItems,
        subtotal: total,
        totalDiscount: 0,
        totalTax: 0,
        grandTotal: total,
        paymentMethod: quickPaymentMethod,
        amountPaid: total,
        changeReturned: 0,
        isQuickBill: true,
      },
      {
        onSuccess: (sale) => {
          refetch();
          Alert.alert(
            'Bill Generated! 🧾',
            `Invoice #${sale.invoiceNumber} recorded with ${validItems.length} products (${formatCurrency(total)}).`,
            [{ text: 'OK', onPress: () => router.back() }]
          );
        },
        onError: (err) => {
          Alert.alert(
            'Bill Not Saved',
            connectionState === 'connected'
              ? `${err.message}\n\nThe receipt may have printed, but this sale was not saved.`
              : err.message || 'Failed to save this quick bill.'
          );
        },
      }
    );
  };

  return (
    <ScreenBackground>
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <KeyboardAvoidingWrapper>
          <View style={[styles.headerBar, { borderBottomColor: theme.borderColor }]}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={[styles.backBtn, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}
            >
              <ArrowLeft size={20} color={theme.textPrimary} />
            </TouchableOpacity>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.screenTag}>{t('quickBill', 'Quick Bill')}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Zap size={18} color={BRAND_COLORS.blue600} style={{ marginRight: 6 }} />
                <Text style={[styles.screenTitle, { color: theme.textPrimary }]}>
                  {t('multiProductQuickBill', 'Multi-Product Quick Bill')}
                </Text>
              </View>
            </View>
          </View>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Text style={[styles.inputLabel, { color: theme.textPrimary }]}>Customer Name (Optional)</Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: theme.bg,
                  borderColor: theme.borderColor,
                  color: theme.textPrimary,
                  marginBottom: 16,
                },
              ]}
              value={quickCustomerName}
              onChangeText={setQuickCustomerName}
              placeholder="Walk-in Customer"
              placeholderTextColor="#94A3B8"
            />

            <Text style={[styles.inputLabel, { color: theme.textPrimary, marginBottom: 8 }]}>
              Products / Items ({quickBillItems.length})
            </Text>

            {quickBillItems.map((item, idx) => {
              const rowSubtotal = (parseFloat(item.price) || 0) * (parseInt(item.qty) || 1);
              return (
                <View
                  key={item.id}
                  style={[styles.quickItemRowCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <Text style={{ fontSize: 11, fontWeight: '800', color: BRAND_COLORS.sky500 }}>
                      Item #{idx + 1}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={{ fontSize: 11, fontWeight: '800', color: theme.textPrimary }}>
                        = {formatCurrency(rowSubtotal)}
                      </Text>
                      {quickBillItems.length > 1 && (
                        <TouchableOpacity onPress={() => handleRemoveQuickBillRow(item.id)} style={{ padding: 4 }}>
                          <Trash2 size={15} color="#EF4444" />
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>

                  <TextInput
                    style={[
                      styles.input,
                      {
                        backgroundColor: theme.bg,
                        borderColor: theme.borderColor,
                        color: theme.textPrimary,
                        marginBottom: 8,
                        paddingVertical: 10,
                      },
                    ]}
                    value={item.name}
                    onChangeText={(v) => handleUpdateQuickBillRow(item.id, 'name', v)}
                    placeholder="e.g. Rice 1kg, Chai, Notebook"
                    placeholderTextColor="#94A3B8"
                  />

                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                    <View style={{ flex: 1.5 }}>
                      <Text style={{ fontSize: 10, fontWeight: '700', color: theme.textSecondary, marginBottom: 4 }}>
                        Price (₹) *
                      </Text>
                      <TextInput
                        style={[
                          styles.input,
                          {
                            backgroundColor: theme.bg,
                            borderColor: theme.borderColor,
                            color: theme.textPrimary,
                            marginBottom: 0,
                            paddingVertical: 10,
                          },
                        ]}
                        value={item.price}
                        onChangeText={(v) => handleUpdateQuickBillRow(item.id, 'price', v)}
                        keyboardType="numeric"
                        placeholder="100.00"
                        placeholderTextColor="#94A3B8"
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 10, fontWeight: '700', color: theme.textSecondary, marginBottom: 4 }}>
                        Qty
                      </Text>
                      <TextInput
                        style={[
                          styles.input,
                          {
                            backgroundColor: theme.bg,
                            borderColor: theme.borderColor,
                            color: theme.textPrimary,
                            marginBottom: 0,
                            paddingVertical: 10,
                          },
                        ]}
                        value={item.qty}
                        onChangeText={(v) => handleUpdateQuickBillRow(item.id, 'qty', v)}
                        keyboardType="numeric"
                        placeholder="1"
                        placeholderTextColor="#94A3B8"
                      />
                    </View>
                  </View>
                </View>
              );
            })}

            <TouchableOpacity
              onPress={handleAddQuickBillRow}
              style={[styles.addQuickItemBtn, { borderColor: BRAND_COLORS.blue600, backgroundColor: 'rgba(37, 99, 235, 0.08)' }]}
            >
              <Plus size={16} color={BRAND_COLORS.blue600} style={{ marginRight: 6 }} />
              <Text style={{ color: BRAND_COLORS.blue600, fontWeight: '800', fontSize: 12 }}>
                + Add Next Product / Item
              </Text>
            </TouchableOpacity>
          </ScrollView>

          <View style={[styles.footerBar, { backgroundColor: theme.cardBg, borderTopColor: theme.borderColor }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {(['cash', 'upi', 'card'] as const).map((mode) => (
                  <TouchableOpacity
                    key={mode}
                    onPress={() => setQuickPaymentMethod(mode)}
                    style={[
                      styles.payModeChip,
                      quickPaymentMethod === mode && { backgroundColor: BRAND_COLORS.navyInk },
                      { borderColor: theme.borderColor },
                    ]}
                  >
                    <Text
                      style={[
                        styles.payModeChipText,
                        quickPaymentMethod === mode ? { color: '#FFF' } : { color: theme.textSecondary },
                      ]}
                    >
                      {mode.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ fontSize: 10, fontWeight: '700', color: theme.textSecondary }}>Grand Total</Text>
                <Text style={{ fontSize: 20, fontWeight: '900', color: '#10B981' }}>
                  {formatCurrency(calculateQuickBillTotal())}
                </Text>
              </View>
            </View>

            <TouchableOpacity onPress={handleQuickBill} disabled={isCreating} style={styles.instantBillBtn}>
              {isCreating && <ActivityIndicator color="#FFF" style={{ marginRight: 8 }} />}
              <Text style={styles.instantBillBtnText}>
                {t('printAndRecordBill', 'Print & Record Bill Now')}
              </Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingWrapper>
      </SafeAreaView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backBtn: { padding: 9, borderRadius: 12, borderWidth: 1 },
  screenTag: {
    fontSize: 10,
    fontWeight: '800',
    color: BRAND_COLORS.sky500,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  screenTitle: { fontSize: 18, fontWeight: '900' },
  scrollContent: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 24 },
  inputLabel: { fontSize: 12, fontWeight: '700', marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: 12, padding: 12, fontSize: 14, marginBottom: 14 },
  quickItemRowCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
  },
  addQuickItemBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    marginTop: 4,
  },
  footerBar: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    borderTopWidth: 1,
  },
  payModeChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  payModeChipText: { fontSize: 10, fontWeight: '800' },
  instantBillBtn: {
    backgroundColor: BRAND_COLORS.navyInk,
    borderRadius: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  instantBillBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 14 },
});
