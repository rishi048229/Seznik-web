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
  ShoppingBag,
  Building2,
  Receipt,
  Image as ImageIcon,
  Tag,
  Check,
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useExpenses } from '@/hooks/useExpenses';
import { useSuppliers } from '@/hooks/useSuppliers';
import { Expense } from '@/types/expense';
import { EXPENSE_CATEGORIES, getCategoryDef } from '@/constants/expenseCategories';
import { BRAND_COLORS } from '@/constants/theme';
import { useAppTheme } from '@/hooks/useAppTheme';
import { ScreenBackground } from '@/components/ui/ScreenBackground';
import { KeyboardAvoidingWrapper } from '@/components/ui/KeyboardAvoidingWrapper';
import { ExpensesListSkeleton } from '@/components/ui/ScreenSkeleton';
import { ScreenLoadingState, ScreenErrorState } from '@/components/ui/ScreenLoadingState';
import { useTranslation } from '@/store/useLanguageStore';

type Period = 'today' | 'week' | 'month' | 'all';
type OutflowTypeFilter = 'all' | 'purchases' | 'expenses';

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

const QUICK_AMOUNTS = [100, 500, 1000, 5000];

// Module-level date helper so React Compiler purity checks pass
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

export interface ParsedMeta {
  vendor?: string;
  invoiceNo?: string;
  userNotes?: string;
}

export function parseExpenseMeta(rawText?: string | null): ParsedMeta {
  if (!rawText) return {};
  const vendorMatch = rawText.match(/\[(?:Vendor|Supplier):\s*([^\]]+)\]/i);
  const invoiceMatch = rawText.match(/\[(?:Bill|Invoice):\s*([^\]]+)\]/i);
  const cleaned = rawText
    .replace(/\[(?:Vendor|Supplier):\s*([^\]]+)\]/gi, '')
    .replace(/\[(?:Bill|Invoice):\s*([^\]]+)\]/gi, '')
    .trim();
  return {
    vendor: vendorMatch ? vendorMatch[1].trim() : undefined,
    invoiceNo: invoiceMatch ? invoiceMatch[1].trim() : undefined,
    userNotes: cleaned || undefined,
  };
}

export function formatExpenseDescription(vendor?: string, invoiceNo?: string, notes?: string): string {
  const parts: string[] = [];
  if (vendor?.trim()) parts.push(`[Vendor: ${vendor.trim()}]`);
  if (invoiceNo?.trim()) parts.push(`[Bill: ${invoiceNo.trim()}]`);
  if (notes?.trim()) parts.push(notes.trim());
  return parts.join(' ');
}

