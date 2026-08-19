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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Bluetooth,
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
import { ReceiptTemplateMockup } from '@/components/ui/ReceiptTemplateMockup';
import { CustomReceiptMockup } from '@/components/ui/CustomReceiptMockup';
import {
  RECEIPT_TEMPLATES,
  TEMPLATE_CATEGORIES,
  TemplateCategory,
  getTemplateById,
} from '@/constants/receiptTemplates';
import { AiBillToReceiptModal } from '@/components/printers/AiBillToReceiptModal';
import { BRAND_COLORS } from '@/constants/theme';
import { useTranslation } from '@/store/useLanguageStore';

export default function PrintersScreen() {
  const router = useRouter();
  const { t, currentLanguage } = useTranslation();
  const { settings } = useSettings();
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
  } = usePrinterStore();
  const activeLabelTemplate = labelTemplates.find((t) => t.id === activeLabelTemplateId) || null;
  const activeCustomTemplate = customTemplates.find((t) => t.id === activeCustomTemplateId) || null;

  const [activeTab, setActiveTab] = useState<'receipt' | 'label' | 'templates'>('receipt');
  // Note: A4 physical printer tab is hidden per user specification (only PDF invoice export is provided)
  const [isPrintingA4, setIsPrintingA4] = useState(false);
  const [showAiBillModal, setShowAiBillModal] = useState(false);

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
  const [printCopiesVal, setPrintCopiesVal] = useState(1);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [showPairingGuide, setShowPairingGuide] = useState(false);

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
      setPrintCopiesVal(s.printCopies);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeTemplate = getTemplateById(activeTemplateId);

  const handleAddManualPrinter = () => {
    if (!manualName.trim()) {
      Alert.alert('Required Name', 'Please enter a printer name (e.g. PT-210 Receipt Printer).');
      return;
    }
    const newDevice = {
      id: `custom-${Date.now()}`,
      name: manualName.trim(),
      macAddress: manualMac.trim() || '86:0A:7D:2E:3F:11',
      type: (activeTab === 'label' ? 'label' : 'receipt') as any,
    };
    addPairedPrinter(newDevice);
    setManualName('');
    setManualMac('');
    setShowManualAdd(false);
    Alert.alert('Printer Paired!', `${newDevice.name} connected & saved to your paired devices list.`);
  };

  const handleScanBluetooth = async () => {
    if (!nativeModuleAvailable && Platform.OS !== 'web') {
      Alert.alert(
        'Bluetooth Unavailable in This Build',
        'Raw Bluetooth device scanning needs a custom dev-client build (Expo Go does not include native Bluetooth modules). Rebuild with "eas build --profile development" or use "System Printer Dialog" below instead.'
      );
      return;
    }
    await scanForDevices();
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
        Alert.alert('Printer Connected!', `${printer.name} linked and ready for thermal printing.`);
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
        storeName: settings?.businessName || 'Your Store Name',
        storeAddress: settings?.businessAddress || '123 Market Road, City',
        storePhone: settings?.businessPhone || '9999999999',
        storeGstin: settings?.businessGSTIN || '07AAAAA0000A1Z5',
        storeLogoUrl: settings?.businessLogoURL || undefined,
        upiId: settings?.upiId || undefined,
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

  const printOptions: ReceiptPrintOptions = {
    template: activeTemplate,
    customTemplate: activeCustomTemplate,
    includeBillQr: enableBillQrCode,
    topMargin: topMarginVal,
    autoCut: autoCutVal,
    fontSize: fontSizeVal,
    copies: 1, // test prints always send exactly one copy regardless of the saved "copies" calibration
    storeName: settings?.businessName || undefined,
    storeAddress: settings?.businessAddress || undefined,
    storePhone: settings?.businessPhone || undefined,
    storeGstin: (settings as any)?.gstin || (settings as any)?.taxNumber || undefined,
    storeLogoUrl: settings?.businessLogoURL || undefined,
    upiId: settings?.upiId || undefined,
  };

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

        {/* Hero Banner: connection status + scan + quick test actions */}
        <View style={[styles.heroCard, { backgroundColor: BRAND_COLORS.blue600 }]}>
          <View style={styles.heroTopRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, paddingRight: 8 }}>
              <View style={[styles.iconBox, { backgroundColor: connectionState === 'connected' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(255, 255, 255, 0.2)' }]}>
                <Bluetooth size={22} color={connectionState === 'connected' ? '#6EE7B7' : '#FFFFFF'} />
              </View>
              <View style={{ marginLeft: 10, flex: 1 }}>
                <Text style={styles.heroPrinterName} numberOfLines={1}>
                  {activeDevice ? activeDevice.name : 'No Printer Paired'}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: connectionState === 'connected' ? '#6EE7B7' : '#F59E0B', marginRight: 5 }} />
                  <Text style={[styles.heroPrinterSub, { color: connectionState === 'connected' ? '#6EE7B7' : 'rgba(255,255,255,0.85)' }]}>
                    {connectionState === 'connected' ? `Connected (${paperWidthVal}mm) • Ready` : 'Disconnected'}
                  </Text>
                </View>
              </View>
            </View>

            <TouchableOpacity onPress={handleScanBluetooth} disabled={isScanning} style={styles.scanBtn}>
              {isScanning ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <>
                  <RefreshCw size={13} color="#FFFFFF" style={{ marginRight: 4 }} />
                  <Text style={styles.scanBtnText}>Scan BT</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {!nativeModuleAvailable && Platform.OS !== 'web' ? (
            <View style={styles.nativeWarningBanner}>
              <Text style={styles.nativeWarningText}>
                ⚠️ This build doesn't include native Bluetooth. Rebuild with a dev-client (EAS Build) to scan real devices.
              </Text>
            </View>
          ) : warningText ? (
            <View style={styles.nativeWarningBanner}>
              <Text style={styles.nativeWarningText}>⚠️ {warningText}</Text>
            </View>
          ) : null}

          <View style={styles.testPrintRow}>
            <TouchableOpacity onPress={handleSelectSystemPrinter} style={styles.testPrintBtn}>
              <ExternalLink size={13} color="#FFFFFF" style={{ marginRight: 4 }} />
              <Text style={styles.testPrintBtnText} numberOfLines={1}>System</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={async () => {
                const ok = await ThermalPrinterService.printTestReceipt(paperWidthVal === 80 ? '80mm' : '58mm', printOptions);
                const activeName = activeCustomTemplate ? activeCustomTemplate.name : activeTemplate.name;
                if (ok) Alert.alert('Test Receipt Sent', `Printed using "${activeName}".`);
              }}
              style={styles.testPrintBtn}
            >
              <FileText size={13} color="#FFFFFF" style={{ marginRight: 4 }} />
              <Text style={styles.testPrintBtnText} numberOfLines={1}>Receipt</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={async () => {
                const targetPaperWidth = paperWidthVal === 80 ? '80mm' : '58mm';
                if (activeLabelTemplate) {
                  // Test the actual saved Label Studio template (not the auto-layout) with sample
                  // product data — same sample values printTestLabel below uses. Which native
                  // pipeline it goes through depends on labelPaperMode: TSPL commands would print
                  // as gibberish text on the ESC/POS receipt printer, so 'continuous' routes through
                  // the ESC/POS sequential renderer instead.
                  const sampleProduct = {
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
                  const ok =
                    labelPaperMode === 'continuous'
                      ? await ThermalPrinterService.printLabelTemplateOnReceiptPaper(sampleProduct, activeLabelTemplate, targetPaperWidth)
                      : await ThermalPrinterService.printLabelFromTemplate(sampleProduct, activeLabelTemplate);
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
              style={styles.testPrintBtn}
            >
              <Tag size={13} color="#FFFFFF" style={{ marginRight: 4 }} />
              <Text style={styles.testPrintBtnText} numberOfLines={1}>Label</Text>
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
                            storeName={settings?.businessName || 'Your Store Name'}
                            storeAddress={settings?.businessAddress || '123 Market Road, City'}
                            storePhone={settings?.businessPhone || '9999999999'}
                            storeGstin={(settings as any)?.gstin || (settings as any)?.taxNumber || ''}
                            invoiceNumber="INV-1024"
                            date={new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                            customerName="Walk-in Customer"
                            paperWidth={ct.paperWidth || '58mm'}
                            upiId={settings?.upiId || ''}
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
                              <Text style={[styles.templateName, { color: theme.textPrimary, textAlign: 'left', fontSize: 15 }]}>
                                {t.name}
                              </Text>
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
                            storeName={settings?.businessName || 'Your Store Name'}
                            storeAddress={settings?.businessAddress || '123 Market Road, City'}
                            storePhone={settings?.businessPhone || '9999999999'}
                            invoiceNumber="INV-1024"
                            date={new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                            customerName="Walk-in Customer"
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
              {/* AI A4 BILL TO RECEIPT CONVERTER CARD */}
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
                    <Text style={{ fontSize: 16, fontWeight: '900', color: '#FFFFFF' }}>AI Bill to Receipt Converter</Text>
                    <Text style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>Upload PDF / photo of any company invoice & print on thermal printer</Text>
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

              {/* Section: PAIRED & SAVED BLUETOOTH PRINTERS */}
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionHeader}>PAIRED BLUETOOTH PRINTERS ({pairedPrinters.length})</Text>
                <TouchableOpacity onPress={() => setShowManualAdd(!showManualAdd)}>
                  <Text style={{ fontSize: 11, fontWeight: '800', color: BRAND_COLORS.blue600 }}>
                    {showManualAdd ? 'Cancel' : '+ Add Manually'}
                  </Text>
                </TouchableOpacity>
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

              {/* Render Phone Bluetooth Devices List — paired devices arrive within ~1s via a live
                  event (see PrinterService.scanForDevices), well before the full ~12s discovery
                  cycle finishes, so the list shows as soon as anything arrives instead of blocking
                  on the whole scan. isScanning only gates the very first render, before any device
                  has come in yet; once any device shows up, further scanning is a small inline
                  indicator, not a full-screen blocker. */}
              {isScanning && scannedDevices.length === 0 ? (
                <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.borderColor, marginBottom: 14, alignItems: 'center', paddingVertical: 20 }]}>
                  <ActivityIndicator size="small" color={BRAND_COLORS.blue600} style={{ marginBottom: 8 }} />
                  <Text style={{ fontSize: 13, fontWeight: '700', color: theme.textPrimary }}>
                    Fetching Phone's Paired & Available Bluetooth Devices...
                  </Text>
                  <Text style={{ fontSize: 11, color: theme.textSecondary, marginTop: 2 }}>
                    Querying Android BluetoothAdapter & bonded devices
                  </Text>
                </View>
              ) : scannedDevices.length === 0 ? (
                <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.borderColor, marginBottom: 14, paddingVertical: 18, alignItems: 'center' }]}>
                  <Bluetooth size={24} color={theme.textSecondary} style={{ marginBottom: 6 }} />
                  <Text style={{ fontSize: 13, fontWeight: '700', color: theme.textPrimary }}>
                    No Bluetooth Devices Discovered
                  </Text>
                  <Text style={{ fontSize: 11, color: theme.textSecondary, textAlign: 'center', marginTop: 4, paddingHorizontal: 20 }}>
                    Tap "Scan BT" above to fetch phone's paired devices or tap "+ Add Manually" to pair by MAC address.
                  </Text>
                </View>
              ) : (
                <>
                  {isScanning ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                      <ActivityIndicator size="small" color={BRAND_COLORS.blue600} style={{ marginRight: 6 }} />
                      <Text style={{ fontSize: 11, fontWeight: '700', color: theme.textSecondary }}>
                        Still scanning for nearby devices...
                      </Text>
                    </View>
                  ) : null}
                  {scannedDevices.map((dev) => {
                    const isCurrent = activeDevice?.id === dev.id || activeDevice?.macAddress === dev.macAddress;
                    const isPaired = dev.statusTag === 'Paired' || pairedPrinters.some(p => p.id === dev.id || p.macAddress === dev.macAddress);

                    return (
                      <View key={dev.id} style={[styles.deviceRow, { backgroundColor: theme.cardBg, borderColor: isCurrent ? BRAND_COLORS.blue600 : theme.borderColor }]}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                          <Bluetooth size={22} color={isCurrent ? '#10B981' : theme.textPrimary} />
                          <View style={{ marginLeft: 12, flex: 1 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                              <Text style={[styles.deviceName, { color: theme.textPrimary, fontSize: 14, fontWeight: '900' }]}>{dev.name}</Text>
                              <View style={[styles.statusTagPill, { backgroundColor: isPaired ? 'rgba(16, 185, 129, 0.15)' : 'rgba(148, 163, 184, 0.18)' }]}>
                                <Text style={[styles.statusTagText, { color: isPaired ? '#10B981' : '#64748B' }]}>
                                  {isPaired ? 'Paired' : 'New'}
                                </Text>
                              </View>
                            </View>
                            <Text style={[styles.deviceSub, { color: theme.textSecondary, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', fontSize: 11, marginTop: 2 }]}>
                              {dev.macAddress || dev.id}
                            </Text>
                          </View>
                        </View>

                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <TouchableOpacity
                            onPress={() => (isCurrent ? disconnectDevice() : connectDevice(dev.id, dev.name))}
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
                            <TouchableOpacity onPress={() => forgetPrinter(dev.id)} style={{ padding: 6, marginLeft: 2 }}>
                              <Trash2 size={16} color="#EF4444" />
                            </TouchableOpacity>
                          ) : null}
                        </View>
                      </View>
                    );
                  })}
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
                        {activeLabelTemplate ? `Active: "${activeLabelTemplate.name}"` : 'Design a personalized label with your own layout'}
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
  heroCard: { borderRadius: 20, padding: 16, marginBottom: 14, width: '100%', overflow: 'hidden' },
  heroTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%' },
  heroPrinterName: { fontSize: 15, fontWeight: '800', color: '#FFFFFF' },
  heroPrinterSub: { fontSize: 11, marginTop: 2, fontWeight: '600' },
  segmentedBar: { flexDirection: 'row', padding: 4, borderRadius: 16, borderWidth: 1, marginBottom: 14, width: '100%' },
  segBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 12 },
  segBtnActive: { backgroundColor: BRAND_COLORS.blue600 },
  segText: { fontSize: 12, fontWeight: '700', color: '#64748B' },
  segTextActive: { color: '#FFFFFF' },
  card: { borderRadius: 18, padding: 16, borderWidth: 1 },
  iconBox: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  scanBtn: { backgroundColor: 'rgba(255,255,255,0.18)', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10, flexDirection: 'row', alignItems: 'center' },
  scanBtnText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800', marginLeft: 4 },
  nativeWarningBanner: { backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 10, padding: 10, marginTop: 12 },
  nativeWarningText: { fontSize: 11, fontWeight: '700', color: '#FFFFFF' },
  testPrintRow: { flexDirection: 'row', marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255, 255, 255, 0.2)', width: '100%' },
  testPrintBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 8, paddingHorizontal: 4, borderRadius: 10, marginHorizontal: 2, backgroundColor: 'rgba(255,255,255,0.15)' },
  testPrintBtnText: { fontSize: 10, fontWeight: '800', marginLeft: 3, color: '#FFFFFF' },
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
  modeOptionRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderRadius: 12, padding: 12, marginBottom: 8 },
  labelStudioBtn: { flexDirection: 'row', alignItems: 'center', borderRadius: 16, padding: 14, marginBottom: 4 },
  labelStudioBtnTitle: { fontSize: 14, fontWeight: '900', color: '#FFFFFF' },
  labelStudioBtnSub: { fontSize: 10.5, color: 'rgba(255,255,255,0.75)', marginTop: 2 },
  stepperTitle: { fontSize: 13, fontWeight: '800' },
  stepperSub: { fontSize: 11, marginTop: 2 },
  stepperControls: { flexDirection: 'row', alignItems: 'center' },
  widthChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: BRAND_COLORS.slate200, marginLeft: 6 },
  widthChipActive: { backgroundColor: BRAND_COLORS.blue600, borderColor: BRAND_COLORS.blue600 },
  widthChipText: { fontSize: 12, fontWeight: '800', color: '#64748B' },
  widthChipTextActive: { color: '#FFFFFF' },
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
});
