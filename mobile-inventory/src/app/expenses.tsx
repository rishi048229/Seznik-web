import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  ScrollView,
  ActivityIndicator,
  Alert,
  Image,
  StyleSheet,
  StatusBar,
  Platform,
} from 'react-native';
import { useSafeAreaInsets, SafeAreaView } from 'react-native-safe-area-context';
import {
  Search,
  Plus,
  ArrowLeft,
  Camera,
  Trash2,
  Edit3,
  X,
  Wallet,
  Smartphone,
  CreditCard,
  TrendingUp,
  TrendingDown,
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useExpenses } from '@/hooks/useExpenses';
import { Expense } from '@/types/expense';
import { EXPENSE_CATEGORIES, getCategoryDef } from '@/constants/expenseCategories';
import { BRAND_COLORS } from '@/constants/theme';
import { useAppTheme } from '@/hooks/useAppTheme';
import { ScreenBackground } from '@/components/ui/ScreenBackground';
import { KeyboardAvoidingWrapper } from '@/components/ui/KeyboardAvoidingWrapper';
import { ListScreenSkeleton, ExpensesListSkeleton } from '@/components/ui/ScreenSkeleton';
import { ScreenLoadingState, ScreenErrorState } from '@/components/ui/ScreenLoadingState';
import { useLanguageStore } from '@/store/useLanguageStore';

type Period = 'today' | 'week' | 'month' | 'all';

const PERIODS: { id: Period; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: 'week', label: 'Last 7 Days' },
  { id: 'month', label: 'This Month' },
  { id: 'all', label: 'All Time' },
];

const PAYMENT_METHODS: { id: string; label: string; icon: typeof Wallet }[] = [
  { id: 'cash', label: 'Cash', icon: Wallet },
  { id: 'upi', label: 'UPI', icon: Smartphone },
  { id: 'card', label: 'Card', icon: CreditCard },
];

// Module-level (not inline in the component) so the React Compiler's purity check doesn't flag
// the `new Date()` call — see the identical pattern already used in customers/index.tsx.
const getPeriodWindow = (period: Period) => {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (period === 'today') {
    const prevStart = new Date(startOfToday);
    prevStart.setDate(prevStart.getDate() - 1);
    return { start: startOfToday, end: now, prevStart, prevEnd: startOfToday, hasComparison: true };
  }
  if (period === 'week') {
    const start = new Date(startOfToday);
    start.setDate(start.getDate() - 6);
    const prevStart = new Date(start);
    prevStart.setDate(prevStart.getDate() - 7);
    return { start, end: now, prevStart, prevEnd: start, hasComparison: true };
  }
  if (period === 'month') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return { start, end: now, prevStart, prevEnd: start, hasComparison: true };
  }
  // 'all'
  return { start: new Date(0), end: now, prevStart: new Date(0), prevEnd: new Date(0), hasComparison: false };
};

const resolveExpenseDate = (e: Expense): Date => {
  const raw = e.expenseDate || e.date || e.createdAt;
  return raw ? new Date(raw) : new Date(0);
};

import { useTranslation } from '@/store/useLanguageStore';

