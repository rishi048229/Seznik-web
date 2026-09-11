import React from 'react';
import { View, Text, StyleSheet, Image, Platform } from 'react-native';
import QRCodeSVG from 'react-native-qrcode-svg';
import { Image as ImageIcon } from 'lucide-react-native';
import { CustomReceiptTemplate, CustomReceiptEntry } from '@/types/customReceipt';
import { buildBillPdfUrl, buildUpiPayString } from '@/utils/billQrService';
import {
  enrichCustomReceiptEntries,
  isDiscountReceiptEntry,
  isTaxReceiptEntry,
  shouldShowItemDiscount,
} from '@/utils/receiptDiscount';
import {
  RECEIPT_LOGO_DEFAULT_WIDTH_PERCENT,
  receiptQrPreviewPx,
  receiptLogoHtmlMaxPxFromChip,
  receiptStandardQrHtmlPxFromChip,
  type ReceiptSizeChip,
  wrapReceiptWords,
} from '@shared/receiptPrintGeometry';
import { resolveReceiptImageSrc } from '@/utils/receiptLogo';
import { ThermalReceiptLogoImage } from './ThermalReceiptLogoImage';

interface CustomReceiptMockupProps {
  template: CustomReceiptTemplate;
  storeName: string;
  storeAddress?: string;
  storePhone?: string;
  storeGstin?: string;
  storeLogoUrl?: string;
  invoiceNumber?: string;
  date?: string;
  time?: string;
  customerName?: string;
  customerPhone?: string;
  items?: { productName: string; quantity: number; unitPrice: number; total: number; unit?: string; gstRate?: number; discount?: number }[];
  subtotal?: number;
  totalDiscount?: number;
  totalTax?: number;
  grandTotal?: number;
  amountPaid?: number;
  changeReturned?: number;
  paymentMethod?: string;
  upiId?: string;
  footerMessage?: string;
  paperWidth?: '58mm' | '80mm';
  logoSizeChip?: ReceiptSizeChip;
  qrSizeChip?: ReceiptSizeChip;
}

