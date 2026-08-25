import React from 'react';
import { View, Text, StyleSheet, Image, Platform } from 'react-native';
import { isRestaurantLayout, ReceiptTemplate } from '@/constants/receiptTemplates';
import { parseGstBilling, shouldPrintGstBreakdown } from '@/constants/gstBilling';
import { DEFAULT_RESTAURANT_PRESETS, resolveBillCharges } from '@/constants/restaurantBilling';

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
  storeLogoUrl?: string;
  items?: MockupItem[];
  subtotal?: number;
  totalDiscount?: number;
  totalTax?: number;
  grandTotal?: number;
  invoiceNumber?: string;
  date?: string;
  customerName?: string;
  invoiceConfig?: unknown;
  customerPhone?: string;
  tableNo?: string;
  waiterName?: string;
  storeGstin?: string;
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
  storeLogoUrl,
  items: propItems,
  subtotal: propSubtotal,
  totalDiscount = 0,
  totalTax: propTotalTax,
  grandTotal: propGrandTotal,
  invoiceNumber = 'INV-1024',
  date = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
  customerName = 'Walk-in Customer',
  invoiceConfig,
  customerPhone,
  tableNo,
  waiterName,
  storeGstin,
}: ReceiptTemplateMockupProps) {
  if (isRestaurantLayout(template.layout)) {
    return (
      <RestaurantThermalMockup
        template={template}
        storeName={storeName}
        storeAddress={storeAddress}
        storePhone={storePhone}
        storeGstin={storeGstin}
        items={propItems}
        invoiceNumber={invoiceNumber}
        date={date}
        customerName={customerName}
        customerPhone={customerPhone}
        tableNo={tableNo}
        waiterName={waiterName}
      />
    );
  }

  const items = propItems || template.sampleItems || [
    { productName: 'Sample Item One', quantity: 1, unitPrice: 250, total: 250, unit: 'Pc' },
    { productName: 'Sample Item Two', quantity: 2, unitPrice: 120, total: 240, unit: 'Pc' },
  ];

  const calculatedSubtotal = items.reduce((sum, it) => sum + it.total, 0);
  const subtotal = propSubtotal !== undefined ? propSubtotal : calculatedSubtotal;
  const gstBilling = parseGstBilling(invoiceConfig);
  const showTaxBreakdown = shouldPrintGstBreakdown(gstBilling, template.showTaxBreakdown);
  const calculatedTax = showTaxBreakdown ? Math.round(subtotal * 0.18 * 100) / 100 : 0;
  const totalTax = propTotalTax !== undefined ? propTotalTax : calculatedTax;
  const grandTotal = propGrandTotal !== undefined ? propGrandTotal : Math.max(0, subtotal - totalDiscount + totalTax);

  const taxable = Math.max(0, subtotal - totalDiscount);
  const halfTax = totalTax / 2;

  return (
    <View style={styles.paper}>
      {storeLogoUrl ? (
        <Image source={{ uri: storeLogoUrl }} style={styles.storeLogo} resizeMode="contain" />
      ) : (
        <View style={[styles.iconBadge, { backgroundColor: template.accentColor }]}>
          <Text style={styles.iconEmoji}>{template.emoji}</Text>
        </View>
      )}
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
          {(item as any).discount && (item as any).discount > 0 ? (
            <Text style={[styles.itemSub, { color: '#10B981', fontWeight: '700', marginLeft: 8 }]}>
              Discount: -₹{Number((item as any).discount).toFixed(2)}
            </Text>
          ) : null}
        </View>
      ))}

      <View style={styles.divider} />

      {showTaxBreakdown ? (
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

function formatQtyLabel(qty: number) {
  return Number.isInteger(qty) ? String(qty) : qty.toFixed(3);
}

function RestaurantThermalMockup({
  template,
  storeName,
  storeAddress,
  storePhone,
  storeGstin,
  items: propItems,
  invoiceNumber,
  date,
  customerName,
  customerPhone,
  tableNo,
  waiterName,
}: {
  template: ReceiptTemplate;
  storeName: string;
  storeAddress?: string;
  storePhone?: string;
  storeGstin?: string;
  items?: MockupItem[];
  invoiceNumber?: string;
  date?: string;
  customerName?: string;
  customerPhone?: string;
  tableNo?: string;
  waiterName?: string;
}) {
  const layout = template.layout || 'restaurant_bill';
  const items = propItems || template.sampleItems;
  const subtotal = items.reduce((sum, it) => sum + it.total, 0);
  const totalQty = items.reduce((sum, it) => sum + it.quantity, 0);
  const addressLines = String(storeAddress || template.previewAddress || '')
    .split(/[\n,]+/)
    .map((l) => l.trim())
    .filter(Boolean);
  const billNo = invoiceNumber || template.previewInvoice || '1842';
  const billDateTime = date || template.previewDate || '25/08/2026 13:42';
  const dateParts = billDateTime.split(' ');
  const billDate = dateParts[0];
  const billTime = dateParts[1] || '13:42';
  const table = (tableNo || template.previewTableNo || '12').toUpperCase();
  const waiter = (waiterName || template.previewWaiter || 'WAITER').toUpperCase();
  const gstin = storeGstin || template.previewGstin || '';
  const guest = (customerName || template.previewCustomerName || 'WALK-IN').toUpperCase();
  const guestPhone = customerPhone || template.previewCustomerPhone || '';
  const phone = storePhone || template.previewPhone || '';

  const gstAmount = Math.round(subtotal * 0.05 * 100) / 100;
  const halfGst = Math.round((gstAmount / 2) * 100) / 100;
  const sgstAmt = Math.round((gstAmount - halfGst) * 100) / 100;
  const sampleChargeIds = DEFAULT_RESTAURANT_PRESETS.filter((p) => p.defaultSelected).map((p) => p.id);
  const billCharges = resolveBillCharges(DEFAULT_RESTAURANT_PRESETS, sampleChargeIds, subtotal, subtotal);
  const vatLow = 55.55;
  const vatHigh = 227.65;
  const classicNet = subtotal + vatLow + vatHigh + billCharges.reduce((sum, charge) => sum + charge.amount, 0);
  const printCompactGst = template.showTaxBreakdown;
  const compactNet = printCompactGst ? subtotal + gstAmount : subtotal;
  const netAmount = layout === 'restaurant_bill' ? classicNet : layout === 'restaurant_gst' ? subtotal + gstAmount : compactNet;
  const compactColumns = layout === 'restaurant_compact' || layout === 'restaurant_gst' || layout === 'restaurant_roomservice';
  const roomService = layout === 'restaurant_roomservice';
  const seatLabel = roomService ? 'Room' : 'TNo';

  const mono = { fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' } as const;

  return (
    <View style={[styles.paper, styles.restaurantPaper, styles.restaurantPaper48]}>
      <Text style={[styles.restaurantStoreName, mono]}>{storeName.toUpperCase()}</Text>
      {addressLines.map((line, idx) => (
        <Text key={idx} style={[styles.restaurantMeta, mono]}>{line.toUpperCase()}</Text>
      ))}
      {phone ? <Text style={[styles.restaurantMeta, mono]}>PH: {phone}</Text> : null}
      {layout === 'restaurant_gst' && gstin ? (
        <Text style={[styles.restaurantMeta, mono]}>GSTIN: {gstin}</Text>
      ) : layout === 'restaurant_bill' && gstin ? (
        <Text style={[styles.restaurantMeta, mono]}>TIN: {gstin}</Text>
      ) : null}
      <Text style={[styles.restaurantDocType, mono]}>{template.tagline || 'CASH/BILL'}</Text>

      <View style={styles.divider} />

      {layout === 'restaurant_takeaway' ? (
        <>
          <View style={styles.row}>
            <Text style={[styles.restaurantSummaryLabel, mono]}>{template.billLabel} {billNo}</Text>
            <Text style={[styles.restaurantSummaryVal, mono]}>{billDate}</Text>
          </View>
          <View style={styles.row}>
            <Text style={[styles.restaurantSummaryLabel, mono]}>{guest}</Text>
            <Text style={[styles.restaurantSummaryVal, mono]}>{billTime}</Text>
          </View>
          {guestPhone ? <Text style={[styles.restaurantMeta, mono]}>PH: {guestPhone}</Text> : null}
        </>
      ) : compactColumns ? (
        <>
          <View style={styles.row}>
            <Text style={[styles.restaurantSummaryLabel, mono]}>{template.billLabel} {billNo}</Text>
            <Text style={[styles.restaurantSummaryVal, mono]}>{billDate}</Text>
          </View>
          <View style={styles.row}>
            <Text style={[styles.restaurantSummaryLabel, mono]}>{seatLabel} {table}  {waiter}</Text>
            <Text style={[styles.restaurantSummaryVal, mono]}>{billTime}</Text>
          </View>
        </>
      ) : (
        <>
          <View style={styles.restaurantMetaRow}>
            <Text style={[styles.restaurantMetaCol, mono]}>Bill{'\n'}No</Text>
            <Text style={[styles.restaurantMetaCol, mono]}>Waiter</Text>
            <Text style={[styles.restaurantMetaCol, mono]}>TNo</Text>
            <Text style={[styles.restaurantMetaCol, mono]}>Date</Text>
            <Text style={[styles.restaurantMetaCol, mono]}>Time</Text>
          </View>
          <View style={styles.restaurantMetaRow}>
            <Text style={[styles.restaurantMetaVal, mono]}>{billNo}</Text>
            <Text style={[styles.restaurantMetaVal, mono]}>{waiter.slice(0, 8)}</Text>
            <Text style={[styles.restaurantMetaVal, mono]}>{table}</Text>
            <Text style={[styles.restaurantMetaVal, mono]}>{billDate}</Text>
            <Text style={[styles.restaurantMetaVal, mono]}>{billTime}</Text>
          </View>
        </>
      )}

      <View style={styles.divider} />

      {compactColumns ? (
        <View style={styles.row}>
          <Text style={[styles.compactItemName, mono]}>ITEM</Text>
          <Text style={[styles.compactQty, mono]}>QTY</Text>
          <Text style={[styles.compactAmt, mono]}>AMT</Text>
        </View>
      ) : (
        <View style={styles.row}>
          <Text style={[styles.restaurantItemHeaderLabel, mono]}>Item</Text>
          <Text style={[styles.restaurantItemHeaderLabel, mono]}>Total</Text>
        </View>
      )}
      <View style={styles.divider} />

      {items.map((item, idx) => {
        const qtyLabel = formatQtyLabel(item.quantity);
        if (compactColumns) {
          return (
            <View key={idx} style={[styles.row, { marginBottom: 3 }]}>
              <Text style={[styles.compactItemName, mono]} numberOfLines={1}>
                {item.productName.toUpperCase()}
              </Text>
              <Text style={[styles.compactQty, mono]}>{qtyLabel}</Text>
              <Text style={[styles.compactAmt, mono]}>{item.total.toFixed(2)}</Text>
            </View>
          );
        }
        return (
          <View key={idx} style={styles.restaurantItemBlock}>
            <Text style={[styles.restaurantItemName, mono]}>{item.productName.toUpperCase()}</Text>
            <View style={styles.restaurantItemDetailRow}>
              <Text style={[styles.restaurantItemDetail, mono]}>
                {'     '}{qtyLabel} x {item.unitPrice.toFixed(2)}
              </Text>
              <Text style={[styles.restaurantItemTotal, mono]}>{item.total.toFixed(2)}</Text>
            </View>
          </View>
        );
      })}

      <View style={styles.divider} />

      {layout === 'restaurant_bill' ? (
        <>
          <View style={styles.row}><Text style={[styles.restaurantSummaryLabel, mono]}>Total Qty</Text><Text style={[styles.restaurantSummaryVal, mono]}>{totalQty.toFixed(3)}</Text></View>
          <View style={styles.row}><Text style={[styles.restaurantSummaryLabel, mono]}>Gross Total</Text><Text style={[styles.restaurantSummaryVal, mono]}>{subtotal.toFixed(2)}</Text></View>
          <View style={styles.row}><Text style={[styles.restaurantSummaryLabel, mono]}>VAT 5.5 %</Text><Text style={[styles.restaurantSummaryVal, mono]}>{vatLow.toFixed(2)}</Text></View>
          <View style={styles.row}><Text style={[styles.restaurantSummaryLabel, mono]}>VAT 14.5 %</Text><Text style={[styles.restaurantSummaryVal, mono]}>{vatHigh.toFixed(2)}</Text></View>
          {billCharges.map((charge) => (
            <View key={charge.presetId} style={styles.row}>
              <Text style={[styles.restaurantSummaryLabel, mono]}>{charge.label}</Text>
              <Text style={[styles.restaurantSummaryVal, mono]}>{charge.amount.toFixed(2)}</Text>
            </View>
          ))}
        </>
      ) : layout === 'restaurant_gst' ? (
        <>
          <View style={styles.row}><Text style={[styles.restaurantSummaryLabel, mono]}>Taxable</Text><Text style={[styles.restaurantSummaryVal, mono]}>{subtotal.toFixed(2)}</Text></View>
          <View style={styles.row}><Text style={[styles.restaurantSummaryLabel, mono]}>CGST 2.5%</Text><Text style={[styles.restaurantSummaryVal, mono]}>{halfGst.toFixed(2)}</Text></View>
          <View style={styles.row}><Text style={[styles.restaurantSummaryLabel, mono]}>SGST 2.5%</Text><Text style={[styles.restaurantSummaryVal, mono]}>{sgstAmt.toFixed(2)}</Text></View>
        </>
      ) : (
        <>
          <View style={styles.row}><Text style={[styles.restaurantSummaryLabel, mono]}>Qty {formatQtyLabel(totalQty)}</Text><Text style={[styles.restaurantSummaryVal, mono]}>{subtotal.toFixed(2)}</Text></View>
          {printCompactGst ? (
            <View style={styles.row}><Text style={[styles.restaurantSummaryLabel, mono]}>GST 5%</Text><Text style={[styles.restaurantSummaryVal, mono]}>{gstAmount.toFixed(2)}</Text></View>
          ) : null}
        </>
      )}

      <View style={[styles.divider, styles.dividerDouble]} />
      <View style={styles.row}>
        <Text style={[styles.restaurantNetLabel, mono]}>{layout === 'restaurant_gst' ? 'Grand Total' : 'Net Amount'}</Text>
        <Text style={[styles.restaurantNetVal, mono]}>{netAmount.toFixed(2)}</Text>
      </View>

      <View style={styles.divider} />
      <Text style={[styles.restaurantFooter, mono]}>{template.footerMessage}</Text>
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
  storeLogo: { width: 72, height: 72, borderRadius: 12, marginBottom: 8, backgroundColor: '#FFFFFF' },
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
  restaurantPaper: { alignItems: 'stretch', paddingHorizontal: 12 },
  restaurantPaper48: { maxWidth: 248, paddingHorizontal: 10, paddingVertical: 14 },
  compactItemName: { fontSize: 9, color: '#0F172A', fontWeight: '700', flex: 1, paddingRight: 6 },
  compactQty: { fontSize: 9, color: '#0F172A', fontWeight: '700', width: 28, textAlign: 'right' },
  compactAmt: { fontSize: 9, color: '#0F172A', fontWeight: '700', width: 58, textAlign: 'right' },
  restaurantStoreName: { fontSize: 13, fontWeight: '900', color: '#0F172A', textAlign: 'center', letterSpacing: 0.5 },
  restaurantMeta: { fontSize: 9, color: '#334155', textAlign: 'center', lineHeight: 12 },
  restaurantDocType: { fontSize: 10, fontWeight: '800', color: '#0F172A', textAlign: 'center', marginTop: 4 },
  restaurantMetaRow: { flexDirection: 'row', justifyContent: 'space-between', width: '100%' },
  restaurantMetaCol: { fontSize: 8, color: '#64748B', fontWeight: '700', flex: 1, textAlign: 'center' },
  restaurantMetaVal: { fontSize: 9, color: '#0F172A', fontWeight: '700', flex: 1, textAlign: 'center' },
  restaurantItemHeaderLabel: { fontSize: 9, color: '#0F172A', fontWeight: '900' },
  restaurantItemBlock: { width: '100%', marginBottom: 6 },
  restaurantItemName: { fontSize: 9, color: '#0F172A', fontWeight: '700' },
  restaurantItemDetailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 },
  restaurantItemDetail: { fontSize: 8, color: '#64748B', flex: 1 },
  restaurantItemTotal: { fontSize: 9, color: '#0F172A', fontWeight: '700' },
  restaurantSummaryLabel: { fontSize: 9, color: '#334155', fontWeight: '600' },
  restaurantSummaryVal: { fontSize: 9, color: '#0F172A', fontWeight: '700' },
  restaurantNetLabel: { fontSize: 10, fontWeight: '900', color: '#0F172A' },
  restaurantNetVal: { fontSize: 11, fontWeight: '900', color: '#0F172A' },
  restaurantFooter: { fontSize: 10, fontWeight: '700', textAlign: 'center', color: '#334155', marginTop: 2 },
});
