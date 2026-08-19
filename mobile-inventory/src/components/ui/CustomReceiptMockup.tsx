import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { QrCode as QrIcon, Barcode as BarcodeIcon, Image as ImageIcon } from 'lucide-react-native';
import { CustomReceiptTemplate, CustomReceiptEntry } from '@/types/customReceipt';

interface CustomReceiptMockupProps {
  template: CustomReceiptTemplate;
  storeName: string;
  storeAddress?: string;
  storePhone?: string;
  storeGstin?: string;
  invoiceNumber?: string;
  date?: string;
  customerName?: string;
  subtotal?: number;
  totalTax?: number;
  grandTotal?: number;
}

const SAMPLE_ITEMS = [
  { name: 'Cold Brew Coffee', qty: 1, price: 180, total: 180, taxPct: 5 },
  { name: 'Almond Croissant', qty: 2, price: 155, total: 310, taxPct: 5 },
];

export function CustomReceiptMockup({
  template,
  storeName,
  storeAddress = '123 Commercial Street, Suite 4',
  storePhone = '+91 98765 43210',
  storeGstin = '29ABCDE1234F1Z5',
  invoiceNumber = 'INV-1024',
  date = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
  customerName = 'Walk-in Customer',
  subtotal = 490,
  totalTax = 24.5,
  grandTotal = 514.5,
}: CustomReceiptMockupProps) {
  const replaceVars = (str?: string): string => {
    if (!str) return '';
    return str
      .replace(/{{store_name}}/gi, storeName || 'MY STORE')
      .replace(/{{store_address}}/gi, storeAddress)
      .replace(/{{store_phone}}/gi, storePhone)
      .replace(/{{store_gstin}}/gi, storeGstin)
      .replace(/{{invoice_no}}/gi, invoiceNumber)
      .replace(/{{date}}/gi, date)
      .replace(/{{time}}/gi, '14:30')
      .replace(/{{customer_name}}/gi, customerName)
      .replace(/{{grand_total}}/gi, `₹${grandTotal.toFixed(2)}`)
      .replace(/{{subtotal}}/gi, `₹${subtotal.toFixed(2)}`)
      .replace(/{{total_tax}}/gi, `₹${totalTax.toFixed(2)}`)
      .replace(/{{bill_pdf_url}}/gi, `https://seznik.com/b/${invoiceNumber}`)
      .replace(/{{upi_qr}}/gi, `upi://pay?pa=store@upi&pn=${encodeURIComponent(storeName)}&am=${grandTotal.toFixed(2)}`);
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
                  color: '#0F172A',
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
        const fontSize = Math.min(Math.max(entry.fontSizePt || 14, 10), 20);
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
                  color: '#0F172A',
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
          <View key={entry.id || idx} style={[styles.entryBlock, { alignItems: 'center', marginVertical: 4 }]}>
            {entry.imageUri ? (
              <Image
                source={{ uri: entry.imageUri }}
                style={{ width: widthPct, height: 48, resizeMode: 'contain' }}
              />
            ) : (
              <View style={styles.imagePlaceholder}>
                <ImageIcon size={18} color="#64748B" />
                <Text style={styles.imagePlaceholderText}>LOGO ({entry.widthPercent || 40}%)</Text>
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
              <View style={[styles.line, { borderBottomWidth: 1, borderColor: '#334155', marginBottom: 2 }]} />
              <View style={[styles.line, { borderBottomWidth: 1, borderColor: '#334155' }]} />
            </View>
          );
        }
        if (style === 'single') {
          return (
            <View key={entry.id || idx} style={styles.entryBlock}>
              <View style={[styles.line, { borderBottomWidth: 1, borderColor: '#334155' }]} />
            </View>
          );
        }
        if (style === 'dotted') {
          return (
            <View key={entry.id || idx} style={styles.entryBlock}>
              <View style={[styles.line, { borderBottomWidth: 1, borderColor: '#334155', borderStyle: 'dotted' }]} />
            </View>
          );
        }
        return (
          <View key={entry.id || idx} style={styles.entryBlock}>
            <View style={[styles.line, { borderBottomWidth: 1, borderColor: '#475569', borderStyle: 'dashed' }]} />
          </View>
        );
      }

      case 'barcode': {
        const isQr = entry.codeType === 'qr_code' || entry.format === 'qr';
        return (
          <View key={entry.id || idx} style={[styles.entryBlock, { alignItems: 'center', marginVertical: 6 }]}>
            {isQr ? (
              <View style={styles.qrBox}>
                <QrIcon size={34} color="#0F172A" />
                <Text style={styles.barcodeValueText} numberOfLines={1}>
                  {replaceVars(entry.value) || 'Scan to view Bill'}
                </Text>
              </View>
            ) : (
              <View style={styles.barcodeBox}>
                <BarcodeIcon size={42} color="#0F172A" />
                <Text style={styles.barcodeValueText}>{replaceVars(entry.value) || invoiceNumber}</Text>
              </View>
            )}
          </View>
        );
      }

      case 'left_right_text': {
        return (
          <View key={entry.id || idx} style={[styles.entryBlock, styles.rowBetween]}>
            <Text style={[styles.thermalText, { fontSize: 11, fontWeight: entry.bold ? '800' : '600', color: '#1E293B' }]}>
              {replaceVars(entry.left)}
            </Text>
            <Text style={[styles.thermalText, { fontSize: 11, fontWeight: entry.bold ? '800' : '600', color: '#1E293B' }]}>
              {replaceVars(entry.right)}
            </Text>
          </View>
        );
      }

      case 'table': {
        const isAdv = entry.tableType === 'advanced';
        const showTax = entry.showTaxColumn;

        return (
          <View key={entry.id || idx} style={[styles.entryBlock, { marginVertical: 4 }]}>
            {/* Header */}
            <View style={[styles.rowBetween, { borderBottomWidth: 1, borderColor: '#334155', paddingBottom: 2, marginBottom: 4 }]}>
              <Text style={[styles.tableColHeader, { flex: 2 }]}>ITEM</Text>
              <Text style={[styles.tableColHeader, { flex: 1, textAlign: 'center' }]}>QTY</Text>
              {showTax ? <Text style={[styles.tableColHeader, { flex: 1, textAlign: 'center' }]}>TAX</Text> : null}
              <Text style={[styles.tableColHeader, { flex: 1.2, textAlign: 'right' }]}>AMT (₹)</Text>
            </View>

            {/* Items */}
            {SAMPLE_ITEMS.map((it, sIdx) => (
              <View key={sIdx} style={[styles.rowBetween, { paddingVertical: 2 }]}>
                <View style={{ flex: 2 }}>
                  <Text style={[styles.thermalText, { fontSize: 11, fontWeight: '700', color: '#0F172A' }]}>
                    {it.name}
                  </Text>
                  {isAdv ? (
                    <Text style={{ fontSize: 9, color: '#64748B' }}>
                      Rate: ₹{it.price}
                    </Text>
                  ) : null}
                </View>
                <Text style={[styles.thermalText, { flex: 1, textAlign: 'center', fontSize: 11, color: '#334155' }]}>
                  {it.qty}
                </Text>
                {showTax ? (
                  <Text style={[styles.thermalText, { flex: 1, textAlign: 'center', fontSize: 10, color: '#64748B' }]}>
                    {it.taxPct}%
                  </Text>
                ) : null}
                <Text style={[styles.thermalText, { flex: 1.2, textAlign: 'right', fontSize: 11, fontWeight: '700', color: '#0F172A' }]}>
                  {it.total.toFixed(2)}
                </Text>
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
                    color: '#0F172A',
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
          <View key={entry.id || idx} style={[styles.entryBlock, styles.noteContainer]}>
            {entry.title ? (
              <Text style={[styles.thermalText, { fontSize: 10, fontWeight: '800', color: '#334155', marginBottom: 2 }]}>
                {replaceVars(entry.title)}
              </Text>
            ) : null}
            <Text style={[styles.thermalText, { fontSize: 10, color: '#475569', lineHeight: 14 }]}>
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
      <View style={styles.paper}>
        {enabledEntries.length === 0 ? (
          <Text style={{ fontSize: 11, color: '#94A3B8', textAlign: 'center', paddingVertical: 12 }}>
            No active blocks in this custom receipt.
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
  },
  paper: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    width: '100%',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  entryBlock: {
    width: '100%',
    marginVertical: 2,
  },
  thermalText: {
    fontFamily: 'monospace',
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  line: {
    width: '100%',
    marginVertical: 4,
  },
  tableColHeader: {
    fontSize: 10,
    fontWeight: '900',
    color: '#0F172A',
    fontFamily: 'monospace',
  },
  imagePlaceholder: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderStyle: 'dashed',
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
    gap: 4,
  },
  imagePlaceholderText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    fontFamily: 'monospace',
  },
  qrBox: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 6,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    width: 140,
  },
  barcodeBox: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
  },
  barcodeValueText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#334155',
    fontFamily: 'monospace',
    marginTop: 4,
    textAlign: 'center',
  },
  noteContainer: {
    backgroundColor: '#F8FAFC',
    borderRadius: 6,
    padding: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginVertical: 4,
  },
});
