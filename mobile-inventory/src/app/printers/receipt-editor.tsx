import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Pressable,
  TextInput,
  Modal,
  Alert,
  StyleSheet,
  Platform,
  StatusBar,
  Switch,
  ActivityIndicator,
  Image,
  Animated,
  PanResponder,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Save,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  GripVertical,
  Eye,
  Printer,
  Type,
  ImageIcon,
  PlusSquare,
  Minus,
  Barcode as BarcodeIcon,
  QrCode,
  ArrowLeftRight,
  Table as TableIcon,
  FileCode,
  FileText,
  X,
  Check,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Bold,
  Italic,
  Underline,
  Share2,
  Camera,
  Layers,
  Store,
  MapPin,
  Phone,
  Calendar,
  User,
  CreditCard,
  Tag,
  Sliders,
  Edit3,
  Upload,
  Sparkles,
} from 'lucide-react-native';
import { LogoBackgroundModal } from '@/components/common/LogoBackgroundModal';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { usePrinterStore } from '@/store/usePrinterStore';
import ThermalPrinterService, { PrintSaleData } from '@/services/PrinterService';
import { buildSampleTestSale, buildTestReceiptPrintOptions } from '@/utils/fastSaleCheckout';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useSettings } from '@/hooks/useSettings';
import { useAuth } from '@/hooks/useAuth';
import { TaxBillingPrinterSection } from '@/components/billing/TaxBillingPrinterSection';
import {
  CustomReceiptTemplate,
  CustomReceiptEntry,
  ReceiptEntryType,
  TEMPLATE_VARIABLES,
  createDefaultReceiptTemplate,
  TextReceiptEntry,
  ImageReceiptEntry,
  TextSpecialReceiptEntry,
  HorizontalLineReceiptEntry,
  BarcodeReceiptEntry,
  LeftRightTextReceiptEntry,
  TableReceiptEntry,
  MultiFormatReceiptEntry,
  FilesNoteReceiptEntry,
} from '@/types/customReceipt';
import { BRAND_COLORS } from '@/constants/theme';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { CustomReceiptMockup } from '@/components/ui/CustomReceiptMockup';
import { RECEIPT_LOGO_DEFAULT_WIDTH_PERCENT } from '@shared/receiptPrintGeometry';

interface DraggableEntryRowProps {
  entry: CustomReceiptEntry;
  index: number;
  totalCount: number;
  theme: any;
  onSelect: (entry: CustomReceiptEntry) => void;
  onToggle: (id: string, val: boolean) => void;
  onDelete: (id: string) => void;
  onMove: (idx: number, dir: 'up' | 'down') => void;
  onReorder: (from: number, to: number) => void;
  getTileInfo: (entry: CustomReceiptEntry) => { title: string; subtitle: string; icon: React.ReactNode };
}

const DRAG_ROW_HEIGHT = 74;

