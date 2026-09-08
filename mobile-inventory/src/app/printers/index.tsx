import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  StyleSheet,
  Platform,
  Switch,
  StatusBar,
  Vibration,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Bluetooth,
  Printer,
  LayoutGrid,
  Plus,
  Minus,
  GripVertical,
  CheckCircle2,
  RefreshCw,
  Save,
  Tag,
  FileText,
  HelpCircle,
  Smartphone,
  ExternalLink,
  Trash2,
  Printer as PrinterIcon,
  Info,
  Layers,
  ChevronRight,
  Sparkles,
  Search,
  X,
  Receipt,
  QrCode,
  Edit2,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { usePrinterStore } from '@/store/usePrinterStore';
import ThermalPrinterService, { PrintSaleData, ReceiptPrintOptions } from '@/services/PrinterService';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useSettings } from '@/hooks/useSettings';
import { useStoreProfile } from '@/hooks/useStoreProfile';
import { TaxBillingPrinterSection } from '@/components/billing/TaxBillingPrinterSection';
import { ReceiptTemplateMockup } from '@/components/ui/ReceiptTemplateMockup';
import { CustomReceiptMockup } from '@/components/ui/CustomReceiptMockup';
import {
  RECEIPT_TEMPLATES,
  TEMPLATE_CATEGORIES,
  TemplateCategory,
  getTemplateById,
} from '@/constants/receiptTemplates';
import { LABEL_SIZE_PRESETS } from '@/constants/labelSizePresets';
import { JoshPrinterCard } from '@/components/printers/JoshPrinterCard';
import { YxPrinterCard } from '@/components/printers/YxPrinterCard';
import { AiBillToReceiptModal } from '@/components/printers/AiBillToReceiptModal';
import { BRAND_COLORS } from '@/constants/theme';
import { useTranslation } from '@/store/useLanguageStore';
import { SequencePrintPrompt } from '@/components/label-studio/SequencePrintPrompt';
import { buildTestReceiptPrintOptions } from '@/utils/fastSaleCheckout';
import type { ReceiptSizeChip } from '@shared/receiptPrintGeometry';
import {
  DEFAULT_RECEIPT_FONT,
  RECEIPT_FONT_LIBRARY,
  receiptFontRnFamily,
  type ReceiptFontId,
} from '@shared/receiptFonts';

// Stable sample product for label test-prints — module-level so it isn't rebuilt every render;
// same values printTestLabel's own internal default uses.
const sampleTestProduct = {
  id: 'sample-test-product',
  name: 'Organic Basmati Rice 5kg',
  sellingPrice: 480.0,
  costPrice: 380.0,
  currentStock: 0,
  lowStockThreshold: 0,
  unit: 'kg',
  barcode: '8901234567890',
  taxRate: 5,
  priceIncludesGst: true,
  isActive: true,
};

