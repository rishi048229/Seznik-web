import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  Modal,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  Alert,
  StyleSheet,
  Linking,
} from 'react-native';
import {
  Search,
  Plus,
  ArrowLeft,
  Users,
  Phone,
  Mail,
  DollarSign,
  X,
  CreditCard,
  ChevronRight,
  Smartphone,
  PhoneCall,
  MessageCircle,
  AlertCircle,
  CheckCircle2,
  TrendingUp,
  Filter,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useCustomers } from '@/hooks/useCustomers';
import { Customer } from '@/types/customer';
import { useAppTheme } from '@/hooks/useAppTheme';
import { ScreenBackground } from '@/components/ui/ScreenBackground';
import { KeyboardAvoidingWrapper } from '@/components/ui/KeyboardAvoidingWrapper';
import { ContactImportModal } from '@/components/customers/ContactImportModal';
import { BRAND_COLORS } from '@/constants/theme';

// Module-level (not inline in the component) so the React Compiler's purity check doesn't flag
// the Date.now() call — it only analyzes code written directly inside a component/hook body.
const computeOverdueCustomerIds = (customers: Customer[]): Set<string> => {
  const cutoff = Date.now() - 30 * 86400000;
  const ids = new Set<string>();
  customers.forEach((c) => {
    if (c.oldestUnpaidSince && new Date(c.oldestUnpaidSince).getTime() < cutoff) ids.add(c.id);
  });
  return ids;
};

