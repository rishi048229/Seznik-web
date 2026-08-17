import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ReceiptTemplate } from '@/constants/receiptTemplates';

interface MockupItem {
  productName: string;
  quantity: number;
  unitPrice: number;
  total: number;
  unit?: string;
}

interface ReceiptTemplateMockupProps {
  template: ReceiptTemplate;
  storeName: string;
  storeAddress?: string;
  storePhone?: string;
  items: MockupItem[];
  subtotal: number;
  totalTax: number;
  grandTotal: number;
  invoiceNumber: string;
  date: string;
  customerName?: string;
}

/**
 * A real, visually-styled mock receipt (colors, icon badge, varied type weight) — NOT the
 * monospace ESC/POS text preview. The plain-text preview looks identical across every template
 * since it's all black-on-white fixed-width text; this actually shows the per-template accent
 * color, emoji badge, and layout differences the way the printed logo/QR version will read.
 * Purely presentational for the Templates picker — the real print still goes through
 * PrinterService.formatReceiptText/generateReceiptHtml, unchanged.
 */
export function ReceiptTemplateMockup({
  template,
  storeName,
  storeAddress,
  storePhone,
  items,
  subtotal,
  totalTax,
  grandTotal,
  invoiceNumber,
  date,
  customerName,
}: ReceiptTemplateMockupProps) {
  const taxable = subtotal;
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
            <Text style={styles.itemSub}>{item.quantity} {item.unit || 'Pc'} x {item.unitPrice.toFixed(2)}</Text>
            <Text style={styles.itemAmount}>{item.total.toFixed(2)}</Text>
          </View>
        </View>
      ))}

      <View style={styles.divider} />

      {template.showTaxBreakdown ? (
        <>
          <View style={styles.row}><Text style={styles.metaText}>Sub Total</Text><Text style={styles.metaText}>Rs.{subtotal.toFixed(2)}</Text></View>
          <View style={styles.row}><Text style={styles.metaText}>Taxable Amt</Text><Text style={styles.metaText}>Rs.{taxable.toFixed(2)}</Text></View>
          <View style={styles.row}><Text style={styles.metaText}>SGST</Text><Text style={styles.metaText}>Rs.{halfTax.toFixed(2)}</Text></View>
          <View style={styles.row}><Text style={styles.metaText}>CGST</Text><Text style={styles.metaText}>Rs.{halfTax.toFixed(2)}</Text></View>
          <View style={[styles.divider, styles.dividerDouble, { borderColor: template.accentColor }]} />
          <View style={styles.row}>
            <Text style={[styles.totalLabel, { color: template.accentColor }]}>Total Amount</Text>
            <Text style={[styles.totalValue, { color: template.accentColor }]}>Rs.{grandTotal.toFixed(2)}</Text>
          </View>
        </>
      ) : (
        <>
          {totalTax > 0 ? <View style={styles.row}><Text style={styles.metaText}>Tax</Text><Text style={styles.metaText}>Rs.{totalTax.toFixed(2)}</Text></View> : null}
          <View style={[styles.divider, styles.dividerDouble, { borderColor: template.accentColor }]} />
          <View style={styles.row}>
            <Text style={[styles.totalLabel, { color: template.accentColor }]}>Grand Total</Text>
            <Text style={[styles.totalValue, { color: template.accentColor }]}>Rs.{grandTotal.toFixed(2)}</Text>
          </View>
        </>
      )}

      <View style={styles.divider} />
      <Text style={[styles.footer, { color: template.accentColor }]}>{template.footerMessage}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  paper: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 16, alignItems: 'center', width: '100%' },
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
