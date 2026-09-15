import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Image,
  useWindowDimensions,
  StatusBar,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X, Share2 } from 'lucide-react-native';
import type { Sale } from '@/types/sale';
import type { PrintSaleData } from '@/services/PrinterService';
import { useStoreProfile } from '@/hooks/useStoreProfile';
import { saleToPrintSaleData, shareInvoicePdf } from '@/utils/invoiceActions';
import { useAppTheme } from '@/hooks/useAppTheme';
import { BRAND_COLORS } from '@/constants/theme';
import { sanitizeErrorMessage } from '@/utils/errorHandler';

interface A4InvoicePreviewModalProps {
  visible: boolean;
  sale: Sale | null;
  onClose: () => void;
}

const A4_RATIO = 297 / 210;
const rupee = (n: number) => `₹${(n || 0).toFixed(2)}`;

function TotalsBlock({ data }: { data: PrintSaleData }) {
  const paid = data.amountPaid !== undefined ? data.amountPaid : data.grandTotal;
  const balance = data.changeReturned !== undefined ? data.changeReturned : 0;
  const charges = data.billCharges?.filter((c) => c.amount > 0) || [];
  const showGst = Boolean(data.gstStyle) && data.totalTax > 0;

  return (
    <View style={styles.totals}>
      <Row label="Sub Total" value={rupee(data.subtotal)} />
      {data.totalDiscount > 0 ? <Row label="Discount" value={`-${rupee(data.totalDiscount)}`} /> : null}
      {showGst && data.gstStyle === 'slab_wise' && data.gstSlabs?.length
        ? data.gstSlabs.map((slab) =>
            slab.gstRate === 0 ? (
              <Row key="nil" label="Nil / Exempt" value={rupee(slab.taxableValue)} />
            ) : (
              <View key={`${slab.gstRate}`}>
                <Row label={`Taxable @ ${slab.gstRate}%`} value={rupee(slab.taxableValue)} />
                <Row label={`CGST ${slab.cgstRate}%`} value={rupee(slab.cgstAmount)} />
                <Row label={`SGST ${slab.sgstRate}%`} value={rupee(slab.sgstAmount)} />
              </View>
            )
          )
        : showGst
          ? (
            <>
              <Row label="Taxable Amt" value={rupee(data.taxableAmt ?? data.subtotal)} />
              <Row label="SGST" value={rupee(data.sgst ?? data.totalTax / 2)} />
              <Row label="CGST" value={rupee(data.cgst ?? data.totalTax / 2)} />
            </>
          )
          : data.totalTax > 0
            ? <Row label="Tax" value={rupee(data.totalTax)} />
            : null}
      {charges.map((charge) => (
        <Row key={charge.label} label={charge.label} value={rupee(charge.amount)} />
      ))}
      <Row label="Grand Total" value={rupee(data.grandTotal)} grand />
      <Row label="Paid Amount" value={rupee(paid)} />
      {balance > 0 ? <Row label="Balance Due" value={rupee(balance)} /> : null}
    </View>
  );
}

function Row({ label, value, grand }: { label: string; value: string; grand?: boolean }) {
  return (
    <View style={[styles.totalRow, grand && styles.totalRowGrand]}>
      <Text style={[styles.totalLabel, grand && styles.totalGrandText]}>{label}</Text>
      <Text style={[styles.totalValue, grand && styles.totalGrandText]}>{value}</Text>
    </View>
  );
}

