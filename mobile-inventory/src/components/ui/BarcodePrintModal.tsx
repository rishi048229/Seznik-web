import React, { useState, useRef } from 'react';
import { templateHasPrintableContent } from '@/types/labelTemplate';
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
  ScrollView,
} from 'react-native';
import { X, QrCode, Barcode, Printer, Download, Share2, Sparkles, Check, FileText, Plus, Minus, AlertTriangle } from 'lucide-react-native';
import QRCodeSVG from 'react-native-qrcode-svg';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { Product } from '@/types/product';
import ThermalPrinterService from '@/services/PrinterService';
import { usePrinterStore } from '@/store/usePrinterStore';
import { useLabelPrinterStatus } from '@/hooks/useLabelPrinterStatus';
import { useJoshDualModeTip } from '@/hooks/useJoshDualModeTip';
import { JoshDualModeModal } from '@/components/printers/JoshDualModeModal';
import { LABEL_SIZE_PRESETS } from '@/constants/labelSizePresets';
import { LABEL_PRESETS, LabelPresetId, buildLabelPreset } from '@/constants/labelTemplatePresets';
import { BRAND_COLORS } from '@/constants/theme';
import { generateCode128Barcode, generateEAN13Barcode } from '@/utils/barcodeGenerator';
import { SequencePrintPrompt } from '@/components/label-studio/SequencePrintPrompt';

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
  const labelPrinter = useLabelPrinterStatus();
  const activeLabelTemplate = labelTemplates.find((t) => t.id === activeLabelTemplateId) || null;

  const [selectedFormat, setSelectedFormat] = useState<BarcodeFormat>('qr');
  const [printMode, setPrintMode] = useState<'direct' | 'template'>('direct');
  // Size and layout are picked here rather than only on the Printers screen,
  // because the roll and the sticker design change per print run, not per device.
  const [sizeW, setSizeW] = useState(labelWidthMm);
  const [sizeH, setSizeH] = useState(labelHeightMm);
  const [presetId, setPresetId] = useState<LabelPresetId | null>(null);
  const [isPrinting, setIsPrinting] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [showSequencePrompt, setShowSequencePrompt] = useState(false);
  const [seqProgress, setSeqProgress] = useState(0);
  const [printCopies, setPrintCopies] = useState(1);
  const [showTipModal, setShowTipModal] = useState(false);
  const { shouldShowTip, markTipShown, dismissPermanently } = useJoshDualModeTip();

  React.useEffect(() => {
    if (visible && labelPrinter.isConnected && labelPrinter.kind === 'label' && shouldShowTip) {
      setShowTipModal(true);
    }
  }, [visible, labelPrinter.isConnected, labelPrinter.kind, shouldShowTip]);

  const usableTemplate = templateHasPrintableContent(activeLabelTemplate) ? activeLabelTemplate : null;
  const hasSequenceElement =
    printMode === 'template' && (usableTemplate?.elements.some((el) => el.type === 'text' && el.binding === 'sequence') ?? false);

  if (!product) return null;

  const rawCode = product.barcode || product.sku || `PROD-${product.id.slice(-6)}`;
  const formattedCode128 = generateCode128Barcode(rawCode);
  const formattedEAN13 = generateEAN13Barcode(rawCode);

  const handlePrintLabel = async () => {
    setIsPrinting(true);
    try {
      let ok: boolean;
      let modeLabel: string;
      const copies = Math.max(1, printCopies);

      const isJosh = await ThermalPrinterService.joshIsConnected();

      if (presetId) {
        const preset = buildLabelPreset(presetId, sizeW, sizeH, storeName);
        ok = await ThermalPrinterService.printLabelFromTemplate(product, preset, copies, labelGapMm);
        modeLabel = isJosh ? `${preset.name} (Josh — ${sizeW}x${sizeH}mm)` : `${preset.name} — ${sizeW}x${sizeH}mm`;
      } else if (printMode === 'template' && usableTemplate) {
        if (labelPaperMode === 'continuous' && !isJosh) {
          ok = await ThermalPrinterService.printLabelTemplateOnReceiptPaper(product, usableTemplate, paperWidth, copies);
          modeLabel = `"${usableTemplate.name}" template (receipt roll)`;
        } else {
          ok = await ThermalPrinterService.printLabelFromTemplate(product, usableTemplate, copies, labelGapMm);
          modeLabel = isJosh
            ? `"${usableTemplate.name}" template (Josh Label)`
            : `"${usableTemplate.name}" template (TSPL Label)`;
        }
      } else {
        // Direct Product Barcode/QR Print
        if (labelPaperMode === 'continuous' && !isJosh) {
          ok = await ThermalPrinterService.printLabelOnReceiptPaper(product, selectedFormat, paperWidth, copies);
          modeLabel = `Receipt Roll (${selectedFormat.toUpperCase()})`;
        } else {
          ok = await ThermalPrinterService.printCustomLabel(
            product,
            selectedFormat,
            undefined,
            sizeW,
            sizeH,
            labelGapMm,
            copies
          );
          modeLabel = isJosh
            ? `Josh Label Printer (${selectedFormat.toUpperCase()})`
            : `Label Printer (${selectedFormat.toUpperCase()})`;
        }
      }

      if (ok) {
        Alert.alert('Labels Sent!', `Printed ${copies} label${copies > 1 ? 's' : ''} via ${modeLabel}.`);
      } else {
        Alert.alert('Print Error', 'Could not send label to printer.');
      }
    } catch (e: any) {
      Alert.alert('Print Error', e?.message || 'Failed to print label.');
    } finally {
      setIsPrinting(false);
    }
  };

  const handleSubmitSequence = async (startPattern: string, count: number) => {
    if (!activeLabelTemplate) return;
    setIsPrinting(true);
    setSeqProgress(0);
    try {
      const result = await ThermalPrinterService.printLabelSequence(
        product,
        activeLabelTemplate,
        { startPattern, count, mode: labelPaperMode, paperWidth, labelGapMm },
        (done) => setSeqProgress(done)
      );
      if (result.ok) {
        setShowSequencePrompt(false);
        Alert.alert('Sequence Printed', `Printed ${result.printedCount} labels starting from "${startPattern}".`);
      } else if (result.printedCount === 0) {
        Alert.alert('Invalid Pattern', 'The starting pattern must include at least one number to increment (e.g. "0001" or "A01").');
      } else {
        Alert.alert('Print Failed', `Stopped after ${result.printedCount} labels — could not reach the printer.`);
      }
    } catch (e: any) {
      Alert.alert('Print Failed', e?.message || 'Could not print the sequence.');
    } finally {
      setIsPrinting(false);
      setSeqProgress(0);
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
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity
          activeOpacity={1}
          style={[styles.modalCard, { backgroundColor: theme.bg, borderColor: theme.borderColor }]}
        >
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8 }}>
              <Barcode size={20} color={BRAND_COLORS.blue600} style={{ marginRight: 8 }} />
              <Text style={[styles.modalTitle, { color: theme.textPrimary }]} numberOfLines={1}>Custom Barcode & QR Label</Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeBtn}
              hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
              activeOpacity={0.6}
            >
              <X size={20} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollBody} showsVerticalScrollIndicator={false}>
            {/* Product Summary */}
            <Text style={[styles.productName, { color: theme.textPrimary }]}>{product.name}</Text>
            <Text style={[styles.productSub, { color: theme.textSecondary }]}>
              Price: ₹{product.sellingPrice.toFixed(2)} • Code: {rawCode}
            </Text>

            {/* Format Selector Tabs */}
            <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>SELECT BARCODE FORMAT</Text>
            <View style={[styles.formatBar, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
              <TouchableOpacity
                onPress={() => {
                  setSelectedFormat('qr');
                  setPrintMode('direct');
                }}
                style={[styles.formatTab, printMode === 'direct' && selectedFormat === 'qr' && styles.formatTabActive]}
              >
                <QrCode size={14} color={printMode === 'direct' && selectedFormat === 'qr' ? '#FFF' : theme.textSecondary} />
                <Text style={[styles.formatTabText, printMode === 'direct' && selectedFormat === 'qr' && styles.formatTabTextActive]}>QR Code</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  setSelectedFormat('code128');
                  setPrintMode('direct');
                }}
                style={[styles.formatTab, printMode === 'direct' && selectedFormat === 'code128' && styles.formatTabActive]}
              >
                <Barcode size={14} color={printMode === 'direct' && selectedFormat === 'code128' ? '#FFF' : theme.textSecondary} />
                <Text style={[styles.formatTabText, printMode === 'direct' && selectedFormat === 'code128' && styles.formatTabTextActive]}>Code128</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  setSelectedFormat('ean13');
                  setPrintMode('direct');
                }}
                style={[styles.formatTab, printMode === 'direct' && selectedFormat === 'ean13' && styles.formatTabActive]}
              >
                <Barcode size={14} color={printMode === 'direct' && selectedFormat === 'ean13' ? '#FFF' : theme.textSecondary} />
                <Text style={[styles.formatTabText, printMode === 'direct' && selectedFormat === 'ean13' && styles.formatTabTextActive]}>EAN-13</Text>
              </TouchableOpacity>
            </View>

            {/* Label size — the roll changes between print runs, so it is chosen here
                rather than only in printer settings. */}
            <Text style={[styles.pickerLabel, { color: theme.textSecondary }]}>LABEL SIZE</Text>
            <View style={styles.pickerRow}>
              {LABEL_SIZE_PRESETS.map((sz) => {
                const on = sizeW === sz.widthMm && sizeH === sz.heightMm;
                return (
                  <TouchableOpacity
                    key={sz.label}
                    onPress={() => {
                      setSizeW(sz.widthMm);
                      setSizeH(sz.heightMm);
                    }}
                    style={[
                      styles.pickerChip,
                      { borderColor: on ? BRAND_COLORS.blue600 : theme.borderColor, backgroundColor: on ? BRAND_COLORS.blue600 : theme.cardBg },
                    ]}
                  >
                    <Text style={{ fontSize: 11.5, fontWeight: '800', color: on ? '#FFF' : theme.textSecondary }}>
                      {sz.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Ready-made sticker layouts, matching what the web app prints. */}
            <Text style={[styles.pickerLabel, { color: theme.textSecondary }]}>LABEL DESIGN</Text>
            <View style={styles.pickerRow}>
              <TouchableOpacity
                onPress={() => setPresetId(null)}
                style={[
                  styles.pickerChip,
                  { borderColor: !presetId ? BRAND_COLORS.blue600 : theme.borderColor, backgroundColor: !presetId ? BRAND_COLORS.blue600 : theme.cardBg },
                ]}
              >
                <Text style={{ fontSize: 11.5, fontWeight: '800', color: !presetId ? '#FFF' : theme.textSecondary }}>
                  Default
                </Text>
              </TouchableOpacity>
              {LABEL_PRESETS.map((pr) => {
                const on = presetId === pr.id;
                return (
                  <TouchableOpacity
                    key={pr.id}
                    onPress={() => setPresetId(pr.id)}
                    style={[
                      styles.pickerChip,
                      { borderColor: on ? BRAND_COLORS.navyInk : theme.borderColor, backgroundColor: on ? BRAND_COLORS.navyInk : theme.cardBg },
                    ]}
                  >
                    <Text style={{ fontSize: 11.5, fontWeight: '800', color: on ? '#FFF' : theme.textSecondary }}>
                      {pr.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {presetId ? (
              <Text style={[styles.pickerHint, { color: theme.textSecondary }]}>
                {LABEL_PRESETS.find((pr) => pr.id === presetId)?.description}
              </Text>
            ) : null}

            {/* Optional Saved Template Switcher */}
            {usableTemplate ? (
              <View style={{ flexDirection: 'row', marginTop: 8, marginBottom: 4, gap: 6 }}>
                <TouchableOpacity
                  onPress={() => setPrintMode('direct')}
                  style={{
                    flex: 1,
                    paddingVertical: 6,
                    paddingHorizontal: 8,
                    borderRadius: 6,
                    backgroundColor: printMode === 'direct' ? BRAND_COLORS.blue600 : theme.cardBg,
                    alignItems: 'center',
                    borderWidth: 1,
                    borderColor: printMode === 'direct' ? BRAND_COLORS.blue600 : theme.borderColor,
                  }}
                >
                  <Text style={{ fontSize: 11, fontWeight: '700', color: printMode === 'direct' ? '#FFF' : theme.textSecondary }}>
                    🏷️ Product Barcode
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setPrintMode('template')}
                  style={{
                    flex: 1,
                    paddingVertical: 6,
                    paddingHorizontal: 8,
                    borderRadius: 6,
                    backgroundColor: printMode === 'template' ? BRAND_COLORS.navyInk : theme.cardBg,
                    alignItems: 'center',
                    borderWidth: 1,
                    borderColor: printMode === 'template' ? BRAND_COLORS.navyInk : theme.borderColor,
                  }}
                >
                  <Text style={{ fontSize: 11, fontWeight: '700', color: printMode === 'template' ? '#FFF' : theme.textSecondary }} numberOfLines={1}>
                    🎨 Template: {usableTemplate.name}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : null}

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

            {/* Quantity / Copies Selector */}
            <View style={[styles.qtyCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
              <View style={styles.qtyHeader}>
                <Text style={[styles.qtySectionLabel, { color: theme.textSecondary }]}>PRINT QUANTITY</Text>
                <View style={[styles.qtyBadge, { backgroundColor: BRAND_COLORS.blue600 }]}>
                  <Text style={styles.qtyBadgeText}>{printCopies} {printCopies === 1 ? 'Label' : 'Labels'}</Text>
                </View>
              </View>

              <View style={styles.qtyRow}>
                <TouchableOpacity
                  onPress={() => setPrintCopies((c) => Math.max(1, c - 1))}
                  disabled={printCopies <= 1}
                  style={[
                    styles.qtyStepperBtn,
                    {
                      borderColor: theme.borderColor,
                      backgroundColor: printCopies <= 1 ? (isDark ? '#1E293B' : '#F1F5F9') : BRAND_COLORS.blue600,
                    },
                  ]}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Minus size={18} color={printCopies <= 1 ? theme.textSecondary : '#FFFFFF'} />
                </TouchableOpacity>

                <View style={[styles.qtyDisplayBox, { backgroundColor: isDark ? '#0F172A' : '#FFFFFF', borderColor: theme.borderColor }]}>
                  <Text style={[styles.qtyDisplayText, { color: theme.textPrimary }]}>{printCopies}</Text>
                  <Text style={[styles.qtySubText, { color: theme.textSecondary }]}>pcs</Text>
                </View>

                <TouchableOpacity
                  onPress={() => setPrintCopies((c) => Math.min(100, c + 1))}
                  disabled={printCopies >= 100}
                  style={[
                    styles.qtyStepperBtn,
                    { borderColor: theme.borderColor, backgroundColor: BRAND_COLORS.blue600 },
                  ]}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Plus size={18} color="#FFFFFF" />
                </TouchableOpacity>
              </View>

              {/* Quick Preset Chips */}
              <View style={styles.qtyPresetRow}>
                {[1, 2, 5, 10, 25, 50].map((count) => {
                  const isActive = printCopies === count;
                  return (
                    <TouchableOpacity
                      key={count}
                      onPress={() => setPrintCopies(count)}
                      style={[
                        styles.qtyPresetChip,
                        {
                          backgroundColor: isActive ? BRAND_COLORS.blue600 : (isDark ? '#1E293B' : '#FFFFFF'),
                          borderColor: isActive ? BRAND_COLORS.blue600 : theme.borderColor,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.qtyPresetText,
                          { color: isActive ? '#FFFFFF' : theme.textSecondary, fontWeight: isActive ? '800' : '600' },
                        ]}
                      >
                        {count}x
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Connected Printer Status Pill */}
            <View
              style={[
                styles.printerStatusPill,
                { backgroundColor: labelPrinter.isConnected ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)' },
              ]}
            >
              <Printer size={14} color={labelPrinter.isConnected ? '#10B981' : '#EF4444'} />
              <Text
                style={[styles.printerStatusText, { color: labelPrinter.isConnected ? '#10B981' : '#EF4444' }]}
                numberOfLines={1}
              >
                {labelPrinter.isConnected
                  ? labelPrinter.kind === 'label'
                    ? `Label printer: ${labelPrinter.name}`
                    : `Printer: ${labelPrinter.name} (${paperWidth})`
                  : 'No printer connected'}
              </Text>
            </View>

            {/* Receipt-only Printer Warning Banner (when Veer or other ESC/POS printer is connected) */}
            {labelPrinter.isConnected && labelPrinter.kind === 'thermal' && (
              <View
                style={[
                  styles.warningBanner,
                  {
                    backgroundColor: isDark ? 'rgba(245, 158, 11, 0.12)' : '#FEF3C7',
                    borderColor: isDark ? 'rgba(245, 158, 11, 0.28)' : '#FDE68A',
                  },
                ]}
              >
                <AlertTriangle size={16} color="#D97706" style={{ marginTop: 2, marginRight: 8 }} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.warningBannerTitle, { color: isDark ? '#FDE68A' : '#92400E' }]}>
                    Receipt Printer Connected ({labelPrinter.name})
                  </Text>
                  <Text style={[styles.warningBannerText, { color: isDark ? '#FCD34D' : '#B45309' }]}>
                    Your connected printer is designed for continuous receipt paper rolls, not adhesive sticker labels. The label will print on receipt paper. For adhesive stickers, connect a Josh Dual-Mode printer.
                  </Text>
                </View>
              </View>
            )}

            {/* Dual-Mode Josh Printer Connected Callout */}
            {labelPrinter.isConnected && labelPrinter.kind === 'label' && (
              <View
                style={[
                  styles.dualModePill,
                  {
                    backgroundColor: isDark ? 'rgba(99, 102, 241, 0.12)' : '#EEF2FF',
                    borderColor: isDark ? 'rgba(99, 102, 241, 0.25)' : '#C7D2FE',
                  },
                ]}
              >
                <Sparkles size={13} color="#6366F1" style={{ marginRight: 6 }} />
                <Text style={[styles.dualModePillText, { color: isDark ? '#A5B4FC' : '#4F46E5' }]} numberOfLines={1}>
                  Josh Dual-Mode Smart Printer (Ready for Sticker Labels)
                </Text>
              </View>
            )}
          </ScrollView>

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

            <TouchableOpacity
              onPress={hasSequenceElement ? () => setShowSequencePrompt(true) : handlePrintLabel}
              disabled={isPrinting}
              style={[styles.actionBtn, { backgroundColor: BRAND_COLORS.blue600 }]}
            >
              {isPrinting ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <>
                  <Printer size={16} color="#FFF" />
                  <Text style={[styles.actionBtnText, { color: '#FFF' }]}>
                    {printMode === 'template' && usableTemplate
                      ? `Print ${printCopies > 1 ? `${printCopies}x ` : ''}"${usableTemplate.name}"`
                      : `Print ${printCopies} ${selectedFormat.toUpperCase()} ${printCopies > 1 ? 'Labels' : 'Label'}`}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>

      <SequencePrintPrompt
        visible={showSequencePrompt}
        isPrinting={isPrinting}
        progress={seqProgress}
        onSubmit={handleSubmitSequence}
        onCancel={() => setShowSequencePrompt(false)}
      />

      <JoshDualModeModal
        visible={showTipModal}
        onDismiss={() => {
          setShowTipModal(false);
          markTipShown();
        }}
        onDontShowAgain={() => {
          setShowTipModal(false);
          dismissPermanently();
        }}
      />
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.65)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  modalCard: { width: '100%', maxWidth: 440, maxHeight: '90%', borderRadius: 24, padding: 20, borderWidth: 1 },
  scrollBody: { flexGrow: 0, marginVertical: 4 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  modalTitle: { fontSize: 16, fontWeight: '900' },
  closeBtn: {
    padding: 6,
    minWidth: 38,
    minHeight: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
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
  pickerLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5, marginTop: 12, marginBottom: 6 },
  pickerRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pickerChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1 },
  pickerHint: { fontSize: 10.5, marginTop: 6, lineHeight: 14 },
  qtyCard: { borderRadius: 14, padding: 12, borderWidth: 1, marginTop: 12 },
  qtyHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  qtySectionLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  qtyBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  qtyBadgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900' },
  qtyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 },
  qtyStepperBtn: { width: 42, height: 42, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  qtyDisplayBox: { minWidth: 80, height: 42, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 4, paddingHorizontal: 12 },
  qtyDisplayText: { fontSize: 18, fontWeight: '900' },
  qtySubText: { fontSize: 11, fontWeight: '600', marginTop: 3 },
  qtyPresetRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, gap: 6 },
  qtyPresetChip: { flex: 1, paddingVertical: 6, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  qtyPresetText: { fontSize: 11 },
  printerStatusPill: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 12, marginVertical: 12 },
  printerStatusText: { fontSize: 11, fontWeight: '800', marginLeft: 6 },
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 14 },
  actionBtnText: { fontSize: 13, fontWeight: '800', marginLeft: 6 },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
  },
  warningBannerTitle: {
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 2,
  },
  warningBannerText: {
    fontSize: 11,
    lineHeight: 15,
  },
  dualModePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 10,
  },
  dualModePillText: {
    fontSize: 11,
    fontWeight: '700',
    flex: 1,
  },
});
