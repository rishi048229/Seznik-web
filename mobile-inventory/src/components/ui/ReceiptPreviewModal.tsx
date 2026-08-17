import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { X, Printer, ExternalLink, FileText, CheckCircle2, Share2 } from 'lucide-react-native';
import ThermalPrinterService, { PrintSaleData } from '@/services/PrinterService';
import { usePrinterStore } from '@/store/usePrinterStore';
import { getTemplateById } from '@/constants/receiptTemplates';
import { useAppTheme } from '@/hooks/useAppTheme';
import { BRAND_COLORS } from '@/constants/theme';

interface ReceiptPreviewModalProps {
  visible: boolean;
  saleData: PrintSaleData | null;
  onClose: () => void;
}

export const ReceiptPreviewModal: React.FC<ReceiptPreviewModalProps> = ({
  visible,
  saleData,
  onClose,
}) => {
  const { activeDevice, paperWidth, topMargin, autoCut, fontSize, printCopies, activeTemplateId } = usePrinterStore();
  const [isPrinting, setIsPrinting] = useState(false);
  const theme = useAppTheme();

  if (!saleData) return null;

  const template = getTemplateById(activeTemplateId);
  const printOptions = { template, topMargin, autoCut, fontSize, copies: printCopies };

  const handlePrintThermal = async () => {
    setIsPrinting(true);
    try {
      const ok = await ThermalPrinterService.printReceipt(saleData, paperWidth, printOptions);
      if (ok) {
        Alert.alert('Print Sent', 'Thermal receipt sent to printer.');
      }
    } catch (e: any) {
      Alert.alert('Print Error', e?.message || 'Could not print receipt.');
    } finally {
      setIsPrinting(false);
    }
  };

  const handleSystemPrint = async () => {
    setIsPrinting(true);
    try {
      const html = ThermalPrinterService.generateReceiptHtml(saleData, paperWidth, printOptions);
      const Print = require('expo-print');
      await Print.printAsync({ html });
    } catch (e: any) {
      Alert.alert('System Print Error', 'Could not open system print dialog.');
    } finally {
      setIsPrinting(false);
    }
  };

  const formattedText = ThermalPrinterService.formatReceiptText(saleData, paperWidth, printOptions);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.modalCard, { backgroundColor: theme.bg, borderColor: theme.borderColor }]}>
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <FileText size={20} color={BRAND_COLORS.blue600} style={{ marginRight: 8 }} />
              <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>Thermal Receipt Bill Preview</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={18} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Active Printer Pill */}
          <View style={[styles.printerStatusPill, { backgroundColor: activeDevice ? 'rgba(16, 185, 129, 0.12)' : 'rgba(245, 158, 11, 0.12)' }]}>
            <Printer size={13} color={activeDevice ? '#10B981' : '#F59E0B'} />
            <Text style={[styles.printerStatusText, { color: activeDevice ? '#10B981' : '#B45309' }]}>
              {activeDevice ? `Printer: ${activeDevice.name} (${paperWidth})` : `Paper: ${paperWidth} • System Fallback Ready`}
            </Text>
          </View>

          {/* Thermal Paper Scroll Container */}
          <ScrollView style={styles.paperScrollView} contentContainerStyle={{ paddingVertical: 12 }}>
            <View style={styles.paperReceiptCard}>
              <Text style={styles.receiptMonoText}>{formattedText}</Text>
            </View>
          </ScrollView>

          {/* Action Row */}
          <View style={styles.actionRow}>
            <TouchableOpacity onPress={handleSystemPrint} disabled={isPrinting} style={[styles.actionBtn, { backgroundColor: BRAND_COLORS.navyInk }]}>
              <ExternalLink size={15} color="#FFFFFF" />
              <Text style={[styles.actionBtnText, { color: '#FFFFFF' }]}>System Print</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={handlePrintThermal} disabled={isPrinting} style={[styles.actionBtn, { backgroundColor: BRAND_COLORS.blue600 }]}>
              {isPrinting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Printer size={15} color="#FFFFFF" />
                  <Text style={[styles.actionBtnText, { color: '#FFFFFF' }]}>Print Bill</Text>
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
  overlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.7)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  modalCard: { width: '100%', maxWidth: 440, maxHeight: '90%', borderRadius: 24, padding: 18, borderWidth: 1 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  modalTitle: { fontSize: 16, fontWeight: '900' },
  closeBtn: { padding: 4 },
  printerStatusPill: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 10, marginVertical: 8 },
  printerStatusText: { fontSize: 11, fontWeight: '800', marginLeft: 6 },
  paperScrollView: { maxHeight: 420, marginVertical: 4 },
  paperReceiptCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: '#0F172A',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
    alignItems: 'center',
  },
  receiptMonoText: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 12,
    lineHeight: 18,
    color: '#000000',
    fontWeight: '600',
  },
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 14 },
  actionBtnText: { fontSize: 13, fontWeight: '800', marginLeft: 6 },
});