export default function ExpensesScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { expenses, isLoading, isRefetching, isError, refetch, createExpense, updateExpense, deleteExpense } = useExpenses();
  const { suppliers } = useSuppliers();

  const [typeFilter, setTypeFilter] = useState<OutflowTypeFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [period, setPeriod] = useState<Period>('month');

  // Add/Edit Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [modalMode, setModalMode] = useState<'expense' | 'purchase'>('expense');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState(EXPENSE_CATEGORIES[0].label);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [vendorName, setVendorName] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [receiptImage, setReceiptImage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Full-screen Receipt Preview Modal
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const topPadding = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0, 12);

  // Period-filtered base data
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

  // Metric sums: Purchases vs Operating Expenses
  const { purchaseTotal, operatingTotal } = useMemo(() => {
    let pTotal = 0;
    let oTotal = 0;
    periodExpenses.forEach((e) => {
      const def = getCategoryDef(e.category);
      if (def.isPurchase) {
        pTotal += e.amount;
      } else {
        oTotal += e.amount;
      }
    });
    return { purchaseTotal: pTotal, operatingTotal: oTotal };
  }, [periodExpenses]);

  // Filtered List based on Type Filter + Category + Search Query
  const filteredExpenses = useMemo(() => {
    return periodExpenses.filter((e) => {
      const def = getCategoryDef(e.category);
      if (typeFilter === 'purchases' && !def.isPurchase) return false;
      if (typeFilter === 'expenses' && def.isPurchase) return false;
      if (selectedCategory && e.category !== selectedCategory) return false;

      if (!searchQuery.trim()) return true;
      const query = searchQuery.toLowerCase();
      const rawDesc = (e.description || e.notes || '').toLowerCase();
      const cat = e.category.toLowerCase();
      return cat.includes(query) || rawDesc.includes(query);
    });
  }, [periodExpenses, typeFilter, selectedCategory, searchQuery]);

  // Category breakdown for progress bars
  const categoryBreakdown = useMemo(() => {
    const totals = new Map<string, number>();
    periodExpenses.forEach((e) => {
      const def = getCategoryDef(e.category);
      if (typeFilter === 'purchases' && !def.isPurchase) return;
      if (typeFilter === 'expenses' && def.isPurchase) return;
      totals.set(e.category, (totals.get(e.category) || 0) + e.amount);
    });
    const subtotal = Array.from(totals.values()).reduce((a, b) => a + b, 0);
    return Array.from(totals.entries())
      .map(([label, amt]) => ({
        def: getCategoryDef(label),
        amount: amt,
        percent: subtotal > 0 ? Math.round((amt / subtotal) * 100) : 0,
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [periodExpenses, typeFilter]);

  // Payment mode breakdown
  const paymentModeBreakdown = useMemo(() => {
    const totals = new Map<string, number>();
    periodExpenses.forEach((e) => {
      const def = getCategoryDef(e.category);
      if (typeFilter === 'purchases' && !def.isPurchase) return;
      if (typeFilter === 'expenses' && def.isPurchase) return;
      const method = (e.paymentMethod || 'cash').toLowerCase();
      totals.set(method, (totals.get(method) || 0) + e.amount);
    });
    return PAYMENT_METHODS.map((m) => ({ ...m, amount: totals.get(m.id) || 0 }));
  }, [periodExpenses, typeFilter]);

  const resetForm = () => {
    setEditingExpense(null);
    setModalMode('expense');
    setAmount('');
    setCategory(EXPENSE_CATEGORIES[0].label);
    setPaymentMethod('cash');
    setVendorName('');
    setInvoiceNumber('');
    setNotes('');
    setReceiptImage(null);
  };

  const handleOpenAdd = (mode: 'expense' | 'purchase' = 'expense') => {
    resetForm();
    setModalMode(mode);
    if (mode === 'purchase') {
      const firstPurchaseCat = EXPENSE_CATEGORIES.find((c) => c.isPurchase);
      setCategory(firstPurchaseCat ? firstPurchaseCat.label : 'Stock & Inventory Purchase');
    } else {
      const firstExpenseCat = EXPENSE_CATEGORIES.find((c) => !c.isPurchase);
      setCategory(firstExpenseCat ? firstExpenseCat.label : 'Rent & Utilities');
    }
    setShowModal(true);
  };

  const handleOpenEdit = (e: Expense) => {
    const def = getCategoryDef(e.category);
    const meta = parseExpenseMeta(e.description || e.notes);
    setEditingExpense(e);
    setModalMode(def.isPurchase ? 'purchase' : 'expense');
    setAmount(String(e.amount));
    setCategory(e.category);
    setPaymentMethod((e.paymentMethod || 'cash').toLowerCase());
    setVendorName(meta.vendor || '');
    setInvoiceNumber(meta.invoiceNo || '');
    setNotes(meta.userNotes || '');
    setReceiptImage(e.receiptImageURL || e.receiptImageUrl || null);
    setShowModal(true);
  };

  const handlePickCamera = async () => {
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

  const handlePickGallery = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]?.uri) {
      setReceiptImage(result.assets[0].uri);
    }
  };

  const handleSaveExpense = async () => {
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount.');
      return;
    }
    setSubmitting(true);
    try {
      const encodedDesc = formatExpenseDescription(vendorName, invoiceNumber, notes);
      const payload = {
        amount: parsedAmount,
        category,
        paymentMethod,
        notes: encodedDesc || undefined,
        description: encodedDesc || undefined,
        receiptImageUrl: receiptImage || undefined,
        receiptImageURL: receiptImage || undefined,
        date: editingExpense ? undefined : new Date().toISOString(),
        expenseDate: editingExpense ? undefined : new Date().toISOString(),
      };

      if (editingExpense) {
        await updateExpense({ id: editingExpense.id, payload });
        Alert.alert('Updated', 'Record has been successfully updated.');
      } else {
        await createExpense(payload);
        Alert.alert('Saved', modalMode === 'purchase' ? 'Stock purchase recorded!' : 'Expense recorded!');
      }
      setShowModal(false);
      resetForm();
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to save record.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteExpense = (e: Expense) => {
    Alert.alert('Delete Outflow', `Are you sure you want to delete this record of ₹${e.amount}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteExpense(e.id);
          } catch (err: any) {
            Alert.alert('Error', err?.message || 'Failed to delete record.');
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
          {/* Header Row */}
          <View style={styles.headerRow}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.backBtn}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <ArrowLeft size={20} color={theme.textSecondary} />
              <Text style={[styles.backBtnText, { color: theme.textSecondary }]}>{t('back', 'Back')}</Text>
            </TouchableOpacity>

            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity
                onPress={() => handleOpenAdd('purchase')}
                style={[styles.addBtn, { backgroundColor: '#059669' }]}
              >
                <ShoppingBag size={14} color="#FFFFFF" />
                <Text style={styles.addBtnText}>+ Purchase</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => handleOpenAdd('expense')}
                style={[styles.addBtn, { backgroundColor: BRAND_COLORS.navyInk }]}
              >
                <Plus size={14} color="#FFFFFF" />
                <Text style={styles.addBtnText}>+ Expense</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
            <View
              style={{
                width: 32,
                height: 32,
                borderRadius: 9,
                backgroundColor: 'rgba(239, 68, 68, 0.12)',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 8,
              }}
            >
              <TrendingDown size={18} color="#EF4444" strokeWidth={2.5} />
            </View>
            <Text style={[styles.title, { color: theme.textPrimary }]}>
              {t('expensesPageTitle', 'Expenses & Purchases')}
            </Text>
          </View>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            Unified business outflows, stock purchase logs & vendor payments
          </Text>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingBottom: 40 }}
            showsVerticalScrollIndicator={false}
          >
            {/* Top Segmented Filter Tabs: All vs Purchases vs Operating */}
            <View style={[styles.typeTabBar, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
              <TouchableOpacity
                onPress={() => {
                  setTypeFilter('all');
                  setSelectedCategory(null);
                }}
                style={[styles.typeTab, typeFilter === 'all' && styles.typeTabActive]}
              >
                <Text style={[styles.typeTabText, { color: typeFilter === 'all' ? '#FFFFFF' : theme.textSecondary }]}>
                  All Outflows
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  setTypeFilter('purchases');
                  setSelectedCategory(null);
                }}
                style={[styles.typeTab, typeFilter === 'purchases' && { backgroundColor: '#059669' }]}
              >
                <Text style={[styles.typeTabText, { color: typeFilter === 'purchases' ? '#FFFFFF' : theme.textSecondary }]}>
                  Purchases & Stock
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  setTypeFilter('expenses');
                  setSelectedCategory(null);
                }}
                style={[styles.typeTab, typeFilter === 'expenses' && styles.typeTabActive]}
              >
                <Text style={[styles.typeTabText, { color: typeFilter === 'expenses' ? '#FFFFFF' : theme.textSecondary }]}>
                  Operating Expenses
                </Text>
              </TouchableOpacity>
            </View>

            {/* Period Selector Chips */}
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

            {/* Total Spend Summary Cards */}
            <View style={[styles.totalBanner, { backgroundColor: BRAND_COLORS.navyInk }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View>
                  <Text style={styles.totalBannerLabel}>
                    Total Outflow · {PERIODS.find((p) => p.id === period)?.label}
                  </Text>
                  <Text style={styles.totalBannerValue}>₹{periodTotal.toFixed(2)}</Text>
                </View>
                {hasComparison && deltaPct !== null ? (
                  <View style={styles.deltaBadge}>
                    {deltaPct >= 0 ? <TrendingUp size={12} color="#F87171" /> : <TrendingDown size={12} color="#4ADE80" />}
                    <Text style={[styles.deltaText, { color: deltaPct >= 0 ? '#F87171' : '#4ADE80' }]}>
                      {Math.abs(deltaPct)}%
                    </Text>
                  </View>
                ) : null}
              </View>

              {/* Subtotal Split */}
              <View style={styles.bannerSplitRow}>
                <View style={styles.bannerSplitCol}>
                  <Text style={styles.bannerSplitLabel}>Stock & Purchases</Text>
                  <Text style={[styles.bannerSplitValue, { color: '#34D399' }]}>₹{purchaseTotal.toFixed(2)}</Text>
                </View>
                <View style={styles.bannerSplitDivider} />
                <View style={styles.bannerSplitCol}>
                  <Text style={styles.bannerSplitLabel}>Operating Spend</Text>
                  <Text style={[styles.bannerSplitValue, { color: '#60A5FA' }]}>₹{operatingTotal.toFixed(2)}</Text>
                </View>
              </View>
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

            {/* Category Breakdown Progress */}
            {categoryBreakdown.length > 0 ? (
              <>
                <Text style={styles.sectionHeader}>{t('categoryBreakdown', 'CATEGORY BREAKDOWN')}</Text>
                <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.borderColor, marginBottom: 16, flexDirection: 'column', alignItems: 'stretch' }]}>
                  {categoryBreakdown.map((row) => (
                    <View key={row.def.label} style={styles.breakdownRow}>
                      <View style={[styles.breakdownIconBox, { backgroundColor: `${row.def.color}1F` }]}>
                        <row.def.icon size={14} color={row.def.color} />
                      </View>
                      <View style={{ flex: 1, marginLeft: 10 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Text style={[styles.breakdownLabel, { color: theme.textPrimary }]}>{row.def.label}</Text>
                            {row.def.isPurchase && (
                              <View style={styles.purchaseMiniBadge}>
                                <Text style={styles.purchaseMiniBadgeText}>Purchase</Text>
                              </View>
                            )}
                          </View>
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
                <Text style={[styles.catChipText, { color: !selectedCategory ? '#FFFFFF' : theme.textSecondary }]}>
                  All
                </Text>
              </TouchableOpacity>
              {EXPENSE_CATEGORIES.filter((c) => {
                if (typeFilter === 'purchases') return c.isPurchase;
                if (typeFilter === 'expenses') return !c.isPurchase;
                return true;
              }).map((cat) => {
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
                    <Text style={[styles.catChipText, { color: selected ? cat.color : theme.textSecondary, marginLeft: 5 }]}>
                      {cat.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Search Input */}
            <View style={[styles.searchBox, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
              <Search size={16} color={theme.textSecondary} />
              <TextInput
                style={[styles.searchInput, { color: theme.textPrimary }]}
                placeholder="Search vendor, bill #, category or notes..."
                placeholderTextColor="#94A3B8"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <X size={16} color={theme.textSecondary} />
                </TouchableOpacity>
              )}
            </View>

            {/* Transactions Header */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <Text style={styles.sectionHeader}>TRANSACTIONS ({filteredExpenses.length})</Text>
              {selectedCategory && (
                <TouchableOpacity onPress={() => setSelectedCategory(null)}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: BRAND_COLORS.blue600 }}>Reset Filter</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* List or States */}
            {isLoading ? (
              <ScreenLoadingState
                message={t('loadingExpenses', 'Loading records...')}
                hint="Fetching cash outflows, purchases and expense records"
                skeleton={<ExpensesListSkeleton count={5} />}
              />
            ) : isError ? (
              <ScreenErrorState
                message="Could not load records"
                hint="Check your connection and try again"
                onRetry={refetch}
                isRetrying={isRefetching}
              />
            ) : filteredExpenses.length === 0 ? (
              <View style={[styles.emptyCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
                <Receipt size={32} color={theme.textSecondary} />
                <Text style={[styles.emptyTitle, { color: theme.textPrimary }]}>No outflows found</Text>
                <Text style={[styles.emptySub, { color: theme.textSecondary }]}>
                  {searchQuery || selectedCategory
                    ? 'No records match your active search or category filter.'
                    : 'Tap "+ Purchase" or "+ Expense" to record your first outflow.'}
                </Text>
              </View>
            ) : (
              filteredExpenses
                .sort((a, b) => resolveExpenseDate(b).getTime() - resolveExpenseDate(a).getTime())
                .map((item) => {
                  const def = getCategoryDef(item.category);
                  const meta = parseExpenseMeta(item.description || item.notes);
                  const hasReceipt = !!(item.receiptImageURL || item.receiptImageUrl);

                  return (
                    <View
                      key={item.id}
                      style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}
                    >
                      <View style={[styles.breakdownIconBox, { backgroundColor: `${def.color}1F` }]}>
                        <def.icon size={16} color={def.color} />
                      </View>

                      <View style={{ flex: 1, marginLeft: 10, marginRight: 8 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
                          <Text style={[styles.expCategory, { color: theme.textPrimary }]}>{item.category}</Text>
                          {def.isPurchase && (
                            <View style={styles.purchaseMiniBadge}>
                              <Text style={styles.purchaseMiniBadgeText}>Purchase</Text>
                            </View>
                          )}
                        </View>

                        {/* Date and Payment Mode */}
                        <Text style={[styles.expDate, { color: theme.textSecondary }]}>
                          {resolveExpenseDate(item).toLocaleDateString()} · {(item.paymentMethod || 'cash').toUpperCase()}
                        </Text>

                        {/* Vendor and Bill Number Tags */}
                        {(meta.vendor || meta.invoiceNo) && (
                          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                            {meta.vendor && (
                              <View style={styles.vendorChip}>
                                <Building2 size={10} color="#4F46E5" />
                                <Text style={styles.vendorChipText}>{meta.vendor}</Text>
                              </View>
                            )}
                            {meta.invoiceNo && (
                              <View style={styles.invoiceChip}>
                                <Receipt size={10} color="#059669" />
                                <Text style={styles.invoiceChipText}>#{meta.invoiceNo}</Text>
                              </View>
                            )}
                          </View>
                        )}

                        {meta.userNotes ? (
                          <Text style={[styles.expNotes, { color: theme.textSecondary }]} numberOfLines={2}>
                            {meta.userNotes}
                          </Text>
                        ) : null}

                        {/* Receipt Thumbnail if attached */}
                        {hasReceipt && (
                          <TouchableOpacity
                            onPress={() => setPreviewImage(item.receiptImageURL || item.receiptImageUrl || null)}
                            style={styles.receiptThumbRow}
                          >
                            <ImageIcon size={12} color={BRAND_COLORS.blue600} />
                            <Text style={styles.receiptThumbText}>View Receipt Photo</Text>
                          </TouchableOpacity>
                        )}
                      </View>

                      {/* Right Amount & Actions */}
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={styles.expAmount}>-₹{item.amount.toFixed(2)}</Text>
                        <View style={{ flexDirection: 'row', marginTop: 8 }}>
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

        {/* Add / Edit Outflow Modal */}
        <Modal visible={showModal} animationType="slide">
          <KeyboardAvoidingWrapper inModal>
            <SafeAreaView style={[styles.modalSafeArea, { backgroundColor: theme.bg }]}>
              <ScrollView style={{ flex: 1, padding: 16 }} showsVerticalScrollIndicator={false}>
                {/* Sheet Header */}
                <View style={styles.sheetHeader}>
                  <Text style={[styles.sheetTitle, { color: theme.textPrimary }]}>
                    {editingExpense
                      ? 'Edit Outflow Record'
                      : modalMode === 'purchase'
                      ? 'Record Stock Purchase'
                      : 'Record General Expense'}
                  </Text>
                  <TouchableOpacity onPress={() => setShowModal(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <X size={24} color={theme.textSecondary} />
                  </TouchableOpacity>
                </View>

                {/* Modal Mode Selector (Expense vs Purchase) */}
                {!editingExpense && (
                  <View style={[styles.modalTypeBar, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
                    <TouchableOpacity
                      onPress={() => {
                        setModalMode('expense');
                        const cat = EXPENSE_CATEGORIES.find((c) => !c.isPurchase);
                        if (cat) setCategory(cat.label);
                      }}
                      style={[styles.modalTypeBtn, modalMode === 'expense' && styles.modalTypeBtnActive]}
                    >
                      <Text style={[styles.modalTypeBtnText, { color: modalMode === 'expense' ? '#FFFFFF' : theme.textSecondary }]}>
                        General Expense
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => {
                        setModalMode('purchase');
                        const cat = EXPENSE_CATEGORIES.find((c) => c.isPurchase);
                        if (cat) setCategory(cat.label);
                      }}
                      style={[styles.modalTypeBtn, modalMode === 'purchase' && { backgroundColor: '#059669' }]}
                    >
                      <Text style={[styles.modalTypeBtnText, { color: modalMode === 'purchase' ? '#FFFFFF' : theme.textSecondary }]}>
                        Stock / Purchase
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Amount (₹) */}
                <Text style={[styles.label, { color: theme.textPrimary }]}>Amount (₹) *</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.cardBg, borderColor: theme.borderColor, color: theme.textPrimary }]}
                  value={amount}
                  onChangeText={setAmount}
                  keyboardType="numeric"
                  placeholder="500.00"
                  placeholderTextColor="#94A3B8"
                />

                {/* Quick Amount Adders */}
                <View style={{ flexDirection: 'row', gap: 6, marginBottom: 14 }}>
                  {QUICK_AMOUNTS.map((q) => (
                    <TouchableOpacity
                      key={q}
                      onPress={() => {
                        const cur = parseFloat(amount) || 0;
                        setAmount(String(cur + q));
                      }}
                      style={[styles.quickAmtBtn, { borderColor: theme.borderColor, backgroundColor: theme.cardBg }]}
                    >
                      <Text style={[styles.quickAmtText, { color: theme.textPrimary }]}>+₹{q}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Category Picker */}
                <Text style={[styles.label, { color: theme.textPrimary }]}>Category</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
                  {EXPENSE_CATEGORIES.filter((c) => (modalMode === 'purchase' ? c.isPurchase : !c.isPurchase)).map((cat) => {
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
                        <Text style={[styles.catChipText, { color: selected ? '#FFFFFF' : theme.textSecondary, marginLeft: 5 }]}>
                          {cat.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                {/* Supplier / Vendor Name (Featured in Purchases) */}
                <Text style={[styles.label, { color: theme.textPrimary }]}>
                  {modalMode === 'purchase' ? 'Supplier / Vendor Name' : 'Paid To / Vendor (Optional)'}
                </Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.cardBg, borderColor: theme.borderColor, color: theme.textPrimary }]}
                  value={vendorName}
                  onChangeText={setVendorName}
                  placeholder={modalMode === 'purchase' ? 'e.g. Metro Cash & Carry, Local Mill' : 'e.g. Landlord, State Electricity Board'}
                  placeholderTextColor="#94A3B8"
                />

                {/* Registered Suppliers Quick-Pills */}
                {suppliers.length > 0 && (
                  <View style={{ marginBottom: 14 }}>
                    <Text style={{ fontSize: 10, fontWeight: '700', color: theme.textSecondary, marginBottom: 6 }}>
                      QUICK SELECT REGISTERED SUPPLIER:
                    </Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      {suppliers.map((s) => (
                        <TouchableOpacity
                          key={s.id}
                          onPress={() => setVendorName(s.name)}
                          style={[
                            styles.supplierPill,
                            {
                              backgroundColor: vendorName === s.name ? `${BRAND_COLORS.blue600}20` : theme.cardBg,
                              borderColor: vendorName === s.name ? BRAND_COLORS.blue600 : theme.borderColor,
                            },
                          ]}
                        >
                          <Building2 size={10} color={vendorName === s.name ? BRAND_COLORS.blue600 : theme.textSecondary} />
                          <Text style={[styles.supplierPillText, { color: vendorName === s.name ? BRAND_COLORS.blue600 : theme.textPrimary }]}>
                            {s.name}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}

                {/* Bill / Invoice Number */}
                <Text style={[styles.label, { color: theme.textPrimary }]}>
                  {modalMode === 'purchase' ? 'Bill / Invoice Number (Optional)' : 'Reference / Receipt Number (Optional)'}
                </Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.cardBg, borderColor: theme.borderColor, color: theme.textPrimary }]}
                  value={invoiceNumber}
                  onChangeText={setInvoiceNumber}
                  placeholder="e.g. INV-2026-089"
                  placeholderTextColor="#94A3B8"
                />

                {/* Payment Method */}
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
                          {
                            backgroundColor: selected ? BRAND_COLORS.blue600 : theme.cardBg,
                            borderColor: selected ? BRAND_COLORS.blue600 : theme.borderColor,
                          },
                        ]}
                      >
                        <m.icon size={14} color={selected ? '#FFFFFF' : theme.textSecondary} />
                        <Text style={[styles.paymentMethodText, { color: selected ? '#FFFFFF' : theme.textSecondary }]}>
                          {m.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Notes / Item Details */}
                <Text style={[styles.label, { color: theme.textPrimary }]}>
                  {modalMode === 'purchase' ? 'Items Purchased & Description' : 'Notes & Description'}
                </Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.cardBg, borderColor: theme.borderColor, color: theme.textPrimary, minHeight: 64 }]}
                  value={notes}
                  onChangeText={setNotes}
                  multiline
                  placeholder={modalMode === 'purchase' ? 'e.g. 5 bags Basmati rice, 2 cartons mustard oil' : 'e.g. Monthly internet broadband bill'}
                  placeholderTextColor="#94A3B8"
                />

                {/* Receipt Image Capture */}
                <Text style={[styles.label, { color: theme.textPrimary }]}>Bill / Receipt Photo</Text>
                {receiptImage ? (
                  <View style={{ marginBottom: 16 }}>
                    <Image source={{ uri: receiptImage }} style={styles.previewImageThumb} />
                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                      <TouchableOpacity onPress={handlePickCamera} style={[styles.subImageBtn, { borderColor: theme.borderColor }]}>
                        <Camera size={14} color={BRAND_COLORS.blue600} />
                        <Text style={[styles.subImageBtnText, { color: BRAND_COLORS.blue600 }]}>Retake Photo</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => setReceiptImage(null)} style={[styles.subImageBtn, { borderColor: '#EF4444' }]}>
                        <Trash2 size={14} color="#EF4444" />
                        <Text style={[styles.subImageBtnText, { color: '#EF4444' }]}>Remove</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
                    <TouchableOpacity onPress={handlePickCamera} style={[styles.cameraHalfBox, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
                      <Camera size={22} color={BRAND_COLORS.blue600} />
                      <Text style={[styles.cameraBoxText, { color: BRAND_COLORS.blue600 }]}>Camera</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={handlePickGallery} style={[styles.cameraHalfBox, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
                      <ImageIcon size={22} color={BRAND_COLORS.blue600} />
                      <Text style={[styles.cameraBoxText, { color: BRAND_COLORS.blue600 }]}>Gallery</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Submit Button */}
                <TouchableOpacity
                  onPress={handleSaveExpense}
                  disabled={submitting}
                  style={[styles.submitBtn, modalMode === 'purchase' && { backgroundColor: '#059669' }]}
                >
                  {submitting && <ActivityIndicator color="#FFF" style={{ marginRight: 8 }} />}
                  <Text style={styles.submitBtnText}>
                    {editingExpense
                      ? 'Save Changes'
                      : modalMode === 'purchase'
                      ? 'Record Purchase'
                      : 'Record Expense'}
                  </Text>
                </TouchableOpacity>
              </ScrollView>
            </SafeAreaView>
          </KeyboardAvoidingWrapper>
        </Modal>

        {/* Fullscreen Receipt Viewer Modal */}
        <Modal visible={!!previewImage} transparent animationType="fade">
          <View style={styles.fullPreviewOverlay}>
            <View style={styles.fullPreviewHeader}>
              <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 16 }}>Receipt Preview</Text>
              <TouchableOpacity onPress={() => setPreviewImage(null)} style={styles.fullPreviewClose}>
                <X size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
            {previewImage && (
              <Image source={{ uri: previewImage }} style={styles.fullPreviewImg} resizeMode="contain" />
            )}
          </View>
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
  addBtn: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10, flexDirection: 'row', alignItems: 'center' },
  addBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 11.5, marginLeft: 4 },
  title: { fontSize: 22, fontWeight: '900' },
  subtitle: { fontSize: 11.5, marginTop: 2, marginBottom: 12 },
  typeTabBar: { flexDirection: 'row', padding: 4, borderRadius: 14, borderWidth: 1, marginBottom: 10 },
  typeTab: { flex: 1, paddingVertical: 7, alignItems: 'center', borderRadius: 10 },
  typeTabActive: { backgroundColor: BRAND_COLORS.navyInk },
  typeTabText: { fontSize: 11, fontWeight: '800' },
  periodRow: { flexDirection: 'row', padding: 4, borderRadius: 14, borderWidth: 1, marginBottom: 14 },
  periodChip: { flex: 1, paddingVertical: 7, alignItems: 'center', borderRadius: 10 },
  periodChipText: { fontSize: 10.5, fontWeight: '800' },
  totalBanner: { borderRadius: 18, padding: 16, marginBottom: 16 },
  totalBannerLabel: { fontSize: 10, color: '#94A3B8', textTransform: 'uppercase', fontWeight: '700' },
  totalBannerValue: { fontSize: 26, fontWeight: '900', color: '#FFFFFF', marginTop: 2 },
  deltaBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  deltaText: { fontSize: 11, fontWeight: '700', marginLeft: 4 },
  bannerSplitRow: { flexDirection: 'row', marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.15)' },
  bannerSplitCol: { flex: 1 },
  bannerSplitLabel: { fontSize: 9.5, color: '#94A3B8', fontWeight: '700', textTransform: 'uppercase' },
  bannerSplitValue: { fontSize: 15, fontWeight: '900', marginTop: 2 },
  bannerSplitDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.15)', marginHorizontal: 12 },
  sectionHeader: { fontSize: 10, fontWeight: '800', color: '#94A3B8', letterSpacing: 0.5, marginBottom: 8 },
  paymentSplitRow: { flexDirection: 'row', marginBottom: 16 },
  paymentTile: { flex: 1, alignItems: 'center', borderRadius: 14, borderWidth: 1, paddingVertical: 10, marginRight: 8 },
  paymentTileValue: { fontSize: 13.5, fontWeight: '900', marginTop: 4 },
  paymentTileLabel: { fontSize: 10, fontWeight: '700', marginTop: 1 },
  card: { borderRadius: 16, padding: 12, borderWidth: 1, marginBottom: 10, flexDirection: 'row', alignItems: 'center' },
  breakdownRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  breakdownIconBox: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  breakdownLabel: { fontSize: 12, fontWeight: '700' },
  breakdownAmount: { fontSize: 12, fontWeight: '800' },
  purchaseMiniBadge: { backgroundColor: '#ECFDF5', borderWidth: 1, borderColor: '#A7F3D0', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 6, marginLeft: 6 },
  purchaseMiniBadgeText: { fontSize: 9, fontWeight: '800', color: '#059669' },
  progressBarBg: { height: 4, backgroundColor: '#E2E8F0', borderRadius: 2, marginTop: 4, overflow: 'hidden' },
  progressBarFill: { height: '100%', borderRadius: 2 },
  catChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, borderWidth: 1, marginRight: 6 },
  catChipText: { fontSize: 11, fontWeight: '700' },
  searchBox: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 7, marginBottom: 12 },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 13 },
  emptyCard: { borderRadius: 16, padding: 24, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginVertical: 20 },
  emptyTitle: { fontSize: 15, fontWeight: '800', marginTop: 8 },
  emptySub: { fontSize: 12, textAlign: 'center', marginTop: 4, paddingHorizontal: 20 },
  expCategory: { fontSize: 13.5, fontWeight: '800' },
  expDate: { fontSize: 10.5, marginTop: 2 },
  expNotes: { fontSize: 11, marginTop: 4 },
  vendorChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#EEF2FF', borderWidth: 1, borderColor: '#C7D2FE', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, gap: 3 },
  vendorChipText: { fontSize: 9.5, fontWeight: '700', color: '#4338CA' },
  invoiceChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ECFDF5', borderWidth: 1, borderColor: '#A7F3D0', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, gap: 3 },
  invoiceChipText: { fontSize: 9.5, fontWeight: '700', color: '#065F46' },
  receiptThumbRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  receiptThumbText: { fontSize: 10.5, fontWeight: '700', color: BRAND_COLORS.blue600 },
  expAmount: { fontSize: 15, fontWeight: '900', color: '#EF4444' },
  iconBtn: { padding: 6, borderRadius: 8, backgroundColor: 'rgba(100, 116, 139, 0.12)' },
  deleteBtn: { padding: 6, borderRadius: 8, backgroundColor: 'rgba(239, 68, 68, 0.12)' },
  modalSafeArea: { flex: 1 },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  sheetTitle: { fontSize: 18, fontWeight: '900' },
  modalTypeBar: { flexDirection: 'row', padding: 4, borderRadius: 12, borderWidth: 1, marginBottom: 14 },
  modalTypeBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 },
  modalTypeBtnActive: { backgroundColor: BRAND_COLORS.navyInk },
  modalTypeBtnText: { fontSize: 12, fontWeight: '800' },
  label: { fontSize: 11.5, fontWeight: '700', marginBottom: 5 },
  input: { borderWidth: 1, borderRadius: 10, padding: 10, fontSize: 13.5, marginBottom: 12 },
  quickAmtBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
  quickAmtText: { fontSize: 11, fontWeight: '800' },
  supplierPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8, borderWidth: 1, marginRight: 6 },
  supplierPillText: { fontSize: 10.5, fontWeight: '700' },
  paymentMethodChip: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 9, borderRadius: 10, borderWidth: 1, marginRight: 8 },
  paymentMethodText: { fontSize: 11.5, fontWeight: '700', marginLeft: 5 },
  previewImageThumb: { width: '100%', height: 130, borderRadius: 10 },
  subImageBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 7, borderRadius: 8, borderWidth: 1 },
  subImageBtnText: { fontSize: 11, fontWeight: '700' },
  cameraHalfBox: { flex: 1, height: 70, borderRadius: 10, borderWidth: 1, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  cameraBoxText: { fontSize: 11, fontWeight: '700', marginTop: 4 },
  submitBtn: { backgroundColor: BRAND_COLORS.navyInk, borderRadius: 12, paddingVertical: 13, alignItems: 'center', justifyContent: 'center', marginTop: 6, marginBottom: 20, flexDirection: 'row' },
  submitBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 14 },
  fullPreviewOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  fullPreviewHeader: { position: 'absolute', top: 40, left: 16, right: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', zIndex: 10 },
  fullPreviewClose: { padding: 8, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)' },
  fullPreviewImg: { width: '100%', height: '80%' },
});