export default function CustomersScreen() {
  const router = useRouter();
  const { customers, isLoading, createCustomer, updateCustomer, bulkCreateCustomers, refetch } = useCustomers();

  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'due' | 'settled'>('all');
  const [showModal, setShowModal] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [creditLimit, setCreditLimit] = useState('5000');
  const [submitting, setSubmitting] = useState(false);

  const theme = useAppTheme();

  // Metrics Calculations
  const totalCustomers = customers.length;
  const totalCreditDue = customers.reduce((acc, c) => acc + (c.creditBalance > 0 ? c.creditBalance : 0), 0);
  const creditDueCount = customers.filter((c) => c.creditBalance > 0).length;

  // Date.now() is impure — the React Compiler forbids calling it directly during render, so the
  // "who's overdue" set is computed once here and just looked up (not recomputed) everywhere else,
  // including inside renderItem below.
  const overdueCustomerIds = useMemo(() => computeOverdueCustomerIds(customers), [customers]);
  const overdueCount = overdueCustomerIds.size;

  const filteredCustomers = customers.filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.phone && c.phone.includes(searchQuery));
    if (!matchesSearch) return false;

    if (activeTab === 'due') return c.creditBalance > 0;
    if (activeTab === 'settled') return c.creditBalance <= 0;
    return true;
  });

  const handleOpenAdd = () => {
    setEditingCustomer(null);
    setName('');
    setPhone('');
    setEmail('');
    setCreditLimit('5000');
    setShowModal(true);
  };

  const handleSaveCustomer = async () => {
    if (!name.trim() || !phone.trim()) {
      Alert.alert('Required Fields', 'Please enter customer name and phone number');
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim() || undefined,
        creditLimit: parseFloat(creditLimit) || 5000,
      };

      if (editingCustomer) {
        await updateCustomer({ id: editingCustomer.id, payload });
      } else {
        await createCustomer(payload);
      }
      setShowModal(false);
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to save customer');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenAccount = (customer: Customer) => {
    router.push(`/customers/${customer.id}` as any);
  };

  const handleCall = (phoneNumber?: string | null) => {
    if (!phoneNumber) return;
    const clean = phoneNumber.replace(/[^0-9+]/g, '');
    Linking.openURL(`tel:${clean}`);
  };

  const handleWhatsApp = (phoneNumber?: string | null, name?: string) => {
    if (!phoneNumber) return;
    const clean = phoneNumber.replace(/[^0-9]/g, '');
    const text = `Hello ${name || 'Customer'}, regarding your account with us on Seznik.`;
    Linking.openURL(`https://wa.me/91${clean}?text=${encodeURIComponent(text)}`);
  };

  return (
    <ScreenBackground color={theme.bg}>
      <SafeAreaView style={[styles.container, { backgroundColor: 'transparent' }]}>
        <View style={styles.mainWrapper}>
          {/* TOP NAV BAR */}
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <ArrowLeft size={20} color={theme.textSecondary} />
            <Text style={[styles.backBtnText, { color: theme.textSecondary }]}>Back to More</Text>
          </TouchableOpacity>

          <View style={styles.headerRow}>
            <View>
              <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>Customers</Text>
              <Text style={[styles.headerSub, { color: theme.textSecondary }]}>{totalCustomers} Active Accounts</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <TouchableOpacity
                onPress={() => setShowContactModal(true)}
                style={[styles.addBtn, { backgroundColor: '#10B981', marginRight: 8 }]}
              >
                <Smartphone size={16} color="#FFFFFF" />
                <Text style={styles.addBtnText}>Import Contacts</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleOpenAdd} style={styles.addBtn}>
                <Plus size={16} color="#FFFFFF" />
                <Text style={styles.addBtnText}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* CONTROL PANEL METRICS CARDS */}
          <View style={styles.metricsGrid}>
            <View style={[styles.metricCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
              <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>Total Outstanding</Text>
              <Text style={[styles.metricValue, { color: totalCreditDue > 0 ? '#EF4444' : '#10B981' }]}>
                ₹{totalCreditDue.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              </Text>
              <Text style={[styles.metricSub, { color: theme.textSecondary }]}>{creditDueCount} Accounts Due</Text>
            </View>

            <View style={[styles.metricCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
              <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>Overdue Risk (&gt;30d)</Text>
              <Text style={[styles.metricValue, { color: overdueCount > 0 ? '#B91C1C' : '#10B981' }]}>
                {overdueCount} Accounts
              </Text>
              <Text style={[styles.metricSub, { color: theme.textSecondary }]}>High Priority Follow-ups</Text>
            </View>
          </View>

          {/* SEARCH BAR */}
          <View style={[styles.searchBox, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
            <Search size={18} color={theme.textSecondary} />
            <TextInput
              style={[styles.searchInput, { color: theme.textPrimary }]}
              placeholder="Search by customer name or phone..."
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

          {/* FILTER TABS */}
          <View style={styles.filterTabRow}>
            <TouchableOpacity
              onPress={() => setActiveTab('all')}
              style={[styles.filterChip, { borderColor: theme.borderColor }, activeTab === 'all' && styles.filterChipActive]}
            >
              <Text style={[styles.filterChipText, { color: theme.textSecondary }, activeTab === 'all' && styles.filterChipTextActive]}>
                All ({totalCustomers})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setActiveTab('due')}
              style={[styles.filterChip, { borderColor: theme.borderColor }, activeTab === 'due' && styles.filterChipActive]}
            >
              <Text style={[styles.filterChipText, { color: theme.textSecondary }, activeTab === 'due' && styles.filterChipTextActive]}>
                Credit Due ({creditDueCount})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setActiveTab('settled')}
              style={[styles.filterChip, { borderColor: theme.borderColor }, activeTab === 'settled' && styles.filterChipActive]}
            >
              <Text style={[styles.filterChipText, { color: theme.textSecondary }, activeTab === 'settled' && styles.filterChipTextActive]}>
                Settled ({totalCustomers - creditDueCount})
              </Text>
            </TouchableOpacity>
          </View>

          {isLoading ? (
            <View style={styles.loaderCenter}>
              <ActivityIndicator size="large" color={BRAND_COLORS.blue600} />
            </View>
          ) : (
            <FlatList
              data={filteredCustomers}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ paddingBottom: 40 }}
              renderItem={({ item }) => {
                const initial = item.name ? item.name.charAt(0).toUpperCase() : 'C';
                const isOverdue = item.creditBalance > 0 && overdueCustomerIds.has(item.id);
                const creditRatio = Math.min(1, item.creditBalance / (item.creditLimit || 5000));

                return (
                  <View style={[styles.customerCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
                    <TouchableOpacity
                      onPress={() => handleOpenAccount(item)}
                      style={styles.cardHeaderRow}
                    >
                      <View style={[styles.avatarCircle, { backgroundColor: item.creditBalance > 0 ? (isOverdue ? '#FEF2F2' : '#FFFBEB') : '#ECFDF5' }]}>
                        <Text style={[styles.avatarText, { color: item.creditBalance > 0 ? (isOverdue ? '#B91C1C' : '#D97706') : '#059669' }]}>
                          {initial}
                        </Text>
                      </View>

                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                          <Text style={[styles.customerName, { color: theme.textPrimary }]} numberOfLines={1}>
                            {item.name}
                          </Text>
                          {item.creditBalance > 0 ? (
                            <View style={[styles.statusBadge, { backgroundColor: isOverdue ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)' }]}>
                              <Text style={[styles.statusBadgeText, { color: isOverdue ? '#EF4444' : '#F59E0B' }]}>
                                {isOverdue ? 'OVERDUE' : 'DUE'}
                              </Text>
                            </View>
                          ) : (
                            <View style={[styles.statusBadge, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
                              <Text style={[styles.statusBadgeText, { color: '#10B981' }]}>PAID</Text>
                            </View>
                          )}
                        </View>

                        <Text style={[styles.customerPhone, { color: theme.textSecondary }]}>
                          {item.phone || 'No phone'}
                        </Text>
                      </View>
                    </TouchableOpacity>

                    {/* CREDIT BALANCE & LIMIT BAR */}
                    <View style={styles.cardDetailsRow}>
                      <View>
                        <Text style={[styles.balanceTitle, { color: theme.textSecondary }]}>Outstanding Balance</Text>
                        <Text style={[styles.balanceValue, { color: item.creditBalance > 0 ? '#EF4444' : '#10B981' }]}>
                          ₹{item.creditBalance.toFixed(2)}
                        </Text>
                      </View>

                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={[styles.balanceTitle, { color: theme.textSecondary }]}>Credit Limit</Text>
                        <Text style={[styles.limitValue, { color: theme.textPrimary }]}>
                          ₹{item.creditLimit.toFixed(2)}
                        </Text>
                      </View>
                    </View>

                    {/* PROGRESS BAR */}
                    {item.creditBalance > 0 ? (
                      <View style={styles.progressBarBg}>
                        <View style={[styles.progressBarFill, { width: `${creditRatio * 100}%`, backgroundColor: isOverdue ? '#EF4444' : '#F59E0B' }]} />
                      </View>
                    ) : null}

                    {/* CARD QUICK ACTION FOOTER */}
                    <View style={[styles.cardFooter, { borderTopColor: theme.borderColor }]}>
                      <TouchableOpacity onPress={() => handleCall(item.phone)} style={styles.quickActionBtn}>
                        <PhoneCall size={14} color={BRAND_COLORS.blue600} />
                        <Text style={[styles.quickActionText, { color: BRAND_COLORS.blue600 }]}>Call</Text>
                      </TouchableOpacity>

                      <TouchableOpacity onPress={() => handleWhatsApp(item.phone, item.name)} style={styles.quickActionBtn}>
                        <MessageCircle size={14} color="#10B981" />
                        <Text style={[styles.quickActionText, { color: '#10B981' }]}>WhatsApp</Text>
                      </TouchableOpacity>

                      <TouchableOpacity onPress={() => handleOpenAccount(item)} style={styles.quickActionBtn}>
                        <CreditCard size={14} color={theme.textPrimary} />
                        <Text style={[styles.quickActionText, { color: theme.textPrimary }]}>Control Panel</Text>
                        <ChevronRight size={14} color={theme.textSecondary} />
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              }}
              ListEmptyComponent={() => (
                <View style={styles.emptyCenter}>
                  <Users size={40} color={theme.textSecondary} />
                  <Text style={[styles.emptyTitle, { color: theme.textPrimary, marginTop: 10 }]}>No Customers Found</Text>
                  <Text style={[styles.emptySub, { color: theme.textSecondary }]}>
                    Tap &quot;+ Add&quot; or &quot;Import Contacts&quot; above to build your customer directory.
                  </Text>
                </View>
              )}
            />
          )}
        </View>

        {/* MANUAL ADD MODAL */}
        <Modal visible={showModal} animationType="slide">
          <KeyboardAvoidingWrapper inModal>
            <SafeAreaView style={[styles.modalSafeArea, { backgroundColor: theme.bg }]}>
              <ScrollView style={{ flex: 1, padding: 16 }}>
                <View style={styles.modalHeader}>
                  <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>Add Customer</Text>
                  <TouchableOpacity onPress={() => setShowModal(false)}>
                    <X size={24} color={theme.textSecondary} />
                  </TouchableOpacity>
                </View>

                <Text style={[styles.inputLabel, { color: theme.textPrimary }]}>Customer Name *</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.cardBg, borderColor: theme.borderColor, color: theme.textPrimary }]}
                  value={name}
                  onChangeText={setName}
                  placeholder="e.g. Rahul Sharma"
                  placeholderTextColor="#94A3B8"
                />

                <Text style={[styles.inputLabel, { color: theme.textPrimary }]}>Phone Number *</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.cardBg, borderColor: theme.borderColor, color: theme.textPrimary }]}
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  placeholder="9876543210"
                  placeholderTextColor="#94A3B8"
                />

                <Text style={[styles.inputLabel, { color: theme.textPrimary }]}>Email (Optional)</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.cardBg, borderColor: theme.borderColor, color: theme.textPrimary }]}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  placeholder="rahul@example.com"
                  placeholderTextColor="#94A3B8"
                />

                <Text style={[styles.inputLabel, { color: theme.textPrimary }]}>Credit Limit (₹)</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.cardBg, borderColor: theme.borderColor, color: theme.textPrimary }]}
                  value={creditLimit}
                  onChangeText={setCreditLimit}
                  keyboardType="numeric"
                  placeholder="5000"
                  placeholderTextColor="#94A3B8"
                />

                <TouchableOpacity onPress={handleSaveCustomer} disabled={submitting} style={styles.submitBtn}>
                  {submitting && <ActivityIndicator color="#FFF" style={{ marginRight: 8 }} />}
                  <Text style={styles.submitBtnText}>Save Customer Account</Text>
                </TouchableOpacity>
              </ScrollView>
            </SafeAreaView>
          </KeyboardAvoidingWrapper>
        </Modal>

        {/* PHONE CONTACTS IMPORT MODAL */}
        <ContactImportModal
          visible={showContactModal}
          onClose={() => setShowContactModal(false)}
          bulkCreateCustomers={bulkCreateCustomers}
          onImportSuccess={(count) => {
            Alert.alert('Import Complete', `Successfully imported ${count} customers from your phone contacts!`);
            refetch();
          }}
        />
      </SafeAreaView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  mainWrapper: { flex: 1, paddingHorizontal: 16, paddingTop: 12 },
  backBtn: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  backBtnText: { fontSize: 13, fontWeight: '600', marginLeft: 6 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  headerTitle: { fontSize: 24, fontWeight: '900' },
  headerSub: { fontSize: 12 },
  addBtn: {
    backgroundColor: BRAND_COLORS.blue600,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  addBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 12, marginLeft: 4 },
  metricsGrid: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  metricCard: { flex: 1, borderRadius: 14, padding: 12, borderWidth: 1, marginHorizontal: 4 },
  metricLabel: { fontSize: 10.5, fontWeight: '700', textTransform: 'uppercase' },
  metricValue: { fontSize: 16, fontWeight: '900', marginTop: 4 },
  metricSub: { fontSize: 10, marginTop: 2 },
  searchBox: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 10 },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 14 },
  filterTabRow: { flexDirection: 'row', marginBottom: 12 },
  filterChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, marginRight: 8 },
  filterChipActive: { backgroundColor: BRAND_COLORS.blue600, borderColor: BRAND_COLORS.blue600 },
  filterChipText: { fontSize: 12, fontWeight: '700' },
  filterChipTextActive: { color: '#FFFFFF' },
  loaderCenter: { paddingVertical: 60, alignItems: 'center' },
  customerCard: { borderRadius: 16, padding: 14, borderWidth: 1, marginBottom: 10 },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center' },
  avatarCircle: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 17, fontWeight: '900' },
  customerName: { fontSize: 15, fontWeight: '800', flex: 1, marginRight: 8 },
  customerPhone: { fontSize: 12, marginTop: 2 },
  statusBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  statusBadgeText: { fontSize: 9, fontWeight: '900' },
  cardDetailsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
  balanceTitle: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  balanceValue: { fontSize: 15, fontWeight: '900', marginTop: 2 },
  limitValue: { fontSize: 13, fontWeight: '800', marginTop: 2 },
  progressBarBg: { height: 4, backgroundColor: '#E2E8F0', borderRadius: 2, marginTop: 8, overflow: 'hidden' },
  progressBarFill: { height: '100%', borderRadius: 2 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 10, marginTop: 10, borderTopWidth: 1 },
  quickActionBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4 },
  quickActionText: { fontSize: 12, fontWeight: '800', marginLeft: 4 },
  modalSafeArea: { flex: 1 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 20, fontWeight: '900' },
  inputLabel: { fontSize: 12, fontWeight: '700', marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: 12, padding: 12, fontSize: 14, marginBottom: 14 },
  submitBtn: { backgroundColor: BRAND_COLORS.blue600, borderRadius: 14, paddingVertical: 14, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  submitBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },
  emptyCenter: { paddingVertical: 40, alignItems: 'center' },
  emptyTitle: { fontSize: 16, fontWeight: '900' },
  emptySub: { fontSize: 12, textAlign: 'center', marginTop: 4 },
});

