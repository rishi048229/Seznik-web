import React, { useEffect, useMemo, useState } from 'react';
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
import { X, Printer, ExternalLink, FileText, CheckCircle2 } from 'lucide-react-native';
import ThermalPrinterService, { PrintSaleData, ReceiptPrintOptions } from '@/services/PrinterService';
import { usePrinterStore } from '@/store/usePrinterStore';
import { getTemplateById } from '@/constants/receiptTemplates';
import { useAppTheme } from '@/hooks/useAppTheme';
import { BRAND_COLORS } from '@/constants/theme';
import { ReceiptTemplateMockup } from '@/components/ui/ReceiptTemplateMockup';
import { CustomReceiptMockup } from '@/components/ui/CustomReceiptMockup';

import { DirectPrinterConnectModal } from '@/components/printers/DirectPrinterConnectModal';
import { useStoreProfile } from '@/hooks/useStoreProfile';
import { applyStoreProfileToPrintData } from '@/utils/invoiceActions';

interface ReceiptPreviewModalProps {
  visible: boolean;
  saleData: PrintSaleData | null;
  onClose: () => void;
  /** POS checkout closes after print; invoice history keeps the preview open. */
  autoCloseAfterPrint?: boolean;
  /** True while the sale is still being saved — disables print until the invoice is final. */
  isSaleSaving?: boolean;
}