function DraggableEntryRow({
  entry,
  index,
  totalCount,
  theme,
  onSelect,
  onToggle,
  onDelete,
  onMove,
  onReorder,
  getTileInfo,
}: DraggableEntryRowProps) {
  const [isDragging, setIsDragging] = useState(false);
  const panY = useRef(new Animated.Value(0)).current;

  const tile = getTileInfo(entry);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dy) > 6,
      onPanResponderGrant: () => {
        setIsDragging(true);
      },
      onPanResponderMove: (_, gesture) => {
        panY.setValue(gesture.dy);
      },
      onPanResponderRelease: (_, gesture) => {
        setIsDragging(false);
        const delta = Math.round(gesture.dy / DRAG_ROW_HEIGHT);
        if (delta !== 0) {
          onReorder(index, index + delta);
        }
        Animated.spring(panY, {
          toValue: 0,
          friction: 6,
          tension: 40,
          useNativeDriver: true,
        }).start();
      },
      onPanResponderTerminate: () => {
        setIsDragging(false);
        Animated.spring(panY, {
          toValue: 0,
          friction: 6,
          tension: 40,
          useNativeDriver: true,
        }).start();
      },
    })
  ).current;

  return (
    <Animated.View
      style={[
        styles.entryRowCard,
        {
          backgroundColor: theme.cardBg,
          borderColor: isDragging ? '#2563EB' : entry.enabled ? theme.borderColor : '#E2E8F0',
          borderWidth: isDragging ? 2 : 1,
          opacity: entry.enabled ? 1 : 0.55,
          zIndex: isDragging ? 999 : 1,
          transform: [{ translateY: panY }, { scale: isDragging ? 1.02 : 1 }],
          shadowColor: '#000',
          shadowOffset: { width: 0, height: isDragging ? 6 : 1 },
          shadowOpacity: isDragging ? 0.25 : 0.05,
          shadowRadius: isDragging ? 8 : 2,
          elevation: isDragging ? 8 : 1,
        },
      ]}
    >
      {/* Drag Grip Handle */}
      <View {...panResponder.panHandlers} style={styles.dragGripHandle}>
        <GripVertical size={20} color={isDragging ? '#2563EB' : theme.textSecondary} />
      </View>

      {/* Up/Down Micro Stepper Controls */}
      <View style={styles.reorderCol}>
        <TouchableOpacity
          disabled={index === 0}
          onPress={() => onMove(index, 'up')}
          style={[styles.reorderBtn, index === 0 && { opacity: 0.2 }]}
        >
          <ChevronUp size={14} color={theme.textSecondary} />
        </TouchableOpacity>
        <TouchableOpacity
          disabled={index === totalCount - 1}
          onPress={() => onMove(index, 'down')}
          style={[styles.reorderBtn, index === totalCount - 1 && { opacity: 0.2 }]}
        >
          <ChevronDown size={14} color={theme.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Tile Icon */}
      <View style={[styles.entryIconWrap, { backgroundColor: theme.isDark ? '#1E293B' : '#F1F5F9' }]}>
        {tile.icon}
      </View>

      {/* Tile Title & Value info (Tap to Edit) */}
      <TouchableOpacity
        style={styles.entryContentCol}
        activeOpacity={0.7}
        onPress={() => onSelect(entry)}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={[styles.entryTypeName, { color: theme.textPrimary }]} numberOfLines={1}>
            {tile.title}
          </Text>
          <Edit3 size={12} color={theme.textSecondary} />
        </View>
        <Text style={[styles.entrySummaryText, { color: theme.textSecondary }]} numberOfLines={1}>
          {tile.subtitle}
        </Text>
      </TouchableOpacity>

      {/* Toggle & Delete */}
      <View style={styles.entryRightActions}>
        <Switch
          value={entry.enabled}
          onValueChange={(val) => onToggle(entry.id, val)}
          trackColor={{ false: '#CBD5E1', true: '#86EFAC' }}
          thumbColor={entry.enabled ? '#16A34A' : '#F1F5F9'}
        />
        <TouchableOpacity
          onPress={() => onDelete(entry.id)}
          style={styles.deleteEntryBtn}
          activeOpacity={0.7}
        >
          <Trash2 size={16} color="#DC2626" />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

export default function ReceiptEditorScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const { settings } = useSettings();
  const { user } = useAuth();
  const topPadding = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0, 12);

  const {
    customTemplates,
    saveCustomTemplate,
    activeCustomTemplateId,
    setActiveCustomTemplate,
    paperWidth: globalPaperWidth,
    enableBillQrCode,
    activeTemplateId,
    topMargin,
    autoCut,
    fontSize,
  } = usePrinterStore();

  const [template, setTemplate] = useState<CustomReceiptTemplate>(() => {
    if (id) {
      const existing = customTemplates.find((t) => t.id === id);
      if (existing) return JSON.parse(JSON.stringify(existing));
    }
    return createDefaultReceiptTemplate('New Custom Receipt');
  });

  const [isNameEditing, setIsNameEditing] = useState(false);
  const [templateName, setTemplateName] = useState(template.name);
  const [showAddEntrySheet, setShowAddEntrySheet] = useState(false);
  const [editingEntry, setEditingEntry] = useState<CustomReceiptEntry | null>(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [logoBgModalUri, setLogoBgModalUri] = useState<string | null>(null);
  const [logoBgCallback, setLogoBgCallback] = useState<((uri: string) => void) | null>(null);

  const openLogoBgOption = (uri: string, onSelected: (finalUri: string) => void) => {
    setLogoBgModalUri(uri);
    setLogoBgCallback(() => onSelected);
  };

  useEffect(() => {
    if (id) {
      const existing = customTemplates.find((t) => t.id === id);
      if (existing) {
        setTemplate(JSON.parse(JSON.stringify(existing)));
        setTemplateName(existing.name);
      }
    }
  }, [id, customTemplates]);

  // Sample data for live preview & test printing
  const samplePrintData: PrintSaleData = useMemo(
    () =>
      buildSampleTestSale(settings, {
        invoiceNumber: 'INV-2026-0042',
        date: new Date().toLocaleDateString('en-GB'),
        customerName: 'Aarav Sharma',
        customerPhone: '+91 99887 76655',
        items: [
          { productName: 'Basmati Rice 5kg', quantity: 1, unitPrice: 450, total: 450, unit: 'Bag', gstRate: 5 },
          { productName: 'Sunflower Oil 1L', quantity: 2, unitPrice: 180, total: 360, unit: 'Bottle', gstRate: 5 },
          { productName: 'Whole Wheat Flour 5kg', quantity: 1, unitPrice: 280, total: 280, unit: 'Bag', gstRate: 0 },
        ],
        subtotal: 1090,
        totalDiscount: 50,
        taxableAmt: 1040,
        sgst: 20.25,
        cgst: 20.25,
        totalTax: 40.5,
        grandTotal: 1080.5,
        amountPaid: 1100,
        changeReturned: 19.5,
        paymentMethod: 'UPI',
      }, user),
    [settings, user]
  );

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const updated: CustomReceiptTemplate = {
        ...template,
        name: templateName.trim() || 'Custom Receipt',
        updatedAt: new Date().toISOString(),
      };
      await saveCustomTemplate(updated);
      Alert.alert('Receipt Saved', `"${updated.name}" has been saved successfully!`);
    } catch {
      Alert.alert('Error', 'Could not save receipt template.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleMoveEntry = (index: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= template.entries.length) return;
    const list = [...template.entries];
    const [removed] = list.splice(index, 1);
    list.splice(targetIdx, 0, removed);
    setTemplate({ ...template, entries: list });
  };

  const handleReorderEntries = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;
    const clampedTo = Math.max(0, Math.min(toIndex, template.entries.length - 1));
    const list = [...template.entries];
    const [movedItem] = list.splice(fromIndex, 1);
    list.splice(clampedTo, 0, movedItem);
    setTemplate({ ...template, entries: list });
  };

  const handleToggleEntry = (id: string, enabled: boolean) => {
    setTemplate((prev) => ({
      ...prev,
      entries: prev.entries.map((e) => (e.id === id ? { ...e, enabled } : e)),
    }));
  };

  const handleDeleteEntry = (id: string) => {
    Alert.alert('Remove Section', 'Are you sure you want to remove this section from the receipt?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          setTemplate((prev) => ({
            ...prev,
            entries: prev.entries.filter((e) => e.id !== id),
          }));
        },
      },
    ]);
  };

  const handleAddNewEntryType = (type: ReceiptEntryType) => {
    const newId = `entry-${Date.now()}`;
    let entry: CustomReceiptEntry;

    switch (type) {
      case 'text':
        entry = {
          id: newId,
          type: 'text',
          enabled: true,
          text: '{{store_name}}',
          size: 'medium',
          bold: false,
          underline: false,
          align: 'left',
        };
        break;
      case 'image':
        entry = {
          id: newId,
          type: 'image',
          enabled: true,
          imageUri: settings?.businessLogoURL || undefined,
          align: 'center',
          widthPercent: RECEIPT_LOGO_DEFAULT_WIDTH_PERCENT,
        };
        break;
      case 'text_special':
        entry = {
          id: newId,
          type: 'text_special',
          enabled: true,
          text: 'Special Header Line',
          fontSizePt: 14,
          bold: true,
          italic: false,
          underline: false,
          align: 'center',
        };
        break;
      case 'horizontal_line':
        entry = {
          id: newId,
          type: 'horizontal_line',
          enabled: true,
          lineStyle: 'dashed',
        };
        break;
      case 'barcode':
        entry = {
          id: newId,
          type: 'barcode',
          enabled: true,
          codeType: 'qr_code',
          qrType: 'upi',
          format: 'qr',
          value: '{{upi_qr}}',
          upiId: settings?.upiId || 'store@upi',
          align: 'center',
          size: 'medium',
          showText: false,
        };
        break;
      case 'left_right_text':
        entry = {
          id: newId,
          type: 'left_right_text',
          enabled: true,
          left: 'Total Amount:',
          right: '{{grand_total}}',
          bold: true,
          size: 'small',
        };
        break;
      case 'table':
        entry = {
          id: newId,
          type: 'table',
          enabled: true,
          tableType: 'simple',
          showTaxColumn: false,
          columnHeaders: { item: 'Item', total: 'Total' },
        };
        break;
      case 'multi_format':
        entry = {
          id: newId,
          type: 'multi_format',
          enabled: true,
          align: 'left',
          segments: [
            { text: 'Prefix:', bold: true, size: 'small' },
            { text: 'Value', bold: false, size: 'small' },
          ],
        };
        break;
      case 'files_note':
        entry = {
          id: newId,
          type: 'files_note',
          enabled: true,
          title: 'Terms & Conditions',
          content: '1. Goods once sold cannot be returned without bill.\n2. Warranty as per manufacturer policy.',
          align: 'left',
        };
        break;
    }

    setTemplate((prev) => ({
      ...prev,
      entries: [...prev.entries, entry],
    }));
    setShowAddEntrySheet(false);
    setEditingEntry(entry);
  };

  const handleUpdateEntry = (updated: CustomReceiptEntry) => {
    setTemplate((prev) => ({
      ...prev,
      entries: prev.entries.map((e) => (e.id === updated.id ? updated : e)),
    }));
    setEditingEntry(null);
  };

  const handlePickImage = async (fromCamera = false) => {
    if (fromCamera) {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Camera permission is required.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        quality: 0.8,
      });
      if (!result.canceled && result.assets?.[0]?.uri && editingEntry && editingEntry.type === 'image') {
        openLogoBgOption(result.assets[0].uri, (finalUri) => {
          setEditingEntry((prev) => (prev && prev.type === 'image' ? { ...prev, imageUri: finalUri } : prev));
        });
      }
    } else {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Gallery access is needed.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: true,
        quality: 0.8,
      });
      if (!result.canceled && result.assets?.[0]?.uri && editingEntry && editingEntry.type === 'image') {
        openLogoBgOption(result.assets[0].uri, (finalUri) => {
          setEditingEntry((prev) => (prev && prev.type === 'image' ? { ...prev, imageUri: finalUri } : prev));
        });
      }
    }
  };

  const handleApplyEditingEntry = () => {
    if (!editingEntry) return;
    setTemplate((prev) => ({
      ...prev,
      entries: prev.entries.map((e) => (e.id === editingEntry.id ? editingEntry : e)),
    }));
    setEditingEntry(null);
  };

  const handleTestPrint = async () => {
    setIsPrinting(true);
    try {
      const ok = await ThermalPrinterService.printReceipt(samplePrintData, template.paperWidth || globalPaperWidth, {
        ...buildTestReceiptPrintOptions({
          activeTemplateId,
          customTemplates,
          activeCustomTemplateId,
          enableBillQrCode,
          topMargin,
          autoCut,
          fontSize,
          settings,
          customTemplate: template,
          copies: 1,
        }),
      });
      if (ok) {
        Alert.alert('Print Sent', 'Test custom receipt printed successfully!');
      }
    } catch (e: any) {
      Alert.alert('Print Error', e?.message || 'Could not print test receipt.');
    } finally {
      setIsPrinting(false);
    }
  };

  const handleSharePdf = async () => {
    try {
      const html = ThermalPrinterService.generateReceiptHtml(samplePrintData, template.paperWidth || globalPaperWidth, {
        ...buildTestReceiptPrintOptions({
          activeTemplateId,
          customTemplates,
          activeCustomTemplateId,
          enableBillQrCode,
          topMargin,
          autoCut,
          fontSize,
          settings,
          customTemplate: template,
          copies: 1,
        }),
      });
      const { uri } = await Print.printToFileAsync({ html });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
      } else {
        Alert.alert('PDF Created', `Saved to: ${uri}`);
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not generate PDF');
    }
  };

  // Helper to get human friendly titles, subtitles and icons for tiles (No Emojis)
  const getTileInfo = (entry: CustomReceiptEntry): { title: string; subtitle: string; icon: React.ReactNode } => {
    switch (entry.type) {
      case 'text': {
        const text = entry.text || '';
        let title = 'Custom Text';
        if (text.includes('{{store_name}}')) title = 'Store Name Header';
        else if (text.includes('{{store_address}}')) title = 'Store Address & Contact';
        else if (text.includes('{{store_gstin}}')) title = 'GSTIN Number';
        else if (text.toLowerCase().includes('thank')) title = 'Thank You Message';

        const readable = text
          .replace(/{{store_name}}/gi, samplePrintData.storeName || 'Store Name')
          .replace(/{{store_address}}/gi, '123 Market St')
          .replace(/{{store_phone}}/gi, '+91 9876543210')
          .replace(/{{store_gstin}}/gi, '27AAAAA0000A1Z5')
          .replace(/{{invoice_no}}/gi, 'INV-1024')
          .replace(/\n/g, ' • ');

        return {
          title,
          subtitle: `${readable || '(Empty)'} • ${entry.size || 'medium'} • ${entry.align || 'left'}`,
          icon: <Type size={18} color="#2563EB" />,
        };
      }

      case 'image':
        return {
          title: 'Shop Logo',
          subtitle: `Size: ${entry.widthPercent || RECEIPT_LOGO_DEFAULT_WIDTH_PERCENT}% • Position: ${entry.align || 'center'}`,
          icon: <ImageIcon size={18} color="#16A34A" />,
        };

      case 'text_special': {
        const text = entry.text || '';
        let title = 'Styled Header';
        if (text.includes('{{store_name}}')) title = 'Main Store Title';

        return {
          title,
          subtitle: `${text} • ${entry.fontSizePt || 14}pt • ${entry.bold ? 'Bold • ' : ''}${entry.align || 'center'}`,
          icon: <PlusSquare size={18} color="#0D9488" />,
        };
      }

      case 'horizontal_line':
        return {
          title: 'Divider Line',
          subtitle: `Style: ${entry.lineStyle ? entry.lineStyle.toUpperCase() : 'DASHED'}`,
          icon: <Minus size={18} color="#64748B" />,
        };

      case 'barcode': {
        if (entry.qrType === 'upi' || entry.value?.includes('upi_qr') || entry.upiId) {
          const uId = entry.upiId || settings?.upiId || 'store@upi';
          return {
            title: 'UPI Payment QR Code',
            subtitle: `Scan to Pay • ${uId} • Auto Bill Total`,
            icon: <QrCode size={18} color="#16A34A" />,
          };
        }
        if (entry.value.includes('bill_pdf_url') || entry.qrType === 'digital_bill') {
          return {
            title: 'Digital Bill QR Code',
            subtitle: 'Scan to download digital tax invoice PDF',
            icon: <QrCode size={18} color="#6366F1" />,
          };
        }
        if (entry.value.includes('invoice_no') || entry.qrType === 'invoice_barcode') {
          return {
            title: 'Invoice Barcode (1D)',
            subtitle: 'Scannable barcode of invoice number',
            icon: <BarcodeIcon size={18} color="#6366F1" />,
          };
        }
        return {
          title: entry.codeType === 'qr_code' ? 'QR Code' : 'Barcode',
          subtitle: entry.value,
          icon: <QrCode size={18} color="#6366F1" />,
        };
      }

      case 'left_right_text': {
        const left = entry.left || '';
        let title = 'Two-Column Row';
        if (left.toLowerCase().includes('inv')) title = 'Invoice Number & Date';
        else if (left.toLowerCase().includes('cust')) title = 'Customer Details';
        else if (left.toLowerCase().includes('sub')) title = 'Subtotal Amount';
        else if (left.toLowerCase().includes('tax')) title = 'Tax Breakdown';
        else if (left.toLowerCase().includes('total')) title = 'Grand Total Amount';
        else if (left.toLowerCase().includes('pay')) title = 'Payment Method';
        else if (left.toLowerCase().includes('disc')) title = 'Discount Row';

        return {
          title,
          subtitle: `${left}  ⇄  ${entry.right}`,
          icon: <ArrowLeftRight size={18} color="#EA580C" />,
        };
      }

      case 'table':
        return {
          title: 'Products Table',
          subtitle: `Format: ${entry.tableType === 'advanced' ? 'Detailed (with rates)' : 'Simple'}${entry.showTaxColumn ? ' • Tax Column' : ''}`,
          icon: <TableIcon size={18} color="#0284C7" />,
        };

      case 'multi_format':
        return {
          title: 'Combined Text Line',
          subtitle: (entry.segments || []).map((s) => s.text).join(' '),
          icon: <FileCode size={18} color="#9333EA" />,
        };

      case 'files_note':
        return {
          title: entry.title || 'Store Policy / Note',
          subtitle: (entry.content || '').slice(0, 36) + '…',
          icon: <FileText size={18} color="#4F46E5" />,
        };
    }
  };

  // Find if logo tile already exists
  const existingLogoEntry = template.entries.find((e) => e.type === 'image') as ImageReceiptEntry | undefined;

  return (
    <View style={[styles.container, { backgroundColor: theme.bg, paddingTop: topPadding }]}>
      {/* Top Navigation Bar */}
      <View style={[styles.header, { borderBottomColor: theme.borderColor }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <ArrowLeft size={22} color={theme.textPrimary} />
        </TouchableOpacity>

        {/* Editable Title */}
        <View style={{ flex: 1, marginRight: 8 }}>
          {isNameEditing ? (
            <TextInput
              style={[styles.titleInput, { color: theme.textPrimary, borderColor: BRAND_COLORS.navyInk }]}
              value={templateName}
              onChangeText={setTemplateName}
              onBlur={() => setIsNameEditing(false)}
              autoFocus
            />
          ) : (
            <TouchableOpacity onPress={() => setIsNameEditing(true)} activeOpacity={0.7}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={[styles.titleText, { color: theme.textPrimary }]} numberOfLines={1}>
                  {templateName}
                </Text>
                <Edit3 size={14} color={theme.textSecondary} />
              </View>
              <Text style={[styles.subText, { color: theme.textSecondary }]}>
                {template.paperWidth || '58mm'} Thermal Roll • {template.entries.length} Sections
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Header Action Buttons */}
        <View style={styles.headerRightActions}>
          <TouchableOpacity
            onPress={() => setShowPreviewModal(true)}
            style={[styles.iconBtn, { backgroundColor: theme.isDark ? '#1E293B' : '#F1F5F9' }]}
            activeOpacity={0.7}
          >
            <Eye size={18} color={theme.textPrimary} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleSave}
            disabled={isSaving}
            style={[styles.saveBtn, { backgroundColor: BRAND_COLORS.navyInk }]}
            activeOpacity={0.8}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Save size={16} color="#FFFFFF" />
                <Text style={styles.saveBtnText}>Save</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Builder Scrollview */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* SHOP LOGO SECTION CARD */}
        <View style={[styles.logoCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
          <View style={styles.logoCardHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={[styles.entryIconWrap, { backgroundColor: theme.isDark ? '#1E293B' : '#F0FDF4' }]}>
                <ImageIcon size={18} color="#16A34A" />
              </View>
              <View>
                <Text style={[styles.logoCardTitle, { color: theme.textPrimary }]}>Store Logo on Receipt</Text>
                <Text style={[styles.logoCardSub, { color: theme.textSecondary }]}>
                  {existingLogoEntry?.enabled ? 'Logo is active on receipt header' : 'Logo is disabled'}
                </Text>
              </View>
            </View>

            <Switch
              value={existingLogoEntry?.enabled || false}
              onValueChange={(val) => {
                if (!existingLogoEntry) {
                  // Add a new logo entry at the very top
                  const newLogo: ImageReceiptEntry = {
                    id: `logo-${Date.now()}`,
                    type: 'image',
                    enabled: val,
                    imageUri: settings?.businessLogoURL || undefined,
                    align: 'center',
                    widthPercent: RECEIPT_LOGO_DEFAULT_WIDTH_PERCENT,
                  };
                  setTemplate((prev) => ({
                    ...prev,
                    entries: [newLogo, ...prev.entries],
                  }));
                } else {
                  handleToggleEntry(existingLogoEntry.id, val);
                }
              }}
              trackColor={{ false: '#CBD5E1', true: '#86EFAC' }}
              thumbColor={existingLogoEntry?.enabled ? '#16A34A' : '#F1F5F9'}
            />
          </View>

          {existingLogoEntry?.enabled && (
            <View style={styles.logoCardBody}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                {existingLogoEntry.imageUri ? (
                  <View style={{ alignItems: 'center' }}>
                    <Image
                      source={{ uri: existingLogoEntry.imageUri }}
                      style={{
                        width: 64,
                        height: 64,
                        borderRadius: 8,
                        backgroundColor: '#FFFFFF',
                        borderWidth: 1,
                        borderColor: '#E2E8F0',
                        resizeMode: 'contain',
                      }}
                    />
                    <Text style={{ fontSize: 9, color: '#64748B', marginTop: 2, fontWeight: '600' }}>B&W POS</Text>
                  </View>
                ) : (
                  <View style={[styles.logoEmptyBox, { borderColor: theme.borderColor }]}>
                    <Upload size={20} color={theme.textSecondary} />
                    <Text style={{ fontSize: 10, color: theme.textSecondary, marginTop: 2 }}>No Image</Text>
                  </View>
                )}

                <View style={{ flex: 1, gap: 6 }}>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                    <TouchableOpacity
                      onPress={async () => {
                        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
                        if (status !== 'granted') {
                          Alert.alert('Permission Denied', 'Gallery access is needed.');
                          return;
                        }
                        const res = await ImagePicker.launchImageLibraryAsync({ allowsEditing: true, quality: 0.8 });
                        if (!res.canceled && res.assets?.[0]?.uri) {
                          const pickedUri = res.assets[0].uri;
                          openLogoBgOption(pickedUri, (finalUri) => {
                            setTemplate((prev) => ({
                              ...prev,
                              entries: prev.entries.map((e) =>
                                e.id === existingLogoEntry.id ? { ...e, imageUri: finalUri } : e
                              ),
                            }));
                          });
                        }
                      }}
                      style={[styles.smallActionBtn, { backgroundColor: theme.isDark ? '#1E293B' : '#EFF6FF', borderColor: '#BFDBFE' }]}
                    >
                      <Upload size={13} color="#2563EB" />
                      <Text style={[styles.smallActionBtnText, { color: '#2563EB' }]}>Pick Image</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={async () => {
                        const { status } = await ImagePicker.requestCameraPermissionsAsync();
                        if (status !== 'granted') {
                          Alert.alert('Permission Denied', 'Camera access is needed.');
                          return;
                        }
                        const res = await ImagePicker.launchCameraAsync({ allowsEditing: true, quality: 0.8 });
                        if (!res.canceled && res.assets?.[0]?.uri) {
                          const pickedUri = res.assets[0].uri;
                          openLogoBgOption(pickedUri, (finalUri) => {
                            setTemplate((prev) => ({
                              ...prev,
                              entries: prev.entries.map((e) =>
                                e.id === existingLogoEntry.id ? { ...e, imageUri: finalUri } : e
                              ),
                            }));
                          });
                        }
                      }}
                      style={[styles.smallActionBtn, { backgroundColor: theme.isDark ? '#1E293B' : '#EFF6FF', borderColor: '#BFDBFE' }]}
                    >
                      <Camera size={13} color="#2563EB" />
                      <Text style={[styles.smallActionBtnText, { color: '#2563EB' }]}>Camera</Text>
                    </TouchableOpacity>

                    {existingLogoEntry.imageUri ? (
                      <TouchableOpacity
                        onPress={() => {
                          if (existingLogoEntry.imageUri) {
                            openLogoBgOption(existingLogoEntry.imageUri, (finalUri) => {
                              setTemplate((prev) => ({
                                ...prev,
                                entries: prev.entries.map((e) =>
                                  e.id === existingLogoEntry.id ? { ...e, imageUri: finalUri } : e
                                ),
                              }));
                            });
                          }
                        }}
                        style={[styles.smallActionBtn, { backgroundColor: theme.isDark ? '#1E293B' : '#FEF3C7', borderColor: '#FDE68A' }]}
                      >
                        <Sparkles size={13} color="#D97706" />
                        <Text style={[styles.smallActionBtnText, { color: '#D97706' }]}>White Background</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>

                  {/* Size chips */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                    <Text style={{ fontSize: 11, color: theme.textSecondary }}>Size:</Text>
                    {[30, 40, 50, 60, 70, 100].map((sz) => {
                      const isSel = (existingLogoEntry.widthPercent || RECEIPT_LOGO_DEFAULT_WIDTH_PERCENT) === sz;
                      return (
                        <TouchableOpacity
                          key={sz}
                          onPress={() => {
                            setTemplate((prev) => ({
                              ...prev,
                              entries: prev.entries.map((e) =>
                                e.id === existingLogoEntry.id ? { ...e, widthPercent: sz } : e
                              ),
                            }));
                          }}
                          style={[
                            styles.logoSizeChip,
                            {
                              backgroundColor: isSel ? '#2563EB' : theme.isDark ? '#1E293B' : '#F1F5F9',
                              borderColor: isSel ? '#2563EB' : theme.borderColor,
                            },
                          ]}
                        >
                          <Text style={{ fontSize: 10, fontWeight: '700', color: isSel ? '#FFFFFF' : theme.textPrimary }}>
                            {sz}%
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              </View>
            </View>
          )}
        </View>

        {/* SECTION TILES LIST */}
        <View style={styles.sectionHeaderRow}>
          <View>
            <Text style={[styles.sectionHeading, { color: theme.textPrimary }]}>Receipt Layout & Sections</Text>
            <Text style={[styles.sectionSub, { color: theme.textSecondary }]}>
              Drag to reorder • Tap section to customize values
            </Text>
          </View>

          <TouchableOpacity
            onPress={() => setShowAddEntrySheet(true)}
            style={[styles.addSectionBtn, { backgroundColor: BRAND_COLORS.navyInk }]}
            activeOpacity={0.8}
          >
            <Plus size={16} color="#FFFFFF" />
            <Text style={styles.addSectionBtnText}>Add Section</Text>
          </TouchableOpacity>
        </View>

        {template.entries.length === 0 ? (
          <View style={[styles.emptyContainer, { borderColor: theme.borderColor, backgroundColor: theme.cardBg }]}>
            <Layers size={36} color={theme.textSecondary} style={{ marginBottom: 8 }} />
            <Text style={[styles.emptyTitle, { color: theme.textPrimary }]}>No Sections in Receipt</Text>
            <Text style={[styles.emptySub, { color: theme.textSecondary }]}>
              Tap "Add Section" below to add store info, items table, totals, or QR code.
            </Text>
          </View>
        ) : (
          <View style={{ gap: 8 }}>
            {template.entries.map((entry, index) => (
              <DraggableEntryRow
                key={entry.id}
                entry={entry}
                index={index}
                totalCount={template.entries.length}
                theme={theme}
                onSelect={(ent) => setEditingEntry(ent)}
                onToggle={handleToggleEntry}
                onDelete={handleDeleteEntry}
                onMove={handleMoveEntry}
                onReorder={handleReorderEntries}
                getTileInfo={getTileInfo}
              />
            ))}
          </View>
        )}

        <TaxBillingPrinterSection
          theme={theme}
          collapsible
          defaultExpanded={false}
          compact
          hintText="Per-item GST column also respects the global 'Show GST % on each item' toggle."
        />

        {/* Paper Width Roll Setting */}
        <View style={[styles.paperWidthCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
          <Text style={[styles.paperWidthTitle, { color: theme.textPrimary }]}>Thermal Paper Roll Width</Text>
          <View style={styles.paperOptionsRow}>
            {(['58mm', '80mm'] as const).map((pw) => {
              const isSel = (template.paperWidth || '58mm') === pw;
              return (
                <TouchableOpacity
                  key={pw}
                  onPress={() => setTemplate({ ...template, paperWidth: pw })}
                  style={[
                    styles.paperOptionChip,
                    {
                      backgroundColor: isSel ? '#2563EB' : theme.isDark ? '#1E293B' : '#F8FAFC',
                      borderColor: isSel ? '#2563EB' : theme.borderColor,
                    },
                  ]}
                >
                  <Text style={{ color: isSel ? '#FFFFFF' : theme.textPrimary, fontWeight: '700', fontSize: 13 }}>
                    {pw} Roll
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Bottom Test & Actions Bar */}
        <View style={styles.bottomActionBar}>
          <TouchableOpacity
            onPress={handleTestPrint}
            disabled={isPrinting}
            style={[styles.actionBtn, { backgroundColor: '#16A34A' }]}
            activeOpacity={0.8}
          >
            {isPrinting ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Printer size={18} color="#FFFFFF" />
                <Text style={styles.actionBtnText}>Test Thermal Print</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleSharePdf}
            style={[styles.actionBtn, { backgroundColor: '#2563EB' }]}
            activeOpacity={0.8}
          >
            <Share2 size={18} color="#FFFFFF" />
            <Text style={styles.actionBtnText}>Share PDF</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* ADD SECTION BOTTOM SHEET (No Emojis) */}
      <Modal
        visible={showAddEntrySheet}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowAddEntrySheet(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setShowAddEntrySheet(false)}>
          <Pressable style={[styles.sheetModalCard, { backgroundColor: theme.cardBg }]} onPress={(e) => e.stopPropagation()}>
            <View style={styles.sheetHandle} />
            <Text style={[styles.sheetTitle, { color: theme.textPrimary }]}>
              Add Section to Receipt
            </Text>

            <ScrollView
              style={{ maxHeight: 420 }}
              showsVerticalScrollIndicator={true}
              keyboardShouldPersistTaps="always"
            >
              {[
                {
                  type: 'text' as const,
                  title: 'Store Text & Details',
                  sub: 'Store name, address, phone, GSTIN, or custom note',
                  icon: <Type size={20} color="#2563EB" />,
                },
                {
                  type: 'image' as const,
                  title: 'Shop Logo / Graphic',
                  sub: 'Add your business logo from camera or gallery',
                  icon: <ImageIcon size={20} color="#16A34A" />,
                },
                {
                  type: 'text_special' as const,
                  title: 'Styled Big Header',
                  sub: 'Prominent header, store slogans, or large thank you line',
                  icon: <PlusSquare size={20} color="#0D9488" />,
                },
                {
                  type: 'horizontal_line' as const,
                  title: 'Divider Line',
                  sub: 'Dashed, solid, or double separator rule',
                  icon: <Minus size={20} color="#64748B" />,
                },
                {
                  type: 'barcode' as const,
                  title: 'QR Code & Barcode',
                  sub: 'Digital Bill link QR, UPI payment QR, or invoice barcode',
                  icon: <BarcodeIcon size={20} color="#6366F1" />,
                },
                {
                  type: 'left_right_text' as const,
                  title: 'Two-Column Row (Total / Info)',
                  sub: 'Grand Total, Subtotal, Invoice No, Bill Date, or Tax',
                  icon: <ArrowLeftRight size={20} color="#EA580C" />,
                },
                {
                  type: 'table' as const,
                  title: 'Products & Items Table',
                  sub: 'Print purchased item names, quantities, and prices',
                  icon: <TableIcon size={20} color="#0284C7" />,
                },
                {
                  type: 'multi_format' as const,
                  title: 'Combined Text Line',
                  sub: 'Combine multiple bold and normal texts on one line',
                  icon: <FileCode size={20} color="#9333EA" />,
                },
                {
                  type: 'files_note' as const,
                  title: 'Store Policy & Note',
                  sub: 'Return policy, warranty terms, or footer note',
                  icon: <FileText size={20} color="#4F46E5" />,
                },
              ].map((item, idx) => (
                <TouchableOpacity
                  key={item.type}
                  style={[
                    styles.sheetItemRow,
                    { borderBottomColor: theme.borderColor, borderBottomWidth: idx < 8 ? 1 : 0 },
                  ]}
                  onPress={() => handleAddNewEntryType(item.type)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.sheetItemIconBox, { backgroundColor: theme.isDark ? '#1E293B' : '#F1F5F9' }]}>
                    {item.icon}
                  </View>
                  <View style={{ flex: 1, marginLeft: 14 }}>
                    <Text style={[styles.sheetItemTitle, { color: theme.textPrimary }]}>
                      {item.title}
                    </Text>
                    <Text style={[styles.sheetItemSub, { color: theme.textSecondary }]}>
                      {item.sub}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 18, color: '#94A3B8' }}>›</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* SECTION TILE CONFIGURATION & VALUE EDITOR MODAL */}
      {editingEntry && (
        <Modal
          visible={true}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setEditingEntry(null)}
        >
          <Pressable style={styles.modalBackdrop} onPress={() => setEditingEntry(null)}>
            <Pressable style={[styles.modalCard, { backgroundColor: theme.bg }]} onPress={(e) => e.stopPropagation()}>
              <View style={[styles.configHeader, { borderBottomColor: theme.borderColor }]}>
                <View>
                  <Text style={[styles.configHeaderTitle, { color: theme.textPrimary }]}>
                    Customize Section
                  </Text>
                  <Text style={{ fontSize: 12, color: theme.textSecondary, marginTop: 2 }}>
                    {getTileInfo(editingEntry).title}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setEditingEntry(null)} style={{ padding: 6 }}>
                  <X size={22} color={theme.textPrimary} />
                </TouchableOpacity>
              </View>

              <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
                showsVerticalScrollIndicator={true}
                keyboardShouldPersistTaps="always"
              >
                {/* 1. TEXT SECTION */}
                {editingEntry.type === 'text' && (
                  <View style={{ gap: 14 }}>
                    <View>
                      <Text style={[styles.fieldLabel, { color: theme.textPrimary }]}>Text Content / Value:</Text>
                      <TextInput
                        style={[styles.textAreaInput, { color: theme.textPrimary, borderColor: theme.borderColor, backgroundColor: theme.cardBg }]}
                        value={editingEntry.text}
                        onChangeText={(t) => setEditingEntry({ ...editingEntry, text: t })}
                        placeholder="e.g. {{store_name}}"
                        placeholderTextColor="#94A3B8"
                        multiline
                        numberOfLines={3}
                      />
                    </View>

                    {/* Live preview box */}
                    <View style={{ backgroundColor: theme.isDark ? '#0F172A' : '#F8FAFC', padding: 10, borderRadius: 8, borderWidth: 1, borderColor: theme.borderColor }}>
                      <Text style={{ fontSize: 10, fontWeight: '800', color: theme.textSecondary, marginBottom: 2 }}>
                        PRINT PREVIEW:
                      </Text>
                      <Text style={{ fontFamily: 'monospace', fontSize: 12, color: theme.textPrimary }}>
                        {samplePrintData.storeName ? editingEntry.text
                          .replace(/{{store_name}}/gi, samplePrintData.storeName || 'SEZNIK STORE')
                          .replace(/{{store_address}}/gi, samplePrintData.storeAddress || '123 Market St')
                          .replace(/{{store_phone}}/gi, samplePrintData.storePhone || '+91 9876543210')
                          .replace(/{{store_gstin}}/gi, samplePrintData.storeGstin || '27AAAAA0000A1Z5')
                          .replace(/{{invoice_no}}/gi, samplePrintData.invoiceNumber || 'INV-1024')
                          .replace(/{{date}}/gi, samplePrintData.date || '19/08/2026')
                          .replace(/{{customer_name}}/gi, samplePrintData.customerName || 'Aarav Sharma')
                          .replace(/{{grand_total}}/gi, `₹${samplePrintData.grandTotal?.toFixed(2) || '1,080.50'}`)
                          : editingEntry.text || '(Empty text)'}
                      </Text>
                    </View>

                    {/* Clean Field Pickers (No Emojis) */}
                    <View>
                      <Text style={[styles.subFieldLabel, { color: theme.textSecondary, marginBottom: 6 }]}>
                        Tap to Insert Field:
                      </Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                        {[
                          { label: 'Store Name', tag: '{{store_name}}' },
                          { label: 'Store Address', tag: '{{store_address}}' },
                          { label: 'Phone Number', tag: '{{store_phone}}' },
                          { label: 'GSTIN', tag: '{{store_gstin}}' },
                          { label: 'Invoice No', tag: '{{invoice_no}}' },
                          { label: 'Bill Date', tag: '{{date}}' },
                          { label: 'Customer Name', tag: '{{customer_name}}' },
                          { label: 'Grand Total', tag: '{{grand_total}}' },
                          { label: 'Thank You Note', tag: 'Thank you! Visit again.' },
                        ].map((field) => (
                          <TouchableOpacity
                            key={field.tag}
                            onPress={() => {
                              const current = editingEntry.text.trim();
                              const newText = current ? `${current}\n${field.tag}` : field.tag;
                              setEditingEntry({ ...editingEntry, text: newText });
                            }}
                            style={[
                              styles.varChip,
                              {
                                backgroundColor: theme.isDark ? '#1E293B' : '#EFF6FF',
                                borderColor: theme.isDark ? '#3B82F6' : '#BFDBFE',
                              },
                            ]}
                          >
                            <Text style={[styles.varChipText, { color: theme.isDark ? '#93C5FD' : '#1D4ED8' }]}>
                              + {field.label}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>

                    <Text style={[styles.fieldLabel, { color: theme.textPrimary }]}>Font Size:</Text>
                    <View style={styles.optionsRow}>
                      {[
                        { id: 'small', label: 'Small' },
                        { id: 'medium', label: 'Normal' },
                        { id: 'large', label: 'Large' },
                        { id: 'double_width', label: 'Extra Wide' },
                        { id: 'double_height', label: 'Double Height' },
                      ].map((sz) => {
                        const isSel = editingEntry.size === sz.id;
                        return (
                          <TouchableOpacity
                            key={sz.id}
                            onPress={() => setEditingEntry({ ...editingEntry, size: sz.id as any })}
                            style={[
                              styles.optionChip,
                              {
                                backgroundColor: isSel ? '#2563EB' : theme.cardBg,
                                borderColor: isSel ? '#2563EB' : theme.borderColor,
                              },
                            ]}
                          >
                            <Text style={{ color: isSel ? '#FFFFFF' : theme.textPrimary, fontSize: 12, fontWeight: isSel ? '700' : '600' }}>
                              {sz.label}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>

                    <Text style={[styles.fieldLabel, { color: theme.textPrimary }]}>Alignment:</Text>
                    <View style={styles.optionsRow}>
                      {(['left', 'center', 'right'] as const).map((al) => {
                        const isSel = (editingEntry.align || 'left') === al;
                        return (
                          <TouchableOpacity
                            key={al}
                            onPress={() => setEditingEntry({ ...editingEntry, align: al })}
                            style={[
                              styles.optionChip,
                              {
                                backgroundColor: isSel ? '#2563EB' : theme.cardBg,
                                borderColor: isSel ? '#2563EB' : theme.borderColor,
                              },
                            ]}
                          >
                            <Text style={{ color: isSel ? '#FFFFFF' : theme.textPrimary, fontSize: 12, fontWeight: isSel ? '700' : '600', textTransform: 'capitalize' }}>
                              {al}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>

                    <View style={styles.switchRow}>
                      <Text style={[styles.fieldLabel, { color: theme.textPrimary }]}>Bold Text</Text>
                      <Switch
                        value={editingEntry.bold || false}
                        onValueChange={(b) => setEditingEntry({ ...editingEntry, bold: b })}
                        trackColor={{ false: '#CBD5E1', true: '#86EFAC' }}
                        thumbColor={editingEntry.bold ? '#16A34A' : '#F1F5F9'}
                      />
                    </View>
                  </View>
                )}

                {/* 2. TEXT SPECIAL */}
                {editingEntry.type === 'text_special' && (
                  <View style={{ gap: 14 }}>
                    <View>
                      <Text style={[styles.fieldLabel, { color: theme.textPrimary }]}>Header Text Value:</Text>
                      <TextInput
                        style={[styles.textAreaInput, { color: theme.textPrimary, borderColor: theme.borderColor, backgroundColor: theme.cardBg }]}
                        value={editingEntry.text}
                        onChangeText={(t) => setEditingEntry({ ...editingEntry, text: t })}
                        placeholder="e.g. {{store_name}}"
                        placeholderTextColor="#94A3B8"
                        multiline
                        numberOfLines={3}
                      />
                    </View>

                    <Text style={[styles.fieldLabel, { color: theme.textPrimary }]}>Font Size (Points):</Text>
                    <View style={styles.optionsRow}>
                      {[10, 12, 14, 16, 18, 20, 24].map((pt) => {
                        const isSel = (editingEntry.fontSizePt || 14) === pt;
                        return (
                          <TouchableOpacity
                            key={pt}
                            onPress={() => setEditingEntry({ ...editingEntry, fontSizePt: pt })}
                            style={[
                              styles.optionChip,
                              {
                                backgroundColor: isSel ? '#2563EB' : theme.cardBg,
                                borderColor: isSel ? '#2563EB' : theme.borderColor,
                              },
                            ]}
                          >
                            <Text style={{ color: isSel ? '#FFFFFF' : theme.textPrimary, fontSize: 12, fontWeight: isSel ? '700' : '600' }}>
                              {pt} pt
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>

                    <Text style={[styles.fieldLabel, { color: theme.textPrimary }]}>Alignment:</Text>
                    <View style={styles.optionsRow}>
                      {(['left', 'center', 'right'] as const).map((al) => {
                        const isSel = (editingEntry.align || 'center') === al;
                        return (
                          <TouchableOpacity
                            key={al}
                            onPress={() => setEditingEntry({ ...editingEntry, align: al })}
                            style={[
                              styles.optionChip,
                              {
                                backgroundColor: isSel ? '#2563EB' : theme.cardBg,
                                borderColor: isSel ? '#2563EB' : theme.borderColor,
                              },
                            ]}
                          >
                            <Text style={{ color: isSel ? '#FFFFFF' : theme.textPrimary, fontSize: 12, fontWeight: isSel ? '700' : '600', textTransform: 'capitalize' }}>
                              {al}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>

                    <View style={styles.switchRow}>
                      <Text style={[styles.fieldLabel, { color: theme.textPrimary }]}>Bold Font</Text>
                      <Switch
                        value={editingEntry.bold || false}
                        onValueChange={(b) => setEditingEntry({ ...editingEntry, bold: b })}
                        trackColor={{ false: '#CBD5E1', true: '#86EFAC' }}
                        thumbColor={editingEntry.bold ? '#16A34A' : '#F1F5F9'}
                      />
                    </View>
                  </View>
                )}

                {/* 3. SHOP LOGO */}
                {editingEntry.type === 'image' && (
                  <View style={{ gap: 14 }}>
                    <Text style={[styles.fieldLabel, { color: theme.textPrimary }]}>Logo Graphic:</Text>
                    {editingEntry.imageUri ? (
                      <View style={{ alignItems: 'center', marginVertical: 10 }}>
                        <Image
                          source={{ uri: editingEntry.imageUri }}
                          style={{ width: 120, height: 120, borderRadius: 8, resizeMode: 'contain', backgroundColor: '#F1F5F9' }}
                        />
                      </View>
                    ) : (
                      <View style={{ alignItems: 'center', padding: 20, backgroundColor: theme.cardBg, borderRadius: 8, borderWidth: 1, borderColor: theme.borderColor, borderStyle: 'dashed' }}>
                        <ImageIcon size={32} color={theme.textSecondary} style={{ marginBottom: 6 }} />
                        <Text style={{ color: theme.textSecondary, fontSize: 13 }}>No logo selected</Text>
                      </View>
                    )}

                    <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                      <TouchableOpacity
                        onPress={() => handlePickImage(true)}
                        style={[styles.imagePickBtn, { backgroundColor: theme.isDark ? '#1E293B' : '#F1F5F9', borderColor: theme.borderColor }]}
                      >
                        <Camera size={18} color={theme.isDark ? '#60A5FA' : '#2563EB'} />
                        <Text style={[styles.imagePickBtnText, { color: theme.isDark ? '#60A5FA' : '#2563EB' }]}>Camera</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() => handlePickImage(false)}
                        style={[styles.imagePickBtn, { backgroundColor: theme.isDark ? '#1E293B' : '#F1F5F9', borderColor: theme.borderColor }]}
                      >
                        <ImageIcon size={18} color={theme.isDark ? '#60A5FA' : '#2563EB'} />
                        <Text style={[styles.imagePickBtnText, { color: theme.isDark ? '#60A5FA' : '#2563EB' }]}>Gallery</Text>
                      </TouchableOpacity>

                      {editingEntry.imageUri ? (
                        <TouchableOpacity
                          onPress={() => {
                            if (editingEntry.imageUri) {
                              openLogoBgOption(editingEntry.imageUri, (finalUri) => {
                                setEditingEntry((prev) => (prev && prev.type === 'image' ? { ...prev, imageUri: finalUri } : prev));
                              });
                            }
                          }}
                          style={[styles.imagePickBtn, { backgroundColor: theme.isDark ? '#1E293B' : '#FEF3C7', borderColor: '#FDE68A' }]}
                        >
                          <Sparkles size={18} color="#D97706" />
                          <Text style={[styles.imagePickBtnText, { color: '#D97706' }]}>White Background</Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>

                    <Text style={[styles.fieldLabel, { color: theme.textPrimary }]}>Logo Size on Receipt (%):</Text>
                    <View style={styles.optionsRow}>
                      {[30, 40, 50, 60, 70, 100].map((pct) => {
                        const isSel = (editingEntry.widthPercent || RECEIPT_LOGO_DEFAULT_WIDTH_PERCENT) === pct;
                        return (
                          <TouchableOpacity
                            key={pct}
                            onPress={() => setEditingEntry({ ...editingEntry, widthPercent: pct })}
                            style={[
                              styles.optionChip,
                              {
                                backgroundColor: isSel ? '#2563EB' : theme.cardBg,
                                borderColor: isSel ? '#2563EB' : theme.borderColor,
                              },
                            ]}
                          >
                            <Text style={{ color: isSel ? '#FFFFFF' : theme.textPrimary, fontSize: 12, fontWeight: isSel ? '700' : '600' }}>
                              {pct}%
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                )}

                {/* 4. HORIZONTAL LINE */}
                {editingEntry.type === 'horizontal_line' && (
                  <View style={{ gap: 14 }}>
                    <Text style={[styles.fieldLabel, { color: theme.textPrimary }]}>Choose Divider Line Style:</Text>
                    <View style={{ gap: 10 }}>
                      {[
                        { id: 'dashed', title: 'Dashed Line (Standard)', preview: '- - - - - - - - - - - - - - - - - - -' },
                        { id: 'double', title: 'Double Line (Totals & Emphasis)', preview: '=====================================' },
                        { id: 'single', title: 'Single Solid Line', preview: '─────────────────────────────────────' },
                        { id: 'dotted', title: 'Dotted Line', preview: '· · · · · · · · · · · · · · · · · · ·' },
                      ].map((st) => {
                        const isSel = editingEntry.lineStyle === st.id;
                        return (
                          <TouchableOpacity
                            key={st.id}
                            onPress={() => setEditingEntry({ ...editingEntry, lineStyle: st.id as any })}
                            style={{
                              backgroundColor: isSel ? (theme.isDark ? '#1E293B' : '#EFF6FF') : theme.cardBg,
                              borderColor: isSel ? '#2563EB' : theme.borderColor,
                              borderWidth: isSel ? 2 : 1,
                              borderRadius: 10,
                              padding: 12,
                            }}
                          >
                            <Text style={{ fontSize: 14, fontWeight: '700', color: isSel ? '#2563EB' : theme.textPrimary }}>
                              {st.title}
                            </Text>
                            <Text style={{ fontSize: 12, fontFamily: 'monospace', color: isSel ? '#2563EB' : theme.textSecondary, marginTop: 4 }}>
                              {st.preview}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                )}

                {/* 5. BARCODE & QR CODE */}
                {editingEntry.type === 'barcode' && (() => {
                  const isUpi = editingEntry.qrType === 'upi' || editingEntry.value === '{{upi_qr}}' || !!editingEntry.upiId;
                  const isDigitalBill = (editingEntry.qrType === 'digital_bill' || editingEntry.value === '{{bill_pdf_url}}') && !isUpi;
                  const isInvoiceBar = editingEntry.qrType === 'invoice_barcode' || editingEntry.value === '{{invoice_no}}';
                  const isCustom = !isUpi && !isDigitalBill && !isInvoiceBar;

                  return (
                    <View style={{ gap: 14 }}>
                      <Text style={[styles.fieldLabel, { color: theme.textPrimary }]}>Select Code Type & Purpose:</Text>
                      <View style={{ gap: 10 }}>
                        {[
                          {
                            id: 'upi',
                            title: 'UPI Payment QR Code',
                            sub: 'Accept customer payments via PhonePe, GPay, Paytm with auto bill amount prefilled',
                            val: '{{upi_qr}}',
                            codeType: 'qr_code' as const,
                            qrType: 'upi' as const,
                          },
                          {
                            id: 'digital_bill',
                            title: 'Digital Bill Download QR Code',
                            sub: 'Customers scan with phone camera to download digital tax invoice PDF',
                            val: '{{bill_pdf_url}}',
                            codeType: 'qr_code' as const,
                            qrType: 'digital_bill' as const,
                          },
                          {
                            id: 'invoice_bar',
                            title: 'Invoice Number Barcode (1D)',
                            sub: 'Prints a 1D barcode of invoice number for POS inventory scanners',
                            val: '{{invoice_no}}',
                            codeType: 'barcode_1d' as const,
                            qrType: 'invoice_barcode' as const,
                          },
                          {
                            id: 'custom',
                            title: 'Custom Website or Link',
                            sub: 'Enter your custom website URL, review link, or promo text',
                            val: editingEntry.value.includes('{{') ? 'https://yourstore.com' : editingEntry.value,
                            codeType: editingEntry.codeType || 'qr_code',
                            qrType: 'custom' as const,
                          },
                        ].map((preset) => {
                          const isSel =
                            (preset.id === 'upi' && isUpi) ||
                            (preset.id === 'digital_bill' && isDigitalBill) ||
                            (preset.id === 'invoice_bar' && isInvoiceBar) ||
                            (preset.id === 'custom' && isCustom);

                          return (
                            <TouchableOpacity
                              key={preset.id}
                              onPress={() => {
                                const currentUpi = editingEntry.upiId || settings?.upiId || 'store@upi';
                                setEditingEntry({
                                  ...editingEntry,
                                  value: preset.val,
                                  codeType: preset.codeType,
                                  qrType: preset.qrType,
                                  upiId: preset.id === 'upi' ? currentUpi : editingEntry.upiId,
                                  format: preset.codeType === 'qr_code' ? 'qr' : 'code128',
                                });
                              }}
                              style={{
                                backgroundColor: isSel ? (theme.isDark ? '#1E293B' : '#EFF6FF') : theme.cardBg,
                                borderColor: isSel ? '#2563EB' : theme.borderColor,
                                borderWidth: isSel ? 2 : 1,
                                borderRadius: 10,
                                padding: 12,
                              }}
                            >
                              <Text style={{ fontSize: 14, fontWeight: '700', color: isSel ? '#2563EB' : theme.textPrimary }}>
                                {preset.title}
                              </Text>
                              <Text style={{ fontSize: 12, color: isSel ? (theme.isDark ? '#93C5FD' : '#1E40AF') : theme.textSecondary, marginTop: 3 }}>
                                {preset.sub}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>

                      {/* Dedicated UPI ID Configuration Box */}
                      {isUpi && (
                        <View style={{ marginTop: 4, padding: 14, backgroundColor: theme.isDark ? '#064E3B20' : '#ECFDF5', borderRadius: 10, borderWidth: 1, borderColor: '#A7F3D0' }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                            <CreditCard size={16} color="#059669" />
                            <Text style={{ fontSize: 13, fontWeight: '700', color: '#065F46' }}>Store UPI ID / VPA (To Receive Payments):</Text>
                          </View>

                          <TextInput
                            style={[styles.input, { color: theme.textPrimary, borderColor: '#6EE7B7', backgroundColor: theme.cardBg, fontWeight: '700' }]}
                            value={editingEntry.upiId !== undefined ? editingEntry.upiId : (settings?.upiId || '')}
                            onChangeText={(v) =>
                              setEditingEntry({
                                ...editingEntry,
                                upiId: v,
                                value: '{{upi_qr}}',
                                qrType: 'upi',
                              })
                            }
                            placeholder="e.g. yourstore@okaxis, 9876543210@paytm, store@upi"
                            placeholderTextColor="#94A3B8"
                            autoCapitalize="none"
                            autoCorrect={false}
                          />

                          <Text style={{ fontSize: 11, color: '#047857', marginTop: 8, lineHeight: 16 }}>
                            Instant Auto-Pay: When customers scan this QR code with PhonePe, Google Pay, Paytm, or BHIM, their app automatically opens with your UPI ID and prompts them to pay the exact live bill amount (e.g. ₹{samplePrintData.grandTotal?.toFixed(2) || '1,080.50'}).
                          </Text>
                        </View>
                      )}

                      {/* Custom text input */}
                      {isCustom && (
                        <View style={{ marginTop: 4 }}>
                          <Text style={[styles.fieldLabel, { color: theme.textPrimary }]}>Custom Link or Code Value:</Text>
                          <TextInput
                            style={[styles.input, { color: theme.textPrimary, borderColor: theme.borderColor, backgroundColor: theme.cardBg }]}
                            value={editingEntry.value}
                            onChangeText={(v) => setEditingEntry({ ...editingEntry, value: v, qrType: 'custom' })}
                            placeholder="e.g. https://yourstore.com/review"
                            placeholderTextColor="#94A3B8"
                          />
                        </View>
                      )}

                      <Text style={[styles.fieldLabel, { color: theme.textPrimary }]}>QR / Barcode Size:</Text>
                      <View style={styles.optionsRow}>
                        {[
                          { id: 'small', label: 'Small' },
                          { id: 'medium', label: 'Standard' },
                          { id: 'large', label: 'Large' },
                        ].map((sz) => {
                          const isSel = (editingEntry.size || 'medium') === sz.id;
                          return (
                            <TouchableOpacity
                              key={sz.id}
                              onPress={() => setEditingEntry({ ...editingEntry, size: sz.id as any })}
                              style={[
                                styles.optionChip,
                                {
                                  backgroundColor: isSel ? '#2563EB' : theme.cardBg,
                                  borderColor: isSel ? '#2563EB' : theme.borderColor,
                                },
                              ]}
                            >
                              <Text style={{ color: isSel ? '#FFFFFF' : theme.textPrimary, fontSize: 12, fontWeight: isSel ? '700' : '600' }}>
                                {sz.label}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>

                      <Text style={[styles.fieldLabel, { color: theme.textPrimary }]}>Alignment:</Text>
                      <View style={styles.optionsRow}>
                        {(['left', 'center', 'right'] as const).map((al) => {
                          const isSel = (editingEntry.align || 'center') === al;
                          return (
                            <TouchableOpacity
                              key={al}
                              onPress={() => setEditingEntry({ ...editingEntry, align: al })}
                              style={[
                                styles.optionChip,
                                {
                                  backgroundColor: isSel ? '#2563EB' : theme.cardBg,
                                  borderColor: isSel ? '#2563EB' : theme.borderColor,
                                },
                              ]}
                            >
                              <Text style={{ color: isSel ? '#FFFFFF' : theme.textPrimary, fontSize: 12, fontWeight: isSel ? '700' : '600', textTransform: 'capitalize' }}>
                                {al}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>
                  );
                })()}

                {/* 6. TWO-COLUMN ROW (LEFT-RIGHT) */}
                {editingEntry.type === 'left_right_text' && (
                  <View style={{ gap: 14 }}>
                    <Text style={[styles.fieldLabel, { color: theme.textPrimary }]}>Quick Row Presets:</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                      {[
                        { label: 'Invoice No & Date', left: 'Invoice No:', right: '{{invoice_no}}' },
                        { label: 'Subtotal Amount', left: 'Sub Total:', right: '{{subtotal}}' },
                        { label: 'Tax Total (GST)', left: 'Total Tax:', right: '{{total_tax}}' },
                        { label: 'Grand Total Amount', left: 'Total Amount:', right: '{{grand_total}}' },
                        { label: 'Payment Mode', left: 'Paid Via:', right: '{{payment_method}}' },
                        { label: 'Customer Name', left: 'Customer:', right: '{{customer_name}}' },
                        { label: 'Discount Row', left: 'Discount:', right: '{{discount}}' },
                      ].map((preset) => (
                        <TouchableOpacity
                          key={preset.label}
                          onPress={() => setEditingEntry({ ...editingEntry, left: preset.left, right: preset.right, bold: preset.left.includes('Total') })}
                          style={[
                            styles.varChip,
                            {
                              backgroundColor: theme.isDark ? '#1E293B' : '#EFF6FF',
                              borderColor: theme.isDark ? '#3B82F6' : '#BFDBFE',
                            },
                          ]}
                        >
                          <Text style={[styles.varChipText, { color: theme.isDark ? '#93C5FD' : '#1D4ED8' }]}>
                            {preset.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>

                    {/* Live Row Preview */}
                    <View style={{ backgroundColor: theme.isDark ? '#0F172A' : '#F8FAFC', padding: 10, borderRadius: 8, borderWidth: 1, borderColor: theme.borderColor }}>
                      <Text style={{ fontSize: 10, fontWeight: '800', color: theme.textSecondary, marginBottom: 4 }}>
                        ROW PREVIEW:
                      </Text>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: editingEntry.bold ? '800' : '600', color: theme.textPrimary }}>
                          {editingEntry.left
                            .replace(/{{invoice_no}}/gi, 'INV-1024')
                            .replace(/{{customer_name}}/gi, 'John Doe') || 'Label'}
                        </Text>
                        <Text style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: editingEntry.bold ? '800' : '600', color: theme.textPrimary }}>
                          {editingEntry.right
                            .replace(/{{grand_total}}/gi, '₹1,080.50')
                            .replace(/{{subtotal}}/gi, '₹1,040.00')
                            .replace(/{{total_tax}}/gi, '₹40.50')
                            .replace(/{{discount}}/gi, '₹50.00')
                            .replace(/{{invoice_no}}/gi, 'INV-1024')
                            .replace(/{{payment_method}}/gi, 'UPI')
                            .replace(/{{date}}/gi, '19/08/2026') || 'Value'}
                        </Text>
                      </View>
                    </View>

                    <View>
                      <Text style={[styles.fieldLabel, { color: theme.textPrimary }]}>Left Label Name (e.g. "Bill No", "Total Amount"):</Text>
                      <TextInput
                        style={[styles.input, { color: theme.textPrimary, borderColor: theme.borderColor, backgroundColor: theme.cardBg }]}
                        value={editingEntry.left}
                        onChangeText={(l) => setEditingEntry({ ...editingEntry, left: l })}
                        placeholder="e.g. Total Amount:"
                        placeholderTextColor="#94A3B8"
                      />
                    </View>

                    <View>
                      <Text style={[styles.fieldLabel, { color: theme.textPrimary }]}>Right Value Name:</Text>
                      <TextInput
                        style={[styles.input, { color: theme.textPrimary, borderColor: theme.borderColor, backgroundColor: theme.cardBg }]}
                        value={editingEntry.right}
                        onChangeText={(r) => setEditingEntry({ ...editingEntry, right: r })}
                        placeholder="e.g. {{grand_total}}"
                        placeholderTextColor="#94A3B8"
                      />
                    </View>

                    <View style={styles.switchRow}>
                      <Text style={[styles.fieldLabel, { color: theme.textPrimary }]}>Bold Text (Highlighted)</Text>
                      <Switch
                        value={editingEntry.bold || false}
                        onValueChange={(b) => setEditingEntry({ ...editingEntry, bold: b })}
                        trackColor={{ false: '#CBD5E1', true: '#86EFAC' }}
                        thumbColor={editingEntry.bold ? '#16A34A' : '#F1F5F9'}
                      />
                    </View>
                  </View>
                )}

                {/* 7. PRODUCTS TABLE */}
                {editingEntry.type === 'table' && (
                  <View style={{ gap: 14 }}>
                    <Text style={[styles.fieldLabel, { color: theme.textPrimary }]}>Table Format:</Text>
                    <View style={{ gap: 10 }}>
                      {[
                        {
                          id: 'simple' as const,
                          title: 'Simple Table',
                          sub: 'Product Name • Quantity • Total Amount',
                        },
                        {
                          id: 'advanced' as const,
                          title: 'Detailed Table',
                          sub: 'Product Name • Unit Price Rate • Quantity • Total Amount',
                        },
                      ].map((t) => {
                        const isSel = editingEntry.tableType === t.id;
                        return (
                          <TouchableOpacity
                            key={t.id}
                            onPress={() => setEditingEntry({ ...editingEntry, tableType: t.id })}
                            style={{
                              backgroundColor: isSel ? (theme.isDark ? '#1E293B' : '#EFF6FF') : theme.cardBg,
                              borderColor: isSel ? '#2563EB' : theme.borderColor,
                              borderWidth: isSel ? 2 : 1,
                              borderRadius: 10,
                              padding: 12,
                            }}
                          >
                            <Text style={{ fontSize: 14, fontWeight: '700', color: isSel ? '#2563EB' : theme.textPrimary }}>
                              {t.title}
                            </Text>
                            <Text style={{ fontSize: 12, color: isSel ? (theme.isDark ? '#93C5FD' : '#1E40AF') : theme.textSecondary, marginTop: 2 }}>
                              {t.sub}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>

                    <View style={styles.switchRow}>
                      <Text style={[styles.fieldLabel, { color: theme.textPrimary }]}>Show Tax (GST%) Column per item</Text>
                      <Switch
                        value={editingEntry.showTaxColumn || false}
                        onValueChange={(st) => setEditingEntry({ ...editingEntry, showTaxColumn: st })}
                        trackColor={{ false: '#CBD5E1', true: '#86EFAC' }}
                        thumbColor={editingEntry.showTaxColumn ? '#16A34A' : '#F1F5F9'}
                      />
                    </View>
                  </View>
                )}

                {/* 8. MULTI FORMAT */}
                {editingEntry.type === 'multi_format' && (
                  <View style={{ gap: 14 }}>
                    <Text style={[styles.fieldLabel, { color: theme.textPrimary }]}>Multi-Format Line Segments:</Text>
                    {(editingEntry.segments || []).map((seg, sIdx) => (
                      <View
                        key={sIdx}
                        style={{
                          backgroundColor: theme.cardBg,
                          borderColor: theme.borderColor,
                          borderWidth: 1,
                          borderRadius: 8,
                          padding: 10,
                          gap: 8,
                        }}
                      >
                        <Text style={[styles.subFieldLabel, { color: theme.textSecondary }]}>Segment {sIdx + 1}</Text>
                        <TextInput
                          style={[styles.input, { color: theme.textPrimary, borderColor: theme.borderColor, backgroundColor: theme.bg }]}
                          value={seg.text}
                          onChangeText={(txt) => {
                            const newSegs = [...editingEntry.segments];
                            newSegs[sIdx] = { ...seg, text: txt };
                            setEditingEntry({ ...editingEntry, segments: newSegs });
                          }}
                          placeholder="Text segment"
                          placeholderTextColor="#94A3B8"
                        />
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                          <Text style={{ color: theme.textPrimary, fontSize: 12, fontWeight: '600' }}>Bold</Text>
                          <Switch
                            value={seg.bold || false}
                            onValueChange={(b) => {
                              const newSegs = [...editingEntry.segments];
                              newSegs[sIdx] = { ...seg, bold: b };
                              setEditingEntry({ ...editingEntry, segments: newSegs });
                            }}
                            trackColor={{ false: '#CBD5E1', true: '#86EFAC' }}
                            thumbColor={seg.bold ? '#16A34A' : '#F1F5F9'}
                          />
                        </View>
                      </View>
                    ))}
                  </View>
                )}

                {/* 9. STORE POLICY / RETURN NOTE */}
                {editingEntry.type === 'files_note' && (
                  <View style={{ gap: 14 }}>
                    <Text style={[styles.fieldLabel, { color: theme.textPrimary }]}>Section Title (Optional):</Text>
                    <TextInput
                      style={[styles.input, { color: theme.textPrimary, borderColor: theme.borderColor, backgroundColor: theme.cardBg }]}
                      value={editingEntry.title || ''}
                      onChangeText={(t) => setEditingEntry({ ...editingEntry, title: t })}
                      placeholder="e.g. Terms & Return Policy"
                      placeholderTextColor="#94A3B8"
                    />

                    <Text style={[styles.fieldLabel, { color: theme.textPrimary }]}>Note / Policy Content:</Text>
                    <TextInput
                      style={[styles.textAreaInput, { color: theme.textPrimary, borderColor: theme.borderColor, backgroundColor: theme.cardBg }]}
                      value={editingEntry.content}
                      onChangeText={(c) => setEditingEntry({ ...editingEntry, content: c })}
                      multiline
                      numberOfLines={4}
                      placeholder="e.g. 1. Goods once sold cannot be returned without bill."
                      placeholderTextColor="#94A3B8"
                    />
                  </View>
                )}
              </ScrollView>

              {/* Modal Action Footer */}
              <View style={[styles.configModalFooter, { borderTopColor: theme.borderColor, backgroundColor: theme.cardBg }]}>
                <TouchableOpacity
                  onPress={() => setEditingEntry(null)}
                  style={[styles.configCancelBtn, { borderColor: theme.borderColor }]}
                  activeOpacity={0.7}
                >
                  <Text style={{ color: theme.textSecondary, fontWeight: '700', fontSize: 13 }}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleApplyEditingEntry}
                  style={[styles.configSaveBtn, { backgroundColor: '#2563EB' }]}
                  activeOpacity={0.8}
                >
                  <Check size={16} color="#FFFFFF" />
                  <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 13 }}>Save Changes</Text>
                </TouchableOpacity>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      )}

      {/* FULL THERMAL RECEIPT PREVIEW MODAL */}
      <Modal
        visible={showPreviewModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowPreviewModal(false)}
      >
        <View style={styles.previewOverlay}>
          <View style={[styles.previewModalContainer, { backgroundColor: theme.bg }]}>
            <View style={[styles.configHeader, { borderBottomColor: theme.borderColor }]}>
              <Text style={[styles.configHeaderTitle, { color: theme.textPrimary }]}>
                Thermal Receipt Preview
              </Text>
              <TouchableOpacity onPress={() => setShowPreviewModal(false)} style={{ padding: 6 }}>
                <X size={22} color={theme.textPrimary} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ padding: 16, alignItems: 'center', width: '100%' }}>
              <CustomReceiptMockup
                template={template}
                storeName={samplePrintData.storeName || ''}
                storeAddress={samplePrintData.storeAddress}
                storePhone={samplePrintData.storePhone}
                storeGstin={samplePrintData.storeGstin}
                storeLogoUrl={samplePrintData.storeLogoUrl}
                invoiceNumber={samplePrintData.invoiceNumber}
                date={samplePrintData.date}
                customerName={samplePrintData.customerName}
                customerPhone={samplePrintData.customerPhone}
                items={samplePrintData.items}
                subtotal={samplePrintData.subtotal}
                totalDiscount={samplePrintData.totalDiscount}
                totalTax={samplePrintData.totalTax}
                grandTotal={samplePrintData.grandTotal}
                amountPaid={samplePrintData.amountPaid}
                changeReturned={samplePrintData.changeReturned}
                paymentMethod={samplePrintData.paymentMethod}
                upiId={settings?.upiId || 'store@upi'}
                paperWidth={template.paperWidth || '58mm'}
                logoSizeChip={settings?.receiptConfig?.receiptLogoSize || 'medium'}
                qrSizeChip={settings?.receiptConfig?.receiptQrSize || 'medium'}
              />
            </ScrollView>
          </View>
        </View>
      </Modal>

      <LogoBackgroundModal
        visible={Boolean(logoBgModalUri)}
        imageUri={logoBgModalUri}
        onApply={(finalUri) => {
          if (logoBgCallback) logoBgCallback(finalUri);
          setLogoBgModalUri(null);
          setLogoBgCallback(null);
        }}
        onCancel={() => {
          setLogoBgModalUri(null);
          setLogoBgCallback(null);
        }}
      />
    </View>
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
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  backBtn: {
    padding: 6,
    marginRight: 6,
  },
  titleInput: {
    fontSize: 16,
    fontWeight: '700',
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  titleText: {
    fontSize: 16,
    fontWeight: '700',
  },
  subText: {
    fontSize: 11,
    marginTop: 2,
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconBtn: {
    padding: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  scrollContent: {
    padding: 16,
    gap: 16,
  },
  logoCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
  },
  logoCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  logoCardTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  logoCardSub: {
    fontSize: 11,
    marginTop: 2,
  },
  logoCardBody: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  logoEmptyBox: {
    width: 64,
    height: 64,
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  smallActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
  },
  smallActionBtnText: {
    fontSize: 11,
    fontWeight: '700',
  },
  logoSizeChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionHeading: {
    fontSize: 15,
    fontWeight: '700',
  },
  sectionSub: {
    fontSize: 11,
    marginTop: 2,
  },
  addSectionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  addSectionBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: 'dashed',
    marginTop: 10,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  emptySub: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
  entryRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  dragGripHandle: {
    paddingVertical: 8,
    paddingHorizontal: 4,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 4,
  },
  reorderCol: {
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  reorderBtn: {
    padding: 2,
  },
  entryIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  entryContentCol: {
    flex: 1,
    justifyContent: 'center',
  },
  entryTypeName: {
    fontSize: 13,
    fontWeight: '700',
  },
  entrySummaryText: {
    fontSize: 11,
    marginTop: 2,
  },
  entryRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: 6,
  },
  deleteEntryBtn: {
    padding: 6,
  },
  paperWidthCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    gap: 8,
  },
  paperWidthTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  paperOptionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  paperOptionChip: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
  },
  bottomActionBar: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 10,
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  sheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingBottom: 28,
    paddingTop: 12,
    maxHeight: '80%',
    zIndex: 10,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#CBD5E1',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 12,
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  sheetItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  sheetItemIconBox: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetItemTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  sheetItemSub: {
    fontSize: 11,
    marginTop: 2,
  },
  modalBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    width: '100%',
    height: '85%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    flexDirection: 'column',
    overflow: 'hidden',
  },
  sheetModalCard: {
    width: '100%',
    maxHeight: '75%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 28,
  },
  configHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
  },
  configHeaderTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 6,
  },
  subFieldLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
  },
  textAreaInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    minHeight: 70,
  },
  varChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
  },
  varChipText: {
    fontSize: 11,
    fontWeight: '700',
  },
  optionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  imagePickBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  imagePickBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  previewOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: 16,
  },
  previewModalContainer: {
    borderRadius: 16,
    maxHeight: '90%',
    overflow: 'hidden',
  },
  paperReceiptPreviewWrap: {
    width: '100%',
    alignItems: 'center',
  },
  receiptPaper: {
    width: 280,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
  },
  configModalFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: 1,
  },
  configCancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
  },
  configSaveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
});
