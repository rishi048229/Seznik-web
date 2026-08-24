import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  Modal,
  ScrollView,
  ActivityIndicator,
  Alert,
  Linking,
  StyleSheet,
  StatusBar,
  Platform,
} from 'react-native';
import { useSafeAreaInsets, SafeAreaView } from 'react-native-safe-area-context';
import {
  Search,
  Plus,
  ArrowLeft,
  Phone,
  Mail,
  MapPin,
  Edit3,
  Trash2,
  X,
  Building,
  PhoneCall,
  Package,
  Wallet,
  Users,
  MessageCircle,
  CheckCircle2,
  FileText,
  Clock,
  Sparkles,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useSuppliers } from '@/hooks/useSuppliers';
import { Supplier } from '@/types/supplier';
import { BRAND_COLORS } from '@/constants/theme';
import { useAppTheme } from '@/hooks/useAppTheme';
import { ScreenBackground } from '@/components/ui/ScreenBackground';
import { KeyboardAvoidingWrapper } from '@/components/ui/KeyboardAvoidingWrapper';
import { ListScreenSkeleton } from '@/components/ui/ScreenSkeleton';
import { ScreenLoadingState, ScreenErrorState } from '@/components/ui/ScreenLoadingState';
import { RefreshControl } from 'react-native';
import { useTranslation } from '@/store/useLanguageStore';

