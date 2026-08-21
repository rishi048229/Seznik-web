import React from 'react';
import { View, Text, StyleSheet, Image, Platform } from 'react-native';
import QRCodeSVG from 'react-native-qrcode-svg';
import { Image as ImageIcon } from 'lucide-react-native';
import { CustomReceiptTemplate, CustomReceiptEntry } from '@/types/customReceipt';
import { buildBillPdfUrl, buildUpiPayString } from '@/utils/billQrService';

interface CustomReceiptMockupProps {
  template: CustomReceiptTemplate;
  storeName: string;
  storeAddress?: string;
  storePhone?: string;
  storeGstin?: string;
  invoiceNumber?: string;
  date?: string;
  time?: string;
  customerName?: string;
  customerPhone?: string;
  items?: { productName: string; quantity: number; unitPrice: number; total: number; unit?: string; gstRate?: number }[];
  subtotal?: number;
  totalDiscount?: number;
  totalTax?: number;
  grandTotal?: number;
  amountPaid?: number;
  changeReturned?: number;
  paymentMethod?: string;
  upiId?: string;
  paperWidth?: '58mm' | '80mm';
}

const DEFAULT_SAMPLE_ITEMS = [
  { productName: 'Basmati Rice 5kg', quantity: 1, unitPrice: 450, total: 450, unit: 'Bag', gstRate: 5 },
  { productName: 'Sunflower Oil 1L', quantity: 2, unitPrice: 180, total: 360, unit: 'Btl', gstRate: 5 },
  { productName: 'Whole Wheat Flour 5kg', quantity: 1, unitPrice: 280, total: 280, unit: 'Bag', gstRate: 0 },
];

