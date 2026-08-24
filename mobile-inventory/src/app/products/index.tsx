import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  FlatList,
  Modal,
  ActivityIndicator,
  Alert,
  Switch,
  StyleSheet,
  StatusBar,
  Vibration,
  Image,
  Platform,
} from 'react-native';
import { useSafeAreaInsets, SafeAreaView } from 'react-native-safe-area-context';
import {
  Search,
  Plus,
  Camera,
  Layers,
  X,
  Edit3,
  Trash2,
  ArrowLeft,
  Barcode,
  ChevronDown,
  Info,
  QrCode,
  Zap,
  Check,
  Package,
  DollarSign,
  Box,
  Tag,
  Download,
  Share2,
  RefreshCw,
  TrendingUp,
  CheckCircle2,
  MinusCircle,
  ImageIcon,
  Sparkles,
  Percent,
  Receipt,
} from 'lucide-react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useProducts } from '@/hooks/useProducts';
import { useCategories } from '@/hooks/useCategories';
import { useSuppliers } from '@/hooks/useSuppliers';
import { Product } from '@/types/product';
import { BRAND_COLORS } from '@/constants/theme';
import {
  generateEAN13Barcode,
  generateCode128Barcode,
} from '@/utils/barcodeGenerator';
import { BarcodeQRCodeLabel } from '@/components/ui/BarcodeQRCodeLabel';
import { BarcodePrintModal } from '@/components/ui/BarcodePrintModal';
import { AiProductImportModal } from '@/components/products/AiProductImportModal';
import { useAppTheme } from '@/hooks/useAppTheme';
import { ScreenBackground } from '@/components/ui/ScreenBackground';
import { KeyboardAvoidingWrapper } from '@/components/ui/KeyboardAvoidingWrapper';
import { ProductsListSkeleton } from '@/components/ui/ScreenSkeleton';
import { ScreenLoadingState } from '@/components/ui/ScreenLoadingState';
import { useLanguageStore } from '@/store/useLanguageStore';
import { matchProductByCode } from '@/utils/productBarcodeMatch';
import { GST_SLAB_OPTIONS, GST_CUSTOM_OPTION, getGstSlabLabel, isStandardGstSlab } from '@/constants/gstSlabs';
import { calculateProductGstBreakdown } from '@/utils/gst';
import { GstBreakdownCard } from '@/components/products/GstBreakdownCard';

