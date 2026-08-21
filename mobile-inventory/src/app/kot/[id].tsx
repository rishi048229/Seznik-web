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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import {
  ChevronLeft,
  Printer,
  CheckCircle2,
  Clock,
  Flame,
  Plus,
  Trash2,
  DollarSign,
  Utensils,
  Receipt,
  X,
  CreditCard,
  Banknote,
  QrCode,
} from 'lucide-react-native';
import { useKotOrder, useKotOrders } from '@/hooks/useKotOrders';
import { KOTOrderStatus } from '@/types/kot';
import { useAppTheme } from '@/hooks/useAppTheme';
import { ScreenBackground } from '@/components/ui/ScreenBackground';
import { ScreenLoadingState } from '@/components/ui/ScreenLoadingState';
import { KotOrderDetailSkeleton } from '@/components/ui/ScreenSkeleton';
import { KeyboardAvoidingWrapper } from '@/components/ui/KeyboardAvoidingWrapper';
import { BRAND_COLORS } from '@/constants/theme';
import { usePrinterStore } from '@/store/usePrinterStore';
import ThermalPrinterService from '@/services/PrinterService';
import { useSettings } from '@/hooks/useSettings';

export default function KotOrderDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const topPadding = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0, 14);

  const { order, isLoading, refetch } = useKotOrder(id);
  const { updateStatus, generateBill, isGeneratingBill } = useKotOrders();
  const { paperWidth, connectionState } = usePrinterStore();
  const { settings } = useSettings();

  const [showSettleModal, setShowSettleModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'upi' | 'card'>('cash');
  const [discountAmount, setDiscountAmount] = useState('0');

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2,
    }).format(val || 0);
  };

  const handleUpdateStatus = async (newStatus: KOTOrderStatus) => {
    if (!order) return;
    try {
      await updateStatus({ id: order.id, payload: { status: newStatus } });
      refetch();
    } catch (err: any) {
      Alert.alert('Status Error', err?.message || 'Failed to update status');
    }
  };

  const handlePrintKitchenSlip = async () => {
    if (!order) return;
    try {
      await ThermalPrinterService.printKotTicket(
        {
          storeName: settings?.businessName || 'SEZNIK KITCHEN',
          orderNumber: order.orderNumber,
          orderType: order.orderType,
          tableName: order.table?.name,
          partyLabel: order.partyLabel || undefined,
          guestCount: order.guestCount || undefined,
          contactNumber: order.contactNumber || undefined,
          priority: order.priority,
          notes: order.notes || undefined,
          time: new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          items: order.items.map((it) => ({
            productName: it.productName,
            quantity: it.quantity,
            notes: it.notes || undefined,
          })),
        },
        paperWidth
      );
      Alert.alert('Printed! 🖨️', `Kitchen slip for KOT #${order.orderNumber} printed.`);
    } catch (err: any) {
      Alert.alert('Printer Error', err?.message || 'Failed to print kitchen slip');
    }
  };

  const handleGenerateBill = async () => {
    if (!order) return;
    try {
      const disc = parseFloat(discountAmount) || 0;
      const result = await generateBill({
        id: order.id,
        payload: {
          paymentMethod,
          discount: disc,
        },
      });

      // Auto print customer receipt if connected
      if (connectionState === 'connected') {
        try {
          const items = order.items.map((it) => ({
            productName: it.productName,
            quantity: it.quantity,
            unitPrice: it.unitPrice,
            total: it.unitPrice * it.quantity,
          }));

          const sub = items.reduce((acc, it) => acc + it.total, 0);
          const total = Math.max(0, sub - disc);

          await ThermalPrinterService.printSaleReceipt({
            storeName: settings?.businessName || 'SEZNIK STORE',
            storeAddress: settings?.businessAddress || '',
            storePhone: settings?.businessPhone || '',
            invoiceNumber: result.sale.invoiceNumber,
            date: new Date().toLocaleDateString('en-GB'),
            customerName: order.table?.name || order.partyLabel || 'Dine-in Guest',
            items,
            subtotal: sub,
            totalTax: 0,
            totalDiscount: disc,
            grandTotal: total,
            amountPaid: total,
            changeReturned: 0,
            paymentMethod: paymentMethod.toUpperCase(),
          });
        } catch (printErr) {
          console.warn('Auto print receipt failed:', printErr);
        }
      }

      setShowSettleModal(false);
      Alert.alert('Bill Settled! 🧾', `Invoice #${result.sale.invoiceNumber} recorded successfully.`, [
        {
          text: 'OK',
          onPress: () => router.replace('/kot' as any),
        },
      ]);
    } catch (err: any) {
      Alert.alert('Billing Error', err?.message || 'Failed to generate bill');
    }
  };

  if (isLoading || !order) {
    return (
      <ScreenLoadingState
        message="Loading kitchen order..."
        hint="Fetching KOT items and preparation status"
        skeleton={<KotOrderDetailSkeleton />}
        fullScreen
      />
    );
  }

  const subtotal = order.items.reduce((acc, it) => acc + it.unitPrice * it.quantity, 0);

  return (
    <ScreenBackground color={theme.bg}>
      <StatusBar
        barStyle={theme.isDark ? 'light-content' : 'dark-content'}
        backgroundColor="transparent"
        translucent
      />
      <View style={[styles.container, { paddingTop: topPadding }]}>
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
              <Text style={styles.headerBadge}>KOT ORDER DETAILS</Text>
              <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>
                KOT #{order.orderNumber}
              </Text>
            </View>

            <TouchableOpacity
              onPress={handlePrintKitchenSlip}
              style={[styles.printSlipBtn, { backgroundColor: 'rgba(37, 99, 235, 0.12)', borderColor: 'rgba(37, 99, 235, 0.3)' }]}
            >
              <Printer size={16} color={BRAND_COLORS.blue600} />
              <Text style={styles.printSlipBtnText}>Print KOT</Text>
            </TouchableOpacity>
          </View>

          {/* Info Card */}
          <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View>
                <Text style={[styles.cardHeadline, { color: theme.textPrimary }]}>
                  {order.table?.name || order.partyLabel || 'Dine-In'}
                </Text>
                <Text style={{ fontSize: 11, color: theme.textSecondary, marginTop: 2 }}>
                  {order.orderType.toUpperCase()} • {new Date(order.createdAt).toLocaleString()}
                </Text>
              </View>

              <View style={[styles.statusChip, { backgroundColor: BRAND_COLORS.navyInk }]}>
                <Text style={{ color: '#FFF', fontSize: 11, fontWeight: '900' }}>
                  {order.status.replace('_', ' ').toUpperCase()}
                </Text>
              </View>
            </View>

            {order.notes && (
              <View style={[styles.noteBox, { backgroundColor: theme.bg, borderColor: theme.borderColor }]}>
                <Text style={{ fontSize: 11, color: theme.textSecondary }}>Order Note: {order.notes}</Text>
              </View>
            )}
          </View>

          {/* Kitchen Progress Pipeline */}
          {order.status !== 'billed' && order.status !== 'cancelled' && (
            <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
              <Text style={[styles.sectionTitle, { color: theme.textPrimary, marginBottom: 10 }]}>
                Kitchen Progress Actions
              </Text>
              <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                {order.status === 'open' && (
                  <TouchableOpacity
                    onPress={() => handleUpdateStatus('sent_to_kitchen')}
                    style={[styles.stepBtn, { backgroundColor: BRAND_COLORS.blue600 }]}
                  >
                    <Text style={styles.stepBtnText}>Send to Kitchen ➔</Text>
                  </TouchableOpacity>
                )}
                {(order.status === 'open' || order.status === 'sent_to_kitchen') && (
                  <TouchableOpacity
                    onPress={() => handleUpdateStatus('preparing')}
                    style={[styles.stepBtn, { backgroundColor: '#F59E0B' }]}
                  >
                    <Text style={styles.stepBtnText}>Mark Preparing 🍳</Text>
                  </TouchableOpacity>
                )}
                {order.status === 'preparing' && (
                  <TouchableOpacity
                    onPress={() => handleUpdateStatus('ready')}
                    style={[styles.stepBtn, { backgroundColor: '#10B981' }]}
                  >
                    <Text style={styles.stepBtnText}>Mark Ready to Serve 🔔</Text>
                  </TouchableOpacity>
                )}
                {order.status === 'ready' && (
                  <TouchableOpacity
                    onPress={() => handleUpdateStatus('served')}
                    style={[styles.stepBtn, { backgroundColor: '#8B5CF6' }]}
                  >
                    <Text style={styles.stepBtnText}>Mark Served to Table 🍽️</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}

          {/* Items Table */}
          <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
            <Text style={[styles.sectionTitle, { color: theme.textPrimary, marginBottom: 8 }]}>
              Ordered Items ({order.items.length})
            </Text>

            {order.items.map((it, idx) => (
              <View key={it.id || idx} style={[styles.itemRow, { borderBottomColor: theme.borderColor }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.itemName, { color: theme.textPrimary }]}>
                    {it.quantity}x {it.productName}
                  </Text>
                  {it.notes && (
                    <Text style={{ fontSize: 10, color: '#EF4444', fontStyle: 'italic' }}>
                      Note: {it.notes}
                    </Text>
                  )}
                </View>
                <Text style={[styles.itemPrice, { color: theme.textPrimary }]}>
                  {formatCurrency(it.unitPrice * it.quantity)}
                </Text>
              </View>
            ))}

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: theme.borderColor }}>
              <Text style={{ fontSize: 14, fontWeight: '900', color: theme.textPrimary }}>Total Order Amount</Text>
              <Text style={{ fontSize: 18, fontWeight: '900', color: BRAND_COLORS.blue600 }}>
                {formatCurrency(subtotal)}
              </Text>
            </View>
          </View>

          {/* Settle / Bill Button */}
          {order.status !== 'billed' && order.status !== 'cancelled' ? (
            <TouchableOpacity
              onPress={() => setShowSettleModal(true)}
              style={[styles.settleBtn, { backgroundColor: '#10B981' }]}
            >
              <Receipt size={18} color="#FFF" style={{ marginRight: 6 }} />
              <Text style={styles.settleBtnText}>Generate Bill & Settle ({formatCurrency(subtotal)})</Text>
            </TouchableOpacity>
          ) : order.sale ? (
            <View style={[styles.billedBanner, { backgroundColor: 'rgba(16, 185, 129, 0.12)', borderColor: 'rgba(16, 185, 129, 0.3)' }]}>
              <CheckCircle2 size={20} color="#10B981" />
              <Text style={{ fontSize: 13, fontWeight: '800', color: '#10B981', marginLeft: 8 }}>
                Billed on Invoice #{order.sale.invoiceNumber}
              </Text>
            </View>
          ) : null}
        </ScrollView>

        {/* Settle & Generate Bill Modal */}
        <Modal visible={showSettleModal} transparent animationType="slide">
          <KeyboardAvoidingWrapper inModal>
            <View style={styles.modalOverlay}>
              <View style={[styles.bottomSheet, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
                <View style={styles.sheetHeader}>
                  <Text style={[styles.sheetTitle, { color: theme.textPrimary }]}>
                    Settle KOT #{order.orderNumber}
                  </Text>
                  <TouchableOpacity onPress={() => setShowSettleModal(false)}>
                    <X size={20} color={theme.textSecondary} />
                  </TouchableOpacity>
                </View>

                {/* Payment Method Selector */}
                <Text style={[styles.inputLabel, { color: theme.textPrimary }]}>Payment Mode</Text>
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
                  {[
                    { id: 'cash' as const, label: 'Cash', icon: Banknote },
                    { id: 'upi' as const, label: 'UPI / QR', icon: QrCode },
                    { id: 'card' as const, label: 'Card', icon: CreditCard },
                  ].map((m) => {
                    const active = paymentMethod === m.id;
                    const Icon = m.icon;
                    return (
                      <TouchableOpacity
                        key={m.id}
                        onPress={() => setPaymentMethod(m.id)}
                        style={[
                          styles.payModeChip,
                          {
                            backgroundColor: active ? BRAND_COLORS.navyInk : theme.bg,
                            borderColor: active ? BRAND_COLORS.navyInk : theme.borderColor,
                          },
                        ]}
                      >
                        <Icon size={14} color={active ? '#FFF' : theme.textSecondary} />
                        <Text style={[styles.payModeText, { color: active ? '#FFF' : theme.textSecondary }]}>
                          {m.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Discount */}
                <Text style={[styles.inputLabel, { color: theme.textPrimary }]}>Discount (₹)</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.bg, borderColor: theme.borderColor, color: theme.textPrimary }]}
                  value={discountAmount}
                  onChangeText={setDiscountAmount}
                  keyboardType="numeric"
                  placeholder="0.00"
                  placeholderTextColor="#94A3B8"
                />

                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginVertical: 10 }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: theme.textSecondary }}>Final Net Payable:</Text>
                  <Text style={{ fontSize: 20, fontWeight: '900', color: BRAND_COLORS.blue600 }}>
                    {formatCurrency(Math.max(0, subtotal - (parseFloat(discountAmount) || 0)))}
                  </Text>
                </View>

                <TouchableOpacity
                  onPress={handleGenerateBill}
                  disabled={isGeneratingBill}
                  style={[styles.confirmBillBtn, { backgroundColor: BRAND_COLORS.navyInk }]}
                >
                  {isGeneratingBill ? (
                    <ActivityIndicator color="#FFF" style={{ marginRight: 8 }} />
                  ) : (
                    <Receipt size={16} color="#FFF" style={{ marginRight: 8 }} />
                  )}
                  <Text style={styles.confirmBillBtnText}>Print Bill & Mark Settled</Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingWrapper>
        </Modal>
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
  printSlipBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: 1, gap: 4 },
  printSlipBtnText: { fontSize: 12, fontWeight: '800', color: BRAND_COLORS.blue600 },
  card: { borderRadius: 18, padding: 14, borderWidth: 1, marginBottom: 12 },
  cardHeadline: { fontSize: 16, fontWeight: '900' },
  statusChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  noteBox: { borderRadius: 10, padding: 8, borderWidth: 1, marginTop: 8 },
  sectionTitle: { fontSize: 13, fontWeight: '900' },
  stepBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  stepBtnText: { color: '#FFF', fontSize: 12, fontWeight: '800' },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1 },
  itemName: { fontSize: 13, fontWeight: '700' },
  itemPrice: { fontSize: 13, fontWeight: '900' },
  settleBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 16, marginTop: 4 },
  settleBtnText: { color: '#FFF', fontSize: 14, fontWeight: '900' },
  billedBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 14, borderRadius: 16, borderWidth: 1, marginTop: 4 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' },
  bottomSheet: { borderRadius: 24, padding: 20, borderWidth: 1 },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  sheetTitle: { fontSize: 18, fontWeight: '900' },
  inputLabel: { fontSize: 11, fontWeight: '700', marginBottom: 4 },
  input: { borderWidth: 1, borderRadius: 10, padding: 10, fontSize: 13, marginBottom: 10 },
  payModeChip: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 10, borderWidth: 1, gap: 4 },
  payModeText: { fontSize: 12, fontWeight: '800' },
  confirmBillBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 14, marginTop: 6 },
  confirmBillBtnText: { color: '#FFF', fontSize: 14, fontWeight: '900' },
});
