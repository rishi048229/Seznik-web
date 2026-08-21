import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ReceiptTemplate } from '@/constants/receiptTemplates';

interface MockupItem {
  productName: string;
  quantity: number;
  unitPrice: number;
  total: number;
  unit?: string;
  discount?: number;
}

interface ReceiptTemplateMockupProps {
  template: ReceiptTemplate;
  storeName: string;
  storeAddress?: string;
  storePhone?: string;
  items?: MockupItem[];
  subtotal?: number;
  totalDiscount?: number;
  totalTax?: number;
  grandTotal?: number;
  invoiceNumber?: string;
  date?: string;
  customerName?: string;
}

/**
 * A real, visually-styled mock receipt (colors, icon badge, varied type weight) — NOT the
 * monospace ESC/POS text preview. Displays per-template accent color, emoji badge, tagline,
 * and contextual sample items tailored to that business vertical.
 */
export function ReceiptTemplateMockup({
  template,
  storeName,
  storeAddress,
  storePhone,
  items: propItems,
  subtotal: propSubtotal,
  totalDiscount = 0,
  totalTax: propTotalTax,
  grandTotal: propGrandTotal,
  invoiceNumber = 'INV-1024',
  date = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
  customerName = 'Walk-in Customer',
}: ReceiptTemplateMockupProps) {
  const items = propItems || template.sampleItems || [
    { productName: 'Sample Item One', quantity: 1, unitPrice: 250, total: 250, unit: 'Pc' },
    { productName: 'Sample Item Two', quantity: 2, unitPrice: 120, total: 240, unit: 'Pc' },
  ];

  const calculatedSubtotal = items.reduce((sum, it) => sum + it.total, 0);
  const subtotal = propSubtotal !== undefined ? propSubtotal : calculatedSubtotal;
  const calculatedTax = template.showTaxBreakdown ? Math.round(subtotal * 0.18 * 100) / 100 : 0;
  const totalTax = propTotalTax !== undefined ? propTotalTax : calculatedTax;
  const grandTotal = propGrandTotal !== undefined ? propGrandTotal : Math.max(0, subtotal - totalDiscount + totalTax);

  const taxable = Math.max(0, subtotal - totalDiscount);
  const halfTax = totalTax / 2;

  return (
    <View style={styles.paper}>
      <View style={[styles.iconBadge, { backgroundColor: template.accentColor }]}>
        <Text style={styles.iconEmoji}>{template.emoji}</Text>
      </View>
      <Text style={styles.storeName}>{storeName.toUpperCase()}</Text>
      {template.tagline ? <Text style={[styles.tagline, { color: template.accentColor }]}>{template.tagline}</Text> : null}
      {storeAddress ? <Text style={styles.contactLine}>{storeAddress}</Text> : null}
      {storePhone ? <Text style={styles.contactLine}>Phone: {storePhone}</Text> : null}

      <View style={[styles.divider, template.dividerChar === '=' && styles.dividerDouble]} />

      <View style={styles.row}>
        <Text style={styles.metaText}>{template.billLabel}: {invoiceNumber}</Text>
        <Text style={styles.metaText}>{date}</Text>
      </View>
      {template.showCustomerLine ? <Text style={styles.metaText}>Customer: {customerName || 'Walk-in'}</Text> : null}

      <View style={styles.divider} />

      <View style={styles.row}>
        <Text style={styles.colHeader}>{template.itemColumnLeft}</Text>
        <Text style={styles.colHeader}>{template.itemColumnRight}</Text>
      </View>
      {items.map((item, idx) => (
        <View key={idx} style={{ marginTop: 4 }}>
          <Text style={styles.itemName}>{idx + 1}. {item.productName}</Text>
          <View style={styles.row}>
            <Text style={styles.itemSub}>{item.quantity} {item.unit || 'Pc'} x ₹{item.unitPrice.toFixed(2)}</Text>
            <Text style={styles.itemAmount}>₹{item.total.toFixed(2)}</Text>
          </View>
          {item.discount && item.discount > 0 ? (
            <Text style={[styles.itemSub, { color: '#10B981', fontWeight: '700', marginLeft: 8 }]}>
              Discount: -₹{item.discount.toFixed(2)}
            </Text>
          ) : null}
        </View>
      ))}

      <View style={styles.divider} />

      {template.showTaxBreakdown ? (
        <>
          <View style={styles.row}><Text style={styles.metaText}>Sub Total</Text><Text style={styles.metaText}>₹{subtotal.toFixed(2)}</Text></View>
          {totalDiscount > 0 ? (
            <View style={styles.row}><Text style={[styles.metaText, { color: '#10B981', fontWeight: '800' }]}>Discount</Text><Text style={[styles.metaText, { color: '#10B981', fontWeight: '800' }]}>-₹{totalDiscount.toFixed(2)}</Text></View>
          ) : null}
          <View style={styles.row}><Text style={styles.metaText}>Taxable Amt</Text><Text style={styles.metaText}>₹{taxable.toFixed(2)}</Text></View>
          <View style={styles.row}><Text style={styles.metaText}>SGST (9%)</Text><Text style={styles.metaText}>₹{halfTax.toFixed(2)}</Text></View>
          <View style={styles.row}><Text style={styles.metaText}>CGST (9%)</Text><Text style={styles.metaText}>₹{halfTax.toFixed(2)}</Text></View>
          <View style={[styles.divider, styles.dividerDouble, { borderColor: template.accentColor }]} />
          <View style={styles.row}>
            <Text style={[styles.totalLabel, { color: template.accentColor }]}>Total Amount</Text>
            <Text style={[styles.totalValue, { color: template.accentColor }]}>₹{grandTotal.toFixed(2)}</Text>
          </View>
        </>
      ) : (
        <>
          <View style={styles.row}><Text style={styles.metaText}>Sub Total</Text><Text style={styles.metaText}>₹{subtotal.toFixed(2)}</Text></View>
          {totalDiscount > 0 ? (
            <View style={styles.row}><Text style={[styles.metaText, { color: '#10B981', fontWeight: '800' }]}>Discount</Text><Text style={[styles.metaText, { color: '#10B981', fontWeight: '800' }]}>-₹{totalDiscount.toFixed(2)}</Text></View>
          ) : null}
          {totalTax > 0 ? <View style={styles.row}><Text style={styles.metaText}>Tax</Text><Text style={styles.metaText}>₹{totalTax.toFixed(2)}</Text></View> : null}
          <View style={[styles.divider, styles.dividerDouble, { borderColor: template.accentColor }]} />
          <View style={styles.row}>
            <Text style={[styles.totalLabel, { color: template.accentColor }]}>Grand Total</Text>
            <Text style={[styles.totalValue, { color: template.accentColor }]}>₹{grandTotal.toFixed(2)}</Text>
          </View>
        </>
      )}

      <View style={styles.divider} />
      <Text style={[styles.footer, { color: template.accentColor }]}>{template.footerMessage}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  paper: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 20,
    alignItems: 'center',
    width: '100%',
    maxWidth: 340,
    alignSelf: 'center',
    shadowColor: '#000000',
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 8,
    elevation: 3,
    borderTopWidth: 3,
    borderTopColor: '#E2E8F0',
    borderBottomWidth: 3,
    borderBottomColor: '#CBD5E1',
  },
  iconBadge: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  iconEmoji: { fontSize: 22, lineHeight: 26 },
  storeName: { fontSize: 15, fontWeight: '900', color: '#0F172A', textAlign: 'center' },
  tagline: { fontSize: 11, fontWeight: '700', marginTop: 2, textAlign: 'center' },
  contactLine: { fontSize: 10, color: '#64748B', marginTop: 2, textAlign: 'center' },
  divider: { width: '100%', borderBottomWidth: 1, borderColor: '#CBD5E1', borderStyle: 'dashed', marginVertical: 8 },
  dividerDouble: { borderStyle: 'solid', borderBottomWidth: 2 },
  row: { flexDirection: 'row', justifyContent: 'space-between', width: '100%' },
  metaText: { fontSize: 11, color: '#334155', fontWeight: '600' },
  colHeader: { fontSize: 10, color: '#0F172A', fontWeight: '900', textTransform: 'uppercase' },
  itemName: { fontSize: 12, color: '#0F172A', fontWeight: '700' },
  itemSub: { fontSize: 10, color: '#64748B' },
  itemAmount: { fontSize: 11, color: '#0F172A', fontWeight: '700' },
  totalLabel: { fontSize: 13, fontWeight: '900' },
  totalValue: { fontSize: 15, fontWeight: '900' },
  footer: { fontSize: 11, fontWeight: '800', textAlign: 'center', marginTop: 2 },
});
