import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  ActivityIndicator,
  Alert,
  Linking,
  Share,
  Platform,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import {
  ArrowLeft,
  Scan,
  Camera,
  FileText,
  Image as ImageIcon,
  Printer,
  Share2,
  Trash2,
  Search,
  CheckCircle2,
  X,
  Zap,
  TrendingUp,
  Receipt,
  DollarSign,
  Clock,
  Sparkles,
  Eye,
  RefreshCw,
  ChevronRight,
} from 'lucide-react-native';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useStoreProfile } from '@/hooks/useStoreProfile';
import { useUtilityBills } from '@/hooks/useUtilityBills';
import { UtilityBill } from '@/types/utilityBill';
import {
  UtilityReceiptSlip,
  formatUtilityWhatsAppMessage,
} from '@/components/bill-converter/UtilityReceiptSlip';
import ThermalPrinterService from '@/services/PrinterService';
import { BRAND_COLORS } from '@/constants/theme';
import { usePrinterStore } from '@/store/usePrinterStore';
import { useShallow } from 'zustand/react/shallow';
import {
  isOfflineOcrSupported,
  recognizeBillFromImage,
  recognizeBillFromPdf,
} from '../../../modules/offline-bill-ocr';
import { parseUtilityBillText } from '@/services/UtilityBillParser';

/** Cheap keyword classifier for the screen's billType filter/badge — the deterministic
 *  parser itself only needs to name the provider, not bucket it, so this stays local. */
