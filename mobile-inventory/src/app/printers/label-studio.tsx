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
  ChevronLeft,
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
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { useRouter, useLocalSearchParams } from 'expo-router';
import QRCodeSVG from 'react-native-qrcode-svg';
import { useAppTheme } from '@/hooks/useAppTheme';
import { ScreenBackground } from '@/components/ui/ScreenBackground';
import { BarcodeView } from '@/components/ui/barcode-view';
import { DraggableElement, ElementBox } from '@/components/label-studio/DraggableElement';
import { usePrinterStore } from '@/store/usePrinterStore';
import { useProducts } from '@/hooks/useProducts';
import { Product } from '@/types/product';
import { BRAND_COLORS } from '@/constants/theme';
import ThermalPrinterService from '@/services/PrinterService';
import { AiBillToReceiptModal } from '@/components/printers/AiBillToReceiptModal';
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
    name: 'New Label',
    widthMm,
    heightMm,
    orientation: widthMm >= heightMm ? 'landscape' : 'portrait',
    elements: [
      { id: newId(), type: 'text', binding: 'productName', xMm: 4, yMm: 3, widthMm: widthMm - 8, heightMm: 6, fontSizePt: 3, align: 'center' },
      { id: newId(), type: 'text', binding: 'price', xMm: 4, yMm: 10, widthMm: widthMm - 8, heightMm: 5, fontSizePt: 3, bold: true, align: 'center' },
      { id: newId(), type: 'barcode', format: 'ean13', binding: 'barcode', xMm: 6, yMm: 17, widthMm: widthMm - 12, heightMm: heightMm - 20 },
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
    paperWidth,
  } = usePrinterStore();

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
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [showSavedTemplatesModal, setShowSavedTemplatesModal] = useState(false);
  const [showAiBillModal, setShowAiBillModal] = useState(false);

  // Double-tap direct text editing
  const [doubleTapTextEditId, setDoubleTapTextEditId] = useState<string | null>(null);
  const [doubleTapTextDraft, setDoubleTapTextDraft] = useState('');

  const handleDoubleTapElement = (el: LabelElement) => {
    setSelectedId(el.id);
    if (el.type === 'text') {
      const currentVal = el.customText || (previewProduct ? resolveTextValue(el, previewProduct) : '');
      setDoubleTapTextDraft(currentVal);
      setDoubleTapTextEditId(el.id);
    }
  };

  const handleSaveDoubleTapText = () => {
    if (doubleTapTextEditId) {
      updateElementProps(doubleTapTextEditId, {
        binding: 'custom',
        customText: doubleTapTextDraft,
      } as Partial<LabelTextElement>);
      setDoubleTapTextEditId(null);
    }
  };

  const hasSequenceElement = template.elements.some((e) => e.type === 'text' && e.binding === 'sequence');
  const [showSequencePrompt, setShowSequencePrompt] = useState(false);
  const [isSeqPrinting, setIsSeqPrinting] = useState(false);
  const [, setSeqProgress] = useState(0);

  const maxAvailableCanvasWidth = windowWidth - 32;
  const pxPerMm = useMemo(() => {
    return Math.max(4, Math.min(8, Math.floor(maxAvailableCanvasWidth / template.widthMm)));
  }, [maxAvailableCanvasWidth, template.widthMm]);

  const canvasWidthPx = template.widthMm * pxPerMm;
  const canvasOverflowsScreen = canvasWidthPx > maxAvailableCanvasWidth;

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

    setIsTestPrinting(true);
    try {
      const ok =
        labelPaperMode === 'continuous'
          ? await ThermalPrinterService.printLabelTemplateOnReceiptPaper(targetProduct, template, paperWidth)
          : await ThermalPrinterService.printLabelFromTemplate(targetProduct, template, 1, labelGapMm);
      if (ok) Alert.alert('Test Print Sent!', `Printed test label for "${targetProduct.name}".`);
      else Alert.alert('Print Failed', 'Could not send label to printer. Make sure printer is connected.');
    } catch (e: any) {
      Alert.alert('Print Failed', e?.message || 'Could not print this template.');
    } finally {
      setIsTestPrinting(false);
    }
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
          {/* 1. Header Bar: Chevron Back, Centered Title, Right Tool Icons */}
          <View style={[styles.refHeaderBar, { borderBottomColor: theme.borderColor }]}>
            <TouchableOpacity onPress={() => router.back()} style={styles.refBackBtn}>
              <ChevronLeft size={28} color={BRAND_COLORS.blue600} />
            </TouchableOpacity>

            <View style={styles.refHeaderCenter}>
              <Text style={[styles.refHeaderTitle, { color: theme.textPrimary }]}>
                Label Studio Editor
              </Text>
            </View>

            <View style={styles.refHeaderRight}>
              <TouchableOpacity
                onPress={() => setShowSavedTemplatesModal(true)}
                style={[styles.headerMiniIconBtn, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}
              >
                <FolderOpen size={16} color={theme.textSecondary} />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setShowAiBillModal(true)}
                style={[styles.headerMiniAiBtn, { backgroundColor: BRAND_COLORS.blue600 }]}
              >
                <Sparkles size={13} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Main Unified Scrolling Content */}
          <ScrollView
            style={styles.mainScroll}
            contentContainerStyle={styles.mainScrollContent}
            keyboardShouldPersistTaps="handled"
          >
            {/* CANVAS WORK AREA CONTAINER (Dashed box matching reference) */}
            <View style={[styles.refCanvasContainer, { borderColor: theme.isDark ? '#333333' : '#CBD5E1', backgroundColor: theme.isDark ? '#0A0A0A' : '#F8FAFC' }]}>
              <ScrollView
                horizontal={canvasOverflowsScreen}
                contentContainerStyle={canvasOverflowsScreen ? { minWidth: canvasWidthPx } : styles.canvasCenterWrapper}
                showsHorizontalScrollIndicator={false}
              >
                <TouchableOpacity activeOpacity={1} onPress={() => setSelectedId(null)}>
                  <View
                    style={[
                      styles.refCanvas,
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
                        pxPerMm={pxPerMm}
                        boundsWidthMm={template.widthMm}
                        boundsHeightMm={template.heightMm}
                        selected={selectedId === el.id}
                        onSelect={() => setSelectedId(el.id)}
                        onDoubleTap={() => handleDoubleTapElement(el)}
                        onChange={(box) => updateElement(el.id, box)}
                      >
                        {renderElementContent(el)}
                      </DraggableElement>
                    ))}
                  </View>
                </TouchableOpacity>
              </ScrollView>
            </View>

            {/* QUICK ADD ELEMENTS ROW (4 Circular Buttons: Text, Barcode, QR Code, Logo) */}
            <View style={styles.refQuickAddRow}>
              <TouchableOpacity onPress={() => addElement('text')} style={styles.refCircleItem}>
                <View style={[styles.refCircleBtn, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
                  <Type size={20} color={theme.textPrimary} />
                  <Text style={styles.refCirclePlus}>+</Text>
                </View>
                <Text style={[styles.refCircleLabel, { color: theme.textSecondary }]}>Text</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={() => addElement('barcode')} style={styles.refCircleItem}>
                <View style={[styles.refCircleBtn, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
                  <BarcodeIcon size={20} color={theme.textPrimary} />
                  <Text style={styles.refCirclePlus}>+</Text>
                </View>
                <Text style={[styles.refCircleLabel, { color: theme.textSecondary }]}>Barcode</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={() => addElement('qrcode')} style={styles.refCircleItem}>
                <View style={[styles.refCircleBtn, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
                  <QrCode size={20} color={theme.textPrimary} />
                  <Text style={styles.refCirclePlus}>+</Text>
                </View>
                <Text style={[styles.refCircleLabel, { color: theme.textSecondary }]}>QR Code</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={() => addElement('image')} style={styles.refCircleItem}>
                <View style={[styles.refCircleBtn, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
                  <ImageIcon size={20} color={theme.textPrimary} />
                  <Text style={styles.refCirclePlus}>+</Text>
                </View>
                <Text style={[styles.refCircleLabel, { color: theme.textSecondary }]}>Logo</Text>
              </TouchableOpacity>
            </View>

            {/* EDIT PROPERTIES SECTION */}
            <View style={styles.refSectionHeaderRow}>
              <Text style={[styles.refSectionTitle, { color: theme.textSecondary }]}>EDIT PROPERTIES</Text>
              {selectedElement && (
                <TouchableOpacity onPress={deleteSelected} style={styles.refDeleteBtn}>
                  <Trash2 size={13} color="#EF4444" />
                  <Text style={styles.refDeleteText}>Delete</Text>
                </TouchableOpacity>
              )}
            </View>

            {selectedElement ? (
              <View style={[styles.refInspectorCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
                {/* 1. Content Field Row */}
                <View style={styles.refPropRow}>
                  <Text style={[styles.refPropLabel, { color: theme.textPrimary }]}>Content:</Text>
                  <View style={{ flex: 1 }}>
                    {selectedElement.type === 'text' ? (
                      <TextInput
                        value={selectedElement.binding === 'custom' ? (selectedElement.customText || '') : (previewProduct ? resolveTextValue(selectedElement, previewProduct) : '')}
                        onChangeText={(txt) => {
                          updateElementProps(selectedElement.id, {
                            binding: 'custom',
                            customText: txt,
                          } as Partial<LabelTextElement>);
                        }}
                        style={[styles.refInlineInput, { color: theme.textPrimary, borderColor: theme.borderColor, backgroundColor: theme.isDark ? '#1C1C1E' : '#FFFFFF' }]}
                        placeholder="Double-tap canvas or enter text..."
                        placeholderTextColor="#94A3B8"
                      />
                    ) : selectedElement.type === 'barcode' ? (
                      <TextInput
                        value={selectedElement.binding === 'custom' ? (selectedElement.customValue || '') : (previewProduct ? resolveCodeValue(selectedElement, previewProduct) : '')}
                        onChangeText={(val) => {
                          updateElementProps(selectedElement.id, {
                            binding: 'custom',
                            customValue: val,
                          } as Partial<LabelBarcodeElement>);
                        }}
                        style={[styles.refInlineInput, { color: theme.textPrimary, borderColor: theme.borderColor, backgroundColor: theme.isDark ? '#1C1C1E' : '#FFFFFF' }]}
                        placeholder="Barcode number / SKU..."
                        placeholderTextColor="#94A3B8"
                      />
                    ) : selectedElement.type === 'qrcode' ? (
                      <TextInput
                        value={selectedElement.binding === 'custom' ? (selectedElement.customValue || '') : (previewProduct ? resolveCodeValue(selectedElement, previewProduct) : '')}
                        onChangeText={(val) => {
                          updateElementProps(selectedElement.id, {
                            binding: 'custom',
                            customValue: val,
                          } as Partial<LabelQrElement>);
                        }}
                        style={[styles.refInlineInput, { color: theme.textPrimary, borderColor: theme.borderColor, backgroundColor: theme.isDark ? '#1C1C1E' : '#FFFFFF' }]}
                        placeholder="URL / UPI / QR Data..."
                        placeholderTextColor="#94A3B8"
                      />
                    ) : selectedElement.type === 'image' ? (
                      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
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
                      </View>
                    ) : null}
                  </View>
                </View>

                {/* 2. Font Size Stepper Row (for text) */}
                {selectedElement.type === 'text' && (
                  <View style={[styles.refPropRow, { marginTop: 14 }]}>
                    <Text style={[styles.refPropLabel, { color: theme.textPrimary }]}>Font Size:</Text>
                    <View style={styles.refFontSizeControls}>
                      <Text style={[styles.refFontSizeVal, { color: theme.textPrimary }]}>
                        {selectedElement.fontSizePt} Pt
                      </Text>
                      <View style={[styles.refStepperSegment, { backgroundColor: theme.isDark ? '#1C1C1E' : '#E2E8F0' }]}>
                        <TouchableOpacity
                          onPress={() => updateElementProps(selectedElement.id, { fontSizePt: Math.max(1, selectedElement.fontSizePt - 1) } as Partial<LabelTextElement>)}
                          style={styles.refStepperHalf}
                        >
                          <Minus size={14} color={theme.textPrimary} />
                        </TouchableOpacity>
                        <View style={[styles.refStepperDivider, { backgroundColor: theme.isDark ? '#2E2E32' : '#CBD5E1' }]} />
                        <TouchableOpacity
                          onPress={() => updateElementProps(selectedElement.id, { fontSizePt: Math.min(24, selectedElement.fontSizePt + 1) } as Partial<LabelTextElement>)}
                          style={styles.refStepperHalf}
                        >
                          <Plus size={14} color={theme.textPrimary} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                )}

                {/* 3. Alignment Segmented Control (for text) */}
                {selectedElement.type === 'text' && (
                  <View style={[styles.refPropRow, { marginTop: 14 }]}>
                    <Text style={[styles.refPropLabel, { color: theme.textPrimary }]}>Alignment:</Text>
                    <View style={[styles.refSegmentedContainer, { backgroundColor: theme.isDark ? '#1C1C1E' : '#E2E8F0' }]}>
                      {(['left', 'center', 'right'] as const).map((a) => {
                        const isAlignActive = (selectedElement.align || 'center') === a;
                        return (
                          <TouchableOpacity
                            key={a}
                            onPress={() => updateElementProps(selectedElement.id, { align: a } as Partial<LabelTextElement>)}
                            style={[
                              styles.refSegmentBtn,
                              isAlignActive && [styles.refSegmentBtnActive, { backgroundColor: theme.isDark ? '#2C2C2E' : '#FFFFFF' }],
                            ]}
                          >
                            <Text
                              style={[
                                styles.refSegmentText,
                                { color: theme.textSecondary },
                                isAlignActive && { color: theme.textPrimary, fontWeight: '800' },
                              ]}
                            >
                              {a.charAt(0).toUpperCase() + a.slice(1)}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                )}

                {/* 4. Bind to Data Row */}
                <View style={{ marginTop: 14, paddingTop: 10, borderTopWidth: 1, borderTopColor: theme.isDark ? '#262626' : '#F1F5F9' }}>
                  <Text style={[styles.refPropLabel, { color: theme.textPrimary, marginBottom: 8 }]}>Bind to Data:</Text>
                  {selectedElement.type === 'text' ? (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      <View style={{ flexDirection: 'row', gap: 6 }}>
                        {TEXT_BINDING_OPTIONS.map((opt) => {
                          const isBound = selectedElement.binding === opt.value;
                          return (
                            <TouchableOpacity
                              key={opt.value}
                              onPress={() => updateElementProps(selectedElement.id, { binding: opt.value } as Partial<LabelTextElement>)}
                              style={[
                                styles.refChip,
                                { borderColor: theme.borderColor, backgroundColor: theme.isDark ? '#1C1C1E' : '#F1F5F9' },
                                isBound && styles.refChipActive,
                              ]}
                            >
                              <Text
                                style={[
                                  styles.refChipText,
                                  { color: theme.textSecondary },
                                  isBound && styles.refChipTextActive,
                                ]}
                              >
                                {opt.label}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </ScrollView>
                  ) : selectedElement.type === 'barcode' ? (
                    <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                      {CODE_BINDING_OPTIONS.map((opt) => {
                        const isBound = selectedElement.binding === opt.value;
                        return (
                          <TouchableOpacity
                            key={opt.value}
                            onPress={() => updateElementProps(selectedElement.id, { binding: opt.value } as Partial<LabelBarcodeElement>)}
                            style={[
                              styles.refChip,
                              { borderColor: theme.borderColor, backgroundColor: theme.isDark ? '#1C1C1E' : '#F1F5F9' },
                              isBound && styles.refChipActive,
                            ]}
                          >
                            <Text
                              style={[
                                styles.refChipText,
                                { color: theme.textSecondary },
                                isBound && styles.refChipTextActive,
                              ]}
                            >
                              {opt.label}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  ) : (
                    <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                      {CODE_BINDING_OPTIONS.map((opt) => {
                        const isBound = (selectedElement as any).binding === opt.value;
                        return (
                          <TouchableOpacity
                            key={opt.value}
                            onPress={() => updateElementProps(selectedElement.id, { binding: opt.value } as any)}
                            style={[
                              styles.refChip,
                              { borderColor: theme.borderColor, backgroundColor: theme.isDark ? '#1C1C1E' : '#F1F5F9' },
                              isBound && styles.refChipActive,
                            ]}
                          >
                            <Text
                              style={[
                                styles.refChipText,
                                { color: theme.textSecondary },
                                isBound && styles.refChipTextActive,
                              ]}
                            >
                              {opt.label}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}
                </View>

                {/* Freehand Resize Tip */}
                <View style={{ marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Info size={13} color={BRAND_COLORS.blue600} />
                  <Text style={{ fontSize: 10.5, color: theme.textSecondary }}>
                    Drag corner dots or element borders directly on canvas to resize freely by hand.
                  </Text>
                </View>
              </View>
            ) : (
              <View style={[styles.refInspectorCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor, paddingVertical: 18 }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Info size={16} color={BRAND_COLORS.blue600} />
                  <Text style={{ fontSize: 12, color: theme.textSecondary, flex: 1 }}>
                    Select an item on the label canvas above to edit its content, font size, or alignment.
                  </Text>
                </View>
              </View>
            )}

            {/* LABEL DIMENSIONS & LIVE PREVIEW CONTROLS */}
            <View style={[styles.sectionCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor, marginTop: 12 }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <Text style={[styles.sectionCardTitle, { color: theme.textPrimary }]}>
                  Label Stock & Live Product Data
                </Text>
                <TouchableOpacity onPress={() => setShowProductPicker(true)}>
                  <Text style={{ fontSize: 11, fontWeight: '800', color: BRAND_COLORS.blue600 }}>Change Product</Text>
                </TouchableOpacity>
              </View>

              {/* Presets Horizontal Strip */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 4 }}>
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

              {hasSequenceElement && (
                <TouchableOpacity
                  onPress={handleOpenSequencePrompt}
                  style={[styles.actionPrintBtn, { backgroundColor: BRAND_COLORS.navyInk, marginTop: 8 }]}
                >
                  <Hash size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                  <Text style={[styles.actionPrintBtnText, { fontSize: 12 }]}>Sequential Number Printing (0001, 0002...)</Text>
                </TouchableOpacity>
              )}
            </View>
          </ScrollView>

          {/* STICKY BOTTOM ACTION BUTTONS: "Save Label" & "Preview Print" */}
          <View style={[styles.refBottomBar, { backgroundColor: theme.cardBg, borderTopColor: theme.borderColor }]}>
            <TouchableOpacity
              onPress={handleSaveTemplate}
              disabled={isSaving}
              style={[styles.refSaveLabelBtn, { backgroundColor: '#0284C7' }]}
            >
              {isSaving ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Text style={styles.refSaveLabelBtnText}>Save Label</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleTestPrint}
              disabled={isTestPrinting}
              style={[styles.refPreviewPrintBtn, { backgroundColor: '#0D9488' }]}
            >
              {isTestPrinting ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Text style={styles.refPreviewPrintBtnText}>Preview Print</Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingWrapper>
      </SafeAreaView>

      {/* DOUBLE TAP DIRECT TEXT EDIT MODAL */}
      <Modal visible={!!doubleTapTextEditId} transparent animationType="fade" onRequestClose={() => setDoubleTapTextEditId(null)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.doubleTapCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
            <Text style={[styles.doubleTapTitle, { color: theme.textPrimary }]}>Edit Text Directly</Text>
            <Text style={{ fontSize: 11, color: theme.textSecondary, marginBottom: 10 }}>
              Edit the text content for this label element:
            </Text>
            <TextInput
              value={doubleTapTextDraft}
              onChangeText={setDoubleTapTextDraft}
              style={[styles.doubleTapInput, { color: theme.textPrimary, borderColor: theme.borderColor, backgroundColor: theme.bg }]}
              autoFocus
              selectTextOnFocus
              placeholder="Enter text..."
              placeholderTextColor="#94A3B8"
            />
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 14 }}>
              <TouchableOpacity
                onPress={() => setDoubleTapTextEditId(null)}
                style={[styles.doubleTapCancelBtn, { borderColor: theme.borderColor }]}
              >
                <Text style={{ color: theme.textSecondary, fontWeight: '700' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSaveDoubleTapText}
                style={[styles.doubleTapApplyBtn, { backgroundColor: BRAND_COLORS.blue600 }]}
              >
                <Text style={{ color: '#FFFFFF', fontWeight: '800' }}>Apply</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, gap: 6 },
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
  quickAddBar: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 12 },
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

  // Reference UI Redesign Styles
  refHeaderBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  refBackBtn: {
    padding: 4,
    marginRight: 4,
  },
  refHeaderCenter: {
    flex: 1,
    alignItems: 'center',
  },
  refHeaderTitle: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  refHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerMiniIconBtn: {
    padding: 7,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerMiniAiBtn: {
    padding: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  refCanvasContainer: {
    marginVertical: 10,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 180,
  },
  refCanvas: {
    borderRadius: 4,
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 5,
    elevation: 2,
  },
  refQuickAddRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginVertical: 12,
    paddingHorizontal: 4,
  },
  refCircleItem: {
    alignItems: 'center',
    gap: 6,
  },
  refCircleBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  refCirclePlus: {
    position: 'absolute',
    right: 7,
    top: 7,
    fontSize: 12,
    fontWeight: '900',
    color: BRAND_COLORS.blue600,
  },
  refCircleLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  refSectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 6,
    paddingHorizontal: 2,
  },
  refSectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  refDeleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  refDeleteText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#EF4444',
  },
  refInspectorCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 8,
  },
  refPropRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  refPropLabel: {
    fontSize: 13,
    fontWeight: '700',
    width: 80,
  },
  refInlineInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    fontSize: 13,
    fontWeight: '600',
  },
  refFontSizeControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  refFontSizeVal: {
    fontSize: 14,
    fontWeight: '800',
    minWidth: 46,
  },
  refStepperSegment: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    overflow: 'hidden',
    height: 32,
  },
  refStepperHalf: {
    width: 36,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  refStepperDivider: {
    width: 1,
    height: 18,
  },
  refSegmentedContainer: {
    flexDirection: 'row',
    borderRadius: 8,
    padding: 3,
    gap: 2,
  },
  refSegmentBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  refSegmentBtnActive: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  refSegmentText: {
    fontSize: 12,
    fontWeight: '600',
  },
  refChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  refChipActive: {
    backgroundColor: BRAND_COLORS.blue600,
    borderColor: BRAND_COLORS.blue600,
  },
  refChipText: {
    fontSize: 11.5,
    fontWeight: '600',
  },
  refChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  refBottomBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    borderTopWidth: 1,
  },
  refSaveLabelBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0284C7',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  refSaveLabelBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  refPreviewPrintBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0D9488',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  refPreviewPrintBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  doubleTapCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 16,
    borderWidth: 1,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  doubleTapTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 4,
  },
  doubleTapInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    fontWeight: '600',
  },
  doubleTapCancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  doubleTapApplyBtn: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 8,
  },
});
