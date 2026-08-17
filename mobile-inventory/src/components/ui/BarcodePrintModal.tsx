import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  useColorScheme,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { X, QrCode, Barcode, Printer, Download, Share2, Sparkles, Check, FileText } from 'lucide-react-native';
import QRCodeSVG from 'react-native-qrcode-svg';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { Product } from '@/types/product';
import ThermalPrinterService from '@/services/PrinterService';
import { usePrinterStore } from '@/store/usePrinterStore';
import { BRAND_COLORS } from '@/constants/theme';
import { generateCode128Barcode, generateEAN13Barcode } from '@/utils/barcodeGenerator';

interface BarcodePrintModalProps {
  visible: boolean;
  product: Product | null;
  storeName?: string;
  onClose: () => void;
}

export type BarcodeFormat = 'qr' | 'code128' | 'ean13';

export const BarcodePrintModal: React.FC<BarcodePrintModalProps> = ({
  visible,
  product,
  storeName = 'SEZNIK POS',
  onClose,
}) => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { activeDevice, connectionState, paperWidth, labelPaperMode, labelWidthMm, labelHeightMm, labelGapMm, labelTemplates, activeLabelTemplateId } = usePrinterStore();
  const activeLabelTemplate = labelTemplates.find((t) => t.id === activeLabelTemplateId) || null;

  const [selectedFormat, setSelectedFormat] = useState<BarcodeFormat>('qr');
  const [isPrinting, setIsPrinting] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  if (!product) return null;

  const rawCode = product.barcode || product.sku || `PROD-${product.id.slice(-6)}`;
  const formattedCode128 = generateCode128Barcode(rawCode);
  const formattedEAN13 = generateEAN13Barcode(rawCode);

  const handlePrintLabel = async () => {
    setIsPrinting(true);
    try {
      // Priority: a saved Label Studio template (real user-designed layout, bound to this
      // product's real data) always wins when one's active — which native pipeline it goes through
      // depends on labelPaperMode: TSPL for 'gap' (die-cut label printer), ESC/POS sequential
      // rendering for 'continuous' (receipt roll) — sending TSPL commands to the receipt printer is
      // exactly what printed as gibberish text before printLabelTemplateOnReceiptPaper existed.
      // With no active template, each mode falls back to its own auto-layout.
      let ok: boolean;
      let modeLabel: string;
      if (labelPaperMode === 'gap' && activeLabelTemplate) {
        ok = await ThermalPrinterService.printLabelFromTemplate(product, activeLabelTemplate);
        modeLabel = `"${activeLabelTemplate.name}" template`;
      } else if (labelPaperMode === 'continuous' && activeLabelTemplate) {
        ok = await ThermalPrinterService.printLabelTemplateOnReceiptPaper(product, activeLabelTemplate, paperWidth);
        modeLabel = `"${activeLabelTemplate.name}" template (receipt roll)`;
      } else if (labelPaperMode === 'continuous') {
        // No active template — real ESC/POS barcode/QR auto-layout on the receipt roll (see
        // PrinterService.printLabelOnReceiptPaper's doc comment for why the old HTML fallback
        // rendered unreadable text instead of a real barcode).
        ok = await ThermalPrinterService.printLabelOnReceiptPaper(product, selectedFormat, paperWidth);
        modeLabel = 'the receipt roll';
      } else {
        ok = await ThermalPrinterService.printCustomLabel(product, selectedFormat, undefined, labelWidthMm, labelHeightMm, labelGapMm);
        modeLabel = 'the TSPL label printer';
      }
      if (ok) {
        Alert.alert('Label Sent', `Printed via ${modeLabel} (${activeDevice?.name || 'connected printer'}).`);
      } else {
        Alert.alert('Print Error', 'Could not send label to printer.');
      }
    } catch (e: any) {
      Alert.alert('Print Error', e?.message || 'Failed to print label.');
    } finally {
      setIsPrinting(false);
    }
  };

  const handleDownloadPNG = async () => {
    setIsDownloading(true);
    try {
      const filename = `barcode_${product.name.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.txt`;
      const baseDir = (FileSystem as any).documentDirectory || (FileSystem as any).cacheDirectory || '';
      const fileUri = `${baseDir}${filename}`;
      const content = `Product: ${product.name}\nPrice: ₹${product.sellingPrice}\nCode (${selectedFormat.toUpperCase()}): ${rawCode}\nStore: ${storeName}`;

      await FileSystem.writeAsStringAsync(fileUri, content, { encoding: FileSystem.EncodingType.UTF8 });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'text/plain',
          dialogTitle: `Download/Share ${selectedFormat.toUpperCase()} for ${product.name}`,
        });
      } else {
        Alert.alert('Saved', `Barcode data saved to ${filename}`);
      }
    } catch (e: any) {
      Alert.alert('Export Error', 'Could not export barcode label file.');
    } finally {
      setIsDownloading(false);
    }
  };

  const theme = isDark
    ? { bg: BRAND_COLORS.slate900, cardBg: BRAND_COLORS.slate800, borderColor: BRAND_COLORS.slate700, textPrimary: '#F8FAFC', textSecondary: '#94A3B8' }
    : { bg: '#FFFFFF', cardBg: BRAND_COLORS.slate50, borderColor: BRAND_COLORS.slate200, textPrimary: '#0F172A', textSecondary: '#64748B' };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.modalCard, { backgroundColor: theme.bg, borderColor: theme.borderColor }]}>
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Barcode size={20} color={BRAND_COLORS.blue600} style={{ marginRight: 8 }} />
              <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>Custom Barcode & QR Label</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={18} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Product Summary */}
          <Text style={[styles.productName, { color: theme.textPrimary }]}>{product.name}</Text>
          <Text style={[styles.productSub, { color: theme.textSecondary }]}>
            Price: ₹{product.sellingPrice.toFixed(2)} • Code: {rawCode}
          </Text>

          {/* Format Selector Tabs */}
          <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>SELECT BARCODE FORMAT</Text>
          <View style={[styles.formatBar, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
            <TouchableOpacity
              onPress={() => setSelectedFormat('qr')}
              style={[styles.formatTab, selectedFormat === 'qr' && styles.formatTabActive]}
            >
              <QrCode size={14} color={selectedFormat === 'qr' ? '#FFF' : theme.textSecondary} />
              <Text style={[styles.formatTabText, selectedFormat === 'qr' && styles.formatTabTextActive]}>QR Code</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setSelectedFormat('code128')}
              style={[styles.formatTab, selectedFormat === 'code128' && styles.formatTabActive]}
            >
              <Barcode size={14} color={selectedFormat === 'code128' ? '#FFF' : theme.textSecondary} />
              <Text style={[styles.formatTabText, selectedFormat === 'code128' && styles.formatTabTextActive]}>Code128</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setSelectedFormat('ean13')}
              style={[styles.formatTab, selectedFormat === 'ean13' && styles.formatTabActive]}
            >
              <Barcode size={14} color={selectedFormat === 'ean13' ? '#FFF' : theme.textSecondary} />
              <Text style={[styles.formatTabText, selectedFormat === 'ean13' && styles.formatTabTextActive]}>EAN-13</Text>
            </TouchableOpacity>
          </View>

          {/* Live Preview Card */}
          <View style={styles.previewContainer}>
            <View style={styles.labelCard}>
              <Text style={styles.labelStoreHeader}>{storeName.toUpperCase()}</Text>
              <Text style={styles.labelTitle} numberOfLines={1}>
                {product.name}
              </Text>
              <Text style={styles.labelPrice}>₹{product.sellingPrice.toFixed(2)}</Text>

              {/* Graphic Preview */}
              <View style={styles.graphicBox}>
                {selectedFormat === 'qr' ? (
                  <QRCodeSVG value={rawCode} size={78} color="#000000" backgroundColor="#FFFFFF" />
                ) : selectedFormat === 'code128' ? (
                  <View style={styles.barcodeVisualBox}>
                    <Text style={styles.barcodeLinesText}>{formattedCode128}</Text>
                  </View>
                ) : (
                  <View style={styles.barcodeVisualBox}>
                    <Text style={styles.barcodeLinesText}>{formattedEAN13}</Text>
                  </View>
                )}
              </View>

              <Text style={styles.codeSubtitle}>*{rawCode}*</Text>
            </View>
          </View>

          {/* Connected Printer Status Pill */}
          <View style={[styles.printerStatusPill, { backgroundColor: activeDevice ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)' }]}>
            <Printer size={14} color={activeDevice ? '#10B981' : '#EF4444'} />
            <Text style={[styles.printerStatusText, { color: activeDevice ? '#10B981' : '#EF4444' }]}>
              {activeDevice ? `Printer: ${activeDevice.name} (${paperWidth})` : 'No Bluetooth Printer Connected'}
            </Text>
          </View>

          {/* Action Buttons Row */}
          <View style={styles.actionRow}>
            <TouchableOpacity onPress={handleDownloadPNG} disabled={isDownloading} style={[styles.actionBtn, { backgroundColor: theme.cardBg, borderColor: theme.borderColor, borderWidth: 1 }]}>
              {isDownloading ? (
                <ActivityIndicator size="small" color={theme.textPrimary} />
              ) : (
                <>
                  <Download size={16} color={theme.textPrimary} />
                  <Text style={[styles.actionBtnText, { color: theme.textPrimary }]}>Export Label</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity onPress={handlePrintLabel} disabled={isPrinting} style={[styles.actionBtn, { backgroundColor: BRAND_COLORS.blue600 }]}>
              {isPrinting ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <>
                  <Printer size={16} color="#FFF" />
                  <Text style={[styles.actionBtnText, { color: '#FFF' }]}>
                    {activeLabelTemplate
                      ? `Print "${activeLabelTemplate.name}"`
                      : labelPaperMode === 'continuous'
                        ? 'Print on Receipt Roll'
                        : 'Print TSPL Label'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.65)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  modalCard: { width: '100%', maxWidth: 440, borderRadius: 24, padding: 20, borderWidth: 1 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  modalTitle: { fontSize: 16, fontWeight: '900' },
  closeBtn: { padding: 4 },
  productName: { fontSize: 18, fontWeight: '900', marginTop: 4 },
  productSub: { fontSize: 12, marginTop: 2, marginBottom: 14 },
  sectionLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5, marginBottom: 6 },
  formatBar: { flexDirection: 'row', padding: 4, borderRadius: 14, borderWidth: 1, marginBottom: 16 },
  formatTab: { flex: 1, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  formatTabActive: { backgroundColor: BRAND_COLORS.blue600 },
  formatTabText: { fontSize: 11, fontWeight: '700', marginLeft: 6 },
  formatTabTextActive: { color: '#FFFFFF' },
  previewContainer: { alignItems: 'center', marginVertical: 8 },
  labelCard: { width: 220, backgroundColor: '#FFFFFF', borderRadius: 14, padding: 12, alignItems: 'center', borderWidth: 2, borderColor: '#0F172A', shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 10, elevation: 4 },
  labelStoreHeader: { fontSize: 9, fontWeight: '900', color: '#0F172A', letterSpacing: 1, marginBottom: 2 },
  labelTitle: { fontSize: 12, fontWeight: '900', color: '#0F172A', textAlign: 'center', width: '100%' },
  labelPrice: { fontSize: 16, fontWeight: '900', color: '#2563EB', marginVertical: 4 },
  graphicBox: { height: 94, justifyContent: 'center', alignItems: 'center', marginVertical: 4 },
  barcodeVisualBox: { width: 165, backgroundColor: '#F8FAFC', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0', alignItems: 'center' },
  barcodeLinesText: { fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', fontSize: 13, letterSpacing: 2, color: '#0F172A', fontWeight: 'bold' },
  codeSubtitle: { fontSize: 9, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', color: '#64748B', marginTop: 4 },
  printerStatusPill: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 12, marginVertical: 12 },
  printerStatusText: { fontSize: 11, fontWeight: '800', marginLeft: 6 },
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 14 },
  actionBtnText: { fontSize: 13, fontWeight: '800', marginLeft: 6 },
});
