import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { Bill, ShopProfile } from '@/types';
import { calculateBillTotals } from '@/utils/billing';

interface ReceiptPreviewProps {
  bill: Partial<Bill> & { items: any[] };
  profile: ShopProfile;
  currency?: string;
  width?: '58mm' | '80mm' | number;
}

export default function ReceiptPreview({
  bill,
  profile,
  currency = '₹',
  width = '58mm',
}: ReceiptPreviewProps) {
  const taxPercent = bill.taxPercent ?? 18;
  const gstMode = bill.gstMode ?? 'exclusive';
  
  const discountConfig = bill.discount ?? { type: 'flat', value: 0 };
  const rawDiscount = typeof discountConfig === 'number' 
    ? { type: 'flat' as const, value: discountConfig } 
    : discountConfig;

  // Adapt items for calculateBillTotals
  const normalizedItems = (bill.items || []).map(i => ({
    qty: i.qty || 1,
    unitPrice: i.unitPrice ?? i.price ?? 0
  }));

  const totals = calculateBillTotals({
    items: normalizedItems,
    gstMode,
    gstRate: taxPercent,
    discount: rawDiscount
  });

  // Use bill stored values if available, else fallback to live calculation
  const subtotal = bill.subtotal ?? totals.rawSubtotal;
  const total = bill.total ?? totals.total;
  const taxAmount = totals.taxAmount;
  const discountAmount = totals.discountAmount;

  const date = bill.createdAt ? new Date(bill.createdAt) : new Date();

  return (
    <View style={styles.container}>
      <View style={styles.perforation} />
      
      <View style={styles.receiptBody}>
        {/* Shop Header */}
        <Text style={styles.shopName}>{profile.name}</Text>
        {profile.address && <Text style={styles.shopDetail}>{profile.address}</Text>}
        {profile.phone && <Text style={styles.shopDetail}>Phone: {profile.phone}</Text>}
        {profile.taxId && <Text style={styles.shopDetail}>GSTIN: {profile.taxId}</Text>}
        
        <View style={styles.divider} />
        
        {/* Meta Info */}
        <View style={styles.metaRow}>
          <Text style={styles.monospaceText}>INV: {bill.id || 'TEST-000000'}</Text>
        </View>
        <View style={styles.metaRow}>
          <Text style={styles.monospaceText}>Date: {date.toLocaleString()}</Text>
        </View>
        <View style={styles.metaRow}>
          <Text style={styles.monospaceText}>Cust: {bill.customerName || 'Walk-in'}</Text>
        </View>
        
        <View style={styles.divider} />
        
        {/* Table Header */}
        <View style={styles.tableHeader}>
          <Text style={[styles.monospaceBold, styles.colItem]}>Item</Text>
          <Text style={[styles.monospaceBold, styles.colQty]}>Qty</Text>
          <Text style={[styles.monospaceBold, styles.colPrice]}>Rate</Text>
          <Text style={[styles.monospaceBold, styles.colTotal]}>Total</Text>
        </View>
        
        {/* Table Items */}
        {bill.items.map((item, idx) => (
          <View key={idx} style={styles.tableRow}>
            <Text style={[styles.monospaceText, styles.colItem]} numberOfLines={1}>{item.name}</Text>
            <Text style={[styles.monospaceText, styles.colQty]}>{item.qty}{'unit' in item && item.unit ? ` ${item.unit}` : ''}</Text>
            <Text style={[styles.monospaceText, styles.colPrice]}>{currency}{item.unitPrice.toFixed(0)}</Text>
            <Text style={[styles.monospaceText, styles.colTotal]}>{currency}{item.lineTotal.toFixed(0)}</Text>
          </View>
        ))}
        
        <View style={styles.divider} />
        
        {/* Summary */}
        <View style={styles.summaryRow}>
          <Text style={styles.monospaceText}>Subtotal:</Text>
          <Text style={styles.monospaceText}>{currency}{subtotal.toFixed(2)}</Text>
        </View>
        
        {discountAmount > 0 && (
          <View style={styles.summaryRow}>
            <Text style={styles.monospaceText}>Discount:</Text>
            <Text style={[styles.monospaceText, { color: '#EF4444' }]}>-{currency}{discountAmount.toFixed(2)}</Text>
          </View>
        )}

        <View style={styles.summaryRow}>
          <Text style={styles.monospaceText}>
            GST ({taxPercent}%{gstMode === 'inclusive' ? ' Incl.' : ''}):
          </Text>
          <Text style={styles.monospaceText}>{currency}{taxAmount.toFixed(2)}</Text>
        </View>
        
        <View style={styles.summaryRow}>
          <Text style={styles.monospaceBold}>GRAND TOTAL:</Text>
          <Text style={styles.monospaceBold}>{currency}{total.toFixed(2)}</Text>
        </View>

        {bill.amountReceived !== undefined && (
          <View style={[styles.summaryRow, { marginTop: 8 }]}>
            <Text style={styles.monospaceText}>Received ({bill.paymentMethod || 'Cash'}):</Text>
            <Text style={styles.monospaceText}>{currency}{bill.amountReceived.toFixed(2)}</Text>
          </View>
        )}
        
        {bill.amountReceived !== undefined && (bill.amountReceived - total) > 0 && (
          <View style={styles.summaryRow}>
            <Text style={styles.monospaceText}>Change Due:</Text>
            <Text style={styles.monospaceText}>{currency}{(bill.amountReceived - total).toFixed(2)}</Text>
          </View>
        )}

        {bill.notes ? (
          <View style={[styles.divider, { marginTop: 4 }]} />
        ) : null}
        
        {bill.notes ? (
          <Text style={[styles.monospaceText, { textAlign: 'center', marginBottom: 8 }]}>Note: {bill.notes}</Text>
        ) : null}
        
        <View style={styles.divider} />
        
        {/* Footer */}
        <Text style={styles.footerText}>Thank you for shopping!</Text>
        <Text style={styles.footerText}>Powered by Seznik</Text>
      </View>
      
      <View style={styles.perforation} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  perforation: {
    height: 4,
    borderBottomWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#CBD5E1',
    marginVertical: 4,
  },
  receiptBody: {
    paddingVertical: 12,
    alignItems: 'stretch',
  },
  shopName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 4,
  },
  shopDetail: {
    fontSize: 11,
    color: '#475569',
    textAlign: 'center',
    marginBottom: 2,
  },
  divider: {
    borderBottomWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#94A3B8',
    marginVertical: 8,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 3,
  },
  monospaceText: {
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    fontSize: 11,
    color: '#1E293B',
  },
  monospaceBold: {
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    fontSize: 11,
    fontWeight: '800',
    color: '#0F172A',
  },
  tableHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderColor: '#E2E8F0',
    paddingBottom: 4,
    marginBottom: 4,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 3,
  },
  colItem: {
    flex: 2,
  },
  colQty: {
    flex: 0.5,
    textAlign: 'center',
  },
  colPrice: {
    flex: 0.8,
    textAlign: 'right',
  },
  colTotal: {
    flex: 0.8,
    textAlign: 'right',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 2,
  },
  footerText: {
    fontSize: 10,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 4,
  },
});
