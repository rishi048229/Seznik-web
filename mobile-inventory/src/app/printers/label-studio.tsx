import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Modal,
  Alert,
  ActivityIndicator,
  StyleSheet,
  useWindowDimensions,
  Image,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Plus,
  Minus,
  Type,
  Barcode as BarcodeIcon,
  QrCode,
  Trash2,
  Save,
  Package,
  X,
  Search,
  CheckCircle2,
  Layers,
  Sparkles,
  Hash,
  ImageIcon,
  Info,
  FolderOpen,
  Check,
  Star,
  Printer,
  AlertTriangle,
  Tag,
  ScrollText,
} from 'lucide-react-native';
import { DirectPrinterConnectModal } from '@/components/printers/DirectPrinterConnectModal';
import * as ImagePicker from 'expo-image-picker';
import { useRouter, useLocalSearchParams } from 'expo-router';
import QRCodeSVG from 'react-native-qrcode-svg';
import { useAppTheme } from '@/hooks/useAppTheme';
import { ScreenBackground } from '@/components/ui/ScreenBackground';
import { BarcodeView } from '@/components/ui/barcode-view';
import { DraggableElement, ElementBox } from '@/components/label-studio/DraggableElement';
import { usePrinterStore } from '@/store/usePrinterStore';
import { useShallow } from 'zustand/react/shallow';
import { useProducts } from '@/hooks/useProducts';
import { Product } from '@/types/product';
import { BRAND_COLORS } from '@/constants/theme';
import ThermalPrinterService from '@/services/PrinterService';
import { AiBillToReceiptModal } from '@/components/printers/AiBillToReceiptModal';
import { Zap } from 'lucide-react-native';
import { KeyboardAvoidingWrapper } from '@/components/ui/KeyboardAvoidingWrapper';
import { LogoBackgroundModal } from '@/components/common/LogoBackgroundModal';
import {
  LabelTemplate,
  LabelElement,
  LabelTextElement,
  LabelBarcodeElement,
  LabelQrElement,
  LabelImageElement,
  LabelTextBinding,
  LabelCodeBinding,
} from '@/types/labelTemplate';
import { LABEL_SIZE_PRESETS } from '@/constants/labelSizePresets';
import { SequencePrintPrompt } from '@/components/label-studio/SequencePrintPrompt';
import { useLabelPrinterStatus } from '@/hooks/useLabelPrinterStatus';
import { useJoshDualModeTip } from '@/hooks/useJoshDualModeTip';
import { JoshDualModeModal } from '@/components/printers/JoshDualModeModal';

