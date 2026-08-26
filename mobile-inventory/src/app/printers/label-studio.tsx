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
      Alert.alert('Template Saved! 💾', `"${toSave.name}" has been saved successfully.`);
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
      Alert.alert('Default Template Set! ⭐', `"${toSave.name}" is now the active default template for all product label prints.`);
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
      if (ok) Alert.alert('Test Print Sent! 🖨️', `Printed test label for "${targetProduct.name}".`);
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
        Alert.alert('Sequence Printed! 🔢', `Printed ${result.printedCount} labels starting from "${startPattern}".`);
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
              <Sparkles size={14} color="#FFFFFF" />
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

          {/* Main Unified Scrolling Content */}
          <ScrollView
            style={styles.mainScroll}
            contentContainerStyle={styles.mainScrollContent}
            keyboardShouldPersistTaps="handled"
          >
            {/* CANVAS WORK AREA */}
            <View style={[styles.canvasCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
              <View style={styles.canvasHeader}>
                <Text style={[styles.canvasBadge, { color: theme.textSecondary }]}>
                  CANVAS ({template.widthMm}mm × {template.heightMm}mm)
                </Text>
                <Text style={{ fontSize: 10, color: theme.textSecondary }}>
                  Drag to reposition • Handles to resize
                </Text>
              </View>

              <ScrollView
                horizontal={canvasOverflowsScreen}
                contentContainerStyle={canvasOverflowsScreen ? { minWidth: canvasWidthPx } : styles.canvasCenterWrapper}
                showsHorizontalScrollIndicator={false}
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
                        pxPerMm={pxPerMm}
                        boundsWidthMm={template.widthMm}
                        boundsHeightMm={template.heightMm}
                        selected={selectedId === el.id}
                        onSelect={() => setSelectedId(el.id)}
                        onChange={(box) => updateElement(el.id, box)}
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
                <Text style={styles.actionPrintBtnText}>Test Print Label 🖨️</Text>
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
                              Alert.alert('Default Updated! ⭐', `"${t.name}" is now default.`);
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
});