export function CustomReceiptMockup({
  template,
  storeName,
  storeAddress = '123 Market Road, City Centre',
  storePhone = '+91 98765 43210',
  storeGstin = '27AAAAA0000A1Z5',
  invoiceNumber = 'INV-2026-0042',
  date = new Date().toLocaleDateString('en-GB'),
  time = '12:45 PM',
  customerName = 'Aarav Sharma',
  customerPhone = '+91 99887 76655',
  items = DEFAULT_SAMPLE_ITEMS,
  subtotal = 1090,
  totalDiscount = 50,
  totalTax = 40.5,
  grandTotal = 1080.5,
  amountPaid = 1100,
  changeReturned = 19.5,
  paymentMethod = 'UPI',
  upiId = 'store@upi',
  paperWidth,
}: CustomReceiptMockupProps) {
  const activePaperWidth = paperWidth || template.paperWidth || '58mm';
  const is80mm = activePaperWidth === '80mm';
  const paperMaxWidth = is80mm ? 360 : 280;

  const sampleBillPdfUrl = buildBillPdfUrl({ invoiceNumber: invoiceNumber || 'INV-2026-0042' });
  const sampleUpiStr = buildUpiPayString(upiId, storeName || 'Store', grandTotal, invoiceNumber);

  const replaceVars = (str?: string): string => {
    if (!str) return '';
    return str
      .replace(/{{store_name}}/gi, storeName || 'SEZNIK SUPERSTORE')
      .replace(/{{store_address}}/gi, storeAddress)
      .replace(/{{store_phone}}/gi, storePhone)
      .replace(/{{store_gstin}}/gi, storeGstin)
      .replace(/{{invoice_no}}/gi, invoiceNumber)
      .replace(/{{date}}/gi, date)
      .replace(/{{time}}/gi, time)
      .replace(/{{customer_name}}/gi, customerName)
      .replace(/{{customer_phone}}/gi, customerPhone)
      .replace(/{{grand_total}}/gi, `₹${grandTotal.toFixed(2)}`)
      .replace(/{{subtotal}}/gi, `₹${subtotal.toFixed(2)}`)
      .replace(/{{tax}}/gi, `₹${totalTax.toFixed(2)}`)
      .replace(/{{total_tax}}/gi, `₹${totalTax.toFixed(2)}`)
      .replace(/{{discount}}/gi, `₹${totalDiscount.toFixed(2)}`)
      .replace(/{{paid_amount}}/gi, `₹${amountPaid.toFixed(2)}`)
      .replace(/{{change_returned}}/gi, `₹${changeReturned.toFixed(2)}`)
      .replace(/{{payment_method}}/gi, paymentMethod)
      .replace(/{{bill_pdf_url}}/gi, sampleBillPdfUrl)
      .replace(/{{upi_qr}}/gi, sampleUpiStr)
      .replace(/{{footer_message}}/gi, 'Thank you! Visit again.');
  };

  const renderEntry = (entry: CustomReceiptEntry, idx: number) => {
    if (!entry.enabled) return null;

    switch (entry.type) {
      case 'text': {
        const align = entry.align || 'left';
        let fontSize = 12;
        if (entry.size === 'small') fontSize = 10;
        if (entry.size === 'large') fontSize = 14;
        if (entry.size === 'double_width') fontSize = 13;
        if (entry.size === 'double_height') fontSize = 15;

        return (
          <View key={entry.id || idx} style={styles.entryBlock}>
            <Text
              style={[
                styles.thermalText,
                {
                  textAlign: align,
                  fontSize,
                  fontWeight: entry.bold || entry.size === 'double_width' || entry.size === 'double_height' ? '800' : '500',
                  color: '#000000',
                  lineHeight: fontSize + 4,
                },
              ]}
            >
              {replaceVars(entry.text)}
            </Text>
          </View>
        );
      }

      case 'text_special': {
        const align = entry.align || 'center';
        const fontSize = Math.min(Math.max(entry.fontSizePt || 14, 10), 22);
        return (
          <View key={entry.id || idx} style={styles.entryBlock}>
            <Text
              style={[
                styles.thermalText,
                {
                  textAlign: align,
                  fontSize,
                  fontWeight: entry.bold ? '800' : '600',
                  fontStyle: entry.italic ? 'italic' : 'normal',
                  textDecorationLine: entry.underline ? 'underline' : 'none',
                  color: '#000000',
                  lineHeight: fontSize + 4,
                },
              ]}
            >
              {replaceVars(entry.text)}
            </Text>
          </View>
        );
      }

      case 'image': {
        const widthPct = `${Math.min(entry.widthPercent || 40, 100)}%` as any;
        return (
          <View
            key={entry.id || idx}
            style={[
              styles.entryBlock,
              {
                alignItems: entry.align === 'left' ? 'flex-start' : entry.align === 'right' ? 'flex-end' : 'center',
                marginVertical: 4,
              },
            ]}
          >
            {entry.imageUri ? (
              <Image
                source={{ uri: entry.imageUri }}
                style={[
                  styles.thermalLogoImage,
                  {
                    width: widthPct,
                    height: 52,
                    resizeMode: 'contain',
                  },
                ]}
              />
            ) : (
              <View style={styles.imagePlaceholder}>
                <ImageIcon size={18} color="#000000" />
                <Text style={styles.imagePlaceholderText}>STORE LOGO ({entry.widthPercent || 40}%)</Text>
              </View>
            )}
          </View>
        );
      }

      case 'horizontal_line': {
        const style = entry.lineStyle || 'dashed';
        if (style === 'double') {
          return (
            <View key={entry.id || idx} style={styles.entryBlock}>
              <View style={[styles.line, { borderBottomWidth: 1, borderColor: '#000000', marginBottom: 2 }]} />
              <View style={[styles.line, { borderBottomWidth: 1, borderColor: '#000000' }]} />
            </View>
          );
        }
        if (style === 'single') {
          return (
            <View key={entry.id || idx} style={styles.entryBlock}>
              <View style={[styles.line, { borderBottomWidth: 1, borderColor: '#000000' }]} />
            </View>
          );
        }
        if (style === 'dotted') {
          return (
            <View key={entry.id || idx} style={styles.entryBlock}>
              <View style={[styles.line, { borderBottomWidth: 1, borderColor: '#000000', borderStyle: 'dotted' }]} />
            </View>
          );
        }
        return (
          <View key={entry.id || idx} style={styles.entryBlock}>
            <View style={[styles.line, { borderBottomWidth: 1, borderColor: '#000000', borderStyle: 'dashed' }]} />
          </View>
        );
      }

      case 'barcode': {
        const isQr = entry.codeType === 'qr_code' || entry.format === 'qr';
        let rawVal = replaceVars(entry.value);
        if (entry.qrType === 'upi' || entry.value?.includes('{{upi_qr}}') || entry.upiId) {
          const merchantUpi = entry.upiId || upiId || 'store@upi';
          rawVal = buildUpiPayString(merchantUpi, storeName || 'Store', grandTotal, invoiceNumber);
        } else if (!rawVal || rawVal === '{{bill_pdf_url}}' || entry.qrType === 'digital_bill') {
          rawVal = sampleBillPdfUrl;
        } else if (rawVal === '{{invoice_no}}' || entry.qrType === 'invoice_barcode') {
          rawVal = invoiceNumber || 'INV-2026-0042';
        }

        const qrSize = entry.size === 'large' ? (is80mm ? 130 : 110) : entry.size === 'small' ? 75 : 95;

        return (
          <View
            key={entry.id || idx}
            style={[
              styles.entryBlock,
              {
                alignItems: entry.align === 'left' ? 'flex-start' : entry.align === 'right' ? 'flex-end' : 'center',
                marginVertical: 6,
              },
            ]}
          >
            {isQr ? (
              <View style={styles.qrWrapper}>
                <View style={styles.qrContainer}>
                  <QRCodeSVG
                    value={rawVal || sampleBillPdfUrl}
                    size={qrSize}
                    color="#000000"
                    backgroundColor="#FFFFFF"
                    ecl="M"
                    quietZone={2}
                  />
                </View>
              </View>
            ) : (
              <View style={styles.barcodeWrapper}>
                <View style={styles.barcodeBarsRow}>
                  {[1, 2, 1, 3, 1, 2, 1, 1, 3, 2, 1, 2, 3, 1, 1, 2, 1, 3, 2, 1, 1, 2, 3, 1, 2].map((w, bIdx) => (
                    <View
                      key={bIdx}
                      style={{
                        width: w * 2,
                        height: 32,
                        backgroundColor: bIdx % 2 === 0 ? '#000000' : 'transparent',
                        marginRight: 1,
                      }}
                    />
                  ))}
                </View>
                <Text style={[styles.thermalText, styles.barcodeLabelText]}>* {rawVal} *</Text>
              </View>
            )}
          </View>
        );
      }

      case 'left_right_text': {
        const isDiscountEntry =
          entry.left?.toLowerCase().includes('discount') ||
          entry.right?.toLowerCase().includes('discount') ||
          entry.left?.includes('{{discount}}') ||
          entry.right?.includes('{{discount}}');

        if (isDiscountEntry && (!totalDiscount || totalDiscount <= 0)) {
          return null;
        }

        return (
          <View key={entry.id || idx} style={[styles.entryBlock, styles.rowBetween]}>
            <Text style={[styles.thermalText, { fontSize: 11, fontWeight: entry.bold ? '800' : '500', color: '#000000' }]}>
              {replaceVars(entry.left)}
            </Text>
            <Text style={[styles.thermalText, { fontSize: 11, fontWeight: entry.bold ? '800' : '500', color: '#000000' }]}>
              {replaceVars(entry.right)}
            </Text>
          </View>
        );
      }

      case 'table': {
        const isAdv = entry.tableType === 'advanced';
        const showTax = entry.showTaxColumn;
        const itemHeader = entry.columnHeaders?.item || 'Item';
        const totalHeader = entry.columnHeaders?.total || 'Total';

        return (
          <View key={entry.id || idx} style={[styles.entryBlock, { marginVertical: 4 }]}>
            {/* Table Header */}
            <View style={[styles.rowBetween, { borderBottomWidth: 1, borderColor: '#000000', borderStyle: 'dashed', paddingBottom: 3, marginBottom: 4 }]}>
              <Text style={[styles.tableColHeader, { flex: 2 }]}>{itemHeader}</Text>
              <Text style={[styles.tableColHeader, { flex: 1.2, textAlign: 'right' }]}>{totalHeader}</Text>
            </View>

            {/* Table Items */}
            {items.map((it, sIdx) => (
              <View key={sIdx} style={{ marginVertical: 2.5 }}>
                <Text style={[styles.thermalText, { fontSize: 11, fontWeight: '700', color: '#000000' }]}>
                  {sIdx + 1}. {it.productName}
                </Text>
                {showTax && it.gstRate ? (
                  <Text style={[styles.thermalText, { fontSize: 9, color: '#333333', marginLeft: 12 }]}>
                    {it.gstRate}% GST
                  </Text>
                ) : null}
                <View style={[styles.rowBetween, { paddingLeft: 12 }]}>
                  <Text style={[styles.thermalText, { fontSize: 10, color: '#222222' }]}>
                    {it.quantity} {it.unit || 'Pc'} x {it.unitPrice.toFixed(2)}
                  </Text>
                  <Text style={[styles.thermalText, { fontSize: 11, fontWeight: '700', color: '#000000' }]}>
                    {it.total.toFixed(2)}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        );
      }

      case 'multi_format': {
        return (
          <View key={entry.id || idx} style={[styles.entryBlock, { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' }]}>
            {(entry.segments || []).map((seg, sIdx) => (
              <Text
                key={sIdx}
                style={[
                  styles.thermalText,
                  {
                    fontSize: 11,
                    fontWeight: seg.bold ? '800' : '500',
                    color: '#000000',
                    marginRight: 4,
                  },
                ]}
              >
                {replaceVars(seg.text)}
              </Text>
            ))}
          </View>
        );
      }

      case 'files_note': {
        return (
          <View key={entry.id || idx} style={[styles.entryBlock, { marginVertical: 4 }]}>
            {entry.title ? (
              <Text style={[styles.thermalText, { fontSize: 10, fontWeight: '800', color: '#000000', marginBottom: 2 }]}>
                {replaceVars(entry.title)}
              </Text>
            ) : null}
            <Text style={[styles.thermalText, { fontSize: 10, color: '#333333', lineHeight: 14 }]}>
              {replaceVars(entry.content)}
            </Text>
          </View>
        );
      }

      default:
        return null;
    }
  };

  const enabledEntries = template.entries.filter((e) => e.enabled);

  return (
    <View style={styles.paperContainer}>
      <View style={[styles.paper, { maxWidth: paperMaxWidth }]}>
        {enabledEntries.length === 0 ? (
          <Text style={{ fontSize: 11, color: '#666666', textAlign: 'center', paddingVertical: 12, fontFamily: 'monospace' }}>
            No active sections in this custom receipt.
          </Text>
        ) : (
          enabledEntries.map((entry, idx) => renderEntry(entry, idx))
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  paperContainer: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  paper: {
    backgroundColor: '#FFFFFF',
    borderRadius: 4,
    paddingHorizontal: 18,
    paddingVertical: 20,
    width: '100%',
    alignSelf: 'center',
    shadowColor: '#000000',
    shadowOpacity: 0.14,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 8,
    elevation: 3,
    borderTopWidth: 3,
    borderTopColor: '#E2E8F0',
    borderBottomWidth: 3,
    borderBottomColor: '#CBD5E1',
  },
  entryBlock: {
    width: '100%',
    marginVertical: 1.5,
    alignSelf: 'center',
  },
  thermalText: {
    fontFamily: 'monospace',
    letterSpacing: -0.2,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  line: {
    width: '100%',
    marginVertical: 3,
  },
  tableColHeader: {
    fontSize: 10,
    fontWeight: '800',
    color: '#000000',
    fontFamily: 'monospace',
  },
  thermalLogoImage: {
    opacity: 0.95,
  },
  imagePlaceholder: {
    borderWidth: 1,
    borderColor: '#94A3B8',
    borderStyle: 'dashed',
    borderRadius: 4,
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
    gap: 4,
  },
  imagePlaceholderText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#000000',
    fontFamily: 'monospace',
  },
  qrWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 4,
  },
  qrContainer: {
    padding: 4,
    backgroundColor: '#FFFFFF',
    borderRadius: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  barcodeWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 4,
  },
  barcodeBarsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  barcodeLabelText: {
    fontSize: 9,
    color: '#333333',
    marginTop: 3,
    textAlign: 'center',
  },
});
