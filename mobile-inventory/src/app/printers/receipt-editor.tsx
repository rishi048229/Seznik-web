import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
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
  MoreVertical,
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
} from 'lucide-react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { usePrinterStore } from '@/store/usePrinterStore';
import ThermalPrinterService, { PrintSaleData } from '@/services/PrinterService';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useSettings } from '@/hooks/useSettings';
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
  getIcon: (type: ReceiptEntryType) => React.ReactNode;
  getSummary: (entry: CustomReceiptEntry) => string;
}

const DRAG_ROW_HEIGHT = 64;

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
  getIcon,
  getSummary,
}: DraggableEntryRowProps) {
  const [isDragging, setIsDragging] = useState(false);
  const panY = useRef(new Animated.Value(0)).current;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dy) > 3,
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
          opacity: entry.enabled ? 1 : 0.6,
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
      {/* Interactive Drag Handle */}
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

      {/* Entry Icon */}
      <View style={[styles.entryIconWrap, { backgroundColor: theme.isDark ? '#1E293B' : '#F1F5F9' }]}>
        {getIcon(entry.type)}
      </View>

      {/* Entry Content info */}
      <TouchableOpacity
        style={styles.entryContentCol}
        activeOpacity={0.7}
        onPress={() => onSelect(entry)}
      >
        <Text style={[styles.entryTypeName, { color: theme.isDark ? '#94A3B8' : '#64748B' }]}>
          {entry.type.toUpperCase().replace('_', ' ')}
        </Text>
        <Text style={[styles.entrySummaryText, { color: theme.textPrimary }]} numberOfLines={2}>
          {getSummary(entry)}
        </Text>
      </TouchableOpacity>

      {/* Controls right */}
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
  const topPadding = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0, 12);

  const {
    customTemplates,
    saveCustomTemplate,
    activeCustomTemplateId,
    setActiveCustomTemplate,
    paperWidth: globalPaperWidth,
    enableBillQrCode,
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
  const samplePrintData: PrintSaleData = useMemo(() => ({
    storeName: settings?.businessName || 'SEZNIK SUPERSTORE',
    storeAddress: settings?.businessAddress || '123 Market Road, City Centre',
    storePhone: settings?.businessPhone || '+91 98765 43210',
    storeGstin: settings?.businessGSTIN || '27AAAAA0000A1Z5',
    storeLogoUrl: settings?.businessLogoURL || undefined,
    upiId: settings?.upiId || 'seznik@upi',
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
  }), [settings]);

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
    setTemplate((prev) => ({ ...prev, entries: list }));
  };

  const handleReorderEntries = (fromIndex: number, toIndex: number) => {
    const boundedTo = Math.max(0, Math.min(template.entries.length - 1, toIndex));
    if (fromIndex === boundedTo) return;
    const list = [...template.entries];
    const [moved] = list.splice(fromIndex, 1);
    list.splice(boundedTo, 0, moved);
    setTemplate((prev) => ({ ...prev, entries: list }));
  };

  const handleDeleteEntry = (entryId: string) => {
    setTemplate((prev) => ({
      ...prev,
      entries: prev.entries.filter((e) => e.id !== entryId),
    }));
  };

  const handleToggleEntry = (entryId: string, val: boolean) => {
    setTemplate((prev) => ({
      ...prev,
      entries: prev.entries.map((e) => (e.id === entryId ? { ...e, enabled: val } : e)),
    }));
  };

  const handleAddNewEntryType = (type: ReceiptEntryType) => {
    setShowAddEntrySheet(false);
    const newId = `entry-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    let entry: CustomReceiptEntry;

    switch (type) {
      case 'text':
        entry = {
          id: newId,
          type: 'text',
          enabled: true,
          text: 'New Text Entry',
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
          widthPercent: 40,
        };
        break;
      case 'text_special':
        entry = {
          id: newId,
          type: 'text_special',
          enabled: true,
          text: 'Special Text Line',
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
          format: 'qr',
          value: '{{bill_pdf_url}}',
          align: 'center',
          size: 'medium',
          showText: true,
        };
        break;
      case 'left_right_text':
        entry = {
          id: newId,
          type: 'left_right_text',
          enabled: true,
          left: 'Item Name',
          right: 'Rs.0.00',
          bold: false,
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

    setTemplate((prev) => ({ ...prev, entries: [...prev.entries, entry] }));
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
        setEditingEntry({ ...editingEntry, imageUri: result.assets[0].uri });
      }
    } else {
      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: true,
        quality: 0.8,
      });
      if (!result.canceled && result.assets?.[0]?.uri && editingEntry && editingEntry.type === 'image') {
        setEditingEntry({ ...editingEntry, imageUri: result.assets[0].uri });
      }
    }
  };

  const handleTestPrint = async () => {
    setIsPrinting(true);
    try {
      const ok = await ThermalPrinterService.printReceipt(samplePrintData, template.paperWidth || globalPaperWidth, {
        customTemplate: template,
        includeBillQr: enableBillQrCode,
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
      const html = ThermalPrinterService.generateCustomReceiptHtml(
        samplePrintData,
        template,
        template.paperWidth || globalPaperWidth
      );
      const { uri } = await Print.printToFileAsync({ html });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: `Receipt - ${template.name}`,
        });
      }
    } catch (e: any) {
      Alert.alert('PDF Export Error', e?.message || 'Could not share PDF receipt.');
    }
  };

  const getEntryIcon = (type: ReceiptEntryType) => {
    switch (type) {
      case 'text':
        return <Type size={18} color="#2563EB" />;
      case 'image':
        return <ImageIcon size={18} color="#16A34A" />;
      case 'text_special':
        return <PlusSquare size={18} color="#0D9488" />;
      case 'horizontal_line':
        return <Minus size={18} color="#64748B" />;
      case 'barcode':
        return <BarcodeIcon size={18} color="#6366F1" />;
      case 'left_right_text':
        return <ArrowLeftRight size={18} color="#EA580C" />;
      case 'table':
        return <TableIcon size={18} color="#0284C7" />;
      case 'multi_format':
        return <FileCode size={18} color="#9333EA" />;
      case 'files_note':
        return <FileText size={18} color="#4F46E5" />;
    }
  };

  const getEntrySummary = (entry: CustomReceiptEntry): string => {
    switch (entry.type) {
      case 'text':
        return `${entry.text.replace(/\n/g, ' ')} • (${entry.size}, ${entry.align || 'left'})`;
      case 'image':
        return `Image Logo (${entry.widthPercent || 40}% width, ${entry.align || 'center'})`;
      case 'text_special':
        return `${entry.text} • (${entry.fontSizePt}pt, ${entry.bold ? 'Bold, ' : ''}${entry.align || 'center'})`;
      case 'horizontal_line':
        return `Line: ${entry.lineStyle}`;
      case 'barcode':
        return `${entry.codeType === 'qr_code' ? 'QR Code' : 'Barcode'}: ${entry.value}`;
      case 'left_right_text':
        return `${entry.left} ⇄ ${entry.right}`;
      case 'table':
        return `Items Table (${entry.tableType}${entry.showTaxColumn ? ', Tax' : ''})`;
      case 'multi_format':
        return entry.segments.map((s) => s.text).join(' ');
      case 'files_note':
        return `${entry.title || 'Note'}: ${entry.content.slice(0, 30)}…`;
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.bg, paddingTop: topPadding }]}>
      {/* Top Header Bar */}
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
              <Text style={[styles.titleText, { color: theme.textPrimary }]} numberOfLines={1}>
                {templateName}
              </Text>
              <Text style={[styles.subText, { color: theme.textSecondary }]}>
                Tap name to edit • {template.paperWidth || '58mm'} Roll
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Top Actions */}
        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={() => setShowPreviewModal(true)}
            style={[styles.headerIconBtn, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}
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
            {isSaving ? <ActivityIndicator size="small" color="#FFF" /> : <Save size={16} color="#FFF" />}
            <Text style={styles.saveBtnText}>Save</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Paper Width Selector Switch */}
      <View style={[styles.paperWidthBar, { backgroundColor: theme.cardBg, borderBottomColor: theme.borderColor }]}>
        <Text style={[styles.paperWidthLabel, { color: theme.textSecondary }]}>Paper Size:</Text>
        <View style={styles.paperWidthPills}>
          {(['58mm', '80mm'] as const).map((pw) => {
            const isSel = (template.paperWidth || '58mm') === pw;
            return (
              <TouchableOpacity
                key={pw}
                onPress={() => setTemplate((prev) => ({ ...prev, paperWidth: pw }))}
                style={[
                  styles.paperWidthPill,
                  {
                    backgroundColor: isSel ? BRAND_COLORS.navyInk : 'transparent',
                  },
                ]}
              >
                <Text style={[styles.paperWidthPillText, { color: isSel ? '#FFF' : theme.textPrimary }]}>
                  {pw}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity onPress={handleTestPrint} style={styles.quickPrintBtn} activeOpacity={0.7}>
          <Printer size={16} color="#2563EB" />
          <Text style={styles.quickPrintBtnText}>Test Print</Text>
        </TouchableOpacity>
      </View>

      {/* Main Body: Entries List (Matching Screenshot 2) */}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        <View style={styles.listHeader}>
          <Text style={[styles.listHeaderTitle, { color: theme.textPrimary }]}>
            Add an entry to start printing
          </Text>
          <Text style={[styles.listHeaderSub, { color: theme.textSecondary }]}>
            #Entry Type#: #Description#
          </Text>
        </View>

        {template.entries.length === 0 ? (
          <View style={[styles.emptyBox, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
            <Text style={[styles.emptyTitle, { color: theme.textPrimary }]}>No entries yet</Text>
            <Text style={[styles.emptySub, { color: theme.textSecondary }]}>
              Tap the "+ Entry" button below to add header text, logos, items tables, horizontal dividers, or QR codes.
            </Text>
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            {template.entries.map((entry, idx) => (
              <DraggableEntryRow
                key={entry.id}
                entry={entry}
                index={idx}
                totalCount={template.entries.length}
                theme={theme}
                onSelect={(e) => setEditingEntry(e)}
                onToggle={handleToggleEntry}
                onDelete={handleDeleteEntry}
                onMove={handleMoveEntry}
                onReorder={handleReorderEntries}
                getIcon={getEntryIcon}
                getSummary={getEntrySummary}
              />
            ))}
          </View>
        )}
      </ScrollView>

      {/* Floating Action Button (Matching Screenshot 2 "+ Entry") */}
      <View style={styles.fabContainer}>
        <TouchableOpacity
          style={[styles.fabBtn, { backgroundColor: BRAND_COLORS.navyInk }]}
          onPress={() => setShowAddEntrySheet(true)}
          activeOpacity={0.85}
        >
          <Plus size={20} color="#FFF" style={{ marginRight: 6 }} />
          <Text style={styles.fabText}>Entry</Text>
        </TouchableOpacity>
      </View>

      {/* Bottom Sheet Modal: Add Entry To Receipt (Matching Screenshot 1) */}
      <Modal
        visible={showAddEntrySheet}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowAddEntrySheet(false)}
      >
        <TouchableOpacity
          style={styles.sheetOverlay}
          activeOpacity={1}
          onPress={() => setShowAddEntrySheet(false)}
        >
          <View style={[styles.sheetContainer, { backgroundColor: theme.cardBg }]}>
            {/* Sheet Handle */}
            <View style={styles.sheetHandle} />

            {/* Sheet Title */}
            <Text style={[styles.sheetTitle, { color: theme.textPrimary }]}>
              Add Entry To Receipt
            </Text>

            <ScrollView style={{ maxHeight: 480 }} showsVerticalScrollIndicator={false}>
              {[
                {
                  type: 'text' as const,
                  title: 'Text',
                  sub: 'Basic format, size, alignment etc.',
                  icon: <Type size={22} color="#2563EB" />,
                },
                {
                  type: 'image' as const,
                  title: 'Image',
                  sub: 'Camera / Gallery',
                  icon: <ImageIcon size={22} color="#16A34A" />,
                },
                {
                  type: 'text_special' as const,
                  title: 'Text Special',
                  sub: 'Custom font, size, format etc.',
                  icon: <PlusSquare size={22} color="#0D9488" />,
                },
                {
                  type: 'horizontal_line' as const,
                  title: 'Horizontal line',
                  sub: 'Custom Horizontal line with format',
                  icon: <Minus size={22} color="#64748B" />,
                },
                {
                  type: 'barcode' as const,
                  title: 'Barcode',
                  sub: 'Barcode > QR Code',
                  icon: <BarcodeIcon size={22} color="#6366F1" />,
                },
                {
                  type: 'left_right_text' as const,
                  title: 'Left Right Text',
                  sub: 'Left Right text with basic format, size etc.',
                  icon: <ArrowLeftRight size={22} color="#EA580C" />,
                },
                {
                  type: 'table' as const,
                  title: 'Table',
                  sub: 'Simple > Advanced',
                  icon: <TableIcon size={22} color="#0284C7" />,
                },
                {
                  type: 'multi_format' as const,
                  title: 'Multi Format',
                  sub: 'Multiple texts with basic format, size etc. on the same line',
                  icon: <FileCode size={22} color="#9333EA" />,
                },
                {
                  type: 'files_note' as const,
                  title: 'Files',
                  sub: 'PDF > Notepad',
                  icon: <FileText size={22} color="#4F46E5" />,
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
                  <View style={[styles.sheetItemIconBox, { backgroundColor: theme.isDark ? '#1E293B' : '#F1F5F9' }]}>{item.icon}</View>
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
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Entry Configuration Modal */}
      {editingEntry && (
        <Modal
          visible={true}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setEditingEntry(null)}
        >
          <View style={styles.configOverlay}>
            <View style={[styles.configContainer, { backgroundColor: theme.bg }]}>
              <View style={[styles.configHeader, { borderBottomColor: theme.borderColor }]}>
                <Text style={[styles.configHeaderTitle, { color: theme.textPrimary }]}>
                  Configure {editingEntry.type.toUpperCase().replace('_', ' ')}
                </Text>
                <TouchableOpacity onPress={() => setEditingEntry(null)} style={{ padding: 6 }}>
                  <X size={22} color={theme.textPrimary} />
                </TouchableOpacity>
              </View>

              <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
                {/* Entry specific forms */}
                {editingEntry.type === 'text' && (
                  <View style={{ gap: 14 }}>
                    <Text style={[styles.fieldLabel, { color: theme.textPrimary }]}>Text Content:</Text>
                    <TextInput
                      style={[styles.textAreaInput, { color: theme.textPrimary, borderColor: theme.borderColor, backgroundColor: theme.cardBg }]}
                      value={editingEntry.text}
                      onChangeText={(t) => setEditingEntry({ ...editingEntry, text: t })}
                      multiline
                      numberOfLines={3}
                    />

                    {/* Variable suggestions */}
                    <Text style={[styles.subFieldLabel, { color: theme.textSecondary }]}>Insert Dynamic Variables:</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                      {TEMPLATE_VARIABLES.slice(0, 8).map((v) => (
                        <TouchableOpacity
                          key={v.key}
                          onPress={() => setEditingEntry({ ...editingEntry, text: `${editingEntry.text} ${v.key}` })}
                          style={[
                            styles.varChip,
                            {
                              backgroundColor: theme.isDark ? '#1E293B' : '#EFF6FF',
                              borderColor: theme.isDark ? '#3B82F6' : '#BFDBFE',
                            },
                          ]}
                        >
                          <Text style={[styles.varChipText, { color: theme.isDark ? '#93C5FD' : '#1D4ED8' }]}>{v.label}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>

                    <Text style={[styles.fieldLabel, { color: theme.textPrimary }]}>Font Size:</Text>
                    <View style={styles.optionsRow}>
                      {(['small', 'medium', 'large', 'double_width', 'double_height'] as const).map((sz) => {
                        const isSel = editingEntry.size === sz;
                        return (
                          <TouchableOpacity
                            key={sz}
                            onPress={() => setEditingEntry({ ...editingEntry, size: sz })}
                            style={[
                              styles.optionChip,
                              {
                                backgroundColor: isSel ? '#2563EB' : theme.cardBg,
                                borderColor: isSel ? '#2563EB' : theme.borderColor,
                              },
                            ]}
                          >
                            <Text style={{ color: isSel ? '#FFFFFF' : theme.textPrimary, fontSize: 12, fontWeight: isSel ? '700' : '600', textTransform: 'capitalize' }}>
                              {sz.replace('_', ' ')}
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

                {editingEntry.type === 'text_special' && (
                  <View style={{ gap: 14 }}>
                    <Text style={[styles.fieldLabel, { color: theme.textPrimary }]}>Special Text Content:</Text>
                    <TextInput
                      style={[styles.textAreaInput, { color: theme.textPrimary, borderColor: theme.borderColor, backgroundColor: theme.cardBg }]}
                      value={editingEntry.text}
                      onChangeText={(t) => setEditingEntry({ ...editingEntry, text: t })}
                      multiline
                      numberOfLines={3}
                    />

                    {/* Variable suggestions */}
                    <Text style={[styles.subFieldLabel, { color: theme.textSecondary }]}>Insert Dynamic Variables:</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                      {TEMPLATE_VARIABLES.slice(0, 8).map((v) => (
                        <TouchableOpacity
                          key={v.key}
                          onPress={() => setEditingEntry({ ...editingEntry, text: `${editingEntry.text} ${v.key}` })}
                          style={[
                            styles.varChip,
                            {
                              backgroundColor: theme.isDark ? '#1E293B' : '#EFF6FF',
                              borderColor: theme.isDark ? '#3B82F6' : '#BFDBFE',
                            },
                          ]}
                        >
                          <Text style={[styles.varChipText, { color: theme.isDark ? '#93C5FD' : '#1D4ED8' }]}>{v.label}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>

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

                    <View style={styles.switchRow}>
                      <Text style={[styles.fieldLabel, { color: theme.textPrimary }]}>Italic Style</Text>
                      <Switch
                        value={editingEntry.italic || false}
                        onValueChange={(i) => setEditingEntry({ ...editingEntry, italic: i })}
                        trackColor={{ false: '#CBD5E1', true: '#86EFAC' }}
                        thumbColor={editingEntry.italic ? '#16A34A' : '#F1F5F9'}
                      />
                    </View>

                    <View style={styles.switchRow}>
                      <Text style={[styles.fieldLabel, { color: theme.textPrimary }]}>Underline</Text>
                      <Switch
                        value={editingEntry.underline || false}
                        onValueChange={(u) => setEditingEntry({ ...editingEntry, underline: u })}
                        trackColor={{ false: '#CBD5E1', true: '#86EFAC' }}
                        thumbColor={editingEntry.underline ? '#16A34A' : '#F1F5F9'}
                      />
                    </View>
                  </View>
                )}

                {editingEntry.type === 'image' && (
                  <View style={{ gap: 14 }}>
                    <Text style={[styles.fieldLabel, { color: theme.textPrimary }]}>Logo / Receipt Image:</Text>
                    {editingEntry.imageUri ? (
                      <View style={{ alignItems: 'center', marginVertical: 10 }}>
                        <Image
                          source={{ uri: editingEntry.imageUri }}
                          style={{ width: 120, height: 120, borderRadius: 8, resizeMode: 'contain', backgroundColor: '#F1F5F9' }}
                        />
                      </View>
                    ) : (
                      <Text style={{ color: theme.textSecondary, fontSize: 13 }}>No image selected</Text>
                    )}

                    <View style={{ flexDirection: 'row', gap: 10 }}>
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
                    </View>

                    <Text style={[styles.fieldLabel, { color: theme.textPrimary }]}>Image Width on Receipt (%):</Text>
                    <View style={styles.optionsRow}>
                      {[30, 40, 50, 70, 100].map((pct) => {
                        const isSel = (editingEntry.widthPercent || 40) === pct;
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

                {editingEntry.type === 'horizontal_line' && (
                  <View style={{ gap: 14 }}>
                    <Text style={[styles.fieldLabel, { color: theme.textPrimary }]}>Line Style:</Text>
                    <View style={styles.optionsRow}>
                      {(['dashed', 'double', 'single', 'dotted'] as const).map((st) => {
                        const isSel = editingEntry.lineStyle === st;
                        return (
                          <TouchableOpacity
                            key={st}
                            onPress={() => setEditingEntry({ ...editingEntry, lineStyle: st })}
                            style={[
                              styles.optionChip,
                              {
                                backgroundColor: isSel ? '#2563EB' : theme.cardBg,
                                borderColor: isSel ? '#2563EB' : theme.borderColor,
                              },
                            ]}
                          >
                            <Text style={{ color: isSel ? '#FFFFFF' : theme.textPrimary, fontSize: 12, fontWeight: isSel ? '700' : '600', textTransform: 'capitalize' }}>
                              {st}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                )}

                {editingEntry.type === 'barcode' && (
                  <View style={{ gap: 14 }}>
                    <Text style={[styles.fieldLabel, { color: theme.textPrimary }]}>Code Type:</Text>
                    <View style={styles.optionsRow}>
                      {[
                        { id: 'qr_code', label: 'QR Code' },
                        { id: 'barcode_1d', label: '1D Barcode (Code128)' },
                      ].map((ct) => {
                        const isSel = editingEntry.codeType === ct.id;
                        return (
                          <TouchableOpacity
                            key={ct.id}
                            onPress={() =>
                              setEditingEntry({
                                ...editingEntry,
                                codeType: ct.id as any,
                                format: ct.id === 'qr_code' ? 'qr' : 'code128',
                              })
                            }
                            style={[
                              styles.optionChip,
                              {
                                backgroundColor: isSel ? '#2563EB' : theme.cardBg,
                                borderColor: isSel ? '#2563EB' : theme.borderColor,
                              },
                            ]}
                          >
                            <Text style={{ color: isSel ? '#FFFFFF' : theme.textPrimary, fontSize: 12, fontWeight: isSel ? '700' : '600' }}>
                              {ct.label}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>

                    <Text style={[styles.fieldLabel, { color: theme.textPrimary }]}>QR / Barcode Value / Template:</Text>
                    <TextInput
                      style={[styles.input, { color: theme.textPrimary, borderColor: theme.borderColor, backgroundColor: theme.cardBg }]}
                      value={editingEntry.value}
                      onChangeText={(v) => setEditingEntry({ ...editingEntry, value: v })}
                    />

                    <Text style={[styles.subFieldLabel, { color: theme.textSecondary }]}>Presets:</Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                      {[
                        { label: 'Digital Bill PDF URL', val: '{{bill_pdf_url}}' },
                        { label: 'UPI Payment String', val: '{{upi_qr}}' },
                        { label: 'Invoice No Barcode', val: '{{invoice_no}}' },
                      ].map((p) => (
                        <TouchableOpacity
                          key={p.val}
                          onPress={() => setEditingEntry({ ...editingEntry, value: p.val })}
                          style={[
                            styles.varChip,
                            {
                              backgroundColor: theme.isDark ? '#1E293B' : '#EFF6FF',
                              borderColor: theme.isDark ? '#3B82F6' : '#BFDBFE',
                            },
                          ]}
                        >
                          <Text style={[styles.varChipText, { color: theme.isDark ? '#93C5FD' : '#1D4ED8' }]}>{p.label}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}

                {editingEntry.type === 'left_right_text' && (
                  <View style={{ gap: 14 }}>
                    <Text style={[styles.fieldLabel, { color: theme.textPrimary }]}>Left Label / Variable:</Text>
                    <TextInput
                      style={[styles.input, { color: theme.textPrimary, borderColor: theme.borderColor, backgroundColor: theme.cardBg }]}
                      value={editingEntry.left}
                      onChangeText={(l) => setEditingEntry({ ...editingEntry, left: l })}
                    />

                    <Text style={[styles.fieldLabel, { color: theme.textPrimary }]}>Right Value / Variable:</Text>
                    <TextInput
                      style={[styles.input, { color: theme.textPrimary, borderColor: theme.borderColor, backgroundColor: theme.cardBg }]}
                      value={editingEntry.right}
                      onChangeText={(r) => setEditingEntry({ ...editingEntry, right: r })}
                    />

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

                {editingEntry.type === 'table' && (
                  <View style={{ gap: 14 }}>
                    <Text style={[styles.fieldLabel, { color: theme.textPrimary }]}>Table Style:</Text>
                    <View style={styles.optionsRow}>
                      {(['simple', 'advanced'] as const).map((ts) => {
                        const isSel = editingEntry.tableType === ts;
                        return (
                          <TouchableOpacity
                            key={ts}
                            onPress={() => setEditingEntry({ ...editingEntry, tableType: ts })}
                            style={[
                              styles.optionChip,
                              {
                                backgroundColor: isSel ? '#2563EB' : theme.cardBg,
                                borderColor: isSel ? '#2563EB' : theme.borderColor,
                              },
                            ]}
                          >
                            <Text style={{ color: isSel ? '#FFFFFF' : theme.textPrimary, fontSize: 12, fontWeight: isSel ? '700' : '600', textTransform: 'capitalize' }}>
                              {ts} Table
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>

                    <View style={styles.switchRow}>
                      <Text style={[styles.fieldLabel, { color: theme.textPrimary }]}>Show Tax (GST%) per item</Text>
                      <Switch
                        value={editingEntry.showTaxColumn || false}
                        onValueChange={(st) => setEditingEntry({ ...editingEntry, showTaxColumn: st })}
                        trackColor={{ false: '#CBD5E1', true: '#86EFAC' }}
                        thumbColor={editingEntry.showTaxColumn ? '#16A34A' : '#F1F5F9'}
                      />
                    </View>
                  </View>
                )}

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

                {editingEntry.type === 'files_note' && (
                  <View style={{ gap: 14 }}>
                    <Text style={[styles.fieldLabel, { color: theme.textPrimary }]}>Section Title (Optional):</Text>
                    <TextInput
                      style={[styles.input, { color: theme.textPrimary, borderColor: theme.borderColor, backgroundColor: theme.cardBg }]}
                      value={editingEntry.title || ''}
                      onChangeText={(t) => setEditingEntry({ ...editingEntry, title: t })}
                      placeholder="e.g. Store Return Policy"
                      placeholderTextColor="#94A3B8"
                    />

                    <Text style={[styles.fieldLabel, { color: theme.textPrimary }]}>Note / Policy Content:</Text>
                    <TextInput
                      style={[styles.textAreaInput, { color: theme.textPrimary, borderColor: theme.borderColor, backgroundColor: theme.cardBg }]}
                      value={editingEntry.content}
                      onChangeText={(c) => setEditingEntry({ ...editingEntry, content: c })}
                      multiline
                      numberOfLines={4}
                    />
                  </View>
                )}
              </ScrollView>

              {/* Save Entry Config */}
              <View style={[styles.configFooter, { borderTopColor: theme.borderColor, backgroundColor: theme.cardBg }]}>
                <TouchableOpacity
                  style={[styles.configSaveBtn, { backgroundColor: '#2563EB' }]}
                  onPress={() => handleUpdateEntry(editingEntry)}
                >
                  <Check size={18} color="#FFF" style={{ marginRight: 6 }} />
                  <Text style={styles.configSaveBtnText}>Apply Changes</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* Live Preview Modal */}
      {showPreviewModal && (
        <Modal
          visible={true}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setShowPreviewModal(false)}
        >
          <View style={styles.previewModalOverlay}>
            <View style={[styles.previewModalContainer, { backgroundColor: theme.bg }]}>
              <View style={[styles.previewHeader, { borderBottomColor: theme.borderColor }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.previewTitle, { color: theme.textPrimary }]}>
                    {template.name}
                  </Text>
                  <Text style={[styles.previewSub, { color: theme.textSecondary }]}>
                    Thermal Receipt Live Output ({template.paperWidth || '58mm'})
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => setShowPreviewModal(false)}
                  style={{ padding: 6 }}
                >
                  <X size={22} color={theme.textPrimary} />
                </TouchableOpacity>
              </View>

              <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, alignItems: 'center' }}>
                <View
                  style={[
                    styles.thermalPaperRoll,
                    {
                      width: template.paperWidth === '80mm' ? 340 : 280,
                    },
                  ]}
                >
                  <Text style={styles.thermalPaperMono}>
                    {ThermalPrinterService.formatCustomReceiptText(
                      samplePrintData,
                      template,
                      template.paperWidth || '58mm'
                    )}
                  </Text>
                </View>
              </ScrollView>

              <View style={[styles.previewFooter, { borderTopColor: theme.borderColor, backgroundColor: theme.cardBg }]}>
                <TouchableOpacity
                  style={[styles.previewFooterBtn, { backgroundColor: '#F1F5F9' }]}
                  onPress={handleSharePdf}
                >
                  <Share2 size={18} color="#334155" style={{ marginRight: 6 }} />
                  <Text style={[styles.previewFooterBtnText, { color: '#334155' }]}>Share PDF</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.previewFooterBtn, { backgroundColor: BRAND_COLORS.navyInk }]}
                  onPress={handleTestPrint}
                  disabled={isPrinting}
                >
                  {isPrinting ? (
                    <ActivityIndicator size="small" color="#FFF" style={{ marginRight: 6 }} />
                  ) : (
                    <Printer size={18} color="#FFF" style={{ marginRight: 6 }} />
                  )}
                  <Text style={[styles.previewFooterBtnText, { color: '#FFF' }]}>Print Sample</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
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
  titleText: {
    fontSize: 16,
    fontWeight: '800',
  },
  subText: {
    fontSize: 11,
    marginTop: 2,
  },
  titleInput: {
    fontSize: 15,
    fontWeight: '700',
    borderBottomWidth: 1.5,
    paddingVertical: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerIconBtn: {
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    gap: 4,
  },
  saveBtnText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
  },
  paperWidthBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  paperWidthLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  paperWidthPills: {
    flexDirection: 'row',
    backgroundColor: 'rgba(100, 116, 139, 0.12)',
    borderRadius: 8,
    padding: 2,
  },
  paperWidthPill: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  paperWidthPillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  quickPrintBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    padding: 4,
  },
  quickPrintBtnText: {
    color: '#2563EB',
    fontSize: 12,
    fontWeight: '700',
  },
  listHeader: {
    marginBottom: 14,
  },
  listHeaderTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  listHeaderSub: {
    fontSize: 12,
    marginTop: 2,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  emptyBox: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: 'dashed',
    marginTop: 20,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },
  emptySub: {
    fontSize: 13,
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
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  entryContentCol: {
    flex: 1,
  },
  entryTypeName: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
  },
  entrySummaryText: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  entryRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  deleteEntryBtn: {
    padding: 6,
  },
  fabContainer: {
    position: 'absolute',
    bottom: 24,
    right: 20,
  },
  fabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 6,
  },
  fabText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '800',
  },
  sheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 36,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CBD5E1',
    alignSelf: 'center',
    marginBottom: 14,
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 16,
  },
  sheetItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  sheetItemIconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetItemTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  sheetItemSub: {
    fontSize: 12,
    marginTop: 2,
  },
  configOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
  },
  configContainer: {
    flex: 1,
    marginTop: 40,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  configHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  configHeaderTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
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
    fontSize: 14,
  },
  textAreaInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    textAlignVertical: 'top',
  },
  varChip: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  varChipText: {
    fontSize: 11,
    fontWeight: '600',
  },
  optionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionChip: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  imagePickBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 12,
  },
  imagePickBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  configFooter: {
    padding: 16,
    borderTopWidth: 1,
  },
  configSaveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
  },
  configSaveBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
  previewModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
  },
  previewModalContainer: {
    flex: 1,
    marginTop: 50,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  previewTitle: {
    fontSize: 17,
    fontWeight: '800',
  },
  previewSub: {
    fontSize: 12,
    marginTop: 2,
  },
  thermalPaperRoll: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  thermalPaperMono: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 12,
    lineHeight: 16,
    color: '#000000',
  },
  previewFooter: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    borderTopWidth: 1,
  },
  previewFooterBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
  },
  previewFooterBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
