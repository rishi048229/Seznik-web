import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  StyleSheet,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Sparkles,
  Camera,
  ImageIcon,
  FileText,
  X,
  Plus,
  Trash2,
  CheckCircle2,
  Printer as PrinterIcon,
  AlertCircle,
  ChevronDown,
  Edit3,
  Layers,
  Share2,
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { useProducts } from '@/hooks/useProducts';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useStoreProfile } from '@/hooks/useStoreProfile';
import { KeyboardAvoidingWrapper } from '@/components/ui/KeyboardAvoidingWrapper';
import { usePrinterStore } from '@/store/usePrinterStore';
import { useShallow } from 'zustand/react/shallow';
import ThermalPrinterService, { PrintSaleData } from '@/services/PrinterService';
import { ReceiptTemplateMockup } from '@/components/ui/ReceiptTemplateMockup';
import { sanitizeErrorMessage } from '@/utils/errorHandler';
import { RECEIPT_TEMPLATES, getTemplateById } from '@/constants/receiptTemplates';
import { BRAND_COLORS } from '@/constants/theme';

interface Props {
  visible: boolean;
  onClose: () => void;
}

export function AiBillToReceiptModal({ visible, onClose }: Props) {
  const theme = useAppTheme();
  const { aiConvertInvoice } = useProducts();
  const { storeName: defaultStoreName, storeAddress: defaultStoreAddress, storePhone: defaultStorePhone, storeGstin: defaultStoreGstin } = useStoreProfile();
  const {
    activeTemplateId,
    paperWidth,
  } = usePrinterStore(
    useShallow((s) => ({
    activeTemplateId: s.activeTemplateId,
    paperWidth: s.paperWidth,
    }))
  );

  const [step, setStep] = useState<'select' | 'analyzing' | 'review'>('select');
  const [selectedTemplateId, setSelectedTemplateId] = useState(activeTemplateId || 'standard');
  const [selectedPaperWidth, setSelectedPaperWidth] = useState<'58mm' | '80mm'>(paperWidth || '58mm');
  const [saleData, setSaleData] = useState<PrintSaleData | null>(null);
  const [loadingMsg, setLoadingMsg] = useState('Analyzing A4 bill with Gemini AI...');
  const [isPrinting, setIsPrinting] = useState(false);
  const [showEditFields, setShowEditFields] = useState(false);

  const activeTemplate = getTemplateById(selectedTemplateId);

  const resetState = () => {
    setStep('select');
    setSaleData(null);
    setIsPrinting(false);
    setShowEditFields(false);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const processFileForAi = async (uri: string, mimeType: string, existingBase64?: string) => {
    try {
      setStep('analyzing');
      setLoadingMsg('Reading A4 bill & extracting receipt details via Gemini AI...');

      let base64Data = existingBase64;
      if (!base64Data) {
        base64Data = await FileSystem.readAsStringAsync(uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
      }

      const res = await aiConvertInvoice({
        imageBase64: base64Data,
        mimeType: mimeType || 'image/jpeg',
      });

      if (res.success && res.saleData) {
        setSaleData(res.saleData);
        setStep('review');
      } else {
        Alert.alert(
          'Conversion Failed',
          'Gemini AI could not extract clear bill data from this document. Please try a clearer invoice photo or PDF.',
          [{ text: 'Try Again', onPress: () => setStep('select') }]
        );
      }
    } catch (err: any) {
      console.error('AI bill conversion error:', err);
      Alert.alert(
        'AI Conversion Failed',
        sanitizeErrorMessage(err, 'Failed to convert bill with Gemini AI. Please check image clarity and try again.'),
        [{ text: 'Try Again', onPress: () => setStep('select') }]
      );
    }
  };

  const handleCameraCapture = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission Denied', 'Camera access is required.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      base64: true,
      quality: 0.6,
    });

    if (!result.canceled && result.assets[0]?.uri) {
      const asset = result.assets[0];
      await processFileForAi(asset.uri, 'image/jpeg', asset.base64 || undefined);
    }
  };

  const handleGalleryPick = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission Denied', 'Photo gallery access is required.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      base64: true,
      quality: 0.6,
    });

    if (!result.canceled && result.assets[0]?.uri) {
      const asset = result.assets[0];
      await processFileForAi(asset.uri, asset.mimeType || 'image/jpeg', asset.base64 || undefined);
    }
  };

  const handleDocumentPick = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/*', 'application/pdf', 'text/csv', 'text/plain', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const doc = result.assets[0];
        await processFileForAi(doc.uri, doc.mimeType || 'application/pdf');
      }
    } catch (err: any) {
      Alert.alert('File Picker Error', sanitizeErrorMessage(err, 'Failed to select document. Please try again.'));
    }
  };

  const handleUpdateField = (key: keyof PrintSaleData, val: any) => {
    if (!saleData) return;
    setSaleData({ ...saleData, [key]: val });
  };

  const handleUpdateItem = (index: number, field: string, val: any) => {
    if (!saleData || !saleData.items) return;
    const updatedItems = [...saleData.items];
    const target = { ...updatedItems[index], [field]: val };
    
    if (field === 'quantity' || field === 'unitPrice') {
      const qty = parseFloat(String(target.quantity)) || 0;
      const price = parseFloat(String(target.unitPrice)) || 0;
      target.total = qty * price;
    }
    updatedItems[index] = target;

    const newSubtotal = updatedItems.reduce((sum, item) => sum + (item.total || 0), 0);
    const newGrandTotal = newSubtotal + (saleData.totalTax || 0) - (saleData.totalDiscount || 0);

    setSaleData({
      ...saleData,
      items: updatedItems,
      subtotal: newSubtotal,
      grandTotal: newGrandTotal,
    });
  };

  const handleAddItem = () => {
    if (!saleData) return;
    const newItem = {
      productName: 'New Item',
      quantity: 1,
      unitPrice: 100,
      total: 100,
      unit: 'Pc',
      gstRate: 0,
    };
    const updatedItems = [...(saleData.items || []), newItem];
    const newSubtotal = updatedItems.reduce((sum, item) => sum + (item.total || 0), 0);
    const newGrandTotal = newSubtotal + (saleData.totalTax || 0) - (saleData.totalDiscount || 0);

    setSaleData({
      ...saleData,
      items: updatedItems,
      subtotal: newSubtotal,
      grandTotal: newGrandTotal,
    });
  };

  const handleRemoveItem = (index: number) => {
    if (!saleData || !saleData.items) return;
    const updatedItems = saleData.items.filter((_, i) => i !== index);
    const newSubtotal = updatedItems.reduce((sum, item) => sum + (item.total || 0), 0);
    const newGrandTotal = newSubtotal + (saleData.totalTax || 0) - (saleData.totalDiscount || 0);

    setSaleData({
      ...saleData,
      items: updatedItems,
      subtotal: newSubtotal,
      grandTotal: newGrandTotal,
    });
  };

  const getCleanSaleData = (): PrintSaleData | null => {
    if (!saleData) return null;
    const itemsList = (saleData.items || []).map((item) => {
      const qty = Number(item.quantity) || 1;
      const price = Number(item.unitPrice) || 0;
      return {
        productName: item.productName || 'Item',
        quantity: qty,
        unitPrice: price,
        total: Number(item.total) || qty * price,
        unit: item.unit || 'Pc',
        gstRate: Number(item.gstRate) || 0,
      };
    });

    const subtotal = Number(saleData.subtotal) || itemsList.reduce((sum, i) => sum + i.total, 0);
    const grandTotal = Number(saleData.grandTotal) || subtotal + (Number(saleData.totalTax) || 0) - (Number(saleData.totalDiscount) || 0);

    return {
      storeName: saleData.storeName || defaultStoreName || 'Store',
      storeAddress: saleData.storeAddress || defaultStoreAddress,
      storePhone: saleData.storePhone || defaultStorePhone,
      storeGstin: saleData.storeGstin || defaultStoreGstin,
      invoiceNumber: saleData.invoiceNumber || `INV-${Math.floor(1000 + Math.random() * 9000)}`,
      date: saleData.date || new Date().toLocaleDateString('en-GB'),
      customerName: saleData.customerName || undefined,
      customerPhone: saleData.customerPhone || undefined,
      items: itemsList,
      subtotal,
      totalDiscount: Number(saleData.totalDiscount) || 0,
      totalTax: Number(saleData.totalTax) || 0,
      grandTotal,
      paymentMethod: saleData.paymentMethod || 'CASH',
      amountPaid: Number(saleData.amountPaid) || grandTotal,
      changeReturned: Number(saleData.changeReturned) || 0,
    };
  };

  const handlePrintThermal = async () => {
    const dataToPrint = getCleanSaleData();
    if (!dataToPrint) return;
    setIsPrinting(true);
    try {
      const ok = await ThermalPrinterService.printReceipt(dataToPrint, selectedPaperWidth, {
        template: activeTemplate,
      });

      if (ok) {
        Alert.alert('Receipt Printed!', `Successfully sent receipt to your connected ${selectedPaperWidth} thermal printer.`);
      } else {
        Alert.alert(
          'Printer Not Connected',
          'Could not reach Bluetooth printer. Please make sure your printer is powered on & connected in Printers section.',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Print System Dialog',
              onPress: () => handlePrintSystem(),
            },
          ]
        );
      }
    } catch (err: any) {
      Alert.alert('Print Error', sanitizeErrorMessage(err, 'Failed to print receipt. Please verify printer connection.'));
    } finally {
      setIsPrinting(false);
    }
  };

  const handleShare = async () => {
    const data = getCleanSaleData();
    if (!data) return;
    const itemsText = data.items
      .map((i) => `• ${i.productName} x${i.quantity} = ₹${(i.total || 0).toFixed(2)}`)
      .join('\n');
    const msg = `*${(data.storeName || 'SEZNIK BILL').toUpperCase()}*\nBill No: ${data.invoiceNumber}\nDate: ${data.date}\n${data.customerName ? `Customer: ${data.customerName}\n` : ''}--------------------------------\n${itemsText}\n--------------------------------\nSubtotal: ₹${data.subtotal.toFixed(2)}\nTax/GST: ₹${data.totalTax.toFixed(2)}\n*GRAND TOTAL: ₹${data.grandTotal.toFixed(2)}*\nPayment: ${data.paymentMethod}\nThank you!`;
    try {
      await Share.share({ message: msg });
    } catch (e) {}
  };

  const handlePrintSystem = async () => {
    const dataToPrint = getCleanSaleData();
    if (!dataToPrint) return;
    setIsPrinting(true);
    try {
      await ThermalPrinterService.printA4Invoice(dataToPrint, { template: activeTemplate });
    } catch (err: any) {
      Alert.alert('Print Error', sanitizeErrorMessage(err, 'Failed to open system print dialog.'));
    } finally {
      setIsPrinting(false);
    }
  };


  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
      <KeyboardAvoidingWrapper inModal>
      <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: theme.borderColor }]}>
          <View style={styles.titleRow}>
            <View style={styles.iconBadge}>
              <Sparkles size={18} color="#FFFFFF" />
            </View>
            <View style={{ marginLeft: 10 }}>
              <Text style={[styles.title, { color: theme.textPrimary }]}>AI A4 Bill Converter</Text>
              <Text style={[styles.subtitle, { color: theme.textSecondary }]}>Convert A4 Invoices to Thermal Receipts</Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={handleClose}
            style={styles.closeBtn}
            hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
            activeOpacity={0.6}
          >
            <X size={22} color={theme.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* STEP 1: UPLOAD SOURCE */}
        {step === 'select' && (
          <ScrollView style={{ flex: 1, padding: 18 }} contentContainerStyle={{ paddingBottom: 40 }}>
            <View style={[styles.infoBanner, { backgroundColor: 'rgba(37, 99, 235, 0.08)', borderColor: 'rgba(37, 99, 235, 0.2)' }]}>
              <AlertCircle size={20} color={BRAND_COLORS.blue600} style={{ marginRight: 10 }} />
              <Text style={[styles.infoText, { color: theme.textPrimary }]}>
                Upload any company A4 invoice, PDF bill, or paper receipt. Gemini AI will instantly convert it into a formatted thermal receipt ready for 1-tap printing!
              </Text>
            </View>

            <Text style={[styles.sectionHeading, { color: theme.textPrimary }]}>Choose A4 Bill Document</Text>

            <TouchableOpacity
              onPress={handleCameraCapture}
              style={[styles.optionCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}
            >
              <View style={[styles.optionIconBox, { backgroundColor: '#10B981' }]}>
                <Camera size={24} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1, marginLeft: 14 }}>
                <Text style={[styles.optionTitle, { color: theme.textPrimary }]}>Take Photo of Bill</Text>
                <Text style={[styles.optionSub, { color: theme.textSecondary }]}>Capture A4 paper invoice or bill using camera</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleGalleryPick}
              style={[styles.optionCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}
            >
              <View style={[styles.optionIconBox, { backgroundColor: BRAND_COLORS.blue600 }]}>
                <ImageIcon size={24} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1, marginLeft: 14 }}>
                <Text style={[styles.optionTitle, { color: theme.textPrimary }]}>Gallery / Screenshot</Text>
                <Text style={[styles.optionSub, { color: theme.textSecondary }]}>Choose invoice image or digital bill screenshot</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleDocumentPick}
              style={[styles.optionCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}
            >
              <View style={[styles.optionIconBox, { backgroundColor: '#8B5CF6' }]}>
                <FileText size={24} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1, marginLeft: 14 }}>
                <Text style={[styles.optionTitle, { color: theme.textPrimary }]}>Upload PDF Bill</Text>
                <Text style={[styles.optionSub, { color: theme.textSecondary }]}>Import PDF invoice files from supplier or email</Text>
              </View>
            </TouchableOpacity>
          </ScrollView>
        )}

        {/* STEP 2: ANALYZING LOADING STATE */}
        {step === 'analyzing' && (
          <View style={styles.loadingContainer}>
            <View style={styles.aiPulseCircle}>
              <Sparkles size={40} color="#FFFFFF" />
            </View>
            <ActivityIndicator size="large" color={BRAND_COLORS.blue600} style={{ marginTop: 24 }} />
            <Text style={[styles.loadingTitle, { color: theme.textPrimary }]}>Converting A4 Bill to Receipt</Text>
            <Text style={[styles.loadingSub, { color: theme.textSecondary }]}>{loadingMsg}</Text>
          </View>
        )}

        {/* STEP 3: REVIEW & PRINT RECEIPT */}
        {step === 'review' && saleData && (
          <View style={{ flex: 1 }}>
            {/* Paper Width & Template Selector Bar */}
            <View style={[styles.templateSelectorBar, { backgroundColor: theme.cardBg, borderBottomColor: theme.borderColor }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 10, paddingRight: 10, borderRightWidth: 1, borderRightColor: theme.borderColor }}>
                <TouchableOpacity
                  onPress={() => setSelectedPaperWidth('58mm')}
                  style={[
                    styles.widthChip,
                    {
                      backgroundColor: selectedPaperWidth === '58mm' ? BRAND_COLORS.blue600 : theme.bg,
                      borderColor: selectedPaperWidth === '58mm' ? BRAND_COLORS.blue600 : theme.borderColor,
                    },
                  ]}
                >
                  <Text style={[styles.widthChipText, { color: selectedPaperWidth === '58mm' ? '#FFFFFF' : theme.textPrimary }]}>
                    2" (58mm)
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setSelectedPaperWidth('80mm')}
                  style={[
                    styles.widthChip,
                    {
                      backgroundColor: selectedPaperWidth === '80mm' ? BRAND_COLORS.blue600 : theme.bg,
                      borderColor: selectedPaperWidth === '80mm' ? BRAND_COLORS.blue600 : theme.borderColor,
                      marginLeft: 4,
                    },
                  ]}
                >
                  <Text style={[styles.widthChipText, { color: selectedPaperWidth === '80mm' ? '#FFFFFF' : theme.textPrimary }]}>
                    3" (80mm)
                  </Text>
                </TouchableOpacity>
              </View>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ alignItems: 'center' }}>
                {RECEIPT_TEMPLATES.map((t) => {
                  const selected = t.id === selectedTemplateId;
                  return (
                    <TouchableOpacity
                      key={t.id}
                      onPress={() => setSelectedTemplateId(t.id)}
                      style={[
                        styles.templateChip,
                        {
                          backgroundColor: selected ? BRAND_COLORS.blue600 : theme.bg,
                          borderColor: selected ? BRAND_COLORS.blue600 : theme.borderColor,
                        },
                      ]}
                    >
                      <Text style={[styles.templateChipText, { color: selected ? '#FFFFFF' : theme.textPrimary }]}>
                        {t.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            <ScrollView style={{ flex: 1, padding: 14 }} contentContainerStyle={{ paddingBottom: 100 }}>
              {/* Receipt Visual Preview */}
              <View style={styles.previewContainer}>
                <ReceiptTemplateMockup
                  template={activeTemplate}
                  storeName={saleData.storeName || defaultStoreName || 'Store Name'}
                  storeAddress={saleData.storeAddress || defaultStoreAddress}
                  storePhone={saleData.storePhone || defaultStorePhone}
                  storeGstin={saleData.storeGstin || defaultStoreGstin}
                  invoiceNumber={saleData.invoiceNumber || 'INV-001'}
                  date={saleData.date || new Date().toLocaleDateString('en-GB')}
                  customerName={saleData.customerName}
                  customerPhone={saleData.customerPhone}
                  items={(saleData.items || []).map((i) => ({
                    productName: i.productName,
                    quantity: Number(i.quantity) || 1,
                    unitPrice: Number(i.unitPrice) || 0,
                    total: Number(i.total) || 0,
                    unit: i.unit,
                  }))}
                  subtotal={saleData.subtotal || 0}
                  totalDiscount={saleData.totalDiscount || 0}
                  totalTax={saleData.totalTax || 0}
                  grandTotal={saleData.grandTotal || 0}
                />
              </View>

              {/* Edit Fields Accordion Toggle */}
              <TouchableOpacity
                onPress={() => setShowEditFields(!showEditFields)}
                style={[styles.editToggleBtn, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}
              >
                <Edit3 size={16} color={BRAND_COLORS.blue600} />
                <Text style={[styles.editToggleText, { color: theme.textPrimary }]}>
                  {showEditFields ? 'Hide Receipt Fields Editor' : 'Edit Extracted Receipt Fields'}
                </Text>
                <ChevronDown size={18} color={theme.textSecondary} style={showEditFields ? { transform: [{ rotate: '180deg' }] } : undefined} />
              </TouchableOpacity>

              {showEditFields && (
                <View style={[styles.editCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
                  <Text style={[styles.editGroupTitle, { color: theme.textPrimary }]}>Store & Header Details</Text>
                  
                  <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Store / Issuer Name</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: theme.bg, borderColor: theme.borderColor, color: theme.textPrimary }]}
                    value={saleData.storeName || ''}
                    placeholder="e.g. My Retail Shop or Utility Board"
                    placeholderTextColor={theme.textSecondary}
                    onChangeText={(txt) => handleUpdateField('storeName', txt)}
                  />

                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Store Phone</Text>
                      <TextInput
                        style={[styles.input, { backgroundColor: theme.bg, borderColor: theme.borderColor, color: theme.textPrimary }]}
                        value={saleData.storePhone || ''}
                        placeholder="e.g. 9876543210"
                        placeholderTextColor={theme.textSecondary}
                        onChangeText={(txt) => handleUpdateField('storePhone', txt)}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Store GSTIN / Reg No</Text>
                      <TextInput
                        style={[styles.input, { backgroundColor: theme.bg, borderColor: theme.borderColor, color: theme.textPrimary }]}
                        value={saleData.storeGstin || ''}
                        placeholder="GSTIN"
                        placeholderTextColor={theme.textSecondary}
                        onChangeText={(txt) => handleUpdateField('storeGstin', txt)}
                      />
                    </View>
                  </View>

                  <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Store Address</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: theme.bg, borderColor: theme.borderColor, color: theme.textPrimary }]}
                    value={saleData.storeAddress || ''}
                    placeholder="Store Address"
                    placeholderTextColor={theme.textSecondary}
                    onChangeText={(txt) => handleUpdateField('storeAddress', txt)}
                  />

                  <Text style={[styles.editGroupTitle, { color: theme.textPrimary, marginTop: 12 }]}>Invoice & Customer Details</Text>

                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Invoice / Bill No</Text>
                      <TextInput
                        style={[styles.input, { backgroundColor: theme.bg, borderColor: theme.borderColor, color: theme.textPrimary }]}
                        value={saleData.invoiceNumber || ''}
                        onChangeText={(txt) => handleUpdateField('invoiceNumber', txt)}
                      />
                    </View>

                    <View style={{ flex: 1 }}>
                      <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Date</Text>
                      <TextInput
                        style={[styles.input, { backgroundColor: theme.bg, borderColor: theme.borderColor, color: theme.textPrimary }]}
                        value={saleData.date || ''}
                        onChangeText={(txt) => handleUpdateField('date', txt)}
                      />
                    </View>
                  </View>

                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Customer / Consumer Name</Text>
                      <TextInput
                        style={[styles.input, { backgroundColor: theme.bg, borderColor: theme.borderColor, color: theme.textPrimary }]}
                        value={saleData.customerName || ''}
                        placeholder="Customer Name"
                        placeholderTextColor={theme.textSecondary}
                        onChangeText={(txt) => handleUpdateField('customerName', txt)}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Customer Phone</Text>
                      <TextInput
                        style={[styles.input, { backgroundColor: theme.bg, borderColor: theme.borderColor, color: theme.textPrimary }]}
                        value={saleData.customerPhone || ''}
                        placeholder="Phone Number"
                        placeholderTextColor={theme.textSecondary}
                        onChangeText={(txt) => handleUpdateField('customerPhone', txt)}
                      />
                    </View>
                  </View>

                  <Text style={[styles.editGroupTitle, { color: theme.textPrimary, marginTop: 14 }]}>Line Items</Text>
                  {(saleData.items || []).map((item, idx) => (
                    <View key={idx} style={[styles.itemEditRow, { borderColor: theme.borderColor }]}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                        <TextInput
                          style={[styles.itemNameInput, { color: theme.textPrimary }]}
                          value={item.productName}
                          onChangeText={(txt) => handleUpdateItem(idx, 'productName', txt)}
                        />
                        <TouchableOpacity onPress={() => handleRemoveItem(idx)} style={{ padding: 4 }}>
                          <Trash2 size={15} color="#EF4444" />
                        </TouchableOpacity>
                      </View>

                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Qty</Text>
                          <TextInput
                            style={[styles.inputCompact, { backgroundColor: theme.bg, borderColor: theme.borderColor, color: theme.textPrimary }]}
                            value={String(item.quantity)}
                            onChangeText={(txt) => handleUpdateItem(idx, 'quantity', txt)}
                            keyboardType="numeric"
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Price (₹)</Text>
                          <TextInput
                            style={[styles.inputCompact, { backgroundColor: theme.bg, borderColor: theme.borderColor, color: theme.textPrimary }]}
                            value={String(item.unitPrice)}
                            onChangeText={(txt) => handleUpdateItem(idx, 'unitPrice', txt)}
                            keyboardType="numeric"
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Total (₹)</Text>
                          <Text style={[styles.totalDisplay, { color: theme.textPrimary }]}>₹{(item.total || 0).toFixed(2)}</Text>
                        </View>
                      </View>
                    </View>
                  ))}

                  <TouchableOpacity onPress={handleAddItem} style={[styles.addItemBtn, { borderColor: BRAND_COLORS.blue600 }]}>
                    <Plus size={14} color={BRAND_COLORS.blue600} />
                    <Text style={[styles.addItemText, { color: BRAND_COLORS.blue600 }]}>Add Extra Item</Text>
                  </TouchableOpacity>

                  <Text style={[styles.editGroupTitle, { color: theme.textPrimary, marginTop: 14 }]}>Totals & Taxes</Text>
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Total Tax / GST (₹)</Text>
                      <TextInput
                        style={[styles.input, { backgroundColor: theme.bg, borderColor: theme.borderColor, color: theme.textPrimary }]}
                        value={String(saleData.totalTax || 0)}
                        onChangeText={(txt) => handleUpdateField('totalTax', parseFloat(txt) || 0)}
                        keyboardType="numeric"
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Total Discount (₹)</Text>
                      <TextInput
                        style={[styles.input, { backgroundColor: theme.bg, borderColor: theme.borderColor, color: theme.textPrimary }]}
                        value={String(saleData.totalDiscount || 0)}
                        onChangeText={(txt) => handleUpdateField('totalDiscount', parseFloat(txt) || 0)}
                        keyboardType="numeric"
                      />
                    </View>
                  </View>
                  <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Grand Total (₹)</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: theme.bg, borderColor: theme.borderColor, color: theme.textPrimary, fontWeight: '900', fontSize: 15 }]}
                    value={String(saleData.grandTotal || 0)}
                    onChangeText={(txt) => handleUpdateField('grandTotal', parseFloat(txt) || 0)}
                    keyboardType="numeric"
                  />
                </View>
              )}
            </ScrollView>

            {/* Bottom Actions Footer */}
            <View style={[styles.footer, { backgroundColor: theme.cardBg, borderTopColor: theme.borderColor }]}>
              <TouchableOpacity onPress={handleShare} disabled={isPrinting} style={styles.shareBtn}>
                <Share2 size={16} color={BRAND_COLORS.blue600} />
                <Text style={[styles.shareBtnText, { color: BRAND_COLORS.blue600 }]}>Share</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={handlePrintSystem} disabled={isPrinting} style={styles.systemPrintBtn}>
                <FileText size={16} color={theme.textPrimary} />
                <Text style={[styles.systemPrintText, { color: theme.textPrimary }]}>A4 PDF</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={handlePrintThermal} disabled={isPrinting} style={styles.printBtn}>
                {isPrinting ? (
                  <ActivityIndicator color="#FFFFFF" style={{ marginRight: 8 }} />
                ) : (
                  <PrinterIcon size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                )}
                <Text style={styles.printText}>Print Receipt ({selectedPaperWidth})</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </SafeAreaView>
      </KeyboardAvoidingWrapper>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center' },
  iconBadge: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: BRAND_COLORS.blue600,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 17, fontWeight: '900' },
  subtitle: { fontSize: 11, marginTop: 1 },
  closeBtn: { padding: 6 },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 20,
  },
  infoText: { flex: 1, fontSize: 12, lineHeight: 17, fontWeight: '600' },
  sectionHeading: { fontSize: 14, fontWeight: '800', marginBottom: 12 },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
  },
  optionIconBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionTitle: { fontSize: 15, fontWeight: '800' },
  optionSub: { fontSize: 11, marginTop: 2 },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  aiPulseCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: BRAND_COLORS.blue600,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
  },
  loadingTitle: { fontSize: 20, fontWeight: '900', marginTop: 18 },
  loadingSub: { fontSize: 13, marginTop: 6, textAlign: 'center', paddingHorizontal: 20 },
  templateSelectorBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  templateBarLabel: { fontSize: 11, fontWeight: '800', marginRight: 8 },
  templateChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    marginRight: 6,
  },
  templateChipText: { fontSize: 12, fontWeight: '700' },
  previewContainer: {
    alignItems: 'center',
    marginVertical: 10,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
  editToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 10,
    marginBottom: 10,
  },
  editToggleText: { flex: 1, fontSize: 13, fontWeight: '800', marginLeft: 8 },
  editCard: { padding: 14, borderRadius: 16, borderWidth: 1, marginBottom: 14 },
  editGroupTitle: { fontSize: 13, fontWeight: '900', marginBottom: 8 },
  inputLabel: { fontSize: 10, fontWeight: '700', marginBottom: 3 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, fontSize: 13, fontWeight: '600', marginBottom: 8 },
  inputCompact: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, fontSize: 12, fontWeight: '600' },
  itemEditRow: { borderBottomWidth: 1, paddingVertical: 8 },
  itemNameInput: { flex: 1, fontSize: 13, fontWeight: '800' },
  totalDisplay: { fontSize: 12, fontWeight: '900', marginTop: 6 },
  addItemBtn: { borderWidth: 1, borderStyle: 'dashed', borderRadius: 10, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  addItemText: { fontSize: 12, fontWeight: '800', marginLeft: 4 },
  widthChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
  },
  widthChipText: { fontSize: 11, fontWeight: '800' },
  shareBtn: {
    borderWidth: 1,
    borderColor: BRAND_COLORS.blue600,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareBtnText: { fontSize: 13, fontWeight: '800', marginLeft: 4 },
  systemPrintBtn: { borderWidth: 1, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  systemPrintText: { fontSize: 13, fontWeight: '800', marginLeft: 6 },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    gap: 10,
  },
  printBtn: { flex: 1, backgroundColor: BRAND_COLORS.blue600, borderRadius: 14, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  printText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
});
