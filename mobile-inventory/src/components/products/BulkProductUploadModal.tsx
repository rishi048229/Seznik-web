import React, { useState, useEffect, useMemo } from 'react';
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
  UploadCloud,
  FileSpreadsheet,
  Download,
  FileText,
  Camera,
  ImageIcon,
  X,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Search,
  Barcode,
  RefreshCw,
  PackagePlus,
  PackageCheck,
  Ban,
  Layers,
  ChevronDown,
  ChevronUp,
  Check,
  Zap,
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as XLSX from 'xlsx';
import { useProducts } from '@/hooks/useProducts';
import { useAppTheme } from '@/hooks/useAppTheme';
import { KeyboardAvoidingWrapper } from '@/components/ui/KeyboardAvoidingWrapper';
import { BRAND_COLORS } from '@/constants/theme';
import { generateEAN13Barcode } from '@/utils/barcodeGenerator';
import { useTranslation } from '@/store/useLanguageStore';
import {
  downloadBulkUploadTemplate,
  normalizeUnit,
  UNIT_OPTIONS,
} from '@/utils/bulkTemplateGenerator';

let ImageManipulator: any = null;
try {
  ImageManipulator = require('expo-image-manipulator');
} catch (e) {
  ImageManipulator = null;
}

export interface BulkUploadProductItem {
  id: string;
  name: string;
  sellingPrice: number | string;
  costPrice: number | string;
  currentStock: number | string;
  unit: string;
  categoryName: string;
  barcode?: string;
  sku?: string;
  taxRate?: number;
  lowStockThreshold?: number;
  brand?: string;
  description?: string;
  selected?: boolean;
  isAlreadyListed?: boolean;
  matchedProductId?: string | null;
  matchedProductName?: string | null;
  currentCatalogStock?: number | null;
  importAction?: 'update_stock' | 'create_new' | 'skip';
}

interface BulkProductUploadModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccessImport?: () => void;
}

const PARSING_MESSAGES = [
  'Reading spreadsheet file...',
  'Parsing columns and product rows...',
  'Mapping product names, prices, categories, and stock...',
  'Detecting existing catalog items and barcodes...',
  'Building product review list...',
];

