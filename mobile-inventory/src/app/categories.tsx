import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Modal,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  Switch,
  StyleSheet,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Search,
  Plus,
  ArrowLeft,
  Layers,
  Edit3,
  Trash2,
  X,
  CornerDownRight,
  FolderPlus,
  Tag,
  Check,
  ChevronDown,
  Info,
  Sparkles,
  ShoppingBag,
  Package,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useCategories } from '@/hooks/useCategories';
import { useProducts } from '@/hooks/useProducts';
import { Category } from '@/types/category';
import { BRAND_COLORS } from '@/constants/theme';
import { useAppTheme } from '@/hooks/useAppTheme';
import { ScreenBackground } from '@/components/ui/ScreenBackground';
import { KeyboardAvoidingWrapper } from '@/components/ui/KeyboardAvoidingWrapper';

export default function CategoriesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { categories, isLoading, createCategory, updateCategory, deleteCategory } = useCategories();
  const { products } = useProducts();

  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [parentId, setParentId] = useState<string | null>(null);
  const [parentDropdownOpen, setParentDropdownOpen] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const theme = useAppTheme();
  const isDark = theme.isDark;

  const rootCategories = categories.filter((c) => !c.parentId);
  const subCategoriesCount = categories.filter((c) => c.parentId).length;

  const filteredRootCategories = rootCategories.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleOpenAdd = (parentCatId?: string) => {
    setEditingCategory(null);
    setName('');
    setDescription('');
    setParentId(parentCatId || null);
    setIsActive(true);
    setParentDropdownOpen(false);
    setShowModal(true);
  };

  const handleOpenEdit = (c: Category) => {
    setEditingCategory(c);
    setName(c.name);
    setDescription(c.description || '');
    setParentId(c.parentId || null);
    setIsActive(c.isActive);
    setParentDropdownOpen(false);
    setShowModal(true);
  };

  const handleSaveCategory = async () => {
    if (!name.trim()) {
      Alert.alert('Required Field', 'Please enter category name.');
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || undefined,
        parentId: parentId || undefined,
        isActive,
      };

      if (editingCategory) {
        await updateCategory({ id: editingCategory.id, payload });
      } else {
        await createCategory(payload);
      }
      setShowModal(false);
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to save category');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (c: Category) => {
    try {
      await updateCategory({ id: c.id, payload: { isActive: !c.isActive } });
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to update category state');
    }
  };

  const handleDeleteCategory = (c: Category) => {
    Alert.alert('Delete Category', `Are you sure you want to delete ${c.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteCategory(c.id);
          } catch (e: any) {
            Alert.alert('Error', e?.message || 'Failed to delete category');
          }
        },
      },
    ]);
  };

  return (
    <ScreenBackground color={theme.bg}>
    <View style={[styles.container, { backgroundColor: 'transparent', paddingTop: insets.top || 12 }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={theme.bg} />

      <View style={styles.mainWrapper}>
        {/* Header Bar */}
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <ArrowLeft size={20} color={theme.textSecondary} />
            <Text style={[styles.backBtnText, { color: theme.textSecondary }]}>Back</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => handleOpenAdd()} style={styles.addBtn}>
            <Plus size={16} color="#FFFFFF" />
            <Text style={styles.addBtnText}>Add Category</Text>
          </TouchableOpacity>
        </View>

        <Text style={[styles.title, { color: theme.textPrimary }]}>Categories & Subcategories</Text>

        {/* Hero Quote Card */}
        <View style={styles.heroQuoteCard}>
          <View style={styles.quoteHeaderRow}>
            <Sparkles size={18} color={BRAND_COLORS.sky500} />
            <Text style={styles.quoteTag}>STORE CATALOG MANAGER</Text>
          </View>

          <Text style={styles.quoteText}>
            "Organize & catalog your store inventory. Here your product categories & nested subcategories will be added and synced."
          </Text>

          <View style={styles.heroStatsRow}>
            <View style={styles.heroStatBadge}>
              <Layers size={13} color="#FFFFFF" />
              <Text style={styles.heroStatText}>{rootCategories.length} Categories</Text>
            </View>
            <View style={[styles.heroStatBadge, { backgroundColor: 'rgba(56, 189, 248, 0.2)' }]}>
              <CornerDownRight size={13} color={BRAND_COLORS.sky500} />
              <Text style={[styles.heroStatText, { color: BRAND_COLORS.sky500 }]}>{subCategoriesCount} Subcategories</Text>
            </View>
          </View>
        </View>

        {/* Search Bar */}
        <View style={[styles.searchBox, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
          <Search size={18} color={theme.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: theme.textPrimary }]}
            placeholder="Search category or subcategory name..."
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {isLoading ? (
          <ActivityIndicator size="large" color={BRAND_COLORS.blue600} style={{ marginVertical: 40 }} />
        ) : categories.length === 0 ? (
          /* Central Empty State Card with prominent middle Add Category button! */
          <View style={[styles.emptyCentralCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
            <View style={styles.emptyIconCircle}>
              <FolderPlus size={36} color={BRAND_COLORS.blue600} />
            </View>
            <Text style={[styles.emptyTitle, { color: theme.textPrimary }]}>No Categories Created Yet</Text>
            <Text style={[styles.emptySub, { color: theme.textSecondary }]}>
              Here your product categories and subcategories will be added initially to organize your store inventory.
            </Text>

            <TouchableOpacity onPress={() => handleOpenAdd()} style={styles.centralAddBtn}>
              <Plus size={18} color="#FFFFFF" />
              <Text style={styles.centralAddBtnText}>Add First Category</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 60 }}>
            {filteredRootCategories.map((parent) => {
              const children = categories.filter((c) => c.parentId === parent.id);
              const parentProductsCount = products.filter((p) => p.categoryId === parent.id).length;

              return (
                <View key={parent.id} style={[styles.categoryTreeCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
                  {/* Parent Category Header Row */}
                  <View style={styles.parentRow}>
                    <View style={styles.parentTitleBox}>
                      <View style={styles.parentIconBox}>
                        <Layers size={18} color={BRAND_COLORS.blue600} />
                      </View>
                      <View style={{ flex: 1, marginLeft: 10 }}>
                        <Text style={[styles.parentTitle, { color: theme.textPrimary }]}>{parent.name}</Text>
                        <Text style={[styles.subCountText, { color: theme.textSecondary }]}>
                          {children.length} Subcategories • {parentProductsCount} Products Linked
                        </Text>
                      </View>
                    </View>

                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Switch
                        value={parent.isActive}
                        onValueChange={() => handleToggleActive(parent)}
                        trackColor={{ false: '#64748B', true: BRAND_COLORS.blue600 }}
                      />
                      <TouchableOpacity
                        onPress={() => handleOpenAdd(parent.id)}
                        style={[styles.addSubBtn, { backgroundColor: 'rgba(37, 99, 235, 0.12)' }]}
                      >
                        <Plus size={12} color={BRAND_COLORS.blue600} />
                        <Text style={styles.addSubText}>Subcat</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => handleOpenEdit(parent)} style={styles.iconBtn}>
                        <Edit3 size={14} color={theme.textSecondary} />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => handleDeleteCategory(parent)} style={styles.iconBtn}>
                        <Trash2 size={14} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Children Subcategories Tree Rows */}
                  {children.map((child) => {
                    const childProductsCount = products.filter((p) => p.categoryId === child.id).length;

                    return (
                      <View key={child.id} style={[styles.childRow, { backgroundColor: theme.bg, borderColor: theme.borderColor }]}>
                        <CornerDownRight size={16} color={BRAND_COLORS.sky500} style={{ marginRight: 8 }} />
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.childTitle, { color: theme.textPrimary }]}>{child.name}</Text>
                          <Text style={[styles.childMeta, { color: theme.textSecondary }]}>
                            {childProductsCount} Products linked
                          </Text>
                        </View>

                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <Switch
                            value={child.isActive}
                            onValueChange={() => handleToggleActive(child)}
                            trackColor={{ false: '#64748B', true: BRAND_COLORS.sky500 }}
                          />
                          <TouchableOpacity onPress={() => handleOpenEdit(child)} style={styles.iconBtn}>
                            <Edit3 size={14} color={theme.textSecondary} />
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => handleDeleteCategory(child)} style={styles.iconBtn}>
                            <Trash2 size={14} color="#EF4444" />
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  })}
                </View>
              );
            })}
          </ScrollView>
        )}
      </View>

      {/* Add / Edit Category Modal */}
      <Modal visible={showModal} animationType="slide">
        <KeyboardAvoidingWrapper inModal>
        <SafeAreaView style={[styles.modalSafeArea, { backgroundColor: theme.bg }]}>
          <ScrollView style={{ flex: 1, padding: 16 }}>
            <View style={styles.sheetHeader}>
              <Text style={[styles.sheetTitle, { color: theme.textPrimary }]}>
                {editingCategory ? 'Edit Category' : 'Add Category'}
              </Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <X size={24} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.label, { color: theme.textPrimary }]}>Category Type</Text>
            <TouchableOpacity
              onPress={() => setParentDropdownOpen(!parentDropdownOpen)}
              style={[styles.dropdownSelect, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}
            >
              <Text style={[styles.dropdownSelectText, { color: theme.textPrimary }]}>
                {parentId
                  ? `Subcategory of: ${categories.find((c) => c.id === parentId)?.name || 'Parent'}`
                  : 'Primary Category (Top Level)'}
              </Text>
              <ChevronDown size={18} color={theme.textSecondary} />
            </TouchableOpacity>

            {parentDropdownOpen ? (
              <View style={[styles.dropdownMenu, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
                <TouchableOpacity
                  onPress={() => {
                    setParentId(null);
                    setParentDropdownOpen(false);
                  }}
                  style={[styles.dropdownOption, { borderBottomColor: theme.borderColor }]}
                >
                  <Text style={[styles.dropdownOptionText, { color: !parentId ? BRAND_COLORS.blue600 : theme.textPrimary }]}>
                    Primary Category (Top Level)
                  </Text>
                  {!parentId ? <Check size={16} color={BRAND_COLORS.blue600} /> : null}
                </TouchableOpacity>

                {rootCategories.map((p) => (
                  <TouchableOpacity
                    key={p.id}
                    onPress={() => {
                      setParentId(p.id);
                      setParentDropdownOpen(false);
                    }}
                    style={[styles.dropdownOption, { borderBottomColor: theme.borderColor }]}
                  >
                    <Text style={[styles.dropdownOptionText, { color: parentId === p.id ? BRAND_COLORS.blue600 : theme.textPrimary }]}>
                      Subcategory of: {p.name}
                    </Text>
                    {parentId === p.id ? <Check size={16} color={BRAND_COLORS.blue600} /> : null}
                  </TouchableOpacity>
                ))}
              </View>
            ) : null}

            <Text style={[styles.label, { color: theme.textPrimary }]}>Category Name *</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.cardBg, borderColor: theme.borderColor, color: theme.textPrimary }]}
              value={name}
              onChangeText={setName}
              placeholder="e.g. Dairy & Beverages"
              placeholderTextColor="#94A3B8"
            />

            <Text style={[styles.label, { color: theme.textPrimary }]}>Description</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.cardBg, borderColor: theme.borderColor, color: theme.textPrimary }]}
              value={description}
              onChangeText={setDescription}
              placeholder="e.g. Milk, curd, cheese and fruit juices"
              placeholderTextColor="#94A3B8"
            />

            <TouchableOpacity onPress={handleSaveCategory} disabled={submitting} style={styles.submitBtn}>
              {submitting && <ActivityIndicator color="#FFF" style={{ marginRight: 8 }} />}
              <Text style={styles.submitBtnText}>Save Category Record</Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
        </KeyboardAvoidingWrapper>
      </Modal>
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
  addBtn: { backgroundColor: BRAND_COLORS.navyInk, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, flexDirection: 'row', alignItems: 'center' },
  addBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 12, marginLeft: 4 },
  title: { fontSize: 24, fontWeight: '900' },
  heroQuoteCard: { backgroundColor: BRAND_COLORS.navyInk, borderRadius: 20, padding: 16, marginVertical: 12 },
  quoteHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  quoteTag: { color: BRAND_COLORS.sky500, fontSize: 10, fontWeight: '800', letterSpacing: 0.5, marginLeft: 6 },
  quoteText: { color: '#F8FAFC', fontSize: 13, fontWeight: '600', fontStyle: 'italic', lineHeight: 18 },
  heroStatsRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
  heroStatBadge: { backgroundColor: BRAND_COLORS.blue600, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, flexDirection: 'row', alignItems: 'center', marginRight: 8 },
  heroStatText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800', marginLeft: 4 },
  searchBox: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 14 },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 14 },
  emptyCentralCard: { marginVertical: 30, borderRadius: 24, padding: 24, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  emptyIconCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(37, 99, 235, 0.15)', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '900', textAlign: 'center', marginBottom: 6 },
  emptySub: { fontSize: 12, textAlign: 'center', marginBottom: 20, paddingHorizontal: 12, lineHeight: 18 },
  centralAddBtn: { backgroundColor: BRAND_COLORS.navyInk, paddingHorizontal: 20, paddingVertical: 14, borderRadius: 14, flexDirection: 'row', alignItems: 'center' },
  centralAddBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 14, marginLeft: 6 },
  categoryTreeCard: { borderRadius: 18, padding: 14, borderWidth: 1, marginBottom: 12 },
  parentRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  parentTitleBox: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  parentIconBox: { width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(37, 99, 235, 0.15)', alignItems: 'center', justifyContent: 'center' },
  parentTitle: { fontSize: 15, fontWeight: '800' },
  subCountText: { fontSize: 11, marginTop: 2 },
  addSubBtn: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, flexDirection: 'row', alignItems: 'center', marginLeft: 6 },
  addSubText: { color: BRAND_COLORS.blue600, fontSize: 10, fontWeight: '800', marginLeft: 2 },
  childRow: { marginLeft: 20, marginTop: 10, borderRadius: 12, padding: 10, borderWidth: 1, flexDirection: 'row', alignItems: 'center' },
  childTitle: { fontSize: 13, fontWeight: '700' },
  childMeta: { fontSize: 10, marginTop: 1 },
  iconBtn: { padding: 6, borderRadius: 8, backgroundColor: 'rgba(100, 116, 139, 0.12)', marginLeft: 6 },
  modalSafeArea: { flex: 1 },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sheetTitle: { fontSize: 20, fontWeight: '900' },
  label: { fontSize: 12, fontWeight: '700', marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: 12, padding: 12, fontSize: 14, marginBottom: 14 },
  dropdownSelect: { borderRadius: 12, borderWidth: 1, padding: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  dropdownSelectText: { fontSize: 13, fontWeight: '600' },
  dropdownMenu: { borderRadius: 14, borderWidth: 1, marginBottom: 14, overflow: 'hidden' },
  dropdownOption: { padding: 14, borderBottomWidth: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dropdownOptionText: { fontSize: 13, fontWeight: '600' },
  submitBtn: { backgroundColor: BRAND_COLORS.navyInk, borderRadius: 14, paddingVertical: 14, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  submitBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },
});
