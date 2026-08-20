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
  Layout,
  SlidersHorizontal,
  Sparkles,
  Hash,
  ImageIcon,
  Info,
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

const newId = () => `el-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

function makeBlankTemplate(widthMm: number, heightMm: number): LabelTemplate {
  const now = new Date().toISOString();
  return {
    id: `label-${Date.now()}`,
    name: 'New Label',
    widthMm,
    heightMm,
    orientation: widthMm >= heightMm ? 'landscape' : 'portrait',
    elements: [
      { id: newId(), type: 'text', binding: 'productName', xMm: 4, yMm: 3, widthMm: widthMm - 8, heightMm: 6, fontSizePt: 3.5, align: 'center' },
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
  { value: 'price', label: 'Price' },
  { value: 'sku', label: 'SKU' },
  { value: 'barcodeText', label: 'Barcode (as text)' },
  { value: 'unit', label: 'Unit' },
  { value: 'category', label: 'Category' },
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
  const isTablet = windowWidth >= 600;

  const { products, isLoading: loadingProducts } = useProducts();
  const {
    labelTemplates,
    activeLabelTemplateId,
    saveLabelTemplate,
    deleteLabelTemplate,
    setActiveLabelTemplate,
    labelWidthMm,
    labelHeightMm,
    labelPaperMode,
    paperWidth,
  } = usePrinterStore();

  const existing = params.id ? labelTemplates.find((t) => t.id === params.id) : undefined;
  const [template, setTemplate] = useState<LabelTemplate>(() => existing || makeBlankTemplate(labelWidthMm, labelHeightMm));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [leftTab, setLeftTab] = useState<'design' | 'data' | 'templates'>('design');
  const [mobileMode, setMobileMode] = useState<'canvas' | 'controls'>('canvas');
  const [previewProduct, setPreviewProduct] = useState<Product | null>(products[0] || null);
  const [productSearch, setProductSearch] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isTestPrinting, setIsTestPrinting] = useState(false);
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [showAiBillModal, setShowAiBillModal] = useState(false);

  // Sequential Number Printing — e.g. "Tea 1", "Tea 2", ... "Tea 20", one label per number. Targets
  // one existing text element on the canvas, temporarily overriding just its content per print —
  // the saved template itself is never mutated by this.
  const textElements = template.elements.filter((e): e is LabelTextElement => e.type === 'text');
  const [seqElementId, setSeqElementId] = useState<string | null>(null);
  const [seqBaseText, setSeqBaseText] = useState('Tea');
  const [seqStart, setSeqStart] = useState(1);
  const [seqEnd, setSeqEnd] = useState(10);
  const [isSeqPrinting, setIsSeqPrinting] = useState(false);
  const [seqProgress, setSeqProgress] = useState(0);

  // Dynamic pxPerMm calculation so canvas NEVER overflows the screen!
  const maxAvailableCanvasWidth = isTablet ? windowWidth - 220 : windowWidth - 32;
  const pxPerMm = useMemo(() => {
    return Math.max(4, Math.min(8, Math.floor(maxAvailableCanvasWidth / template.widthMm)));
  }, [maxAvailableCanvasWidth, template.widthMm]);

  const [logoBgModalUri, setLogoBgModalUri] = useState<string | null>(null);
  const [logoBgCallback, setLogoBgCallback] = useState<((uri: string) => void) | null>(null);

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
          const base = { id: newId(), xMm: Math.max(2, template.widthMm / 2 - 10), yMm: Math.max(2, template.heightMm / 2 - 10) };
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
    const base = { id: newId(), xMm: Math.max(2, template.widthMm / 2 - 10), yMm: Math.max(2, template.heightMm / 2 - 5) };
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
    setTemplate((prev) => ({ ...prev, elements: prev.elements.filter((e) => e.id !== selectedId) }));
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
      Alert.alert('Template Saved', `"${toSave.name}" has been saved.`);
    } catch (e: any) {
      Alert.alert('Save Failed', e?.message || 'Could not save this template.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSetActive = async () => {
    try {
      await setActiveLabelTemplate(template.id);
      Alert.alert('Set as Active', 'New product label prints will use this template.');
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not set this template as active.');
    }
  };

  const handleTestPrint = async () => {
    if (!previewProduct && products.length > 0) {
      setPreviewProduct(products[0]);
    }
    const targetProduct = previewProduct || products[0] || {
      id: 'demo-1',
      name: 'Basmati Rice 5kg',
      sellingPrice: 480.0,
      barcode: '8901234567890',
    };

    setIsTestPrinting(true);
    try {
      // Gap mode = TSPL die-cut label printer, so the template becomes real TSPL commands.
      // Continuous mode = ESC/POS receipt roll, a genuinely different protocol — sending TSPL
      // commands there is exactly what printed as gibberish text before this branch existed.
      const ok =
        labelPaperMode === 'continuous'
          ? await ThermalPrinterService.printLabelTemplateOnReceiptPaper(targetProduct, template, paperWidth)
          : await ThermalPrinterService.printLabelFromTemplate(targetProduct, template);
      if (ok) Alert.alert('Test Print Sent', `Printed "${template.name}" label.`);
      else Alert.alert('Print Failed', 'Could not send label to printer.');
    } catch (e: any) {
      Alert.alert('Print Failed', e?.message || 'Could not print this template.');
    } finally {
      setIsTestPrinting(false);
    }
  };

  const handlePrintSequence = async () => {
    if (!seqElementId) {
      Alert.alert('Pick an Element', 'Choose which text element on the label should get the number (e.g. the item name).');
      return;
    }
    if (seqEnd < seqStart) {
      Alert.alert('Invalid Range', 'End number must be the same as or after the start number.');
      return;
    }
    const count = seqEnd - seqStart + 1;
    if (count > 200) {
      Alert.alert('Too Many Labels', 'Please print in batches of 200 or fewer at a time.');
      return;
    }

    const targetProduct = previewProduct || products[0] || {
      id: 'demo-1',
      name: 'Basmati Rice 5kg',
      sellingPrice: 480.0,
      barcode: '8901234567890',
    };

    setIsSeqPrinting(true);
    setSeqProgress(0);
    try {
      for (let n = seqStart; n <= seqEnd; n++) {
        // Only the target element's content is overridden for this one print — the saved template
        // in state is never touched, so the design itself is unaffected by running a sequence.
        const seqTemplate: LabelTemplate = {
          ...template,
          elements: template.elements.map((el) =>
            el.id === seqElementId ? ({ ...el, type: 'text', binding: 'custom', customText: `${seqBaseText} ${n}`.trim() } as LabelTextElement) : el
          ),
        };
        const ok =
          labelPaperMode === 'continuous'
            ? await ThermalPrinterService.printLabelTemplateOnReceiptPaper(targetProduct, seqTemplate, paperWidth)
            : await ThermalPrinterService.printLabelFromTemplate(targetProduct, seqTemplate);
        if (!ok) {
          Alert.alert('Print Failed', `Stopped at label ${n} of ${seqEnd} — could not reach the printer.`);
          return;
        }
        setSeqProgress(n - seqStart + 1);
      }
      Alert.alert('Sequence Printed', `Printed ${count} labels: "${seqBaseText} ${seqStart}" through "${seqBaseText} ${seqEnd}".`);
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
        <Text style={styles.unsupportedText}>{el.type}{'\n'}(coming soon)</Text>
      </View>
    );
  };

  return (
    <ScreenBackground color={theme.bg}>
      <SafeAreaView style={[styles.container, { backgroundColor: 'transparent' }]}>
      {/* inModal here even though this isn't a <Modal>: the canvas + floating side-panel layout
          uses absolute positioning that doesn't reflow usefully under Android's adjustResize —
          the JS-driven "height" behavior actually moves focused inputs above the keyboard. */}
      <KeyboardAvoidingWrapper inModal>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <ArrowLeft size={20} color={theme.textSecondary} />
            <Text style={[styles.backBtnText, { color: theme.textSecondary }]}>Back</Text>
          </TouchableOpacity>
          <TextInput
            value={template.name}
            onChangeText={(name) => setTemplate((prev) => ({ ...prev, name }))}
            style={[styles.nameInput, { color: theme.textPrimary, borderColor: theme.borderColor }]}
            placeholder="Label name"
            placeholderTextColor="#94A3B8"
          />
          <TouchableOpacity
            onPress={() => setShowAiBillModal(true)}
            style={[styles.saveBtn, { backgroundColor: BRAND_COLORS.blue600, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12 }]}
          >
            <Sparkles size={15} color="#FFFFFF" />
            <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 11, marginLeft: 4 }}>AI Bill</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleSaveTemplate} disabled={isSaving} style={styles.saveBtn}>
            {isSaving ? <ActivityIndicator size="small" color="#FFF" /> : <Save size={16} color="#FFFFFF" />}
          </TouchableOpacity>
        </View>

        {activeLabelTemplateId === template.id ? (
          <View style={styles.activeBanner}>
            <CheckCircle2 size={13} color="#10B981" />
            <Text style={styles.activeBannerText}>Active — real label prints use this template</Text>
          </View>
        ) : (
          <TouchableOpacity onPress={handleSetActive} style={[styles.activeBanner, { backgroundColor: 'rgba(100,116,139,0.12)' }]}>
            <Layers size={13} color="#64748B" />
            <Text style={[styles.activeBannerText, { color: '#64748B' }]}>Tap to set as the active label template</Text>
          </TouchableOpacity>
        )}

        {/* Mobile View Mode Switcher (Canvas vs Controls) */}
        {!isTablet ? (
          <View style={[styles.mobileModeBar, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
            <TouchableOpacity
              onPress={() => setMobileMode('canvas')}
              style={[styles.mobileModeBtn, mobileMode === 'canvas' && styles.mobileModeBtnActive]}
            >
              <Layout size={13} color={mobileMode === 'canvas' ? '#FFF' : theme.textSecondary} />
              <Text style={[styles.mobileModeBtnText, mobileMode === 'canvas' && styles.mobileModeBtnTextActive]}>CANVAS DESIGN</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setMobileMode('controls')}
              style={[styles.mobileModeBtn, mobileMode === 'controls' && styles.mobileModeBtnActive]}
            >
              <SlidersHorizontal size={13} color={mobileMode === 'controls' ? '#FFF' : theme.textSecondary} />
              <Text style={[styles.mobileModeBtnText, mobileMode === 'controls' && styles.mobileModeBtnTextActive]}>PROPERTIES & DATA</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <View style={styles.bodyRow}>
          {/* Canvas Section */}
          {(isTablet || mobileMode === 'canvas') && (
            <ScrollView style={styles.canvasScroll} contentContainerStyle={styles.canvasScrollContent}>
              <TouchableOpacity activeOpacity={1} onPress={() => setSelectedId(null)}>
                <View
                  style={[
                    styles.canvas,
                    { width: template.widthMm * pxPerMm, height: template.heightMm * pxPerMm, backgroundColor: template.backgroundColor || '#FFFFFF' },
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
                      selected={selectedId === el.id}
                      onSelect={() => setSelectedId(el.id)}
                      onChange={(box) => updateElement(el.id, box)}
                    >
                      {renderElementContent(el)}
                    </DraggableElement>
                  ))}
                </View>
              </TouchableOpacity>
              <Text style={[styles.canvasCaption, { color: theme.textSecondary }]}>
                {template.widthMm}mm x {template.heightMm}mm — drag to move, corner handles to resize
              </Text>

              {/* Quick Elements Toolbar on Canvas */}
              <View style={styles.quickAddBar}>
                <TouchableOpacity onPress={() => addElement('text')} style={[styles.quickAddBtn, { borderColor: theme.borderColor, backgroundColor: theme.cardBg }]}>
                  <Type size={14} color={BRAND_COLORS.blue600} />
                  <Text style={[styles.quickAddText, { color: theme.textPrimary }]}>+ Text</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => addElement('barcode')} style={[styles.quickAddBtn, { borderColor: theme.borderColor, backgroundColor: theme.cardBg }]}>
                  <BarcodeIcon size={14} color={BRAND_COLORS.blue600} />
                  <Text style={[styles.quickAddText, { color: theme.textPrimary }]}>+ Barcode</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => addElement('qrcode')} style={[styles.quickAddBtn, { borderColor: theme.borderColor, backgroundColor: theme.cardBg }]}>
                  <QrCode size={14} color={BRAND_COLORS.blue600} />
                  <Text style={[styles.quickAddText, { color: theme.textPrimary }]}>+ QR</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity onPress={handleTestPrint} disabled={isTestPrinting} style={styles.testPrintBtn}>
                {isTestPrinting ? <ActivityIndicator size="small" color="#FFF" /> : <BarcodeIcon size={16} color="#FFFFFF" />}
                <Text style={styles.testPrintBtnText}>Test Print with Real Product Data</Text>
              </TouchableOpacity>

              {/* Sequential Number Printing — "Tea 1", "Tea 2", ... one label per number */}
              <View style={[styles.seqCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
                <View style={styles.seqHeaderRow}>
                  <Hash size={15} color={BRAND_COLORS.blue600} />
                  <Text style={[styles.seqTitle, { color: theme.textPrimary }]}>Sequential Number Printing</Text>
                </View>
                <Text style={[styles.seqSub, { color: theme.textSecondary }]}>
                  Print a run of labels with an increasing number, e.g. &quot;Tea 1&quot;, &quot;Tea 2&quot;, ... &quot;Tea {seqEnd}&quot;.
                </Text>

                <Text style={[styles.dimSub, { color: theme.textSecondary, marginTop: 10 }]}>Number this element</Text>
                {textElements.length === 0 ? (
                  <Text style={{ fontSize: 11, color: theme.textSecondary, marginTop: 4 }}>
                    Add a Text element to the label first, then pick it here.
                  </Text>
                ) : (
                  <View style={styles.chipWrap}>
                    {textElements.map((el, idx) => (
                      <TouchableOpacity
                        key={el.id}
                        onPress={() => {
                          setSeqElementId(el.id);
                          if (el.binding === 'custom' && el.customText) setSeqBaseText(el.customText);
                        }}
                        style={[styles.chip, { borderColor: theme.borderColor }, seqElementId === el.id && styles.chipActive]}
                      >
                        <Text style={[styles.chipText, { color: theme.textSecondary }, seqElementId === el.id && styles.chipTextActive]}>
                          {el.binding === 'custom' && el.customText ? el.customText : `Text ${idx + 1}`}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                <Text style={[styles.dimSub, { color: theme.textSecondary, marginTop: 10 }]}>Base Text</Text>
                <TextInput
                  value={seqBaseText}
                  onChangeText={setSeqBaseText}
                  style={[styles.input, { color: theme.textPrimary, borderColor: theme.borderColor }]}
                  placeholder="e.g. Tea"
                  placeholderTextColor="#94A3B8"
                />

                <View style={styles.dimRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.dimSub, { color: theme.textSecondary }]}>Start #</Text>
                    <View style={styles.stepperControls}>
                      <TouchableOpacity onPress={() => setSeqStart((v) => Math.max(1, v - 1))} style={styles.stepBtn}>
                        <Minus size={14} color={theme.textPrimary} />
                      </TouchableOpacity>
                      <Text style={[styles.stepVal, { color: theme.textPrimary }]}>{seqStart}</Text>
                      <TouchableOpacity onPress={() => setSeqStart((v) => v + 1)} style={styles.stepBtn}>
                        <Plus size={14} color={theme.textPrimary} />
                      </TouchableOpacity>
                    </View>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.dimSub, { color: theme.textSecondary }]}>End #</Text>
                    <View style={styles.stepperControls}>
                      <TouchableOpacity onPress={() => setSeqEnd((v) => Math.max(seqStart, v - 1))} style={styles.stepBtn}>
                        <Minus size={14} color={theme.textPrimary} />
                      </TouchableOpacity>
                      <Text style={[styles.stepVal, { color: theme.textPrimary }]}>{seqEnd}</Text>
                      <TouchableOpacity onPress={() => setSeqEnd((v) => v + 1)} style={styles.stepBtn}>
                        <Plus size={14} color={theme.textPrimary} />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>

                <TouchableOpacity
                  onPress={handlePrintSequence}
                  disabled={isSeqPrinting || textElements.length === 0}
                  style={[styles.testPrintBtn, { marginTop: 14, opacity: textElements.length === 0 ? 0.5 : 1 }]}
                >
                  {isSeqPrinting ? (
                    <>
                      <ActivityIndicator size="small" color="#FFF" />
                      <Text style={styles.testPrintBtnText}>
                        Printing {seqProgress}/{seqEnd - seqStart + 1}...
                      </Text>
                    </>
                  ) : (
                    <>
                      <Hash size={16} color="#FFFFFF" />
                      <Text style={styles.testPrintBtnText}>Print {seqEnd - seqStart + 1} Labels</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          )}

          {/* Right Controls Panel */}
          {(isTablet || mobileMode === 'controls') && (
            <View style={[styles.sidePanel, !isTablet && { width: '100%', flex: 1 }, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
              <View style={styles.sideTabRow}>
                {(['design', 'data', 'templates'] as const).map((tab) => (
                  <TouchableOpacity key={tab} onPress={() => setLeftTab(tab)} style={[styles.sideTab, leftTab === tab && styles.sideTabActive]}>
                    <Text style={[styles.sideTabText, leftTab === tab && styles.sideTabTextActive]}>{tab.toUpperCase()}</Text>
                  </TouchableOpacity>
                ))}
              </View>

            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 12 }}>
              {leftTab === 'design' ? (
                <>
                  <Text style={[styles.panelLabel, { color: theme.textSecondary }]}>LABEL SIZE (MM)</Text>
                  <View style={styles.dimRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.dimSub, { color: theme.textSecondary }]}>Width</Text>
                      <View style={styles.stepperControls}>
                        <TouchableOpacity onPress={() => setTemplate((p) => ({ ...p, widthMm: Math.max(10, p.widthMm - 1) }))} style={styles.stepBtn}>
                          <Minus size={14} color={theme.textPrimary} />
                        </TouchableOpacity>
                        <Text style={[styles.stepVal, { color: theme.textPrimary }]}>{template.widthMm}</Text>
                        <TouchableOpacity onPress={() => setTemplate((p) => ({ ...p, widthMm: Math.min(100, p.widthMm + 1) }))} style={styles.stepBtn}>
                          <Plus size={14} color={theme.textPrimary} />
                        </TouchableOpacity>
                      </View>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.dimSub, { color: theme.textSecondary }]}>Height</Text>
                      <View style={styles.stepperControls}>
                        <TouchableOpacity onPress={() => setTemplate((p) => ({ ...p, heightMm: Math.max(10, p.heightMm - 1) }))} style={styles.stepBtn}>
                          <Minus size={14} color={theme.textPrimary} />
                        </TouchableOpacity>
                        <Text style={[styles.stepVal, { color: theme.textPrimary }]}>{template.heightMm}</Text>
                        <TouchableOpacity onPress={() => setTemplate((p) => ({ ...p, heightMm: Math.min(150, p.heightMm + 1) }))} style={styles.stepBtn}>
                          <Plus size={14} color={theme.textPrimary} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>

                  <Text style={[styles.panelLabel, { color: theme.textSecondary, marginTop: 16 }]}>ADD ELEMENTS</Text>
                  <View style={styles.addGrid}>
                    <TouchableOpacity onPress={() => addElement('text')} style={[styles.addBtn, { borderColor: theme.borderColor }]}>
                      <Type size={16} color={BRAND_COLORS.blue600} />
                      <Text style={[styles.addBtnText, { color: theme.textPrimary }]}>Text</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => addElement('barcode')} style={[styles.addBtn, { borderColor: theme.borderColor }]}>
                      <BarcodeIcon size={16} color={BRAND_COLORS.blue600} />
                      <Text style={[styles.addBtnText, { color: theme.textPrimary }]}>Barcode</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => addElement('qrcode')} style={[styles.addBtn, { borderColor: theme.borderColor }]}>
                      <QrCode size={16} color={BRAND_COLORS.blue600} />
                      <Text style={[styles.addBtnText, { color: theme.textPrimary }]}>QR Code</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => addElement('image')} style={[styles.addBtn, { borderColor: theme.borderColor }]}>
                      <ImageIcon size={16} color={BRAND_COLORS.blue600} />
                      <Text style={[styles.addBtnText, { color: theme.textPrimary }]}>Image / Logo</Text>
                    </TouchableOpacity>
                  </View>
                  <Text style={{ fontSize: 10.5, color: theme.textSecondary, marginTop: 8, lineHeight: 15 }}>
                    Tap Image / Logo above to upload company logos or product pictures directly onto your label canvas.
                  </Text>

                  {selectedElement ? (
                    <>
                      <View style={[styles.divider, { borderColor: theme.borderColor }]} />
                      <View style={styles.sectionHeaderRow}>
                        <Text style={[styles.panelLabel, { color: theme.textSecondary }]}>SELECTED ELEMENT</Text>
                        <TouchableOpacity onPress={deleteSelected}>
                          <Trash2 size={16} color="#EF4444" />
                        </TouchableOpacity>
                      </View>

                      {selectedElement.type === 'text' ? (
                        <>
                          <Text style={[styles.dimSub, { color: theme.textSecondary, marginTop: 8 }]}>Bind to</Text>
                          <View style={styles.chipWrap}>
                            {TEXT_BINDING_OPTIONS.map((opt) => (
                              <TouchableOpacity
                                key={opt.value}
                                onPress={() => updateElementProps(selectedElement.id, { binding: opt.value } as Partial<LabelTextElement>)}
                                style={[styles.chip, { borderColor: theme.borderColor }, selectedElement.binding === opt.value && styles.chipActive]}
                              >
                                <Text style={[styles.chipText, { color: theme.textSecondary }, selectedElement.binding === opt.value && styles.chipTextActive]}>
                                  {opt.label}
                                </Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                          {selectedElement.binding === 'custom' ? (
                            <TextInput
                              value={selectedElement.customText || ''}
                              onChangeText={(customText) => updateElementProps(selectedElement.id, { customText } as Partial<LabelTextElement>)}
                              style={[styles.input, { color: theme.textPrimary, borderColor: theme.borderColor, marginTop: 8 }]}
                              placeholder="Custom text"
                              placeholderTextColor="#94A3B8"
                            />
                          ) : null}

                          <Text style={[styles.dimSub, { color: theme.textSecondary, marginTop: 10 }]}>Font Size</Text>
                          <View style={styles.stepperControls}>
                            <TouchableOpacity
                              onPress={() => updateElementProps(selectedElement.id, { fontSizePt: Math.max(1.5, selectedElement.fontSizePt - 0.5) } as Partial<LabelTextElement>)}
                              style={styles.stepBtn}
                            >
                              <Minus size={14} color={theme.textPrimary} />
                            </TouchableOpacity>
                            <Text style={[styles.stepVal, { color: theme.textPrimary }]}>{selectedElement.fontSizePt}</Text>
                            <TouchableOpacity
                              onPress={() => updateElementProps(selectedElement.id, { fontSizePt: Math.min(10, selectedElement.fontSizePt + 0.5) } as Partial<LabelTextElement>)}
                              style={styles.stepBtn}
                            >
                              <Plus size={14} color={theme.textPrimary} />
                            </TouchableOpacity>
                          </View>

                          <View style={{ flexDirection: 'row', marginTop: 10, alignItems: 'center' }}>
                            <TouchableOpacity
                              onPress={() => updateElementProps(selectedElement.id, { bold: !selectedElement.bold } as Partial<LabelTextElement>)}
                              style={[styles.chip, { borderColor: theme.borderColor }, selectedElement.bold && styles.chipActive]}
                            >
                              <Text style={[styles.chipText, { color: theme.textSecondary }, selectedElement.bold && styles.chipTextActive]}>Bold</Text>
                            </TouchableOpacity>
                            {(['left', 'center', 'right'] as const).map((a) => (
                              <TouchableOpacity
                                key={a}
                                onPress={() => updateElementProps(selectedElement.id, { align: a } as Partial<LabelTextElement>)}
                                style={[styles.chip, { borderColor: theme.borderColor, marginLeft: 6 }, selectedElement.align === a && styles.chipActive]}
                              >
                                <Text style={[styles.chipText, { color: theme.textSecondary }, selectedElement.align === a && styles.chipTextActive]}>{a}</Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        </>
                      ) : null}

                      {selectedElement.type === 'barcode' || selectedElement.type === 'qrcode' ? (
                        <>
                          <Text style={[styles.dimSub, { color: theme.textSecondary, marginTop: 8 }]}>Bind to</Text>
                          <View style={styles.chipWrap}>
                            {CODE_BINDING_OPTIONS.map((opt) => (
                              <TouchableOpacity
                                key={opt.value}
                                onPress={() => updateElementProps(selectedElement.id, { binding: opt.value } as Partial<LabelBarcodeElement>)}
                                style={[styles.chip, { borderColor: theme.borderColor }, selectedElement.binding === opt.value && styles.chipActive]}
                              >
                                <Text style={[styles.chipText, { color: theme.textSecondary }, selectedElement.binding === opt.value && styles.chipTextActive]}>
                                  {opt.label}
                                </Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                          {selectedElement.binding === 'custom' ? (
                            <TextInput
                              value={selectedElement.customValue || ''}
                              onChangeText={(customValue) => updateElementProps(selectedElement.id, { customValue } as Partial<LabelBarcodeElement>)}
                              style={[styles.input, { color: theme.textPrimary, borderColor: theme.borderColor, marginTop: 8 }]}
                              placeholder="Custom value"
                              placeholderTextColor="#94A3B8"
                            />
                          ) : null}
                        </>
                      ) : null}

                      {selectedElement.type === 'barcode' ? (
                        <>
                          <Text style={[styles.dimSub, { color: theme.textSecondary, marginTop: 10 }]}>Format</Text>
                          <View style={styles.chipWrap}>
                            {(['ean13', 'code128'] as const).map((f) => (
                              <TouchableOpacity
                                key={f}
                                onPress={() => updateElementProps(selectedElement.id, { format: f } as Partial<LabelBarcodeElement>)}
                                style={[styles.chip, { borderColor: theme.borderColor }, selectedElement.format === f && styles.chipActive]}
                              >
                                <Text style={[styles.chipText, { color: theme.textSecondary }, selectedElement.format === f && styles.chipTextActive]}>
                                  {f.toUpperCase()}
                                </Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        </>
                      ) : null}

                      {selectedElement.type === 'image' ? (
                        <>
                          <View style={{ flexDirection: 'row', gap: 6, marginTop: 6 }}>
                            <TouchableOpacity
                              onPress={() => handlePickImageForElement(selectedElement.id)}
                              style={[styles.saveBtn, { backgroundColor: BRAND_COLORS.blue600, flex: 1, paddingVertical: 10, marginLeft: 0 }]}
                            >
                              <ImageIcon size={14} color="#FFFFFF" style={{ marginRight: 4 }} />
                              <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 11 }}>Replace</Text>
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
                                style={[styles.saveBtn, { backgroundColor: '#D97706', flex: 1.2, paddingVertical: 10, marginLeft: 0 }]}
                              >
                                <Sparkles size={14} color="#FFFFFF" style={{ marginRight: 4 }} />
                                <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 11 }}>Background</Text>
                              </TouchableOpacity>
                            ) : null}
                          </View>

                          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12, justifyContent: 'space-between' }}>
                            <Text style={[styles.dimSub, { color: theme.textSecondary }]}>Invert Colors (B/W)</Text>
                            <TouchableOpacity
                              onPress={() => updateElementProps(selectedElement.id, { invert: !selectedElement.invert } as Partial<LabelImageElement>)}
                              style={[styles.chip, { borderColor: theme.borderColor }, selectedElement.invert && styles.chipActive]}
                            >
                              <Text style={[styles.chipText, { color: theme.textSecondary }, selectedElement.invert && styles.chipTextActive]}>
                                {selectedElement.invert ? 'ON' : 'OFF'}
                              </Text>
                            </TouchableOpacity>
                          </View>

                          <View style={{ backgroundColor: 'rgba(234, 179, 8, 0.1)', borderColor: 'rgba(234, 179, 8, 0.3)', borderWidth: 1, borderRadius: 12, padding: 12, marginTop: 14 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                              <Info size={16} color="#D97706" style={{ marginRight: 6 }} />
                              <Text style={{ fontSize: 12, fontWeight: '800', color: '#D97706' }}>Thermal Printing Image Tips</Text>
                            </View>
                            <Text style={{ fontSize: 11, color: theme.textPrimary, lineHeight: 16 }}>
                              • Thermal printers use <Text style={{ fontWeight: 'bold' }}>1-bit direct black/white paper</Text> (no color/grayscale).{'\n'}
                              • <Text style={{ fontWeight: 'bold' }}>Best Results</Text>: High contrast black logos with a transparent PNG background.{'\n'}
                              • If an image prints as a solid black block, tap <Text style={{ fontWeight: 'bold' }}>Invert Colors</Text> or choose a clean line-art logo.
                            </Text>
                          </View>
                        </>
                      ) : null}
                    </>
                  ) : (
                    <Text style={{ fontSize: 11, color: theme.textSecondary, marginTop: 16 }}>Tap an element on the canvas to edit it.</Text>
                  )}
                </>
              ) : leftTab === 'data' ? (
                <>
                  <Text style={[styles.panelLabel, { color: theme.textSecondary }]}>PREVIEW WITH REAL PRODUCT</Text>
                  <Text style={{ fontSize: 11, color: theme.textSecondary, marginBottom: 10, lineHeight: 16 }}>
                    Elements bound to a product field show this product&apos;s actual data while you design — the same binding is resolved against whichever real product you print later.
                  </Text>
                  <TouchableOpacity onPress={() => setShowProductPicker(true)} style={[styles.productPickBtn, { borderColor: theme.borderColor, backgroundColor: theme.bg }]}>
                    <Package size={16} color={BRAND_COLORS.blue600} />
                    <Text style={[styles.productPickText, { color: theme.textPrimary }]} numberOfLines={1}>
                      {previewProduct ? previewProduct.name : 'Choose a product...'}
                    </Text>
                  </TouchableOpacity>
                  {previewProduct ? (
                    <Text style={{ fontSize: 11, color: theme.textSecondary, marginTop: 6 }}>
                      Rs.{previewProduct.sellingPrice.toFixed(2)} • {previewProduct.barcode || previewProduct.sku || 'no code'}
                    </Text>
                  ) : null}
                </>
              ) : (
                <>
                  <Text style={[styles.panelLabel, { color: theme.textSecondary }]}>SAVED TEMPLATES ({labelTemplates.length})</Text>
                  {labelTemplates.length === 0 ? (
                    <Text style={{ fontSize: 11, color: theme.textSecondary, marginTop: 8 }}>No saved templates yet — design one and tap Save.</Text>
                  ) : (
                    labelTemplates.map((t) => (
                      <View key={t.id} style={[styles.templateRow, { borderColor: theme.borderColor, backgroundColor: theme.bg }]}>
                        <TouchableOpacity style={{ flex: 1 }} onPress={() => { setTemplate(t); setSelectedId(null); }}>
                          <Text style={[styles.templateName, { color: theme.textPrimary }]} numberOfLines={1}>{t.name}</Text>
                          <Text style={{ fontSize: 10, color: theme.textSecondary }}>
                            {t.widthMm}x{t.heightMm}mm{activeLabelTemplateId === t.id ? ' • Active' : ''}
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() =>
                            Alert.alert('Delete Template', `Delete "${t.name}"?`, [
                              { text: 'Cancel', style: 'cancel' },
                              { text: 'Delete', style: 'destructive', onPress: () => deleteLabelTemplate(t.id) },
                            ])
                          }
                          style={{ padding: 6 }}
                        >
                          <Trash2 size={15} color="#EF4444" />
                        </TouchableOpacity>
                      </View>
                    ))
                  )}
                  <TouchableOpacity
                    onPress={() => {
                      setTemplate(makeBlankTemplate(labelWidthMm, labelHeightMm));
                      setSelectedId(null);
                    }}
                    style={styles.newTemplateBtn}
                  >
                    <Plus size={14} color="#FFFFFF" />
                    <Text style={styles.newTemplateBtnText}>New Label</Text>
                  </TouchableOpacity>
                </>
              )}
            </ScrollView>
          </View>
        )}
        </View>
      </KeyboardAvoidingWrapper>
      </SafeAreaView>

      {/* Product Picker Modal */}
      <Modal visible={showProductPicker} animationType="slide" onRequestClose={() => setShowProductPicker(false)}>
        <SafeAreaView style={[styles.modalSafeArea, { backgroundColor: theme.bg }]}>
          <View style={{ flex: 1, padding: 16 }}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>Choose a Product</Text>
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
            {loadingProducts ? (
              <ActivityIndicator style={{ marginTop: 30 }} color={BRAND_COLORS.blue600} />
            ) : (
              <ScrollView style={{ marginTop: 12 }}>
                {filteredProducts.map((p) => (
                  <TouchableOpacity
                    key={p.id}
                    onPress={() => {
                      setPreviewProduct(p);
                      setShowProductPicker(false);
                    }}
                    style={[styles.productRow, { borderColor: theme.borderColor, backgroundColor: theme.cardBg }]}
                  >
                    <Text style={[styles.productRowName, { color: theme.textPrimary }]}>{p.name}</Text>
                    <Text style={{ fontSize: 11, color: theme.textSecondary }}>Rs.{p.sellingPrice.toFixed(2)} • {p.barcode || p.sku || 'no code'}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>
        </SafeAreaView>
      </Modal>

      {/* AI A4 BILL TO RECEIPT CONVERTER MODAL */}
      <AiBillToReceiptModal
        visible={showAiBillModal}
        onClose={() => setShowAiBillModal(false)}
      />

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
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10 },
  backBtn: { flexDirection: 'row', alignItems: 'center', marginRight: 10 },
  backBtnText: { fontSize: 12, fontWeight: '600', marginLeft: 4 },
  nameInput: { flex: 1, borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, fontSize: 14, fontWeight: '700' },
  saveBtn: { backgroundColor: BRAND_COLORS.navyInk, padding: 10, borderRadius: 10, marginLeft: 8 },
  activeBanner: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginBottom: 8, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, backgroundColor: 'rgba(16,185,129,0.12)' },
  activeBannerText: { fontSize: 10.5, fontWeight: '700', color: '#10B981', marginLeft: 6 },
  mobileModeBar: { flexDirection: 'row', padding: 4, borderRadius: 12, borderWidth: 1, marginHorizontal: 16, marginBottom: 8 },
  mobileModeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 8, borderRadius: 8 },
  mobileModeBtnActive: { backgroundColor: BRAND_COLORS.blue600 },
  mobileModeBtnText: { fontSize: 10, fontWeight: '800', marginLeft: 6, color: '#64748B' },
  mobileModeBtnTextActive: { color: '#FFFFFF' },
  bodyRow: { flex: 1, flexDirection: 'row' },
  canvasScroll: { flex: 1 },
  canvasScrollContent: { alignItems: 'center', padding: 16, paddingBottom: 40 },
  canvas: { position: 'relative', borderWidth: 1, borderColor: '#CBD5E1', overflow: 'visible', borderRadius: 6, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8, elevation: 3 },
  canvasCaption: { fontSize: 10.5, marginTop: 10, textAlign: 'center' },
  quickAddBar: { flexDirection: 'row', gap: 8, marginTop: 14 },
  quickAddBtn: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  quickAddText: { fontSize: 11, fontWeight: '800', marginLeft: 4 },
  testPrintBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: BRAND_COLORS.blue600, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 16, marginTop: 14 },
  testPrintBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 12, marginLeft: 8 },
  seqCard: { width: '100%', borderWidth: 1, borderRadius: 14, padding: 14, marginTop: 20 },
  seqHeaderRow: { flexDirection: 'row', alignItems: 'center' },
  seqTitle: { fontSize: 13, fontWeight: '900', marginLeft: 6 },
  seqSub: { fontSize: 10.5, marginTop: 4, lineHeight: 15 },
  sidePanel: { width: 190, borderLeftWidth: 1 },
  sideTabRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: 'rgba(148,163,184,0.25)' },
  sideTab: { flex: 1, paddingVertical: 10, alignItems: 'center' },
  sideTabActive: { borderBottomWidth: 2, borderBottomColor: BRAND_COLORS.blue600 },
  sideTabText: { fontSize: 9, fontWeight: '800', color: '#94A3B8' },
  sideTabTextActive: { color: BRAND_COLORS.blue600 },
  panelLabel: { fontSize: 9.5, fontWeight: '800', letterSpacing: 0.4 },
  dimRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  dimSub: { fontSize: 10, fontWeight: '700', marginBottom: 4 },
  stepperControls: { flexDirection: 'row', alignItems: 'center' },
  stepBtn: { width: 26, height: 26, borderRadius: 8, borderWidth: 1, borderColor: '#CBD5E1', alignItems: 'center', justifyContent: 'center' },
  stepVal: { fontSize: 12, fontWeight: '800', marginHorizontal: 8, minWidth: 24, textAlign: 'center' },
  addGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  addBtn: { width: '30%', borderWidth: 1, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  addBtnText: { fontSize: 9.5, fontWeight: '700', marginTop: 4 },
  divider: { borderTopWidth: 1, marginVertical: 14 },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  chip: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5 },
  chipActive: { backgroundColor: BRAND_COLORS.blue600, borderColor: BRAND_COLORS.blue600 },
  chipText: { fontSize: 9.5, fontWeight: '700' },
  chipTextActive: { color: '#FFFFFF' },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 12 },
  unsupportedBox: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(148,163,184,0.15)', borderRadius: 4 },
  unsupportedText: { fontSize: 9, color: '#64748B', textAlign: 'center', fontWeight: '700' },
  productPickBtn: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 10 },
  productPickText: { fontSize: 12, fontWeight: '700', marginLeft: 8, flex: 1 },
  templateRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 10, padding: 10, marginBottom: 8 },
  templateName: { fontSize: 12, fontWeight: '800' },
  newTemplateBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: BRAND_COLORS.navyInk, borderRadius: 10, paddingVertical: 10, marginTop: 8 },
  newTemplateBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 12, marginLeft: 6 },
  modalSafeArea: { flex: 1 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  modalTitle: { fontSize: 18, fontWeight: '900' },
  searchBox: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 8 },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 13 },
  productRow: { borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 8 },
  productRowName: { fontSize: 13, fontWeight: '700' },
});