const newId = () => `el-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

function spawnPoint(widthMm: number, heightMm: number, count: number) {
  const cx = Math.max(2, widthMm / 2 - 10);
  const cy = Math.max(2, heightMm / 2 - 5);
  const offset = (count % 6) * 4;
  return { xMm: Math.min(widthMm - 5, cx + offset), yMm: Math.min(heightMm - 5, cy + offset) };
}

function applyLabelSize(prev: LabelTemplate, widthMm: number, heightMm: number): LabelTemplate {
  const elements = prev.elements.map((e) => {
    const clampedWidth = Math.min(e.widthMm, widthMm);
    const clampedHeight = Math.min(e.heightMm, heightMm);
    return {
      ...e,
      widthMm: clampedWidth,
      heightMm: clampedHeight,
      xMm: Math.min(e.xMm, Math.max(0, widthMm - clampedWidth)),
      yMm: Math.min(e.yMm, Math.max(0, heightMm - clampedHeight)),
    };
  });
  return { ...prev, widthMm, heightMm, elements };
}

function makeBlankTemplate(widthMm: number, heightMm: number): LabelTemplate {
  const now = new Date().toISOString();
  return {
    id: `label-${Date.now()}`,
    name: 'Custom Template',
    widthMm,
    heightMm,
    orientation: widthMm >= heightMm ? 'landscape' : 'portrait',
    elements: [
      { id: newId(), type: 'text', binding: 'productName', xMm: 3, yMm: 2, widthMm: widthMm - 6, heightMm: 4.5, fontSizePt: 3, align: 'center' },
      { id: newId(), type: 'text', binding: 'price', xMm: 3, yMm: 7.5, widthMm: widthMm - 6, heightMm: 4, fontSizePt: 3, bold: true, align: 'center' },
      { id: newId(), type: 'barcode', format: 'code128', binding: 'barcode', xMm: 5, yMm: 12.5, widthMm: widthMm - 10, heightMm: Math.max(5, Math.min(7, heightMm - 18)) },
    ],
    createdAt: now,
    updatedAt: now,
  };
}

function resolveTextValue(el: LabelTextElement, product: Product | null): string {
  switch (el.binding) {
    case 'productName':
      return product?.name || 'Product Name';
    case 'price':
      return `Rs.${(product?.sellingPrice ?? 0).toFixed(2)}`;
    case 'sku':
      return product?.sku || 'SKU-0000';
    case 'barcodeText':
      return product?.barcode || product?.sku || '0000000000000';
    case 'unit':
      return product?.unit || 'Pc';
    case 'category':
      return product?.category?.name || 'Category';
    case 'sequence':
      return '0001';
    case 'custom':
    default:
      return el.customText || 'Custom Text';
  }
}

function resolveCodeValue(el: LabelBarcodeElement | LabelQrElement, product: Product | null): string {
  switch (el.binding) {
    case 'barcode':
      return product?.barcode || product?.sku || `PROD-${(product?.id || '000000').slice(-6)}`;
    case 'sku':
      return product?.sku || product?.barcode || `PROD-${(product?.id || '000000').slice(-6)}`;
    case 'custom':
    default:
      return el.customValue || '0000000000000';
  }
}

const TEXT_BINDING_OPTIONS: { value: LabelTextBinding; label: string }[] = [
  { value: 'productName', label: 'Product Name' },
  { value: 'price', label: 'Price (Rs.)' },
  { value: 'sku', label: 'SKU' },
  { value: 'barcodeText', label: 'Barcode Text' },
  { value: 'unit', label: 'Unit' },
  { value: 'category', label: 'Category' },
  { value: 'sequence', label: 'Sequence No.' },
  { value: 'custom', label: 'Custom Text' },
];

const CODE_BINDING_OPTIONS: { value: LabelCodeBinding; label: string }[] = [
  { value: 'barcode', label: 'Product Barcode' },
  { value: 'sku', label: 'SKU' },
  { value: 'custom', label: 'Custom Value' },
];

export default function LabelStudioScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const theme = useAppTheme();
  const { width: windowWidth } = useWindowDimensions();

  const { products } = useProducts();
  const {
    labelTemplates,
    activeLabelTemplateId,
    saveLabelTemplate,
    deleteLabelTemplate,
    setActiveLabelTemplate,
    labelWidthMm,
    labelHeightMm,
    labelGapMm,
    labelPaperMode,
    setLabelPaperMode,
    paperWidth,
    connectedPrinterModel,
  } = usePrinterStore(
    useShallow((s) => ({
    labelTemplates: s.labelTemplates,
    activeLabelTemplateId: s.activeLabelTemplateId,
    saveLabelTemplate: s.saveLabelTemplate,
    deleteLabelTemplate: s.deleteLabelTemplate,
    setActiveLabelTemplate: s.setActiveLabelTemplate,
    labelWidthMm: s.labelWidthMm,
    labelHeightMm: s.labelHeightMm,
    labelGapMm: s.labelGapMm,
    labelPaperMode: s.labelPaperMode,
    setLabelPaperMode: s.setLabelPaperMode,
    paperWidth: s.paperWidth,
    connectedPrinterModel: s.connectedPrinterModel,
    }))
  );
  const labelPrinter = useLabelPrinterStatus();
  const [showConnectModal, setShowConnectModal] = useState(false);

  const isDev2in1 = useMemo(() => {
    const name = (labelPrinter.name || '').toLowerCase();
    return (
      connectedPrinterModel === 'dev' ||
      name.includes('2in1') ||
      name.includes('dev') ||
      name.includes('seznik')
    );
  }, [labelPrinter.name, connectedPrinterModel]);

  // Opening Label Studio from the Printers screen carries no id param. Previously
  // that always started a brand-new blank template, so the saved/default design was
  // silently ignored and any earlier work looked like it had been discarded — fall
  // back to the active template, then to whatever single template exists.
  const existing = params.id
    ? labelTemplates.find((t) => t.id === params.id)
    : labelTemplates.find((t) => t.id === activeLabelTemplateId) ?? labelTemplates[0];
  const [template, setTemplate] = useState<LabelTemplate>(() => existing || makeBlankTemplate(labelWidthMm, labelHeightMm));
  const [selectedId, setSelectedId] = useState<string | null>(() => template.elements[0]?.id || null);
  const [previewProduct, setPreviewProduct] = useState<Product | null>(products[0] || null);
  const [productSearch, setProductSearch] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isSettingDefault, setIsSettingDefault] = useState(false);
  const [isTestPrinting, setIsTestPrinting] = useState(false);
  const [printCopies, setPrintCopies] = useState(1);
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [showSavedTemplatesModal, setShowSavedTemplatesModal] = useState(false);
  const [showAiBillModal, setShowAiBillModal] = useState(false);

  const hasSequenceElement = template.elements.some((e) => e.type === 'text' && e.binding === 'sequence');
  const [showSequencePrompt, setShowSequencePrompt] = useState(false);
  const [isSeqPrinting, setIsSeqPrinting] = useState(false);
  const [seqProgress, setSeqProgress] = useState(0);
  const { shouldShowTip, markTipShown, dismissPermanently } = useJoshDualModeTip();
  const [showTipModal, setShowTipModal] = useState(false);

  React.useEffect(() => {
    if (labelPrinter.isConnected && labelPrinter.kind === 'label' && shouldShowTip) {
      setShowTipModal(true);
    }
  }, [labelPrinter.isConnected, labelPrinter.kind, shouldShowTip]);

  const [zoomScale, setZoomScale] = useState(1.0);
  const [isInteractingWithElement, setIsInteractingWithElement] = useState(false);

  const maxAvailableCanvasWidth = windowWidth - 32;
  const basePxPerMm = useMemo(() => {
    return Math.max(4, Math.min(8, Math.floor(maxAvailableCanvasWidth / template.widthMm)));
  }, [maxAvailableCanvasWidth, template.widthMm]);

  const pxPerMm = useMemo(() => {
    return Math.max(2, Math.round(basePxPerMm * zoomScale * 10) / 10);
  }, [basePxPerMm, zoomScale]);

  const canvasWidthPx = template.widthMm * pxPerMm;
  const canvasOverflowsScreen = canvasWidthPx > maxAvailableCanvasWidth;

  const handleZoomIn = () => {
    setZoomScale((prev) => Math.min(3.0, Math.round((prev + 0.25) * 100) / 100));
  };
  const handleZoomOut = () => {
    setZoomScale((prev) => Math.max(0.6, Math.round((prev - 0.25) * 100) / 100));
  };
  const handleZoomReset = () => {
    setZoomScale(1.0);
  };

  const [logoBgModalUri, setLogoBgModalUri] = useState<string | null>(null);
  const [, setLogoBgCallback] = useState<((uri: string) => void) | null>(null);

  const openLogoBgOption = (uri: string, onSelected: (finalUri: string) => void) => {
    setLogoBgModalUri(uri);
    setLogoBgCallback(() => onSelected);
  };

  const selectedElement = template.elements.find((e) => e.id === selectedId) || null;

  const updateElement = (id: string, box: ElementBox) => {
    setTemplate((prev) => ({
      ...prev,
      elements: prev.elements.map((e) => (e.id === id ? { ...e, ...box } : e)),
    }));
  };

  const deleteElement = (id: string) => {
    setTemplate((prev) => ({
      ...prev,
      elements: prev.elements.filter((e) => e.id !== id),
    }));
    if (selectedId === id) setSelectedId(null);
  };

  const duplicateElement = (id: string) => {
    const el = template.elements.find((e) => e.id === id);
    if (!el) return;
    const duplicated: LabelElement = {
      ...el,
      id: newId(),
      xMm: Math.min(template.widthMm - el.widthMm, el.xMm + 2),
      yMm: Math.min(template.heightMm - el.heightMm, el.yMm + 2),
    };
    setTemplate((prev) => ({
      ...prev,
      elements: [...prev.elements, duplicated],
    }));
    setSelectedId(duplicated.id);
  };

  const updateElementProps = (id: string, changes: Partial<LabelElement>) => {
    setTemplate((prev) => ({
      ...prev,
      elements: prev.elements.map((e) => (e.id === id ? ({ ...e, ...changes } as LabelElement) : e)),
    }));
  };

  const handlePickImageForElement = async (elementId?: string) => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permission Denied', 'Gallery access is required to pick logo images.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]?.uri) {
        const uri = result.assets[0].uri;
        if (elementId) {
          updateElementProps(elementId, { uri } as Partial<LabelImageElement>);
        } else {
          const base = { id: newId(), ...spawnPoint(template.widthMm, template.heightMm, template.elements.length) };
          const el: LabelElement = { ...base, type: 'image', uri, widthMm: 20, heightMm: 20 };
          setTemplate((prev) => ({ ...prev, elements: [...prev.elements, el] }));
          setSelectedId(el.id);
        }
      }
    } catch (err: any) {
      Alert.alert('Image Picker Error', err?.message || 'Failed to select image.');
    }
  };

  const addElement = (type: 'text' | 'barcode' | 'qrcode' | 'image') => {
    if (type === 'image') {
      handlePickImageForElement();
      return;
    }
    const base = { id: newId(), ...spawnPoint(template.widthMm, template.heightMm, template.elements.length) };
    let el: LabelElement;
    if (type === 'text') {
      el = { ...base, type: 'text', binding: 'custom', customText: 'New Text', widthMm: 20, heightMm: 5, fontSizePt: 3, align: 'center' };
    } else if (type === 'barcode') {
      el = { ...base, type: 'barcode', format: 'ean13', binding: 'barcode', widthMm: 30, heightMm: 12 };
    } else {
      el = { ...base, type: 'qrcode', binding: 'barcode', widthMm: 16, heightMm: 16 };
    }
    setTemplate((prev) => ({ ...prev, elements: [...prev.elements, el] }));
    setSelectedId(el.id);
  };

  const deleteSelected = () => {
    if (!selectedId) return;
    setTemplate((prev) => {
      const remaining = prev.elements.filter((e) => e.id !== selectedId);
      return { ...prev, elements: remaining };
    });
    setSelectedId(null);
  };

  const handleSaveTemplate = async () => {
    if (!template.name.trim()) {
      Alert.alert('Name Required', 'Give this label a name before saving.');
      return;
    }
    setIsSaving(true);
    try {
      const toSave: LabelTemplate = { ...template, updatedAt: new Date().toISOString() };
      await saveLabelTemplate(toSave);
      setTemplate(toSave);
      Alert.alert('Template Saved!', `"${toSave.name}" has been saved successfully.`);
    } catch (e: any) {
      Alert.alert('Save Failed', e?.message || 'Could not save this template.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSetDefault = async () => {
    setIsSettingDefault(true);
    try {
      const toSave: LabelTemplate = { ...template, updatedAt: new Date().toISOString() };
      await saveLabelTemplate(toSave);
      await setActiveLabelTemplate(toSave.id);
      setTemplate(toSave);
      Alert.alert('Default Template Set!', `"${toSave.name}" is now the active default template for all product label prints.`);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not set this template as default.');
    } finally {
      setIsSettingDefault(false);
    }
  };

  const handleTestPrint = async () => {
    if (!previewProduct && products.length > 0) {
      setPreviewProduct(products[0]);
    }
    const targetProduct = previewProduct || products[0] || {
      id: 'demo-1',
      name: 'Sample Item 500g',
      sellingPrice: 250.0,
      barcode: '8901234567890',
    };

    const doPrint = async () => {
      setIsTestPrinting(true);
      const copies = Math.max(1, printCopies);
      const labelKind = await ThermalPrinterService.getConnectedLabelPrinterKind();
      const hasLabelPrinter = labelKind !== null;
      try {
        const ok =
          labelPaperMode === 'continuous' && !hasLabelPrinter
            ? await ThermalPrinterService.printLabelTemplateOnReceiptPaper(targetProduct, template, paperWidth, copies)
            : await ThermalPrinterService.printLabelFromTemplate(targetProduct, template, copies, labelGapMm);
        if (ok) Alert.alert('Print Sent!', `Printed ${copies} label${copies > 1 ? 's' : ''} for "${targetProduct.name}".`);
        else Alert.alert('Print Failed', 'Could not send label to printer. Make sure printer is connected.');
      } catch (e: any) {
        Alert.alert('Print Failed', e?.message || 'Could not print this template.');
      } finally {
        setIsTestPrinting(false);
      }
    };

    await doPrint();
  };

  const handleOpenSequencePrompt = () => {
    if (!hasSequenceElement) {
      Alert.alert('Add a Sequence Field', 'Select a text element below and set its "Bind to" option to "Sequence No." first.');
      return;
    }
    setShowSequencePrompt(true);
  };

  const handleSubmitSequence = async (startPattern: string, count: number) => {
    const targetProduct = previewProduct || products[0] || {
      id: 'demo-1',
      name: 'Sample Item 500g',
      sellingPrice: 250.0,
      barcode: '8901234567890',
    };

    setIsSeqPrinting(true);
    setSeqProgress(0);
    try {
      const result = await ThermalPrinterService.printLabelSequence(
        targetProduct,
        template,
        { startPattern, count, mode: labelPaperMode, paperWidth, labelGapMm },
        (done) => setSeqProgress(done)
      );
      if (result.ok) {
        setShowSequencePrompt(false);
        Alert.alert('Sequence Printed!', `Printed ${result.printedCount} labels starting from "${startPattern}".`);
      } else if (result.printedCount === 0) {
        Alert.alert('Invalid Pattern', 'The starting pattern must include at least one number to increment (e.g. "0001" or "A01").');
      } else {
        Alert.alert('Print Failed', `Stopped after ${result.printedCount} labels.`);
      }
    } catch (e: any) {
      Alert.alert('Print Failed', e?.message || 'Could not print the sequence.');
    } finally {
      setIsSeqPrinting(false);
      setSeqProgress(0);
    }
  };

  const handleRunAlignmentSelfTest = async () => {
    setIsTestPrinting(true);
    try {
      const ok = await ThermalPrinterService.printAlignmentSelfTest(
        3,
        template.widthMm,
        template.heightMm,
        labelGapMm
      );
      if (ok) {
        Alert.alert(
          'Alignment Self-Test Sent!',
          'Printing 3 test labels with border box and center crosshairs.\n\nInspect the printed labels:\n• Outer rectangle should fit squarely inside the die-cut label.\n• Center crosshair should be in the middle of each label.\n• Consecutive labels should feed accurately across gaps.'
        );
      } else {
        Alert.alert('Self-Test Failed', 'Could not send test pattern to printer. Verify printer is connected.');
      }
    } catch (e: any) {
      Alert.alert('Self-Test Error', e?.message || 'Failed to print alignment test.');
    } finally {
      setIsTestPrinting(false);
    }
  };

  const filteredProducts = useMemo(
    () => products.filter((p) => p.name.toLowerCase().includes(productSearch.toLowerCase())),
    [products, productSearch]
  );

  const isCurrentTemplateDefault = activeLabelTemplateId === template.id;

  const renderElementContent = (el: LabelElement) => {
    const px = (mm: number) => mm * pxPerMm;
    if (el.type === 'text') {
      const value = resolveTextValue(el, previewProduct);
      return (
        <Text
          numberOfLines={1}
          style={{
            fontSize: Math.max(8, px(el.fontSizePt)),
            fontWeight: el.bold ? '900' : '600',
            textAlign: el.align || 'center',
            color: '#0F172A',
            width: '100%',
          }}
        >
          {value}
        </Text>
      );
    }
    if (el.type === 'barcode') {
      const value = resolveCodeValue(el, previewProduct);
      return <BarcodeView barcode={value} width={px(el.widthMm)} height={px(el.heightMm)} showText={false} />;
    }
    if (el.type === 'qrcode') {
      const value = resolveCodeValue(el, previewProduct);
      return <QRCodeSVG value={value} size={Math.max(20, px(Math.min(el.widthMm, el.heightMm)))} />;
    }
    if (el.type === 'image') {
      return (
        <View style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          {el.uri ? (
            <Image
              source={{ uri: el.uri }}
              style={{
                width: '100%',
                height: '100%',
                resizeMode: 'contain',
              }}
            />
          ) : (
            <View style={{ width: '100%', height: '100%', backgroundColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center' }}>
              <ImageIcon size={18} color="#64748B" />
              <Text style={{ fontSize: 9, color: '#64748B', fontWeight: 'bold', marginTop: 2 }}>Select Image</Text>
            </View>
          )}
        </View>
      );
    }
    return (
      <View style={styles.unsupportedBox}>
        <Text style={styles.unsupportedText}>{el.type}</Text>
      </View>
    );
  };

  return (
    <ScreenBackground color={theme.bg}>
      <SafeAreaView style={[styles.container, { backgroundColor: 'transparent' }]}>
        <KeyboardAvoidingWrapper inModal>
          {/* Top Header Row */}
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <ArrowLeft size={18} color={theme.textPrimary} />
            </TouchableOpacity>

            <TextInput
              value={template.name}
              onChangeText={(name) => setTemplate((prev) => ({ ...prev, name }))}
              style={[styles.nameInput, { color: theme.textPrimary, borderColor: theme.borderColor, backgroundColor: theme.cardBg }]}
              placeholder="Template Name"
              placeholderTextColor="#94A3B8"
            />

            <TouchableOpacity
              onPress={() => setShowSavedTemplatesModal(true)}
              style={[styles.headerIconBtn, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}
            >
              <FolderOpen size={16} color={BRAND_COLORS.blue600} />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setShowAiBillModal(true)}
              style={[styles.aiBtn, { backgroundColor: BRAND_COLORS.blue600 }]}
            >
              <Zap size={14} color="#FFFFFF" />
              <Text style={styles.aiBtnText}>AI</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleSaveTemplate}
              disabled={isSaving}
              style={[styles.saveBtn, { backgroundColor: BRAND_COLORS.navyInk }]}
            >
              {isSaving ? <ActivityIndicator size="small" color="#FFF" /> : <Save size={15} color="#FFFFFF" />}
            </TouchableOpacity>
          </View>

          {/* Quick Studio Control Bar: Printer Search & Paper Mode */}
          <View style={styles.studioControlBar}>
            {/* Printer Search / Connect Button */}
            <TouchableOpacity
              onPress={() => setShowConnectModal(true)}
              style={[
                styles.printerConnectBarBtn,
                {
                  backgroundColor: theme.cardBg,
                  borderColor: labelPrinter.isConnected ? '#10B981' : theme.borderColor,
                },
              ]}
              activeOpacity={0.7}
            >
              <View style={[styles.statusDot, { backgroundColor: labelPrinter.isConnected ? '#10B981' : '#EF4444' }]} />
              <Printer size={14} color={labelPrinter.isConnected ? '#10B981' : theme.textSecondary} style={{ marginLeft: 6, marginRight: 5 }} />
              <Text style={[styles.printerBarBtnText, { color: theme.textPrimary }]} numberOfLines={1}>
                {labelPrinter.isConnected ? labelPrinter.name || 'Printer' : 'No Printer'}
              </Text>
              <View style={[styles.searchPill, { backgroundColor: BRAND_COLORS.blue600 }]}>
                <Search size={11} color="#FFFFFF" style={{ marginRight: 3 }} />
                <Text style={styles.searchPillText}>{labelPrinter.isConnected ? 'Switch' : 'Search'}</Text>
              </View>
            </TouchableOpacity>

            {/* Label Paper Mode Toggle */}
            <View style={[styles.paperModeToggleRow, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
              <TouchableOpacity
                onPress={() => {
                  setLabelPaperMode('gap');
                  ThermalPrinterService.yxCalibrate(2).catch(() => {});
                }}
                style={[styles.paperModeChip, labelPaperMode === 'gap' && styles.paperModeChipActive]}
                activeOpacity={0.8}
              >
                <Tag size={12} color={labelPaperMode === 'gap' ? '#FFFFFF' : theme.textSecondary} style={{ marginRight: 4 }} />
                <Text style={[styles.paperModeChipText, labelPaperMode === 'gap' && styles.paperModeChipTextActive]}>
                  Die-Cut (Gap)
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  setLabelPaperMode('continuous');
                  ThermalPrinterService.yxCalibrate(0).catch(() => {});
                }}
                style={[styles.paperModeChip, labelPaperMode === 'continuous' && styles.paperModeChipActive]}
                activeOpacity={0.8}
              >
                <ScrollText size={12} color={labelPaperMode === 'continuous' ? '#FFFFFF' : theme.textSecondary} style={{ marginRight: 4 }} />
                <Text style={[styles.paperModeChipText, labelPaperMode === 'continuous' && styles.paperModeChipTextActive]}>
                  Continuous
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Default Template Action Banner */}
          <View style={{ marginHorizontal: 12, marginBottom: 8 }}>
            {isCurrentTemplateDefault ? (
              <View style={[styles.defaultStatusBanner, { backgroundColor: 'rgba(16, 185, 129, 0.12)', borderColor: 'rgba(16, 185, 129, 0.3)' }]}>
                <CheckCircle2 size={14} color="#10B981" />
                <Text style={styles.defaultStatusText}>Default Template (Used for real barcode label prints)</Text>
              </View>
            ) : (
              <TouchableOpacity
                onPress={handleSetDefault}
                disabled={isSettingDefault}
                style={[styles.setDefaultBtn, { backgroundColor: 'rgba(245, 158, 11, 0.12)', borderColor: '#F59E0B' }]}
              >
                {isSettingDefault ? (
                  <ActivityIndicator size="small" color="#B45309" style={{ marginRight: 6 }} />
                ) : (
                  <Star size={14} color="#B45309" style={{ marginRight: 6 }} />
                )}
                <Text style={styles.setDefaultBtnText}>Set as Active Default Label Template ⭐</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* 2-in-1 POS & Label Connected Banner */}
          {labelPrinter.isConnected && isDev2in1 && (
            <View
              style={[
                styles.dualModeCallout,
                {
                  backgroundColor: theme.isDark ? 'rgba(37, 99, 235, 0.12)' : '#EFF6FF',
                  borderColor: theme.isDark ? 'rgba(37, 99, 235, 0.25)' : '#BFDBFE',
                  marginHorizontal: 12,
                  marginBottom: 8,
                },
              ]}
            >
              <Sparkles size={14} color="#2563EB" style={{ marginRight: 6 }} />
              <Text style={[styles.dualModeCalloutText, { color: theme.isDark ? '#93C5FD' : '#1D4ED8' }]}>
                Other 2-in-1 POS & Label Printer connected ({labelPrinter.name}) • Ready for die-cut sticker rolls
              </Text>
            </View>
          )}

          {/* Genuine Receipt-only Printer Warning Banner (VEER or dedicated receipt-only printer) */}
          {labelPrinter.isConnected &&
            labelPrinter.kind === 'thermal' &&
            labelPaperMode === 'gap' &&
            !isDev2in1 && (
            <View
              style={[
                styles.warningBanner,
                {
                  backgroundColor: theme.isDark ? 'rgba(245, 158, 11, 0.12)' : '#FEF3C7',
                  borderColor: theme.isDark ? 'rgba(245, 158, 11, 0.28)' : '#FDE68A',
                },
              ]}
            >
              <AlertTriangle size={16} color="#D97706" style={{ marginTop: 2, marginRight: 8 }} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.warningBannerTitle, { color: theme.isDark ? '#FDE68A' : '#92400E' }]}>
                  Receipt Printer Connected ({labelPrinter.name})
                </Text>
                <Text style={[styles.warningBannerText, { color: theme.isDark ? '#FCD34D' : '#B45309' }]}>
                  Your printer is currently operating as a continuous receipt printer. To print on sticker rolls, switch Paper Mode to Continuous or connect a 2-in-1 Label printer.
                </Text>
              </View>
            </View>
          )}

          {/* Josh Dual-Mode Connected Callout */}
          {labelPrinter.isConnected && labelPrinter.kind === 'label' && (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setShowTipModal(true)}
              style={[
                styles.dualModeCallout,
                {
                  backgroundColor: theme.isDark ? 'rgba(99, 102, 241, 0.12)' : '#EEF2FF',
                  borderColor: theme.isDark ? 'rgba(99, 102, 241, 0.25)' : '#C7D2FE',
                },
              ]}
            >
              <Sparkles size={14} color="#6366F1" style={{ marginRight: 6 }} />
              <Text style={[styles.dualModeCalloutText, { color: theme.isDark ? '#C7D2FE' : '#3730A3' }]}>
                Josh Dual-Mode Smart Printer connected ({labelPrinter.name}) • Tap for mode tips
              </Text>
            </TouchableOpacity>
          )}

          {/* Main Unified Scrolling Content */}
          <ScrollView
            style={styles.mainScroll}
            contentContainerStyle={styles.mainScrollContent}
            keyboardShouldPersistTaps="handled"
            scrollEnabled={!isInteractingWithElement}
          >
            {/* CANVAS WORK AREA */}
            <View style={[styles.canvasCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
              <View style={styles.canvasHeader}>
                <View>
                  <Text style={[styles.canvasBadge, { color: theme.textSecondary }]}>
                    CANVAS ({template.widthMm}mm × {template.heightMm}mm)
                  </Text>
                  <Text style={{ fontSize: 10, color: theme.textSecondary }}>
                    Drag to move • Handles/Pinch to resize
                  </Text>
                </View>

                {/* Canvas Zoom Controls */}
                <View style={styles.zoomControlGroup}>
                  <TouchableOpacity
                    style={[styles.zoomBtn, { borderColor: theme.borderColor, backgroundColor: theme.bg }]}
                    onPress={handleZoomOut}
                    disabled={zoomScale <= 0.6}
                    activeOpacity={0.7}
                  >
                    <Minus size={13} color={zoomScale <= 0.6 ? theme.textSecondary : BRAND_COLORS.blue600} />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.zoomIndicator, { borderColor: theme.borderColor, backgroundColor: theme.bg }]}
                    onPress={handleZoomReset}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.zoomIndicatorText, { color: theme.textPrimary }]}>
                      {Math.round(zoomScale * 100)}%
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.zoomBtn, { borderColor: theme.borderColor, backgroundColor: theme.bg }]}
                    onPress={handleZoomIn}
                    disabled={zoomScale >= 3.0}
                    activeOpacity={0.7}
                  >
                    <Plus size={13} color={zoomScale >= 3.0 ? theme.textSecondary : BRAND_COLORS.blue600} />
                  </TouchableOpacity>
                </View>
              </View>

              <ScrollView
                horizontal={canvasOverflowsScreen}
                contentContainerStyle={canvasOverflowsScreen ? { minWidth: canvasWidthPx } : styles.canvasCenterWrapper}
                showsHorizontalScrollIndicator={false}
                scrollEnabled={!isInteractingWithElement}
              >
                <TouchableOpacity activeOpacity={1} onPress={() => setSelectedId(null)}>
                  <View
                    style={[
                      styles.canvas,
                      {
                        width: template.widthMm * pxPerMm,
                        height: template.heightMm * pxPerMm,
                        backgroundColor: template.backgroundColor || '#FFFFFF',
                      },
                    ]}
                  >
                    {template.elements.map((el) => (
                      <DraggableElement
                        key={el.id}
                        xMm={el.xMm}
                        yMm={el.yMm}
                        widthMm={el.widthMm}
                        heightMm={el.heightMm}
                        rotation={el.rotation || 0}
                        locked={el.locked || false}
                        pxPerMm={pxPerMm}
                        boundsWidthMm={template.widthMm}
                        boundsHeightMm={template.heightMm}
                        selected={selectedId === el.id}
                        onSelect={() => setSelectedId(el.id)}
                        onChange={(box) => updateElement(el.id, box)}
                        onDuplicate={() => duplicateElement(el.id)}
                        onDelete={() => deleteElement(el.id)}
                        onGestureStart={() => setIsInteractingWithElement(true)}
                        onGestureEnd={() => setIsInteractingWithElement(false)}
                      >
                        {renderElementContent(el)}
                      </DraggableElement>
                    ))}
                  </View>
                </TouchableOpacity>
              </ScrollView>

              {/* QUICK ADD ELEMENTS TOOLBAR (Right below Canvas) */}
              <View style={styles.quickAddBar}>
                <TouchableOpacity
                  onPress={() => addElement('text')}
                  style={[styles.quickAddBtn, { borderColor: theme.borderColor, backgroundColor: theme.bg }]}
                >
                  <Type size={14} color={BRAND_COLORS.blue600} />
                  <Text style={[styles.quickAddText, { color: theme.textPrimary }]}>+ Text</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => addElement('barcode')}
                  style={[styles.quickAddBtn, { borderColor: theme.borderColor, backgroundColor: theme.bg }]}
                >
                  <BarcodeIcon size={14} color={BRAND_COLORS.blue600} />
                  <Text style={[styles.quickAddText, { color: theme.textPrimary }]}>+ Barcode</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => addElement('qrcode')}
                  style={[styles.quickAddBtn, { borderColor: theme.borderColor, backgroundColor: theme.bg }]}
                >
                  <QrCode size={14} color={BRAND_COLORS.blue600} />
                  <Text style={[styles.quickAddText, { color: theme.textPrimary }]}>+ QR Code</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => addElement('image')}
                  style={[styles.quickAddBtn, { borderColor: theme.borderColor, backgroundColor: theme.bg }]}
                >
                  <ImageIcon size={14} color={BRAND_COLORS.blue600} />
                  <Text style={[styles.quickAddText, { color: theme.textPrimary }]}>+ Logo</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* DIRECT ELEMENT EDITING INSPECTOR (Directly below Canvas) */}
            {selectedElement ? (
              <View style={[styles.inspectorCard, { backgroundColor: theme.cardBg, borderColor: BRAND_COLORS.blue600 }]}>
                {/* Element Header with DELETE BUTTON */}
                <View style={styles.inspectorHeaderRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <View style={[styles.typeBadge, { backgroundColor: BRAND_COLORS.navyInk }]}>
                      <Text style={styles.typeBadgeText}>{selectedElement.type.toUpperCase()}</Text>
                    </View>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: theme.textSecondary }}>
                      X:{Math.round(selectedElement.xMm)} Y:{Math.round(selectedElement.yMm)} • {Math.round(selectedElement.widthMm)}×{Math.round(selectedElement.heightMm)}mm
                    </Text>
                  </View>

                  {/* PROMINENT DELETE BUTTON RIGHT BELOW CANVAS */}
                  <TouchableOpacity
                    onPress={deleteSelected}
                    style={styles.deleteElementBtn}
                  >
                    <Trash2 size={14} color="#FFF" style={{ marginRight: 4 }} />
                    <Text style={styles.deleteElementBtnText}>Delete</Text>
                  </TouchableOpacity>
                </View>

                {/* TEXT ELEMENT CONTROLS */}
                {selectedElement.type === 'text' && (
                  <View style={{ marginTop: 8 }}>
                    <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Bind Content To:</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 4 }}>
                      <View style={{ flexDirection: 'row', gap: 6 }}>
                        {TEXT_BINDING_OPTIONS.map((opt) => (
                          <TouchableOpacity
                            key={opt.value}
                            onPress={() => updateElementProps(selectedElement.id, { binding: opt.value } as Partial<LabelTextElement>)}
                            style={[
                              styles.chip,
                              { borderColor: theme.borderColor, backgroundColor: theme.bg },
                              selectedElement.binding === opt.value && styles.chipActive,
                            ]}
                          >
                            <Text
                              style={[
                                styles.chipText,
                                { color: theme.textSecondary },
                                selectedElement.binding === opt.value && styles.chipTextActive,
                              ]}
                            >
                              {opt.label}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </ScrollView>

                    {/* Direct Text Input */}
                    {selectedElement.binding === 'custom' && (
                      <TextInput
                        value={selectedElement.customText || ''}
                        onChangeText={(customText) => updateElementProps(selectedElement.id, { customText } as Partial<LabelTextElement>)}
                        style={[styles.input, { color: theme.textPrimary, borderColor: theme.borderColor, backgroundColor: theme.bg, marginTop: 6 }]}
                        placeholder="Enter custom text..."
                        placeholderTextColor="#94A3B8"
                      />
                    )}

                    {/* Font Styling Row */}
                    <View style={styles.stylingRow}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={[styles.fieldLabel, { color: theme.textSecondary, marginBottom: 0 }]}>Font Size:</Text>
                        <View style={styles.stepperMini}>
                          <TouchableOpacity
                            onPress={() => updateElementProps(selectedElement.id, { fontSizePt: Math.max(1, selectedElement.fontSizePt - 1) } as Partial<LabelTextElement>)}
                            style={[styles.stepMiniBtn, { backgroundColor: theme.bg, borderColor: theme.borderColor }]}
                          >
                            <Minus size={12} color={theme.textPrimary} />
                          </TouchableOpacity>
                          <Text style={[styles.stepMiniVal, { color: theme.textPrimary }]}>{selectedElement.fontSizePt} Pt</Text>
                          <TouchableOpacity
                            onPress={() => updateElementProps(selectedElement.id, { fontSizePt: Math.min(12, selectedElement.fontSizePt + 1) } as Partial<LabelTextElement>)}
                            style={[styles.stepMiniBtn, { backgroundColor: theme.bg, borderColor: theme.borderColor }]}
                          >
                            <Plus size={12} color={theme.textPrimary} />
                          </TouchableOpacity>
                        </View>
                      </View>

                      <TouchableOpacity
                        onPress={() => updateElementProps(selectedElement.id, { bold: !selectedElement.bold } as Partial<LabelTextElement>)}
                        style={[
                          styles.boldToggleBtn,
                          { borderColor: theme.borderColor, backgroundColor: theme.bg },
                          selectedElement.bold && styles.chipActive,
                        ]}
                      >
                        <Text style={[styles.chipText, { color: theme.textSecondary }, selectedElement.bold && styles.chipTextActive]}>
                          Bold
                        </Text>
                      </TouchableOpacity>

                      <View style={{ flexDirection: 'row', gap: 4 }}>
                        {(['left', 'center', 'right'] as const).map((a) => (
                          <TouchableOpacity
                            key={a}
                            onPress={() => updateElementProps(selectedElement.id, { align: a } as Partial<LabelTextElement>)}
                            style={[
                              styles.alignBtn,
                              { borderColor: theme.borderColor, backgroundColor: theme.bg },
                              selectedElement.align === a && styles.chipActive,
                            ]}
                          >
                            <Text style={[styles.chipText, { color: theme.textSecondary, textTransform: 'capitalize' }, selectedElement.align === a && styles.chipTextActive]}>
                              {a}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  </View>
                )}

                {/* BARCODE ELEMENT CONTROLS */}
                {selectedElement.type === 'barcode' && (
                  <View style={{ marginTop: 8 }}>
                    <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Bind Barcode To:</Text>
                    <View style={{ flexDirection: 'row', gap: 6, marginVertical: 4 }}>
                      {CODE_BINDING_OPTIONS.map((opt) => (
                        <TouchableOpacity
                          key={opt.value}
                          onPress={() => updateElementProps(selectedElement.id, { binding: opt.value } as Partial<LabelBarcodeElement>)}
                          style={[
                            styles.chip,
                            { borderColor: theme.borderColor, backgroundColor: theme.bg },
                            selectedElement.binding === opt.value && styles.chipActive,
                          ]}
                        >
                          <Text
                            style={[
                              styles.chipText,
                              { color: theme.textSecondary },
                              selectedElement.binding === opt.value && styles.chipTextActive,
                            ]}
                          >
                            {opt.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    {selectedElement.binding === 'custom' && (
                      <TextInput
                        value={selectedElement.customValue || ''}
                        onChangeText={(customValue) => updateElementProps(selectedElement.id, { customValue } as Partial<LabelBarcodeElement>)}
                        style={[styles.input, { color: theme.textPrimary, borderColor: theme.borderColor, backgroundColor: theme.bg, marginTop: 4 }]}
                        placeholder="Enter barcode numbers/text..."
                        placeholderTextColor="#94A3B8"
                      />
                    )}

                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 }}>
                      <Text style={[styles.fieldLabel, { color: theme.textSecondary, marginBottom: 0 }]}>Format:</Text>
                      {(['ean13', 'code128'] as const).map((f) => (
                        <TouchableOpacity
                          key={f}
                          onPress={() => updateElementProps(selectedElement.id, { format: f } as Partial<LabelBarcodeElement>)}
                          style={[
                            styles.chip,
                            { borderColor: theme.borderColor, backgroundColor: theme.bg },
                            selectedElement.format === f && styles.chipActive,
                          ]}
                        >
                          <Text style={[styles.chipText, { color: theme.textSecondary }, selectedElement.format === f && styles.chipTextActive]}>
                            {f.toUpperCase()}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}

                {/* QR CODE ELEMENT CONTROLS */}
                {selectedElement.type === 'qrcode' && (
                  <View style={{ marginTop: 8 }}>
                    <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Bind QR Code To:</Text>
                    <View style={{ flexDirection: 'row', gap: 6, marginVertical: 4 }}>
                      {CODE_BINDING_OPTIONS.map((opt) => (
                        <TouchableOpacity
                          key={opt.value}
                          onPress={() => updateElementProps(selectedElement.id, { binding: opt.value } as Partial<LabelQrElement>)}
                          style={[
                            styles.chip,
                            { borderColor: theme.borderColor, backgroundColor: theme.bg },
                            selectedElement.binding === opt.value && styles.chipActive,
                          ]}
                        >
                          <Text
                            style={[
                              styles.chipText,
                              { color: theme.textSecondary },
                              selectedElement.binding === opt.value && styles.chipTextActive,
                            ]}
                          >
                            {opt.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    {selectedElement.binding === 'custom' && (
                      <TextInput
                        value={selectedElement.customValue || ''}
                        onChangeText={(customValue) => updateElementProps(selectedElement.id, { customValue } as Partial<LabelQrElement>)}
                        style={[styles.input, { color: theme.textPrimary, borderColor: theme.borderColor, backgroundColor: theme.bg, marginTop: 4 }]}
                        placeholder="Enter QR content / URL / UPI ID..."
                        placeholderTextColor="#94A3B8"
                      />
                    )}
                  </View>
                )}

                {/* IMAGE / LOGO CONTROLS */}
                {selectedElement.type === 'image' && (
                  <View style={{ marginTop: 8 }}>
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      <TouchableOpacity
                        onPress={() => handlePickImageForElement(selectedElement.id)}
                        style={[styles.imageActionBtn, { backgroundColor: BRAND_COLORS.blue600 }]}
                      >
                        <ImageIcon size={13} color="#FFF" />
                        <Text style={styles.imageActionBtnText}>Replace Logo</Text>
                      </TouchableOpacity>

                      {selectedElement.uri ? (
                        <TouchableOpacity
                          onPress={() => {
                            if (selectedElement.uri) {
                              openLogoBgOption(selectedElement.uri, (finalUri) => {
                                updateElementProps(selectedElement.id, { uri: finalUri } as Partial<LabelImageElement>);
                              });
                            }
                          }}
                          style={[styles.imageActionBtn, { backgroundColor: '#D97706' }]}
                        >
                          <Sparkles size={13} color="#FFF" />
                          <Text style={styles.imageActionBtnText}>Remove BG</Text>
                        </TouchableOpacity>
                      ) : null}

                      <TouchableOpacity
                        onPress={() => updateElementProps(selectedElement.id, { invert: !selectedElement.invert } as Partial<LabelImageElement>)}
                        style={[
                          styles.imageActionBtn,
                          {
                            backgroundColor: selectedElement.invert ? BRAND_COLORS.navyInk : theme.bg,
                            borderWidth: 1,
                            borderColor: theme.borderColor,
                          },
                        ]}
                      >
                        <Text style={[styles.imageActionBtnText, { color: selectedElement.invert ? '#FFF' : theme.textPrimary }]}>
                          Invert: {selectedElement.invert ? 'ON' : 'OFF'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                {/* PRECISION ELEMENT SIZE & POSITION STEPPERS */}
                <View style={{ marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: 'rgba(100,116,139,0.15)' }}>
                  <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Element Size (Width × Height mm):</Text>
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 10, fontWeight: '700', color: theme.textSecondary, marginBottom: 2 }}>Width</Text>
                      <View style={[styles.stepperBox, { borderColor: theme.borderColor, backgroundColor: theme.bg }]}>
                        <TouchableOpacity
                          onPress={() => updateElementProps(selectedElement.id, { widthMm: Math.max(2, Math.round(selectedElement.widthMm) - 1) })}
                          style={styles.stepBoxBtn}
                        >
                          <Minus size={12} color={theme.textPrimary} />
                        </TouchableOpacity>
                        <Text style={[styles.stepBoxVal, { fontSize: 11, color: theme.textPrimary }]}>{Math.round(selectedElement.widthMm)} mm</Text>
                        <TouchableOpacity
                          onPress={() => updateElementProps(selectedElement.id, { widthMm: Math.min(template.widthMm - selectedElement.xMm, Math.round(selectedElement.widthMm) + 1) })}
                          style={styles.stepBoxBtn}
                        >
                          <Plus size={12} color={theme.textPrimary} />
                        </TouchableOpacity>
                      </View>
                    </View>

                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 10, fontWeight: '700', color: theme.textSecondary, marginBottom: 2 }}>Height</Text>
                      <View style={[styles.stepperBox, { borderColor: theme.borderColor, backgroundColor: theme.bg }]}>
                        <TouchableOpacity
                          onPress={() => updateElementProps(selectedElement.id, { heightMm: Math.max(2, Math.round(selectedElement.heightMm) - 1) })}
                          style={styles.stepBoxBtn}
                        >
                          <Minus size={12} color={theme.textPrimary} />
                        </TouchableOpacity>
                        <Text style={[styles.stepBoxVal, { fontSize: 11, color: theme.textPrimary }]}>{Math.round(selectedElement.heightMm)} mm</Text>
                        <TouchableOpacity
                          onPress={() => updateElementProps(selectedElement.id, { heightMm: Math.min(template.heightMm - selectedElement.yMm, Math.round(selectedElement.heightMm) + 1) })}
                          style={styles.stepBoxBtn}
                        >
                          <Plus size={12} color={theme.textPrimary} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>

                  {/* QUICK ALIGNMENT CONTROLS */}
                  <View style={{ marginTop: 8 }}>
                    <Text style={{ fontSize: 10, fontWeight: '700', color: theme.textSecondary, marginBottom: 4 }}>Align Element:</Text>
                    <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                      <TouchableOpacity
                        onPress={() => updateElementProps(selectedElement.id, { xMm: Math.max(0, Math.round((template.widthMm - selectedElement.widthMm) / 2)) })}
                        style={[styles.chip, { borderColor: theme.borderColor, backgroundColor: theme.bg, paddingVertical: 4, paddingHorizontal: 8 }]}
                      >
                        <Text style={[styles.chipText, { color: theme.textPrimary, fontSize: 10 }]}>Center X</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => updateElementProps(selectedElement.id, { yMm: Math.max(0, Math.round((template.heightMm - selectedElement.heightMm) / 2)) })}
                        style={[styles.chip, { borderColor: theme.borderColor, backgroundColor: theme.bg, paddingVertical: 4, paddingHorizontal: 8 }]}
                      >
                        <Text style={[styles.chipText, { color: theme.textPrimary, fontSize: 10 }]}>Center Y</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => updateElementProps(selectedElement.id, { yMm: 0 })}
                        style={[styles.chip, { borderColor: theme.borderColor, backgroundColor: theme.bg, paddingVertical: 4, paddingHorizontal: 8 }]}
                      >
                        <Text style={[styles.chipText, { color: theme.textPrimary, fontSize: 10 }]}>Align Top (Y:0)</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => updateElementProps(selectedElement.id, { xMm: 0 })}
                        style={[styles.chip, { borderColor: theme.borderColor, backgroundColor: theme.bg, paddingVertical: 4, paddingHorizontal: 8 }]}
                      >
                        <Text style={[styles.chipText, { color: theme.textPrimary, fontSize: 10 }]}>Align Left (X:0)</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Quick Scale Presets for Image */}
                  {selectedElement.type === 'image' && (
                    <View style={{ marginTop: 8 }}>
                      <Text style={{ fontSize: 10, fontWeight: '700', color: theme.textSecondary, marginBottom: 4 }}>Quick Logo Size Presets:</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        <View style={{ flexDirection: 'row', gap: 6 }}>
                          {[8, 12, 16, 20, 25, 30].map((sz) => {
                            const active = Math.round(selectedElement.widthMm) === sz && Math.round(selectedElement.heightMm) === sz;
                            return (
                              <TouchableOpacity
                                key={sz}
                                onPress={() => updateElementProps(selectedElement.id, { widthMm: sz, heightMm: sz })}
                                style={[
                                  styles.chip,
                                  { borderColor: theme.borderColor, backgroundColor: theme.bg, paddingVertical: 4, paddingHorizontal: 8 },
                                  active && styles.chipActive,
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.chipText,
                                    { color: theme.textSecondary, fontSize: 10 },
                                    active && styles.chipTextActive,
                                  ]}
                                >
                                  {sz}×{sz}mm
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      </ScrollView>
                    </View>
                  )}
                </View>
              </View>
            ) : (
              <View style={[styles.inspectorCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Info size={16} color={BRAND_COLORS.blue600} />
                  <Text style={{ fontSize: 12, color: theme.textSecondary, flex: 1 }}>
                    Tap any item on the label above to edit its text, size, binding, or delete it.
                  </Text>
                </View>
              </View>
            )}

            {/* LABEL SIZE PRESETS & DIMENSIONS SECTION */}
            <View style={[styles.sectionCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
              <Text style={[styles.sectionCardTitle, { color: theme.textPrimary }]}>
                Label Dimensions (Paper Stock)
              </Text>

              {/* Presets Horizontal Strip */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 6 }}>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  {LABEL_SIZE_PRESETS.map((preset) => {
                    const isSelected = template.widthMm === preset.widthMm && template.heightMm === preset.heightMm;
                    return (
                      <TouchableOpacity
                        key={preset.label}
                        onPress={() => setTemplate((p) => applyLabelSize(p, preset.widthMm, preset.heightMm))}
                        style={[
                          styles.presetChip,
                          { borderColor: theme.borderColor, backgroundColor: theme.bg },
                          isSelected && styles.presetChipActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.presetChipText,
                            { color: theme.textSecondary },
                            isSelected && styles.presetChipTextActive,
                          ]}
                        >
                          {preset.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>

              {/* Custom Width / Height Stepper Controls */}
              <View style={{ flexDirection: 'row', gap: 12, marginTop: 4 }}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.dimLabel, { color: theme.textSecondary }]}>Width (mm)</Text>
                  <View style={[styles.stepperBox, { borderColor: theme.borderColor, backgroundColor: theme.bg }]}>
                    <TouchableOpacity
                      onPress={() => setTemplate((p) => applyLabelSize(p, Math.max(10, p.widthMm - 1), p.heightMm))}
                      style={styles.stepBoxBtn}
                    >
                      <Minus size={14} color={theme.textPrimary} />
                    </TouchableOpacity>
                    <Text style={[styles.stepBoxVal, { color: theme.textPrimary }]}>{template.widthMm}</Text>
                    <TouchableOpacity
                      onPress={() => setTemplate((p) => applyLabelSize(p, Math.min(100, p.widthMm + 1), p.heightMm))}
                      style={styles.stepBoxBtn}
                    >
                      <Plus size={14} color={theme.textPrimary} />
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={[styles.dimLabel, { color: theme.textSecondary }]}>Height (mm)</Text>
                  <View style={[styles.stepperBox, { borderColor: theme.borderColor, backgroundColor: theme.bg }]}>
                    <TouchableOpacity
                      onPress={() => setTemplate((p) => applyLabelSize(p, p.widthMm, Math.max(10, p.heightMm - 1)))}
                      style={styles.stepBoxBtn}
                    >
                      <Minus size={14} color={theme.textPrimary} />
                    </TouchableOpacity>
                    <Text style={[styles.stepBoxVal, { color: theme.textPrimary }]}>{template.heightMm}</Text>
                    <TouchableOpacity
                      onPress={() => setTemplate((p) => applyLabelSize(p, p.widthMm, Math.min(150, p.heightMm + 1)))}
                      style={styles.stepBoxBtn}
                    >
                      <Plus size={14} color={theme.textPrimary} />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </View>

            {/* LIVE PRODUCT PREVIEW SELECTOR */}
            <View style={[styles.sectionCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <Text style={[styles.sectionCardTitle, { color: theme.textPrimary }]}>
                  Test Product Preview
                </Text>
                <TouchableOpacity onPress={() => setShowProductPicker(true)}>
                  <Text style={{ fontSize: 11, fontWeight: '800', color: BRAND_COLORS.blue600 }}>Change Product</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                onPress={() => setShowProductPicker(true)}
                style={[styles.productPreviewCard, { backgroundColor: theme.bg, borderColor: theme.borderColor }]}
              >
                <Package size={18} color={BRAND_COLORS.blue600} />
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={[styles.productPreviewName, { color: theme.textPrimary }]} numberOfLines={1}>
                    {previewProduct ? previewProduct.name : 'Select a Product for Live Data'}
                  </Text>
                  {previewProduct && (
                    <Text style={{ fontSize: 11, color: theme.textSecondary, marginTop: 1 }}>
                      Rs.{previewProduct.sellingPrice.toFixed(2)} • {previewProduct.barcode || previewProduct.sku || 'No Barcode'}
                    </Text>
                  )}
                </View>
              </TouchableOpacity>
            </View>

            {/* PRINT QUANTITY CARD */}
            <View style={[styles.sectionCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <Text style={[styles.sectionCardTitle, { color: theme.textPrimary, marginBottom: 0 }]}>
                  Print Quantity
                </Text>
                <View style={styles.lsQtyBadge}>
                  <Text style={styles.lsQtyBadgeText}>{printCopies} {printCopies === 1 ? 'Copy' : 'Copies'}</Text>
                </View>
              </View>

              <View style={styles.lsQtyRow}>
                <TouchableOpacity
                  onPress={() => setPrintCopies((c) => Math.max(1, c - 1))}
                  disabled={printCopies <= 1}
                  style={[
                    styles.lsQtyStepperBtn,
                    {
                      borderColor: theme.borderColor,
                      backgroundColor: printCopies <= 1 ? theme.bg : BRAND_COLORS.blue600,
                    },
                  ]}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Minus size={18} color={printCopies <= 1 ? theme.textSecondary : '#FFFFFF'} />
                </TouchableOpacity>

                <View style={[styles.lsQtyValueBox, { backgroundColor: theme.bg, borderColor: theme.borderColor }]}>
                  <Text style={[styles.lsQtyValueText, { color: theme.textPrimary }]}>{printCopies}</Text>
                  <Text style={[styles.lsQtyUnitText, { color: theme.textSecondary }]}>labels</Text>
                </View>

                <TouchableOpacity
                  onPress={() => setPrintCopies((c) => Math.min(100, c + 1))}
                  disabled={printCopies >= 100}
                  style={[
                    styles.lsQtyStepperBtn,
                    { borderColor: theme.borderColor, backgroundColor: BRAND_COLORS.blue600 },
                  ]}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Plus size={18} color="#FFFFFF" />
                </TouchableOpacity>
              </View>

              {/* Quick Preset Chips */}
              <View style={styles.lsQtyChipsRow}>
                {[1, 2, 5, 10, 25, 50].map((count) => {
                  const isSelected = printCopies === count;
                  return (
                    <TouchableOpacity
                      key={count}
                      onPress={() => setPrintCopies(count)}
                      style={[
                        styles.lsQtyChip,
                        {
                          borderColor: isSelected ? BRAND_COLORS.blue600 : theme.borderColor,
                          backgroundColor: isSelected ? BRAND_COLORS.blue600 : theme.bg,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.lsQtyChipText,
                          {
                            color: isSelected ? '#FFFFFF' : theme.textSecondary,
                            fontWeight: isSelected ? '800' : '600',
                          },
                        ]}
                      >
                        {count}x
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* CONNECTED PRINTER GUIDANCE & STATUS BANNER */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'flex-start',
                padding: 11,
                borderRadius: 12,
                borderWidth: 1,
                marginTop: 10,
                marginBottom: 8,
                backgroundColor: labelPrinter.isConnected
                  ? isDev2in1
                    ? theme.isDark ? 'rgba(37, 99, 235, 0.12)' : '#EFF6FF'
                    : labelPrinter.kind === 'label'
                    ? theme.isDark ? 'rgba(99, 102, 241, 0.12)' : '#EEF2FF'
                    : theme.isDark ? 'rgba(245, 158, 11, 0.12)' : '#FEF3C7'
                  : theme.isDark ? 'rgba(239, 68, 68, 0.12)' : '#FEE2E2',
                borderColor: labelPrinter.isConnected
                  ? isDev2in1
                    ? theme.isDark ? 'rgba(37, 99, 235, 0.25)' : '#BFDBFE'
                    : labelPrinter.kind === 'label'
                    ? theme.isDark ? 'rgba(99, 102, 241, 0.25)' : '#C7D2FE'
                    : theme.isDark ? 'rgba(245, 158, 11, 0.28)' : '#FDE68A'
                  : theme.isDark ? 'rgba(239, 68, 68, 0.25)' : '#FECACA',
              }}
            >
              {labelPrinter.isConnected ? (
                isDev2in1 ? (
                  <Sparkles size={16} color="#2563EB" style={{ marginTop: 2, marginRight: 8 }} />
                ) : labelPrinter.kind === 'label' ? (
                  <Sparkles size={16} color="#6366F1" style={{ marginTop: 2, marginRight: 8 }} />
                ) : (
                  <AlertTriangle size={16} color="#D97706" style={{ marginTop: 2, marginRight: 8 }} />
                )
              ) : (
                <Printer size={16} color="#EF4444" style={{ marginTop: 2, marginRight: 8 }} />
              )}
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: '800',
                    color: labelPrinter.isConnected
                      ? isDev2in1
                        ? theme.isDark ? '#93C5FD' : '#1D4ED8'
                        : labelPrinter.kind === 'label'
                        ? theme.isDark ? '#A5B4FC' : '#4F46E5'
                        : theme.isDark ? '#FDE68A' : '#92400E'
                      : theme.isDark ? '#FCA5A5' : '#991B1B',
                    marginBottom: 2,
                  }}
                >
                  {labelPrinter.isConnected
                    ? isDev2in1
                      ? `Other 2-in-1 POS & Label Printer (${labelPrinter.name})`
                      : labelPrinter.kind === 'label'
                      ? `SEZNIK JOSH Dual-Mode Smart Printer (${labelPrinter.name})`
                      : `Receipt Printer Connected (${labelPrinter.name})`
                    : 'No Printer Connected'}
                </Text>
                <Text
                  style={{
                    fontSize: 11,
                    lineHeight: 15,
                    color: labelPrinter.isConnected
                      ? isDev2in1
                        ? theme.isDark ? '#BFDBFE' : '#1E40AF'
                        : labelPrinter.kind === 'label'
                        ? theme.isDark ? '#C7D2FE' : '#4338CA'
                        : theme.isDark ? '#FCD34D' : '#B45309'
                      : theme.isDark ? '#FECACA' : '#B91C1C',
                  }}
                >
                  {labelPrinter.isConnected
                    ? isDev2in1
                      ? 'Connected in 2-in-1 Mode. Calibrated with hardware gap sensing for die-cut sticker rolls.'
                      : labelPrinter.kind === 'label'
                      ? 'Connected in Dual-Mode. Prints on adhesive sticker label stock.'
                      : 'This printer uses continuous receipt roll, not adhesive sticker labels. The label will print on receipt paper. For adhesive stickers, connect a Josh or DEV 2-in-1 printer.'
                    : 'Connect a thermal receipt printer or 2-in-1 Label printer to print labels.'}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowConnectModal(true)}
                style={{
                  paddingVertical: 5,
                  paddingHorizontal: 8,
                  borderRadius: 8,
                  backgroundColor: BRAND_COLORS.blue600,
                  marginLeft: 8,
                  alignSelf: 'center',
                }}
                activeOpacity={0.8}
              >
                <Text style={{ fontSize: 10, fontWeight: '800', color: '#FFF' }}>
                  {labelPrinter.isConnected ? 'Switch' : 'Search'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* PRINTING & SEQUENCE ACTIONS */}
            <View style={{ gap: 8, marginTop: 4 }}>
              <TouchableOpacity
                onPress={handleTestPrint}
                disabled={isTestPrinting}
                style={[styles.actionPrintBtn, { backgroundColor: BRAND_COLORS.blue600 }]}
              >
                {isTestPrinting ? (
                  <ActivityIndicator size="small" color="#FFF" style={{ marginRight: 8 }} />
                ) : (
                  <BarcodeIcon size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                )}
                <Text style={styles.actionPrintBtnText}>Print {printCopies} Label{printCopies > 1 ? 's' : ''} 🖨️</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleRunAlignmentSelfTest}
                disabled={isTestPrinting}
                style={[
                  styles.actionPrintBtn,
                  {
                    backgroundColor: theme.isDark ? 'rgba(99, 102, 241, 0.12)' : '#EEF2FF',
                    borderWidth: 1.5,
                    borderColor: '#6366F1',
                  },
                ]}
              >
                <Layers size={18} color="#6366F1" style={{ marginRight: 8 }} />
                <Text style={[styles.actionPrintBtnText, { color: '#6366F1' }]}>
                  Print Alignment Self-Test (3 Labels) 📐
                </Text>
              </TouchableOpacity>

              {hasSequenceElement && (
                <TouchableOpacity
                  onPress={handleOpenSequencePrompt}
                  style={[styles.actionPrintBtn, { backgroundColor: BRAND_COLORS.navyInk }]}
                >
                  <Hash size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                  <Text style={styles.actionPrintBtnText}>Run Sequential Number Printing (0001, 0002...)</Text>
                </TouchableOpacity>
              )}
            </View>
          </ScrollView>
        </KeyboardAvoidingWrapper>
      </SafeAreaView>

      {/* SAVED TEMPLATES MODAL */}
      <Modal visible={showSavedTemplatesModal} animationType="slide" onRequestClose={() => setShowSavedTemplatesModal(false)}>
        <SafeAreaView style={[styles.modalSafeArea, { backgroundColor: theme.bg }]}>
          <View style={{ flex: 1, padding: 16 }}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>Saved Label Templates</Text>
              <TouchableOpacity onPress={() => setShowSavedTemplatesModal(false)}>
                <X size={22} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            {labelTemplates.length === 0 ? (
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                <FolderOpen size={36} color={theme.textSecondary} />
                <Text style={{ fontSize: 13, color: theme.textSecondary, marginTop: 8 }}>
                  No saved templates yet. Design one and tap Save.
                </Text>
              </View>
            ) : (
              <FlatList
                data={labelTemplates}
                keyExtractor={(item) => item.id}
                renderItem={({ item: t }) => {
                  const isCurrent = t.id === template.id;
                  const isDefault = t.id === activeLabelTemplateId;
                  return (
                    <View style={[styles.templateListRow, { backgroundColor: theme.cardBg, borderColor: isCurrent ? BRAND_COLORS.blue600 : theme.borderColor }]}>
                      <TouchableOpacity
                        style={{ flex: 1 }}
                        onPress={() => {
                          setTemplate(t);
                          setSelectedId(t.elements[0]?.id || null);
                          setShowSavedTemplatesModal(false);
                        }}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={[styles.templateListName, { color: theme.textPrimary }]} numberOfLines={1}>
                            {t.name}
                          </Text>
                          {isDefault && (
                            <View style={styles.defaultPill}>
                              <Text style={styles.defaultPillText}>DEFAULT</Text>
                            </View>
                          )}
                          {isCurrent && (
                            <View style={styles.activePill}>
                              <Text style={styles.activePillText}>OPEN</Text>
                            </View>
                          )}
                        </View>
                        <Text style={{ fontSize: 11, color: theme.textSecondary, marginTop: 2 }}>
                          {t.widthMm}mm × {t.heightMm}mm • {t.elements.length} elements
                        </Text>
                      </TouchableOpacity>

                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        {!isDefault && (
                          <TouchableOpacity
                            onPress={async () => {
                              await setActiveLabelTemplate(t.id);
                              Alert.alert('Default Updated!', `"${t.name}" is now default.`);
                            }}
                            style={[styles.setDefSmallBtn, { borderColor: theme.borderColor }]}
                          >
                            <Star size={12} color="#D97706" />
                            <Text style={{ fontSize: 10, fontWeight: '700', color: '#D97706', marginLeft: 2 }}>Default</Text>
                          </TouchableOpacity>
                        )}

                        <TouchableOpacity
                          onPress={() =>
                            Alert.alert('Delete Template', `Delete "${t.name}"?`, [
                              { text: 'Cancel', style: 'cancel' },
                              {
                                text: 'Delete',
                                style: 'destructive',
                                onPress: async () => {
                                  await deleteLabelTemplate(t.id);
                                },
                              },
                            ])
                          }
                          style={{ padding: 6 }}
                        >
                          <Trash2 size={16} color="#EF4444" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                }}
              />
            )}

            <TouchableOpacity
              onPress={() => {
                const blank = makeBlankTemplate(labelWidthMm, labelHeightMm);
                setTemplate(blank);
                setSelectedId(blank.elements[0]?.id || null);
                setShowSavedTemplatesModal(false);
              }}
              style={[styles.newTemplateModalBtn, { backgroundColor: BRAND_COLORS.navyInk }]}
            >
              <Plus size={16} color="#FFF" style={{ marginRight: 6 }} />
              <Text style={styles.newTemplateModalBtnText}>Create New Blank Label</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>

      {/* PRODUCT PICKER MODAL */}
      <Modal visible={showProductPicker} animationType="slide" onRequestClose={() => setShowProductPicker(false)}>
        <SafeAreaView style={[styles.modalSafeArea, { backgroundColor: theme.bg }]}>
          <View style={{ flex: 1, padding: 16 }}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>Choose a Test Product</Text>
              <TouchableOpacity onPress={() => setShowProductPicker(false)}>
                <X size={22} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={[styles.searchBox, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
              <Search size={16} color={theme.textSecondary} />
              <TextInput
                style={[styles.searchInput, { color: theme.textPrimary }]}
                placeholder="Search products..."
                placeholderTextColor="#94A3B8"
                value={productSearch}
                onChangeText={setProductSearch}
              />
            </View>

            <FlatList
              data={filteredProducts}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => {
                    setPreviewProduct(item);
                    setShowProductPicker(false);
                  }}
                  style={[styles.productListItem, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.productListName, { color: theme.textPrimary }]}>{item.name}</Text>
                    <Text style={{ fontSize: 11, color: theme.textSecondary }}>
                      Rs.{item.sellingPrice.toFixed(2)} • {item.barcode || item.sku || 'No Barcode'}
                    </Text>
                  </View>
                  {previewProduct?.id === item.id && <Check size={18} color={BRAND_COLORS.blue600} />}
                </TouchableOpacity>
              )}
            />
          </View>
        </SafeAreaView>
      </Modal>

      {/* AI RECEIPT/BILL MODAL */}
      <AiBillToReceiptModal
        visible={showAiBillModal}
        onClose={() => setShowAiBillModal(false)}
      />

      {/* SEQUENTIAL PRINT PROMPT */}
      <SequencePrintPrompt
        visible={showSequencePrompt}
        onCancel={() => setShowSequencePrompt(false)}
        onSubmit={handleSubmitSequence}
        isPrinting={isSeqPrinting}
        progress={seqProgress}
      />

      {/* LOGO BG MODAL */}
      {logoBgModalUri ? (
        <LogoBackgroundModal
          visible={!!logoBgModalUri}
          onCancel={() => setLogoBgModalUri(null)}
          imageUri={logoBgModalUri}
          onApply={(finalUri: string) => {
            if (selectedElement && selectedElement.type === 'image') {
              updateElementProps(selectedElement.id, { uri: finalUri } as Partial<LabelImageElement>);
            }
            setLogoBgModalUri(null);
          }}
        />
      ) : null}

      <JoshDualModeModal
        visible={showTipModal}
        onDismiss={() => {
          setShowTipModal(false);
          markTipShown();
        }}
        onDontShowAgain={() => {
          setShowTipModal(false);
          dismissPermanently();
        }}
      />

      <DirectPrinterConnectModal
        visible={showConnectModal}
        onClose={() => setShowConnectModal(false)}
      />
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, gap: 6 },
  studioControlBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    marginBottom: 8,
    gap: 8,
  },
  printerConnectBarBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  printerBarBtnText: {
    fontSize: 11,
    fontWeight: '700',
    flex: 1,
  },
  searchPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  searchPillText: {
    color: '#FFFFFF',
    fontSize: 9.5,
    fontWeight: '800',
  },
  paperModeToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 3,
    borderRadius: 10,
    borderWidth: 1,
    gap: 3,
  },
  paperModeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 7,
  },
  paperModeChipActive: {
    backgroundColor: BRAND_COLORS.blue600,
  },
  paperModeChipText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#64748B',
  },
  paperModeChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  backBtn: { padding: 8, borderRadius: 10 },
  nameInput: { flex: 1, height: 38, borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, fontSize: 13, fontWeight: '700' },
  headerIconBtn: { padding: 9, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  aiBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 9, borderRadius: 10 },
  aiBtnText: { color: '#FFFFFF', fontWeight: '900', fontSize: 11, marginLeft: 3 },
  saveBtn: { padding: 9, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  defaultStatusBanner: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, gap: 6 },
  defaultStatusText: { fontSize: 11, fontWeight: '800', color: '#10B981' },
  setDefaultBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1 },
  setDefaultBtnText: { fontSize: 12, fontWeight: '800', color: '#B45309' },
  mainScroll: { flex: 1 },
  mainScrollContent: { paddingHorizontal: 12, paddingBottom: 60 },
  canvasCard: { borderRadius: 16, padding: 12, borderWidth: 1, marginBottom: 10 },
  canvasHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  canvasBadge: { fontSize: 11, fontWeight: '900', letterSpacing: 0.5 },
  zoomControlGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  zoomBtn: {
    width: 26,
    height: 26,
    borderRadius: 7,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomIndicator: {
    paddingHorizontal: 7,
    height: 26,
    borderRadius: 7,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomIndicatorText: {
    fontSize: 10.5,
    fontWeight: '800',
  },
  canvasCenterWrapper: { flexGrow: 1, alignItems: 'center', justifyContent: 'center' },
  canvas: {
    borderWidth: 1.5,
    borderColor: '#94A3B8',
    borderStyle: 'dashed',
    borderRadius: 6,
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  quickAddBar: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: 6, marginTop: 12 },
  quickAddBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, gap: 4 },
  quickAddText: { fontSize: 11, fontWeight: '800' },
  inspectorCard: { borderRadius: 16, padding: 12, borderWidth: 1.5, marginBottom: 10 },
  inspectorHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: 'rgba(100,116,139,0.15)' },
  typeBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  typeBadgeText: { color: '#FFF', fontSize: 9, fontWeight: '900' },
  deleteElementBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#EF4444', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  deleteElementBtnText: { color: '#FFF', fontSize: 11, fontWeight: '800' },
  fieldLabel: { fontSize: 10.5, fontWeight: '800', marginBottom: 3 },
  chip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1 },
  chipActive: { backgroundColor: BRAND_COLORS.blue600, borderColor: BRAND_COLORS.blue600 },
  chipText: { fontSize: 11, fontWeight: '700' },
  chipTextActive: { color: '#FFFFFF', fontWeight: '900' },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 6, fontSize: 12 },
  stylingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  stepperMini: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  stepMiniBtn: { width: 24, height: 24, borderRadius: 6, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  stepMiniVal: { fontSize: 12, fontWeight: '900', minWidth: 16, textAlign: 'center' },
  boldToggleBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, borderWidth: 1 },
  alignBtn: { paddingHorizontal: 8, paddingVertical: 5, borderRadius: 6, borderWidth: 1 },
  imageActionBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, gap: 4 },
  imageActionBtnText: { color: '#FFF', fontSize: 11, fontWeight: '800' },
  sectionCard: { borderRadius: 16, padding: 12, borderWidth: 1, marginBottom: 10 },
  sectionCardTitle: { fontSize: 12, fontWeight: '900', marginBottom: 2 },
  presetChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
  presetChipActive: { backgroundColor: BRAND_COLORS.navyInk, borderColor: BRAND_COLORS.navyInk },
  presetChipText: { fontSize: 11, fontWeight: '700' },
  presetChipTextActive: { color: '#FFFFFF', fontWeight: '900' },
  dimLabel: { fontSize: 10.5, fontWeight: '800', marginBottom: 4 },
  stepperBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderRadius: 10, padding: 4 },
  stepBoxBtn: { padding: 6, borderRadius: 6 },
  stepBoxVal: { fontSize: 13, fontWeight: '900' },
  productPreviewCard: { flexDirection: 'row', alignItems: 'center', padding: 10, borderRadius: 10, borderWidth: 1, marginTop: 4 },
  productPreviewName: { fontSize: 12, fontWeight: '800' },
  actionPrintBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 14 },
  actionPrintBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
  modalSafeArea: { flex: 1 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  modalTitle: { fontSize: 18, fontWeight: '900' },
  searchBox: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, marginBottom: 10 },
  searchInput: { flex: 1, fontSize: 13, marginLeft: 6 },
  productListItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, borderRadius: 10, borderWidth: 1, marginBottom: 6 },
  productListName: { fontSize: 13, fontWeight: '700' },
  templateListRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, borderRadius: 12, borderWidth: 1, marginBottom: 8 },
  templateListName: { fontSize: 13, fontWeight: '800' },
  defaultPill: { backgroundColor: 'rgba(16, 185, 129, 0.15)', paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4 },
  defaultPillText: { fontSize: 9, fontWeight: '900', color: '#10B981' },
  activePill: { backgroundColor: 'rgba(37, 99, 235, 0.15)', paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4 },
  activePillText: { fontSize: 9, fontWeight: '900', color: BRAND_COLORS.blue600 },
  setDefSmallBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, paddingVertical: 4, borderRadius: 6, borderWidth: 1 },
  newTemplateModalBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 12, marginTop: 10 },
  newTemplateModalBtnText: { color: '#FFF', fontSize: 13, fontWeight: '900' },
  unsupportedBox: { padding: 4, backgroundColor: '#FEE2E2', borderRadius: 4 },
  unsupportedText: { fontSize: 8, color: '#DC2626', fontWeight: 'bold' },
  lsQtyBadge: { backgroundColor: BRAND_COLORS.blue600, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  lsQtyBadgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900' },
  lsQtyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, marginVertical: 4 },
  lsQtyStepperBtn: { width: 42, height: 42, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  lsQtyValueBox: { minWidth: 80, height: 42, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 4, paddingHorizontal: 12 },
  lsQtyValueText: { fontSize: 18, fontWeight: '900' },
  lsQtyUnitText: { fontSize: 11, fontWeight: '600', marginTop: 3 },
  lsQtyChipsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, gap: 6 },
  lsQtyChip: { flex: 1, paddingVertical: 6, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  lsQtyChipText: { fontSize: 11 },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    marginHorizontal: 12,
    marginBottom: 8,
  },
  warningBannerTitle: {
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 2,
  },
  warningBannerText: {
    fontSize: 11,
    lineHeight: 15,
  },
  dualModeCallout: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    marginHorizontal: 12,
    marginBottom: 8,
  },
  dualModeCalloutText: {
    fontSize: 11.5,
    fontWeight: '700',
  },
});
