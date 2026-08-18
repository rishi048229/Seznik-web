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
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useSuppliers } from '@/hooks/useSuppliers';
import { Supplier } from '@/types/supplier';
import { BRAND_COLORS } from '@/constants/theme';
import { useAppTheme } from '@/hooks/useAppTheme';
import { ScreenBackground } from '@/components/ui/ScreenBackground';
import { KeyboardAvoidingWrapper } from '@/components/ui/KeyboardAvoidingWrapper';
import { useLanguageStore } from '@/store/useLanguageStore';

export default function SuppliersScreen() {
  const router = useRouter();
  const { t } = useLanguageStore();
  const { suppliers, isLoading, createSupplier, updateSupplier, deleteSupplier } = useSuppliers();

  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [gstin, setGstin] = useState('');
  const [address, setAddress] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const topPadding = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0, 12);

  const filteredSuppliers = suppliers.filter(
    (s) =>
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.gstin && s.gstin.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (s.phone && s.phone.includes(searchQuery))
  );

  const summary = useMemo(() => {
    return {
      total: suppliers.length,
      gstRegistered: suppliers.filter((s) => !!s.gstin).length,
      totalPurchaseValue: suppliers.reduce((sum, s) => sum + s.totalPurchaseValue, 0),
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
    setName(s.name);
    setPhone(s.phone || '');
    setEmail(s.email || '');
    setGstin(s.gstin || '');
    setAddress(s.address || '');
    setShowModal(true);
  };

  const handleSaveSupplier = async () => {
    if (!name.trim()) {
      Alert.alert('Validation Error', 'Supplier Name is required');
      return;
    }

    try {
      setSubmitting(true);
      const supplierPayload: Partial<Supplier> = {
        name: name.trim(),
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        gstin: gstin.trim() || undefined,
        address: address.trim() || undefined,
      };

      if (editingSupplier) {
        await updateSupplier({ id: editingSupplier.id, payload: supplierPayload as any });
      } else {
        await createSupplier({
          name: name.trim(),
          phone: phone.trim() || '',
          email: email.trim() || undefined,
          gstin: gstin.trim() || undefined,
          address: address.trim() || undefined,
        });
      }
      setShowModal(false);
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to save supplier');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = (s: Supplier) => {
    Alert.alert('Delete Supplier', `Are you sure you want to remove "${s.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteSupplier(s.id);
          } catch (e: any) {
            Alert.alert('Error', e?.message || 'Failed to delete supplier');
          }
        },
      },
    ]);
  };

  const handleCall = (s: Supplier) => {
    if (!s.phone) return;
    Linking.openURL(`tel:${s.phone}`).catch(() => Alert.alert('Error', 'Unable to start a call.'));
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
              <Text style={styles.addBtnText}>{t('addSupplier', 'Add Supplier')}</Text>
            </TouchableOpacity>
          </View>

        <Text style={[styles.title, { color: theme.textPrimary }]}>{t('suppliersPageTitle', 'Suppliers Directory')}</Text>
        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
          Vendor contacts, GSTIN records & purchase history
        </Text>

        {/* Summary stats */}
        <View style={styles.summaryRow}>
          <View style={[styles.summaryTile, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
            <Users size={14} color={BRAND_COLORS.blue600} />
            <Text style={[styles.summaryValue, { color: theme.textPrimary }]}>{summary.total}</Text>
            <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Suppliers</Text>
          </View>
          <View style={[styles.summaryTile, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
            <Building size={14} color={BRAND_COLORS.blue600} />
            <Text style={[styles.summaryValue, { color: theme.textPrimary }]}>{summary.gstRegistered}</Text>
            <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>GST Registered</Text>
          </View>
          <View style={[styles.summaryTile, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
            <Wallet size={14} color={BRAND_COLORS.blue600} />
            <Text style={[styles.summaryValue, { color: theme.textPrimary, fontSize: 13 }]}>
              ₹{summary.totalPurchaseValue.toFixed(0)}
            </Text>
            <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Total Purchased</Text>
          </View>
        </View>

        <View style={[styles.searchBox, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
          <Search size={18} color={theme.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: theme.textPrimary }]}
            placeholder="Search vendor name, phone, or GSTIN..."
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {isLoading ? (
          <ActivityIndicator size="large" color={BRAND_COLORS.blue600} style={{ marginVertical: 40 }} />
        ) : filteredSuppliers.length === 0 ? (
          <View style={styles.emptyState}>
            <Building size={32} color={theme.textSecondary} />
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
              {suppliers.length === 0 ? 'No suppliers yet — add your first vendor.' : 'No suppliers match your search.'}
            </Text>
          </View>
        ) : (
          <FlatList
            data={filteredSuppliers}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingBottom: 40 }}
            renderItem={({ item }) => (
              <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
                <View style={styles.cardTopRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.supplierName, { color: theme.textPrimary }]}>{item.name}</Text>
                    {item.gstin ? (
                      <View style={styles.gstBadge}>
                        <Building size={12} color={BRAND_COLORS.blue600} />
                        <Text style={styles.gstBadgeText}>GSTIN: {item.gstin}</Text>
                      </View>
                    ) : null}
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <TouchableOpacity onPress={() => handleCall(item)} style={[styles.iconBtn, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
                      <PhoneCall size={15} color="#10B981" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleOpenEdit(item)} style={[styles.iconBtn, { marginLeft: 8 }]}>
                      <Edit3 size={15} color={theme.textSecondary} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleDelete(item)} style={[styles.iconBtn, { marginLeft: 8 }]}>
                      <Trash2 size={15} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.metaBlock}>
                  {item.phone ? (
                    <View style={styles.metaRow}>
                      <Phone size={11} color={theme.textSecondary} />
                      <Text style={[styles.metaText, { color: theme.textSecondary }]}>{item.phone}</Text>
                    </View>
                  ) : null}
                  {item.email ? (
                    <View style={styles.metaRow}>
                      <Mail size={11} color={theme.textSecondary} />
                      <Text style={[styles.metaText, { color: theme.textSecondary }]}>{item.email}</Text>
                    </View>
                  ) : null}
                  {item.address ? (
                    <View style={styles.metaRow}>
                      <MapPin size={11} color={theme.textSecondary} />
                      <Text style={[styles.metaText, { color: theme.textSecondary }]} numberOfLines={1}>{item.address}</Text>
                    </View>
                  ) : null}
                </View>

                <View style={[styles.statsStrip, { borderTopColor: theme.borderColor }]}>
                  <View style={styles.statChip}>
                    <Package size={11} color={BRAND_COLORS.blue600} />
                    <Text style={[styles.statChipText, { color: theme.textPrimary }]}>{item.productsSuppliedCount} products</Text>
                  </View>
                  <View style={styles.statChip}>
                    <Wallet size={11} color={BRAND_COLORS.blue600} />
                    <Text style={[styles.statChipText, { color: theme.textPrimary }]}>₹{item.totalPurchaseValue.toFixed(0)} total</Text>
                  </View>
                  <Text style={[styles.statChipText, { color: theme.textSecondary }]}>
                    {item.lastPurchaseAt ? `Last: ${new Date(item.lastPurchaseAt).toLocaleDateString()}` : 'No purchases yet'}
                  </Text>
                </View>
              </View>
            )}
          />
        )}
      </View>

      {/* Add / Edit Supplier Modal */}
      <Modal visible={showModal} animationType="slide">
        <KeyboardAvoidingWrapper inModal>
        <SafeAreaView style={[styles.modalSafeArea, { backgroundColor: theme.bg }]}>
          <ScrollView style={{ flex: 1, padding: 16 }}>
            <View style={styles.sheetHeader}>
              <Text style={[styles.sheetTitle, { color: theme.textPrimary }]}>
                {editingSupplier ? 'Edit Supplier' : 'Add New Supplier'}
              </Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <X size={24} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.label, { color: theme.textPrimary }]}>Supplier / Business Name *</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.cardBg, borderColor: theme.borderColor, color: theme.textPrimary }]}
              value={name}
              onChangeText={setName}
              placeholder="e.g. Metro Wholesale Pvt Ltd"
              placeholderTextColor="#94A3B8"
            />

            <Text style={[styles.label, { color: theme.textPrimary }]}>Phone Number *</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.cardBg, borderColor: theme.borderColor, color: theme.textPrimary }]}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              placeholder="9876543210"
              placeholderTextColor="#94A3B8"
            />

            <Text style={[styles.label, { color: theme.textPrimary }]}>Email Address</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.cardBg, borderColor: theme.borderColor, color: theme.textPrimary }]}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              placeholder="vendor@metro.com"
              placeholderTextColor="#94A3B8"
            />

            <Text style={[styles.label, { color: theme.textPrimary }]}>GSTIN Number</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.cardBg, borderColor: theme.borderColor, color: theme.textPrimary }]}
              value={gstin}
              onChangeText={setGstin}
              autoCapitalize="characters"
              placeholder="27AAAAA0000A1Z5"
              placeholderTextColor="#94A3B8"
            />

            <Text style={[styles.label, { color: theme.textPrimary }]}>Address</Text>
            <TextInput
              style={[styles.input, styles.multilineInput, { backgroundColor: theme.cardBg, borderColor: theme.borderColor, color: theme.textPrimary }]}
              value={address}
              onChangeText={setAddress}
              placeholder="Warehouse / office address"
              placeholderTextColor="#94A3B8"
              multiline
              numberOfLines={3}
            />

            {editingSupplier ? (
              <View style={[styles.editStatsBox, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
                <Text style={[styles.editStatsText, { color: theme.textSecondary }]}>
                  {editingSupplier.productsSuppliedCount} products supplied · ₹{editingSupplier.totalPurchaseValue.toFixed(0)} purchased across {editingSupplier.purchaseCount} order(s)
                </Text>
              </View>
            ) : null}

            <TouchableOpacity onPress={handleSaveSupplier} disabled={submitting} style={styles.submitBtn}>
              {submitting && <ActivityIndicator color="#FFF" style={{ marginRight: 8 }} />}
              <Text style={styles.submitBtnText}>Save Supplier</Text>
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
  summaryRow: { flexDirection: 'row', marginBottom: 14 },
  summaryTile: { flex: 1, padding: 12, borderRadius: 14, borderWidth: 1, marginRight: 8, alignItems: 'flex-start' },
  summaryValue: { fontSize: 17, fontWeight: '900', marginTop: 6 },
  summaryLabel: { fontSize: 9, fontWeight: '700', marginTop: 2 },
  searchBox: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 14 },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 14 },
  emptyState: { alignItems: 'center', paddingVertical: 50 },
  emptyText: { fontSize: 12, marginTop: 10, textAlign: 'center' },
  card: { borderRadius: 16, padding: 14, borderWidth: 1, marginBottom: 10 },
  cardTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  supplierName: { fontSize: 15, fontWeight: '800' },
  gstBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(37, 99, 235, 0.12)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, alignSelf: 'flex-start', marginTop: 4 },
  gstBadgeText: { fontSize: 10, fontWeight: '800', color: BRAND_COLORS.blue600, marginLeft: 4 },
  metaBlock: { marginTop: 10 },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  metaText: { fontSize: 11, marginLeft: 6, flex: 1 },
  iconBtn: { padding: 8, borderRadius: 10, backgroundColor: 'rgba(100, 116, 139, 0.12)' },
  statsStrip: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, paddingTop: 10, borderTopWidth: 1 },
  statChip: { flexDirection: 'row', alignItems: 'center' },
  statChipText: { fontSize: 10, fontWeight: '700', marginLeft: 4 },
  modalSafeArea: { flex: 1 },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sheetTitle: { fontSize: 20, fontWeight: '900' },
  label: { fontSize: 12, fontWeight: '700', marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: 12, padding: 12, fontSize: 14, marginBottom: 14 },
  multilineInput: { minHeight: 70, textAlignVertical: 'top' },
  editStatsBox: { borderRadius: 12, borderWidth: 1, padding: 12, marginBottom: 14 },
  editStatsText: { fontSize: 11, fontWeight: '600' },
  submitBtn: { backgroundColor: BRAND_COLORS.navyInk, borderRadius: 14, paddingVertical: 14, alignItems: 'center', justifyContent: 'center', marginTop: 10, flexDirection: 'row' },
  submitBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },
});
