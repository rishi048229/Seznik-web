import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import {
  X,
  Plus,
  Utensils,
  Flame,
  Coffee,
  Sparkles,
  Check,
  Tag,
  DollarSign,
  Layers,
} from 'lucide-react-native';
import { useAppTheme } from '@/hooks/useAppTheme';
import { BRAND_COLORS } from '@/constants/theme';
import { useProducts } from '@/hooks/useProducts';
import { useCategories } from '@/hooks/useCategories';
import { sanitizeErrorMessage } from '@/utils/errorHandler';
import type { Product } from '@/types/product';

interface AddFoodItemModalProps {
  visible: boolean;
  onClose: () => void;
  onItemCreated?: (createdItem: any) => void;
  productToEdit?: Product | null;
}

type FoodDietaryType = 'veg' | 'non_veg' | 'egg';

const FOOD_CATEGORIES = [
  'Fast Food & Snacks',
  'Beverages & Chai',
  'Main Course',
  'Starters & Tandoor',
  'Breads & Rice',
  'Desserts & Sweets',
  'Bakery & Cakes',
  'South Indian',
  'Chinese & Momos',
];

const FOOD_UNITS = ['Plate', 'Portion', 'Piece', 'Cup', 'Half', 'Full', 'Bowl', 'Combo'];

const KITCHEN_STATIONS = [
  { id: 'main', name: 'Main Kitchen' },
  { id: 'tandoor', name: 'Tandoor & Grill' },
  { id: 'beverages', name: 'Beverage Bar & Chai' },
  { id: 'bakery', name: 'Bakery & Dessert' },
];