export const ReceiptPreviewModal: React.FC<ReceiptPreviewModalProps> = ({
  visible,
  saleData,
  onClose,
  autoCloseAfterPrint = true,
  isSaleSaving = false,
}) => {
  const {
    activeDevice,
    connectionState,
    paperWidth,
    topMargin,
    autoCut,
    fontSize,
    printCopies,
    activeTemplateId,
    customTemplates,
    activeCustomTemplateId,
    enableBillQrCode,
  } = usePrinterStore();
  const storeProfile = useStoreProfile();
  const [isPrinting, setIsPrinting] = useState(false);
  const [hasPrinted, setHasPrinted] = useState(false);
  const [showConnectModal, setShowConnectModal] = useState(false);
  const theme = useAppTheme();

  useEffect(() => {
    if (visible) {
      setHasPrinted(false);
      setIsPrinting(false);
      setShowConnectModal(false);
    }
  }, [visible, saleData?.invoiceNumber]);

  const resolvedSaleData = useMemo(() => {
    if (!saleData) return null;
    return applyStoreProfileToPrintData(saleData, storeProfile);
  }, [
    saleData,
    storeProfile.storeName,
    storeProfile.storeAddress,
    storeProfile.storePhone,
    storeProfile.storeGstin,
    storeProfile.storeLogoUrl,
    storeProfile.upiId,
  ]);

  if (!resolvedSaleData) return null;

  const activeCustomTemplate = customTemplates?.find((t) => t.id === activeCustomTemplateId) || null;
  const template = getTemplateById(activeTemplateId);

  const printOptions: ReceiptPrintOptions = {
    template,
    customTemplate: activeCustomTemplate,
    includeBillQr: enableBillQrCode,
    topMargin,
    autoCut,
    fontSize,
    copies: printCopies,
    storeName: resolvedSaleData.storeName,
    storeAddress: resolvedSaleData.storeAddress,
    storePhone: resolvedSaleData.storePhone,
    storeGstin: resolvedSaleData.storeGstin,
    storeLogoUrl: resolvedSaleData.storeLogoUrl,
    upiId: resolvedSaleData.upiId,
  };

  const finishAfterPrint = () => {
    setHasPrinted(true);
    if (autoCloseAfterPrint) {
      onClose();
    } else {
      Alert.alert('Print Sent', 'Receipt sent to your thermal printer.');
      setHasPrinted(false);
    }
  };

  const handlePrintThermal = async () => {
    if (isPrinting) return;
    if (hasPrinted && autoCloseAfterPrint) return;

    if (!activeDevice || connectionState !== 'connected') {
      Alert.alert(
        'No Printer Connected',
        'Connect a Bluetooth thermal printer to print this receipt.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Connect Printer', onPress: () => setShowConnectModal(true) },
        ]
      );
      return;
    }

    setIsPrinting(true);
    try {
      const ok = await ThermalPrinterService.printReceipt(resolvedSaleData, paperWidth, printOptions);
      if (ok) {
        finishAfterPrint();
      }
    } catch (e: any) {
      Alert.alert('Print Error', e?.message || 'Could not print receipt.');
    } finally {
      setIsPrinting(false);
    }
  };

  const handleSystemPrint = async () => {
    if (isPrinting) return;
    if (hasPrinted && autoCloseAfterPrint) return;

    setIsPrinting(true);
    try {
      const html = ThermalPrinterService.generateReceiptHtml(resolvedSaleData, paperWidth, printOptions);
      const Print = require('expo-print');
      await Print.printAsync({ html });
      if (autoCloseAfterPrint) {
        finishAfterPrint();
      } else {
        Alert.alert('System Print', 'Print dialog opened for this receipt.');
      }
    } catch (e: any) {
      Alert.alert('System Print Error', 'Could not open system print dialog.');
    } finally {
      setIsPrinting(false);
    }
  };

  const activeTemplateName = activeCustomTemplate ? activeCustomTemplate.name : template.name;
  const printDisabled = isPrinting || isSaleSaving || (hasPrinted && autoCloseAfterPrint);

  return (
    <>
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.overlayDismiss} activeOpacity={1} onPress={onClose} />
        <View style={[styles.modalCard, { backgroundColor: theme.bg, borderColor: theme.borderColor }]}>
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8 }}>
              <FileText size={20} color={BRAND_COLORS.blue600} style={{ marginRight: 8 }} />
              <View>
                <Text style={[styles.modalTitle, { color: theme.textPrimary }]} numberOfLines={1}>
                  Thermal Receipt Preview
                </Text>
                <Text style={{ fontSize: 11, color: theme.textSecondary, fontWeight: '600' }} numberOfLines={1}>
                  Using template: {activeTemplateName}
                </Text>
              </View>
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

          {/* Active Printer Pill - Tappable to connect directly */}
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => !hasPrinted && setShowConnectModal(true)}
            style={[styles.printerStatusPill, { backgroundColor: activeDevice && connectionState === 'connected' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(245, 158, 11, 0.12)' }]}
          >
            <Printer size={13} color={activeDevice && connectionState === 'connected' ? '#10B981' : '#F59E0B'} />
            <Text style={[styles.printerStatusText, { color: activeDevice && connectionState === 'connected' ? '#10B981' : '#B45309' }]}>
              {activeDevice && connectionState === 'connected' ? `Printer: ${activeDevice.name} (${paperWidth})` : `No Printer Connected • Tap to Connect`}
            </Text>
          </TouchableOpacity>

          {isSaleSaving ? (
            <View style={[styles.savingBanner, { backgroundColor: 'rgba(245, 158, 11, 0.12)' }]}>
              <ActivityIndicator size="small" color="#D97706" />
              <Text style={styles.savingBannerText}>Saving sale… invoice will be ready to print shortly</Text>
            </View>
          ) : null}

          {/* Thermal Paper Scroll Container */}
          <ScrollView
            style={styles.paperScrollView}
            contentContainerStyle={styles.paperScrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator
            nestedScrollEnabled
            bounces
          >
            {activeCustomTemplate ? (
              <CustomReceiptMockup
                template={activeCustomTemplate}
                storeName={resolvedSaleData.storeName || 'Your Store Name'}
                storeAddress={resolvedSaleData.storeAddress || ''}
                storePhone={resolvedSaleData.storePhone || ''}
                storeGstin={resolvedSaleData.storeGstin || ''}
                storeLogoUrl={resolvedSaleData.storeLogoUrl}
                invoiceNumber={resolvedSaleData.invoiceNumber}
                date={resolvedSaleData.date}
                customerName={resolvedSaleData.customerName || 'Walk-in Customer'}
                items={resolvedSaleData.items}
                subtotal={resolvedSaleData.subtotal}
                totalDiscount={resolvedSaleData.totalDiscount}
                totalTax={resolvedSaleData.totalTax}
                grandTotal={resolvedSaleData.grandTotal}
                paperWidth={paperWidth}
                upiId={resolvedSaleData.upiId || ''}
              />
            ) : (
              <ReceiptTemplateMockup
                template={template}
                storeName={resolvedSaleData.storeName || 'Your Store Name'}
                storeAddress={resolvedSaleData.storeAddress || ''}
                storePhone={resolvedSaleData.storePhone || ''}
                storeLogoUrl={resolvedSaleData.storeLogoUrl}
                invoiceNumber={resolvedSaleData.invoiceNumber}
                date={resolvedSaleData.date}
                customerName={resolvedSaleData.customerName || 'Walk-in Customer'}
                items={resolvedSaleData.items}
                subtotal={resolvedSaleData.subtotal}
                totalDiscount={resolvedSaleData.totalDiscount}
                totalTax={resolvedSaleData.totalTax}
                grandTotal={resolvedSaleData.grandTotal}
              />
            )}
          </ScrollView>

          {hasPrinted && autoCloseAfterPrint ? (
            <View style={[styles.printedBanner, { backgroundColor: 'rgba(16, 185, 129, 0.12)' }]}>
              <CheckCircle2 size={16} color="#10B981" />
              <Text style={styles.printedBannerText}>Receipt sent — closing...</Text>
            </View>
          ) : (
            <View style={styles.actionRow}>
              <TouchableOpacity
                onPress={handleSystemPrint}
                disabled={printDisabled}
                style={[styles.actionBtn, { backgroundColor: BRAND_COLORS.navyInk }, printDisabled && styles.actionBtnDisabled]}
              >
                <ExternalLink size={15} color="#FFFFFF" />
                <Text style={[styles.actionBtnText, { color: '#FFFFFF' }]}>System Print</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handlePrintThermal}
                disabled={printDisabled}
                style={[styles.actionBtn, { backgroundColor: BRAND_COLORS.blue600 }, printDisabled && styles.actionBtnDisabled]}
              >
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
          )}
        </View>
      </View>
    </Modal>

    <DirectPrinterConnectModal
      visible={showConnectModal && !hasPrinted}
      onClose={() => setShowConnectModal(false)}
      onConnected={() => {
        setShowConnectModal(false);
        setTimeout(() => {
          handlePrintThermal();
        }, 400);
      }}
      showContinueWithoutPrinter={true}
      onContinueWithoutPrinter={() => {
        setShowConnectModal(false);
        handleSystemPrint();
      }}
    />
    </>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.7)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  overlayDismiss: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 0 },
  modalCard: { width: '100%', maxWidth: 440, maxHeight: '90%', borderRadius: 24, padding: 18, borderWidth: 1, flexShrink: 1, zIndex: 1, elevation: 8 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  modalTitle: { fontSize: 16, fontWeight: '900' },
  closeBtn: {
    padding: 6,
    minWidth: 38,
    minHeight: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  printerStatusPill: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 10, marginVertical: 8 },
  printerStatusText: { fontSize: 11, fontWeight: '800', marginLeft: 6 },
  paperScrollView: { flexGrow: 1, flexShrink: 1, minHeight: 120, maxHeight: 460 },
  paperScrollContent: { paddingVertical: 12, paddingHorizontal: 12, alignItems: 'center' },
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 14 },
  actionBtnDisabled: { opacity: 0.5 },
  actionBtnText: { fontSize: 13, fontWeight: '800', marginLeft: 6 },
  printedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 14,
    paddingVertical: 12,
    borderRadius: 14,
  },
  printedBannerText: { fontSize: 13, fontWeight: '800', color: '#10B981' },
  savingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
    marginBottom: 4,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  savingBannerText: { flex: 1, fontSize: 11, fontWeight: '700', color: '#B45309' },
});