export function CustomReceiptMockup({
  template,
  storeName,
  storeAddress,
  storePhone,
  storeGstin,
  storeLogoUrl,
  invoiceNumber,
  date,
  time,
  customerName,
  customerPhone,
  items = [],
  subtotal = 0,
  totalDiscount = 0,
  totalTax = 0,
  grandTotal = 0,
  amountPaid = 0,
  changeReturned = 0,
  paymentMethod = 'CASH',
  upiId,
  footerMessage,
  paperWidth = '58mm',
  logoSizeChip = 'medium',
  qrSizeChip = 'medium',
}: CustomReceiptMockupProps) {
  const activePaperWidth = paperWidth || template.paperWidth || '58mm';
  const is80mm = activePaperWidth === '80mm';
  const paperMaxWidth = is80mm ? 360 : 280;
  const cols = is80mm ? 48 : 32;

  const sampleBillPdfUrl = buildBillPdfUrl({ invoiceNumber: invoiceNumber || 'INV-2026-0042' });
  const sampleUpiStr = upiId ? buildUpiPayString(upiId, storeName || 'Store', grandTotal, invoiceNumber) : '';

  const replaceVars = (str?: string): string => {
    if (!str) return '';
    const phoneVal = (storePhone || '').trim();
    const gstinVal = (storeGstin || '').trim();
    const rawCustName = (customerName || 'Walk-in Customer').trim();
    const isWalkIn = !customerName || /walk[- ]*in/i.test(customerName);
    const custNameVal = isWalkIn ? 'Walk-in Customer' : rawCustName;
    const custLabelVal = isWalkIn ? 'Walk-in' : rawCustName;
    const custPhoneVal = (customerPhone || '').trim();
    const storeNameVal = (storeName || '').trim();
    const storeAddrVal = (storeAddress || '').trim();

    return str
      .replace(/(?:Phone|Ph|Tel)?:\s*\{\{store_phone\}\}/gi, phoneVal ? `Phone: ${phoneVal}` : '')
      .replace(/GST(?:IN)?:\s*\{\{store_gstin\}\}/gi, gstinVal ? `GSTIN: ${gstinVal}` : '')
      .replace(/(?:Customer|Cust)?:\s*\{\{customer_name\}\}/gi, `Customer: ${custLabelVal}`)
      .replace(/(?:Phone|Ph|Tel)?:\s*\{\{customer_phone\}\}/gi, custPhoneVal ? `Phone: ${custPhoneVal}` : '')
      .replace(/\{\{store_name\}\}/gi, storeNameVal)
      .replace(/\{\{store_address\}\}/gi, storeAddrVal)
      .replace(/\{\{store_phone\}\}/gi, phoneVal)
      .replace(/\{\{store_gstin\}\}/gi, gstinVal)
      .replace(/\{\{invoice_no\}\}/gi, invoiceNumber || '')
      .replace(/\{\{date\}\}/gi, date || '')
      .replace(/\{\{time\}\}/gi, time || '')
      .replace(/\{\{customer_name\}\}/gi, custNameVal)
      .replace(/\{\{customer_phone\}\}/gi, custPhoneVal)
      .replace(/\{\{grand_total\}\}/gi, `₹${grandTotal.toFixed(2)}`)
      .replace(/\{\{subtotal\}\}/gi, `₹${subtotal.toFixed(2)}`)
      .replace(/\{\{tax\}\}/gi, `₹${totalTax.toFixed(2)}`)
      .replace(/\{\{total_tax\}\}/gi, `₹${totalTax.toFixed(2)}`)
      .replace(/\{\{discount\}\}/gi, `₹${totalDiscount.toFixed(2)}`)
      .replace(/\{\{paid_amount\}\}/gi, `₹${amountPaid.toFixed(2)}`)
      .replace(/\{\{change_returned\}\}/gi, `₹${changeReturned.toFixed(2)}`)
      .replace(/\{\{payment_method\}\}/gi, paymentMethod || '')
      .replace(/\{\{bill_pdf_url\}\}/gi, sampleBillPdfUrl)
      .replace(/\{\{upi_qr\}\}/gi, sampleUpiStr)
      .replace(/\{\{footer_message\}\}/gi, (footerMessage || '').trim());
  };

  const renderEntry = (entry: CustomReceiptEntry, idx: number) => {
    switch (entry.type) {
      case 'text': {
        const align = entry.align || 'left';
        const fontSize = entry.size === 'large' ? 14 : entry.size === 'small' ? 9.5 : 11;
        const rawText = replaceVars(entry.text);
        const effectiveCols = entry.size === 'large' ? Math.floor(cols / 2) : cols;
        const wrappedLines = wrapReceiptWords(rawText, effectiveCols);
        if (!wrappedLines.length) return null;
        return (
          <View key={entry.id || idx} style={styles.entryBlock}>
            {wrappedLines.map((line, lIdx) => (
              <Text
                key={lIdx}
                style={[
                  styles.thermalText,
                  {
                    textAlign: align,
                    fontSize,
                    fontWeight: entry.bold ? '800' : '500',
                    fontStyle: (entry as any).italic ? 'italic' : 'normal',
                    textDecorationLine: (entry as any).underline ? 'underline' : 'none',
                    color: '#000000',
                    lineHeight: fontSize + 4,
                  },
                ]}
              >
                {line || ' '}
              </Text>
            ))}
          </View>
        );
      }

      case 'text_special': {
        const align = entry.align || 'center';
        const fontSize = Math.min(Math.max(entry.fontSizePt || 14, 10), 22);
        const rawText = replaceVars(entry.text);
        const effectiveCols = Math.floor(cols / 2);
        const wrappedLines = wrapReceiptWords(rawText, effectiveCols);
        if (!wrappedLines.length) return null;
        return (
          <View key={entry.id || idx} style={styles.entryBlock}>
            {wrappedLines.map((line, lIdx) => (
              <Text
                key={lIdx}
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
                {line || ' '}
              </Text>
            ))}
          </View>
        );
      }

      case 'image': {
        const logoSrc = resolveReceiptImageSrc(entry, storeLogoUrl);
        const widthPct = `${Math.min(entry.widthPercent || RECEIPT_LOGO_DEFAULT_WIDTH_PERCENT, 100)}%` as any;
        const logoDim = receiptLogoHtmlMaxPxFromChip(logoSizeChip);
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
            {logoSrc ? (
              <ThermalReceiptLogoImage
                uri={logoSrc}
                paperWidth={activePaperWidth}
                widthPercent={entry.widthPercent || RECEIPT_LOGO_DEFAULT_WIDTH_PERCENT}
                logoSizeChip={logoSizeChip}
                style={styles.thermalLogoImage}
                maxWidth={logoDim.maxWidth}
                width={widthPct}
                maxHeight={logoDim.maxHeight}
                height={logoDim.maxHeight}
              />
            ) : (
              <View style={styles.imagePlaceholder}>
                <ImageIcon size={18} color="#000000" />
                <Text style={styles.imagePlaceholderText}>STORE LOGO ({entry.widthPercent || RECEIPT_LOGO_DEFAULT_WIDTH_PERCENT}%)</Text>
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
        const isUpi = entry.qrType === 'upi' || entry.value?.includes('{{upi_qr}}') || Boolean(entry.upiId);
        let rawVal = replaceVars(entry.value);
        if (isUpi) {
          const merchantUpi = entry.upiId || upiId || 'store@upi';
          rawVal = buildUpiPayString(merchantUpi, storeName || 'Store', grandTotal, invoiceNumber);
        } else if (!rawVal || rawVal === '{{bill_pdf_url}}' || entry.qrType === 'digital_bill') {
          rawVal = sampleBillPdfUrl;
        } else if (rawVal === '{{invoice_no}}' || entry.qrType === 'invoice_barcode') {
          rawVal = invoiceNumber || 'INV-2026-0042';
        }

        const qrSize =
          isUpi || entry.qrType === 'digital_bill' || !entry.size
            ? receiptStandardQrHtmlPxFromChip(qrSizeChip)
            : receiptQrPreviewPx(entry.size === 'large' || entry.size === 'small' ? entry.size : 'medium');

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
                {isUpi ? (
                  <Text style={{ fontSize: 9, fontWeight: '800', textAlign: 'center', marginBottom: 3, letterSpacing: 0.5, color: '#000000' }}>
                    SCAN TO PAY VIA UPI
                  </Text>
                ) : null}
                <View style={styles.qrContainer}>
                  <QRCodeSVG
                    value={rawVal || sampleBillPdfUrl}
                    size={qrSize}
                    color="#000000"
                    backgroundColor="#FFFFFF"
                    ecl="M"
                    quietZone={6}
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
        // Skip scan-to-pay rows — barcode block renders "SCAN TO PAY VIA UPI" header directly above QR
        if (/scan/i.test(String(entry.left || '') + String(entry.right || ''))) {
          return null;
        }
        if (isDiscountReceiptEntry(entry) && (!totalDiscount || totalDiscount <= 0)) {
          return null;
        }
        if (isTaxReceiptEntry(entry) && (!totalTax || totalTax <= 0)) {
          return null;
        }

        return (
          <View key={entry.id || idx} style={[styles.entryBlock, styles.rowBetween]}>
            <Text style={[styles.thermalText, { fontSize: 11, fontWeight: entry.bold ? '800' : '500', color: isDiscountReceiptEntry(entry) ? '#10B981' : '#000000' }]}>
              {replaceVars(entry.left)}
            </Text>
            <Text style={[styles.thermalText, { fontSize: 11, fontWeight: entry.bold ? '800' : '500', color: isDiscountReceiptEntry(entry) ? '#10B981' : '#000000' }]}>
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
            {items.map((it, sIdx) => {
              const fullName = `${sIdx + 1}. ${it.productName}`;
              const nameLines = wrapReceiptWords(fullName, cols);
              return (
                <View key={sIdx} style={{ marginVertical: 2.5 }}>
                  {nameLines.map((line, nlIdx) => (
                    <Text key={nlIdx} style={[styles.thermalText, { fontSize: 11, fontWeight: '700', color: '#000000', lineHeight: 15 }]}>
                      {line}
                    </Text>
                  ))}
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
                {shouldShowItemDiscount(it.discount) ? (
                  <Text style={[styles.thermalText, { fontSize: 9, color: '#10B981', marginLeft: 12, fontWeight: '700' }]}>
                    Discount: -₹{it.discount!.toFixed(2)}
                  </Text>
                ) : null}
              </View>
            );
          })}
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

  const enabledEntries = enrichCustomReceiptEntries(
    template.entries.filter((e) => e.enabled),
    totalDiscount
  );
  const hasImageEntry = enabledEntries.some((entry) => entry.type === 'image');

  return (
    <View style={styles.paperContainer}>
      <View style={[styles.paper, { maxWidth: paperMaxWidth }]}>
        {!hasImageEntry && storeLogoUrl ? (
          <View style={[styles.entryBlock, { alignItems: 'center', marginVertical: 4 }]}>
            <Image source={{ uri: storeLogoUrl }} style={[styles.thermalLogoImage, { maxWidth: 180, width: '40%', maxHeight: 56, height: 56 }]} resizeMode="contain" />
          </View>
        ) : null}
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