export default function SuppliersScreen() {
  const router = useRouter();
  const { t, currentLanguage } = useTranslation();
  const {
    suppliers,
    isLoading,
    isRefetching,
    isError,
    refetch,
    createSupplier,
    updateSupplier,
    deleteSupplier,
  } = useSuppliers();

  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [isManualRefreshing, setIsManualRefreshing] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [gstin, setGstin] = useState('');
  const [address, setAddress] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const topPadding = Math.max(insets.top, Platform.OS === 'android' ? StatusBar.currentHeight || 0 : 0, 12);

  const handleRefresh = async () => {
    setIsManualRefreshing(true);
    try {
      await refetch();
    } finally {
      setIsManualRefreshing(false);
    }
  };

  const filteredSuppliers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return suppliers;
    return suppliers.filter(
      (s) =>
        s.name?.toLowerCase().includes(q) ||
        s.gstin?.toLowerCase().includes(q) ||
        s.phone?.toLowerCase().includes(q) ||
        s.email?.toLowerCase().includes(q)
    );
  }, [suppliers, searchQuery]);

  const summary = useMemo(() => {
    return {
      total: suppliers.length,
      gstRegistered: suppliers.filter((s) => Boolean(s.gstin && s.gstin.trim().length > 0)).length,
      totalPurchaseValue: suppliers.reduce((sum, s) => sum + (s.totalPurchaseValue || 0), 0),
    };
  }, [suppliers]);

  const handleOpenAdd = () => {
    setEditingSupplier(null);
    setName('');
    setPhone('');
    setEmail('');
    setGstin('');
    setAddress('');
    setShowModal(true);
  };

  const handleOpenEdit = (s: Supplier) => {
    setEditingSupplier(s);
    setName(s.name || '');
    setPhone(s.phone || '');
    setEmail(s.email || '');
    setGstin(s.gstin || '');
    setAddress(s.address || '');
    setShowModal(true);
  };

  const handleSaveSupplier = async () => {
    const cleanName = name.trim();
    if (!cleanName) {
      Alert.alert('Validation Required', 'Please enter a Supplier or Business name.');
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        name: cleanName,
        phone: phone.trim(),
        email: email.trim() || undefined,
        gstin: gstin.trim().toUpperCase() || undefined,
        address: address.trim() || undefined,
      };

      if (editingSupplier) {
        await updateSupplier({ id: editingSupplier.id, payload });
      } else {
        await createSupplier(payload);
      }
      setShowModal(false);
    } catch (err: any) {
      Alert.alert('Save Failed', err?.message || 'Unable to save supplier. Please check connection.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = (s: Supplier) => {
    Alert.alert(
      'Delete Supplier',
      `Are you sure you want to remove "${s.name}"? Linked product and purchase records will remain intact.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteSupplier(s.id);
            } catch (e: any) {
              Alert.alert('Delete Failed', e?.message || 'Could not delete supplier.');
            }
          },
        },
      ]
    );
  };

  const handleCall = (s: Supplier) => {
    if (!s.phone) {
      Alert.alert('No Phone Number', 'No phone number is registered for this supplier.');
      return;
    }
    Linking.openURL(`tel:${s.phone}`).catch(() => Alert.alert('Error', 'Unable to initiate call.'));
  };

  const handleWhatsApp = (s: Supplier) => {
    if (!s.phone) {
      Alert.alert('No Phone Number', 'No mobile number is registered for this supplier.');
      return;
    }
    const clean = s.phone.replace(/[^0-9]/g, '');
    const num = clean.length === 10 ? `91${clean}` : clean;
    Linking.openURL(`https://wa.me/${num}`).catch(() => Alert.alert('Error', 'Unable to open WhatsApp.'));
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(val || 0);
  };

  return (
    <ScreenBackground color={theme.bg}>
      <StatusBar
        barStyle={theme.isDark ? 'light-content' : 'dark-content'}
        backgroundColor={theme.bg}
      />
      <View style={[styles.container, { paddingTop: topPadding }]}>
        <View style={styles.mainWrapper}>
          {/* Header Bar */}
          <View style={styles.headerRow}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={[styles.backBtn, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <ArrowLeft size={18} color={theme.textPrimary} />
            </TouchableOpacity>

            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[styles.title, { color: theme.textPrimary }]}>
                {t('suppliersPageTitle', 'Suppliers Directory')}
              </Text>
              <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
                {suppliers.length} {t('registeredVendors', 'registered vendor partner(s)')}
              </Text>
            </View>

            <TouchableOpacity onPress={handleOpenAdd} style={styles.addBtn} activeOpacity={0.8}>
              <Plus size={16} color="#FFFFFF" style={{ marginRight: 4 }} />
              <Text style={styles.addBtnText}>{t('addSupplier', 'Add Supplier')}</Text>
            </TouchableOpacity>
          </View>

          {/* Quick Summary Cards */}
          <View style={styles.summaryRow}>
            <View style={[styles.summaryTile, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
              <View style={[styles.summaryIconBox, { backgroundColor: 'rgba(2, 132, 199, 0.12)' }]}>
                <Users size={16} color={BRAND_COLORS.sky500} />
              </View>
              <Text style={[styles.summaryValue, { color: theme.textPrimary }]}>{summary.total}</Text>
              <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>{t('suppliers', 'Suppliers')}</Text>
            </View>

            <View style={[styles.summaryTile, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
              <View style={[styles.summaryIconBox, { backgroundColor: 'rgba(16, 185, 129, 0.12)' }]}>
                <Building size={16} color="#10B981" />
              </View>
              <Text style={[styles.summaryValue, { color: theme.textPrimary }]}>{summary.gstRegistered}</Text>
              <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>{t('gstRegistered', 'GST Registered')}</Text>
            </View>

            <View style={[styles.summaryTile, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
              <View style={[styles.summaryIconBox, { backgroundColor: 'rgba(139, 92, 246, 0.12)' }]}>
                <Wallet size={16} color="#8B5CF6" />
              </View>
              <Text style={[styles.summaryValue, { color: theme.textPrimary, fontSize: 15 }]}>
                {formatCurrency(summary.totalPurchaseValue)}
              </Text>
              <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>{t('totalPurchased', 'Total Purchases')}</Text>
            </View>
          </View>

          {/* Search Box */}
          <View style={[styles.searchBox, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
            <Search size={18} color={theme.textSecondary} />
            <TextInput
              style={[styles.searchInput, { color: theme.textPrimary }]}
              placeholder={t('searchSuppliers', 'Search vendor name, phone, or GSTIN...')}
              placeholderTextColor="#94A3B8"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery ? (
              <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <X size={16} color={theme.textSecondary} />
              </TouchableOpacity>
            ) : null}
          </View>

          {/* List or State */}
          {isLoading ? (
            <ScreenLoadingState
              message={t('loadingSuppliers', 'Loading suppliers...')}
              hint={t('loadingSuppliersHint', 'Fetching vendor contacts and purchase partners')}
              skeleton={<ListScreenSkeleton hasSearch={false} hasStats={false} count={5} />}
            />
          ) : isError ? (
            <ScreenErrorState
              message={t('suppliersLoadFailed', "Couldn't load suppliers")}
              hint={t('suppliersLoadFailedHint', 'Check your connection to the server and try again.')}
              onRetry={refetch}
              isRetrying={isRefetching}
            />
          ) : filteredSuppliers.length === 0 ? (
            <View style={styles.emptyState}>
              <Building size={42} color={theme.textSecondary} />
              <Text style={[styles.emptyTitle, { color: theme.textPrimary }]}>
                {suppliers.length === 0 ? t('noSuppliersTitle', 'No Suppliers Yet') : t('noSuppliersSub', 'No Matching Suppliers')}
              </Text>
              <Text style={[styles.emptySub, { color: theme.textSecondary }]}>
                {suppliers.length === 0
                  ? 'Add your first wholesale supplier to track products & procurement.'
                  : 'Try searching with a different name, phone number, or GSTIN.'}
              </Text>
              {suppliers.length === 0 ? (
                <TouchableOpacity onPress={handleOpenAdd} style={styles.emptyAddBtn}>
                  <Plus size={16} color="#FFF" style={{ marginRight: 6 }} />
                  <Text style={styles.emptyAddBtnText}>Add First Supplier</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : (
            <FlatList
              data={filteredSuppliers}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ paddingBottom: 40 }}
              refreshControl={
                <RefreshControl
                  refreshing={isManualRefreshing}
                  onRefresh={handleRefresh}
                  tintColor={BRAND_COLORS.sky500}
                  colors={[BRAND_COLORS.sky500]}
                />
              }
              renderItem={({ item }) => {
                const initial = item.name ? item.name.charAt(0).toUpperCase() : 'S';
                return (
                  <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
                    {/* Top Row: Avatar + Name + Actions */}
                    <View style={styles.cardTopRow}>
                      <View style={[styles.avatarBox, { backgroundColor: 'rgba(2, 132, 199, 0.15)' }]}>
                        <Text style={styles.avatarText}>{initial}</Text>
                      </View>

                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={[styles.supplierName, { color: theme.textPrimary }]} numberOfLines={1}>
                          {item.name}
                        </Text>
                        {item.gstin ? (
                          <View style={styles.gstBadge}>
                            <Building size={11} color={BRAND_COLORS.sky500} />
                            <Text style={styles.gstBadgeText}>GST: {item.gstin}</Text>
                          </View>
                        ) : null}
                      </View>

                      {/* Action Icons */}
                      <View style={styles.cardActions}>
                        {item.phone ? (
                          <>
                            <TouchableOpacity
                              onPress={() => handleCall(item)}
                              style={[styles.iconBtn, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}
                              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            >
                              <PhoneCall size={14} color="#10B981" />
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={() => handleWhatsApp(item)}
                              style={[styles.iconBtn, { backgroundColor: 'rgba(37, 211, 102, 0.15)', marginLeft: 6 }]}
                              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            >
                              <MessageCircle size={14} color="#25D366" />
                            </TouchableOpacity>
                          </>
                        ) : null}
                        <TouchableOpacity
                          onPress={() => handleOpenEdit(item)}
                          style={[styles.iconBtn, { backgroundColor: 'rgba(100, 116, 139, 0.12)', marginLeft: 6 }]}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Edit3 size={14} color={theme.textSecondary} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => handleDelete(item)}
                          style={[styles.iconBtn, { backgroundColor: 'rgba(239, 68, 68, 0.12)', marginLeft: 6 }]}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Trash2 size={14} color="#EF4444" />
                        </TouchableOpacity>
                      </View>
                    </View>

                    {/* Contact Details */}
                    <View style={styles.metaBlock}>
                      {item.phone ? (
                        <View style={styles.metaRow}>
                          <Phone size={12} color={theme.textSecondary} />
                          <Text style={[styles.metaText, { color: theme.textSecondary }]}>{item.phone}</Text>
                        </View>
                      ) : null}
                      {item.email ? (
                        <View style={styles.metaRow}>
                          <Mail size={12} color={theme.textSecondary} />
                          <Text style={[styles.metaText, { color: theme.textSecondary }]}>{item.email}</Text>
                        </View>
                      ) : null}
                      {item.address ? (
                        <View style={styles.metaRow}>
                          <MapPin size={12} color={theme.textSecondary} />
                          <Text style={[styles.metaText, { color: theme.textSecondary }]} numberOfLines={1}>
                            {item.address}
                          </Text>
                        </View>
                      ) : null}
                    </View>

                    {/* Stats Footer Strip */}
                    <View style={[styles.statsStrip, { borderTopColor: theme.borderColor }]}>
                      <View style={styles.statChip}>
                        <Package size={12} color={BRAND_COLORS.sky500} />
                        <Text style={[styles.statChipText, { color: theme.textPrimary }]}>
                          {item.productsSuppliedCount || 0} {t('products', 'products')}
                        </Text>
                      </View>
                      <View style={styles.statChip}>
                        <Wallet size={12} color="#10B981" />
                        <Text style={[styles.statChipText, { color: theme.textPrimary }]}>
                          {formatCurrency(item.totalPurchaseValue || 0)} {t('purchased', 'purchased')}
                        </Text>
                      </View>
                      <View style={styles.statChip}>
                        <Clock size={12} color={theme.textSecondary} />
                        <Text style={[styles.statChipText, { color: theme.textSecondary }]}>
                          {item.lastPurchaseAt
                            ? `${new Date(item.lastPurchaseAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`
                            : 'No orders'}
                        </Text>
                      </View>
                    </View>
                  </View>
                );
              }}
            />
          )}
        </View>

        {/* Add / Edit Supplier Modal */}
        <Modal visible={showModal} animationType="slide" transparent>
          <KeyboardAvoidingWrapper inModal>
            <View style={styles.modalOverlay}>
              <View style={[styles.modalSheet, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
                {/* Modal Header */}
                <View style={[styles.modalHeader, { borderBottomColor: theme.borderColor }]}>
                  <View>
                    <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>
                      {editingSupplier ? t('editSupplier', 'Edit Supplier') : t('addNewSupplier', 'Add New Supplier')}
                    </Text>
                    <Text style={[styles.modalSubtitle, { color: theme.textSecondary }]}>
                      {editingSupplier ? 'Update vendor details & GST' : 'Create new supplier profile'}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => setShowModal(false)}
                    style={[styles.closeBtn, { backgroundColor: 'rgba(100, 116, 139, 0.12)' }]}
                  >
                    <X size={18} color={theme.textPrimary} />
                  </TouchableOpacity>
                </View>

                <ScrollView style={{ padding: 18 }} showsVerticalScrollIndicator={false}>
                  {/* Supplier Name */}
                  <Text style={[styles.inputLabel, { color: theme.textPrimary }]}>
                    {t('supplierName', 'Supplier / Business Name')} <Text style={{ color: '#EF4444' }}>*</Text>
                  </Text>
                  <View style={[styles.inputWrapper, { backgroundColor: theme.bg, borderColor: theme.borderColor }]}>
                    <Building size={16} color={theme.textSecondary} style={{ marginRight: 8 }} />
                    <TextInput
                      style={[styles.modalTextInput, { color: theme.textPrimary }]}
                      value={name}
                      onChangeText={setName}
                      placeholder="e.g. Metro Cash & Carry"
                      placeholderTextColor="#94A3B8"
                    />
                  </View>

                  {/* Phone Number */}
                  <Text style={[styles.inputLabel, { color: theme.textPrimary }]}>
                    {t('phone', 'Phone Number')}
                  </Text>
                  <View style={[styles.inputWrapper, { backgroundColor: theme.bg, borderColor: theme.borderColor }]}>
                    <Phone size={16} color={theme.textSecondary} style={{ marginRight: 8 }} />
                    <TextInput
                      style={[styles.modalTextInput, { color: theme.textPrimary }]}
                      value={phone}
                      onChangeText={setPhone}
                      keyboardType="phone-pad"
                      placeholder="9876543210"
                      placeholderTextColor="#94A3B8"
                    />
                  </View>

                  {/* Email */}
                  <Text style={[styles.inputLabel, { color: theme.textPrimary }]}>
                    {t('email', 'Email Address')}
                  </Text>
                  <View style={[styles.inputWrapper, { backgroundColor: theme.bg, borderColor: theme.borderColor }]}>
                    <Mail size={16} color={theme.textSecondary} style={{ marginRight: 8 }} />
                    <TextInput
                      style={[styles.modalTextInput, { color: theme.textPrimary }]}
                      value={email}
                      onChangeText={setEmail}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      placeholder="vendor@metro.com"
                      placeholderTextColor="#94A3B8"
                    />
                  </View>

                  {/* GSTIN */}
                  <Text style={[styles.inputLabel, { color: theme.textPrimary }]}>
                    {t('gstin', 'GSTIN Number (Optional)')}
                  </Text>
                  <View style={[styles.inputWrapper, { backgroundColor: theme.bg, borderColor: theme.borderColor }]}>
                    <FileText size={16} color={theme.textSecondary} style={{ marginRight: 8 }} />
                    <TextInput
                      style={[styles.modalTextInput, { color: theme.textPrimary }]}
                      value={gstin}
                      onChangeText={(v) => setGstin(v.toUpperCase())}
                      autoCapitalize="characters"
                      placeholder="27AAAAA0000A1Z5"
                      placeholderTextColor="#94A3B8"
                    />
                  </View>

                  {/* Address */}
                  <Text style={[styles.inputLabel, { color: theme.textPrimary }]}>
                    {t('address', 'Warehouse / Office Address')}
                  </Text>
                  <View style={[styles.inputWrapper, { backgroundColor: theme.bg, borderColor: theme.borderColor, alignItems: 'flex-start', paddingTop: 10 }]}>
                    <MapPin size={16} color={theme.textSecondary} style={{ marginRight: 8, marginTop: 2 }} />
                    <TextInput
                      style={[styles.modalTextInput, { color: theme.textPrimary, minHeight: 60, textAlignVertical: 'top' }]}
                      value={address}
                      onChangeText={setAddress}
                      placeholder="Street, City, Pin Code"
                      placeholderTextColor="#94A3B8"
                      multiline
                      numberOfLines={3}
                    />
                  </View>

                  {/* Submit Button */}
                  <TouchableOpacity
                    onPress={handleSaveSupplier}
                    disabled={submitting}
                    style={[styles.saveBtn, { opacity: submitting ? 0.7 : 1 }]}
                    activeOpacity={0.8}
                  >
                    {submitting ? (
                      <ActivityIndicator color="#FFF" style={{ marginRight: 8 }} />
                    ) : (
                      <CheckCircle2 size={18} color="#FFF" style={{ marginRight: 6 }} />
                    )}
                    <Text style={styles.saveBtnText}>
                      {submitting ? 'Saving...' : editingSupplier ? t('updateSupplier', 'Update Supplier') : t('saveSupplier', 'Save Supplier')}
                    </Text>
                  </TouchableOpacity>
                  <View style={{ height: 30 }} />
                </ScrollView>
              </View>
            </View>
          </KeyboardAvoidingWrapper>
        </Modal>
      </View>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  mainWrapper: { flex: 1, paddingHorizontal: 16, paddingTop: 4 },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  backBtn: { width: 38, height: 38, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 20, fontWeight: '900', letterSpacing: -0.3 },
  subtitle: { fontSize: 11, fontWeight: '600', marginTop: 1 },
  addBtn: {
    backgroundColor: BRAND_COLORS.navyInk,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: BRAND_COLORS.blue600,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 3,
  },
  addBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 12 },
  
  // Summary Row
  summaryRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  summaryTile: { flex: 1, padding: 12, borderRadius: 16, borderWidth: 1, alignItems: 'flex-start' },
  summaryIconBox: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  summaryValue: { fontSize: 18, fontWeight: '900' },
  summaryLabel: { fontSize: 10, fontWeight: '700', marginTop: 2 },
  
  // Search Box
  searchBox: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 14 },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 14, fontWeight: '500' },
  
  // Empty State
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, paddingHorizontal: 20 },
  emptyTitle: { fontSize: 17, fontWeight: '800', marginTop: 14 },
  emptySub: { fontSize: 12, textAlign: 'center', marginTop: 6, lineHeight: 18, maxWidth: 280 },
  emptyAddBtn: { backgroundColor: BRAND_COLORS.navyInk, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, marginTop: 18 },
  emptyAddBtnText: { color: '#FFF', fontWeight: '800', fontSize: 13 },
  
  // Supplier Card
  card: { borderRadius: 18, padding: 14, borderWidth: 1, marginBottom: 12 },
  cardTopRow: { flexDirection: 'row', alignItems: 'center' },
  avatarBox: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 17, fontWeight: '900', color: BRAND_COLORS.sky500 },
  supplierName: { fontSize: 15, fontWeight: '800' },
  gstBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(2, 132, 199, 0.1)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, alignSelf: 'flex-start', marginTop: 3 },
  gstBadgeText: { fontSize: 10, fontWeight: '800', color: BRAND_COLORS.sky500, marginLeft: 3 },
  cardActions: { flexDirection: 'row', alignItems: 'center' },
  iconBtn: { width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  
  metaBlock: { marginTop: 10, gap: 4 },
  metaRow: { flexDirection: 'row', alignItems: 'center' },
  metaText: { fontSize: 11, marginLeft: 6, fontWeight: '500' },
  
  statsStrip: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, paddingTop: 10, borderTopWidth: 1 },
  statChip: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statChipText: { fontSize: 11, fontWeight: '700' },
  
  // Modal Sheet
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, maxHeight: '88%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 16, borderBottomWidth: 1 },
  modalTitle: { fontSize: 18, fontWeight: '900' },
  modalSubtitle: { fontSize: 11, fontWeight: '500', marginTop: 2 },
  closeBtn: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  
  inputLabel: { fontSize: 11, fontWeight: '800', marginBottom: 6, marginTop: 12, textTransform: 'uppercase', letterSpacing: 0.3 },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 4 },
  modalTextInput: { flex: 1, fontSize: 14, fontWeight: '500', paddingVertical: 8 },
  saveBtn: { backgroundColor: BRAND_COLORS.navyInk, borderRadius: 14, paddingVertical: 14, alignItems: 'center', justifyContent: 'center', marginTop: 22, flexDirection: 'row' },
  saveBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },
});