export default function ExpensesScreen() {
  const router = useRouter();
  const { t, currentLanguage } = useTranslation();
  const { expenses, isLoading, isRefetching, isError, refetch, createExpense, updateExpense, deleteExpense } = useExpenses();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [period, setPeriod] = useState<Period>('month');

  // Add/Edit Expense Sheet State
  const [showModal, setShowModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState(EXPENSE_CATEGORIES[0].label);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [description, setDescription] = useState('');
  const [receiptImage, setReceiptImage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const topPadding = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0, 12);

  const { periodExpenses, periodTotal, deltaPct, hasComparison } = useMemo(() => {
    const { start, end, prevStart, prevEnd, hasComparison: cmp } = getPeriodWindow(period);
    const inRange = expenses.filter((e) => {
      const d = resolveExpenseDate(e);
      return d >= start && d <= end;
    });
    const inPrevRange = cmp
      ? expenses.filter((e) => {
          const d = resolveExpenseDate(e);
          return d >= prevStart && d < prevEnd;
        })
      : [];
    const total = inRange.reduce((sum, e) => sum + e.amount, 0);
    const prevTotal = inPrevRange.reduce((sum, e) => sum + e.amount, 0);
    const pct = prevTotal > 0 ? Math.round(((total - prevTotal) / prevTotal) * 100) : null;
    return { periodExpenses: inRange, periodTotal: total, deltaPct: pct, hasComparison: cmp };
  }, [expenses, period]);

  const filteredExpenses = periodExpenses.filter((e) => {
    const matchesSearch =
      e.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (e.notes && e.notes.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (e.description && e.description.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCat = selectedCategory ? e.category === selectedCategory : true;
    return matchesSearch && matchesCat;
  });

  const categoryBreakdown = useMemo(() => {
    const totals = new Map<string, number>();
    periodExpenses.forEach((e) => {
      totals.set(e.category, (totals.get(e.category) || 0) + e.amount);
    });
    return Array.from(totals.entries())
      .map(([label, amt]) => ({ def: getCategoryDef(label), amount: amt, percent: periodTotal > 0 ? Math.round((amt / periodTotal) * 100) : 0 }))
      .sort((a, b) => b.amount - a.amount);
  }, [periodExpenses, periodTotal, currentLanguage]);

  const paymentModeBreakdown = useMemo(() => {
    const totals = new Map<string, number>();
    periodExpenses.forEach((e) => {
      const method = (e.paymentMethod || 'cash').toLowerCase();
      totals.set(method, (totals.get(method) || 0) + e.amount);
    });
    return PAYMENT_METHODS.map((m) => ({ ...m, amount: totals.get(m.id) || 0 }));
  }, [periodExpenses, currentLanguage]);

  const resetForm = () => {
    setEditingExpense(null);
    setAmount('');
    setCategory(EXPENSE_CATEGORIES[0].label);
    setPaymentMethod('cash');
    setDescription('');
    setReceiptImage(null);
  };

  const handleOpenAdd = () => {
    resetForm();
    setShowModal(true);
  };

  const handleOpenEdit = (e: Expense) => {
    setEditingExpense(e);
    setAmount(String(e.amount));
    setCategory(e.category);
    setPaymentMethod((e.paymentMethod || 'cash').toLowerCase());
    setDescription(e.notes || e.description || '');
    setReceiptImage(e.receiptImageURL || e.receiptImageUrl || null);
    setShowModal(true);
  };

  const handlePickReceipt = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission Denied', 'Camera permission is required to capture receipt image.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]?.uri) {
      setReceiptImage(result.assets[0].uri);
    }
  };

  const handleSaveExpense = async () => {
    if (!amount.trim() || parseFloat(amount) <= 0) {
      Alert.alert('Required Amount', 'Please enter a valid expense amount.');
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        amount: parseFloat(amount),
        category,
        paymentMethod,
        notes: description.trim() || undefined,
        description: description.trim() || undefined,
        receiptImageUrl: receiptImage || undefined,
        receiptImageURL: receiptImage || undefined,
        date: editingExpense ? undefined : new Date().toISOString(),
        expenseDate: editingExpense ? undefined : new Date().toISOString(),
      };
      if (editingExpense) {
        await updateExpense({ id: editingExpense.id, payload });
        Alert.alert('Expense Updated!', 'The expense record was updated.');
      } else {
        await createExpense(payload);
        Alert.alert('Expense Recorded!', 'Your business expense has been logged.');
      }
      setShowModal(false);
      resetForm();
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to record expense');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteExpense = (e: Expense) => {
    Alert.alert('Delete Expense', `Are you sure you want to delete expense record of ₹${e.amount}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteExpense(e.id);
          } catch (err: any) {
            Alert.alert('Error', err?.message || 'Failed to delete expense');
          }
        },
      },
    ]);
  };

  return (
    <ScreenBackground color={theme.bg}>
      <StatusBar
        barStyle={theme.isDark ? 'light-content' : 'dark-content'}
        backgroundColor={theme.bg}
      />
      <View style={[styles.container, { backgroundColor: 'transparent', paddingTop: topPadding }]}>
        <View style={styles.mainWrapper}>
          <View style={styles.headerRow}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.backBtn}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <ArrowLeft size={20} color={theme.textSecondary} />
              <Text style={[styles.backBtnText, { color: theme.textSecondary }]}>{t('back', 'Back')}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleOpenAdd} style={styles.addBtn}>
              <Plus size={16} color="#FFFFFF" />
              <Text style={styles.addBtnText}>{t('addExpense', 'Add Expense')}</Text>
            </TouchableOpacity>
          </View>

        <Text style={[styles.title, { color: theme.textPrimary }]}>{t('expensesPageTitle', 'Expense Tracker')}</Text>
        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
          {t('expensesSubtitle', 'Categorized spending, payment split & camera receipts')}
        </Text>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
          {/* Period Selector */}
          <View style={[styles.periodRow, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
            {PERIODS.map((p) => (
              <TouchableOpacity
                key={p.id}
                onPress={() => setPeriod(p.id)}
                style={[styles.periodChip, period === p.id && { backgroundColor: BRAND_COLORS.blue600 }]}
              >
                <Text style={[styles.periodChipText, { color: period === p.id ? '#FFFFFF' : theme.textSecondary }]}>
                  {p.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Total Expense Banner */}
          <View style={[styles.totalBanner, { backgroundColor: BRAND_COLORS.navyInk }]}>
            <Text style={styles.totalBannerLabel}>{t('total', 'Total Spend')} · {PERIODS.find((p) => p.id === period)?.label}</Text>
            <Text style={styles.totalBannerValue}>₹{periodTotal.toFixed(2)}</Text>
            {hasComparison && deltaPct !== null ? (
              <View style={styles.deltaRow}>
                {deltaPct >= 0 ? <TrendingUp size={12} color="#F87171" /> : <TrendingDown size={12} color="#4ADE80" />}
                <Text style={[styles.deltaText, { color: deltaPct >= 0 ? '#F87171' : '#4ADE80' }]}>
                  {Math.abs(deltaPct)}% vs previous period
                </Text>
              </View>
            ) : null}
          </View>

          {/* Payment Mode Split */}
          <Text style={styles.sectionHeader}>{t('paymentModeSplit', 'PAYMENT MODE SPLIT')}</Text>
          <View style={styles.paymentSplitRow}>
            {paymentModeBreakdown.map((m) => (
              <View key={m.id} style={[styles.paymentTile, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
                <m.icon size={16} color={BRAND_COLORS.blue600} />
                <Text style={[styles.paymentTileValue, { color: theme.textPrimary }]}>₹{m.amount.toFixed(0)}</Text>
                <Text style={[styles.paymentTileLabel, { color: theme.textSecondary }]}>{m.label}</Text>
              </View>
            ))}
          </View>

          {/* Category Breakdown */}
          {categoryBreakdown.length > 0 ? (
            <>
              <Text style={styles.sectionHeader}>{t('categoryBreakdown', 'CATEGORY BREAKDOWN')}</Text>
              <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.borderColor, marginBottom: 16 }]}>
                {categoryBreakdown.map((row) => (
                  <View key={row.def.label} style={styles.breakdownRow}>
                    <View style={[styles.breakdownIconBox, { backgroundColor: `${row.def.color}1F` }]}>
                      <row.def.icon size={14} color={row.def.color} />
                    </View>
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <Text style={[styles.breakdownLabel, { color: theme.textPrimary }]}>{row.def.label}</Text>
                        <Text style={[styles.breakdownAmount, { color: theme.textPrimary }]}>₹{row.amount.toFixed(0)}</Text>
                      </View>
                      <View style={styles.progressBarBg}>
                        <View style={[styles.progressBarFill, { width: `${Math.min(100, row.percent)}%`, backgroundColor: row.def.color }]} />
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            </>
          ) : null}

          {/* Category Filter Chips */}
          <Text style={styles.sectionHeader}>{t('filterByCategory', 'FILTER BY CATEGORY')}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
            <TouchableOpacity
              onPress={() => setSelectedCategory(null)}
              style={[
                styles.catChip,
                { borderColor: theme.borderColor, backgroundColor: !selectedCategory ? BRAND_COLORS.blue600 : theme.cardBg },
              ]}
            >
              <Text style={[styles.catChipText, { color: !selectedCategory ? '#FFFFFF' : theme.textSecondary }]}>{t('allCategories', 'All Categories')}</Text>
            </TouchableOpacity>
            {EXPENSE_CATEGORIES.map((cat) => {
              const selected = selectedCategory === cat.label;
              return (
                <TouchableOpacity
                  key={cat.id}
                  onPress={() => setSelectedCategory(cat.label)}
                  style={[
                    styles.catChip,
                    { borderColor: selected ? cat.color : theme.borderColor, backgroundColor: selected ? `${cat.color}1F` : theme.cardBg },
                  ]}
                >
                  <cat.icon size={12} color={cat.color} />
                  <Text style={[styles.catChipText, { color: selected ? cat.color : theme.textSecondary, marginLeft: 5 }]}>{cat.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <View style={[styles.searchBox, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
            <Search size={16} color={theme.textSecondary} />
            <TextInput
              style={[styles.searchInput, { color: theme.textPrimary }]}
              placeholder={t('searchProducts', 'Search notes or category...')}
              placeholderTextColor="#94A3B8"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          <Text style={styles.sectionHeader}>TRANSACTIONS ({filteredExpenses.length})</Text>
          {isLoading ? (
            <ScreenLoadingState
              message={t('loadingExpenses', 'Loading expenses...')}
              hint={t('loadingExpensesHint', 'Fetching cash outflows and expense records')}
              skeleton={<ExpensesListSkeleton count={5} />}
            />
          ) : isError ? (
            <ScreenErrorState
              message={t('expensesLoadError', 'Could not load expenses')}
              hint={t('expensesLoadErrorHint', 'Check your connection and try again')}
              onRetry={refetch}
              isRetrying={isRefetching}
            />
          ) : filteredExpenses.length === 0 ? (
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No expenses in this period.</Text>
          ) : (
            filteredExpenses
              .sort((a, b) => resolveExpenseDate(b).getTime() - resolveExpenseDate(a).getTime())
              .map((item) => {
                const def = getCategoryDef(item.category);
                return (
                  <View key={item.id} style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
                    <View style={[styles.breakdownIconBox, { backgroundColor: `${def.color}1F` }]}>
                      <def.icon size={16} color={def.color} />
                    </View>
                    <View style={{ flex: 1, marginLeft: 10, marginRight: 8 }}>
                      <Text style={[styles.expCategory, { color: theme.textPrimary }]}>{item.category}</Text>
                      <Text style={[styles.expDate, { color: theme.textSecondary }]}>
                        {resolveExpenseDate(item).toLocaleDateString()} · {(item.paymentMethod || 'cash').toUpperCase()}
                      </Text>
                      {item.notes ? (
                        <Text style={[styles.expNotes, { color: theme.textSecondary }]} numberOfLines={1}>{item.notes}</Text>
                      ) : null}
                    </View>

                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.expAmount}>-₹{item.amount.toFixed(2)}</Text>
                      <View style={{ flexDirection: 'row', marginTop: 6 }}>
                        <TouchableOpacity onPress={() => handleOpenEdit(item)} style={[styles.iconBtn, { marginRight: 6 }]}>
                          <Edit3 size={13} color={theme.textSecondary} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => handleDeleteExpense(item)} style={styles.deleteBtn}>
                          <Trash2 size={13} color="#EF4444" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                );
              })
          )}
        </ScrollView>
      </View>

      {/* Add/Edit Expense Sheet */}
      <Modal visible={showModal} animationType="slide">
        <KeyboardAvoidingWrapper inModal>
        <SafeAreaView style={[styles.modalSafeArea, { backgroundColor: theme.bg }]}>
          <ScrollView style={{ flex: 1, padding: 16 }}>
            <View style={styles.sheetHeader}>
              <Text style={[styles.sheetTitle, { color: theme.textPrimary }]}>
                {editingExpense ? 'Edit Expense' : 'Record New Expense'}
              </Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <X size={24} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.label, { color: theme.textPrimary }]}>Amount (₹) *</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.cardBg, borderColor: theme.borderColor, color: theme.textPrimary }]}
              value={amount}
              onChangeText={setAmount}
              keyboardType="numeric"
              placeholder="500.00"
              placeholderTextColor="#94A3B8"
            />

            <Text style={[styles.label, { color: theme.textPrimary }]}>Expense Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
              {EXPENSE_CATEGORIES.map((cat) => {
                const selected = category === cat.label;
                return (
                  <TouchableOpacity
                    key={cat.id}
                    onPress={() => setCategory(cat.label)}
                    style={[
                      styles.catChip,
                      { backgroundColor: selected ? cat.color : theme.cardBg, borderColor: selected ? cat.color : theme.borderColor },
                    ]}
                  >
                    <cat.icon size={12} color={selected ? '#FFFFFF' : cat.color} />
                    <Text style={[styles.catChipText, { color: selected ? '#FFFFFF' : theme.textSecondary, marginLeft: 5 }]}>{cat.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <Text style={[styles.label, { color: theme.textPrimary }]}>Paid Via</Text>
            <View style={{ flexDirection: 'row', marginBottom: 14 }}>
              {PAYMENT_METHODS.map((m) => {
                const selected = paymentMethod === m.id;
                return (
                  <TouchableOpacity
                    key={m.id}
                    onPress={() => setPaymentMethod(m.id)}
                    style={[
                      styles.paymentMethodChip,
                      { backgroundColor: selected ? BRAND_COLORS.blue600 : theme.cardBg, borderColor: selected ? BRAND_COLORS.blue600 : theme.borderColor },
                    ]}
                  >
                    <m.icon size={14} color={selected ? '#FFFFFF' : theme.textSecondary} />
                    <Text style={[styles.paymentMethodText, { color: selected ? '#FFFFFF' : theme.textSecondary }]}>{m.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={[styles.label, { color: theme.textPrimary }]}>Notes</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.cardBg, borderColor: theme.borderColor, color: theme.textPrimary }]}
              value={description}
              onChangeText={setDescription}
              placeholder="e.g. Electricity bill for August"
              placeholderTextColor="#94A3B8"
            />

            <Text style={[styles.label, { color: theme.textPrimary }]}>Camera Receipt Capture</Text>
            <TouchableOpacity onPress={handlePickReceipt} style={styles.cameraBox}>
              {receiptImage ? (
                <Image source={{ uri: receiptImage }} style={{ width: '100%', height: 140, borderRadius: 12 }} />
              ) : (
                <View style={{ alignItems: 'center' }}>
                  <Camera size={28} color={BRAND_COLORS.blue600} />
                  <Text style={{ fontSize: 12, fontWeight: '700', color: BRAND_COLORS.blue600, marginTop: 6 }}>
                    Snap Receipt Photo
                  </Text>
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity onPress={handleSaveExpense} disabled={submitting} style={styles.submitBtn}>
              {submitting && <ActivityIndicator color="#FFF" style={{ marginRight: 8 }} />}
              <Text style={styles.submitBtnText}>{editingExpense ? 'Save Changes' : 'Save Expense'}</Text>
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
  mainWrapper: { flex: 1, paddingHorizontal: 16, paddingTop: 4 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  backBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 4, marginLeft: -4 },
  backBtnText: { fontSize: 13, fontWeight: '600', marginLeft: 4 },
  addBtn: { backgroundColor: BRAND_COLORS.navyInk, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, flexDirection: 'row', alignItems: 'center' },
  addBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 12, marginLeft: 4 },
  title: { fontSize: 24, fontWeight: '900' },
  subtitle: { fontSize: 12, marginTop: 2, marginBottom: 14 },
  periodRow: { flexDirection: 'row', padding: 4, borderRadius: 14, borderWidth: 1, marginBottom: 14 },
  periodChip: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 10 },
  periodChipText: { fontSize: 10.5, fontWeight: '800' },
  totalBanner: { borderRadius: 18, padding: 16, marginBottom: 16 },
  totalBannerLabel: { fontSize: 10, color: '#94A3B8', textTransform: 'uppercase', fontWeight: '700' },
  totalBannerValue: { fontSize: 26, fontWeight: '900', color: '#FFFFFF', marginTop: 4 },
  deltaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  deltaText: { fontSize: 11, fontWeight: '700', marginLeft: 4 },
  sectionHeader: { fontSize: 10, fontWeight: '800', color: '#94A3B8', letterSpacing: 0.5, marginBottom: 8 },
  paymentSplitRow: { flexDirection: 'row', marginBottom: 16 },
  paymentTile: { flex: 1, alignItems: 'center', borderRadius: 14, borderWidth: 1, paddingVertical: 12, marginRight: 8 },
  paymentTileValue: { fontSize: 14, fontWeight: '900', marginTop: 6 },
  paymentTileLabel: { fontSize: 10, fontWeight: '700', marginTop: 2 },
  card: { borderRadius: 16, padding: 14, borderWidth: 1, marginBottom: 10, flexDirection: 'row', alignItems: 'center' },
  breakdownRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  breakdownIconBox: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  breakdownLabel: { fontSize: 12, fontWeight: '700' },
  breakdownAmount: { fontSize: 12, fontWeight: '800' },
  progressBarBg: { height: 4, backgroundColor: '#E2E8F0', borderRadius: 2, marginTop: 5, overflow: 'hidden' },
  progressBarFill: { height: '100%', borderRadius: 2 },
  catChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 12, borderWidth: 1, marginRight: 8 },
  catChipText: { fontSize: 11, fontWeight: '700' },
  searchBox: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 14 },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 14 },
  expCategory: { fontSize: 14, fontWeight: '800' },
  expDate: { fontSize: 11, marginTop: 2 },
  expNotes: { fontSize: 11, marginTop: 4 },
  expAmount: { fontSize: 15, fontWeight: '900', color: '#EF4444' },
  iconBtn: { padding: 6, borderRadius: 8, backgroundColor: 'rgba(100, 116, 139, 0.12)' },
  deleteBtn: { padding: 6, borderRadius: 8, backgroundColor: 'rgba(239, 68, 68, 0.12)' },
  emptyText: { fontSize: 12, textAlign: 'center', paddingVertical: 30 },
  modalSafeArea: { flex: 1 },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sheetTitle: { fontSize: 20, fontWeight: '900' },
  label: { fontSize: 12, fontWeight: '700', marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: 12, padding: 12, fontSize: 14, marginBottom: 14 },
  paymentMethodChip: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 12, borderWidth: 1, marginRight: 8 },
  paymentMethodText: { fontSize: 12, fontWeight: '700', marginLeft: 6 },
  cameraBox: { height: 140, borderRadius: 14, borderWidth: 1, borderStyle: 'dashed', borderColor: BRAND_COLORS.blue600, backgroundColor: 'rgba(37, 99, 235, 0.05)', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  submitBtn: { backgroundColor: BRAND_COLORS.navyInk, borderRadius: 14, paddingVertical: 14, alignItems: 'center', justifyContent: 'center', marginTop: 10, flexDirection: 'row' },
  submitBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },
});