export function BulkProductUploadModal({
  visible,
  onClose,
  onSuccessImport,
}: BulkProductUploadModalProps) {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const { products: existingCatalog = [], aiExtractProducts, bulkCreateProducts } = useProducts();

  const [step, setStep] = useState<'select' | 'parsing' | 'review'>('select');
  const [items, setItems] = useState<BulkUploadProductItem[]>([]);
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'ready' | 'existing' | 'warnings'>('all');
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const [unitPickerItemId, setUnitPickerItemId] = useState<string | null>(null);

  // Cycle progress messages during parsing
  useEffect(() => {
    if (step === 'parsing') {
      setLoadingMsgIdx(0);
      const interval = setInterval(() => {
        setLoadingMsgIdx((prev) => (prev + 1) % PARSING_MESSAGES.length);
      }, 1500);
      return () => clearInterval(interval);
    }
  }, [step]);

  const resetState = () => {
    setStep('select');
    setItems([]);
    setSubmitting(false);
    setSearchQuery('');
    setActiveTab('all');
    setExpandedItemId(null);
    setUnitPickerItemId(null);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  // Helper to parse numeric cell values cleanly
  const parseNumericValue = (rawVal: any): number => {
    if (rawVal === undefined || rawVal === null || rawVal === '') return NaN;
    if (typeof rawVal === 'number') return isNaN(rawVal) ? NaN : rawVal;
    let str = String(rawVal).trim().replace(/^[₹$\sRs\.INR]+/i, '').trim();
    if (str.includes(',') && str.includes('.')) {
      if (str.lastIndexOf(',') > str.lastIndexOf('.')) {
        str = str.replace(/\./g, '').replace(',', '.');
      } else {
        str = str.replace(/,/g, '');
      }
    } else if (str.includes(',')) {
      const parts = str.split(',');
      if (parts.length === 2 && parts[1].length === 2) {
        str = str.replace(',', '.');
      } else {
        str = str.replace(/,/g, '');
      }
    }
    const clean = str.replace(/[^0-9.-]/g, '');
    const val = parseFloat(clean);
    return isNaN(val) ? NaN : val;
  };

  // Direct fast spreadsheet parser (Excel & CSV)
  const parseSpreadsheetData = (sheet: XLSX.WorkSheet): BulkUploadProductItem[] => {
    let jsonRows: Record<string, any>[] = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });
    if (!jsonRows || jsonRows.length === 0) return [];

    const rawRows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false });
    const isHeaderRow = (headers: any[]) => {
      if (!Array.isArray(headers)) return false;
      const hStr = headers.map((h) => String(h || '').trim().toLowerCase()).join(' ');
      return (
        (hStr.includes('name') || hStr.includes('product') || hStr.includes('item') || hStr.includes('particulars')) &&
        (hStr.includes('price') || hStr.includes('rate') || hStr.includes('mrp') || hStr.includes('cost') || hStr.includes('stock') || hStr.includes('barcode') || hStr.includes('qty'))
      );
    };

    let headerRowIdx = 0;
    if (rawRows && rawRows.length > 0) {
      for (let i = 0; i < Math.min(rawRows.length, 10); i++) {
        const row = rawRows[i];
        if (isHeaderRow(row)) {
          headerRowIdx = i;
          break;
        }
      }
    }

    if (headerRowIdx > 0) {
      jsonRows = XLSX.utils.sheet_to_json(sheet, { range: headerRowIdx, defval: '', raw: false });
      if (!jsonRows || jsonRows.length === 0) return [];
    }

    const keys = Object.keys(jsonRows[0] || {});
    if (keys.length === 0) return [];

    const cleanHeader = (h: string) => String(h || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');

    const findKeyFlexible = (patterns: RegExp[], excludePatterns: RegExp[] = []): string | undefined => {
      return keys.find((k) => {
        const raw = k.trim().toLowerCase();
        const clean = cleanHeader(k);
        const isExcluded = excludePatterns.some((ex) => ex.test(raw) || ex.test(clean));
        if (isExcluded) return false;
        return patterns.some((p) => p.test(raw) || p.test(clean));
      });
    };

    const barcodeKey = findKeyFlexible([
      /barcode/i, /bar code/i, /upc/i, /ean/i, /gtin/i, /itemcode/i, /item code/i, /articleno/i, /sku/i, /code/i,
    ]);
    const nameKey = findKeyFlexible([
      /productname/i, /product name/i, /itemname/i, /item name/i, /particulars/i, /product/i, /item/i, /title/i, /description/i, /name/i,
    ]);
    const sellingPriceKey = findKeyFlexible([
      /sellingprice/i, /selling price/i, /saleprice/i, /sale price/i, /salesprice/i, /retailprice/i, /sellingrate/i, /salesrate/i, /mrp/i, /price/i, /rate/i,
    ], [/cost/i, /purchase/i, /buy/i, /cp/i]);
    const costPriceKey = findKeyFlexible([
      /costprice/i, /cost price/i, /purchaseprice/i, /purchase price/i, /buyprice/i, /purchaserate/i, /costrate/i, /cost/i, /purchase/i, /cp/i,
    ], [/selling/i, /sale/i, /retail/i, /mrp/i]);
    const categoryKey = findKeyFlexible([
      /category/i, /cat/i, /department/i, /dept/i, /group/i, /type/i, /classification/i,
    ]);
    const stockKey = findKeyFlexible([
      /quantity/i, /qty/i, /stock/i, /openingstock/i, /currentstock/i, /availablestock/i, /balance/i, /inventory/i, /count/i,
    ]);
    const minStockKey = findKeyFlexible([
      /minstock/i, /min stock/i, /lowstock/i, /threshold/i, /minqty/i, /reorder/i, /alert/i,
    ]);
    const taxKey = findKeyFlexible([
      /taxrate/i, /tax rate/i, /gstrate/i, /gst rate/i, /tax/i, /gst/i, /vat/i,
    ]);
    const unitKey = findKeyFlexible([
      /unit/i, /uom/i, /pack/i, /measurement/i,
    ]);
    const brandKey = findKeyFlexible([
      /brand/i, /manufacturer/i, /make/i,
    ]);
    const descKey = findKeyFlexible([
      /description/i, /desc/i, /details/i, /notes/i,
    ], [nameKey ? new RegExp(nameKey, 'i') : /$^/]);

    const resultList: BulkUploadProductItem[] = [];

    jsonRows.forEach((row, idx) => {
      let name = nameKey ? String(row[nameKey] ?? '').trim() : '';
      if (name.startsWith('₹') || name.startsWith('Rs')) name = '';

      const rawBarcode = barcodeKey ? String(row[barcodeKey] ?? '').trim() : '';
      const sellVal = sellingPriceKey ? parseNumericValue(row[sellingPriceKey]) : NaN;
      const costVal = costPriceKey ? parseNumericValue(row[costPriceKey]) : NaN;
      const stockVal = stockKey ? parseNumericValue(row[stockKey]) : NaN;

      if (!name && !rawBarcode && isNaN(sellVal) && isNaN(costVal) && isNaN(stockVal)) {
        return; // Blank line
      }

      if (!name) {
        const altKey = keys.find((k) => k !== barcodeKey && String(row[k] ?? '').trim().length > 0 && isNaN(Number(row[k])));
        if (altKey) name = String(row[altKey]).trim();
      }
      if (!name) name = `Item ${resultList.length + 1}`;

      let finalBarcode = rawBarcode;
      if (!finalBarcode || finalBarcode === 'null' || finalBarcode === 'undefined' || finalBarcode === '0') {
        finalBarcode = generateEAN13Barcode();
      }

      let sellingPrice = !isNaN(sellVal) ? Math.max(0, sellVal) : 0;
      let costPrice = !isNaN(costVal) ? Math.max(0, costVal) : (sellingPrice > 0 ? sellingPrice : 0);
      if (sellingPrice === 0 && costPrice > 0) {
        sellingPrice = costPrice;
      }

      const categoryName = categoryKey && row[categoryKey] ? String(row[categoryKey]).trim() : 'General';
      const currentStock = !isNaN(stockVal) ? Math.max(0, Math.floor(stockVal)) : 10;
      const minStockVal = minStockKey && row[minStockKey] !== '' ? parseNumericValue(row[minStockKey]) : NaN;
      const lowStockThreshold = !isNaN(minStockVal) ? Math.max(0, Math.floor(minStockVal)) : 0;
      const taxVal = taxKey ? parseNumericValue(row[taxKey]) : NaN;
      const taxRate = !isNaN(taxVal) ? Math.max(0, taxVal) : 0;
      const rawUnit = unitKey && row[unitKey] ? String(row[unitKey]).trim() : '';
      const unitVal = normalizeUnit(rawUnit);
      const brand = brandKey && row[brandKey] ? String(row[brandKey]).trim() : undefined;
      const description = descKey && row[descKey] ? String(row[descKey]).trim() : undefined;

      // Match against existing catalog
      const matchedCatalogItem = existingCatalog.find(
        (ep: any) =>
          (finalBarcode && ep.barcode && ep.barcode.toLowerCase().trim() === finalBarcode.toLowerCase().trim()) ||
          (ep.name && ep.name.toLowerCase().trim() === name.toLowerCase().trim())
      );

      resultList.push({
        id: `parsed-${Date.now()}-${idx}`,
        name,
        sellingPrice,
        costPrice,
        currentStock,
        unit: unitVal,
        categoryName,
        barcode: finalBarcode,
        sku: `SKU-${Date.now().toString().slice(-6)}-${idx + 1}`,
        taxRate,
        lowStockThreshold,
        brand,
        description,
        selected: true,
        isAlreadyListed: Boolean(matchedCatalogItem),
        matchedProductId: matchedCatalogItem?.id || null,
        matchedProductName: matchedCatalogItem?.name || null,
        currentCatalogStock: matchedCatalogItem?.currentStock ?? null,
        importAction: matchedCatalogItem ? 'update_stock' : 'create_new',
      });
    });

    return resultList;
  };

  // Handle Document Picker (Excel / CSV / Documents)
  const handlePickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-excel',
          'text/csv',
          'text/comma-separated-values',
          'text/tab-separated-values',
          'application/vnd.oasis.opendocument.spreadsheet',
          'application/pdf',
          '*/*',
        ],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        const fileName = (file.name || '').toLowerCase();
        const mime = (file.mimeType || '').toLowerCase();

        setStep('parsing');

        const isSpreadsheet =
          fileName.endsWith('.xlsx') ||
          fileName.endsWith('.xls') ||
          fileName.endsWith('.csv') ||
          fileName.endsWith('.tsv') ||
          fileName.endsWith('.ods') ||
          mime.includes('sheet') ||
          mime.includes('excel') ||
          mime.includes('csv');

        if (isSpreadsheet) {
          // Read spreadsheet directly using SheetJS (XLSX)
          try {
            const base64 = await FileSystem.readAsStringAsync(file.uri, {
              encoding: FileSystem.EncodingType.Base64,
            });
            const workbook = XLSX.read(base64, { type: 'base64' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const parsed = parseSpreadsheetData(worksheet);

            if (parsed.length > 0) {
              setItems(parsed);
              setStep('review');
              return;
            }
          } catch (excelErr) {
            console.warn('Direct XLSX parsing error, trying document reader fallback:', excelErr);
          }
        }

        // Fallback or PDF document processing
        const base64 = await FileSystem.readAsStringAsync(file.uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        const res = await aiExtractProducts({
          imageBase64: base64,
          mimeType: file.mimeType || 'application/pdf',
        });

        if (res.success && Array.isArray(res.products) && res.products.length > 0) {
          const sanitized: BulkUploadProductItem[] = res.products.map((item: any, idx: number) => {
            const existingBarcode = item.barcode ? String(item.barcode).replace(/[^a-zA-Z0-9]/g, '').trim() : '';
            const finalBarcode = existingBarcode.length > 0 ? existingBarcode : generateEAN13Barcode();
            const isListed = Boolean(item.isAlreadyListed);

            return {
              id: item.id || `doc-${Date.now()}-${idx}`,
              name: String(item.name || 'Product').trim(),
              sellingPrice: item.sellingPrice !== undefined ? item.sellingPrice : 0,
              costPrice: item.costPrice !== undefined ? item.costPrice : 0,
              currentStock: item.currentStock !== undefined ? item.currentStock : 10,
              unit: normalizeUnit(item.unit || 'piece'),
              categoryName: String(item.categoryName || 'General').trim(),
              barcode: finalBarcode,
              sku: item.sku ? String(item.sku).trim() : `SKU-${Date.now().toString().slice(-6)}-${idx + 1}`,
              selected: true,
              isAlreadyListed: isListed,
              matchedProductId: item.matchedProductId || null,
              matchedProductName: item.matchedProductName || null,
              currentCatalogStock: item.currentCatalogStock !== undefined ? item.currentCatalogStock : null,
              importAction: item.importAction || (isListed ? 'update_stock' : 'create_new'),
            };
          });
          setItems(sanitized);
          setStep('review');
        } else {
          Alert.alert(
            'No Products Found',
            'Could not extract clear product rows from this file. Please check that column headers match the template.',
            [{ text: 'Try Again', onPress: () => setStep('select') }]
          );
        }
      }
    } catch (err: any) {
      console.error('File parsing error:', err);
      Alert.alert('Upload Error', err?.message || 'Failed to process document', [
        { text: 'OK', onPress: () => setStep('select') },
      ]);
    }
  };

  // Handle Photo Gallery / Camera bill pick
  const handlePickPhoto = async (source: 'camera' | 'gallery') => {
    try {
      let result;
      if (source === 'camera') {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          Alert.alert('Permission Denied', 'Camera access is required to capture bills or product lists.');
          return;
        }
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ['images'],
          allowsEditing: false,
          quality: 0.6,
        });
      } else {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
          Alert.alert('Permission Denied', 'Photo gallery permission is required.');
          return;
        }
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          allowsEditing: false,
          quality: 0.6,
        });
      }

      if (!result.canceled && result.assets[0]?.uri) {
        const asset = result.assets[0];
        setStep('parsing');

        let base64Data = asset.base64;
        if (!base64Data && ImageManipulator && typeof ImageManipulator.manipulateAsync === 'function') {
          try {
            const manipResult = await ImageManipulator.manipulateAsync(
              asset.uri,
              [{ resize: { width: 1024 } }],
              { compress: 0.6, format: 'jpeg', base64: true }
            );
            if (manipResult.base64) base64Data = manipResult.base64;
          } catch (e) {
            console.warn('ImageManipulator fallback:', e);
          }
        }

        if (!base64Data) {
          base64Data = await FileSystem.readAsStringAsync(asset.uri, {
            encoding: FileSystem.EncodingType.Base64,
          });
        }

        const res = await aiExtractProducts({
          imageBase64: base64Data,
          mimeType: 'image/jpeg',
        });

        if (res.success && Array.isArray(res.products) && res.products.length > 0) {
          const sanitized: BulkUploadProductItem[] = res.products.map((item: any, idx: number) => {
            const existingBarcode = item.barcode ? String(item.barcode).replace(/[^a-zA-Z0-9]/g, '').trim() : '';
            const finalBarcode = existingBarcode.length > 0 ? existingBarcode : generateEAN13Barcode();
            const isListed = Boolean(item.isAlreadyListed);

            return {
              id: item.id || `img-${Date.now()}-${idx}`,
              name: String(item.name || 'Product').trim(),
              sellingPrice: item.sellingPrice !== undefined ? item.sellingPrice : 0,
              costPrice: item.costPrice !== undefined ? item.costPrice : 0,
              currentStock: item.currentStock !== undefined ? item.currentStock : 10,
              unit: normalizeUnit(item.unit || 'piece'),
              categoryName: String(item.categoryName || 'General').trim(),
              barcode: finalBarcode,
              sku: item.sku ? String(item.sku).trim() : `SKU-${Date.now().toString().slice(-6)}-${idx + 1}`,
              selected: true,
              isAlreadyListed: isListed,
              matchedProductId: item.matchedProductId || null,
              matchedProductName: item.matchedProductName || null,
              currentCatalogStock: item.currentCatalogStock !== undefined ? item.currentCatalogStock : null,
              importAction: item.importAction || (isListed ? 'update_stock' : 'create_new'),
            };
          });
          setItems(sanitized);
          setStep('review');
        } else {
          Alert.alert(
            'No Products Found',
            'Could not detect product entries in this image. Please try a clearer photo or an Excel spreadsheet file.',
            [{ text: 'Try Again', onPress: () => setStep('select') }]
          );
        }
      }
    } catch (err: any) {
      console.error('Image upload error:', err);
      Alert.alert('Upload Error', err?.message || 'Failed to process document', [
        { text: 'OK', onPress: () => setStep('select') },
      ]);
    }
  };

  const handleUpdateItem = (id: string, key: keyof BulkUploadProductItem, value: any) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [key]: value } : item))
    );
  };

  const handleRemoveItem = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const handleSetGlobalActionForExisting = (action: 'update_stock' | 'create_new' | 'skip') => {
    setItems((prev) =>
      prev.map((item) => (item.isAlreadyListed ? { ...item, importAction: action } : item))
    );
  };

  const handleAddNewItem = () => {
    const newItem: BulkUploadProductItem = {
      id: `manual-${Date.now()}-${items.length}`,
      name: '',
      sellingPrice: 100,
      costPrice: 80,
      currentStock: 10,
      unit: 'piece',
      categoryName: 'General',
      barcode: generateEAN13Barcode(),
      sku: `SKU-${Date.now().toString().slice(-6)}-${items.length + 1}`,
      selected: true,
      isAlreadyListed: false,
      importAction: 'create_new',
    };
    setItems((prev) => [newItem, ...prev]);
    setExpandedItemId(newItem.id);
  };

  const handleConfirmImport = async () => {
    const itemsToProcess = items.filter((i) => i.importAction !== 'skip' && (i.selected !== false));

    if (itemsToProcess.length === 0) {
      Alert.alert('No Items Selected', 'All items are currently set to Skip or deselected. Please select at least one product to import.');
      return;
    }

    // Validation: Check for items with missing names
    const invalidNames = itemsToProcess.filter((i) => !i.name || !i.name.trim());
    if (invalidNames.length > 0) {
      Alert.alert('Missing Product Names', `There are ${invalidNames.length} items without product names. Please enter valid names before importing.`);
      return;
    }

    setSubmitting(true);
    try {
      const payload = itemsToProcess.map((p, idx) => {
        const cleanBar = p.barcode ? String(p.barcode).trim() : '';
        const finalBar = cleanBar.length > 0 ? cleanBar : generateEAN13Barcode();
        return {
          name: p.name.trim(),
          sellingPrice: parseFloat(String(p.sellingPrice)) || 0,
          costPrice: parseFloat(String(p.costPrice)) || 0,
          currentStock: parseInt(String(p.currentStock)) || 0,
          unit: (p.unit || 'piece').trim(),
          categoryName: (p.categoryName || 'General').trim(),
          barcode: finalBar,
          sku: p.sku ? String(p.sku).trim() : `SKU-${Date.now().toString().slice(-6)}-${idx + 1}`,
          lowStockThreshold: p.lowStockThreshold || 0,
          taxRate: p.taxRate || 0,
          brand: p.brand || undefined,
          description: p.description || undefined,
          importAction: p.importAction || (p.isAlreadyListed ? 'update_stock' : 'create_new'),
          matchedProductId: p.matchedProductId || undefined,
        };
      });

      const res: any = await bulkCreateProducts(payload);

      const updatedCount = res?.updatedCount || 0;
      const createdCount = res?.createdCount || (payload.length - updatedCount);

      let msg = `Successfully processed ${payload.length} products.`;
      if (updatedCount > 0 && createdCount > 0) {
        msg = `Restocked ${updatedCount} existing catalog items and created ${createdCount} new products!`;
      } else if (updatedCount > 0) {
        msg = `Updated stock for ${updatedCount} existing catalog products!`;
      } else {
        msg = `Created ${createdCount} new products in your inventory!`;
      }

      Alert.alert('Import Successful!', msg, [
        {
          text: 'View Inventory',
          onPress: () => {
            if (onSuccessImport) onSuccessImport();
            handleClose();
          },
        },
      ]);
    } catch (err: any) {
      Alert.alert('Import Failed', err?.message || 'Failed to save imported products to database.');
    } finally {
      setSubmitting(false);
    }
  };

  // Counts & Filtered items
  const existingCount = items.filter((i) => i.isAlreadyListed).length;
  const readyCount = items.filter((i) => i.name.trim().length > 0 && i.importAction !== 'skip').length;
  const warningCount = items.filter((i) => !i.name.trim() || Number(i.sellingPrice) <= 0).length;

  const filteredItems = useMemo(() => {
    return items.filter((i) => {
      // Tab filter
      if (activeTab === 'ready' && (i.importAction === 'skip' || !i.name.trim())) return false;
      if (activeTab === 'existing' && !i.isAlreadyListed) return false;
      if (activeTab === 'warnings' && i.name.trim() && Number(i.sellingPrice) > 0) return false;

      // Query filter
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        i.name.toLowerCase().includes(q) ||
        (i.categoryName || '').toLowerCase().includes(q) ||
        (i.barcode || '').toLowerCase().includes(q)
      );
    });
  }, [items, activeTab, searchQuery]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
      <KeyboardAvoidingWrapper inModal>
        <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: theme.borderColor }]}>
            <View style={styles.titleRow}>
              <View style={styles.iconBadge}>
                <FileSpreadsheet size={18} color="#FFFFFF" />
              </View>
              <View style={{ marginLeft: 10 }}>
                <Text style={[styles.title, { color: theme.textPrimary }]}>Bulk Product Upload</Text>
                <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
                  Excel, CSV & Document Import
                </Text>
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

          {/* STEP 1: SELECT / UPLOAD */}
          {step === 'select' && (
            <ScrollView
              style={{ flex: 1, padding: 16 }}
              contentContainerStyle={{ paddingBottom: 40 }}
              showsVerticalScrollIndicator={false}
            >
              {/* Step 1: Download Templates Banner */}
              <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
                <View style={styles.cardHeader}>
                  <View style={[styles.stepNumberBadge, { backgroundColor: BRAND_COLORS.blue600 }]}>
                    <Text style={styles.stepNumberText}>1</Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>Download Template</Text>
                    <Text style={[styles.cardSubtitle, { color: theme.textSecondary }]}>
                      Pre-formatted sample file with columns and guidelines
                    </Text>
                  </View>
                </View>

                <View style={styles.templateButtonsRow}>
                  <TouchableOpacity
                    onPress={() => downloadBulkUploadTemplate('xlsx')}
                    style={[styles.templateBtn, { backgroundColor: '#10B981', flex: 1 }]}
                    activeOpacity={0.8}
                  >
                    <Download size={16} color="#FFFFFF" />
                    <Text style={styles.templateBtnText}>Excel (.xlsx)</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => downloadBulkUploadTemplate('csv')}
                    style={[styles.templateBtn, { backgroundColor: '#2563EB', flex: 1 }]}
                    activeOpacity={0.8}
                  >
                    <Download size={16} color="#FFFFFF" />
                    <Text style={styles.templateBtnText}>CSV (.csv)</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Step 2: Upload Files Card */}
              <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.borderColor, marginTop: 14 }]}>
                <View style={styles.cardHeader}>
                  <View style={[styles.stepNumberBadge, { backgroundColor: BRAND_COLORS.blue600 }]}>
                    <Text style={styles.stepNumberText}>2</Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>Upload Spreadsheet File</Text>
                    <Text style={[styles.cardSubtitle, { color: theme.textSecondary }]}>
                      Choose an Excel (.xlsx, .xls) or CSV spreadsheet
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  onPress={handlePickDocument}
                  style={[styles.uploadBox, { borderColor: BRAND_COLORS.blue600, backgroundColor: 'rgba(37, 99, 235, 0.04)' }]}
                  activeOpacity={0.7}
                >
                  <View style={[styles.uploadCircleIcon, { backgroundColor: 'rgba(37, 99, 235, 0.12)' }]}>
                    <UploadCloud size={32} color={BRAND_COLORS.blue600} />
                  </View>
                  <Text style={[styles.uploadBoxTitle, { color: theme.textPrimary }]}>Select Spreadsheet File</Text>
                  <Text style={[styles.uploadBoxSub, { color: theme.textSecondary }]}>
                    Supports .xlsx, .xls, .csv, .tsv, .ods
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Step 3: Or Scan / Photo Bill Option */}
              <Text style={[styles.sectionHeading, { color: theme.textPrimary, marginTop: 22, marginBottom: 10 }]}>
                Or Scan Bill / Invoice
              </Text>

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TouchableOpacity
                  onPress={() => handlePickPhoto('camera')}
                  style={[styles.secondaryOptionCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}
                  activeOpacity={0.7}
                >
                  <View style={[styles.optionIconBox, { backgroundColor: '#059669' }]}>
                    <Camera size={20} color="#FFFFFF" />
                  </View>
                  <Text style={[styles.secondaryOptionTitle, { color: theme.textPrimary }]}>Take Photo</Text>
                  <Text style={[styles.secondaryOptionSub, { color: theme.textSecondary }]}>Snap bill photo</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => handlePickPhoto('gallery')}
                  style={[styles.secondaryOptionCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}
                  activeOpacity={0.7}
                >
                  <View style={[styles.optionIconBox, { backgroundColor: '#7C3AED' }]}>
                    <ImageIcon size={20} color="#FFFFFF" />
                  </View>
                  <Text style={[styles.secondaryOptionTitle, { color: theme.textPrimary }]}>Gallery</Text>
                  <Text style={[styles.secondaryOptionSub, { color: theme.textSecondary }]}>Pick bill image</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          )}

          {/* STEP 2: PARSING STATE */}
          {step === 'parsing' && (
            <View style={styles.loadingContainer}>
              <View style={[styles.pulseCircle, { backgroundColor: BRAND_COLORS.blue600 }]}>
                <FileSpreadsheet size={36} color="#FFFFFF" />
              </View>
              <Text style={[styles.loadingTitle, { color: theme.textPrimary }]}>Processing Spreadsheet</Text>
              <Text style={[styles.loadingSub, { color: theme.textSecondary }]}>{PARSING_MESSAGES[loadingMsgIdx]}</Text>
              <ActivityIndicator size="large" color={BRAND_COLORS.blue600} style={{ marginTop: 24 }} />
            </View>
          )}

          {/* STEP 3: REVIEW & EDIT EXTRACTED PRODUCTS */}
          {step === 'review' && (
            <View style={{ flex: 1 }}>
              {/* Summary Banner */}
              <View style={[styles.reviewBanner, { backgroundColor: 'rgba(37, 99, 235, 0.08)' }]}>
                <CheckCircle2 size={18} color={BRAND_COLORS.blue600} />
                <Text style={[styles.reviewBannerText, { color: theme.textPrimary }]}>
                  Found {items.length} products to import
                  {existingCount > 0 ? ` (${existingCount} already in catalog)` : ''}
                </Text>
              </View>

              {/* Global Batch Action Bar for Existing Products */}
              {existingCount > 0 && (
                <View style={[styles.batchActionBar, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                    <Layers size={14} color={BRAND_COLORS.blue600} style={{ marginRight: 6 }} />
                    <Text style={[styles.batchActionTitle, { color: theme.textPrimary }]}>
                      {existingCount} Existing Catalog Products Found:
                    </Text>
                  </View>
                  <View style={styles.batchBtnRow}>
                    <TouchableOpacity
                      onPress={() => handleSetGlobalActionForExisting('update_stock')}
                      style={[styles.batchBtn, { backgroundColor: '#10B981' }]}
                    >
                      <PackageCheck size={13} color="#FFFFFF" style={{ marginRight: 4 }} />
                      <Text style={styles.batchBtnText}>Update Stock</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => handleSetGlobalActionForExisting('create_new')}
                      style={[styles.batchBtn, { backgroundColor: '#6366F1' }]}
                    >
                      <PackagePlus size={13} color="#FFFFFF" style={{ marginRight: 4 }} />
                      <Text style={styles.batchBtnText}>Create New</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => handleSetGlobalActionForExisting('skip')}
                      style={[styles.batchBtn, { backgroundColor: '#EF4444' }]}
                    >
                      <Ban size={13} color="#FFFFFF" style={{ marginRight: 4 }} />
                      <Text style={styles.batchBtnText}>Skip All</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* Filter Tabs & Search Row */}
              <View style={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: 6 }}>
                <View style={[styles.searchBox, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
                  <Search size={16} color={theme.textSecondary} />
                  <TextInput
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    placeholder="Search parsed items..."
                    placeholderTextColor={theme.textSecondary}
                    style={[styles.searchInput, { color: theme.textPrimary }]}
                  />
                  {searchQuery.length > 0 && (
                    <TouchableOpacity onPress={() => setSearchQuery('')}>
                      <X size={16} color={theme.textSecondary} />
                    </TouchableOpacity>
                  )}
                </View>

                {/* Tabs */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    <TouchableOpacity
                      onPress={() => setActiveTab('all')}
                      style={[
                        styles.filterTab,
                        activeTab === 'all' && styles.filterTabActive,
                        { borderColor: theme.borderColor },
                      ]}
                    >
                      <Text style={[styles.filterTabText, activeTab === 'all' && styles.filterTabTextActive]}>
                        All ({items.length})
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => setActiveTab('ready')}
                      style={[
                        styles.filterTab,
                        activeTab === 'ready' && styles.filterTabActive,
                        { borderColor: theme.borderColor },
                      ]}
                    >
                      <Text style={[styles.filterTabText, activeTab === 'ready' && styles.filterTabTextActive]}>
                        Ready ({readyCount})
                      </Text>
                    </TouchableOpacity>

                    {existingCount > 0 && (
                      <TouchableOpacity
                        onPress={() => setActiveTab('existing')}
                        style={[
                          styles.filterTab,
                          activeTab === 'existing' && styles.filterTabActive,
                          { borderColor: theme.borderColor },
                        ]}
                      >
                        <Text style={[styles.filterTabText, activeTab === 'existing' && styles.filterTabTextActive]}>
                          In Catalog ({existingCount})
                        </Text>
                      </TouchableOpacity>
                    )}

                    {warningCount > 0 && (
                      <TouchableOpacity
                        onPress={() => setActiveTab('warnings')}
                        style={[
                          styles.filterTab,
                          activeTab === 'warnings' && styles.filterTabActive,
                          { borderColor: '#F59E0B' },
                        ]}
                      >
                        <Text style={[styles.filterTabText, { color: '#F59E0B' }]}>
                          Warnings ({warningCount})
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </ScrollView>
              </View>

              {/* Items List */}
              <FlatList
                data={filteredItems}
                keyExtractor={(item) => item.id}
                contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={
                  <View style={styles.emptyList}>
                    <Text style={[styles.emptyListText, { color: theme.textSecondary }]}>
                      No products match the current filter.
                    </Text>
                  </View>
                }
                renderItem={({ item, index }) => {
                  const isExpanded = expandedItemId === item.id;
                  const hasWarning = !item.name.trim() || Number(item.sellingPrice) <= 0;

                  return (
                    <View
                      style={[
                        styles.productCard,
                        {
                          backgroundColor: theme.cardBg,
                          borderColor: hasWarning ? '#F59E0B' : theme.borderColor,
                        },
                      ]}
                    >
                      {/* Product Card Header */}
                      <View style={styles.productCardHeader}>
                        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
                          <View style={styles.itemIndexCircle}>
                            <Text style={styles.itemIndexText}>{index + 1}</Text>
                          </View>
                          {item.isAlreadyListed ? (
                            <View style={[styles.badge, { backgroundColor: 'rgba(59, 130, 246, 0.15)' }]}>
                              <Text style={[styles.badgeText, { color: '#2563EB' }]}>
                                In Catalog ({item.currentCatalogStock ?? 0} in stock)
                              </Text>
                            </View>
                          ) : (
                            <View style={[styles.badge, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
                              <Text style={[styles.badgeText, { color: '#10B981' }]}>New Product</Text>
                            </View>
                          )}
                        </View>

                        <TouchableOpacity
                          onPress={() => handleRemoveItem(item.id)}
                          style={styles.deleteRowBtn}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Trash2 size={16} color="#EF4444" />
                        </TouchableOpacity>
                      </View>

                      {/* Action selector for existing items */}
                      {item.isAlreadyListed && (
                        <View style={styles.actionSelectRow}>
                          <Text style={[styles.actionLabel, { color: theme.textSecondary }]}>Action:</Text>
                          <View style={styles.actionPillGroup}>
                            <TouchableOpacity
                              onPress={() => handleUpdateItem(item.id, 'importAction', 'update_stock')}
                              style={[
                                styles.actionPill,
                                item.importAction === 'update_stock' && {
                                  backgroundColor: '#10B981',
                                  borderColor: '#10B981',
                                },
                              ]}
                            >
                              <Text
                                style={[
                                  styles.actionPillText,
                                  item.importAction === 'update_stock' && { color: '#FFFFFF' },
                                ]}
                              >
                                Update Stock
                              </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                              onPress={() => handleUpdateItem(item.id, 'importAction', 'create_new')}
                              style={[
                                styles.actionPill,
                                item.importAction === 'create_new' && {
                                  backgroundColor: '#6366F1',
                                  borderColor: '#6366F1',
                                },
                              ]}
                            >
                              <Text
                                style={[
                                  styles.actionPillText,
                                  item.importAction === 'create_new' && { color: '#FFFFFF' },
                                ]}
                              >
                                Create New
                              </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                              onPress={() => handleUpdateItem(item.id, 'importAction', 'skip')}
                              style={[
                                styles.actionPill,
                                item.importAction === 'skip' && {
                                  backgroundColor: '#EF4444',
                                  borderColor: '#EF4444',
                                },
                              ]}
                            >
                              <Text
                                style={[
                                  styles.actionPillText,
                                  item.importAction === 'skip' && { color: '#FFFFFF' },
                                ]}
                              >
                                Skip
                              </Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      )}

                      {/* Name input */}
                      <View style={{ marginTop: 8 }}>
                        <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Product Name *</Text>
                        <TextInput
                          value={item.name}
                          onChangeText={(t) => handleUpdateItem(item.id, 'name', t)}
                          placeholder="e.g. Parle-G Gold 100g"
                          placeholderTextColor={theme.textSecondary}
                          style={[styles.inputField, { color: theme.textPrimary, borderColor: theme.borderColor }]}
                        />
                      </View>

                      {/* Category & Unit Row */}
                      <View style={styles.twoColRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Category</Text>
                          <TextInput
                            value={item.categoryName}
                            onChangeText={(t) => handleUpdateItem(item.id, 'categoryName', t)}
                            placeholder="General"
                            placeholderTextColor={theme.textSecondary}
                            style={[styles.inputField, { color: theme.textPrimary, borderColor: theme.borderColor }]}
                          />
                        </View>

                        <View style={{ flex: 1 }}>
                          <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Unit</Text>
                          <TouchableOpacity
                            onPress={() => setUnitPickerItemId(unitPickerItemId === item.id ? null : item.id)}
                            style={[styles.unitSelectorBtn, { borderColor: theme.borderColor }]}
                          >
                            <Text style={[styles.unitSelectorText, { color: theme.textPrimary }]}>
                              {item.unit || 'piece'}
                            </Text>
                            <ChevronDown size={14} color={theme.textSecondary} />
                          </TouchableOpacity>
                        </View>
                      </View>

                      {/* Unit Picker Modal Dropdown */}
                      {unitPickerItemId === item.id && (
                        <View style={[styles.unitDropdownList, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
                          {UNIT_OPTIONS.map((u) => (
                            <TouchableOpacity
                              key={u.key}
                              onPress={() => {
                                handleUpdateItem(item.id, 'unit', u.key);
                                setUnitPickerItemId(null);
                              }}
                              style={[
                                styles.unitDropdownItem,
                                item.unit === u.key && { backgroundColor: 'rgba(37, 99, 235, 0.12)' },
                              ]}
                            >
                              <Text
                                style={[
                                  styles.unitDropdownItemText,
                                  { color: item.unit === u.key ? BRAND_COLORS.blue600 : theme.textPrimary },
                                ]}
                              >
                                {u.label}
                              </Text>
                              {item.unit === u.key && <Check size={14} color={BRAND_COLORS.blue600} />}
                            </TouchableOpacity>
                          ))}
                        </View>
                      )}

                      {/* Cost, Selling Price & Stock Row */}
                      <View style={styles.threeColRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Cost (₹)</Text>
                          <TextInput
                            value={String(item.costPrice)}
                            onChangeText={(t) => handleUpdateItem(item.id, 'costPrice', t)}
                            keyboardType="numeric"
                            placeholder="0"
                            placeholderTextColor={theme.textSecondary}
                            style={[styles.inputField, { color: theme.textPrimary, borderColor: theme.borderColor }]}
                          />
                        </View>

                        <View style={{ flex: 1 }}>
                          <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Sell (₹) *</Text>
                          <TextInput
                            value={String(item.sellingPrice)}
                            onChangeText={(t) => handleUpdateItem(item.id, 'sellingPrice', t)}
                            keyboardType="numeric"
                            placeholder="0"
                            placeholderTextColor={theme.textSecondary}
                            style={[styles.inputField, { color: theme.textPrimary, borderColor: theme.borderColor }]}
                          />
                        </View>

                        <View style={{ flex: 1 }}>
                          <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Stock</Text>
                          <TextInput
                            value={String(item.currentStock)}
                            onChangeText={(t) => handleUpdateItem(item.id, 'currentStock', t)}
                            keyboardType="numeric"
                            placeholder="10"
                            placeholderTextColor={theme.textSecondary}
                            style={[styles.inputField, { color: theme.textPrimary, borderColor: theme.borderColor }]}
                          />
                        </View>
                      </View>

                      {/* Barcode & Extra Toggle */}
                      <View style={{ marginTop: 8 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                          <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Barcode</Text>
                          <TouchableOpacity
                            onPress={() => handleUpdateItem(item.id, 'barcode', generateEAN13Barcode())}
                            style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}
                          >
                            <RefreshCw size={11} color={BRAND_COLORS.blue600} style={{ marginRight: 4 }} />
                            <Text style={{ fontSize: 11, color: BRAND_COLORS.blue600, fontWeight: '600' }}>
                              Auto Generate
                            </Text>
                          </TouchableOpacity>
                        </View>
                        <TextInput
                          value={item.barcode}
                          onChangeText={(t) => handleUpdateItem(item.id, 'barcode', t)}
                          placeholder="Barcode / EAN"
                          placeholderTextColor={theme.textSecondary}
                          style={[styles.inputField, { color: theme.textPrimary, borderColor: theme.borderColor }]}
                        />
                      </View>

                      {/* Expandable Details Toggle */}
                      <TouchableOpacity
                        onPress={() => setExpandedItemId(isExpanded ? null : item.id)}
                        style={styles.expandToggle}
                      >
                        <Text style={[styles.expandToggleText, { color: BRAND_COLORS.blue600 }]}>
                          {isExpanded ? 'Hide Extra Fields' : 'More Options (Tax, Min Stock, Brand)'}
                        </Text>
                        {isExpanded ? (
                          <ChevronUp size={14} color={BRAND_COLORS.blue600} />
                        ) : (
                          <ChevronDown size={14} color={BRAND_COLORS.blue600} />
                        )}
                      </TouchableOpacity>

                      {/* Expandable Fields */}
                      {isExpanded && (
                        <View style={styles.expandedSection}>
                          <View style={styles.twoColRow}>
                            <View style={{ flex: 1 }}>
                              <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Min Stock Alert</Text>
                              <TextInput
                                value={String(item.lowStockThreshold ?? 0)}
                                onChangeText={(t) => handleUpdateItem(item.id, 'lowStockThreshold', parseInt(t) || 0)}
                                keyboardType="numeric"
                                placeholder="0"
                                placeholderTextColor={theme.textSecondary}
                                style={[styles.inputField, { color: theme.textPrimary, borderColor: theme.borderColor }]}
                              />
                            </View>

                            <View style={{ flex: 1 }}>
                              <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Tax Rate (%)</Text>
                              <TextInput
                                value={String(item.taxRate ?? 0)}
                                onChangeText={(t) => handleUpdateItem(item.id, 'taxRate', parseFloat(t) || 0)}
                                keyboardType="numeric"
                                placeholder="0"
                                placeholderTextColor={theme.textSecondary}
                                style={[styles.inputField, { color: theme.textPrimary, borderColor: theme.borderColor }]}
                              />
                            </View>
                          </View>

                          <View style={{ marginTop: 8 }}>
                            <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Brand (Optional)</Text>
                            <TextInput
                              value={item.brand || ''}
                              onChangeText={(t) => handleUpdateItem(item.id, 'brand', t)}
                              placeholder="Brand name"
                              placeholderTextColor={theme.textSecondary}
                              style={[styles.inputField, { color: theme.textPrimary, borderColor: theme.borderColor }]}
                            />
                          </View>
                        </View>
                      )}
                    </View>
                  );
                }}
              />

              {/* Bottom Sticky Action Bar */}
              <View style={[styles.bottomBar, { backgroundColor: theme.cardBg, borderTopColor: theme.borderColor }]}>
                <TouchableOpacity
                  onPress={handleAddNewItem}
                  style={[styles.addNewRowBtn, { borderColor: theme.borderColor }]}
                >
                  <Plus size={16} color={theme.textPrimary} />
                  <Text style={[styles.addNewRowText, { color: theme.textPrimary }]}>Add Row</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleConfirmImport}
                  disabled={submitting}
                  style={[
                    styles.importSubmitBtn,
                    { backgroundColor: BRAND_COLORS.blue600 },
                    submitting && { opacity: 0.7 },
                  ]}
                  activeOpacity={0.8}
                >
                  {submitting ? (
                    <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 8 }} />
                  ) : (
                    <CheckCircle2 size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                  )}
                  <Text style={styles.importSubmitBtnText}>
                    {submitting ? 'Importing...' : `Import ${readyCount} Products`}
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
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: BRAND_COLORS.blue600,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 12,
    marginTop: 1,
  },
  closeBtn: {
    padding: 6,
  },
  card: {
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepNumberBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  cardSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  templateButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  templateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    gap: 6,
  },
  templateBtnText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 13,
  },
  uploadBox: {
    marginTop: 14,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: 12,
    paddingVertical: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadCircleIcon: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  uploadBoxTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  uploadBoxSub: {
    fontSize: 12,
    marginTop: 4,
  },
  sectionHeading: {
    fontSize: 14,
    fontWeight: '600',
  },
  secondaryOptionCard: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  optionIconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  secondaryOptionTitle: {
    fontSize: 13,
    fontWeight: '600',
  },
  secondaryOptionSub: {
    fontSize: 11,
    marginTop: 2,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  pulseCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  loadingTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  loadingSub: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 8,
    maxWidth: 280,
  },
  reviewBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  reviewBannerText: {
    fontSize: 13,
    fontWeight: '600',
  },
  batchActionBar: {
    padding: 12,
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  batchActionTitle: {
    fontSize: 12,
    fontWeight: '600',
  },
  batchBtnRow: {
    flexDirection: 'row',
    gap: 8,
  },
  batchBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    borderRadius: 8,
  },
  batchBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 13,
    padding: 0,
  },
  filterTab: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  filterTabActive: {
    backgroundColor: BRAND_COLORS.blue600,
    borderColor: BRAND_COLORS.blue600,
  },
  filterTabText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#64748B',
  },
  filterTabTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  productCard: {
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    marginBottom: 12,
  },
  productCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  itemIndexCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(100, 116, 139, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  itemIndexText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  deleteRowBtn: {
    padding: 4,
  },
  actionSelectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(100, 116, 139, 0.2)',
  },
  actionLabel: {
    fontSize: 11,
    fontWeight: '500',
    marginRight: 8,
  },
  actionPillGroup: {
    flexDirection: 'row',
    gap: 6,
  },
  actionPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(100, 116, 139, 0.3)',
  },
  actionPillText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '500',
    marginBottom: 3,
  },
  inputField: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 13,
  },
  twoColRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  threeColRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 8,
  },
  unitSelectorBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  unitSelectorText: {
    fontSize: 12,
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  unitDropdownList: {
    borderWidth: 1,
    borderRadius: 8,
    marginTop: 4,
    padding: 4,
  },
  unitDropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
  },
  unitDropdownItemText: {
    fontSize: 12,
    fontWeight: '500',
  },
  expandToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    paddingVertical: 4,
    gap: 4,
  },
  expandToggleText: {
    fontSize: 11,
    fontWeight: '600',
  },
  expandedSection: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(100, 116, 139, 0.2)',
  },
  emptyList: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyListText: {
    fontSize: 13,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    gap: 10,
  },
  addNewRowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    gap: 4,
  },
  addNewRowText: {
    fontSize: 13,
    fontWeight: '600',
  },
  importSubmitBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    borderRadius: 10,
  },
  importSubmitBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
