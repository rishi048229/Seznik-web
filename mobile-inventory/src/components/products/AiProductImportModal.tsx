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
  FlatList,
  Platform,
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
  AlertCircle,
  HelpCircle,
  Search,
  Barcode,
  RefreshCw,
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { useProducts } from '@/hooks/useProducts';
import { useAppTheme } from '@/hooks/useAppTheme';
import { KeyboardAvoidingWrapper } from '@/components/ui/KeyboardAvoidingWrapper';
import { BRAND_COLORS } from '@/constants/theme';
import { generateEAN13Barcode } from '@/utils/barcodeGenerator';

let ImageManipulator: any = null;
try {
  ImageManipulator = require('expo-image-manipulator');
} catch (e) {
  ImageManipulator = null;
}

export interface ExtractedProductItem {
  name: string;
  sellingPrice: number | string;
  costPrice: number | string;
  currentStock: number | string;
  unit: string;
  categoryName: string;
  barcode?: string;
  sku?: string;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  onSuccessImport?: () => void;
}

export function AiProductImportModal({ visible, onClose, onSuccessImport }: Props) {
  const theme = useAppTheme();
  const { aiExtractProducts, bulkCreateProducts } = useProducts();

  const [step, setStep] = useState<'select' | 'analyzing' | 'review'>('select');
  const [extractedItems, setExtractedItems] = useState<ExtractedProductItem[]>([]);
  const [loadingMsg, setLoadingMsg] = useState('Analyzing document with Gemini AI...');
  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const resetState = () => {
    setStep('select');
    setExtractedItems([]);
    setSubmitting(false);
    setSearchQuery('');
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const processFileForAi = async (uri: string, mimeType: string, existingBase64?: string) => {
    try {
      setStep('analyzing');
      setLoadingMsg('Reading document & extracting product catalog via Gemini AI...');

      let base64Data = existingBase64;
      let targetMime = mimeType || 'image/jpeg';

      if (targetMime.startsWith('image/') && ImageManipulator && typeof ImageManipulator.manipulateAsync === 'function') {
        try {
          const manipResult = await ImageManipulator.manipulateAsync(
            uri,
            [{ resize: { width: 1600 } }],
            { compress: 0.5, format: ImageManipulator.SaveFormat?.JPEG ?? 'jpeg', base64: true }
          );
          if (manipResult.base64) {
            base64Data = manipResult.base64;
            targetMime = 'image/jpeg';
          }
        } catch (manipErr) {
          console.warn('Image manipulation fallback:', manipErr);
        }
      }

      if (!base64Data) {
        base64Data = await FileSystem.readAsStringAsync(uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
      }

      const res = await aiExtractProducts({
        imageBase64: base64Data,
        mimeType: targetMime,
      });

      if (res.success && Array.isArray(res.products) && res.products.length > 0) {
        // Auto-generate scannable barcodes ONLY for products whose barcode is not present
        const sanitized: ExtractedProductItem[] = res.products.map((item: any, idx: number) => {
          const existingBarcode = item.barcode ? String(item.barcode).replace(/[^a-zA-Z0-9]/g, '').trim() : '';
          const finalBarcode = existingBarcode.length > 0 ? existingBarcode : generateEAN13Barcode();
          const finalSku = item.sku ? String(item.sku).trim() : `SKU-${Date.now().toString().slice(-6)}-${idx + 1}`;
          return {
            name: String(item.name || 'Product').trim(),
            sellingPrice: item.sellingPrice !== undefined ? item.sellingPrice : 0,
            costPrice: item.costPrice !== undefined ? item.costPrice : 0,
            currentStock: item.currentStock !== undefined ? item.currentStock : 1,
            unit: String(item.unit || 'Piece').trim(),
            categoryName: String(item.categoryName || 'General').trim(),
            barcode: finalBarcode,
            sku: finalSku,
          };
        });

        setExtractedItems(sanitized);
        setStep('review');
      } else {
        Alert.alert(
          'No Products Found',
          'Gemini AI could not detect clear product entries in this document. Please try a clearer bill photo, spreadsheet, or PDF file.',
          [{ text: 'Try Again', onPress: () => setStep('select') }]
        );
      }
    } catch (err: any) {
      console.error('AI extraction error:', err);
      Alert.alert(
        'AI Extraction Failed',
        err?.message || 'Failed to process document with Gemini AI. Check your internet connection and API key.',
        [{ text: 'Try Again', onPress: () => setStep('select') }]
      );
    }
  };

  const handleCameraCapture = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission Denied', 'Camera access is required to capture bills or receipts.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      base64: true,
      quality: 0.4,
    });

    if (!result.canceled && result.assets[0]?.uri) {
      const asset = result.assets[0];
      await processFileForAi(asset.uri, 'image/jpeg', asset.base64 || undefined);
    }
  };

  const handleGalleryPick = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission Denied', 'Photo gallery permission is required.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      base64: true,
      quality: 0.4,
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
      Alert.alert('File Picker Error', err?.message || 'Failed to select document');
    }
  };

  const handleUpdateItem = (index: number, key: keyof ExtractedProductItem, value: any) => {
    const updated = [...extractedItems];
    updated[index] = { ...updated[index], [key]: value };
    setExtractedItems(updated);
  };

  const handleRemoveItem = (index: number) => {
    setExtractedItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAddItemRow = () => {
    setExtractedItems((prev) => [
      ...prev,
      {
        name: 'New Product',
        sellingPrice: 100,
        costPrice: 80,
        currentStock: 10,
        unit: 'Piece',
        categoryName: 'General',
        barcode: generateEAN13Barcode(),
        sku: `SKU-${Date.now().toString().slice(-6)}-${prev.length + 1}`,
      },
    ]);
  };

  const handleConfirmImport = async () => {
    if (extractedItems.length === 0) {
      Alert.alert('No Items', 'There are no product entries to save.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = extractedItems.map((p, idx) => {
        const cleanBar = p.barcode ? String(p.barcode).trim() : '';
        const finalBar = cleanBar.length > 0 ? cleanBar : generateEAN13Barcode();
        return {
          name: p.name.trim(),
          sellingPrice: parseFloat(String(p.sellingPrice)) || 0,
          costPrice: parseFloat(String(p.costPrice)) || 0,
          currentStock: parseInt(String(p.currentStock)) || 0,
          unit: (p.unit || 'Piece').trim(),
          categoryName: (p.categoryName || 'General').trim(),
          barcode: finalBar,
          sku: p.sku ? String(p.sku).trim() : `SKU-${Date.now().toString().slice(-6)}-${idx + 1}`,
        };
      });

      await bulkCreateProducts(payload);

      Alert.alert(
        '🎉 Import Successful!',
        `Successfully imported ${payload.length} products with valid scannable barcodes to your inventory.`,
        [
          {
            text: 'OK',
            onPress: () => {
              if (onSuccessImport) onSuccessImport();
              handleClose();
            },
          },
        ]
      );
    } catch (err: any) {
      Alert.alert('Import Failed', err?.message || 'Failed to save imported products to database.');
    } finally {
      setSubmitting(false);
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
                <Text style={[styles.title, { color: theme.textPrimary }]}>AI Smart Product Import</Text>
                <Text style={[styles.subtitle, { color: theme.textSecondary }]}>Powered by Gemini AI Multimodal OCR</Text>
              </View>
            </View>
            <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
              <X size={20} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* STEP 1: SELECT DOCUMENT SOURCE */}
          {step === 'select' && (
            <ScrollView style={{ flex: 1, padding: 18 }} contentContainerStyle={{ paddingBottom: 40 }}>
              <View style={[styles.infoBanner, { backgroundColor: 'rgba(37, 99, 235, 0.08)', borderColor: 'rgba(37, 99, 235, 0.2)' }]}>
                <AlertCircle size={20} color={BRAND_COLORS.blue600} style={{ marginRight: 10 }} />
                <Text style={[styles.infoText, { color: theme.textPrimary }]}>
                  Upload supplier invoices, handwritten bills, product price tags, Excel sheets, or PDFs. Gemini AI will automatically extract prices, stock quantities, and generate scannable barcodes!
                </Text>
              </View>

              <Text style={[styles.sectionHeading, { color: theme.textPrimary }]}>Choose Document Source</Text>

              <TouchableOpacity
                onPress={handleCameraCapture}
                style={[styles.optionCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}
              >
                <View style={[styles.optionIconBox, { backgroundColor: '#10B981' }]}>
                  <Camera size={24} color="#FFFFFF" />
                </View>
                <View style={{ flex: 1, marginLeft: 14 }}>
                  <Text style={[styles.optionTitle, { color: theme.textPrimary }]}>Take Bill / Tag Photo</Text>
                  <Text style={[styles.optionSub, { color: theme.textSecondary }]}>Snap a direct photo of a printed bill or handwritten list</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleGalleryPick}
                style={[styles.optionCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}
              >
                <View style={[styles.optionIconBox, { backgroundColor: '#8B5CF6' }]}>
                  <ImageIcon size={24} color="#FFFFFF" />
                </View>
                <View style={{ flex: 1, marginLeft: 14 }}>
                  <Text style={[styles.optionTitle, { color: theme.textPrimary }]}>Choose Photo from Gallery</Text>
                  <Text style={[styles.optionSub, { color: theme.textSecondary }]}>Pick an invoice image or screenshot from your device</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleDocumentPick}
                style={[styles.optionCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}
              >
                <View style={[styles.optionIconBox, { backgroundColor: '#2563EB' }]}>
                  <FileText size={24} color="#FFFFFF" />
                </View>
                <View style={{ flex: 1, marginLeft: 14 }}>
                  <Text style={[styles.optionTitle, { color: theme.textPrimary }]}>Upload PDF, Excel or CSV Document</Text>
                  <Text style={[styles.optionSub, { color: theme.textSecondary }]}>Extract 1,000+ catalog items directly from Excel or PDF bills</Text>
                </View>
              </TouchableOpacity>
            </ScrollView>
          )}

          {/* STEP 2: ANALYZING STATE */}
          {step === 'analyzing' && (
            <View style={styles.loadingContainer}>
              <View style={styles.aiPulseCircle}>
                <Sparkles size={36} color="#FFFFFF" />
              </View>
              <Text style={[styles.loadingTitle, { color: theme.textPrimary }]}>AI Extracting Catalog</Text>
              <Text style={[styles.loadingSub, { color: theme.textSecondary }]}>{loadingMsg}</Text>
              <ActivityIndicator size="large" color={BRAND_COLORS.blue600} style={{ marginTop: 24 }} />
            </View>
          )}

          {/* STEP 3: REVIEW & EDIT EXTRACTED PRODUCTS */}
          {step === 'review' && (
            <View style={{ flex: 1 }}>
              <View style={[styles.reviewBanner, { backgroundColor: 'rgba(16, 185, 129, 0.1)' }]}>
                <CheckCircle2 size={18} color="#10B981" />
                <Text style={[styles.reviewBannerText, { color: theme.textPrimary }]}>
                  Gemini AI extracted {extractedItems.length} products! All missing barcodes have been auto-generated with valid EAN-13 codes.
                </Text>
              </View>

              <View style={{ paddingHorizontal: 14, paddingTop: 10, paddingBottom: 6 }}>
                <View style={[styles.searchBox, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
                  <Search size={16} color={theme.textSecondary} style={{ marginRight: 8 }} />
                  <TextInput
                    style={[styles.searchInput, { color: theme.textPrimary }]}
                    placeholder={`Search in ${extractedItems.length} products...`}
                    placeholderTextColor="#94A3B8"
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                  />
                  {searchQuery ? (
                    <TouchableOpacity onPress={() => setSearchQuery('')}>
                      <X size={16} color={theme.textSecondary} />
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>

              <FlatList
                data={extractedItems.filter(
                  (i) =>
                    i.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    (i.categoryName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                    (i.barcode || '').includes(searchQuery)
                )}
                keyExtractor={(_, index) => `item-${index}`}
                initialNumToRender={20}
                maxToRenderPerBatch={25}
                windowSize={7}
                removeClippedSubviews={true}
                contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 100 }}
                renderItem={({ item, index }) => (
                  <View style={[styles.itemCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
                    <View style={styles.itemHeader}>
                      <View style={styles.itemBadge}>
                        <Text style={styles.itemBadgeText}>#{index + 1}</Text>
                      </View>
                      <TextInput
                        style={[styles.itemNameInput, { color: theme.textPrimary }]}
                        value={item.name}
                        onChangeText={(txt) => handleUpdateItem(index, 'name', txt)}
                        placeholder="Product Name"
                        placeholderTextColor="#94A3B8"
                      />
                      <TouchableOpacity onPress={() => handleRemoveItem(index)} style={styles.deleteRowBtn}>
                        <Trash2 size={16} color="#EF4444" />
                      </TouchableOpacity>
                    </View>

                    {/* Price & Cost Grid */}
                    <View style={styles.fieldGrid}>
                      <View style={styles.fieldCol}>
                        <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Selling Price (₹)</Text>
                        <TextInput
                          style={[styles.fieldInput, { backgroundColor: theme.bg, borderColor: theme.borderColor, color: theme.textPrimary }]}
                          value={String(item.sellingPrice)}
                          onChangeText={(txt) => handleUpdateItem(index, 'sellingPrice', txt)}
                          keyboardType="numeric"
                        />
                      </View>

                      <View style={styles.fieldCol}>
                        <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Cost Price (₹)</Text>
                        <TextInput
                          style={[styles.fieldInput, { backgroundColor: theme.bg, borderColor: theme.borderColor, color: theme.textPrimary }]}
                          value={String(item.costPrice)}
                          onChangeText={(txt) => handleUpdateItem(index, 'costPrice', txt)}
                          keyboardType="numeric"
                        />
                      </View>
                    </View>

                    {/* Stock, Unit & Category Grid */}
                    <View style={styles.fieldGrid}>
                      <View style={styles.fieldCol}>
                        <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Initial Stock</Text>
                        <TextInput
                          style={[styles.fieldInput, { backgroundColor: theme.bg, borderColor: theme.borderColor, color: theme.textPrimary }]}
                          value={String(item.currentStock)}
                          onChangeText={(txt) => handleUpdateItem(index, 'currentStock', txt)}
                          keyboardType="numeric"
                        />
                      </View>

                      <View style={styles.fieldCol}>
                        <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Unit</Text>
                        <TextInput
                          style={[styles.fieldInput, { backgroundColor: theme.bg, borderColor: theme.borderColor, color: theme.textPrimary }]}
                          value={item.unit}
                          onChangeText={(txt) => handleUpdateItem(index, 'unit', txt)}
                        />
                      </View>

                      <View style={styles.fieldCol}>
                        <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Category</Text>
                        <TextInput
                          style={[styles.fieldInput, { backgroundColor: theme.bg, borderColor: theme.borderColor, color: theme.textPrimary }]}
                          value={item.categoryName}
                          onChangeText={(txt) => handleUpdateItem(index, 'categoryName', txt)}
                        />
                      </View>
                    </View>

                    {/* Barcode Grid with Regenerate Button */}
                    <View style={[styles.fieldGrid, { marginTop: 4, alignItems: 'center' }]}>
                      <View style={[styles.fieldCol, { flex: 2 }]}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                          <Barcode size={13} color={BRAND_COLORS.blue600} style={{ marginRight: 4 }} />
                          <Text style={[styles.fieldLabel, { color: theme.textSecondary, marginBottom: 0 }]}>
                            Barcode (Scannable EAN-13)
                          </Text>
                        </View>
                        <TextInput
                          style={[
                            styles.fieldInput,
                            {
                              backgroundColor: theme.bg,
                              borderColor: theme.borderColor,
                              color: theme.textPrimary,
                              fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
                              letterSpacing: 0.5,
                            },
                          ]}
                          value={item.barcode || ''}
                          onChangeText={(txt) => handleUpdateItem(index, 'barcode', txt)}
                          placeholder="Auto-generated EAN-13"
                          placeholderTextColor="#94A3B8"
                        />
                      </View>

                      <TouchableOpacity
                        onPress={() => handleUpdateItem(index, 'barcode', generateEAN13Barcode())}
                        style={styles.regenBarcodeBtn}
                      >
                        <RefreshCw size={12} color={BRAND_COLORS.blue600} />
                        <Text style={styles.regenBarcodeText}>Regen Code</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
                ListFooterComponent={() => (
                  <TouchableOpacity onPress={handleAddItemRow} style={[styles.addMoreBtn, { borderColor: BRAND_COLORS.blue600 }]}>
                    <Plus size={16} color={BRAND_COLORS.blue600} />
                    <Text style={[styles.addMoreText, { color: BRAND_COLORS.blue600 }]}>Add Extra Product Row</Text>
                  </TouchableOpacity>
                )}
              />

              <View style={[styles.footer, { backgroundColor: theme.cardBg, borderTopColor: theme.borderColor }]}>
                <TouchableOpacity onPress={handleConfirmImport} disabled={submitting} style={styles.submitBtn}>
                  {submitting ? (
                    <ActivityIndicator color="#FFFFFF" style={{ marginRight: 8 }} />
                  ) : (
                    <CheckCircle2 size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                  )}
                  <Text style={styles.submitText}>
                    Confirm & Import ({extractedItems.length}) Products
                  </Text>
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
  reviewBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  reviewBannerText: { fontSize: 12, fontWeight: '800', marginLeft: 8, flex: 1 },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  searchInput: { flex: 1, fontSize: 13, fontWeight: '600', padding: 0 },
  itemCard: { borderRadius: 16, padding: 14, borderWidth: 1, marginBottom: 12 },

  itemHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  itemBadge: {
    backgroundColor: BRAND_COLORS.blue600,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginRight: 8,
  },
  itemBadgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '900' },
  itemNameInput: { flex: 1, fontSize: 14, fontWeight: '800', paddingVertical: 4 },
  deleteRowBtn: { padding: 6 },
  fieldGrid: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  fieldCol: { flex: 1, marginHorizontal: 3 },
  fieldLabel: { fontSize: 10, fontWeight: '700', marginBottom: 4 },
  fieldInput: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, fontSize: 13, fontWeight: '600' },
  regenBarcodeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(37, 99, 235, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 14,
    marginLeft: 4,
  },
  regenBarcodeText: { fontSize: 11, fontWeight: '800', color: BRAND_COLORS.blue600, marginLeft: 4 },
  addMoreBtn: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  addMoreText: { fontWeight: '800', fontSize: 13, marginLeft: 6 },
  footer: { padding: 16, borderTopWidth: 1 },
  submitBtn: {
    backgroundColor: BRAND_COLORS.blue600,
    borderRadius: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
});