export default function ProductsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useLanguageStore();
  const {
    products,
    isLoading,
    isError,
    error,
    createProduct,
    updateProduct,
    deleteProduct,
    adjustStock,
    getByBarcode,
    refetch: refetchProducts,
  } = useProducts();
  const { categories, createCategory } = useCategories();
  const { suppliers, createSupplier } = useSuppliers();

  const [permission, requestPermission] = useCameraPermissions();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);

  // Barcode & QR Label Printing Modal State
  const [barcodePrintProduct, setBarcodePrintProduct] = useState<Product | null>(null);
  const [showBarcodePrintModal, setShowBarcodePrintModal] = useState(false);

  // Scanner & Stock Update HUD States
  const [showStockScanMode, setShowStockScanMode] = useState(false);
  const [scannedProductForStock, setScannedProductForStock] = useState<Product | null>(null);
  const [scanQtyDelta, setScanQtyDelta] = useState('1');
  const [scanModeType, setScanModeType] = useState<'add' | 'reduce'>('add');
  const [lastScannedBarcode, setLastScannedBarcode] = useState<string | null>(null);

  // AI Product Import Modal State
  const [showAiModal, setShowAiModal] = useState(false);

  // General Camera & Modal States
  const [showScanner, setShowScanner] = useState(false);
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Product Detail View Modal State
  const [detailProduct, setDetailProduct] = useState<Product | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // Restock Quick Modal State
  const [showRestockModal, setShowRestockModal] = useState(false);
  const [restockQtyInput, setRestockQtyInput] = useState('');

  // Quick Add Category Modal State
  const [showAddCatModal, setShowAddCatModal] = useState(false);
  const [newCatName, setNewCatName] = useState('');

  // Form Dropdowns
  const [showGstDropdown, setShowGstDropdown] = useState(false);
  const [showUnitDropdown, setShowUnitDropdown] = useState(false);
  const [showCatDropdown, setShowCatDropdown] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [sellingPrice, setSellingPrice] = useState('');
  const [costPrice, setCostPrice] = useState('');
  const [stock, setStock] = useState('0');
  const [lowStockThreshold, setLowStockThreshold] = useState('10');
  const [unit, setUnit] = useState('Piece');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [barcode, setBarcode] = useState('');
  const [barcodeType, setBarcodeType] = useState<'EAN13' | 'CODE128'>('EAN13');
  const [taxRate, setTaxRate] = useState('0');
  const [gstLabel, setGstLabel] = useState('0% — Nil Rated / Exempt');
  const [gstIsCustom, setGstIsCustom] = useState(false);
  const [customTaxRate, setCustomTaxRate] = useState('');
  const [priceIncludesGst, setPriceIncludesGst] = useState(false);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [supplierId, setSupplierId] = useState<string | null>(null);
  const [discountType, setDiscountType] = useState<'flat' | 'percent'>('percent');
  const [discountValue, setDiscountValue] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const theme = useAppTheme();
  const isDark = theme.isDark;

  const UNITS = [
    'Piece',
    'Kilogram (kg)',
    'Gram (g)',
    'Liter (L)',
    'Milliliter (ml)',
    'Pack (pkt)',
    'Box (box)',
    'Meter (m)',
    'Pair (pr)',
    'Set (set)',
    'Bottle (bot)',
    'Can (can)',
  ];

  const lowStockCount = products.filter((p) => p.currentStock <= p.lowStockThreshold).length;
  const totalStockValue = products.reduce((sum, p) => sum + (p.costPrice || p.sellingPrice) * p.currentStock, 0);

  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.barcode && p.barcode.includes(searchQuery));
    const matchesCategory = selectedCategoryId ? p.categoryId === selectedCategoryId : true;
    return matchesSearch && matchesCategory;
  });

  // Photo Selection Handlers (Camera & Photo Gallery)
  const handlePickPhotoFromGallery = async () => {
    const permResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permResult.granted) {
      Alert.alert('Permission Required', 'Gallery access permission is required to choose photos.');
      return;
    }

    const pickerResult = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!pickerResult.canceled && pickerResult.assets[0]?.uri) {
      setImageUrl(pickerResult.assets[0].uri);
    }
  };

  const handleTakePhotoWithCamera = async () => {
    const permResult = await ImagePicker.requestCameraPermissionsAsync();
    if (!permResult.granted) {
      Alert.alert('Permission Required', 'Camera permission is required to take product photos.');
      return;
    }

    const pickerResult = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!pickerResult.canceled && pickerResult.assets[0]?.uri) {
      setImageUrl(pickerResult.assets[0].uri);
    }
  };

  const handleEditProduct = (product: Product) => {
    setEditingProduct(product);
    setName(product.name);
    setBarcode(product.barcode || '');
    setCategoryId(product.categoryId || null);
    setSupplierId(product.supplierId || null);
    setCostPrice(product.costPrice?.toString() || '');
    setSellingPrice(product.sellingPrice?.toString() || '');
    setStock(product.currentStock?.toString() || '0');
    setLowStockThreshold(product.lowStockThreshold?.toString() || '5');
    setTaxRate(product.taxRate?.toString() || '0');
    const editTaxRate = String(product.taxRate ?? 0);
    const editIsCustom = !isStandardGstSlab(editTaxRate);
    setGstIsCustom(editIsCustom);
    setCustomTaxRate(editIsCustom ? editTaxRate : '');
    setGstLabel(getGstSlabLabel(editTaxRate));
    setPriceIncludesGst(Boolean(product.priceIncludesGst));
    setUnit(product.unit || 'Piece');
    setImageUrl(product.imageUrl || null);
    setDiscountType(product.discountType || 'percent');
    setDiscountValue(product.discountValue ? String(product.discountValue) : '');
    setShowProductModal(true);
  };

  const handleAddProduct = () => {
    setEditingProduct(null);
    setName('');
    setBarcode(generateEAN13Barcode());
    setCategoryId(categories[0]?.id || null);
    setSupplierId(null);
    setCostPrice('');
    setSellingPrice('');
    setStock('0');
    setLowStockThreshold('5');
    setTaxRate('0');
    setGstLabel('0% — Nil Rated / Exempt');
    setGstIsCustom(false);
    setCustomTaxRate('');
    setPriceIncludesGst(false);
    setUnit('Piece');
    setImageUrl(null);
    setDiscountType('percent');
    setDiscountValue('');
    setShowProductModal(true);
  };

  const handleBarCodeScanned = async ({ data }: { data: string }) => {
    setShowScanner(false);
    if (!data) return;
    const raw = String(data).trim();

    let matched = matchProductByCode(products, raw);

    if (!matched) {
      try {
        const remote = await getByBarcode(raw);
        if (remote) {
          matched = remote;
        }
      } catch (err) {
        // Not in backend
      }
    }

    if (matched) {
      setDetailProduct(matched);
      setShowDetailModal(true);
    } else {
      setSearchQuery(raw);
    }
  };

  const handleStockBarcodeScanned = async ({ data }: { data: string }) => {
    if (data === lastScannedBarcode) return;
    setLastScannedBarcode(data);
    Vibration.vibrate(100);

    const raw = String(data || '').trim();

    let matched = matchProductByCode(products, raw);

    if (!matched) {
      try {
        const remote = await getByBarcode(raw);
        if (remote) {
          matched = remote;
        }
      } catch (err) {
        // Not in backend
      }
    }

    if (matched) {
      setScannedProductForStock(matched);
    } else {
      Alert.alert('Unrecognized Barcode', `No product record matching ${raw}. Add this barcode to catalog?`, [
        { text: 'Scan Next', style: 'cancel', onPress: () => setLastScannedBarcode(null) },
        {
          text: 'Add Product',
          onPress: () => {
            setShowStockScanMode(false);
            setEditingProduct(null);
            setBarcode(raw);
            setName('');
            setSellingPrice('');
            setImageUrl(null);
            setShowProductModal(true);
          },
        },
      ]);
    }
  };

  const handleApplyQuickStockChange = async () => {
    if (!scannedProductForStock) return;
    const delta = parseInt(scanQtyDelta) || 1;
    const finalChange = scanModeType === 'add' ? delta : -delta;

    try {
      await adjustStock({
        id: scannedProductForStock.id,
        payload: {
          change: finalChange,
          reason: `Camera Scan Stock Update (${scanModeType.toUpperCase()})`,
        },
      });

      Alert.alert(
        'Stock Updated!',
        `Updated ${scannedProductForStock.name} stock to ${scannedProductForStock.currentStock + finalChange} ${scannedProductForStock.unit || 'pcs'}.`
      );

      setScannedProductForStock(null);
      setLastScannedBarcode(null);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to update stock');
    }
  };

  const handleOpenAddModal = () => {
    setEditingProduct(null);
    setName('');
    setSellingPrice('');
    setCostPrice('');
    setStock('0');
    setLowStockThreshold('10');
    setUnit('Piece');
    setImageUrl(null);
    setBarcode(generateEAN13Barcode());
    setBarcodeType('EAN13');
    setTaxRate('0');
    setGstLabel('0% — Nil Rated / Exempt');
    setGstIsCustom(false);
    setCustomTaxRate('');
    setPriceIncludesGst(false);
    setCategoryId(categories[0]?.id || null);
    setSupplierId(suppliers[0]?.id || null);
    setDiscountType('percent');
    setDiscountValue('');
    setShowProductModal(true);
  };

  const handleOpenEditModal = (p: Product) => {
    setEditingProduct(p);
    setName(p.name);
    setSellingPrice(String(p.sellingPrice));
    setCostPrice(String(p.costPrice || 0));
    setStock(String(p.currentStock));
    setLowStockThreshold(String(p.lowStockThreshold));
    setUnit(p.unit || 'Piece');
    setImageUrl(p.imageUrl || null);
    setBarcode(p.barcode || generateEAN13Barcode());
    const productTaxRate = String(p.taxRate ?? 0);
    setTaxRate(productTaxRate);
    const isCustom = !isStandardGstSlab(productTaxRate);
    setGstIsCustom(isCustom);
    setCustomTaxRate(isCustom ? productTaxRate : '');
    setGstLabel(getGstSlabLabel(productTaxRate));
    setPriceIncludesGst(Boolean(p.priceIncludesGst));
    setCategoryId(p.categoryId || null);
    setSupplierId(p.supplierId || null);
    setDiscountType(p.discountType || 'percent');
    setDiscountValue(p.discountValue ? String(p.discountValue) : '');
    setShowProductModal(true);
  };

  const handleOpenDetailModal = (p: Product) => {
    setDetailProduct(p);
    setShowDetailModal(true);
  };

  const handleGenerateBarcode = () => {
    if (barcodeType === 'EAN13') {
      setBarcode(generateEAN13Barcode());
    } else {
      setBarcode(generateCode128Barcode());
    }
  };

  const handleSaveProduct = async () => {
    if (!name.trim() || !sellingPrice.trim()) {
      Alert.alert('Required Fields', 'Please enter product name and selling price.');
      return;
    }
    if (gstIsCustom && (effectiveGstRate < 0 || effectiveGstRate > 100)) {
      Alert.alert('Invalid GST Rate', 'Custom GST rate must be between 0% and 100%.');
      return;
    }
    setSubmitting(true);
    try {
      const discVal = parseFloat(discountValue) || 0;
      const payload = {
        name: name.trim(),
        sellingPrice: parseFloat(sellingPrice) || 0,
        costPrice: parseFloat(costPrice) || 0,
        currentStock: parseInt(stock) || 0,
        lowStockThreshold: parseInt(lowStockThreshold) || 10,
        unit: unit.trim() || 'Piece',
        imageUrl: imageUrl || undefined,
        barcode: barcode.trim() || undefined,
        taxRate: effectiveGstRate,
        priceIncludesGst,
        categoryId: categoryId || undefined,
        supplierId: supplierId || undefined,
        discountType: discVal > 0 ? discountType : undefined,
        discountValue: discVal > 0 ? discVal : undefined,
      };

      if (editingProduct) {
        await updateProduct({ id: editingProduct.id, payload });
      } else {
        await createProduct(payload);
      }
      setShowProductModal(false);
      if (showDetailModal && editingProduct) {
        setShowDetailModal(false);
      }
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to save product');
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmRestock = async () => {
    if (!detailProduct || !restockQtyInput.trim()) return;
    const addQty = parseInt(restockQtyInput) || 0;
    if (addQty <= 0) return;

    try {
      await adjustStock({
        id: detailProduct.id,
        payload: {
          change: addQty,
          reason: 'Quick Restock',
        },
      });
      setDetailProduct((prev) => prev ? { ...prev, currentStock: prev.currentStock + addQty } : null);
      setShowRestockModal(false);
      setRestockQtyInput('');
      Alert.alert('Restocked', `Added ${addQty} units to stock.`);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to adjust stock');
    }
  };

  const handleQuickCreateCategory = async () => {
    if (!newCatName.trim()) return;
    try {
      const created = await createCategory({ name: newCatName.trim() });
      setCategoryId(created.id);
      setNewCatName('');
      setShowAddCatModal(false);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to create category');
    }
  };

  const sPrice = parseFloat(sellingPrice) || 0;
  const cPrice = parseFloat(costPrice) || 0;
  const marginAmt = sPrice - cPrice;
  const marginPct = sPrice > 0 ? ((marginAmt / sPrice) * 100).toFixed(1) : '0.0';

  const effectiveGstRate = parseFloat(gstIsCustom ? customTaxRate : taxRate) || 0;
  const gstBreakdown = useMemo(
    () => calculateProductGstBreakdown(sPrice, effectiveGstRate, priceIncludesGst),
    [sPrice, effectiveGstRate, priceIncludesGst],
  );

  const handleSelectGstSlab = (rate: string, label: string) => {
    if (rate === GST_CUSTOM_OPTION.rate) {
      setGstIsCustom(true);
      setGstLabel(GST_CUSTOM_OPTION.label);
    } else {
      setGstIsCustom(false);
      setCustomTaxRate('');
      setTaxRate(rate);
      setGstLabel(label);
    }
    setShowGstDropdown(false);
  };

  return (
    <ScreenBackground color={theme.bg}>
    <View style={[styles.container, { backgroundColor: 'transparent', paddingTop: insets.top || 12 }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={theme.bg} />

      <View style={styles.mainWrapper}>
        {/* Header Row */}
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <ArrowLeft size={20} color={theme.textSecondary} />
            <Text style={[styles.backBtnText, { color: theme.textSecondary }]}>{t('back', 'Back')}</Text>
          </TouchableOpacity>

          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TouchableOpacity
              onPress={() => setShowAiModal(true)}
              style={[styles.headerBtn, { backgroundColor: 'rgba(37, 99, 235, 0.15)', marginRight: 6 }]}
            >
              <Sparkles size={14} color={BRAND_COLORS.blue600} />
              <Text style={[styles.headerBtnText, { color: BRAND_COLORS.blue600 }]}>{t('aiImport', 'AI Import')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={async () => {
                if (!permission?.granted) await requestPermission();
                setScannedProductForStock(null);
                setLastScannedBarcode(null);
                setShowStockScanMode(true);
              }}
              style={[styles.headerBtn, { backgroundColor: 'rgba(16, 185, 129, 0.15)', marginRight: 6 }]}
            >
              <Zap size={14} color="#10B981" />
              <Text style={[styles.headerBtnText, { color: '#10B981' }]}>{t('scanStock', 'Scan Stock')}</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={handleOpenAddModal} style={styles.addBtn}>
              <Plus size={15} color="#FFFFFF" />
              <Text style={styles.addBtnText}>{t('addProduct', 'Add Product')}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <Text style={[styles.title, { color: theme.textPrimary }]}>{t('productsPageTitle', 'Products & Inventory')}</Text>

        {/* Stat Cards Strip */}
        <View style={{ height: 68, marginVertical: 12 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ alignItems: 'center' }}>
            <View style={[styles.statCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>{t('totalItems', 'Total Items')}</Text>
              <Text style={[styles.statValue, { color: theme.textPrimary }]}>{products.length}</Text>
            </View>

            <View style={[styles.statCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>{t('lowStock', 'Low Stock')}</Text>
              <Text style={[styles.statValue, { color: lowStockCount > 0 ? '#EF4444' : '#10B981' }]}>{lowStockCount}</Text>
            </View>

            <View style={[styles.statCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>{t('totalStockValue', 'Total Stock Value')}</Text>
              <Text style={[styles.statValue, { color: theme.textPrimary }]}>₹{totalStockValue.toFixed(2)}</Text>
            </View>
          </ScrollView>
        </View>

        {/* Category Pills Bar */}
        <View style={{ height: 44, marginBottom: 12 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ alignItems: 'center' }}>
            <TouchableOpacity
              onPress={() => setSelectedCategoryId(null)}
              style={[
                styles.catPill,
                {
                  backgroundColor: !selectedCategoryId ? BRAND_COLORS.blue600 : theme.cardBg,
                  borderColor: !selectedCategoryId ? BRAND_COLORS.blue600 : theme.borderColor,
                },
              ]}
            >
              <Text style={[styles.catPillText, { color: !selectedCategoryId ? '#FFFFFF' : theme.textPrimary }]}>
                {t('allItems', 'All Items')} ({products.length})
              </Text>
            </TouchableOpacity>

            {categories.map((c) => {
              const selected = selectedCategoryId === c.id;
              return (
                <TouchableOpacity
                  key={c.id}
                  onPress={() => setSelectedCategoryId(c.id)}
                  style={[
                    styles.catPill,
                    {
                      backgroundColor: selected ? BRAND_COLORS.blue600 : theme.cardBg,
                      borderColor: selected ? BRAND_COLORS.blue600 : theme.borderColor,
                    },
                  ]}
                >
                  <Text style={[styles.catPillText, { color: selected ? '#FFFFFF' : theme.textPrimary }]}>{c.name}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Search & Camera Barcode Bar */}
        <View style={[styles.searchBox, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
          <Search size={18} color={theme.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: theme.textPrimary }]}
            placeholder={t('searchProducts', 'Search name, barcode or SKU...')}
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          <TouchableOpacity
            onPress={async () => {
              if (!permission?.granted) await requestPermission();
              setShowScanner(true);
            }}
            style={styles.cameraBtn}
          >
            <Camera size={18} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* Product Cards List */}
        {isLoading ? (
          <ScreenLoadingState
            message={t('loadingProducts', 'Loading products...')}
            hint={t('loadingProductsHint', 'Fetching your inventory from the server')}
            skeleton={<ProductsListSkeleton count={6} />}
          />
        ) : isError ? (
          <View style={{ padding: 24, alignItems: 'center' }}>
            <Text style={{ color: theme.textPrimary, fontWeight: '800', fontSize: 15, textAlign: 'center' }}>
              Could not load products from server
            </Text>
            <Text style={{ color: theme.textSecondary, fontSize: 12, marginTop: 8, textAlign: 'center', lineHeight: 18 }}>
              {(error as Error)?.message || 'Check that the backend is running and your phone is on the same network.'}
            </Text>
            <TouchableOpacity
              onPress={() => refetchProducts()}
              style={{ marginTop: 16, backgroundColor: BRAND_COLORS.blue600, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 12 }}
            >
              <Text style={{ color: '#FFFFFF', fontWeight: '800' }}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={filteredProducts}
            keyExtractor={(item) => item.id}
            initialNumToRender={10}
            maxToRenderPerBatch={10}
            windowSize={7}
            removeClippedSubviews={Platform.OS === 'android'}
            contentContainerStyle={{ paddingBottom: 60 }}
            renderItem={({ item }) => {
              const isLowStock = item.currentStock <= item.lowStockThreshold;

              return (
                <TouchableOpacity
                  onPress={() => handleOpenDetailModal(item)}
                  activeOpacity={0.8}
                  style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}
                >
                  {/* Product Image Thumbnail */}
                  {item.imageUrl ? (
                    <Image source={{ uri: item.imageUrl }} style={styles.cardImageThumb} />
                  ) : (
                    <View style={[styles.cardImagePlaceholder, { backgroundColor: 'rgba(37, 99, 235, 0.12)' }]}>
                      <Package size={20} color={BRAND_COLORS.blue600} />
                    </View>
                  )}

                  <View style={{ flex: 1, marginHorizontal: 10 }}>
                    <Text style={[styles.productName, { color: theme.textPrimary }]}>{item.name}</Text>
                    <Text style={[styles.productMeta, { color: theme.textSecondary }]}>
                      Selling: ₹{item.sellingPrice.toFixed(2)} | Cost: ₹{(item.costPrice || 0).toFixed(2)}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, flexWrap: 'wrap', gap: 6 }}>
                      <View style={[styles.stockPill, { backgroundColor: isLowStock ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)' }]}>
                        <Text style={[styles.stockPillText, { color: isLowStock ? '#EF4444' : '#10B981' }]}>
                          Stock: {item.currentStock} {item.unit || 'pcs'}
                        </Text>
                      </View>
                      {item.discountValue && item.discountValue > 0 ? (
                        <View style={[styles.stockPill, { backgroundColor: 'rgba(16, 185, 129, 0.15)', flexDirection: 'row', alignItems: 'center' }]}>
                          <Tag size={10} color="#10B981" />
                          <Text style={[styles.stockPillText, { color: '#10B981', marginLeft: 2 }]}>
                            {item.discountType === 'percent' ? `${item.discountValue}% OFF` : `₹${item.discountValue} OFF`}
                          </Text>
                        </View>
                      ) : null}
                      {item.barcode ? (
                        <Text style={[styles.barcodeText, { color: theme.textSecondary }]}>| Barcode: {item.barcode}</Text>
                      ) : null}
                    </View>
                  </View>

                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <TouchableOpacity onPress={() => handleOpenEditModal(item)} style={styles.iconBtn}>
                      <Edit3 size={16} color={theme.textSecondary} />
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              );
            }}
          />
        )}
      </View>

      {/* SCAN TO UPDATE STOCK HUD MODAL */}
      <Modal visible={showStockScanMode} animationType="slide">
        <SafeAreaView style={{ flex: 1, backgroundColor: '#000000' }}>
          <View style={styles.hudTopBar}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Zap size={20} color="#10B981" />
              <Text style={styles.hudTitle}>Scan to Update Stock</Text>
            </View>
            <TouchableOpacity onPress={() => setShowStockScanMode(false)}>
              <X size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          <View style={{ flex: 1, position: 'relative' }}>
            <CameraView
              style={{ flex: 1 }}
              onBarcodeScanned={handleStockBarcodeScanned}
              barcodeScannerSettings={{ barcodeTypes: ['qr', 'ean13', 'ean8', 'code128', 'upc_a'] }}
            />
            <View style={styles.reticleOverlay} pointerEvents="none">
              <View style={styles.reticleFrame} />
              <Text style={styles.reticleText}>Point camera at product barcode</Text>
            </View>
          </View>

          {scannedProductForStock ? (
            <View style={[styles.hudStockSheet, { backgroundColor: theme.cardBg }]}>
              <View style={styles.hudHeaderRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.hudProductName, { color: theme.textPrimary }]}>{scannedProductForStock.name}</Text>
                  <Text style={[styles.hudProductStock, { color: theme.textSecondary }]}>
                    Current Stock: {scannedProductForStock.currentStock} {scannedProductForStock.unit || 'pcs'}
                  </Text>
                </View>

                <View style={styles.modeToggleRow}>
                  <TouchableOpacity
                    onPress={() => setScanModeType('add')}
                    style={[styles.modeToggleBtn, scanModeType === 'add' && { backgroundColor: '#10B981' }]}
                  >
                    <Plus size={14} color="#FFFFFF" />
                    <Text style={styles.modeToggleText}>Restock (+)</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => setScanModeType('reduce')}
                    style={[styles.modeToggleBtn, scanModeType === 'reduce' && { backgroundColor: '#EF4444' }]}
                  >
                    <MinusCircle size={14} color="#FFFFFF" />
                    <Text style={styles.modeToggleText}>Deduct (-)</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.qtyChipsRow}>
                {['1', '5', '10', '25', '50'].map((qVal) => (
                  <TouchableOpacity
                    key={qVal}
                    onPress={() => setScanQtyDelta(qVal)}
                    style={[
                      styles.qtyChip,
                      {
                        backgroundColor: scanQtyDelta === qVal ? BRAND_COLORS.blue600 : theme.bg,
                        borderColor: scanQtyDelta === qVal ? BRAND_COLORS.blue600 : theme.borderColor,
                      },
                    ]}
                  >
                    <Text style={[styles.qtyChipText, { color: scanQtyDelta === qVal ? '#FFFFFF' : theme.textPrimary }]}>
                      +{qVal}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity onPress={handleApplyQuickStockChange} style={styles.applyStockBtn}>
                <CheckCircle2 size={18} color="#FFFFFF" />
                <Text style={styles.applyStockText}>
                  Confirm {scanModeType === 'add' ? 'Restock' : 'Deduction'} of {scanQtyDelta} {scannedProductForStock.unit || 'pcs'}
                </Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </SafeAreaView>
      </Modal>

      {/* General Camera Barcode Modal */}
      <Modal visible={showScanner} animationType="slide">
        <SafeAreaView style={{ flex: 1, backgroundColor: '#000000' }}>
          <View style={styles.scannerHeader}>
            <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 16 }}>Barcode Search Scan</Text>
            <TouchableOpacity onPress={() => setShowScanner(false)}>
              <X size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
          <CameraView style={{ flex: 1 }} onBarcodeScanned={handleBarCodeScanned} />
        </SafeAreaView>
      </Modal>

      {/* PRODUCT DETAIL MODAL */}
      <Modal visible={showDetailModal} animationType="slide">
        <SafeAreaView style={[styles.modalSafeArea, { backgroundColor: theme.bg }]}>
          {detailProduct ? (
            <View style={{ flex: 1 }}>
              <View style={[styles.detailHeader, { borderBottomColor: theme.borderColor }]}>
                <Text style={[styles.detailTitle, { color: theme.textPrimary }]}>Product Detail</Text>
                <TouchableOpacity onPress={() => setShowDetailModal(false)}>
                  <X size={22} color={theme.textSecondary} />
                </TouchableOpacity>
              </View>

              <ScrollView style={{ flex: 1, padding: 16 }} contentContainerStyle={{ paddingBottom: 100 }}>
                {/* Hero Banner with Product Photo */}
                <View style={styles.heroBanner}>
                  {detailProduct.imageUrl ? (
                    <Image source={{ uri: detailProduct.imageUrl }} style={styles.heroImageThumb} />
                  ) : (
                    <View style={styles.heroBoxIcon}>
                      <Package size={28} color="#FFFFFF" />
                    </View>
                  )}

                  <View style={styles.heroPillRow}>
                    <View style={styles.heroPillBlue}>
                      <Text style={styles.heroPillBlueText}>
                        {categories.find((c) => c.id === detailProduct.categoryId)?.name || 'General'}
                      </Text>
                    </View>
                    <View style={styles.heroPillDark}>
                      <Text style={styles.heroPillDarkText}>Unit: {detailProduct.unit || 'piece'}</Text>
                    </View>
                    <View style={[styles.heroPillGreen, detailProduct.currentStock <= detailProduct.lowStockThreshold && { backgroundColor: 'rgba(239, 68, 68, 0.25)' }]}>
                      <Text style={[styles.heroPillGreenText, detailProduct.currentStock <= detailProduct.lowStockThreshold && { color: '#EF4444' }]}>
                        {detailProduct.currentStock <= detailProduct.lowStockThreshold ? 'Low Stock' : 'In Stock'}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.heroProductName}>{detailProduct.name}</Text>
                  <Text style={styles.heroProductMeta}>
                    SKU: {detailProduct.id.substring(0, 8)} • Barcode: {detailProduct.barcode || 'SZN-890123'}
                  </Text>

                  <Text style={styles.heroPriceText}>₹{detailProduct.sellingPrice.toFixed(2)}</Text>
                  <Text style={styles.heroPriceSub}>
                    {detailProduct.priceIncludesGst ? 'GST Inclusive (MRP)' : 'GST Exclusive (Taxable Value)'} · {detailProduct.taxRate || 0}% GST
                  </Text>
                </View>

                {/* Item Information Card */}
                <View style={[styles.sectionCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
                  <View style={styles.sectionHeaderRow}>
                    <Package size={16} color={BRAND_COLORS.blue600} />
                    <Text style={styles.sectionTitle}>ITEM INFORMATION</Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>Item Name</Text>
                    <Text style={[styles.detailValue, { color: theme.textPrimary }]}>{detailProduct.name}</Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>Category</Text>
                    <Text style={[styles.detailValue, { color: theme.textPrimary }]}>
                      {categories.find((c) => c.id === detailProduct.categoryId)?.name || 'General'}
                    </Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>Supplier</Text>
                    <Text style={[styles.detailValue, { color: theme.textPrimary }]}>
                      {suppliers.find((s) => s.id === detailProduct.supplierId)?.name || 'Seznik Direct'}
                    </Text>
                  </View>

                  <View style={[styles.detailRow, { borderBottomWidth: 0 }]}>
                    <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>Product Code (SKU)</Text>
                    <Text style={[styles.detailValue, { color: theme.textPrimary }]}>
                      {detailProduct.barcode || detailProduct.id.substring(0, 8)}
                    </Text>
                  </View>
                </View>

                {/* Pricing & Tax Details Card */}
                <View style={[styles.sectionCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
                  <View style={styles.sectionHeaderRow}>
                    <DollarSign size={16} color="#10B981" />
                    <Text style={[styles.sectionTitle, { color: '#10B981' }]}>PRICING & TAX DETAILS</Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>Selling Price</Text>
                    <Text style={[styles.detailValue, { color: theme.textPrimary, fontWeight: '900' }]}>
                      ₹{detailProduct.sellingPrice.toFixed(2)}
                    </Text>
                  </View>

                  {detailProduct.discountValue && detailProduct.discountValue > 0 ? (
                    <View style={styles.detailRow}>
                      <Text style={[styles.detailLabel, { color: '#10B981' }]}>Default Discount</Text>
                      <Text style={[styles.detailValue, { color: '#10B981', fontWeight: '900' }]}>
                        {detailProduct.discountType === 'percent'
                          ? `${detailProduct.discountValue}% (Net: ₹${(detailProduct.sellingPrice * (1 - detailProduct.discountValue / 100)).toFixed(2)})`
                          : `₹${detailProduct.discountValue} (Net: ₹${Math.max(0, detailProduct.sellingPrice - detailProduct.discountValue).toFixed(2)})`}
                      </Text>
                    </View>
                  ) : null}

                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>Cost Price</Text>
                    <Text style={[styles.detailValue, { color: theme.textPrimary }]}>
                      ₹{(detailProduct.costPrice || 0).toFixed(2)}
                    </Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>Profit Margin per Unit</Text>
                    <Text style={[styles.detailValue, { color: '#10B981', fontWeight: '900' }]}>
                      ₹{(detailProduct.sellingPrice - (detailProduct.costPrice || 0)).toFixed(2)} (
                      {(
                        ((detailProduct.sellingPrice - (detailProduct.costPrice || 0)) /
                          (detailProduct.costPrice || 1)) *
                        100
                      ).toFixed(1)}
                      %)
                    </Text>
                  </View>

                  <View style={[styles.detailRow, { borderBottomWidth: 0, flexDirection: 'column', alignItems: 'stretch' }]}>
                    <Text style={[styles.detailLabel, { color: theme.textSecondary, marginBottom: 8 }]}>
                      GST Rate · {getGstSlabLabel(detailProduct.taxRate || 0)}
                    </Text>
                    <GstBreakdownCard
                      breakdown={calculateProductGstBreakdown(
                        detailProduct.sellingPrice,
                        detailProduct.taxRate || 0,
                        Boolean(detailProduct.priceIncludesGst),
                      )}
                      theme={theme}
                      compact
                    />
                  </View>
                </View>

                {/* Stock Management Card */}
                <View style={[styles.sectionCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
                  <View style={styles.sectionHeaderRow}>
                    <Box size={16} color="#7C3AED" />
                    <Text style={[styles.sectionTitle, { color: '#7C3AED' }]}>STOCK MANAGEMENT</Text>
                  </View>

                  <View style={styles.stockBlockGrid}>
                    <View style={[styles.stockBox, { backgroundColor: theme.bg, borderColor: theme.borderColor }]}>
                      <Text style={[styles.stockBoxLabel, { color: theme.textSecondary }]}>Current Stock</Text>
                      <Text style={[styles.stockBoxVal, { color: theme.textPrimary }]}>
                        {detailProduct.currentStock} {detailProduct.unit || 'piece'}
                      </Text>
                    </View>

                    <View style={[styles.stockBox, { backgroundColor: theme.bg, borderColor: theme.borderColor }]}>
                      <Text style={[styles.stockBoxLabel, { color: theme.textSecondary }]}>Low Stock Threshold</Text>
                      <Text style={[styles.stockBoxVal, { color: theme.textPrimary }]}>
                        {detailProduct.lowStockThreshold} {detailProduct.unit || 'piece'}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Original Barcode & SVG QR Code Label Component */}
                <BarcodeQRCodeLabel
                  barcodeValue={detailProduct.barcode || '8901234567890'}
                  barcodeType={detailProduct.barcodeType || 'EAN13'}
                  productName={detailProduct.name}
                  price={detailProduct.sellingPrice}
                  theme={theme}
                />
              </ScrollView>

              <View style={[styles.detailFooterBar, { backgroundColor: theme.cardBg, borderTopColor: theme.borderColor }]}>
                <TouchableOpacity
                  onPress={() => {
                    Alert.alert('Delete Product', `Delete ${detailProduct.name}?`, [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Delete',
                        style: 'destructive',
                        onPress: () => {
                          deleteProduct(detailProduct.id);
                          setShowDetailModal(false);
                        },
                      },
                    ]);
                  }}
                  style={styles.footerDeleteBtn}
                >
                  <Trash2 size={16} color="#EF4444" />
                  <Text style={styles.footerDeleteText}>Delete</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => {
                    setBarcodePrintProduct(detailProduct);
                    setShowBarcodePrintModal(true);
                  }}
                  style={[styles.footerRestockBtn, { backgroundColor: 'rgba(37, 99, 235, 0.12)', borderColor: BRAND_COLORS.blue600 }]}
                >
                  <Barcode size={16} color={BRAND_COLORS.blue600} />
                  <Text style={[styles.footerRestockText, { color: BRAND_COLORS.blue600 }]}>Print Label</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setShowRestockModal(true)}
                  style={[styles.footerRestockBtn, { borderColor: theme.borderColor }]}
                >
                  <Tag size={16} color={theme.textPrimary} />
                  <Text style={[styles.footerRestockText, { color: theme.textPrimary }]}>Restock</Text>
                </TouchableOpacity>

                <TouchableOpacity onPress={() => handleOpenEditModal(detailProduct)} style={styles.footerEditBtn}>
                  <Edit3 size={16} color="#FFFFFF" />
                  <Text style={styles.footerEditText}>Edit</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : null}
        </SafeAreaView>
      </Modal>

      {/* BARCODE / QR CUSTOM PRINT MODAL */}
      <BarcodePrintModal
        visible={showBarcodePrintModal}
        product={barcodePrintProduct}
        onClose={() => setShowBarcodePrintModal(false)}
      />

      {/* ADD / EDIT PRODUCT FORM SHEET (With Product Photo Upload!) */}
      <Modal visible={showProductModal} animationType="slide">
        <SafeAreaView style={[styles.modalSafeArea, { backgroundColor: theme.bg }]}>
          <KeyboardAvoidingWrapper inModal>
          <ScrollView style={{ flex: 1, padding: 16 }}>
            <View style={styles.sheetHeader}>
              <Text style={[styles.sheetTitle, { color: theme.textPrimary }]}>
                {editingProduct ? 'Edit Product Record' : 'Add New Product Record'}
              </Text>
              <TouchableOpacity onPress={() => setShowProductModal(false)}>
                <X size={24} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* PRODUCT PHOTO SELECTOR SECTION */}
            <View style={[styles.photoCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
              <Text style={[styles.label, { color: theme.textPrimary, marginBottom: 8 }]}>Product Photo</Text>

              {imageUrl ? (
                <View style={styles.photoPreviewContainer}>
                  <Image source={{ uri: imageUrl }} style={styles.photoPreviewImage} />
                  <TouchableOpacity onPress={() => setImageUrl(null)} style={styles.removePhotoBtn}>
                    <X size={14} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={[styles.photoPlaceholderBox, { backgroundColor: theme.bg, borderColor: theme.borderColor }]}>
                  <ImageIcon size={32} color={theme.textSecondary} />
                  <Text style={[styles.photoPlaceholderText, { color: theme.textSecondary }]}>
                    No product image selected
                  </Text>
                </View>
              )}

              <View style={styles.photoActionsRow}>
                <TouchableOpacity onPress={handleTakePhotoWithCamera} style={styles.photoActionBtn}>
                  <Camera size={14} color="#FFFFFF" />
                  <Text style={styles.photoActionText}>Take Photo</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handlePickPhotoFromGallery}
                  style={[styles.photoActionBtn, { backgroundColor: BRAND_COLORS.blue600 }]}
                >
                  <ImageIcon size={14} color="#FFFFFF" />
                  <Text style={styles.photoActionText}>Gallery Pick</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Product Name */}
            <View style={styles.labelRow}>
              <Text style={[styles.label, { color: theme.textPrimary }]}>Product Name *</Text>
              <Info size={14} color={theme.textSecondary} style={{ marginLeft: 4 }} />
            </View>
            <TextInput
              style={[styles.input, { backgroundColor: theme.cardBg, borderColor: theme.borderColor, color: theme.textPrimary }]}
              value={name}
              onChangeText={setName}
              placeholder="e.g. Organic Basmati Rice 5kg"
              placeholderTextColor="#94A3B8"
            />

            {/* Category Dropdown */}
            <View style={styles.labelRow}>
              <Text style={[styles.label, { color: theme.textPrimary }]}>Category</Text>
              <Info size={14} color={theme.textSecondary} style={{ marginLeft: 4 }} />
            </View>
            <TouchableOpacity
              onPress={() => setShowCatDropdown(!showCatDropdown)}
              style={[styles.dropdownSelect, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}
            >
              <Text style={[styles.dropdownSelectText, { color: theme.textPrimary }]}>
                {categories.find((c) => c.id === categoryId)?.name || 'General / Select Category'}
              </Text>
              <ChevronDown size={18} color={theme.textSecondary} />
            </TouchableOpacity>

            {showCatDropdown ? (
              <View style={[styles.dropdownMenu, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
                {categories.map((cat) => (
                  <TouchableOpacity
                    key={cat.id}
                    onPress={() => {
                      setCategoryId(cat.id);
                      setShowCatDropdown(false);
                    }}
                    style={[styles.dropdownOption, { borderBottomColor: theme.borderColor }]}
                  >
                    <Text style={[styles.dropdownOptionText, { color: categoryId === cat.id ? BRAND_COLORS.blue600 : theme.textPrimary }]}>
                      {cat.name}
                    </Text>
                    {categoryId === cat.id ? <Check size={16} color={BRAND_COLORS.blue600} /> : null}
                  </TouchableOpacity>
                ))}
              </View>
            ) : null}

            {/* Selling Price & Cost Price */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 }}>
              <View style={{ flex: 1, marginRight: 6 }}>
                <View style={styles.labelRow}>
                  <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={[styles.label, { color: theme.textPrimary }]}>Selling Price (₹) *</Text>
                    <View style={{ flexDirection: 'row', backgroundColor: theme.bg, borderRadius: 8, padding: 2, borderWidth: 1, borderColor: theme.borderColor }}>
                      <TouchableOpacity
                        onPress={() => setPriceIncludesGst(false)}
                        style={[
                          { paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6 },
                          !priceIncludesGst && { backgroundColor: BRAND_COLORS.blue600 },
                        ]}
                      >
                        <Text style={{ fontSize: 9, fontWeight: '800', color: !priceIncludesGst ? '#FFFFFF' : theme.textSecondary }}>
                          Excl. GST
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => setPriceIncludesGst(true)}
                        style={[
                          { paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6 },
                          priceIncludesGst && { backgroundColor: BRAND_COLORS.blue600 },
                        ]}
                      >
                        <Text style={{ fontSize: 9, fontWeight: '800', color: priceIncludesGst ? '#FFFFFF' : theme.textSecondary }}>
                          Incl. GST
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.cardBg, borderColor: theme.borderColor, color: theme.textPrimary, marginBottom: 4 }]}
                  value={sellingPrice}
                  onChangeText={setSellingPrice}
                  keyboardType="numeric"
                  placeholder={priceIncludesGst ? 'MRP incl. GST' : 'Taxable value excl. GST'}
                  placeholderTextColor="#94A3B8"
                />
                <Text style={{ fontSize: 10, color: theme.textSecondary, marginBottom: 0, fontWeight: '600' }}>
                  {priceIncludesGst
                    ? 'Entered price is the final MRP (GST already included)'
                    : 'Entered price is taxable value — GST will be added at billing'}
                </Text>
              </View>

              <View style={{ flex: 1, marginLeft: 6 }}>
                <View style={styles.labelRow}>
                  <Text style={[styles.label, { color: theme.textPrimary }]}>Cost Price (₹)</Text>
                  <Info size={14} color={theme.textSecondary} style={{ marginLeft: 4 }} />
                </View>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.cardBg, borderColor: theme.borderColor, color: theme.textPrimary }]}
                  value={costPrice}
                  onChangeText={setCostPrice}
                  keyboardType="numeric"
                  placeholder="380.00"
                  placeholderTextColor="#94A3B8"
                />
              </View>
            </View>

            {/* GST Configuration */}
            <View style={[styles.sectionCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor, marginBottom: 14, padding: 12 }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                <Receipt size={14} color={BRAND_COLORS.blue600} style={{ marginRight: 6 }} />
                <Text style={[styles.label, { color: theme.textPrimary, marginBottom: 0 }]}>GST Rate (Slab)</Text>
              </View>

              <TouchableOpacity
                onPress={() => {
                  setShowGstDropdown(!showGstDropdown);
                  setShowCatDropdown(false);
                  setShowUnitDropdown(false);
                }}
                style={[styles.dropdownSelect, { backgroundColor: theme.bg, borderColor: theme.borderColor, marginBottom: showGstDropdown ? 0 : 10 }]}
              >
                <Text style={[styles.dropdownSelectText, { color: theme.textPrimary }]}>
                  {gstIsCustom ? GST_CUSTOM_OPTION.label : gstLabel}
                </Text>
                <ChevronDown size={18} color={theme.textSecondary} />
              </TouchableOpacity>

              {showGstDropdown ? (
                <View style={[styles.dropdownMenu, { backgroundColor: theme.bg, borderColor: theme.borderColor, marginBottom: 10 }]}>
                  {GST_SLAB_OPTIONS.map((slab) => (
                    <TouchableOpacity
                      key={slab.rate}
                      onPress={() => handleSelectGstSlab(slab.rate, slab.label)}
                      style={[styles.dropdownOption, { borderBottomColor: theme.borderColor }]}
                    >
                      <View style={{ flex: 1, marginRight: 8 }}>
                        <Text
                          style={[
                            styles.dropdownOptionText,
                            { color: !gstIsCustom && taxRate === slab.rate ? BRAND_COLORS.blue600 : theme.textPrimary },
                          ]}
                        >
                          {slab.label}
                        </Text>
                        <Text style={{ fontSize: 10, color: theme.textSecondary, marginTop: 2 }}>{slab.description}</Text>
                      </View>
                      {!gstIsCustom && taxRate === slab.rate ? <Check size={16} color={BRAND_COLORS.blue600} /> : null}
                    </TouchableOpacity>
                  ))}
                  <TouchableOpacity
                    onPress={() => handleSelectGstSlab(GST_CUSTOM_OPTION.rate, GST_CUSTOM_OPTION.label)}
                    style={[styles.dropdownOption, { borderBottomWidth: 0 }]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[
                          styles.dropdownOptionText,
                          { color: gstIsCustom ? BRAND_COLORS.blue600 : theme.textPrimary },
                        ]}
                      >
                        {GST_CUSTOM_OPTION.label}
                      </Text>
                      <Text style={{ fontSize: 10, color: theme.textSecondary, marginTop: 2 }}>{GST_CUSTOM_OPTION.description}</Text>
                    </View>
                    {gstIsCustom ? <Check size={16} color={BRAND_COLORS.blue600} /> : null}
                  </TouchableOpacity>
                </View>
              ) : null}

              {gstIsCustom ? (
                <View style={{ marginBottom: 10 }}>
                  <Text style={[styles.label, { color: theme.textSecondary, fontSize: 11, marginBottom: 6 }]}>
                    Custom GST Rate (%)
                  </Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: theme.bg, borderColor: theme.borderColor, color: theme.textPrimary, marginBottom: 0 }]}
                    value={customTaxRate}
                    onChangeText={setCustomTaxRate}
                    keyboardType="decimal-pad"
                    placeholder="e.g. 6.5"
                    placeholderTextColor="#94A3B8"
                  />
                </View>
              ) : null}

              {sPrice > 0 ? (
                <GstBreakdownCard breakdown={gstBreakdown} theme={theme} />
              ) : (
                <Text style={{ fontSize: 11, color: theme.textSecondary, fontWeight: '600', textAlign: 'center', marginTop: 4 }}>
                  Enter selling price to view GST breakdown
                </Text>
              )}
            </View>

            {/* PRODUCT DISCOUNT CONFIGURATION SECTION */}
            <View style={[styles.sectionCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor, marginBottom: 14, padding: 12 }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Tag size={14} color={BRAND_COLORS.blue600} style={{ marginRight: 6 }} />
                  <Text style={[styles.label, { color: theme.textPrimary, marginBottom: 0 }]}>Fixed Product Discount (Optional)</Text>
                </View>
                {/* Segmented Type Picker */}
                <View style={{ flexDirection: 'row', backgroundColor: theme.bg, borderRadius: 8, padding: 2, borderWidth: 1, borderColor: theme.borderColor }}>
                  <TouchableOpacity
                    onPress={() => setDiscountType('percent')}
                    style={[
                      { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
                      discountType === 'percent' && { backgroundColor: BRAND_COLORS.blue600 },
                    ]}
                  >
                    <Text style={{ fontSize: 11, fontWeight: '800', color: discountType === 'percent' ? '#FFFFFF' : theme.textSecondary }}>% Percent</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setDiscountType('flat')}
                    style={[
                      { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
                      discountType === 'flat' && { backgroundColor: BRAND_COLORS.blue600 },
                    ]}
                  >
                    <Text style={{ fontSize: 11, fontWeight: '800', color: discountType === 'flat' ? '#FFFFFF' : theme.textSecondary }}>₹ Flat</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <TextInput
                style={[styles.input, { backgroundColor: theme.bg, borderColor: theme.borderColor, color: theme.textPrimary, marginBottom: 6 }]}
                value={discountValue}
                onChangeText={setDiscountValue}
                keyboardType="numeric"
                placeholder={discountType === 'percent' ? 'e.g. 10 (for 10% discount)' : 'e.g. 50 (for ₹50 off)'}
                placeholderTextColor="#94A3B8"
              />

              {parseFloat(discountValue) > 0 && parseFloat(sellingPrice) > 0 ? (
                <View style={[styles.marginBanner, { backgroundColor: 'rgba(16, 185, 129, 0.12)', marginBottom: 0, marginTop: 4 }]}>
                  <Text style={[styles.marginText, { color: '#10B981' }]}>
                    {discountType === 'percent'
                      ? `Effective Price: ₹${(parseFloat(sellingPrice) * (1 - Math.min(100, parseFloat(discountValue)) / 100)).toFixed(2)} (Save ₹${((parseFloat(sellingPrice) * Math.min(100, parseFloat(discountValue))) / 100).toFixed(2)})`
                      : `Effective Price: ₹${Math.max(0, parseFloat(sellingPrice) - parseFloat(discountValue)).toFixed(2)} (Save ₹${Math.min(parseFloat(sellingPrice), parseFloat(discountValue)).toFixed(2)})`}
                  </Text>
                </View>
              ) : null}
            </View>

            {/* Stock & Threshold */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 }}>
              <View style={{ flex: 1, marginRight: 6 }}>
                <Text style={[styles.label, { color: theme.textPrimary }]}>Current Stock</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.cardBg, borderColor: theme.borderColor, color: theme.textPrimary }]}
                  value={stock}
                  onChangeText={setStock}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor="#94A3B8"
                />
              </View>
              <View style={{ flex: 1, marginLeft: 6 }}>
                <Text style={[styles.label, { color: theme.textPrimary }]}>Low Stock Threshold</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.cardBg, borderColor: theme.borderColor, color: theme.textPrimary }]}
                  value={lowStockThreshold}
                  onChangeText={setLowStockThreshold}
                  keyboardType="numeric"
                  placeholder="10"
                  placeholderTextColor="#94A3B8"
                />
              </View>
            </View>

            {/* Original Barcode Section */}
            <View style={styles.barcodeSection}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <Text style={[styles.label, { color: theme.textPrimary, marginBottom: 0 }]}>Original Barcode Value</Text>
                <TouchableOpacity onPress={handleGenerateBarcode} style={styles.genBarcodeBtn}>
                  <Zap size={14} color="#FFFFFF" />
                  <Text style={styles.genBarcodeText}>Generate</Text>
                </TouchableOpacity>
              </View>
              <TextInput
                style={[styles.input, { backgroundColor: theme.cardBg, borderColor: theme.borderColor, color: theme.textPrimary }]}
                value={barcode}
                onChangeText={setBarcode}
                placeholder="Scan or enter barcode"
                placeholderTextColor="#94A3B8"
              />

              <BarcodeQRCodeLabel
                barcodeValue={barcode || '8901234567890'}
                barcodeType={barcodeType}
                productName={name || 'Product'}
                price={sPrice}
                theme={theme}
              />
            </View>
          </ScrollView>

          <View style={[styles.stickySaveBar, { backgroundColor: theme.cardBg, borderTopColor: theme.borderColor }]}>
            <TouchableOpacity onPress={handleSaveProduct} disabled={submitting} style={styles.submitBtn}>
              {submitting && <ActivityIndicator color="#FFF" style={{ marginRight: 8 }} />}
              <Text style={styles.submitBtnText}>{editingProduct ? 'Save Product Record' : 'Create Product Record'}</Text>
            </TouchableOpacity>
          </View>
          </KeyboardAvoidingWrapper>
        </SafeAreaView>
      </Modal>

      {/* AI SMART PRODUCT IMPORT MODAL */}
      <AiProductImportModal
        visible={showAiModal}
        onClose={() => setShowAiModal(false)}
      />
    </View>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  mainWrapper: { flex: 1, paddingHorizontal: 16 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  backBtn: { flexDirection: 'row', alignItems: 'center' },
  backBtnText: { fontSize: 13, fontWeight: '600', marginLeft: 4 },
  headerBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, flexDirection: 'row', alignItems: 'center' },
  headerBtnText: { fontSize: 12, fontWeight: '800', marginLeft: 4 },
  addBtn: { backgroundColor: BRAND_COLORS.navyInk, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, flexDirection: 'row', alignItems: 'center' },
  addBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 12, marginLeft: 4 },
  title: { fontSize: 24, fontWeight: '900' },
  statCard: { width: 140, padding: 12, borderRadius: 16, borderWidth: 1, marginRight: 10, height: 60, justifyContent: 'center' },
  statLabel: { fontSize: 10, fontWeight: '600' },
  statValue: { fontSize: 16, fontWeight: '900', marginTop: 2 },
  catPill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, borderWidth: 1, marginRight: 8, height: 36, justifyContent: 'center' },
  catPillText: { fontSize: 12, fontWeight: '700' },
  searchBox: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 14 },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 14 },
  cameraBtn: { backgroundColor: BRAND_COLORS.sky500, padding: 8, borderRadius: 10 },
  card: { borderRadius: 16, padding: 14, borderWidth: 1, marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardImageThumb: { width: 44, height: 44, borderRadius: 12 },
  cardImagePlaceholder: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  productName: { fontSize: 14, fontWeight: '800' },
  productMeta: { fontSize: 11, marginTop: 2 },
  stockPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  stockPillText: { fontSize: 10, fontWeight: '800' },
  barcodeText: { fontSize: 10, marginLeft: 6 },
  iconBtn: { padding: 8, borderRadius: 10, backgroundColor: 'rgba(100, 116, 139, 0.12)' },
  scannerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  modalSafeArea: { flex: 1 },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sheetTitle: { fontSize: 20, fontWeight: '900' },
  photoCard: { borderRadius: 18, padding: 16, borderWidth: 1, marginBottom: 16, alignItems: 'center' },
  photoPreviewContainer: { position: 'relative', width: 90, height: 90, borderRadius: 16, overflow: 'hidden', marginBottom: 12 },
  photoPreviewImage: { width: '100%', height: '100%' },
  removePhotoBtn: { position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: 11, backgroundColor: '#EF4444', alignItems: 'center', justifyContent: 'center' },
  photoPlaceholderBox: { width: '100%', height: 80, borderRadius: 14, borderWidth: 1, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  photoPlaceholderText: { fontSize: 11, marginTop: 6, fontWeight: '600' },
  photoActionsRow: { flexDirection: 'row', justifyContent: 'center', width: '100%' },
  photoActionBtn: { backgroundColor: BRAND_COLORS.navyInk, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, flexDirection: 'row', alignItems: 'center', marginHorizontal: 4 },
  photoActionText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800', marginLeft: 6 },
  labelRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  label: { fontSize: 12, fontWeight: '700' },
  input: { borderWidth: 1, borderRadius: 12, padding: 12, fontSize: 14, marginBottom: 14 },
  marginBanner: { padding: 8, borderRadius: 10, marginBottom: 14, alignItems: 'center' },
  marginText: { fontSize: 11, fontWeight: '800' },
  dropdownSelect: { borderRadius: 12, borderWidth: 1, padding: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  dropdownSelectText: { fontSize: 14, fontWeight: '600' },
  dropdownMenu: { borderRadius: 14, borderWidth: 1, marginBottom: 14, overflow: 'hidden' },
  dropdownOption: { padding: 14, borderBottomWidth: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dropdownOptionText: { fontSize: 13, fontWeight: '600' },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  barcodeSection: { marginTop: 10, marginBottom: 20 },
  genBarcodeBtn: { backgroundColor: BRAND_COLORS.navyInk, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, flexDirection: 'row', alignItems: 'center' },
  genBarcodeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800', marginLeft: 4 },
  stickySaveBar: { padding: 16, borderTopWidth: 1 },
  submitBtn: { backgroundColor: BRAND_COLORS.navyInk, borderRadius: 14, paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
  submitBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },
  detailHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1 },
  detailTitle: { fontSize: 20, fontWeight: '900' },
  heroBanner: { backgroundColor: BRAND_COLORS.navyInk, borderRadius: 20, padding: 18, marginBottom: 16, alignItems: 'center' },
  heroImageThumb: { width: 70, height: 70, borderRadius: 18, marginBottom: 12 },
  heroBoxIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(255, 255, 255, 0.15)', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  heroPillRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginBottom: 10, justifyContent: 'center' },
  heroPillBlue: { backgroundColor: BRAND_COLORS.blue600, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, marginRight: 6, marginBottom: 4 },
  heroPillBlueText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
  heroPillDark: { backgroundColor: 'rgba(255, 255, 255, 0.2)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, marginRight: 6, marginBottom: 4 },
  heroPillDarkText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  heroPillGreen: { backgroundColor: 'rgba(16, 185, 129, 0.25)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, marginBottom: 4 },
  heroPillGreenText: { color: '#10B981', fontSize: 11, fontWeight: '800' },
  heroProductName: { color: '#FFFFFF', fontSize: 22, fontWeight: '900', marginBottom: 2, textAlign: 'center' },
  heroProductMeta: { color: '#94A3B8', fontSize: 11, marginBottom: 12, textAlign: 'center' },
  heroPriceText: { color: BRAND_COLORS.sky500, fontSize: 26, fontWeight: '900' },
  heroPriceSub: { color: '#94A3B8', fontSize: 11, marginTop: 2 },
  sectionCard: { borderRadius: 18, padding: 16, borderWidth: 1, marginBottom: 16 },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  sectionTitle: { fontSize: 12, fontWeight: '900', color: BRAND_COLORS.blue600, marginLeft: 6, letterSpacing: 0.5 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(100, 116, 139, 0.15)' },
  detailLabel: { fontSize: 12, fontWeight: '600' },
  detailValue: { fontSize: 13, fontWeight: '700' },
  stockBlockGrid: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  stockBox: { width: '48.5%', padding: 14, borderRadius: 14, borderWidth: 1, alignItems: 'center' },
  stockBoxLabel: { fontSize: 10, fontWeight: '600' },
  stockBoxVal: { fontSize: 16, fontWeight: '900', marginTop: 4 },
  detailFooterBar: { paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  footerDeleteBtn: { borderColor: '#EF4444', borderWidth: 1, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center' },
  footerDeleteText: { color: '#EF4444', fontWeight: '800', fontSize: 13, marginLeft: 4 },
  footerRestockBtn: { borderWidth: 1, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center' },
  footerRestockText: { fontWeight: '800', fontSize: 13, marginLeft: 4 },
  footerEditBtn: { backgroundColor: BRAND_COLORS.navyInk, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center' },
  footerEditText: { color: '#FFFFFF', fontWeight: '800', fontSize: 13, marginLeft: 4 },
  hudTopBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 },
  hudTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '900', marginLeft: 8 },
  reticleOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  reticleFrame: { width: 250, height: 160, borderWidth: 2, borderColor: '#10B981', borderRadius: 16, backgroundColor: 'rgba(16, 185, 129, 0.05)' },
  reticleText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700', marginTop: 14, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 10 },
  hudStockSheet: { position: 'absolute', bottom: 0, left: 0, right: 0, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 18, elevation: 12 },
  hudHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  hudProductName: { fontSize: 16, fontWeight: '900' },
  hudProductStock: { fontSize: 12, marginTop: 2 },
  modeToggleRow: { flexDirection: 'row', borderRadius: 10, backgroundColor: 'rgba(100, 116, 139, 0.15)', padding: 2 },
  modeToggleBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8 },
  modeToggleText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800', marginLeft: 4 },
  qtyChipsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  qtyChip: { flex: 1, paddingVertical: 10, borderRadius: 12, borderWidth: 1, alignItems: 'center', marginHorizontal: 3 },
  qtyChipText: { fontSize: 13, fontWeight: '800' },
  applyStockBtn: { backgroundColor: '#10B981', borderRadius: 14, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  applyStockText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900', marginLeft: 8 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', paddingHorizontal: 20 },
  quickModalCard: { borderRadius: 20, padding: 20, borderWidth: 1 },
  submitBtnCompact: { backgroundColor: BRAND_COLORS.blue600, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10 },
});