function detectUtilityBillType(providerName: string, rawText: string): string {
  const probe = `${providerName} ${rawText.slice(0, 400)}`;
  if (/water|jal\s*board|sewerage|bwssb|djb\b/i.test(probe)) return 'WATER';
  if (/\bgas\b|indraprastha|igl\b|mahanagar\s*gas|\bmgl\b|adani\s*(total\s*)?gas/i.test(probe)) return 'GAS';
  if (/broadband|telecom|airtel|jio\b|bsnl|vodafone|\bvi\b/i.test(probe)) return 'BROADBAND';
  return 'ELECTRICITY';
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function A4ToReceiptScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const { storeName: defaultStoreName } = useStoreProfile();
  const {
    paperWidth,
  } = usePrinterStore(
    useShallow((s) => ({
    paperWidth: s.paperWidth,
    }))
  );

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>('ALL');

  const {
    bills,
    isLoadingBills,
    refetchBills,
    stats,
    isLoadingStats,
    refetchStats,
    createBill,
    deleteBill,
  } = useUtilityBills({
    search: searchQuery,
    billType: selectedTypeFilter === 'ALL' ? undefined : selectedTypeFilter,
  });

  // Scanner & Converter modal state
  const [converterModalVisible, setConverterModalVisible] = useState(false);
  const [scannerStep, setScannerStep] = useState<'source' | 'processing' | 'edit' | 'success'>('source');
  const [extractingMsg, setExtractingMsg] = useState('Reading the bill on your phone…');
  const [isPrinting, setIsPrinting] = useState(false);

  // Form Fields
  const [kioskTitle, setKioskTitle] = useState(defaultStoreName || 'SEZNIK KIOSK');
  const [billType, setBillType] = useState('ELECTRICITY');
  const [provider, setProvider] = useState('');
  const [consumerNumber, setConsumerNumber] = useState('');
  const [consumerName, setConsumerName] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [unitsConsumed, setUnitsConsumed] = useState('');
  const [billAmount, setBillAmount] = useState('');
  const [convenienceFee, setConvenienceFee] = useState('20');
  const [customerPhone, setCustomerPhone] = useState('');
  const [generatedBill, setGeneratedBill] = useState<UtilityBill | null>(null);

  // Slip Preview Modal state for old bills
  const [previewModalVisible, setPreviewModalVisible] = useState(false);
  const [previewingBill, setPreviewingBill] = useState<UtilityBill | null>(null);

  const parsedBillAmount = Math.max(0, parseFloat(billAmount) || 0);
  const parsedFee = Math.max(0, parseFloat(convenienceFee) || 0);
  const calculatedTotal = parsedBillAmount + parsedFee;

  const currentPreviewData = useMemo(() => ({
    kioskName: kioskTitle || defaultStoreName || 'SEZNIK KIOSK',
    billType: billType || 'ELECTRICITY',
    provider,
    consumerNumber,
    consumerName,
    dueDate,
    unitsConsumed,
    billAmount: parsedBillAmount,
    convenienceFee: parsedFee,
    totalAmount: calculatedTotal,
    status: 'SUCCESS (PAID)',
    receiptNumber: generatedBill?.receiptNumber,
  }), [kioskTitle, defaultStoreName, billType, provider, consumerNumber, consumerName, dueDate, unitsConsumed, parsedBillAmount, parsedFee, calculatedTotal, generatedBill]);

  const resetScannerState = () => {
    setScannerStep('source');
    setProvider('');
    setConsumerNumber('');
    setConsumerName('');
    setDueDate('');
    setUnitsConsumed('');
    setBillAmount('');
    setConvenienceFee('20');
    setCustomerPhone('');
    setGeneratedBill(null);
  };

  const handleOpenScanner = () => {
    resetScannerState();
    setConverterModalVisible(true);
  };

  // Extraction is 100% on-device: ML Kit OCR (modules/offline-bill-ocr) plus a deterministic
  // parser. No cloud round-trip, no API key, no per-scan cost, and nothing that can time out.
  // The Gemini path that used to back this was removed outright, not just demoted: it chained up
  // to four model attempts at up to 35s each while this screen only waited 40s in total, so a slow
  // model made the whole scan fail client-side before the server could even answer.
  const processImageOrPdf = async (uri: string, mimeType: string) => {
    try {
      setScannerStep('processing');
      const isPdf = mimeType.toLowerCase().includes('pdf');

      if (!isOfflineOcrSupported()) {
        Alert.alert(
          'Scanning Not Available Here',
          'Automatic bill reading runs on your phone and needs the Android app build. You can still type the bill details in and print the receipt.',
          [{ text: 'Enter Manually', onPress: () => setScannerStep('edit') }]
        );
        return;
      }

      setExtractingMsg('Reading the bill on your phone…');
      const ocrResult = isPdf ? await recognizeBillFromPdf(uri) : await recognizeBillFromImage(uri);

      setExtractingMsg('Picking out the bill details…');
      const parsed = parseUtilityBillText(ocrResult.fullText);

      setBillType(detectUtilityBillType(parsed.providerName, ocrResult.fullText));
      setProvider(parsed.providerName || '');
      setConsumerNumber(parsed.consumerNo || '');
      setConsumerName(parsed.consumerName || '');
      setDueDate(parsed.dueDate || '');
      setUnitsConsumed(parsed.unitsConsumed || '');
      setBillAmount(parsed.billAmount > 0 ? parsed.billAmount.toString() : '');

      setScannerStep('edit');
    } catch (err: any) {
      console.error('Extraction error:', err);
      Alert.alert(
        'Could Not Read This Bill',
        'The photo may be blurry or cut off. Try again in better light with the whole bill in frame — or type the details in yourself.',
        [{ text: 'Enter Manually', onPress: () => setScannerStep('edit') }]
      );
    }
  };

  const handlePickCamera = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Camera permission is required to scan A4 bills.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        quality: 0.85,
        allowsEditing: false,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        await processImageOrPdf(result.assets[0].uri, result.assets[0].mimeType || 'image/jpeg');
      }
    } catch (e: any) {
      Alert.alert('Camera Error', e.message);
    }
  };

  const handlePickGallery = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.85,
        allowsEditing: false,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        await processImageOrPdf(result.assets[0].uri, result.assets[0].mimeType || 'image/jpeg');
      }
    } catch (e: any) {
      Alert.alert('Gallery Error', e.message);
    }
  };

  const handlePickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];
        await processImageOrPdf(asset.uri, 'application/pdf');
      }
    } catch (e: any) {
      Alert.alert('Document Error', e.message);
    }
  };

  const handlePrintAndSave = async () => {
    if (parsedBillAmount <= 0) {
      Alert.alert('Missing Bill Amount', 'Please enter a valid bill amount before printing.');
      return;
    }

    setIsPrinting(true);
    try {
      // 1. Save to Database
      const saved = await createBill({
        kioskName: kioskTitle || 'SEZNIK KIOSK',
        billType: billType || 'ELECTRICITY',
        provider: provider.trim(),
        consumerNumber: consumerNumber.trim(),
        consumerName: consumerName.trim(),
        dueDate: dueDate.trim() || undefined,
        unitsConsumed: unitsConsumed.trim() || undefined,
        billAmount: parsedBillAmount,
        convenienceFee: parsedFee,
        customerPhone: customerPhone.trim() || undefined,
        paymentMode: 'CASH',
      });

      setGeneratedBill(saved);

      // 2. Print Thermal Slip
      try {
        await ThermalPrinterService.printUtilityBillSlip(
          {
            kioskName: saved.kioskName,
            billType: saved.billType,
            provider: saved.provider,
            consumerNumber: saved.consumerNumber,
            consumerName: saved.consumerName,
            dueDate: saved.dueDate,
            unitsConsumed: saved.unitsConsumed,
            billAmount: saved.billAmount,
            convenienceFee: saved.convenienceFee,
            totalAmount: saved.totalAmount,
            status: saved.status,
            receiptNumber: saved.receiptNumber,
            createdAt: saved.createdAt,
          },
          paperWidth || '58mm',
          { autoCut: true }
        );
      } catch (printErr: any) {
        console.warn('Printer warning:', printErr);
      }

      setScannerStep('success');
    } catch (err: any) {
      Alert.alert('Error Saving Bill', err?.message || 'Failed to save utility bill receipt');
    } finally {
      setIsPrinting(false);
    }
  };

  const handleShareWhatsApp = async (billToShare: any) => {
    const textMessage = formatUtilityWhatsAppMessage(billToShare);
    const phone = billToShare.customerPhone?.replace(/[^0-9]/g, '');

    const cleanPhone = phone && phone.length === 10 ? `91${phone}` : phone;
    const whatsappUrl = cleanPhone
      ? `whatsapp://send?phone=${cleanPhone}&text=${encodeURIComponent(textMessage)}`
      : `whatsapp://send?text=${encodeURIComponent(textMessage)}`;

    try {
      const supported = await Linking.canOpenURL(whatsappUrl);
      if (supported) {
        await Linking.openURL(whatsappUrl);
      } else {
        await Share.share({ message: textMessage });
      }
    } catch {
      await Share.share({ message: textMessage });
    }
  };

  const handleReprintSlip = async (bill: UtilityBill) => {
    try {
      await ThermalPrinterService.printUtilityBillSlip(
        {
          kioskName: bill.kioskName,
          billType: bill.billType,
          provider: bill.provider,
          consumerNumber: bill.consumerNumber,
          consumerName: bill.consumerName,
          dueDate: bill.dueDate,
          unitsConsumed: bill.unitsConsumed,
          billAmount: bill.billAmount,
          convenienceFee: bill.convenienceFee,
          totalAmount: bill.totalAmount,
          status: bill.status,
          receiptNumber: bill.receiptNumber,
          createdAt: bill.createdAt,
        },
        paperWidth || '58mm',
        { autoCut: true }
      );
      Alert.alert('Printed', `Receipt ${bill.receiptNumber} sent to thermal printer.`);
    } catch (err: any) {
      Alert.alert('Print Error', err?.message || 'Could not print receipt.');
    }
  };

  const handleDeleteBill = (id: string, receiptNo: string) => {
    Alert.alert(
      'Delete Receipt Record',
      `Are you sure you want to delete receipt ${receiptNo}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteBill(id);
            } catch (err: any) {
              Alert.alert('Error', err?.message || 'Failed to delete receipt');
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
      {/* Header Bar */}
      <View style={[styles.header, { borderBottomColor: theme.borderColor }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <ArrowLeft size={22} color={theme.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>
            A4 Bill to Thermal Kiosk
          </Text>
          <Text style={[styles.headerSub, { color: theme.textSecondary }]}>
            High-Speed Bill Converter & Receipt Slip Generator
          </Text>
        </View>
        <TouchableOpacity
          style={styles.refreshBtn}
          onPress={() => {
            refetchBills();
            refetchStats();
          }}
        >
          <RefreshCw size={18} color={theme.textPrimary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isLoadingBills || isLoadingStats}
            onRefresh={() => {
              refetchBills();
              refetchStats();
            }}
          />
        }
      >
        {/* KPI Metric Cards */}
        <View style={styles.kpiContainer}>
          <View style={[styles.kpiCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
            <View style={styles.kpiIconWrap}>
              <Receipt size={20} color="#3B82F6" />
            </View>
            <Text style={[styles.kpiValue, { color: theme.textPrimary }]}>
              {stats?.totalBills ?? bills.length}
            </Text>
            <Text style={[styles.kpiLabel, { color: theme.textSecondary }]}>
              Total Bills
            </Text>
          </View>

          <View style={[styles.kpiCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
            <View style={[styles.kpiIconWrap, { backgroundColor: 'rgba(16, 185, 129, 0.12)' }]}>
              <DollarSign size={20} color="#10B981" />
            </View>
            <Text style={[styles.kpiValue, { color: '#10B981' }]}>
              ₹{(stats?.totalCollected ?? 0).toLocaleString('en-IN')}
            </Text>
            <Text style={[styles.kpiLabel, { color: theme.textSecondary }]}>
              Total Collected
            </Text>
          </View>

          <View style={[styles.kpiCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
            <View style={[styles.kpiIconWrap, { backgroundColor: 'rgba(245, 158, 11, 0.12)' }]}>
              <TrendingUp size={20} color="#F59E0B" />
            </View>
            <Text style={[styles.kpiValue, { color: '#F59E0B' }]}>
              ₹{(stats?.totalConvenienceFee ?? 0).toLocaleString('en-IN')}
            </Text>
            <Text style={[styles.kpiLabel, { color: theme.textSecondary }]}>
              Kiosk Fees Earned
            </Text>
          </View>

          <View style={[styles.kpiCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
            <View style={[styles.kpiIconWrap, { backgroundColor: 'rgba(139, 92, 246, 0.12)' }]}>
              <Clock size={20} color="#8B5CF6" />
            </View>
            <Text style={[styles.kpiValue, { color: '#8B5CF6' }]}>
              {stats?.todayCount ?? 0}
            </Text>
            <Text style={[styles.kpiLabel, { color: theme.textSecondary }]}>
              Today's Bills
            </Text>
          </View>
        </View>

        {/* Primary Kiosk Scan CTA Banner */}
        <TouchableOpacity
          style={styles.heroCta}
          activeOpacity={0.88}
          onPress={handleOpenScanner}
        >
          <View style={styles.heroIconBadge}>
            <FileText size={28} color="#FFFFFF" />
          </View>
          <View style={styles.heroTextWrap}>
            <Text style={styles.heroTitle}>⚡ Convert A4 PDF Bill to Thermal Slip</Text>
            <Text style={styles.heroSub}>
              Select PDF • 100% Offline OCR & Text Extraction
            </Text>
          </View>
          <View style={styles.heroBtnPill}>
            <Sparkles size={16} color="#FFFFFF" />
            <Text style={styles.heroBtnText}>Select PDF</Text>
          </View>
        </TouchableOpacity>

        {/* Filter Pills */}
        <View style={styles.filterRow}>
          {['ALL', 'ELECTRICITY', 'WATER', 'GAS', 'UTILITY'].map((type) => (
            <TouchableOpacity
              key={type}
              style={[
                styles.filterPill,
                selectedTypeFilter === type
                  ? { backgroundColor: BRAND_COLORS.navyInk, borderColor: BRAND_COLORS.navyInk }
                  : { backgroundColor: theme.cardBg, borderColor: theme.borderColor },
              ]}
              onPress={() => setSelectedTypeFilter(type)}
            >
              <Text
                style={[
                  styles.filterPillText,
                  selectedTypeFilter === type
                    ? { color: '#FFFFFF', fontWeight: '700' }
                    : { color: theme.textSecondary },
                ]}
              >
                {type}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Search Bar */}
        <View
          style={[
            styles.searchBar,
            { backgroundColor: theme.cardBg, borderColor: theme.borderColor },
          ]}
        >
          <Search size={18} color={theme.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: theme.textPrimary }]}
            placeholder="Search consumer, CA number, receipt #, or provider..."
            placeholderTextColor={theme.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {Boolean(searchQuery) && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <X size={16} color={theme.textSecondary} />
            </TouchableOpacity>
          )}
        </View>

        {/* Bills History List Section */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>
            Generated Receipts History ({bills.length})
          </Text>
        </View>

        {bills.length === 0 ? (
          <View style={[styles.emptyState, { backgroundColor: theme.cardBg }]}>
            <FileText size={48} color={theme.textSecondary} />
            <Text style={[styles.emptyTitle, { color: theme.textPrimary }]}>
              No bill receipts found
            </Text>
            <Text style={[styles.emptySub, { color: theme.textSecondary }]}>
              Tap the Convert button above to scan and generate your first thermal receipt slip!
            </Text>
            <TouchableOpacity style={styles.emptyScanBtn} onPress={handleOpenScanner}>
              <Scan size={18} color="#FFFFFF" />
              <Text style={styles.emptyScanBtnText}>Scan First A4 Bill</Text>
            </TouchableOpacity>
          </View>
        ) : (
          bills.map((bill) => (
            <View
              key={bill.id}
              style={[
                styles.billCard,
                { backgroundColor: theme.cardBg, borderColor: theme.borderColor },
              ]}
            >
              <View style={styles.billCardTop}>
                <View style={styles.receiptTag}>
                  <Text style={styles.receiptTagText}>{bill.receiptNumber}</Text>
                </View>
                <View style={styles.typeTag}>
                  <Text style={styles.typeTagText}>{bill.billType}</Text>
                </View>
                <Text style={[styles.billDateText, { color: theme.textSecondary }]}>
                  {new Date(bill.createdAt).toLocaleDateString('en-GB', {
                    day: '2-digit',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Text>
              </View>

              <View style={styles.billCardBody}>
                <View style={styles.billMainInfo}>
                  <Text style={[styles.consumerName, { color: theme.textPrimary }]} numberOfLines={1}>
                    {bill.consumerName || 'Unnamed Consumer'}
                  </Text>
                  <Text style={[styles.providerText, { color: theme.textSecondary }]}>
                    {bill.provider ? `🏢 ${bill.provider}` : 'Utility Provider'}
                  </Text>
                  {Boolean(bill.consumerNumber) && (
                    <Text style={[styles.consumerNumText, { color: theme.textSecondary }]}>
                      CA/Acc: {bill.consumerNumber}
                    </Text>
                  )}
                  {Boolean(bill.dueDate) && (
                    <Text style={[styles.dueDateText, { color: '#F59E0B' }]}>
                      Due: {bill.dueDate}
                    </Text>
                  )}
                </View>

                <View style={styles.billAmountCol}>
                  <Text style={[styles.billTotalAmount, { color: theme.textPrimary }]}>
                    ₹{bill.totalAmount.toFixed(2)}
                  </Text>
                  <Text style={[styles.billFeeNote, { color: '#10B981' }]}>
                    (Fee: ₹{bill.convenienceFee.toFixed(2)})
                  </Text>
                  <View style={styles.statusPill}>
                    <Text style={styles.statusPillText}>{bill.status}</Text>
                  </View>
                </View>
              </View>

              {/* Action Buttons */}
              <View style={[styles.billActionsRow, { borderTopColor: theme.borderColor }]}>
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: 'rgba(59, 130, 246, 0.1)' }]}
                  onPress={() => {
                    setPreviewingBill(bill);
                    setPreviewModalVisible(true);
                  }}
                >
                  <Eye size={15} color="#3B82F6" />
                  <Text style={[styles.actionBtnText, { color: '#3B82F6' }]}>View Slip</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: 'rgba(16, 185, 129, 0.1)' }]}
                  onPress={() => handleShareWhatsApp(bill)}
                >
                  <Share2 size={15} color="#10B981" />
                  <Text style={[styles.actionBtnText, { color: '#10B981' }]}>WhatsApp</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: 'rgba(99, 102, 241, 0.1)' }]}
                  onPress={() => handleReprintSlip(bill)}
                >
                  <Printer size={15} color="#6366F1" />
                  <Text style={[styles.actionBtnText, { color: '#6366F1' }]}>Print Slip</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: 'rgba(239, 68, 68, 0.1)' }]}
                  onPress={() => handleDeleteBill(bill.id, bill.receiptNumber)}
                >
                  <Trash2 size={15} color="#EF4444" />
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* ================= MODAL: SCANNER & CONVERTER ================= */}
      <Modal
        visible={converterModalVisible}
        animationType="slide"
        onRequestClose={() => setConverterModalVisible(false)}
      >
        <SafeAreaView style={[styles.modalContainer, { backgroundColor: theme.bg }]}>
          {/* Modal Header */}
          <View style={[styles.modalHeader, { borderBottomColor: theme.borderColor }]}>
            <TouchableOpacity onPress={() => setConverterModalVisible(false)}>
              <X size={24} color={theme.textPrimary} />
            </TouchableOpacity>
            <Text style={[styles.modalHeaderTitle, { color: theme.textPrimary }]}>
              {scannerStep === 'source' && 'Select A4 Bill'}
              {scannerStep === 'processing' && 'Scanning Bill'}
              {scannerStep === 'edit' && 'Review & Print Slip'}
              {scannerStep === 'success' && 'Bill Printed!'}
            </Text>
            <View style={{ width: 24 }} />
          </View>

          {/* STEP 1: SOURCE PICKER (PDF UPLOAD) */}
          {scannerStep === 'source' && (
            <View style={styles.sourceSelectContainer}>
              <View style={styles.sourceIntro}>
                <FileText size={44} color={BRAND_COLORS.navyInk} />
                <Text style={[styles.sourceTitle, { color: theme.textPrimary }]}>
                  Upload A4 PDF Utility Bill
                </Text>
                <Text style={[styles.sourceSub, { color: theme.textSecondary }]}>
                  Upload e-bills (Electricity, Water, Gas, Telecom) to extract CA number, consumer name, units, due date, and amount — 100% offline.
                </Text>
              </View>

              <View style={styles.sourceButtonsWrap}>
                <TouchableOpacity
                  style={[styles.sourceBtn, { borderColor: BRAND_COLORS.blue600, borderWidth: 2, backgroundColor: 'rgba(37, 99, 235, 0.05)' }]}
                  onPress={handlePickDocument}
                >
                  <View style={[styles.sourceBtnIcon, { backgroundColor: BRAND_COLORS.blue600 }]}>
                    <FileText size={26} color="#FFFFFF" />
                  </View>
                  <View style={styles.sourceBtnTextCol}>
                    <Text style={[styles.sourceBtnTitle, { color: theme.textPrimary, fontWeight: '800' }]}>
                      Select PDF Document
                    </Text>
                    <Text style={[styles.sourceBtnSub, { color: theme.textSecondary }]}>
                      Choose PDF bill from phone downloads or files
                    </Text>
                  </View>
                  <ChevronRight size={20} color={BRAND_COLORS.blue600} />
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* STEP 2: ON-DEVICE OCR EXTRACTION */}
          {scannerStep === 'processing' && (
            <View style={styles.processingContainer}>
              <ActivityIndicator size="large" color={BRAND_COLORS.navyInk} />
              <Text style={[styles.processingTitle, { color: theme.textPrimary }]}>
                {extractingMsg}
              </Text>
              <Text style={[styles.processingSub, { color: theme.textSecondary }]}>
                Running high-precision OCR and schema verification...
              </Text>
            </View>
          )}

          {/* STEP 3: REVIEW, EDIT & LIVE THERMAL PREVIEW */}
          {scannerStep === 'edit' && (
            <ScrollView contentContainerStyle={styles.editScrollContent}>
              <View style={styles.reviewBanner}>
                <Sparkles size={18} color="#3B82F6" />
                <Text style={styles.reviewBannerText}>
                  Filled in from the bill. Please check the amounts before printing:
                </Text>
              </View>

              {/* Live Thermal Receipt Mockup */}
              <View style={styles.slipPreviewContainer}>
                <Text style={[styles.slipPreviewTitle, { color: theme.textSecondary }]}>
                  LIVE THERMAL RECEIPT PREVIEW (EXACT PRINT LAYOUT)
                </Text>
                <UtilityReceiptSlip bill={currentPreviewData} />
              </View>

              {/* Editor Fields */}
              <View style={[styles.editorCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
                <Text style={[styles.editorCardTitle, { color: theme.textPrimary }]}>
                  Bill Information
                </Text>

                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>
                    Kiosk Title / Store Name
                  </Text>
                  <TextInput
                    style={[styles.textInput, { color: theme.textPrimary, borderColor: theme.borderColor }]}
                    value={kioskTitle}
                    onChangeText={setKioskTitle}
                    placeholder="e.g. SEZNIK KIOSK"
                    placeholderTextColor={theme.textSecondary}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>
                    Utility Provider / Board Name
                  </Text>
                  <TextInput
                    style={[styles.textInput, { color: theme.textPrimary, borderColor: theme.borderColor }]}
                    value={provider}
                    onChangeText={setProvider}
                    placeholder="e.g. UPPCL Urban, Tata Power, Delhi Jal Board"
                    placeholderTextColor={theme.textSecondary}
                  />
                </View>

                <View style={styles.inputRow}>
                  <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                    <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>
                      Consumer / CA No.
                    </Text>
                    <TextInput
                      style={[styles.textInput, { color: theme.textPrimary, borderColor: theme.borderColor }]}
                      value={consumerNumber}
                      onChangeText={setConsumerNumber}
                      placeholder="e.g. 1234567890"
                      placeholderTextColor={theme.textSecondary}
                    />
                  </View>

                  <View style={[styles.inputGroup, { flex: 1 }]}>
                    <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>
                      Bill Type
                    </Text>
                    <TextInput
                      style={[styles.textInput, { color: theme.textPrimary, borderColor: theme.borderColor }]}
                      value={billType}
                      onChangeText={setBillType}
                      placeholder="ELECTRICITY"
                      placeholderTextColor={theme.textSecondary}
                    />
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>
                    Consumer / Customer Name
                  </Text>
                  <TextInput
                    style={[styles.textInput, { color: theme.textPrimary, borderColor: theme.borderColor }]}
                    value={consumerName}
                    onChangeText={setConsumerName}
                    placeholder="e.g. Ramesh Kumar"
                    placeholderTextColor={theme.textSecondary}
                  />
                </View>

                <View style={styles.inputRow}>
                  <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                    <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>
                      Bill Due Date
                    </Text>
                    <TextInput
                      style={[styles.textInput, { color: theme.textPrimary, borderColor: theme.borderColor }]}
                      value={dueDate}
                      onChangeText={setDueDate}
                      placeholder="e.g. 15-Sep-2026"
                      placeholderTextColor={theme.textSecondary}
                    />
                  </View>

                  <View style={[styles.inputGroup, { flex: 1 }]}>
                    <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>
                      Units Consumed
                    </Text>
                    <TextInput
                      style={[styles.textInput, { color: theme.textPrimary, borderColor: theme.borderColor }]}
                      value={unitsConsumed}
                      onChangeText={setUnitsConsumed}
                      placeholder="e.g. 142 kWh"
                      placeholderTextColor={theme.textSecondary}
                    />
                  </View>
                </View>

                <View style={styles.divider} />

                {/* Amount & Convenience Fee Controls */}
                <View style={styles.inputRow}>
                  <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                    <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>
                      Bill Amount (₹) *
                    </Text>
                    <TextInput
                      style={[
                        styles.textInput,
                        styles.amountInput,
                        { color: theme.textPrimary, borderColor: theme.borderColor },
                      ]}
                      keyboardType="numeric"
                      value={billAmount}
                      onChangeText={setBillAmount}
                      placeholder="0.00"
                      placeholderTextColor={theme.textSecondary}
                    />
                  </View>

                  <View style={[styles.inputGroup, { flex: 1 }]}>
                    <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>
                      Convenience Fee (₹)
                    </Text>
                    <TextInput
                      style={[
                        styles.textInput,
                        styles.amountInput,
                        { color: '#10B981', borderColor: theme.borderColor },
                      ]}
                      keyboardType="numeric"
                      value={convenienceFee}
                      onChangeText={setConvenienceFee}
                      placeholder="20"
                      placeholderTextColor={theme.textSecondary}
                    />
                  </View>
                </View>

                {/* Quick Fee Presets */}
                <View style={styles.feePresetRow}>
                  {['0', '10', '20', '30', '50'].map((val) => (
                    <TouchableOpacity
                      key={val}
                      style={[
                        styles.feePresetBtn,
                        convenienceFee === val && styles.feePresetBtnActive,
                      ]}
                      onPress={() => setConvenienceFee(val)}
                    >
                      <Text
                        style={[
                          styles.feePresetBtnText,
                          convenienceFee === val && styles.feePresetBtnTextActive,
                        ]}
                      >
                        +₹{val}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Total Received Badge */}
                <View style={styles.totalBadgeBox}>
                  <Text style={styles.totalBadgeLabel}>TOTAL AMOUNT RECEIVED:</Text>
                  <Text style={styles.totalBadgeValue}>₹{calculatedTotal.toFixed(2)}</Text>
                </View>

                {/* Customer Phone for WhatsApp Direct Send */}
                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>
                    Customer Phone (Optional for 1-Tap WhatsApp)
                  </Text>
                  <TextInput
                    style={[styles.textInput, { color: theme.textPrimary, borderColor: theme.borderColor }]}
                    keyboardType="phone-pad"
                    value={customerPhone}
                    onChangeText={setCustomerPhone}
                    placeholder="e.g. 9876543210"
                    placeholderTextColor={theme.textSecondary}
                  />
                </View>
              </View>

              {/* Action Buttons */}
              <View style={styles.editActionsContainer}>
                <TouchableOpacity
                  style={[styles.printSaveBtn, isPrinting && { opacity: 0.7 }]}
                  disabled={isPrinting}
                  onPress={handlePrintAndSave}
                >
                  {isPrinting ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <>
                      <Printer size={20} color="#FFFFFF" />
                      <Text style={styles.printSaveBtnText}>
                        Print Receipt & Save Slip (₹{calculatedTotal.toFixed(2)})
                      </Text>
                    </>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => setScannerStep('source')}
                >
                  <Text style={styles.cancelBtnText}>Choose Another Bill</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          )}

          {/* STEP 4: SUCCESS SCREEN (HIGH-SPEED QUEUE SERVING) */}
          {scannerStep === 'success' && generatedBill && (
            <View style={styles.successContainer}>
              <View style={styles.successIconCircle}>
                <CheckCircle2 size={54} color="#10B981" />
              </View>

              <Text style={[styles.successTitle, { color: theme.textPrimary }]}>
                Receipt Generated & Printed!
              </Text>
              <Text style={[styles.successSub, { color: theme.textSecondary }]}>
                Slip #{generatedBill.receiptNumber} recorded. Total Received: ₹{generatedBill.totalAmount.toFixed(2)}
              </Text>

              {/* 1-Tap WhatsApp to Customer */}
              <TouchableOpacity
                style={styles.successWhatsAppBtn}
                onPress={() => handleShareWhatsApp(generatedBill)}
              >
                <Share2 size={20} color="#FFFFFF" />
                <Text style={styles.successWhatsAppBtnText}>
                  Send Receipt on WhatsApp
                </Text>
              </TouchableOpacity>

              {/* Reprint if roll got jammed */}
              <TouchableOpacity
                style={styles.reprintBtn}
                onPress={() => handleReprintSlip(generatedBill)}
              >
                <Printer size={18} color={theme.textPrimary} />
                <Text style={[styles.reprintBtnText, { color: theme.textPrimary }]}>
                  Reprint Thermal Slip
                </Text>
              </TouchableOpacity>

              <View style={styles.divider} />

              {/* High-speed Kiosk Loop: Scan Next Bill */}
              <TouchableOpacity
                style={styles.scanNextBtn}
                onPress={handleOpenScanner}
              >
                <Zap size={20} color="#FFFFFF" />
                <Text style={styles.scanNextBtnText}>⚡ Scan Next Bill</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.doneBtn}
                onPress={() => setConverterModalVisible(false)}
              >
                <Text style={[styles.doneBtnText, { color: theme.textSecondary }]}>
                  Done & Back to Dashboard
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </SafeAreaView>
      </Modal>

      {/* ================= MODAL: OLD BILL THERMAL PREVIEW ================= */}
      <Modal
        visible={previewModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPreviewModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.previewModalBox, { backgroundColor: theme.cardBg }]}>
            <View style={styles.previewModalHeader}>
              <Text style={[styles.previewModalTitle, { color: theme.textPrimary }]}>
                Receipt #{previewingBill?.receiptNumber}
              </Text>
              <TouchableOpacity onPress={() => setPreviewModalVisible(false)}>
                <X size={20} color={theme.textPrimary} />
              </TouchableOpacity>
            </View>

            {previewingBill && (
              <ScrollView style={{ maxHeight: 440 }}>
                <UtilityReceiptSlip bill={previewingBill} />
              </ScrollView>
            )}

            <View style={styles.previewModalActions}>
              <TouchableOpacity
                style={[styles.previewActionBtn, { backgroundColor: '#10B981' }]}
                onPress={() => previewingBill && handleShareWhatsApp(previewingBill)}
              >
                <Share2 size={16} color="#FFFFFF" />
                <Text style={styles.previewActionBtnText}>WhatsApp</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.previewActionBtn, { backgroundColor: BRAND_COLORS.navyInk }]}
                onPress={() => previewingBill && handleReprintSlip(previewingBill)}
              >
                <Printer size={16} color="#FFFFFF" />
                <Text style={styles.previewActionBtnText}>Print</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backBtn: {
    padding: 6,
    marginRight: 8,
  },
  headerTitleWrap: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  headerSub: {
    fontSize: 11,
    marginTop: 1,
  },
  refreshBtn: {
    padding: 8,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  kpiContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  kpiCard: {
    width: (SCREEN_WIDTH - 42) / 2,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  kpiIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  kpiValue: {
    fontSize: 20,
    fontWeight: '900',
    marginBottom: 2,
  },
  kpiLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  heroCta: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: BRAND_COLORS.navyInk,
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  heroIconBadge: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  heroTextWrap: {
    flex: 1,
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  heroSub: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 11,
    marginTop: 2,
  },
  heroBtnPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 20,
  },
  heroBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  filterPill: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterPillText: {
    fontSize: 12,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    padding: 0,
  },
  sectionHeader: {
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    borderRadius: 16,
    marginTop: 10,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginTop: 12,
  },
  emptySub: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
    paddingHorizontal: 12,
  },
  emptyScanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: BRAND_COLORS.navyInk,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 22,
    marginTop: 16,
  },
  emptyScanBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  billCard: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 12,
  },
  billCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  receiptTag: {
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  receiptTagText: {
    color: '#3B82F6',
    fontSize: 11,
    fontWeight: '800',
  },
  typeTag: {
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  typeTagText: {
    color: '#F59E0B',
    fontSize: 10,
    fontWeight: '800',
  },
  billDateText: {
    marginLeft: 'auto',
    fontSize: 11,
  },
  billCardBody: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  billMainInfo: {
    flex: 1,
    marginRight: 10,
  },
  consumerName: {
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 2,
  },
  providerText: {
    fontSize: 12,
    marginBottom: 2,
  },
  consumerNumText: {
    fontSize: 11,
  },
  dueDateText: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  billAmountCol: {
    alignItems: 'flex-end',
  },
  billTotalAmount: {
    fontSize: 17,
    fontWeight: '900',
  },
  billFeeNote: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 1,
  },
  statusPill: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
    marginTop: 4,
  },
  statusPillText: {
    color: '#10B981',
    fontSize: 9,
    fontWeight: '800',
  },
  billActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 10,
    borderTopWidth: 1,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  actionBtnText: {
    fontSize: 11,
    fontWeight: '700',
  },

  /* Modal Styles */
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  modalHeaderTitle: {
    fontSize: 17,
    fontWeight: '800',
  },
  sourceSelectContainer: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  sourceIntro: {
    alignItems: 'center',
    marginBottom: 32,
  },
  sourceTitle: {
    fontSize: 20,
    fontWeight: '900',
    marginTop: 12,
    textAlign: 'center',
  },
  sourceSub: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
    paddingHorizontal: 20,
  },
  sourceButtonsWrap: {
    gap: 12,
  },
  sourceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(150, 150, 150, 0.08)',
  },
  sourceBtnIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  sourceBtnTextCol: {
    flex: 1,
  },
  sourceBtnTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  sourceBtnSub: {
    fontSize: 11,
    marginTop: 2,
  },
  processingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  processingTitle: {
    fontSize: 17,
    fontWeight: '800',
    marginTop: 16,
    textAlign: 'center',
  },
  processingSub: {
    fontSize: 12,
    marginTop: 6,
    textAlign: 'center',
  },
  editScrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  reviewBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  reviewBannerText: {
    color: '#3B82F6',
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  slipPreviewContainer: {
    marginBottom: 20,
  },
  slipPreviewTitle: {
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  editorCard: {
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 20,
  },
  editorCardTitle: {
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 14,
  },
  inputGroup: {
    marginBottom: 12,
  },
  inputRow: {
    flexDirection: 'row',
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 4,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
  },
  amountInput: {
    fontSize: 16,
    fontWeight: '800',
  },
  feePresetRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 14,
  },
  feePresetBtn: {
    flex: 1,
    paddingVertical: 6,
    alignItems: 'center',
    borderRadius: 6,
    backgroundColor: 'rgba(150, 150, 150, 0.1)',
  },
  feePresetBtnActive: {
    backgroundColor: '#10B981',
  },
  feePresetBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  feePresetBtnTextActive: {
    color: '#FFFFFF',
  },
  totalBadgeBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    padding: 12,
    borderRadius: 10,
    marginBottom: 14,
  },
  totalBadgeLabel: {
    color: '#10B981',
    fontSize: 12,
    fontWeight: '800',
  },
  totalBadgeValue: {
    color: '#10B981',
    fontSize: 18,
    fontWeight: '900',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(150, 150, 150, 0.15)',
    marginVertical: 14,
  },
  editActionsContainer: {
    gap: 10,
  },
  printSaveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: BRAND_COLORS.navyInk,
    paddingVertical: 14,
    borderRadius: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  printSaveBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  cancelBtn: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  cancelBtnText: {
    color: '#EF4444',
    fontSize: 12,
    fontWeight: '700',
  },
  successContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  successIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: '900',
    textAlign: 'center',
  },
  successSub: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 24,
    lineHeight: 18,
  },
  successWhatsAppBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#10B981',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 14,
    width: '100%',
    marginBottom: 10,
  },
  successWhatsAppBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  reprintBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: 'rgba(150, 150, 150, 0.1)',
    width: '100%',
    marginBottom: 10,
  },
  reprintBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  scanNextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: BRAND_COLORS.navyInk,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 14,
    width: '100%',
    marginBottom: 12,
  },
  scanNextBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  doneBtn: {
    paddingVertical: 8,
  },
  doneBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },

  /* Preview Modal */
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  previewModalBox: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 16,
    padding: 16,
  },
  previewModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  previewModalTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  previewModalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  previewActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
  },
  previewActionBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
});
