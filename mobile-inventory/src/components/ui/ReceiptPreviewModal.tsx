import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Linking,
  Platform,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  X,
  Printer,
  ExternalLink,
  FileText,
  CheckCircle2,
  Edit3,
  Eye,
  Plus,
  Trash2,
  Share2,
  Store,
  User,
  ShoppingBag,
  CreditCard,
  QrCode,
  Sparkles,
  Bluetooth,
} from 'lucide-react-native';
import QRCode from 'react-native-qrcode-svg';
import ThermalPrinterService, { PrintSaleData, ReceiptPrintOptions } from '@/services/PrinterService';
import { usePrinterStore } from '@/store/usePrinterStore';
import { getTemplateById } from '@/constants/receiptTemplates';
import { useAppTheme } from '@/hooks/useAppTheme';
import { BRAND_COLORS } from '@/constants/theme';
import { DirectPrinterConnectModal } from '@/components/printers/DirectPrinterConnectModal';
import { useStoreProfile } from '@/hooks/useStoreProfile';
import { applyStoreProfileToPrintData } from '@/utils/invoiceActions';
import { buildBillPdfUrl, buildUpiPayString, isValidUpiVpa } from '@/utils/billQrService';
import { CustomReceiptMockup } from '@/components/ui/CustomReceiptMockup';
import {
  receiptLogoHtmlMaxPxFromChip,
  receiptStandardQrHtmlPxFromChip,
} from '@shared/receiptPrintGeometry';
import { parseGstBilling, gstPrintOptionOverrides } from '@/constants/gstBilling';

interface ReceiptPreviewModalProps {
  visible: boolean;
  saleData: PrintSaleData | null;
  onClose: () => void;
  autoCloseAfterPrint?: boolean;
  autoPrintOnOpen?: boolean;
  isSaleSaving?: boolean;
  /**
   * Sends the user back to the cart with this bill's items still loaded, instead
   * of closing the sale. Only shown when provided — the invoice history reuses
   * this modal to view an already-recorded bill, where editing makes no sense.
   */
  onEdit?: () => void;
  /**
   * Fired the first time the bill is actually acted on (printed or shared). The
   * POS uses it to record the sale, which is why it no longer happens at Pay Now.
   */
  onConfirmed?: () => void;
}

