import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert,
  StyleSheet,
  Share,
  useColorScheme,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  X,
  FileText,
  Image as ImageIcon,
  Camera,
  Printer,
  Share2,
  CheckCircle2,
  RefreshCw,
  Sparkles,
  Zap,
  Phone,
  Calendar,
  User,
  CreditCard,
  Hash,
} from 'lucide-react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { BRAND_COLORS } from '@/constants/theme';
import { useStoreProfile } from '@/hooks/useStoreProfile';
import ThermalPrinterService from '@/services/PrinterService';
import { useLabelPrinterStatus } from '@/hooks/useLabelPrinterStatus';
import {
  isOfflineOcrSupported,
  recognizeBillFromImage,
  recognizeBillFromPdf,
} from '../../../modules/offline-bill-ocr';
import {
  parseUtilityBillText,
  ParsedUtilityBill,
  buildUtilityReceiptPrintData,
} from '@/services/UtilityBillParser';

interface A4BillConverterModalProps {
  visible: boolean;
  onClose: () => void;
}

export const A4BillConverterModal: React.FC<A4BillConverterModalProps> = ({
  visible,
  onClose,
}) => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { storeName } = useStoreProfile();
  const printerStatus = useLabelPrinterStatus();

  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('Processing bill...');
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [parsedBill, setParsedBill] = useState<ParsedUtilityBill | null>(null);
  const [paperWidth, setPaperWidth] = useState<'58mm' | '80mm'>('58mm');
  const [isPrinting, setIsPrinting] = useState(false);
  const [showDocPreview, setShowDocPreview] = useState(true);

  const resetAll = () => {
    setPreviewUri(null);
    setParsedBill(null);
    setIsLoading(false);
  };

  const handlePickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) return;

      const asset = result.assets[0];
      const isPdf = asset.mimeType === 'application/pdf' || asset.name.toLowerCase().endsWith('.pdf');

      await processFile(asset.uri, isPdf);
    } catch (e: any) {
      Alert.alert('File Picker Error', e?.message || 'Could not select document');
    }
  };

  const handlePickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.95,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) return;
      await processFile(result.assets[0].uri, false);
    } catch (e: any) {
      Alert.alert('Gallery Error', e?.message || 'Could not pick image');
    }
  };

  const handleTakePhoto = async () => {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Camera Permission Needed', 'Allow camera access to capture bill photos.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        quality: 0.95,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) return;
      await processFile(result.assets[0].uri, false);
    } catch (e: any) {
      Alert.alert('Camera Error', e?.message || 'Could not capture photo');
    }
  };

  const loadDemoBill = () => {
    const demoRawText = `
      UTTAR PRADESH POWER CORPORATION LIMITED (UPPCL)
      ELECTRICITY CONSUMER BILL / RECEIPT
      DISCOM: PVVNL URBAN
      SUB-DIVISION: MEERUT CENTRAL
      CA NUMBER: 1048291048
      CONSUMER NAME: RAMESH CHANDRA SHARMA
      ADDRESS: 42/B CIVIL LINES, MEERUT
      BILL NO: UPPCL-2026-98124
      BILL DATE: 01/09/2026
      DUE DATE: 15/09/2026
      UNITS CONSUMED: 168.00 KWH
      CONNECTED LOAD: 2.00 KW
      TARIFF: LMV-1 (DOMESTIC)
      ENERGY CHARGES: Rs. 1,120.00
      FIXED CHARGES: Rs. 180.00
      ELECTRICITY DUTY: Rs. 65.00
      CURRENT DEMAND: Rs. 1,365.00
      SURCHARGE / ARREARS: Rs. 0.00
      TOTAL AMOUNT PAYABLE: Rs. 1,365.00
      AMOUNT AFTER DUE DATE: Rs. 1,415.00
    `;
    const parsed = parseUtilityBillText(demoRawText);
    setParsedBill(parsed);
    setPreviewUri(null);
  };

  const processFile = async (uri: string, isPdf: boolean) => {
    setIsLoading(true);
    setLoadingMessage(isPdf ? 'Rendering PDF page & running offline OCR...' : 'Scanning image with offline OCR...');

    try {
      let rawText = '';
      let displayUri = uri;

      if (isOfflineOcrSupported()) {
        if (isPdf) {
          const res = await recognizeBillFromPdf(uri);
          rawText = res.fullText;
          displayUri = res.previewImageUri;
        } else {
          const res = await recognizeBillFromImage(uri);
          rawText = res.fullText;
          displayUri = res.previewImageUri;
        }
      } else {
        // Fallback demo parser on web or dev builds without native Android module
        rawText = `DEMO BILL\nCONSUMER NO: 1234567890\nNAME: Demo Customer\nTOTAL AMOUNT PAYABLE: Rs. 1,250.00\nDUE DATE: 15/09/2026\nUNITS: 140 KWH`;
      }

      const parsed = parseUtilityBillText(rawText);
      setParsedBill(parsed);
      setPreviewUri(displayUri);
    } catch (e: any) {
      Alert.alert('OCR Processing Error', e?.message || 'Could not extract text from document. You can still fill details manually.');
      // Provide an empty editable template so the user is never blocked
      setParsedBill({
        providerName: 'Electricity Utility Bill',
        consumerNo: '',
        consumerName: '',
        billNumber: `UB-${Date.now().toString().slice(-6)}`,
        billDate: new Date().toLocaleDateString(),
        dueDate: '',
        unitsConsumed: '',
        billAmount: 0,
        convenienceFee: 20,
        totalCollected: 20,
        rawText: '',
      });
      setPreviewUri(uri);
    } finally {
      setIsLoading(false);
    }
  };

  const updateBillField = (key: keyof ParsedUtilityBill, value: any) => {
    if (!parsedBill) return;
    const next = { ...parsedBill, [key]: value };
    if (key === 'billAmount' || key === 'convenienceFee') {
      const amt = key === 'billAmount' ? parseFloat(value) || 0 : parsedBill.billAmount;
      const fee = key === 'convenienceFee' ? parseFloat(value) || 0 : parsedBill.convenienceFee;
      next.totalCollected = Math.max(0, amt + fee);
    }
    setParsedBill(next);
  };

  const handlePrint = async () => {
    if (!parsedBill) return;
    setIsPrinting(true);
    try {
      const printData = buildUtilityReceiptPrintData(parsedBill, storeName || 'SEZNIK KIOSK');
      const ok = await ThermalPrinterService.printReceipt(printData, paperWidth, { copies: 1 });
      if (ok) {
        Alert.alert('Receipt Printed!', `Printed receipt for ${parsedBill.providerName} (${parsedBill.consumerNo || parsedBill.billNumber}).`);
      } else {
        Alert.alert('Print Failed', 'Could not send receipt to printer. Please verify printer connection.');
      }
    } catch (e: any) {
      Alert.alert('Print Error', e?.message || 'Failed to print receipt.');
    } finally {
      setIsPrinting(false);
    }
  };

  const handleShare = async () => {
    if (!parsedBill) return;
    const msg = `*${(storeName || 'SEZNIK KIOSK').toUpperCase()}*\n*UTILITY BILL PAYMENT RECEIPT*\n--------------------------------\nProvider: ${parsedBill.providerName}\nConsumer No: ${parsedBill.consumerNo || 'N/A'}\nConsumer Name: ${parsedBill.consumerName || 'N/A'}\nBill No: ${parsedBill.billNumber}\nDue Date: ${parsedBill.dueDate || 'N/A'}\nBill Amount: ₹${parsedBill.billAmount.toFixed(2)}\nKiosk Fee: ₹${parsedBill.convenienceFee.toFixed(2)}\n*TOTAL PAID: ₹${parsedBill.totalCollected.toFixed(2)}*\nStatus: SUCCESS (PAID)\nDate: ${parsedBill.billDate}\n--------------------------------\nThank you for paying with us!`;
    try {
      await Share.share({ message: msg });
    } catch (e) {}
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={[styles.container, { backgroundColor: isDark ? '#0F1117' : '#F8FAFC' }]}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: isDark ? '#1F2430' : '#E2E8F0' }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={styles.headerIconCircle}>
                <Zap size={18} color="#FFFFFF" />
              </View>
              <View>
                <Text style={[styles.title, { color: isDark ? '#F3F4F6' : '#0F172A' }]}>
                  A4 Bill to Receipt
                </Text>
                <Text style={{ fontSize: 11, color: isDark ? '#9CA3AF' : '#64748B' }}>
                  Offline OCR • No Cloud AI • 2" & 3" Slips
                </Text>
              </View>
            </View>

            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={20} color={isDark ? '#9CA3AF' : '#64748B'} />
            </TouchableOpacity>
          </View>

          {/* Loading Overlay */}
          {isLoading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={BRAND_COLORS.blue600} />
              <Text style={[styles.loadingText, { color: isDark ? '#E5E7EB' : '#1E293B' }]}>
                {loadingMessage}
              </Text>
            </View>
          )}

          {!isLoading && !parsedBill && (
            <ScrollView contentContainerStyle={styles.emptyContainer}>
              <View style={styles.introCard}>
                <Sparkles size={28} color="#6366F1" style={{ marginBottom: 8 }} />
                <Text style={[styles.introTitle, { color: isDark ? '#F3F4F6' : '#0F172A' }]}>
                  Instant A4 Bill to Thermal Slip
                </Text>
                <Text style={[styles.introDesc, { color: isDark ? '#9CA3AF' : '#64748B' }]}>
                  Upload an electricity bill, utility bill, or invoice (PDF, photo, or screenshot). We extract the details 100% offline and format it into a professional 2" or 3" customer receipt.
                </Text>
              </View>

              <View style={styles.actionsGrid}>
                <TouchableOpacity
                  style={[styles.actionTile, { backgroundColor: isDark ? '#1E222D' : '#FFFFFF', borderColor: isDark ? '#2E3444' : '#E2E8F0' }]}
                  onPress={handlePickDocument}
                  activeOpacity={0.8}
                >
                  <View style={[styles.tileIcon, { backgroundColor: '#3B82F6' }]}>
                    <FileText size={22} color="#FFFFFF" />
                  </View>
                  <Text style={[styles.tileTitle, { color: isDark ? '#F3F4F6' : '#0F172A' }]}>Upload PDF Bill</Text>
                  <Text style={styles.tileSub}>Downloaded A4 bill from portal</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionTile, { backgroundColor: isDark ? '#1E222D' : '#FFFFFF', borderColor: isDark ? '#2E3444' : '#E2E8F0' }]}
                  onPress={handlePickImage}
                  activeOpacity={0.8}
                >
                  <View style={[styles.tileIcon, { backgroundColor: '#10B981' }]}>
                    <ImageIcon size={22} color="#FFFFFF" />
                  </View>
                  <Text style={[styles.tileTitle, { color: isDark ? '#F3F4F6' : '#0F172A' }]}>Pick Screenshot / Photo</Text>
                  <Text style={styles.tileSub}>Gallery image or portal snapshot</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionTile, { backgroundColor: isDark ? '#1E222D' : '#FFFFFF', borderColor: isDark ? '#2E3444' : '#E2E8F0' }]}
                  onPress={handleTakePhoto}
                  activeOpacity={0.8}
                >
                  <View style={[styles.tileIcon, { backgroundColor: '#8B5CF6' }]}>
                    <Camera size={22} color="#FFFFFF" />
                  </View>
                  <Text style={[styles.tileTitle, { color: isDark ? '#F3F4F6' : '#0F172A' }]}>Take Photo</Text>
                  <Text style={styles.tileSub}>Scan paper bill on desk</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity onPress={loadDemoBill} style={styles.demoLink}>
                <Text style={{ color: BRAND_COLORS.blue600, fontSize: 13, fontWeight: '700' }}>
                  ⚡ Try with Sample Electricity Bill (UPPCL)
                </Text>
              </TouchableOpacity>
            </ScrollView>
          )}

          {!isLoading && parsedBill && (
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 14, paddingBottom: 40 }}>
              {/* Reset / Scan new button */}
              <View style={styles.topToolbar}>
                <TouchableOpacity onPress={resetAll} style={styles.resetBtn}>
                  <RefreshCw size={14} color={BRAND_COLORS.blue600} />
                  <Text style={styles.resetBtnText}>Scan Another Bill</Text>
                </TouchableOpacity>

                <View style={styles.widthSwitch}>
                  <TouchableOpacity
                    onPress={() => setPaperWidth('58mm')}
                    style={[styles.widthTab, paperWidth === '58mm' && styles.widthTabActive]}
                  >
                    <Text style={[styles.widthTabText, paperWidth === '58mm' && styles.widthTabTextActive]}>2" (58mm)</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setPaperWidth('80mm')}
                    style={[styles.widthTab, paperWidth === '80mm' && styles.widthTabActive]}
                  >
                    <Text style={[styles.widthTabText, paperWidth === '80mm' && styles.widthTabTextActive]}>3" (80mm)</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Document Preview (Collapsible) */}
              {previewUri && (
                <View style={[styles.sectionCard, { backgroundColor: isDark ? '#1A1D26' : '#FFFFFF', borderColor: isDark ? '#2A2F3D' : '#E2E8F0' }]}>
                  <TouchableOpacity
                    onPress={() => setShowDocPreview(!showDocPreview)}
                    style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
                  >
                    <Text style={[styles.cardTitle, { color: isDark ? '#E2E8F0' : '#1E293B' }]}>
                      📄 Original Document Preview
                    </Text>
                    <Text style={{ fontSize: 11, color: BRAND_COLORS.blue600, fontWeight: '700' }}>
                      {showDocPreview ? 'Hide' : 'Show'}
                    </Text>
                  </TouchableOpacity>

                  {showDocPreview && (
                    <Image
                      source={{ uri: previewUri }}
                      style={styles.docImage}
                      resizeMode="contain"
                    />
                  )}
                </View>
              )}

              {/* EDITABLE BILL DETAILS FORM */}
              <View style={[styles.sectionCard, { backgroundColor: isDark ? '#1A1D26' : '#FFFFFF', borderColor: isDark ? '#2A2F3D' : '#E2E8F0' }]}>
                <Text style={[styles.cardTitle, { color: isDark ? '#E2E8F0' : '#1E293B' }]}>
                  ✏️ Verify & Edit Bill Details
                </Text>
                <Text style={{ fontSize: 11, color: isDark ? '#9CA3AF' : '#64748B', marginBottom: 12 }}>
                  Tap any field below to edit or correct values before printing.
                </Text>

                {/* Provider / Discom */}
                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: isDark ? '#9CA3AF' : '#64748B' }]}>Provider / Discom Name</Text>
                  <TextInput
                    style={[styles.input, { color: isDark ? '#FFF' : '#000', backgroundColor: isDark ? '#222733' : '#F1F5F9' }]}
                    value={parsedBill.providerName}
                    onChangeText={(val) => updateBillField('providerName', val)}
                  />
                </View>

                {/* Consumer No & Name */}
                <View style={styles.inputRow}>
                  <View style={[styles.inputGroup, { flex: 1 }]}>
                    <Text style={[styles.inputLabel, { color: isDark ? '#9CA3AF' : '#64748B' }]}>Consumer / CA No</Text>
                    <TextInput
                      style={[styles.input, { color: isDark ? '#FFF' : '#000', backgroundColor: isDark ? '#222733' : '#F1F5F9' }]}
                      value={parsedBill.consumerNo}
                      onChangeText={(val) => updateBillField('consumerNo', val)}
                      placeholder="1234567890"
                      placeholderTextColor="#94A3B8"
                    />
                  </View>

                  <View style={[styles.inputGroup, { flex: 1.2 }]}>
                    <Text style={[styles.inputLabel, { color: isDark ? '#9CA3AF' : '#64748B' }]}>Consumer Name</Text>
                    <TextInput
                      style={[styles.input, { color: isDark ? '#FFF' : '#000', backgroundColor: isDark ? '#222733' : '#F1F5F9' }]}
                      value={parsedBill.consumerName}
                      onChangeText={(val) => updateBillField('consumerName', val)}
                      placeholder="Customer Name"
                      placeholderTextColor="#94A3B8"
                    />
                  </View>
                </View>

                {/* Dates & Units */}
                <View style={styles.inputRow}>
                  <View style={[styles.inputGroup, { flex: 1 }]}>
                    <Text style={[styles.inputLabel, { color: isDark ? '#9CA3AF' : '#64748B' }]}>Due Date</Text>
                    <TextInput
                      style={[styles.input, { color: isDark ? '#FFF' : '#000', backgroundColor: isDark ? '#222733' : '#F1F5F9' }]}
                      value={parsedBill.dueDate}
                      onChangeText={(val) => updateBillField('dueDate', val)}
                      placeholder="DD/MM/YYYY"
                      placeholderTextColor="#94A3B8"
                    />
                  </View>

                  <View style={[styles.inputGroup, { flex: 1 }]}>
                    <Text style={[styles.inputLabel, { color: isDark ? '#9CA3AF' : '#64748B' }]}>Units Consumed</Text>
                    <TextInput
                      style={[styles.input, { color: isDark ? '#FFF' : '#000', backgroundColor: isDark ? '#222733' : '#F1F5F9' }]}
                      value={parsedBill.unitsConsumed}
                      onChangeText={(val) => updateBillField('unitsConsumed', val)}
                      placeholder="e.g. 142 kWh"
                      placeholderTextColor="#94A3B8"
                    />
                  </View>
                </View>

                {/* Financials: Bill Amount & Kiosk Fee */}
                <View style={styles.inputRow}>
                  <View style={[styles.inputGroup, { flex: 1 }]}>
                    <Text style={[styles.inputLabel, { color: isDark ? '#9CA3AF' : '#64748B' }]}>Bill Amount (₹)</Text>
                    <TextInput
                      style={[styles.input, styles.amountInput, { color: '#2563EB', backgroundColor: isDark ? '#222733' : '#F1F5F9' }]}
                      value={parsedBill.billAmount ? String(parsedBill.billAmount) : ''}
                      onChangeText={(val) => updateBillField('billAmount', val)}
                      keyboardType="numeric"
                      placeholder="0.00"
                      placeholderTextColor="#94A3B8"
                    />
                  </View>

                  <View style={[styles.inputGroup, { flex: 1 }]}>
                    <Text style={[styles.inputLabel, { color: isDark ? '#9CA3AF' : '#64748B' }]}>Kiosk Fee (₹)</Text>
                    <TextInput
                      style={[styles.input, styles.amountInput, { color: '#10B981', backgroundColor: isDark ? '#222733' : '#F1F5F9' }]}
                      value={String(parsedBill.convenienceFee)}
                      onChangeText={(val) => updateBillField('convenienceFee', val)}
                      keyboardType="numeric"
                      placeholder="20.00"
                      placeholderTextColor="#94A3B8"
                    />
                  </View>
                </View>

                {/* Total Display */}
                <View style={styles.totalBox}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: isDark ? '#9CA3AF' : '#64748B' }}>
                    TOTAL COLLECTED:
                  </Text>
                  <Text style={{ fontSize: 22, fontWeight: '900', color: BRAND_COLORS.blue600 }}>
                    ₹{parsedBill.totalCollected.toFixed(2)}
                  </Text>
                </View>
              </View>

              {/* LIVE THERMAL RECEIPT PREVIEW */}
              <View style={[styles.sectionCard, { backgroundColor: isDark ? '#1A1D26' : '#FFFFFF', borderColor: isDark ? '#2A2F3D' : '#E2E8F0' }]}>
                <Text style={[styles.cardTitle, { color: isDark ? '#E2E8F0' : '#1E293B', marginBottom: 8 }]}>
                  🧾 Live Thermal Slip Preview ({paperWidth})
                </Text>

                <View style={[styles.receiptPaper, { width: paperWidth === '58mm' ? 240 : 310 }]}>
                  <Text style={styles.rcStoreName}>{storeName || 'SEZNIK KIOSK'}</Text>
                  <Text style={styles.rcSub}>UTILITY PAYMENT RECEIPT</Text>
                  <Text style={styles.rcDivider}>================================</Text>
                  <Text style={styles.rcLine}><Text style={styles.rcBold}>Provider:</Text> {parsedBill.providerName}</Text>
                  {parsedBill.consumerNo ? <Text style={styles.rcLine}><Text style={styles.rcBold}>Consumer No:</Text> {parsedBill.consumerNo}</Text> : null}
                  {parsedBill.consumerName ? <Text style={styles.rcLine}><Text style={styles.rcBold}>Consumer:</Text> {parsedBill.consumerName}</Text> : null}
                  <Text style={styles.rcLine}><Text style={styles.rcBold}>Date:</Text> {parsedBill.billDate}</Text>
                  {parsedBill.dueDate ? <Text style={styles.rcLine}><Text style={styles.rcBold}>Due Date:</Text> {parsedBill.dueDate}</Text> : null}
                  {parsedBill.unitsConsumed ? <Text style={styles.rcLine}><Text style={styles.rcBold}>Units:</Text> {parsedBill.unitsConsumed}</Text> : null}
                  <Text style={styles.rcDivider}>--------------------------------</Text>
                  <View style={styles.rcRow}>
                    <Text style={styles.rcLine}>Bill Amount:</Text>
                    <Text style={styles.rcBold}>₹{parsedBill.billAmount.toFixed(2)}</Text>
                  </View>
                  {parsedBill.convenienceFee > 0 && (
                    <View style={styles.rcRow}>
                      <Text style={styles.rcLine}>Kiosk Fee:</Text>
                      <Text style={styles.rcBold}>₹{parsedBill.convenienceFee.toFixed(2)}</Text>
                    </View>
                  )}
                  <Text style={styles.rcDivider}>--------------------------------</Text>
                  <View style={styles.rcRow}>
                    <Text style={[styles.rcBold, { fontSize: 13 }]}>TOTAL PAID:</Text>
                    <Text style={[styles.rcBold, { fontSize: 14 }]}>₹{parsedBill.totalCollected.toFixed(2)}</Text>
                  </View>
                  <Text style={styles.rcDivider}>================================</Text>
                  <Text style={styles.rcStatus}>[ PAYMENT SUCCESSFUL ]</Text>
                  <Text style={styles.rcFooter}>Thank you! Keep this slip.</Text>
                </View>
              </View>

              {/* ACTION BUTTONS */}
              <View style={styles.bottomBar}>
                <TouchableOpacity
                  style={[styles.printBtn, { opacity: isPrinting ? 0.6 : 1 }]}
                  onPress={handlePrint}
                  disabled={isPrinting}
                  activeOpacity={0.8}
                >
                  {isPrinting ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <>
                      <Printer size={18} color="#FFF" style={{ marginRight: 8 }} />
                      <Text style={styles.printBtnText}>
                        Print {paperWidth} Slip
                      </Text>
                    </>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.shareBtn}
                  onPress={handleShare}
                  activeOpacity={0.8}
                >
                  <Share2 size={18} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            </ScrollView>
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#3B82F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 16, fontWeight: '900' },
  closeBtn: { padding: 8, borderRadius: 8 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  loadingText: { fontSize: 14, fontWeight: '700', marginTop: 12 },
  emptyContainer: { padding: 20, alignItems: 'center' },
  introCard: { alignItems: 'center', textAlign: 'center', marginBottom: 24, marginTop: 10 },
  introTitle: { fontSize: 19, fontWeight: '900', marginBottom: 6, textAlign: 'center' },
  introDesc: { fontSize: 12.5, lineHeight: 18, textAlign: 'center', paddingHorizontal: 12 },
  actionsGrid: { width: '100%', gap: 12 },
  actionTile: {
    flexDirection: 'column',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  tileIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  tileTitle: { fontSize: 14, fontWeight: '800', marginBottom: 2 },
  tileSub: { fontSize: 11, color: '#94A3B8' },
  demoLink: { marginTop: 24, padding: 10 },
  topToolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
  },
  resetBtnText: { fontSize: 12, fontWeight: '700', color: BRAND_COLORS.blue600 },
  widthSwitch: {
    flexDirection: 'row',
    borderRadius: 8,
    backgroundColor: '#E2E8F0',
    padding: 2,
  },
  widthTab: { paddingVertical: 5, paddingHorizontal: 10, borderRadius: 6 },
  widthTabActive: { backgroundColor: '#FFFFFF' },
  widthTabText: { fontSize: 11, fontWeight: '700', color: '#64748B' },
  widthTabTextActive: { color: '#0F172A', fontWeight: '900' },
  sectionCard: {
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    marginBottom: 14,
  },
  cardTitle: { fontSize: 13, fontWeight: '900', marginBottom: 2 },
  docImage: { width: '100%', height: 220, marginTop: 10, borderRadius: 8, backgroundColor: '#000' },
  inputGroup: { marginBottom: 10 },
  inputRow: { flexDirection: 'row', gap: 10 },
  inputLabel: { fontSize: 10.5, fontWeight: '800', marginBottom: 4, letterSpacing: 0.3 },
  input: {
    height: 38,
    borderRadius: 8,
    paddingHorizontal: 10,
    fontSize: 13,
    fontWeight: '600',
  },
  amountInput: { fontSize: 15, fontWeight: '900' },
  totalBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(150,150,150,0.15)',
    marginTop: 4,
  },
  receiptPaper: {
    alignSelf: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    marginVertical: 6,
  },
  rcStoreName: {
    fontSize: 13,
    fontWeight: '900',
    color: '#0F172A',
    textAlign: 'center',
  },
  rcSub: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#64748B',
    textAlign: 'center',
    marginTop: 1,
  },
  rcDivider: {
    fontSize: 9,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: '#0F172A',
    textAlign: 'center',
    marginVertical: 2,
  },
  rcLine: {
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: '#0F172A',
    lineHeight: 14,
  },
  rcBold: {
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: '#0F172A',
  },
  rcRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rcStatus: {
    fontSize: 11,
    fontWeight: '900',
    color: '#10B981',
    textAlign: 'center',
    marginVertical: 4,
  },
  rcFooter: {
    fontSize: 8.5,
    color: '#64748B',
    textAlign: 'center',
  },
  bottomBar: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  printBtn: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    backgroundColor: BRAND_COLORS.blue600,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: BRAND_COLORS.blue600,
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  printBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
  shareBtn: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