export function A4InvoicePreviewModal({ visible, sale, onClose }: A4InvoicePreviewModalProps) {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const storeProfile = useStoreProfile();
  const { width } = useWindowDimensions();
  const pageWidth = Math.min(width - 24, 560);
  const pageMinHeight = pageWidth * A4_RATIO;
  const [sharing, setSharing] = useState(false);

  const data = useMemo(
    () => (sale ? saleToPrintSaleData(sale, storeProfile) : null),
    [sale, storeProfile]
  );

  const handleShare = async () => {
    if (!sale || sharing) return;
    setSharing(true);
    try {
      await shareInvoicePdf(sale, storeProfile);
    } catch (err: any) {
      Alert.alert('Share Failed', sanitizeErrorMessage(err, 'Could not share the A4 invoice PDF.'));
    } finally {
      setSharing(false);
    }
  };

  const topPad = Math.max(insets.top, Platform.OS === 'android' ? StatusBar.currentHeight || 0 : 0, 12);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.screen, { backgroundColor: theme.isDark ? '#111827' : '#E5E7EB', paddingTop: topPad }]}>
        <View style={styles.toolbar}>
          <View style={{ flex: 1 }}>
            <Text style={styles.toolbarKicker}>A4 TAX INVOICE</Text>
            <Text style={[styles.toolbarTitle, { color: theme.textPrimary }]} numberOfLines={1}>
              {data?.invoiceNumber || 'Invoice'}
            </Text>
          </View>
          <TouchableOpacity
            onPress={handleShare}
            disabled={!sale || sharing}
            style={[styles.closeBtn, { backgroundColor: '#16A34A', borderColor: '#16A34A' }]}
            accessibilityLabel="Share invoice PDF"
          >
            {sharing ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Share2 size={16} color="#FFFFFF" />
            )}
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onClose}
            style={[styles.closeBtn, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}
            accessibilityLabel="Close"
          >
            <X size={18} color={theme.textPrimary} />
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: Math.max(insets.bottom, 16) + 12 }]}
          showsVerticalScrollIndicator
        >
          {data ? (
            <View style={[styles.page, { width: pageWidth, minHeight: pageMinHeight }]}>
              <View style={styles.letterhead}>
                <View style={{ flex: 1, paddingRight: 10 }}>
                  {data.storeLogoUrl ? (
                    <Image source={{ uri: data.storeLogoUrl }} style={styles.logo} resizeMode="contain" />
                  ) : null}
                  <Text style={styles.storeName}>{(data.storeName || 'Your Store').toUpperCase()}</Text>
                  {data.storeAddress ? <Text style={styles.muted}>{data.storeAddress}</Text> : null}
                  {data.storePhone ? <Text style={styles.muted}>Phone: {data.storePhone}</Text> : null}
                  {data.storeGstin ? <Text style={styles.muted}>GSTIN: {data.storeGstin}</Text> : null}
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.invoiceTitle}>TAX INVOICE</Text>
                  <Text style={styles.muted}>{data.invoiceNumber}</Text>
                  <Text style={styles.muted}>{data.date}</Text>
                </View>
              </View>

              <View style={styles.billTo}>
                <Text style={styles.sectionLabel}>BILL TO</Text>
                <Text style={styles.customerName}>{data.customerName || 'Walk-in Customer'}</Text>
                <Text style={styles.muted}>Payment: {data.paymentMethod}</Text>
              </View>

              <View style={styles.table}>
                <View style={styles.tableHead}>
                  <Text style={[styles.th, styles.colIdx]}>#</Text>
                  <Text style={[styles.th, styles.colItem]}>Item</Text>
                  <Text style={[styles.th, styles.colQty]}>Qty</Text>
                  <Text style={[styles.th, styles.colAmt]}>Amount</Text>
                </View>
                {data.items.map((item, idx) => (
                  <View key={`${item.productName}-${idx}`} style={styles.tableRow}>
                    <Text style={[styles.td, styles.colIdx]}>{idx + 1}</Text>
                    <View style={styles.colItem}>
                      <Text style={styles.tdItem}>{item.productName}</Text>
                      <Text style={styles.tdSub}>
                        {item.quantity} {item.unit || 'Pc'} × {rupee(item.unitPrice)}
                        {item.gstRate != null ? ` · ${item.gstRate}%` : ''}
                      </Text>
                    </View>
                    <Text style={[styles.td, styles.colQty]}>{item.quantity}</Text>
                    <Text style={[styles.td, styles.colAmt, styles.tdRight]}>{rupee(item.total)}</Text>
                  </View>
                ))}
              </View>

              <TotalsBlock data={data} />

              <Text style={styles.footer}>
                This is a computer-generated invoice from {data.storeName || 'the store'}.
                {data.footerMessage ? ` ${data.footerMessage}` : ''}
              </Text>
            </View>
          ) : null}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 10,
    gap: 8,
  },
  toolbarKicker: {
    fontSize: 10,
    fontWeight: '800',
    color: BRAND_COLORS.sky500,
    letterSpacing: 0.6,
  },
  toolbarTitle: { fontSize: 18, fontWeight: '900', marginTop: 1 },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: { alignItems: 'center', paddingHorizontal: 12 },
  page: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 18,
    paddingVertical: 20,
    borderRadius: 2,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  letterhead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottomWidth: 3,
    borderBottomColor: BRAND_COLORS.blue600,
    paddingBottom: 12,
    marginBottom: 14,
  },
  logo: { width: 120, height: 40, marginBottom: 6 },
  storeName: { fontSize: 16, fontWeight: '900', color: '#111827' },
  muted: { fontSize: 10, color: '#6B7280', marginTop: 2 },
  invoiceTitle: { fontSize: 15, fontWeight: '900', color: BRAND_COLORS.blue600 },
  billTo: { marginBottom: 14 },
  sectionLabel: { fontSize: 9, fontWeight: '800', color: '#6B7280', letterSpacing: 0.5 },
  customerName: { fontSize: 13, fontWeight: '800', color: '#111827', marginTop: 2 },
  table: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 4, overflow: 'hidden' },
  tableHead: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    paddingVertical: 7,
    paddingHorizontal: 8,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 7,
    paddingHorizontal: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E7EB',
  },
  th: { fontSize: 9, fontWeight: '800', color: '#374151', textTransform: 'uppercase' },
  td: { fontSize: 11, color: '#111827' },
  tdItem: { fontSize: 11, fontWeight: '700', color: '#111827' },
  tdSub: { fontSize: 9, color: '#6B7280', marginTop: 1 },
  tdRight: { textAlign: 'right' },
  colIdx: { width: 22 },
  colItem: { flex: 1, paddingRight: 6 },
  colQty: { width: 36, textAlign: 'center' },
  colAmt: { width: 72, textAlign: 'right' },
  totals: { width: 220, alignSelf: 'flex-end', marginTop: 14 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  totalRowGrand: {
    borderTopWidth: 2,
    borderTopColor: '#111827',
    paddingTop: 6,
    marginTop: 4,
  },
  totalLabel: { fontSize: 11, color: '#374151' },
  totalValue: { fontSize: 11, fontWeight: '700', color: '#111827' },
  totalGrandText: { fontSize: 13, fontWeight: '900', color: '#111827' },
  footer: {
    marginTop: 28,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#D1D5DB',
    fontSize: 10,
    color: '#6B7280',
    textAlign: 'center',
  },
});