export const ReceiptPreviewModal: React.FC<ReceiptPreviewModalProps> = ({
  visible,
  saleData,
  onClose,
  autoCloseAfterPrint = true,
  autoPrintOnOpen = false,
  isSaleSaving = false,
  onEdit,
  onConfirmed,
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
    receiptLogoSize,
    receiptQrSize,
  } = usePrinterStore();
  const storeProfile = useStoreProfile();
  const [isPrinting, setIsPrinting] = useState(false);
  const [hasPrinted, setHasPrinted] = useState(false);
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'preview' | 'edit'>('preview');
  const theme = useAppTheme();
  const autoPrintStartedRef = useRef(false);
  const pinnedSaleDataRef = useRef<PrintSaleData | null>(null);

  // Local Editable Copy
  const [editableSale, setEditableSale] = useState<PrintSaleData | null>(null);

  useEffect(() => {
    if (saleData) {
      pinnedSaleDataRef.current = saleData;
      const initial = applyStoreProfileToPrintData(saleData, storeProfile);
      setEditableSale(JSON.parse(JSON.stringify(initial)));
    }
    if (!visible) {
      pinnedSaleDataRef.current = null;
      autoPrintStartedRef.current = false;
      setActiveTab('preview');
    }
  }, [saleData, visible, storeProfile]);

  useEffect(() => {
    if (visible) {
      setHasPrinted(false);
      setIsPrinting(false);
      setShowConnectModal(false);
      autoPrintStartedRef.current = false;
    }
  }, [visible, saleData?.invoiceNumber]);

  const activeCustomTemplate = customTemplates?.find((t) => t.id === activeCustomTemplateId) || null;
  const template = getTemplateById(activeTemplateId);

  // Live Recalculations for editable items
  const computedTotals = useMemo(() => {
    if (!editableSale || !editableSale.items) {
      return { subtotal: 0, totalTax: 0, totalDiscount: 0, grandTotal: 0 };
    }
    let sub = 0;
    let disc = 0;
    let tax = 0;

    editableSale.items.forEach((item) => {
      const lineBase = (item.unitPrice || 0) * (item.quantity || 1);
      const lineDisc = item.discount || 0;
      const taxable = Math.max(0, lineBase - lineDisc);
      const lineTax = (taxable * (item.gstRate || 0)) / 100;

      sub += lineBase;
      disc += lineDisc;
      tax += lineTax;
    });

    const extraCharges = editableSale.extraChargesTotal || 0;
    const grand = Math.max(0, sub - disc + tax + extraCharges);

    return {
      subtotal: sub,
      totalDiscount: disc,
      totalTax: tax,
      grandTotal: grand,
    };
  }, [editableSale]);

  const printOptions: ReceiptPrintOptions = useMemo(
    () => ({
      template,
      customTemplate: activeCustomTemplate,
      includeBillQr: enableBillQrCode,
      topMargin,
      autoCut,
      fontSize,
      copies: printCopies,
      storeName: editableSale?.storeName,
      storeAddress: editableSale?.storeAddress,
      storePhone: editableSale?.storePhone,
      storeGstin: editableSale?.storeGstin,
      storeLogoUrl: editableSale?.storeLogoUrl,
      upiId: editableSale?.upiId,
      // Same reason as the GST overrides below: the checkout used to pass this
      // before printing directly, and printing happens here now, so leaving it out
      // would quietly drop the footer line from every printed slip.
      footerMessage: editableSale?.footerMessage || storeProfile.footerMessage,
      receiptLogoSize,
      receiptQrSize,
      // Carried over from the POS checkout, which used to spread these in before
      // printing directly. Printing moved in here, so without them the slip's GST
      // breakdown would silently render differently than it did before.
      ...gstPrintOptionOverrides(parseGstBilling(storeProfile.settings?.invoiceConfig)),
    }),
    [
      storeProfile.settings?.invoiceConfig,
      template,
      activeCustomTemplate,
      enableBillQrCode,
      topMargin,
      autoCut,
      fontSize,
      printCopies,
      editableSale?.storeName,
      editableSale?.storeAddress,
      editableSale?.storePhone,
      editableSale?.storeGstin,
      editableSale?.storeLogoUrl,
      editableSale?.upiId,
      receiptLogoSize,
      receiptQrSize,
    ]
  );

  // Handlers for modifying editable sale items
  const handleItemChange = (index: number, field: string, value: any) => {
    if (!editableSale) return;
    const nextItems = [...editableSale.items];
    const current = { ...nextItems[index], [field]: value };
    const unitPrice = Number(current.unitPrice || 0);
    const qty = Number(current.quantity || 1);
    const disc = Number(current.discount || 0);
    current.total = Math.max(0, unitPrice * qty - disc);

    nextItems[index] = current;
    setEditableSale({
      ...editableSale,
      items: nextItems,
      subtotal: computedTotals.subtotal,
      totalDiscount: computedTotals.totalDiscount,
      totalTax: computedTotals.totalTax,
      grandTotal: computedTotals.grandTotal,
    });
  };

  const handleAddItem = () => {
    if (!editableSale) return;
    const newItem = {
      productName: 'New Item',
      quantity: 1,
      unitPrice: 100,
      total: 100,
      unit: 'Pc',
      gstRate: 0,
      discount: 0,
    };
    setEditableSale({
      ...editableSale,
      items: [...editableSale.items, newItem],
    });
  };

  const handleRemoveItem = (index: number) => {
    if (!editableSale || editableSale.items.length <= 1) {
      Alert.alert('Cannot Remove', 'Receipt must have at least one item.');
      return;
    }
    const nextItems = editableSale.items.filter((_, i) => i !== index);
    setEditableSale({
      ...editableSale,
      items: nextItems,
    });
  };

  const finishAfterPrint = useCallback(() => {
    setHasPrinted(true);
    // Every completion route (thermal, A4, WhatsApp) funnels through here, so this
    // is the one place the sale needs recording from. onConfirmed is itself
    // idempotent, so a reprint does not record a second sale.
    onConfirmed?.();
    if (autoCloseAfterPrint) {
      setTimeout(() => {
        onClose();
      }, 700);
    }
  }, [autoCloseAfterPrint, onClose, onConfirmed]);

  // Multi-Channel Print Triggers
  const handlePrintThermal = async () => {
    if (!editableSale) return;
    if (isPrinting) return;

    if (!activeDevice || connectionState !== 'connected') {
      setShowConnectModal(true);
      return;
    }

    setIsPrinting(true);
    try {
      const payload: PrintSaleData = {
        ...editableSale,
        subtotal: computedTotals.subtotal,
        totalDiscount: computedTotals.totalDiscount,
        totalTax: computedTotals.totalTax,
        grandTotal: computedTotals.grandTotal,
      };
      await ThermalPrinterService.printReceipt(payload, paperWidth, printOptions);
      finishAfterPrint();
    } catch (e: any) {
      Alert.alert('Print Error', e?.message || 'Failed to print thermal receipt.');
    } finally {
      setIsPrinting(false);
    }
  };

  const handleSystemPrint = async () => {
    if (!editableSale) return;
    setIsPrinting(true);
    try {
      const payload: PrintSaleData = {
        ...editableSale,
        subtotal: computedTotals.subtotal,
        totalDiscount: computedTotals.totalDiscount,
        totalTax: computedTotals.totalTax,
        grandTotal: computedTotals.grandTotal,
      };
      const html = ThermalPrinterService.generateReceiptHtml(payload, paperWidth, printOptions);
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

  const handleWhatsAppShare = () => {
    if (!editableSale) return;
    const custPhone = editableSale.customerPhone?.replace(/\D/g, '') || '';
    const lines = [
      `*${(editableSale.storeName || 'TAX INVOICE').toUpperCase()}*`,
      editableSale.storeAddress || '',
      editableSale.storePhone ? `Phone: ${editableSale.storePhone}` : '',
      `---------------------------------`,
      `*INVOICE: ${editableSale.invoiceNumber}*`,
      `Date: ${editableSale.date}`,
      `Customer: ${editableSale.customerName || 'Cash Customer'}`,
      `---------------------------------`,
      ...editableSale.items.map(
        (it) => `${it.productName} x ${it.quantity} = Rs. ${(it.unitPrice * it.quantity - (it.discount || 0)).toFixed(2)}`
      ),
      `---------------------------------`,
      `*Grand Total: Rs. ${computedTotals.grandTotal.toFixed(2)}*`,
      `Payment: ${(editableSale.paymentMethod || 'CASH').toUpperCase()}`,
      `---------------------------------`,
      `Thank you for your business!`,
    ].filter(Boolean);

    const text = encodeURIComponent(lines.join('\n'));
    const url = custPhone ? `https://wa.me/91${custPhone}?text=${text}` : `https://wa.me/?text=${text}`;
    Linking.openURL(url)
      .then(() => {
        // Sharing the bill also settles it, so the sale is recorded here too —
        // otherwise a shop that only sends bills on WhatsApp would never save one.
        onConfirmed?.();
        setHasPrinted(true);
      })
      .catch(() => Alert.alert('Error', 'Could not open WhatsApp.'));
  };

  const upiQrString = useMemo(() => {
    if (!editableSale?.upiId || !isValidUpiVpa(editableSale.upiId)) return '';
    return buildUpiPayString(editableSale.upiId, editableSale.storeName || 'Shop', computedTotals.grandTotal, editableSale.invoiceNumber);
  }, [editableSale?.upiId, editableSale?.storeName, computedTotals.grandTotal, editableSale?.invoiceNumber]);

  const modalVisible = visible && !!editableSale;
  const printDisabled = isPrinting || (hasPrinted && autoCloseAfterPrint);

  return (
    <>
      {modalVisible && editableSale ? (
        <Modal
          visible={modalVisible}
          animationType="slide"
          onRequestClose={onClose}
          presentationStyle="fullScreen"
        >
          <SafeAreaView
            style={[styles.fullScreenContainer, { backgroundColor: theme.bg }]}
            edges={['top', 'bottom']}
          >
            <View style={styles.fullScreenContent}>
              {/* Top Header Bar */}
              <View style={styles.headerRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8 }}>
                  <FileText size={20} color={BRAND_COLORS.blue600} style={{ marginRight: 8 }} />
                  <View>
                    <Text style={[styles.modalTitle, { color: theme.textPrimary }]} numberOfLines={1}>
                      Bill Receipt
                    </Text>
                    <Text style={{ fontSize: 11, color: theme.textSecondary, fontWeight: '700' }}>
                      INV #{editableSale.invoiceNumber}
                    </Text>
                  </View>
                </View>

                {/* View Tabs: Preview vs Edit */}
                <View style={styles.tabContainer}>
                  <TouchableOpacity
                    onPress={() => setActiveTab('preview')}
                    style={[styles.tabBtn, activeTab === 'preview' && styles.tabBtnActive]}
                  >
                    <Eye size={13} color={activeTab === 'preview' ? '#FFFFFF' : theme.textSecondary} />
                    <Text style={[styles.tabBtnText, activeTab === 'preview' && styles.tabBtnTextActive]}>
                      Preview
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setActiveTab('edit')}
                    style={[styles.tabBtn, activeTab === 'edit' && styles.tabBtnActive]}
                  >
                    <Edit3 size={13} color={activeTab === 'edit' ? '#FFFFFF' : theme.textSecondary} />
                    <Text style={[styles.tabBtnText, activeTab === 'edit' && styles.tabBtnTextActive]}>
                      Edit
                    </Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={12}>
                  <X size={20} color={theme.textSecondary} />
                </TouchableOpacity>
              </View>

              {/* Printer Status Pill */}
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => !hasPrinted && setShowConnectModal(true)}
                style={[
                  styles.printerStatusPill,
                  {
                    backgroundColor:
                      activeDevice && connectionState === 'connected'
                        ? 'rgba(16, 185, 129, 0.12)'
                        : 'rgba(245, 158, 11, 0.12)',
                  },
                ]}
              >
                <Bluetooth size={13} color={activeDevice && connectionState === 'connected' ? '#10B981' : '#F59E0B'} />
                <Text
                  style={[
                    styles.printerStatusText,
                    { color: activeDevice && connectionState === 'connected' ? '#10B981' : '#B45309' },
                  ]}
                >
                  {activeDevice && connectionState === 'connected'
                    ? `Bluetooth: ${activeDevice.name} (${paperWidth})`
                    : `No Printer Connected • Tap to Connect`}
                </Text>
              </TouchableOpacity>

              {/* TAB 1: PHOTOREALISTIC RECEIPT TICKET PREVIEW */}
              {activeTab === 'preview' ? (
                <ScrollView
                  style={styles.paperScrollView}
                  contentContainerStyle={styles.paperScrollContent}
                  showsVerticalScrollIndicator
                  keyboardShouldPersistTaps="handled"
                >
                  {/* Paper Width Quick Toggle */}
                  <View style={styles.paperWidthPillRow}>
                    <Text style={[styles.paperWidthLabel, { color: theme.textSecondary }]}>Paper Size:</Text>
                    <TouchableOpacity
                      onPress={() => usePrinterStore.getState().setPaperWidth('58mm')}
                      style={[styles.paperWidthBtn, paperWidth === '58mm' && styles.paperWidthBtnActive]}
                    >
                      <Text style={[styles.paperWidthBtnText, paperWidth === '58mm' && styles.paperWidthBtnTextActive]}>
                        58mm (32 Col)
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => usePrinterStore.getState().setPaperWidth('80mm')}
                      style={[styles.paperWidthBtn, paperWidth === '80mm' && styles.paperWidthBtnActive]}
                    >
                      <Text style={[styles.paperWidthBtnText, paperWidth === '80mm' && styles.paperWidthBtnTextActive]}>
                        80mm (48 Col)
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {activeCustomTemplate ? (
                    <CustomReceiptMockup
                      template={activeCustomTemplate}
                      storeName={editableSale.storeName || storeProfile.storeName}
                      storeAddress={editableSale.storeAddress || storeProfile.storeAddress}
                      storePhone={editableSale.storePhone || storeProfile.storePhone}
                      storeGstin={editableSale.storeGstin || storeProfile.storeGstin}
                      storeLogoUrl={editableSale.storeLogoUrl || storeProfile.storeLogoUrl}
                      invoiceNumber={editableSale.invoiceNumber}
                      date={editableSale.date}
                      customerName={editableSale.customerName}
                      customerPhone={editableSale.customerPhone}
                      items={editableSale.items}
                      subtotal={computedTotals.subtotal}
                      totalDiscount={computedTotals.totalDiscount}
                      totalTax={computedTotals.totalTax}
                      grandTotal={computedTotals.grandTotal}
                      amountPaid={editableSale.amountPaid ?? computedTotals.grandTotal}
                      changeReturned={editableSale.changeReturned ?? 0}
                      paymentMethod={editableSale.paymentMethod}
                      upiId={editableSale.upiId || storeProfile.upiId}
                      paperWidth={paperWidth}
                      logoSizeChip={receiptLogoSize}
                      qrSizeChip={receiptQrSize}
                    />
                  ) : (
                    <View
                      style={[
                        styles.realisticPaper,
                        { width: paperWidth === '58mm' ? 295 : 345 },
                      ]}
                    >
                      {/* Top Serrated Edge Simulation */}
                      <View style={styles.tearEdgeTop} />

                      {/* Document Type Header Banner */}
                      <View style={styles.docTypeBanner}>
                        <Text style={styles.docTypeText}>
                          *** {editableSale.storeGstin ? 'TAX INVOICE' : 'RETAIL BILL / CASH MEMO'} ***
                        </Text>
                      </View>

                      {/* Store Header */}
                      <View style={styles.receiptHeader}>
                        {editableSale.storeLogoUrl ? (
                          <Image
                            source={{ uri: editableSale.storeLogoUrl }}
                            style={[
                              styles.storeLogo,
                              {
                                maxWidth: receiptLogoHtmlMaxPxFromChip(receiptLogoSize).maxWidth,
                                maxHeight: receiptLogoHtmlMaxPxFromChip(receiptLogoSize).maxHeight,
                                width: receiptLogoHtmlMaxPxFromChip(receiptLogoSize).maxWidth,
                                height: receiptLogoHtmlMaxPxFromChip(receiptLogoSize).maxHeight,
                              },
                            ]}
                            resizeMode="contain"
                          />
                        ) : null}
                        <Text style={styles.thermalTitle}>{editableSale.storeName || storeProfile.storeName || 'SEZNIK RETAIL'}</Text>
                        {editableSale.storeAddress ? (
                          <Text style={styles.thermalSub}>{editableSale.storeAddress}</Text>
                        ) : null}
                        {editableSale.storePhone ? (
                          <Text style={styles.thermalSub}>Tel: {editableSale.storePhone}</Text>
                        ) : null}
                        {editableSale.storeGstin ? (
                          <Text style={styles.thermalGstin}>GSTIN: {editableSale.storeGstin}</Text>
                        ) : null}
                      </View>

                      <View style={styles.dashedLine} />

                      {/* Invoice Meta */}
                      <View style={styles.metaBlock}>
                        <View style={styles.rowBetween}>
                          <Text style={styles.monoLabel}>INVOICE NO:</Text>
                          <Text style={styles.monoValueBold}>#{editableSale.invoiceNumber}</Text>
                        </View>
                        <View style={styles.rowBetween}>
                          <Text style={styles.monoLabel}>DATE:</Text>
                          <Text style={styles.monoValue}>{editableSale.date}</Text>
                        </View>
                        <View style={styles.rowBetween}>
                          <Text style={styles.monoLabel}>CUSTOMER:</Text>
                          <Text style={styles.monoValueBold}>{editableSale.customerName || 'Walk-in'}</Text>
                        </View>
                        {editableSale.customerPhone ? (
                          <View style={styles.rowBetween}>
                            <Text style={styles.monoLabel}>PHONE:</Text>
                            <Text style={styles.monoValue}>{editableSale.customerPhone}</Text>
                          </View>
                        ) : null}
                        <View style={styles.rowBetween}>
                          <Text style={styles.monoLabel}>PAYMENT:</Text>
                          <Text style={styles.monoValueBold}>
                            {(editableSale.paymentMethod || 'CASH').toUpperCase()}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.dashedLine} />

                      {/* Table Header */}
                      <View style={styles.tableHeaderRow}>
                        <Text style={[styles.monoHeader, { flex: 2.2 }]}>ITEM</Text>
                        <Text style={[styles.monoHeader, { flex: 0.8, textAlign: 'center' }]}>QTY</Text>
                        <Text style={[styles.monoHeader, { flex: 1, textAlign: 'right' }]}>RATE</Text>
                        <Text style={[styles.monoHeader, { flex: 1.2, textAlign: 'right' }]}>AMT</Text>
                      </View>

                      {/* Item Lines */}
                      {editableSale.items.map((item, idx) => (
                        <View key={idx} style={styles.itemRow}>
                          <Text style={[styles.monoItemName, { flex: 2.2 }]} numberOfLines={2}>
                            {item.productName}
                          </Text>
                          <Text style={[styles.monoItemText, { flex: 0.8, textAlign: 'center' }]}>
                            {item.quantity}
                          </Text>
                          <Text style={[styles.monoItemText, { flex: 1, textAlign: 'right' }]}>
                            {item.unitPrice.toFixed(0)}
                          </Text>
                          <Text style={[styles.monoItemBold, { flex: 1.2, textAlign: 'right' }]}>
                            {(item.unitPrice * item.quantity - (item.discount || 0)).toFixed(2)}
                          </Text>
                        </View>
                      ))}

                      <View style={styles.dashedLine} />

                      {/* Totals Breakdown */}
                      <View style={styles.totalsBlock}>
                        <View style={styles.rowBetween}>
                          <Text style={styles.monoLabel}>SUBTOTAL:</Text>
                          <Text style={styles.monoValue}>₹{computedTotals.subtotal.toFixed(2)}</Text>
                        </View>
                        {computedTotals.totalDiscount > 0 ? (
                          <View style={styles.rowBetween}>
                            <Text style={styles.monoLabel}>DISCOUNT:</Text>
                            <Text style={styles.monoValue}>-₹{computedTotals.totalDiscount.toFixed(2)}</Text>
                          </View>
                        ) : null}
                        {computedTotals.totalTax > 0 ? (
                          <>
                            <View style={styles.rowBetween}>
                              <Text style={styles.monoLabel}>TAXABLE VALUE:</Text>
                              <Text style={styles.monoValue}>₹{(computedTotals.subtotal - computedTotals.totalDiscount).toFixed(2)}</Text>
                            </View>
                            <View style={styles.rowBetween}>
                              <Text style={styles.monoLabel}>CGST:</Text>
                              <Text style={styles.monoValue}>₹{(computedTotals.totalTax / 2).toFixed(2)}</Text>
                            </View>
                            <View style={styles.rowBetween}>
                              <Text style={styles.monoLabel}>SGST:</Text>
                              <Text style={styles.monoValue}>₹{(computedTotals.totalTax / 2).toFixed(2)}</Text>
                            </View>
                          </>
                        ) : null}

                        {/* Grand Total Box */}
                        <View style={styles.grandTotalBox}>
                          <Text style={styles.grandTotalLabel}>GRAND TOTAL:</Text>
                          <Text style={styles.grandTotalValue}>₹{computedTotals.grandTotal.toFixed(2)}</Text>
                        </View>
                      </View>

                      {/* Scannable UPI QR */}
                      {upiQrString ? (
                        <View style={styles.qrSection}>
                          <Text style={styles.qrHeader}>•• SCAN TO PAY VIA UPI ••</Text>
                          <View style={styles.qrFrame}>
                            <QRCode value={upiQrString} size={receiptStandardQrHtmlPxFromChip(receiptQrSize)} />
                          </View>
                          <Text style={styles.qrFooter}>UPI ID: {editableSale.upiId || storeProfile.upiId}</Text>
                        </View>
                      ) : null}

                      {/* Scannable Digital Bill PDF QR code if enabled */}
                      {enableBillQrCode ? (
                        <View style={styles.qrSection}>
                          <Text style={styles.qrHeader}>•• DIGITAL BILL PDF ••</Text>
                          <View style={styles.qrFrame}>
                            <QRCode value={buildBillPdfUrl(editableSale)} size={receiptStandardQrHtmlPxFromChip(receiptQrSize)} />
                          </View>
                          <Text style={styles.qrFooter}>Scan to view & download bill PDF</Text>
                        </View>
                      ) : null}

                      {/* Footer Policy */}
                      <View style={styles.footerSection}>
                        <Text style={styles.footerMsg}>{editableSale.footerMessage || storeProfile.footerMessage || 'Thank you for shopping with us!'}</Text>
                        <Text style={styles.footerTerms}>Goods once sold cannot be returned.</Text>
                      </View>

                      {/* Bottom Tear Edge */}
                      <View style={styles.tearEdgeBottom} />
                    </View>
                  )}
                </ScrollView>
              ) : (
                /* TAB 2: LIVE DETAILS & ITEMS INLINE EDITOR */
                <ScrollView
                  style={styles.paperScrollView}
                  contentContainerStyle={styles.editScrollContent}
                  showsVerticalScrollIndicator
                  keyboardShouldPersistTaps="handled"
                >
                  {/* Store Info Editor */}
                  <View style={[styles.editCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
                    <Text style={[styles.editSectionTitle, { color: theme.textPrimary }]}>
                      <Store size={14} color={BRAND_COLORS.blue600} /> Store Header
                    </Text>
                    <View style={styles.editRow}>
                      <TextInput
                        style={[styles.editInput, { backgroundColor: theme.bg, color: theme.textPrimary, borderColor: theme.borderColor }]}
                        value={editableSale.storeName}
                        onChangeText={(t) => setEditableSale({ ...editableSale, storeName: t })}
                        placeholder="Business Name"
                        placeholderTextColor={theme.textSecondary}
                      />
                    </View>
                    <View style={styles.editRow}>
                      <TextInput
                        style={[styles.editInput, { backgroundColor: theme.bg, color: theme.textPrimary, borderColor: theme.borderColor }]}
                        value={editableSale.storePhone}
                        onChangeText={(t) => setEditableSale({ ...editableSale, storePhone: t })}
                        placeholder="Contact Phone"
                        placeholderTextColor={theme.textSecondary}
                      />
                    </View>
                    <View style={styles.editRow}>
                      <TextInput
                        style={[styles.editInput, { backgroundColor: theme.bg, color: theme.textPrimary, borderColor: theme.borderColor }]}
                        value={editableSale.storeGstin}
                        onChangeText={(t) => setEditableSale({ ...editableSale, storeGstin: t })}
                        placeholder="GSTIN No"
                        placeholderTextColor={theme.textSecondary}
                      />
                    </View>
                  </View>

                  {/* Customer & Bill Info */}
                  <View style={[styles.editCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
                    <Text style={[styles.editSectionTitle, { color: theme.textPrimary }]}>
                      <User size={14} color={BRAND_COLORS.blue600} /> Customer & Invoice
                    </Text>
                    <View style={styles.editRow}>
                      <TextInput
                        style={[styles.editInput, { backgroundColor: theme.bg, color: theme.textPrimary, borderColor: theme.borderColor }]}
                        value={editableSale.customerName}
                        onChangeText={(t) => setEditableSale({ ...editableSale, customerName: t })}
                        placeholder="Customer Name"
                        placeholderTextColor={theme.textSecondary}
                      />
                    </View>
                    <View style={styles.editRow}>
                      <TextInput
                        style={[styles.editInput, { backgroundColor: theme.bg, color: theme.textPrimary, borderColor: theme.borderColor }]}
                        value={editableSale.customerPhone}
                        onChangeText={(t) => setEditableSale({ ...editableSale, customerPhone: t })}
                        placeholder="Customer Phone (for WhatsApp)"
                        placeholderTextColor={theme.textSecondary}
                        keyboardType="phone-pad"
                      />
                    </View>
                  </View>

                  {/* Line Items Editor */}
                  <View style={[styles.editCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
                    <View style={styles.rowBetween}>
                      <Text style={[styles.editSectionTitle, { color: theme.textPrimary }]}>
                        <ShoppingBag size={14} color={BRAND_COLORS.blue600} /> Items List
                      </Text>
                      <TouchableOpacity onPress={handleAddItem} style={styles.addSmallBtn}>
                        <Plus size={13} color="#FFFFFF" />
                        <Text style={styles.addSmallBtnText}>Add Item</Text>
                      </TouchableOpacity>
                    </View>

                    {editableSale.items.map((item, idx) => (
                      <View key={idx} style={[styles.itemEditBox, { borderColor: theme.borderColor }]}>
                        <View style={styles.rowBetween}>
                          <TextInput
                            style={[styles.itemNameInput, { backgroundColor: theme.bg, color: theme.textPrimary, borderColor: theme.borderColor }]}
                            value={item.productName}
                            onChangeText={(t) => handleItemChange(idx, 'productName', t)}
                            placeholder="Item Name"
                            placeholderTextColor={theme.textSecondary}
                          />
                          <TouchableOpacity onPress={() => handleRemoveItem(idx)} style={styles.trashBtn}>
                            <Trash2 size={16} color="#EF4444" />
                          </TouchableOpacity>
                        </View>

                        <View style={styles.itemParamsRow}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.fieldLabel}>Qty</Text>
                            <TextInput
                              style={[styles.paramInput, { backgroundColor: theme.bg, color: theme.textPrimary, borderColor: theme.borderColor }]}
                              value={String(item.quantity)}
                              onChangeText={(t) => handleItemChange(idx, 'quantity', parseInt(t) || 1)}
                              keyboardType="numeric"
                            />
                          </View>
                          <View style={{ flex: 1.5, marginHorizontal: 6 }}>
                            <Text style={styles.fieldLabel}>Price (₹)</Text>
                            <TextInput
                              style={[styles.paramInput, { backgroundColor: theme.bg, color: theme.textPrimary, borderColor: theme.borderColor }]}
                              value={String(item.unitPrice)}
                              onChangeText={(t) => handleItemChange(idx, 'unitPrice', parseFloat(t) || 0)}
                              keyboardType="numeric"
                            />
                          </View>
                          <View style={{ flex: 1.2 }}>
                            <Text style={styles.fieldLabel}>Disc (₹)</Text>
                            <TextInput
                              style={[styles.paramInput, { backgroundColor: theme.bg, color: theme.textPrimary, borderColor: theme.borderColor }]}
                              value={String(item.discount || 0)}
                              onChangeText={(t) => handleItemChange(idx, 'discount', parseFloat(t) || 0)}
                              keyboardType="numeric"
                            />
                          </View>
                        </View>
                      </View>
                    ))}
                  </View>

                  {/* UPI VPA Editor */}
                  <View style={[styles.editCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
                    <Text style={[styles.editSectionTitle, { color: theme.textPrimary }]}>
                      <QrCode size={14} color={BRAND_COLORS.blue600} /> Payment UPI VPA
                    </Text>
                    <TextInput
                      style={[styles.editInput, { backgroundColor: theme.bg, color: theme.textPrimary, borderColor: theme.borderColor }]}
                      value={editableSale.upiId}
                      onChangeText={(t) => setEditableSale({ ...editableSale, upiId: t })}
                      placeholder="merchant@upi"
                      placeholderTextColor={theme.textSecondary}
                    />
                  </View>
                </ScrollView>
              )}

              {/* Action Buttons Bar */}
              <View style={styles.bottomBar}>
                {/* Editing is only offered before the bill has been printed. Once a
                    physical copy exists, changing it silently would leave the customer
                    holding a receipt that no longer matches the recorded sale. */}
                {onEdit && !hasPrinted ? (
                  <TouchableOpacity onPress={onEdit} style={[styles.editBillBtn, { borderColor: theme.borderColor }]}>
                    <Edit3 size={15} color={theme.textPrimary} />
                    <Text style={[styles.editBillBtnText, { color: theme.textPrimary }]}>
                      Edit Bill
                    </Text>
                  </TouchableOpacity>
                ) : null}

                {hasPrinted ? (
                  <View style={styles.reprintNotice}>
                    <Text style={styles.reprintNoticeText}>
                      Already printed — printing again gives the customer a second copy.
                    </Text>
                  </View>
                ) : null}

                <View style={styles.actionRow}>
                  <TouchableOpacity
                    onPress={handlePrintThermal}
                    disabled={printDisabled}
                    style={[styles.primaryActionBtn, printDisabled && styles.actionBtnDisabled]}
                  >
                    {isPrinting ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <Printer size={16} color="#FFFFFF" />
                        <Text style={styles.primaryActionText}>
                          {hasPrinted ? 'Reprint' : 'Thermal Print'}
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={handleSystemPrint}
                    disabled={printDisabled}
                    style={[styles.secondaryActionBtn, { borderColor: theme.borderColor }]}
                  >
                    <ExternalLink size={15} color={theme.textPrimary} />
                    <Text style={[styles.secondaryActionText, { color: theme.textPrimary }]}>A4 Print</Text>
                  </TouchableOpacity>

                  <TouchableOpacity onPress={handleWhatsAppShare} style={styles.whatsAppBtn}>
                    <Share2 size={15} color="#10B981" />
                    <Text style={styles.whatsAppBtnText}>WhatsApp</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </SafeAreaView>
        </Modal>
      ) : null}

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
  fullScreenContainer: {
    flex: 1,
  },
  fullScreenContent: {
    flex: 1,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalTitle: { fontSize: 16, fontWeight: '900' },
  closeBtn: {
    padding: 6,
    borderRadius: 10,
    marginLeft: 6,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(100, 116, 139, 0.15)',
    borderRadius: 10,
    padding: 3,
  },
  tabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: 9,
    borderRadius: 8,
    gap: 4,
  },
  tabBtnActive: {
    backgroundColor: BRAND_COLORS.blue600,
  },
  tabBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
  },
  tabBtnTextActive: {
    color: '#FFFFFF',
  },
  printerStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 10,
  },
  printerStatusText: { fontSize: 11, fontWeight: '800', marginLeft: 6 },
  paperScrollView: { flex: 1, minHeight: 200 },
  paperScrollContent: { paddingVertical: 8, alignItems: 'center' },
  editScrollContent: { paddingVertical: 6, gap: 10 },

  paperWidthPillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 10,
    backgroundColor: 'rgba(100, 116, 139, 0.12)',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  paperWidthLabel: {
    fontSize: 10.5,
    fontWeight: '800',
    marginRight: 4,
  },
  paperWidthBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: 'transparent',
  },
  paperWidthBtnActive: {
    backgroundColor: BRAND_COLORS.blue600,
  },
  paperWidthBtnText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#64748B',
  },
  paperWidthBtnTextActive: {
    color: '#FFFFFF',
  },
  docTypeBanner: {
    alignItems: 'center',
    paddingVertical: 3,
    marginBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
  },
  docTypeText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#000000',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    letterSpacing: 0.5,
  },

  /* Realistic Thermal Ticket Styles */
  realisticPaper: {
    backgroundColor: '#FAF9F5',
    borderRadius: 4,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  tearEdgeTop: {
    height: 3,
    borderBottomWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#CBD5E1',
    marginBottom: 8,
  },
  tearEdgeBottom: {
    height: 3,
    borderTopWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#CBD5E1',
    marginTop: 12,
  },
  receiptHeader: { alignItems: 'center', marginBottom: 6 },
  storeLogo: { maxWidth: 180, maxHeight: 56, width: '60%', height: 48, resizeMode: 'contain', alignSelf: 'center', marginBottom: 6 },
  thermalTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: '#000000',
    textAlign: 'center',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    textTransform: 'uppercase',
  },
  thermalSub: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
    textAlign: 'center',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginTop: 2,
  },
  thermalGstin: {
    fontSize: 10,
    fontWeight: '900',
    color: '#000000',
    textAlign: 'center',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginTop: 2,
  },
  dashedLine: {
    borderBottomWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#000000',
    marginVertical: 6,
  },
  metaBlock: { gap: 2 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  monoLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#475569',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  monoValue: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#000000',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  monoValueBold: {
    fontSize: 11,
    fontWeight: '900',
    color: '#000000',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  tableHeaderRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderColor: '#000000',
    paddingBottom: 3,
    marginBottom: 4,
  },
  monoHeader: {
    fontSize: 10,
    fontWeight: '900',
    color: '#000000',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    textTransform: 'uppercase',
  },
  itemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 2 },
  monoItemName: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#000000',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  monoItemText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#000000',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  monoItemBold: {
    fontSize: 10.5,
    fontWeight: '900',
    color: '#000000',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  totalsBlock: { gap: 3 },
  grandTotalBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#000000',
    padding: 5,
    marginTop: 4,
    backgroundColor: 'rgba(0,0,0,0.03)',
  },
  grandTotalLabel: {
    fontSize: 12,
    fontWeight: '900',
    color: '#000000',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  grandTotalValue: {
    fontSize: 13.5,
    fontWeight: '900',
    color: '#000000',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  qrSection: { alignItems: 'center', marginVertical: 8 },
  qrHeader: {
    fontSize: 9,
    fontWeight: '900',
    color: '#000000',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginBottom: 4,
  },
  qrFrame: {
    padding: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#000000',
    borderRadius: 4,
  },
  qrFooter: {
    fontSize: 8.5,
    fontWeight: '700',
    color: '#475569',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginTop: 3,
  },
  barcodeSection: { alignItems: 'center', marginTop: 4 },
  barcodeText: {
    fontSize: 10,
    fontWeight: '900',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  barcodeLines: {
    width: 140,
    height: 18,
    backgroundColor: '#000000',
    opacity: 0.75,
    marginTop: 2,
    borderRadius: 1,
  },
  footerSection: { alignItems: 'center', marginTop: 6, gap: 2 },
  footerMsg: {
    fontSize: 9.5,
    fontWeight: '900',
    color: '#000000',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  footerTerms: {
    fontSize: 8.5,
    fontWeight: '600',
    color: '#64748B',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },

  /* Inline Editor Styles */
  editCard: {
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    gap: 8,
  },
  editSectionTitle: { fontSize: 13, fontWeight: '800', flexDirection: 'row', alignItems: 'center', gap: 6 },
  editRow: { width: '100%' },
  editInput: {
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    fontSize: 12,
    fontWeight: '700',
  },
  addSmallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: BRAND_COLORS.blue600,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    gap: 4,
  },
  addSmallBtnText: { fontSize: 10.5, fontWeight: '800', color: '#FFFFFF' },
  itemEditBox: {
    padding: 8,
    borderWidth: 1,
    borderRadius: 10,
    marginTop: 6,
    gap: 6,
  },
  itemNameInput: {
    flex: 1,
    height: 34,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 8,
    fontSize: 12,
    fontWeight: '700',
  },
  trashBtn: { padding: 6, marginLeft: 4 },
  itemParamsRow: { flexDirection: 'row', alignItems: 'center' },
  fieldLabel: { fontSize: 9.5, fontWeight: '700', color: '#94A3B8', marginBottom: 2 },
  paramInput: {
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 6,
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },

  /* Bottom Actions */
  bottomBar: { paddingTop: 10, borderTopWidth: 1, borderColor: 'rgba(100, 116, 139, 0.2)' },
  editBillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 11,
    marginBottom: 8,
  },
  editBillBtnText: { fontSize: 13, fontWeight: '800', marginLeft: 7 },
  reprintNotice: {
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 8,
  },
  reprintNoticeText: { fontSize: 11, fontWeight: '700', color: '#F59E0B', lineHeight: 15 },
  actionRow: { flexDirection: 'row', gap: 8 },
  primaryActionBtn: {
    flex: 1.6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BRAND_COLORS.blue600,
    paddingVertical: 12,
    borderRadius: 14,
    gap: 6,
    elevation: 3,
  },
  primaryActionText: { fontSize: 13, fontWeight: '900', color: '#FFFFFF' },
  secondaryActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    paddingVertical: 12,
    borderRadius: 14,
    gap: 5,
  },
  secondaryActionText: { fontSize: 12, fontWeight: '800' },
  whatsAppBtn: {
    flex: 1.1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    paddingVertical: 12,
    borderRadius: 14,
    gap: 5,
  },
  whatsAppBtnText: { fontSize: 12, fontWeight: '800', color: '#10B981' },
  actionBtnDisabled: { opacity: 0.5 },
});