export function AddFoodItemModal({ visible, onClose, onItemCreated, productToEdit }: AddFoodItemModalProps) {
  const theme = useAppTheme();
  const { createProduct, updateProduct, isCreating, isUpdating } = useProducts();
  const { categories } = useCategories();
  const isEdit = Boolean(productToEdit?.id);

  const [name, setName] = useState('');
  const [dietaryType, setDietaryType] = useState<FoodDietaryType>('veg');
  const [categoryName, setCategoryName] = useState('Fast Food & Snacks');
  const [unit, setUnit] = useState('Plate');
  const [price, setPrice] = useState('');
  const [costPrice, setCostPrice] = useState('');
  const [taxRate, setTaxRate] = useState('5'); // Standard 5% restaurant GST in India
  const [kitchenStation, setKitchenStation] = useState('Main Kitchen');
  const [preparationTime, setPreparationTime] = useState('10');
  const [isAvailable, setIsAvailable] = useState(true);

  useEffect(() => {
    if (!visible) return;
    if (productToEdit) {
      setName(productToEdit.name || '');
      setPrice(String(productToEdit.sellingPrice ?? ''));
      setCostPrice(String(productToEdit.costPrice ?? ''));
      setTaxRate(String(productToEdit.taxRate ?? 5));
      setUnit(productToEdit.unit || 'Plate');
      setIsAvailable(productToEdit.isAvailable !== false && productToEdit.isActive !== false);
      const cat = categories.find((c) => c.id === productToEdit.categoryId);
      if (cat?.name) setCategoryName(cat.name);
    } else {
      setName('');
      setPrice('');
      setCostPrice('');
      setDietaryType('veg');
      setCategoryName('Fast Food & Snacks');
      setUnit('Plate');
      setTaxRate('5');
      setKitchenStation('Main Kitchen');
      setPreparationTime('10');
      setIsAvailable(true);
    }
  }, [visible, productToEdit, categories]);

  const handleCreateFoodItem = async () => {
    const trimmedName = name.trim();
    const sellingPrice = parseFloat(price);

    if (!trimmedName) {
      Alert.alert('Required Field', 'Please enter the dish / food item name.');
      return;
    }
    if (isNaN(sellingPrice) || sellingPrice <= 0) {
      Alert.alert('Required Field', 'Please enter a valid selling price.');
      return;
    }

    try {
      // Find matching category or create product
      const matchedCat = categories.find(
        (c) => c.name.toLowerCase() === categoryName.toLowerCase()
      );

      const payload: any = {
        name: trimmedName,
        sellingPrice,
        costPrice: parseFloat(costPrice) || 0,
        currentStock: 0,
        lowStockThreshold: 0,
        unit,
        taxRate: parseFloat(taxRate) || 0,
        priceIncludesGst: true,
        categoryId: matchedCat?.id,
        dietaryType,
        kitchenStation,
        prepTimeMinutes: parseInt(preparationTime, 10) || 10,
        isFoodItem: true,
        isActive: isAvailable,
        isAvailable,
      };

      if (isEdit && productToEdit?.id) {
        await updateProduct({ id: productToEdit.id, payload });
        onClose();
        onItemCreated?.(productToEdit);
        Alert.alert('Menu updated', `"${trimmedName}" was saved.`);
        return;
      }

      const result = await createProduct(payload);
      onClose();
      onItemCreated?.(result);
      Alert.alert('Food Item Added!', `"${trimmedName}" is now live on your food menu.`);
    } catch (err: any) {
      Alert.alert('Error', sanitizeErrorMessage(err, 'Failed to create food item. Please check item details and try again.'));
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View
          style={[
            styles.modalSheet,
            { backgroundColor: theme.cardBg, borderColor: theme.borderColor },
          ]}
        >
          {/* Header */}
          <View style={[styles.headerRow, { borderBottomColor: theme.borderColor }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={styles.headerIconWrap}>
                <Utensils size={18} color={BRAND_COLORS.blue600} />
              </View>
              <View style={{ marginLeft: 10 }}>
                <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>
                  {isEdit ? 'Edit Menu Item' : 'Add Food / Menu Item'}
                </Text>
                <Text style={[styles.headerSub, { color: theme.textSecondary }]}>
                  Quick setup for cloud kitchens, cafes, & food stalls
                </Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={onClose}
              style={[styles.closeBtn, { backgroundColor: theme.bg, borderColor: theme.borderColor }]}
            >
              <X size={18} color={theme.textPrimary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollBody} contentContainerStyle={{ paddingBottom: 30 }}>
            {/* 1. Dish Name & Dietary Type */}
            <View style={styles.formGroup}>
              <Text style={[styles.inputLabel, { color: theme.textPrimary }]}>
                Dish / Menu Name *
              </Text>
              <TextInput
                style={[
                  styles.textInput,
                  { backgroundColor: theme.bg, borderColor: theme.borderColor, color: theme.textPrimary },
                ]}
                placeholder="e.g. Masala Dosa, Cold Coffee, Paneer Roll"
                placeholderTextColor="#94A3B8"
                value={name}
                onChangeText={setName}
                autoFocus
              />
            </View>

            {/* 2. Dietary Type Picker (Veg, Non-Veg, Egg) */}
            <View style={styles.formGroup}>
              <Text style={[styles.inputLabel, { color: theme.textPrimary }]}>
                Dietary Indicator
              </Text>
              <View style={styles.dietaryRow}>
                <TouchableOpacity
                  onPress={() => setDietaryType('veg')}
                  style={[
                    styles.dietaryPill,
                    dietaryType === 'veg' && styles.dietaryPillVegActive,
                    { backgroundColor: dietaryType === 'veg' ? 'rgba(16, 185, 129, 0.15)' : theme.bg, borderColor: dietaryType === 'veg' ? '#10B981' : theme.borderColor },
                  ]}
                >
                  <View style={styles.vegIconBox}>
                    <View style={styles.vegDot} />
                  </View>
                  <Text style={[styles.dietaryText, { color: dietaryType === 'veg' ? '#10B981' : theme.textPrimary }]}>
                    Pure Veg (🟢)
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setDietaryType('non_veg')}
                  style={[
                    styles.dietaryPill,
                    dietaryType === 'non_veg' && styles.dietaryPillNonVegActive,
                    { backgroundColor: dietaryType === 'non_veg' ? 'rgba(239, 68, 68, 0.15)' : theme.bg, borderColor: dietaryType === 'non_veg' ? '#EF4444' : theme.borderColor },
                  ]}
                >
                  <View style={styles.nonVegIconBox}>
                    <View style={styles.nonVegDot} />
                  </View>
                  <Text style={[styles.dietaryText, { color: dietaryType === 'non_veg' ? '#EF4444' : theme.textPrimary }]}>
                    Non-Veg (🔴)
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setDietaryType('egg')}
                  style={[
                    styles.dietaryPill,
                    dietaryType === 'egg' && styles.dietaryPillEggActive,
                    { backgroundColor: dietaryType === 'egg' ? 'rgba(245, 158, 11, 0.15)' : theme.bg, borderColor: dietaryType === 'egg' ? '#F59E0B' : theme.borderColor },
                  ]}
                >
                  <View style={styles.eggIconBox}>
                    <View style={styles.eggDot} />
                  </View>
                  <Text style={[styles.dietaryText, { color: dietaryType === 'egg' ? '#F59E0B' : theme.textPrimary }]}>
                    Egg (🟡)
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* 3. Pricing & Tax */}
            <View style={styles.twoColRow}>
              <View style={{ flex: 1, marginRight: 6 }}>
                <Text style={[styles.inputLabel, { color: theme.textPrimary }]}>
                  Selling Price (₹) *
                </Text>
                <TextInput
                  style={[
                    styles.textInput,
                    { backgroundColor: theme.bg, borderColor: theme.borderColor, color: theme.textPrimary },
                  ]}
                  placeholder="₹ 150.00"
                  placeholderTextColor="#94A3B8"
                  keyboardType="numeric"
                  value={price}
                  onChangeText={setPrice}
                />
              </View>

              <View style={{ flex: 1, marginLeft: 6 }}>
                <Text style={[styles.inputLabel, { color: theme.textPrimary }]}>
                  GST Rate (%)
                </Text>
                <View style={styles.gstPillsRow}>
                  {['0', '5', '12', '18'].map((rate) => {
                    const active = taxRate === rate;
                    return (
                      <TouchableOpacity
                        key={rate}
                        onPress={() => setTaxRate(rate)}
                        style={[
                          styles.gstPill,
                          active && { backgroundColor: BRAND_COLORS.blue600, borderColor: BRAND_COLORS.blue600 },
                          !active && { backgroundColor: theme.bg, borderColor: theme.borderColor },
                        ]}
                      >
                        <Text style={[styles.gstPillText, { color: active ? '#FFFFFF' : theme.textSecondary }]}>
                          {rate}%
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </View>

            {/* 4. Portion / Serving Unit */}
            <View style={styles.formGroup}>
              <Text style={[styles.inputLabel, { color: theme.textPrimary }]}>
                Serving Portion / Unit
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                {FOOD_UNITS.map((u) => {
                  const active = unit === u;
                  return (
                    <TouchableOpacity
                      key={u}
                      onPress={() => setUnit(u)}
                      style={[
                        styles.unitChip,
                        active && { backgroundColor: BRAND_COLORS.blue600, borderColor: BRAND_COLORS.blue600 },
                        !active && { backgroundColor: theme.bg, borderColor: theme.borderColor },
                      ]}
                    >
                      <Text style={[styles.unitChipText, { color: active ? '#FFFFFF' : theme.textPrimary }]}>
                        {u}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* 5. Food Category */}
            <View style={styles.formGroup}>
              <Text style={[styles.inputLabel, { color: theme.textPrimary }]}>
                Food Category
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                {FOOD_CATEGORIES.map((cat) => {
                  const active = categoryName === cat;
                  return (
                    <TouchableOpacity
                      key={cat}
                      onPress={() => setCategoryName(cat)}
                      style={[
                        styles.categoryChip,
                        active && { backgroundColor: 'rgba(37, 99, 235, 0.15)', borderColor: BRAND_COLORS.blue600 },
                        !active && { backgroundColor: theme.bg, borderColor: theme.borderColor },
                      ]}
                    >
                      <Text style={[styles.categoryChipText, { color: active ? BRAND_COLORS.blue600 : theme.textSecondary }]}>
                        {cat}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* 6. Kitchen Station & Routing */}
            <View style={styles.formGroup}>
              <Text style={[styles.inputLabel, { color: theme.textPrimary }]}>
                Kitchen Station (For KOT Routing)
              </Text>
              <View style={styles.stationGrid}>
                {KITCHEN_STATIONS.map((station) => {
                  const active = kitchenStation === station.name;
                  return (
                    <TouchableOpacity
                      key={station.id}
                      onPress={() => setKitchenStation(station.name)}
                      style={[
                        styles.stationTile,
                        active && { backgroundColor: 'rgba(37, 99, 235, 0.12)', borderColor: BRAND_COLORS.blue600 },
                        !active && { backgroundColor: theme.bg, borderColor: theme.borderColor },
                      ]}
                    >
                      <Text style={[styles.stationTitle, { color: active ? BRAND_COLORS.blue600 : theme.textPrimary }]}>
                        {station.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={[styles.formGroup, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}>
              <Text style={[styles.inputLabel, { color: theme.textPrimary, marginBottom: 0 }]}>Available on menu</Text>
              <TouchableOpacity
                onPress={() => setIsAvailable((v) => !v)}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                  borderRadius: 999,
                  backgroundColor: isAvailable ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.12)',
                }}
              >
                <Text style={{ fontWeight: '800', color: isAvailable ? '#059669' : '#DC2626' }}>
                  {isAvailable ? 'Available' : 'Hidden'}
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>

          {/* Sticky Submit Bar */}
          <View style={[styles.footerBar, { borderTopColor: theme.borderColor, backgroundColor: theme.cardBg }]}>
            <TouchableOpacity
              onPress={handleCreateFoodItem}
              disabled={isCreating || isUpdating}
              style={[styles.createBtn, (isCreating || isUpdating) && { opacity: 0.7 }]}
            >
              {isCreating || isUpdating ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Plus size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                  <Text style={styles.createBtnText}>{isEdit ? 'Save menu item' : 'Save dish to menu'}</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    borderWidth: 1,
    borderBottomWidth: 0,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  headerIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(37, 99, 235, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 16, fontWeight: '900' },
  headerSub: { fontSize: 11, marginTop: 1 },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollBody: { padding: 16 },
  formGroup: { marginBottom: 14 },
  inputLabel: { fontSize: 12, fontWeight: '800', marginBottom: 6 },
  textInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    fontWeight: '700',
  },
  dietaryRow: { flexDirection: 'row', gap: 8 },
  dietaryPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  dietaryPillVegActive: { borderColor: '#10B981' },
  dietaryPillNonVegActive: { borderColor: '#EF4444' },
  dietaryPillEggActive: { borderColor: '#F59E0B' },
  vegIconBox: {
    width: 14,
    height: 14,
    borderRadius: 3,
    borderWidth: 1.5,
    borderColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  vegDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#10B981' },
  nonVegIconBox: {
    width: 14,
    height: 14,
    borderRadius: 3,
    borderWidth: 1.5,
    borderColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  nonVegDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#EF4444' },
  eggIconBox: {
    width: 14,
    height: 14,
    borderRadius: 3,
    borderWidth: 1.5,
    borderColor: '#F59E0B',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  eggDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#F59E0B' },
  dietaryText: { fontSize: 11.5, fontWeight: '800' },
  twoColRow: { flexDirection: 'row', marginBottom: 14 },
  gstPillsRow: { flexDirection: 'row', gap: 4 },
  gstPill: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gstPillText: { fontSize: 12, fontWeight: '800' },
  unitChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  unitChipText: { fontSize: 12, fontWeight: '700' },
  categoryChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  categoryChipText: { fontSize: 12, fontWeight: '700' },
  stationGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  stationTile: {
    width: '48%',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
  stationTitle: { fontSize: 12, fontWeight: '800' },
  footerBar: { padding: 14, borderTopWidth: 1 },
  createBtn: {
    backgroundColor: BRAND_COLORS.navyInk,
    borderRadius: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  createBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
});