export default function PrintersScreen() {
  const router = useRouter();
  const { t, currentLanguage } = useTranslation();
  const { settings } = useSettings();
  const storeProfile = useStoreProfile();
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const topPadding = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0, 12);

  const {
    activeDevice,
    connectionState,
    scanForDevices,
    connectDevice,
    disconnectDevice,
    addPairedPrinter,
    forgetPrinter,
    pairedPrinters,
    scannedDevices,
    isScanning,
    warningText,
    nativeModuleAvailable,
    activeTemplateId,
    savePrinterCalibration,
    setActiveTemplate,
    hydrateFromSettings,
    labelPaperMode,
    setLabelPaperMode,
    labelWidthMm,
    labelHeightMm,
    labelGapMm,
    setLabelWidthMm,
    setLabelHeightMm,
    setLabelGapMm,
    labelTemplates,
    activeLabelTemplateId,
    customTemplates,
    activeCustomTemplateId,
    setActiveCustomTemplate,
    enableBillQrCode,
    setEnableBillQrCode,
    compactMode,
    setCompactMode,
    setReceiptLogoSize,
    setReceiptQrSize,
  } = usePrinterStore();
  const activeLabelTemplate = labelTemplates.find((t) => t.id === activeLabelTemplateId) || null;
  const activeCustomTemplate = customTemplates.find((t) => t.id === activeCustomTemplateId) || null;
  const hasSequenceElement =
    activeLabelTemplate?.elements.some((el) => el.type === 'text' && el.binding === 'sequence') ?? false;

  const [activeTab, setActiveTab] = useState<'receipt' | 'label' | 'templates'>('receipt');
  // Note: A4 physical printer tab is hidden per user specification (only PDF invoice export is provided)
  const [isPrintingA4, setIsPrintingA4] = useState(false);
  const [showAiBillModal, setShowAiBillModal] = useState(false);
  const [showSequencePrompt, setShowSequencePrompt] = useState(false);
  const [seqProgress, setSeqProgress] = useState(0);
  const [isSeqPrinting, setIsSeqPrinting] = useState(false);

  // Template Search & Category Filter States
  const [templateSearch, setTemplateSearch] = useState('');
  const [templateCategory, setTemplateCategory] = useState<TemplateCategory>('all');

  const filteredCustomTemplates = useMemo(() => {
    if (templateCategory !== 'all' && templateCategory !== 'custom') return [];
    if (!templateSearch.trim()) return customTemplates;
    const q = templateSearch.toLowerCase().trim();
    return customTemplates.filter(
      (ct) =>
        ct.name.toLowerCase().includes(q) ||
        (ct.description && ct.description.toLowerCase().includes(q))
    );
  }, [customTemplates, templateSearch, templateCategory]);

  const filteredTemplates = useMemo(() => {
    if (templateCategory === 'custom') return [];
    return RECEIPT_TEMPLATES.filter((t) => {
      const matchCategory = templateCategory === 'all' || t.category === templateCategory;
      if (!matchCategory) return false;

      if (!templateSearch.trim()) return true;
      const q = templateSearch.toLowerCase().trim();
      return (
        t.name.toLowerCase().includes(q) ||
        t.tagline.toLowerCase().includes(q) ||
        t.billLabel.toLowerCase().includes(q) ||
        t.itemLabel.toLowerCase().includes(q) ||
        (t.keywords && t.keywords.some((k) => k.toLowerCase().includes(q)))
      );
    });
  }, [templateSearch, templateCategory]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {
      all: RECEIPT_TEMPLATES.length + customTemplates.length,
      custom: customTemplates.length,
    };
    RECEIPT_TEMPLATES.forEach((t) => {
      counts[t.category] = (counts[t.category] || 0) + 1;
    });
    return counts;
  }, [customTemplates]);

  // Calibration Steppers State — seeded from the store once hydrateFromSettings() resolves,
  // so a real saved calibration doesn't get overwritten by these UI defaults on every open.
  const [paperWidthVal, setPaperWidthVal] = useState(58);
  const [topMarginVal, setTopMarginVal] = useState(2);
  const [printDensityVal, setPrintDensityVal] = useState(5);
  const [autoCutVal, setAutoCutVal] = useState(true);
  const [fontSizeVal, setFontSizeVal] = useState<'small' | 'medium' | 'large'>('medium');
  const [receiptFontVal, setReceiptFontVal] = useState<ReceiptFontId>(DEFAULT_RECEIPT_FONT);
  const [receiptLogoSizeVal, setReceiptLogoSizeVal] = useState<ReceiptSizeChip>('medium');
  const [receiptQrSizeVal, setReceiptQrSizeVal] = useState<ReceiptSizeChip>('medium');
  const [printCopiesVal, setPrintCopiesVal] = useState(1);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [showPairingGuide, setShowPairingGuide] = useState(false);

  // Device Scanner & Discovery Modal State
  const [showDeviceModal, setShowDeviceModal] = useState(false);
  const [showAllDevices, setShowAllDevices] = useState(false);

  // Manual Add BT Printer State — always starts closed; only opens when the user taps "+ Add Manually".
  const [manualName, setManualName] = useState('');
  const [manualMac, setManualMac] = useState('');
  const [showManualAdd, setShowManualAdd] = useState(false);

  // Label Reorder Elements State
  const [labelElements] = useState([
    { id: '1', name: 'Store Name (Header)', enabled: true },
    { id: '2', name: 'Product Name', enabled: true },
    { id: '3', name: 'Selling Price (MRP)', enabled: true },
    { id: '4', name: 'Barcode / QR Code', enabled: true },
  ]);

  useEffect(() => {
    // Seed the local calibration steppers from the persisted backend values once hydration
    // resolves. Done in the promise continuation (not synchronously in the effect body) so the
    // steppers only reflect real saved values, without a first render showing stale defaults.
    hydrateFromSettings().then(() => {
      const s = usePrinterStore.getState();
      setPaperWidthVal(s.paperWidth === '80mm' ? 80 : 58);
      setTopMarginVal(s.topMargin);
      setPrintDensityVal(s.printDensity);
      setAutoCutVal(s.autoCut);
      setFontSizeVal(s.fontSize);
      setReceiptFontVal(s.receiptFont || DEFAULT_RECEIPT_FONT);
      setReceiptLogoSizeVal(s.receiptLogoSize);
      setReceiptQrSizeVal(s.receiptQrSize);
      setPrintCopiesVal(s.printCopies);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeTemplate = getTemplateById(activeTemplateId);

  const handleAddManualPrinter = async () => {
    if (!manualName.trim()) {
      Alert.alert('Required Name', 'Please enter a printer name (e.g. PT-210 Receipt Printer).');
      return;
    }

    const mac = manualMac.trim().toUpperCase();
    // A MAC is the only thing that can actually be connected to, so it can't be defaulted. The
    // previous placeholder address produced an entry that looked paired but could never print.
    if (!/^([0-9A-F]{2}:){5}[0-9A-F]{2}$/.test(mac)) {
      Alert.alert(
        'Valid MAC Address Required',
        'Enter the printer\'s Bluetooth MAC address in the form 86:0A:7D:2E:3F:11. You can find it in the phone\'s Bluetooth settings after pairing the printer there.'
      );
      return;
    }

    // The MAC is the device identity on Android — a synthetic id would never resolve to a real device.
    const newDevice = {
      id: mac,
      name: manualName.trim(),
      macAddress: mac,
      type: (activeTab === 'label' ? 'label' : 'receipt') as any,
    };

    try {
      await addPairedPrinter(newDevice);
      setManualName('');
      setManualMac('');
      setShowManualAdd(false);
    } catch (e: any) {
      // Saved to the list either way, so the user can retry without retyping the address.
      Alert.alert(
        'Saved, But Not Connected',
        e?.message || `${newDevice.name} was saved but could not be reached. Check that it is switched on and in range, then tap Connect.`
      );
    }
  };

  /** connectDevice rejects on failure — surface it with a retry instead of leaving the row silent. */
  const handleConnectDevice = async (deviceId: string, deviceName?: string) => {
    // If the device is explicitly an LD/LP/Josh brand printer, offer Josh LPAPI connection, but don't hijack standard Bluetooth printers!
    const isDedicatedJoshModel = /^(LD|LP|JOSH)/i.test(deviceName || '');
    if (isDedicatedJoshModel && ThermalPrinterService.isJoshSupported()) {
      try {
        const ok = await ThermalPrinterService.joshConnect(deviceId, deviceName);
        if (ok) {
          try { Vibration.vibrate([0, 50, 40, 50]); } catch (e) {}
          return;
        }
      } catch (err: any) {
        // Fall through to standard Bluetooth socket connection
      }
    }

    try {
      await connectDevice(deviceId, deviceName);
    } catch (e: any) {
      Alert.alert(
        'Connection Failed',
        e?.message || 'Could not reach the printer. Check that it is switched on and in range.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Retry', onPress: () => handleConnectDevice(deviceId, deviceName) },
        ]
      );
    }
  };

  const handleScanBluetooth = async () => {
    setShowDeviceModal(true);
    if (!nativeModuleAvailable && Platform.OS !== 'web') {
      return;
    }
    await scanForDevices();
  };

  const handleSubmitSequence = async (startPattern: string, count: number) => {
    if (!activeLabelTemplate) return;
    const targetPaperWidth = paperWidthVal === 80 ? '80mm' : '58mm';
    setIsSeqPrinting(true);
    setSeqProgress(0);
    try {
      const result = await ThermalPrinterService.printLabelSequence(
        sampleTestProduct,
        activeLabelTemplate,
        { startPattern, count, mode: labelPaperMode, paperWidth: targetPaperWidth, labelGapMm },
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
      setIsSeqPrinting(false);
      setSeqProgress(0);
    }
  };

  const handleSelectSystemPrinter = async () => {
    try {
      const printer = await ThermalPrinterService.selectSystemPrinter();
      if (printer) {
        addPairedPrinter({
          id: printer.id,
          name: printer.name,
          macAddress: printer.macAddress || printer.id,
          type: 'receipt',
        });
      }
    } catch (e: any) {
      Alert.alert('System Printer Dialog', 'Please pair your thermal printer in Phone Settings -> Bluetooth first.');
    }
  };

  // A4 invoices go through the OS Print Framework (expo-print), not the Bluetooth ESC/POS SDK —
  // see PrinterService.generateA4InvoiceHtml for why those are two genuinely different protocols.
  const handleTestA4Invoice = async () => {
    setIsPrintingA4(true);
    try {
      const sampleData: PrintSaleData = {
        storeName: storeProfile.storeName,
        storeAddress: storeProfile.storeAddress,
        storePhone: storeProfile.storePhone,
        storeGstin: storeProfile.storeGstin,
        storeLogoUrl: printOptions.storeLogoUrl,
        upiId: storeProfile.upiId || undefined,
        invoiceNumber: `INV-${Math.floor(1000 + Math.random() * 9000)}`,
        date: new Date().toLocaleDateString('en-GB'),
        customerName: 'Test Customer',
        items: [
          { productName: 'Organic Basmati Rice 5kg', quantity: 1, unitPrice: 480.0, total: 480.0, gstRate: 5 },
          { productName: 'Fresh Cow Milk 1L', quantity: 2, unitPrice: 66.0, total: 132.0, gstRate: 0 },
          { productName: 'Filter Coffee 250g', quantity: 1, unitPrice: 210.0, total: 210.0, gstRate: 18 },
        ],
        subtotal: 822.0,
        totalDiscount: 22.0,
        totalTax: 18.0,
        grandTotal: 818.0,
        amountPaid: 818.0,
        changeReturned: 0,
        paymentMethod: 'CASH (A4 INVOICE)',
      };
      const ok = await ThermalPrinterService.printA4Invoice(sampleData, { template: activeTemplate });
      if (ok) Alert.alert('A4 Invoice Sent', 'The system print dialog should have opened — pick your A4 printer there.');
    } catch (e: any) {
      Alert.alert('A4 Print Failed', e?.message || 'Could not open the print dialog.');
    } finally {
      setIsPrintingA4(false);
    }
  };

  const handleSavePrinterSettings = async () => {
    setIsSavingSettings(true);
    try {
      await savePrinterCalibration({
        paperWidth: paperWidthVal === 80 ? '80mm' : '58mm',
        printDensity: printDensityVal,
        topMargin: topMarginVal,
        autoCut: autoCutVal,
        printCopies: printCopiesVal,
        fontSize: fontSizeVal,
        receiptFont: receiptFontVal,
        receiptLogoSize: receiptLogoSizeVal,
        receiptQrSize: receiptQrSizeVal,
        labelPaperMode,
        labelWidthMm,
        labelHeightMm,
        labelGapMm,
      });
      Alert.alert('Configuration Saved!', 'Bluetooth thermal printer settings updated & synced.');
    } catch (e: any) {
      Alert.alert('Saved Locally', 'Could not sync to the server, but your settings are active on this device.');
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleSelectTemplate = async (templateId: string) => {
    try {
      await setActiveTemplate(templateId);
      await setActiveCustomTemplate(null);
      const t = getTemplateById(templateId);
      Alert.alert(`${t.name} Selected!`, `New bills from POS / POS Lite will now print using the ${t.name} format.`);
    } catch (e: any) {
      Alert.alert('Template Selection Failed', e?.message || 'Could not save your template choice. Please try again.');
    }
  };

  const handleSelectCustomTemplate = async (customId: string) => {
    try {
      await setActiveCustomTemplate(customId);
      const ct = customTemplates.find((c) => c.id === customId);
      Alert.alert('Custom Receipt Selected!', `New bills from POS / POS Lite will now print using "${ct?.name || 'Custom Receipt'}".`);
    } catch (e: any) {
      Alert.alert('Selection Failed', e?.message || 'Could not set active custom template.');
    }
  };

  const printOptions: ReceiptPrintOptions = buildTestReceiptPrintOptions({
    activeTemplateId,
    customTemplates,
    activeCustomTemplateId,
    enableBillQrCode,
    topMargin: topMarginVal,
    autoCut: autoCutVal,
    fontSize: fontSizeVal,
    receiptFont: receiptFontVal,
    compactMode,
    receiptLogoSize: receiptLogoSizeVal,
    receiptQrSize: receiptQrSizeVal,
    settings,
    customTemplate: activeCustomTemplate,
    copies: 1,
  });

  return (
    <View style={[styles.container, { backgroundColor: theme.bg, paddingTop: topPadding }]}>
      <StatusBar
        barStyle={theme.isDark ? 'light-content' : 'dark-content'}
        backgroundColor={theme.bg}
      />
      <View style={styles.mainWrapper}>
        <View style={styles.headerRow}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtn}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <ArrowLeft size={20} color={theme.textSecondary} />
            <Text style={[styles.backBtnText, { color: theme.textSecondary }]}>{t('back', 'Back')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setShowPairingGuide(!showPairingGuide)}
            style={styles.guideToggleBtn}
          >
            <HelpCircle size={15} color={BRAND_COLORS.blue600} />
            <Text style={styles.guideToggleBtnText}>Setup Guide</Text>
          </TouchableOpacity>
        </View>

        {/* Phone Bluetooth Pairing Step-by-Step Banner — hidden by default, only shown via "Setup Guide" above */}
        {showPairingGuide ? (
          <View style={[styles.guideCard, { backgroundColor: 'rgba(37, 99, 235, 0.08)', borderColor: 'rgba(37, 99, 235, 0.25)' }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <Smartphone size={18} color={BRAND_COLORS.blue600} />
              <Text style={[styles.guideTitle, { color: BRAND_COLORS.blue600 }]}>
                Phone Bluetooth Thermal Printer Guide
              </Text>
            </View>
            <Text style={[styles.guideStep, { color: theme.textPrimary }]}>
              1️⃣ Turn on your thermal printer & enable Bluetooth on your phone.
            </Text>
            <Text style={[styles.guideStep, { color: theme.textPrimary }]}>
              2️⃣ Open <Text style={{ fontWeight: '800' }}>Phone Settings ➔ Bluetooth</Text> and pair printer (Passcode: <Text style={{ fontWeight: '800' }}>0000</Text> or <Text style={{ fontWeight: '800' }}>1234</Text>).
            </Text>
            <Text style={[styles.guideStep, { color: theme.textPrimary }]}>
              3️⃣ Tap <Text style={{ fontWeight: '800' }}>"Scan BT"</Text> or <Text style={{ fontWeight: '800' }}>"Connect"</Text> below to pair your printer!
            </Text>
          </View>
        ) : null}

        {/* Printer status card.
            Replaces a full-bleed blue panel with white-on-blue controls: on a
            status surface the colour has to carry meaning, so the card stays
            neutral and only the state dot and its caption change colour. */}
        <View style={[styles.statusCard, { backgroundColor: theme.cardBg, borderColor: connectionState === 'connected' ? '#10B981' : theme.borderColor }]}>
          <View style={styles.statusTopRow}>
            <View style={[styles.statusIcon, { backgroundColor: connectionState === 'connected' ? 'rgba(16,185,129,0.12)' : 'rgba(100,116,139,0.12)' }]}>
              <Printer size={20} color={connectionState === 'connected' ? '#10B981' : theme.textSecondary} />
            </View>

            <View style={{ flex: 1, marginLeft: 12, marginRight: 10 }}>
              <Text style={[styles.statusTitle, { color: theme.textPrimary }]} numberOfLines={1}>
                {activeDevice ? activeDevice.name : 'No printer connected'}
              </Text>
              <View style={styles.statusLine}>
                <View
                  style={[
                    styles.statusDot,
                    { backgroundColor: connectionState === 'connected' ? '#10B981' : '#F59E0B' },
                  ]}
                />
                <Text style={[styles.statusCaption, { color: theme.textSecondary }]} numberOfLines={1}>
                  {connectionState === 'connected'
                    ? `Ready · ${paperWidthVal}mm paper`
                    : 'Tap Find Printers to connect one'}
                </Text>
              </View>
            </View>
          </View>

          {!nativeModuleAvailable && Platform.OS !== 'web' ? (
            <View style={styles.warnBanner}>
              <Text style={styles.warnBannerText}>
                This build has no Bluetooth support. Install a development build to connect a printer.
              </Text>
            </View>
          ) : warningText ? (
            <View style={styles.warnBanner}>
              <Text style={styles.warnBannerText}>{warningText}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            onPress={handleScanBluetooth}
            disabled={isScanning}
            style={[styles.primaryAction, { opacity: isScanning ? 0.6 : 1 }]}
          >
            {isScanning ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Bluetooth size={16} color="#FFFFFF" />
                <Text style={styles.primaryActionText}>
                  {activeDevice ? 'Change Printer' : 'Find Printers'}
                </Text>
              </>
            )}
          </TouchableOpacity>

          {/* Test prints. Given their own labelled row rather than three cramped
              10px chips, since this is how a shop confirms the printer works. */}
          <Text style={[styles.rowCaption, { color: theme.textSecondary }]}>SEND A TEST PRINT</Text>
          <View style={styles.testRow}>
            <TouchableOpacity
              onPress={async () => {
                const ok = await ThermalPrinterService.printTestReceipt(paperWidthVal === 80 ? '80mm' : '58mm', printOptions);
                const activeName = activeCustomTemplate ? activeCustomTemplate.name : activeTemplate.name;
                if (ok) Alert.alert('Test Receipt Sent', `Printed using "${activeName}".`);
              }}
              style={[styles.testBtn, { borderColor: theme.borderColor, backgroundColor: theme.bg }]}
            >
              <FileText size={15} color={theme.textPrimary} />
              <Text style={[styles.testBtnText, { color: theme.textPrimary }]} numberOfLines={1}>
                Receipt
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={async () => {
                const targetPaperWidth = paperWidthVal === 80 ? '80mm' : '58mm';
                if (activeLabelTemplate && hasSequenceElement) {
                  setShowSequencePrompt(true);
                  return;
                }
                if (activeLabelTemplate) {
                  // Test the actual saved Label Studio template (not the auto-layout) with sample
                  // product data — same sample values printTestLabel below uses. Which native
                  // pipeline it goes through depends on labelPaperMode: TSPL commands would print
                  // as gibberish text on the ESC/POS receipt printer, so 'continuous' routes through
                  // the ESC/POS sequential renderer instead.
                  const ok =
                    labelPaperMode === 'continuous'
                      ? await ThermalPrinterService.printLabelTemplateOnReceiptPaper(sampleTestProduct, activeLabelTemplate, targetPaperWidth)
                      : await ThermalPrinterService.printLabelFromTemplate(sampleTestProduct, activeLabelTemplate, 1, labelGapMm);
                  if (ok) Alert.alert('Test Label Sent', `Printed using the "${activeLabelTemplate.name}" template.`);
                  else Alert.alert('Print Failed', 'Could not reach the connected printer.');
                } else if (labelPaperMode === 'continuous') {
                  const ok = await ThermalPrinterService.printTestLabelOnReceiptPaper('qr', targetPaperWidth);
                  if (ok) Alert.alert('Test Label Sent', 'Barcode/QR label printed on the receipt roll.');
                  else Alert.alert('Print Failed', 'Could not reach the connected receipt printer.');
                } else {
                  const ok = await ThermalPrinterService.printTestLabel(undefined, printDensityVal, 'ean13', labelWidthMm, labelHeightMm, labelGapMm);
                  if (ok) Alert.alert('Test Label Sent', `Printed for a ${labelWidthMm}x${labelHeightMm}mm label.`);
                }
              }}
              style={[styles.testBtn, { borderColor: theme.borderColor, backgroundColor: theme.bg }]}
            >
              <Tag size={15} color={theme.textPrimary} />
              <Text style={[styles.testBtnText, { color: theme.textPrimary }]} numberOfLines={1}>
                Label
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleSelectSystemPrinter}
              style={[styles.testBtn, { borderColor: theme.borderColor, backgroundColor: theme.bg }]}
            >
              <ExternalLink size={15} color={theme.textPrimary} />
              <Text style={[styles.testBtnText, { color: theme.textPrimary }]} numberOfLines={1}>
                A4 / PDF
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 3-Tab Segmented Control (Invoice printing tab hidden per specification) */}
        <View style={[styles.segmentedBar, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
          {(['receipt', 'label', 'templates'] as const).map((tab) => {
            const selected = activeTab === tab;
            return (
              <TouchableOpacity
                key={tab}
                onPress={() => setActiveTab(tab)}
                style={[styles.segBtn, selected && styles.segBtnActive]}
              >
                {tab === 'receipt' ? (
                  <FileText size={14} color={selected ? '#FFFFFF' : '#64748B'} />
                ) : tab === 'label' ? (
                  <Tag size={14} color={selected ? '#FFFFFF' : '#64748B'} />
                ) : (
                  <LayoutGrid size={14} color={selected ? '#FFFFFF' : '#64748B'} />
                )}
                <Text style={[styles.segText, selected && styles.segTextActive]}>
                  {tab === 'receipt' ? t('thermalPrinter', 'Receipt') : tab === 'label' ? t('labelStudio', 'Label') : t('receiptTemplates', 'Templates')}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }}>
          {activeTab === 'templates' ? (
            <>
              <Text style={[styles.title, { color: theme.textPrimary }]}>Receipt Templates</Text>
              <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
                Pick the format that matches your business. Every new bill from POS / POS Lite prints in this style until you change it.
              </Text>

              {/* Custom Receipt Builder Launch Banner */}
              <TouchableOpacity
                onPress={() => router.push('/printers/receipt-builder')}
                activeOpacity={0.88}
                style={[
                  styles.card,
                  {
                    backgroundColor: theme.cardBg,
                    borderColor: activeCustomTemplateId ? '#3B82F6' : BRAND_COLORS.blue600,
                    borderWidth: 1.5,
                    padding: 14,
                    marginBottom: 14,
                  },
                ]}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 12,
                      backgroundColor: '#EFF6FF',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: 12,
                    }}
                  >
                    <Receipt size={20} color="#2563EB" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: '800', color: theme.textPrimary }}>
                      Custom Receipt Builder & Studio
                    </Text>
                    <Text style={{ fontSize: 11, color: theme.textSecondary, marginTop: 2 }}>
                      {activeCustomTemplate
                        ? `Active: "${activeCustomTemplate.name}" • Tap to customize`
                        : 'Create unique receipt layouts with custom logos, lines, tables & QR codes'}
                    </Text>
                  </View>
                  <ChevronRight size={18} color="#2563EB" />
                </View>
              </TouchableOpacity>

              <TaxBillingPrinterSection
                theme={theme}
                compact
                hintText="Tax breakdown on printed slips follows your Tax & Billing settings below."
              />

              {/* Template Search Bar */}
              <View
                style={[
                  styles.templateSearchBar,
                  { backgroundColor: theme.cardBg, borderColor: theme.borderColor },
                ]}
              >
                <Search size={18} color={theme.textSecondary} style={{ marginRight: 8 }} />
                <TextInput
                  style={[styles.templateSearchInput, { color: theme.textPrimary }]}
                  placeholder="Search templates by business, tagline, or keyword..."
                  placeholderTextColor="#94A3B8"
                  value={templateSearch}
                  onChangeText={setTemplateSearch}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {templateSearch.length > 0 ? (
                  <TouchableOpacity onPress={() => setTemplateSearch('')} style={{ padding: 4 }}>
                    <X size={16} color={theme.textSecondary} />
                  </TouchableOpacity>
                ) : null}
              </View>

              {/* Category Horizontal Filter Pills */}
              <View style={{ marginBottom: 16 }}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 8, paddingVertical: 2 }}
                >
                  {TEMPLATE_CATEGORIES.map((cat) => {
                    const isSelected = templateCategory === cat.id;
                    const count = categoryCounts[cat.id] || 0;
                    return (
                      <TouchableOpacity
                        key={cat.id}
                        onPress={() => setTemplateCategory(cat.id)}
                        style={[
                          styles.catPill,
                          {
                            backgroundColor: isSelected ? BRAND_COLORS.navyInk : theme.cardBg,
                            borderColor: isSelected ? BRAND_COLORS.navyInk : theme.borderColor,
                          },
                        ]}
                        activeOpacity={0.8}
                      >
                        <Text
                          style={[
                            styles.catPillText,
                            { color: isSelected ? '#FFFFFF' : theme.textPrimary },
                          ]}
                        >
                          {cat.label}
                        </Text>
                        <View
                          style={[
                            styles.catCountBadge,
                            {
                              backgroundColor: isSelected
                                ? 'rgba(255, 255, 255, 0.2)'
                                : 'rgba(100, 116, 139, 0.12)',
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.catCountText,
                              { color: isSelected ? '#FFFFFF' : theme.textSecondary },
                            ]}
                          >
                            {count}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              {/* Result Summary Bar */}
              <View style={styles.resultsHeaderRow}>
                <Text style={[styles.resultsCountText, { color: theme.textSecondary }]}>
                  Showing {filteredTemplates.length + filteredCustomTemplates.length} of {RECEIPT_TEMPLATES.length + customTemplates.length} templates
                </Text>
                {(templateSearch.length > 0 || templateCategory !== 'all') && (
                  <TouchableOpacity
                    onPress={() => {
                      setTemplateSearch('');
                      setTemplateCategory('all');
                    }}
                  >
                    <Text style={styles.resetFilterText}>Clear Filters</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Templates List or Empty State */}
              {filteredTemplates.length === 0 && filteredCustomTemplates.length === 0 ? (
                <View style={[styles.emptyTemplateBox, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
                  {templateCategory === 'custom' ? (
                    <>
                      <Receipt size={36} color={BRAND_COLORS.blue600} style={{ marginBottom: 10 }} />
                      <Text style={[styles.emptyTemplateTitle, { color: theme.textPrimary }]}>
                        No Custom Receipts Yet
                      </Text>
                      <Text style={[styles.emptyTemplateSub, { color: theme.textSecondary }]}>
                        Design your own receipt with custom logos, text lines, items tables, and digital QR codes.
                      </Text>
                      <TouchableOpacity
                        onPress={() => router.push('/printers/receipt-builder')}
                        style={[styles.resetFilterBtn, { backgroundColor: BRAND_COLORS.blue600 }]}
                      >
                        <Text style={[styles.resetFilterBtnText, { color: '#FFF' }]}>+ Build Custom Receipt</Text>
                      </TouchableOpacity>
                    </>
                  ) : (
                    <>
                      <Search size={32} color={theme.textSecondary} style={{ marginBottom: 10 }} />
                      <Text style={[styles.emptyTemplateTitle, { color: theme.textPrimary }]}>
                        No templates found
                      </Text>
                      <Text style={[styles.emptyTemplateSub, { color: theme.textSecondary }]}>
                        No receipt layouts match "{templateSearch}". Try searching for another keyword or change category.
                      </Text>
                      <TouchableOpacity
                        onPress={() => {
                          setTemplateSearch('');
                          setTemplateCategory('all');
                        }}
                        style={styles.resetFilterBtn}
                      >
                        <Text style={styles.resetFilterBtnText}>Show All Templates</Text>
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              ) : (
                <View style={{ gap: 16 }}>
                  {/* 1. CUSTOM RECEIPTS (Rendered prominently when in All or Custom category) */}
                  {filteredCustomTemplates.map((ct) => {
                    const isCustomActive = ct.id === activeCustomTemplateId;
                    const activeEntriesCount = ct.entries.filter((e) => e.enabled).length;

                    return (
                      <TouchableOpacity
                        key={`custom-${ct.id}`}
                        activeOpacity={0.9}
                        onPress={() => handleSelectCustomTemplate(ct.id)}
                        style={[
                          styles.templateFullCard,
                          {
                            backgroundColor: theme.cardBg,
                            borderColor: isCustomActive ? '#10B981' : BRAND_COLORS.blue600,
                            borderWidth: isCustomActive ? 2.5 : 1.5,
                          },
                        ]}
                      >
                        {/* Card Title Header Bar */}
                        <View style={styles.templateCardHeaderRow}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8 }}>
                            <View
                              style={[
                                styles.templateIconBox,
                                {
                                  backgroundColor: isCustomActive ? 'rgba(16, 185, 129, 0.15)' : 'rgba(37, 99, 235, 0.15)',
                                  marginBottom: 0,
                                },
                              ]}
                            >
                              <Receipt size={20} color={isCustomActive ? '#10B981' : '#2563EB'} />
                            </View>
                            <View style={{ marginLeft: 10, flex: 1 }}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <Text style={[styles.templateName, { color: theme.textPrimary, textAlign: 'left', fontSize: 15 }]}>
                                  {ct.name}
                                </Text>
                                <View style={{ backgroundColor: '#EFF6FF', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                                  <Text style={{ fontSize: 10, fontWeight: '700', color: '#2563EB' }}>CUSTOM</Text>
                                </View>
                              </View>
                              <Text style={{ fontSize: 11, color: theme.textSecondary, fontWeight: '600', marginTop: 1 }} numberOfLines={1}>
                                {activeEntriesCount} blocks configured • {ct.paperWidth || '58mm'} Paper Roll
                              </Text>
                            </View>
                          </View>

                          {/* Selected Pill Badge */}
                          <View
                            style={[
                              styles.selectedPill,
                              { backgroundColor: isCustomActive ? 'rgba(16, 185, 129, 0.15)' : 'rgba(148, 163, 184, 0.15)' },
                            ]}
                          >
                            {isCustomActive ? <CheckCircle2 size={13} color="#10B981" style={{ marginRight: 4 }} /> : null}
                            <Text
                              style={{
                                fontSize: 11,
                                fontWeight: '800',
                                color: isCustomActive ? '#10B981' : theme.textSecondary,
                              }}
                            >
                              {isCustomActive ? 'ACTIVE' : 'SELECT'}
                            </Text>
                          </View>
                        </View>

                        {/* Real Visual Thermal Paper Receipt Preview with User-Entered Values */}
                        <View style={styles.previewPaperContainer}>
                          <CustomReceiptMockup
                            template={ct}
                            storeName={storeProfile.storeName}
                            storeAddress={settings?.businessAddress || ''}
                            storePhone={settings?.businessPhone || ''}
                            storeGstin={settings?.businessGSTIN || ''}
                            storeLogoUrl={printOptions.storeLogoUrl}
                            invoiceNumber="INV-1024"
                            date={new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                            customerName=""
                            paperWidth={ct.paperWidth || '58mm'}
                            upiId={settings?.upiId || ''}
                            logoSizeChip={receiptLogoSizeVal}
                            qrSizeChip={receiptQrSizeVal}
                          />

                          {/* Quick Action to Edit in Builder */}
                          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 10, borderTopWidth: 1, borderTopColor: theme.borderColor, paddingTop: 8 }}>
                            <TouchableOpacity
                              onPress={() => router.push({ pathname: '/printers/receipt-editor', params: { id: ct.id } })}
                              style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 6, paddingHorizontal: 12, backgroundColor: '#EFF6FF', borderRadius: 6 }}
                              activeOpacity={0.7}
                            >
                              <Edit2 size={13} color="#2563EB" />
                              <Text style={{ fontSize: 11, fontWeight: '700', color: '#2563EB' }}>Edit in Builder</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      </TouchableOpacity>
                    );
                  })}

                  {/* 2. STANDARD PRESET TEMPLATES */}
                  {filteredTemplates.map((t) => {
                    const selected = t.id === activeTemplateId && !activeCustomTemplateId;
                    const Icon = t.icon;

                    return (
                      <TouchableOpacity
                        key={t.id}
                        activeOpacity={0.9}
                        onPress={() => handleSelectTemplate(t.id)}
                        style={[
                          styles.templateFullCard,
                          {
                            backgroundColor: theme.cardBg,
                            borderColor: selected ? BRAND_COLORS.blue600 : theme.borderColor,
                            borderWidth: selected ? 2 : 1,
                          },
                        ]}
                      >
                        {/* Card Title Header Bar */}
                        <View style={styles.templateCardHeaderRow}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8 }}>
                            <View
                              style={[
                                styles.templateIconBox,
                                { backgroundColor: selected ? 'rgba(37, 99, 235, 0.15)' : 'rgba(100, 116, 139, 0.12)', marginBottom: 0 },
                              ]}
                            >
                              <Icon size={20} color={selected ? BRAND_COLORS.blue600 : theme.textSecondary} />
                            </View>
                            <View style={{ marginLeft: 10, flex: 1 }}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                                <Text style={[styles.templateName, { color: theme.textPrimary, textAlign: 'left', fontSize: 15 }]}>
                                  {t.name}
                                </Text>
                                {t.paperFit === '48mm' ? (
                                  <View style={{ backgroundColor: '#ECFDF5', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                                    <Text style={{ fontSize: 10, fontWeight: '800', color: '#047857' }}>48mm</Text>
                                  </View>
                                ) : null}
                              </View>
                              <Text style={{ fontSize: 11, color: theme.textSecondary, fontWeight: '600', marginTop: 1 }} numberOfLines={1}>
                                {t.tagline || `${t.billLabel} • ${t.itemColumnLeft}/${t.itemColumnRight}`}
                              </Text>
                            </View>
                          </View>

                          {/* Selected Pill Badge */}
                          <View
                            style={[
                              styles.selectedPill,
                              { backgroundColor: selected ? 'rgba(16, 185, 129, 0.15)' : 'rgba(148, 163, 184, 0.15)' },
                            ]}
                          >
                            {selected ? <CheckCircle2 size={13} color="#10B981" style={{ marginRight: 4 }} /> : null}
                            <Text
                              style={{
                                fontSize: 11,
                                fontWeight: '800',
                                color: selected ? '#10B981' : theme.textSecondary,
                              }}
                            >
                              {selected ? 'ACTIVE' : 'SELECT'}
                            </Text>
                          </View>
                        </View>

                        {/* Visual Thermal Paper Receipt Card */}
                        <View style={styles.previewPaperContainer}>
                          <ReceiptTemplateMockup
                            template={t}
                            storeName={t.previewStoreName || storeProfile.storeName}
                            storeAddress={t.previewAddress || settings?.businessAddress || '123 Market Road, City'}
                            storePhone={t.previewPhone || settings?.businessPhone || '9999999999'}
                            storeGstin={t.previewGstin}
                            invoiceNumber={t.previewInvoice || 'INV-1024'}
                            date={
                              t.previewDate ||
                              new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                            }
                            customerName={t.previewCustomerName || 'Walk-in Customer'}
                            customerPhone={t.previewCustomerPhone}
                            tableNo={t.previewTableNo}
                            waiterName={t.previewWaiter}
                            invoiceConfig={settings?.invoiceConfig}
                          />
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </>
          ) : (
            <>
              {/* AI A4 BILL TO THERMAL RECEIPT CONVERTER */}
              <TouchableOpacity
                onPress={() => setShowAiBillModal(true)}
                activeOpacity={0.88}
                style={[styles.card, { backgroundColor: BRAND_COLORS.navyInk, borderColor: BRAND_COLORS.blue600, padding: 18, marginBottom: 12 }]}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: BRAND_COLORS.blue600, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                    <Sparkles size={22} color="#FFFFFF" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 16, fontWeight: '900', color: '#FFFFFF' }}>A4 Bill to Thermal Receipt (AI)</Text>
                    <Text style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>Upload or snap any invoice, bill, or receipt • Instant accurate extraction with AI • 1-tap print</Text>
                  </View>
                  <ChevronRight size={20} color="#FFFFFF" />
                </View>
              </TouchableOpacity>

              {/* CUSTOM RECEIPT BUILDER & DIGITAL QR CARD */}
              <TouchableOpacity
                onPress={() => router.push('/printers/receipt-builder')}
                activeOpacity={0.88}
                style={[
                  styles.card,
                  {
                    backgroundColor: theme.cardBg,
                    borderColor: activeCustomTemplateId ? '#3B82F6' : theme.borderColor,
                    borderWidth: activeCustomTemplateId ? 2 : 1,
                    padding: 16,
                    marginBottom: 14,
                  },
                ]}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 14,
                      backgroundColor: '#EFF6FF',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: 12,
                    }}
                  >
                    <Receipt size={22} color="#2563EB" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={{ fontSize: 15, fontWeight: '800', color: theme.textPrimary }}>
                        Build Custom Receipt
                      </Text>
                      {activeCustomTemplate && (
                        <View style={{ backgroundColor: '#DCFCE7', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                          <Text style={{ fontSize: 10, fontWeight: '700', color: '#16A34A' }}>Active</Text>
                        </View>
                      )}
                    </View>
                    <Text style={{ fontSize: 11, color: theme.textSecondary, marginTop: 2 }}>
                      {activeCustomTemplate
                        ? `Using "${activeCustomTemplate.name}" • Tap to customize layout`
                        : 'Design receipt layout, add custom blocks & enable Digital Bill QR'}
                    </Text>
                  </View>
                  <ChevronRight size={20} color={theme.textSecondary} />
                </View>
              </TouchableOpacity>

              {/* Dedicated LPAPI / Josh Dual-Mode Printer connector */}
              {ThermalPrinterService.isJoshSupported() && (
                <View style={{ marginBottom: 12 }}>
                  <Text style={[styles.sectionHeader, { marginBottom: 8 }]}>
                    JOSH DUAL-MODE SMART PRINTER (RECEIPTS & LABELS)
                  </Text>
                  <JoshPrinterCard />
                </View>
              )}

              {/* Section: PAIRED & DISCOVERED BLUETOOTH PRINTERS */}
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionHeader}>STANDARD THERMAL RECEIPT PRINTERS (ESC/POS) ({scannedDevices.length})</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <TouchableOpacity onPress={() => setShowDeviceModal(true)}>
                    <Text style={{ fontSize: 11, fontWeight: '800', color: BRAND_COLORS.blue600 }}>
                      Scan Devices
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setShowManualAdd(!showManualAdd)}>
                    <Text style={{ fontSize: 11, fontWeight: '800', color: BRAND_COLORS.blue600 }}>
                      {showManualAdd ? 'Cancel' : '+ Add Manually'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Manual Add Card — only appears when the user taps "+ Add Manually" above */}
              {showManualAdd ? (
                <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.borderColor, marginBottom: 14 }]}>
                  <Text style={{ fontSize: 14, fontWeight: '800', color: theme.textPrimary, marginBottom: 10 }}>
                    Pair Bluetooth Printer Manually
                  </Text>
                  <TextInput
                    style={[styles.manualInput, { backgroundColor: theme.bg, color: theme.textPrimary, borderColor: theme.borderColor }]}
                    placeholder="Printer Name (e.g. PT-210 Thermal Printer)"
                    placeholderTextColor="#94A3B8"
                    value={manualName}
                    onChangeText={setManualName}
                  />
                  <TextInput
                    style={[styles.manualInput, { backgroundColor: theme.bg, color: theme.textPrimary, borderColor: theme.borderColor, marginTop: 8 }]}
                    placeholder="Bluetooth MAC Address / IP (e.g. 86:0A:7D:2E:3F:11)"
                    placeholderTextColor="#94A3B8"
                    value={manualMac}
                    onChangeText={setManualMac}
                  />
                  <TouchableOpacity onPress={handleAddManualPrinter} style={styles.addManualBtn}>
                    <Plus size={16} color="#FFFFFF" />
                    <Text style={styles.addManualBtnText}>Pair & Connect Printer</Text>
                  </TouchableOpacity>
                </View>
              ) : null}

              {/* Compact Devices View: Top 3 Preview + Show More Modal */}
              {scannedDevices.length === 0 ? (
                <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.borderColor, marginBottom: 14, paddingVertical: 18, alignItems: 'center' }]}>
                  <Bluetooth size={24} color={theme.textSecondary} style={{ marginBottom: 6 }} />
                  <Text style={{ fontSize: 13, fontWeight: '700', color: theme.textPrimary }}>
                    No Bluetooth Devices Discovered
                  </Text>
                  <Text style={{ fontSize: 11, color: theme.textSecondary, textAlign: 'center', marginTop: 4, paddingHorizontal: 20 }}>
                    Tap "Find Printers" above or "Scan Devices" to search for nearby POS printers.
                  </Text>
                </View>
              ) : (
                <>
                  {(showAllDevices ? scannedDevices : scannedDevices.slice(0, 3)).map((dev) => {
                    const isCurrent = activeDevice?.id === dev.id || activeDevice?.macAddress === dev.macAddress;
                    const isPaired = dev.statusTag === 'Paired' || pairedPrinters.some(p => p.id === dev.id || p.macAddress === dev.macAddress);

                    return (
                      <View key={dev.id} style={[styles.deviceRow, { backgroundColor: theme.cardBg, borderColor: isCurrent ? BRAND_COLORS.blue600 : theme.borderColor }]}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                          <Bluetooth size={20} color={isCurrent ? '#10B981' : theme.textPrimary} />
                          <View style={{ marginLeft: 10, flex: 1 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                              <Text style={[styles.deviceName, { color: theme.textPrimary, fontSize: 13, fontWeight: '800' }]} numberOfLines={1}>
                                {dev.name}
                              </Text>
                              <View style={[styles.statusTagPill, { backgroundColor: isPaired ? 'rgba(16, 185, 129, 0.15)' : 'rgba(148, 163, 184, 0.18)' }]}>
                                <Text style={[styles.statusTagText, { color: isPaired ? '#10B981' : '#64748B' }]}>
                                  {isPaired ? 'Paired' : 'New'}
                                </Text>
                              </View>
                            </View>
                            <Text style={[styles.deviceSub, { color: theme.textSecondary, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', fontSize: 10.5, marginTop: 1 }]}>
                              {dev.macAddress || dev.id}
                            </Text>
                          </View>
                        </View>

                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <TouchableOpacity
                            onPress={() => (isCurrent ? disconnectDevice() : handleConnectDevice(dev.id, dev.name))}
                            style={[
                              styles.connectChip,
                              { backgroundColor: isCurrent ? 'rgba(239, 68, 68, 0.15)' : BRAND_COLORS.blue600 },
                            ]}
                          >
                            <Text style={[styles.connectChipText, { color: isCurrent ? '#EF4444' : '#FFFFFF' }]}>
                              {isCurrent ? 'Disconnect' : 'Connect'}
                            </Text>
                          </TouchableOpacity>

                          {isPaired ? (
                            <TouchableOpacity onPress={() => forgetPrinter(dev.id)} style={{ padding: 6 }}>
                              <Trash2 size={15} color="#EF4444" />
                            </TouchableOpacity>
                          ) : null}
                        </View>
                      </View>
                    );
                  })}

                  {scannedDevices.length > 3 ? (
                    <TouchableOpacity
                      onPress={() => setShowDeviceModal(true)}
                      style={[styles.showMoreBtn, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}
                    >
                      <Text style={{ fontSize: 12, fontWeight: '700', color: BRAND_COLORS.blue600 }}>
                        View All ({scannedDevices.length}) Devices in Scanner Pop-up
                      </Text>
                      <ChevronRight size={16} color={BRAND_COLORS.blue600} />
                    </TouchableOpacity>
                  ) : null}
                </>
              )}

              {/* Stepper Calibration Fields */}
              <Text style={[styles.sectionHeader, { marginTop: 16 }]}>HARDWARE CALIBRATION</Text>

              {/* Stepper 1: Paper Width */}
              <View style={[styles.stepperRow, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Text style={[styles.stepperTitle, { color: theme.textPrimary }]}>Paper Width Size</Text>
                  <Text style={[styles.stepperSub, { color: theme.textSecondary }]}>Thermal roll width (58mm or 80mm)</Text>
                </View>
                <View style={styles.stepperControls}>
                  <TouchableOpacity onPress={() => setPaperWidthVal(58)} style={[styles.widthChip, paperWidthVal === 58 && styles.widthChipActive]}>
                    <Text style={[styles.widthChipText, paperWidthVal === 58 && styles.widthChipTextActive]}>58mm</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setPaperWidthVal(80)} style={[styles.widthChip, paperWidthVal === 80 && styles.widthChipActive]}>
                    <Text style={[styles.widthChipText, paperWidthVal === 80 && styles.widthChipTextActive]}>80mm</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Stepper 2: Top Offset Margin */}
              <View style={[styles.stepperRow, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Text style={[styles.stepperTitle, { color: theme.textPrimary }]}>Top Margin Offset</Text>
                  <Text style={[styles.stepperSub, { color: theme.textSecondary }]}>Blank feed lines before print</Text>
                </View>
                <View style={styles.stepperControls}>
                  <TouchableOpacity onPress={() => setTopMarginVal(Math.max(0, topMarginVal - 1))} style={styles.stepBtn}>
                    <Minus size={16} color={theme.textPrimary} />
                  </TouchableOpacity>
                  <Text style={[styles.stepVal, { color: theme.textPrimary }]}>{topMarginVal}</Text>
                  <TouchableOpacity onPress={() => setTopMarginVal(topMarginVal + 1)} style={styles.stepBtn}>
                    <Plus size={16} color={theme.textPrimary} />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Stepper 3: Print Density (label printer only — ESC/POS receipts have no native density command) */}
              <View style={[styles.stepperRow, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Text style={[styles.stepperTitle, { color: theme.textPrimary }]}>Print Density Darkness</Text>
                  <Text style={[styles.stepperSub, { color: theme.textSecondary }]}>Heat intensity (1-10) — applies to label printer</Text>
                </View>
                <View style={styles.stepperControls}>
                  <TouchableOpacity onPress={() => setPrintDensityVal(Math.max(1, printDensityVal - 1))} style={styles.stepBtn}>
                    <Minus size={16} color={theme.textPrimary} />
                  </TouchableOpacity>
                  <Text style={[styles.stepVal, { color: theme.textPrimary }]}>{printDensityVal}</Text>
                  <TouchableOpacity onPress={() => setPrintDensityVal(Math.min(10, printDensityVal + 1))} style={styles.stepBtn}>
                    <Plus size={16} color={theme.textPrimary} />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Stepper 4: Print Copies */}
              <View style={[styles.stepperRow, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Text style={[styles.stepperTitle, { color: theme.textPrimary }]}>Print Copies</Text>
                  <Text style={[styles.stepperSub, { color: theme.textSecondary }]}>Copies printed per bill (e.g. customer + merchant)</Text>
                </View>
                <View style={styles.stepperControls}>
                  <TouchableOpacity onPress={() => setPrintCopiesVal(Math.max(1, printCopiesVal - 1))} style={styles.stepBtn}>
                    <Minus size={16} color={theme.textPrimary} />
                  </TouchableOpacity>
                  <Text style={[styles.stepVal, { color: theme.textPrimary }]}>{printCopiesVal}</Text>
                  <TouchableOpacity onPress={() => setPrintCopiesVal(Math.min(3, printCopiesVal + 1))} style={styles.stepBtn}>
                    <Plus size={16} color={theme.textPrimary} />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Font Size */}
              <View style={[styles.stepperRow, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Text style={[styles.stepperTitle, { color: theme.textPrimary }]}>Receipt Font Size</Text>
                  <Text style={[styles.stepperSub, { color: theme.textSecondary }]}>Large prints roughly 2x bigger text</Text>
                </View>
                <View style={styles.stepperControls}>
                  {(['small', 'medium', 'large'] as const).map((size) => (
                    <TouchableOpacity
                      key={size}
                      onPress={() => setFontSizeVal(size)}
                      style={[styles.widthChip, fontSizeVal === size && styles.widthChipActive]}
                    >
                      <Text style={[styles.widthChipText, fontSizeVal === size && styles.widthChipTextActive]}>
                        {size.charAt(0).toUpperCase() + size.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Compact Mode — paper-saving sizing layout */}
              <View style={[styles.stepperRow, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Text style={[styles.stepperTitle, { color: theme.textPrimary }]}>Compact</Text>
                  <Text style={[styles.stepperSub, { color: theme.textSecondary }]}>
                    Shorter receipts — packs invoice/date on one line to save paper
                  </Text>
                </View>
                <Switch
                  value={compactMode}
                  onValueChange={(v) => {
                    setCompactMode(v).catch(() => {});
                  }}
                  trackColor={{ false: theme.borderColor, true: BRAND_COLORS.blue600 }}
                  thumbColor="#FFFFFF"
                />
              </View>

              {/* Receipt Font Library */}
              <View style={[styles.stepperCardStacked, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
                <View style={{ marginBottom: 10 }}>
                  <Text style={[styles.stepperTitle, { color: theme.textPrimary }]}>Receipt Font</Text>
                  <Text style={[styles.stepperSub, { color: theme.textSecondary }]}>
                    Synced with web. Mono, sans, and serif families for previews and HTML prints.
                  </Text>
                </View>
                <View style={{ gap: 8 }}>
                  {RECEIPT_FONT_LIBRARY.map((font) => {
                    const active = receiptFontVal === font.id;
                    return (
                      <TouchableOpacity
                        key={font.id}
                        onPress={() => setReceiptFontVal(font.id)}
                        style={[
                          styles.fontLibraryChip,
                          {
                            borderColor: active ? BRAND_COLORS.blue600 : theme.borderColor,
                            backgroundColor: active ? 'rgba(37, 99, 235, 0.08)' : theme.bg,
                          },
                        ]}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                          <Text
                            style={{
                              fontSize: 15,
                              fontWeight: '800',
                              color: theme.textPrimary,
                              fontFamily: receiptFontRnFamily(font.id, Platform.OS),
                              flex: 1,
                            }}
                          >
                            {font.label}
                          </Text>
                          <Text style={{ fontSize: 9, fontWeight: '800', color: theme.textSecondary, textTransform: 'uppercase' }}>
                            {font.family}
                          </Text>
                        </View>
                        <Text style={{ fontSize: 11, color: theme.textSecondary, marginTop: 2, lineHeight: 15 }}>
                          {font.description}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Logo Size */}
              <View style={[styles.stepperCardStacked, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
                <View style={{ marginBottom: 10 }}>
                  <Text style={[styles.stepperTitle, { color: theme.textPrimary }]}>Receipt Logo Size</Text>
                  <Text style={[styles.stepperSub, { color: theme.textSecondary }]}>Small: 32px · Medium: 56px · Large: 80px tall</Text>
                </View>
                <View style={styles.chipRowFull}>
                  {(['small', 'medium', 'large'] as const).map((size) => {
                    const label = size === 'small' ? 'Small (32px)' : size === 'medium' ? 'Medium (56px)' : 'Large (80px)';
                    return (
                      <TouchableOpacity
                        key={size}
                        onPress={async () => {
                          setReceiptLogoSizeVal(size);
                          await setReceiptLogoSize(size);
                        }}
                        style={[styles.stackedChip, receiptLogoSizeVal === size && styles.widthChipActive]}
                      >
                        <Text style={[styles.widthChipText, receiptLogoSizeVal === size && styles.widthChipTextActive]}>
                          {label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* QR Code Size */}
              <View style={[styles.stepperCardStacked, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
                <View style={{ marginBottom: 10 }}>
                  <Text style={[styles.stepperTitle, { color: theme.textPrimary }]}>Receipt QR Code Size</Text>
                  <Text style={[styles.stepperSub, { color: theme.textSecondary }]}>Small: 80px · Medium: 110px · Large: 140px</Text>
                </View>
                <View style={styles.chipRowFull}>
                  {(['small', 'medium', 'large'] as const).map((size) => {
                    const label = size === 'small' ? 'Small (80px)' : size === 'medium' ? 'Medium (110px)' : 'Large (140px)';
                    return (
                      <TouchableOpacity
                        key={size}
                        onPress={async () => {
                          setReceiptQrSizeVal(size);
                          await setReceiptQrSize(size);
                        }}
                        style={[styles.stackedChip, receiptQrSizeVal === size && styles.widthChipActive]}
                      >
                        <Text style={[styles.widthChipText, receiptQrSizeVal === size && styles.widthChipTextActive]}>
                          {label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Auto-Cut Toggle */}
              <View style={[styles.stepperRow, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
                <View>
                  <Text style={[styles.stepperTitle, { color: theme.textPrimary }]}>Auto-Cut After Print</Text>
                  <Text style={[styles.stepperSub, { color: theme.textSecondary }]}>Feeds & cuts paper — no-op if your printer has no cutter</Text>
                </View>
                <Switch
                  value={autoCutVal}
                  onValueChange={setAutoCutVal}
                  trackColor={{ false: '#64748B', true: BRAND_COLORS.blue600 }}
                />
              </View>

              {/* Label Paper Mode + Element Reorder list */}
              {activeTab === 'label' ? (
                <>
                  <TouchableOpacity
                    onPress={() => router.push('/printers/label-studio' as any)}
                    style={[styles.labelStudioBtn, { backgroundColor: BRAND_COLORS.navyInk }]}
                  >
                    <Layers size={18} color="#FFFFFF" />
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={styles.labelStudioBtnTitle}>Open Label Studio</Text>
                      <Text style={styles.labelStudioBtnSub}>
                        {activeLabelTemplate ? `Default: "${activeLabelTemplate.name}"` : 'Design a personalized label with your own layout'}
                      </Text>
                    </View>
                    <ChevronRight size={18} color="rgba(255,255,255,0.7)" />
                  </TouchableOpacity>

                  <Text style={[styles.sectionHeader, { marginTop: 16 }]}>LABEL PAPER MODE</Text>
                  <View style={[styles.stepperRow, { flexDirection: 'column', alignItems: 'stretch' }, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
                    <Text style={[styles.stepperSub, { color: theme.textSecondary, marginBottom: 10 }]}>
                      Where should barcode/QR labels actually print?
                    </Text>
                    <TouchableOpacity
                      onPress={() => setLabelPaperMode('gap')}
                      style={[styles.modeOptionRow, { borderColor: labelPaperMode === 'gap' ? BRAND_COLORS.blue600 : theme.borderColor }]}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.stepperTitle, { color: theme.textPrimary }]}>Die-Cut Labels (Gap Sensor)</Text>
                        <Text style={[styles.stepperSub, { color: theme.textSecondary }]}>Separate TSPL label printer with label-gap stock</Text>
                      </View>
                      {labelPaperMode === 'gap' ? <CheckCircle2 size={18} color={BRAND_COLORS.blue600} /> : null}
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => setLabelPaperMode('continuous')}
                      style={[styles.modeOptionRow, { borderColor: labelPaperMode === 'continuous' ? BRAND_COLORS.blue600 : theme.borderColor, marginBottom: 0 }]}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.stepperTitle, { color: theme.textPrimary }]}>Continuous Roll (Receipt Paper)</Text>
                        <Text style={[styles.stepperSub, { color: theme.textSecondary }]}>Prints real barcode/QR on the connected receipt printer — no gap sensor</Text>
                      </View>
                      {labelPaperMode === 'continuous' ? <CheckCircle2 size={18} color={BRAND_COLORS.blue600} /> : null}
                    </TouchableOpacity>
                  </View>

                  {/* Dedicated LPAPI label printer — only renders on builds that
                      include the vendored SDK, and takes over label jobs while linked. */}
                  {ThermalPrinterService.isJoshSupported() && (
                    <View style={{ marginTop: 16 }}>
                      <Text style={[styles.sectionHeader, { marginBottom: 8 }]}>
                        JOSH DUAL-MODE SMART PRINTER (STICKER LABELS & RECEIPTS)
                      </Text>
                      <JoshPrinterCard />
                    </View>
                  )}

                  {/* Dedicated YX / Y50 label printer (com.yx.print SDK) */}
                  {ThermalPrinterService.isYxSupported() && (
                    <View style={{ marginTop: 16 }}>
                      <Text style={[styles.sectionHeader, { marginBottom: 8 }]}>
                        YX / Y50 SMART LABEL PRINTER (BLUETOOTH)
                      </Text>
                      <YxPrinterCard />
                    </View>
                  )}

                  {labelPaperMode === 'gap' ? (
                    <>
                      <Text style={[styles.sectionHeader, { marginTop: 16 }]}>
                        LABEL STOCK SIZE (mm) — MATCH YOUR REAL LABEL ROLL
                      </Text>
                      <Text style={{ fontSize: 11, color: theme.textSecondary, marginBottom: 10, lineHeight: 16 }}>
                        Every barcode/QR/text position is centered based on these numbers. If they
                        do not match the label actually loaded in the printer, content is centered
                        for the wrong canvas and can overflow onto the next label. Check the
                        roll&apos;s packaging or measure a blank label to get this right.
                      </Text>

                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                        {LABEL_SIZE_PRESETS.map((preset) => {
                          const selected = labelWidthMm === preset.widthMm && labelHeightMm === preset.heightMm;
                          return (
                            <TouchableOpacity
                              key={preset.label}
                              onPress={() => {
                                setLabelWidthMm(preset.widthMm);
                                setLabelHeightMm(preset.heightMm);
                              }}
                              style={[styles.widthChip, selected && styles.widthChipActive]}
                            >
                              <Text style={[styles.widthChipText, selected && styles.widthChipTextActive]}>{preset.label}</Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>

                      <View style={[styles.stepperRow, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
                        <View style={{ flex: 1, paddingRight: 8 }}>
                          <Text style={[styles.stepperTitle, { color: theme.textPrimary }]}>Label Width</Text>
                          <Text style={[styles.stepperSub, { color: theme.textSecondary }]}>Left-to-right size of one label</Text>
                        </View>
                        <View style={styles.stepperControls}>
                          <TouchableOpacity onPress={() => setLabelWidthMm(Math.max(10, labelWidthMm - 1))} style={styles.stepBtn}>
                            <Minus size={16} color={theme.textPrimary} />
                          </TouchableOpacity>
                          <Text style={[styles.stepVal, { color: theme.textPrimary }]}>{labelWidthMm}mm</Text>
                          <TouchableOpacity onPress={() => setLabelWidthMm(Math.min(100, labelWidthMm + 1))} style={styles.stepBtn}>
                            <Plus size={16} color={theme.textPrimary} />
                          </TouchableOpacity>
                        </View>
                      </View>

                      <View style={[styles.stepperRow, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
                        <View style={{ flex: 1, paddingRight: 8 }}>
                          <Text style={[styles.stepperTitle, { color: theme.textPrimary }]}>Label Height</Text>
                          <Text style={[styles.stepperSub, { color: theme.textSecondary }]}>Top-to-bottom size of one label</Text>
                        </View>
                        <View style={styles.stepperControls}>
                          <TouchableOpacity onPress={() => setLabelHeightMm(Math.max(10, labelHeightMm - 1))} style={styles.stepBtn}>
                            <Minus size={16} color={theme.textPrimary} />
                          </TouchableOpacity>
                          <Text style={[styles.stepVal, { color: theme.textPrimary }]}>{labelHeightMm}mm</Text>
                          <TouchableOpacity onPress={() => setLabelHeightMm(Math.min(150, labelHeightMm + 1))} style={styles.stepBtn}>
                            <Plus size={16} color={theme.textPrimary} />
                          </TouchableOpacity>
                        </View>
                      </View>

                      <View style={[styles.stepperRow, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
                        <View style={{ flex: 1, paddingRight: 8 }}>
                          <Text style={[styles.stepperTitle, { color: theme.textPrimary }]}>Label Gap</Text>
                          <Text style={[styles.stepperSub, { color: theme.textSecondary }]}>Blank gap between labels (gap sensor)</Text>
                        </View>
                        <View style={styles.stepperControls}>
                          <TouchableOpacity onPress={() => setLabelGapMm(Math.max(0, labelGapMm - 1))} style={styles.stepBtn}>
                            <Minus size={16} color={theme.textPrimary} />
                          </TouchableOpacity>
                          <Text style={[styles.stepVal, { color: theme.textPrimary }]}>{labelGapMm}mm</Text>
                          <TouchableOpacity onPress={() => setLabelGapMm(Math.min(10, labelGapMm + 1))} style={styles.stepBtn}>
                            <Plus size={16} color={theme.textPrimary} />
                          </TouchableOpacity>
                        </View>
                      </View>
                    </>
                  ) : null}

                  <Text style={[styles.sectionHeader, { marginTop: 16 }]}>LABEL REORDER ELEMENTS</Text>
                  {labelElements.map((item) => (
                    <View key={item.id} style={[styles.dragRow, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
                      <GripVertical size={18} color={theme.textSecondary} style={{ marginRight: 10 }} />
                      <Text style={[styles.dragText, { color: theme.textPrimary, flex: 1 }]}>{item.name}</Text>
                      <CheckCircle2 size={18} color="#10B981" />
                    </View>
                  ))}
                </>
              ) : null}

              {/* Save Configuration Button */}
              <TouchableOpacity
                onPress={handleSavePrinterSettings}
                disabled={isSavingSettings}
                style={styles.saveSettingsBtn}
              >
                {isSavingSettings ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <Save size={18} color="#FFFFFF" />
                    <Text style={styles.saveSettingsBtnText}>Save Printer Calibration</Text>
                  </>
                )}
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </View>

      {/* AI A4 BILL TO RECEIPT CONVERTER MODAL */}
      <AiBillToReceiptModal
        visible={showAiBillModal}
        onClose={() => setShowAiBillModal(false)}
      />

      {/* BLUETOOTH DEVICE DISCOVERY POP-UP MODAL */}
      <Modal
        visible={showDeviceModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowDeviceModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: theme.cardBg }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>
                  Discovered Bluetooth Printers
                </Text>
                <Text style={[styles.modalSub, { color: theme.textSecondary }]}>
                  {isScanning ? 'Searching for nearby devices...' : `Found ${scannedDevices.length} available device${scannedDevices.length === 1 ? '' : 's'}`}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowDeviceModal(false)}
                style={[styles.modalCloseBtn, { backgroundColor: theme.borderColor }]}
              >
                <X size={18} color={theme.textPrimary} />
              </TouchableOpacity>
            </View>

            {isScanning ? (
              <View style={styles.modalScanningBar}>
                <ActivityIndicator size="small" color={BRAND_COLORS.blue600} />
                <Text style={[styles.modalScanningText, { color: BRAND_COLORS.blue600 }]}>
                  Scanning Android Bluetooth inquiry...
                </Text>
              </View>
            ) : null}

            <ScrollView style={{ maxHeight: 380, marginVertical: 10 }}>
              {scannedDevices.length === 0 && !isScanning ? (
                <View style={{ alignItems: 'center', paddingVertical: 32 }}>
                  <Bluetooth size={36} color={theme.textSecondary} style={{ marginBottom: 8 }} />
                  <Text style={{ fontSize: 14, fontWeight: '700', color: theme.textPrimary }}>
                    No Bluetooth Devices Detected
                  </Text>
                  <Text style={{ fontSize: 12, color: theme.textSecondary, textAlign: 'center', marginTop: 4, paddingHorizontal: 20 }}>
                    Make sure the printer is turned on, pairing mode is enabled, and Bluetooth is ON in phone settings.
                  </Text>
                </View>
              ) : (
                scannedDevices.map((dev) => {
                  const isCurrent = activeDevice?.id === dev.id || activeDevice?.macAddress === dev.macAddress;
                  const isPaired = dev.statusTag === 'Paired' || pairedPrinters.some(p => p.id === dev.id || p.macAddress === dev.macAddress);

                  return (
                    <TouchableOpacity
                      key={dev.id}
                      activeOpacity={0.75}
                      onPress={async () => {
                        if (isCurrent) {
                          disconnectDevice();
                        } else {
                          setShowDeviceModal(false);
                          await handleConnectDevice(dev.id, dev.name);
                        }
                      }}
                      style={[
                        styles.modalDeviceItem,
                        {
                          backgroundColor: isCurrent ? 'rgba(16,185,129,0.08)' : theme.bg,
                          borderColor: isCurrent ? '#10B981' : theme.borderColor,
                        },
                      ]}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                        <View
                          style={{
                            width: 38,
                            height: 38,
                            borderRadius: 10,
                            backgroundColor: isCurrent ? 'rgba(16,185,129,0.15)' : 'rgba(37,99,235,0.1)',
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginRight: 10,
                          }}
                        >
                          <Bluetooth size={18} color={isCurrent ? '#10B981' : BRAND_COLORS.blue600} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Text style={[styles.deviceName, { color: theme.textPrimary, fontSize: 13.5, fontWeight: '800' }]} numberOfLines={1}>
                              {dev.name}
                            </Text>
                            {isPaired && (
                              <View style={[styles.statusTagPill, { backgroundColor: 'rgba(16,185,129,0.12)' }]}>
                                <Text style={[styles.statusTagText, { color: '#10B981' }]}>Paired</Text>
                              </View>
                            )}
                          </View>
                          <Text style={[styles.deviceSub, { color: theme.textSecondary, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', fontSize: 11, marginTop: 1 }]}>
                            {dev.macAddress || dev.id}
                          </Text>
                        </View>
                      </View>

                      <View
                        style={[
                          styles.connectChip,
                          { backgroundColor: isCurrent ? 'rgba(239,68,68,0.12)' : BRAND_COLORS.blue600 },
                        ]}
                      >
                        <Text style={[styles.connectChipText, { color: isCurrent ? '#EF4444' : '#FFFFFF' }]}>
                          {isCurrent ? 'Disconnect' : 'Connect'}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 6 }}>
              <TouchableOpacity
                onPress={() => scanForDevices()}
                disabled={isScanning}
                style={[
                  styles.modalScanAgainBtn,
                  { backgroundColor: BRAND_COLORS.blue600, opacity: isScanning ? 0.7 : 1, flex: 1 },
                ]}
              >
                {isScanning ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <RefreshCw size={15} color="#FFFFFF" style={{ marginRight: 6 }} />
                    <Text style={{ fontSize: 13, fontWeight: '800', color: '#FFFFFF' }}>Scan Again</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setShowDeviceModal(false)}
                style={[styles.modalCloseFooterBtn, { borderColor: theme.borderColor, flex: 1 }]}
              >
                <Text style={{ fontSize: 13, fontWeight: '700', color: theme.textPrimary }}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <SequencePrintPrompt
        visible={showSequencePrompt}
        isPrinting={isSeqPrinting}
        progress={seqProgress}
        onSubmit={handleSubmitSequence}
        onCancel={() => setShowSequencePrompt(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  mainWrapper: { flex: 1, paddingHorizontal: 16, paddingTop: 4 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  backBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 4, marginLeft: -4 },
  backBtnText: { fontSize: 13, fontWeight: '600', marginLeft: 4 },
  guideToggleBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(37, 99, 235, 0.12)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
  guideToggleBtnText: { fontSize: 11, fontWeight: '800', color: BRAND_COLORS.blue600, marginLeft: 4 },
  guideCard: { borderRadius: 16, padding: 14, borderWidth: 1, marginBottom: 14 },
  guideTitle: { fontSize: 13, fontWeight: '900', marginLeft: 6 },
  guideStep: { fontSize: 12, marginTop: 4, lineHeight: 18 },
  title: { fontSize: 24, fontWeight: '900' },
  subtitle: { fontSize: 12, marginTop: 2, marginBottom: 14 },
  statusCard: { borderRadius: 18, borderWidth: 1.5, padding: 16, marginBottom: 14, width: '100%' },
  statusTopRow: { flexDirection: 'row', alignItems: 'center' },
  statusIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  statusTitle: { fontSize: 15.5, fontWeight: '900' },
  statusLine: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  statusDot: { width: 7, height: 7, borderRadius: 4, marginRight: 6 },
  statusCaption: { fontSize: 12, fontWeight: '600', flex: 1 },
  warnBanner: { backgroundColor: 'rgba(245, 158, 11, 0.12)', borderRadius: 10, padding: 10, marginTop: 12 },
  warnBannerText: { fontSize: 11.5, fontWeight: '700', color: '#F59E0B', lineHeight: 16 },
  primaryAction: { flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: BRAND_COLORS.blue600, borderRadius: 14, paddingVertical: 13, marginTop: 14 },
  primaryActionText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  rowCaption: { fontSize: 10, fontWeight: '800', letterSpacing: 0.6, marginTop: 16, marginBottom: 8 },
  testRow: { flexDirection: 'row', gap: 8 },
  testBtn: { flex: 1, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderRadius: 12, paddingVertical: 11 },
  testBtnText: { fontSize: 12, fontWeight: '800', flexShrink: 1 },
  segmentedBar: { flexDirection: 'row', padding: 4, borderRadius: 16, borderWidth: 1, marginBottom: 14, width: '100%' },
  segBtn: { flex: 1, flexDirection: 'row', gap: 6, paddingVertical: 12, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  segBtnActive: { backgroundColor: BRAND_COLORS.blue600, elevation: 2, shadowColor: BRAND_COLORS.blue600, shadowOpacity: 0.3, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
  segText: { fontSize: 12.5, fontWeight: '800', color: '#64748B' },
  segTextActive: { color: '#FFFFFF' },
  card: { borderRadius: 18, padding: 16, borderWidth: 1 },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  sectionHeader: { fontSize: 10, fontWeight: '800', color: '#94A3B8', letterSpacing: 0.5 },
  manualInput: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13 },
  addManualBtn: { backgroundColor: BRAND_COLORS.blue600, borderRadius: 12, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  addManualBtnText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800', marginLeft: 6 },
  deviceRow: { borderRadius: 16, padding: 14, borderWidth: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  deviceName: { fontSize: 13, fontWeight: '800' },
  deviceSub: { fontSize: 11, marginTop: 1 },
  statusTagPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, marginLeft: 8 },
  statusTagText: { fontSize: 10, fontWeight: '800' },
  connectChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  connectChipText: { fontSize: 11, fontWeight: '800' },
  stepperRow: { borderRadius: 16, padding: 14, borderWidth: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  stepperCardStacked: { borderRadius: 16, padding: 14, borderWidth: 1, marginBottom: 10 },
  chipRowFull: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  stackedChip: { flex: 1, paddingVertical: 9, paddingHorizontal: 4, borderRadius: 10, borderWidth: 1, borderColor: BRAND_COLORS.slate200, alignItems: 'center', justifyContent: 'center' },
  modeOptionRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderRadius: 12, padding: 12, marginBottom: 8 },
  labelStudioBtn: { flexDirection: 'row', alignItems: 'center', borderRadius: 16, padding: 14, marginBottom: 4 },
  labelStudioBtnTitle: { fontSize: 14, fontWeight: '900', color: '#FFFFFF' },
  labelStudioBtnSub: { fontSize: 10.5, color: 'rgba(255,255,255,0.75)', marginTop: 2 },
  stepperTitle: { fontSize: 13, fontWeight: '800' },
  stepperSub: { fontSize: 11, marginTop: 2 },
  stepperControls: { flexDirection: 'row', alignItems: 'center' },
  widthChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: BRAND_COLORS.slate200, marginLeft: 6 },
  widthChipActive: { backgroundColor: BRAND_COLORS.blue600, borderColor: BRAND_COLORS.blue600 },
  widthChipText: { fontSize: 11.5, fontWeight: '800', color: '#64748B', textAlign: 'center' },
  widthChipTextActive: { color: '#FFFFFF' },
  fontLibraryChip: {
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  stepBtn: { width: 32, height: 32, borderRadius: 10, borderWidth: 1, borderColor: BRAND_COLORS.slate200, alignItems: 'center', justifyContent: 'center' },
  stepVal: { fontSize: 13, fontWeight: '800', marginHorizontal: 10 },
  dragRow: { borderRadius: 14, padding: 14, borderWidth: 1, flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  dragText: { fontSize: 13, fontWeight: '700' },
  saveSettingsBtn: { backgroundColor: BRAND_COLORS.blue600, borderRadius: 14, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 16 },
  saveSettingsBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 14, marginLeft: 8 },
  templateIconBox: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  templateName: { fontSize: 12, fontWeight: '800', textAlign: 'center' },
  templateFullCard: { borderRadius: 20, padding: 16, borderWidth: 1, marginBottom: 4 },
  templateCardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  selectedPill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  previewPaperContainer: { alignItems: 'center', marginTop: 4 },
  templateSearchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 46,
    marginBottom: 12,
  },
  templateSearchInput: {
    flex: 1,
    fontSize: 13,
    paddingVertical: 0,
  },
  catPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  catPillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  catCountBadge: {
    marginLeft: 6,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
  },
  catCountText: {
    fontSize: 10,
    fontWeight: '800',
  },
  resultsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    paddingHorizontal: 2,
  },
  resultsCountText: {
    fontSize: 11,
    fontWeight: '700',
  },
  resetFilterText: {
    fontSize: 11,
    fontWeight: '800',
    color: BRAND_COLORS.blue600,
  },
  emptyTemplateBox: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    borderRadius: 20,
    borderWidth: 1,
    marginTop: 8,
  },
  emptyTemplateTitle: {
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 4,
  },
  emptyTemplateSub: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  resetFilterBtn: {
    backgroundColor: BRAND_COLORS.navyInk,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  resetFilterBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  showMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 10,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '82%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  modalSub: {
    fontSize: 12,
    marginTop: 2,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalScanningBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(37, 99, 235, 0.08)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    marginTop: 4,
    marginBottom: 6,
  },
  modalScanningText: {
    fontSize: 12,
    fontWeight: '700',
  },
  modalDeviceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    marginBottom: 8,
  },
  modalScanAgainBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
  },
  modalCloseFooterBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
});
