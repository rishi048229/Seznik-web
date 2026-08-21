import React, { useState } from 'react';
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
  Switch,
  StyleSheet,
  StatusBar,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Plus,
  ArrowLeft,
  UserCog,
  Edit3,
  Trash2,
  X,
  ShieldCheck,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useManagedUsers } from '@/hooks/useManagedUsers';
import { ManagedUser, UserPermissions } from '@/types/auth';
import { BRAND_COLORS } from '@/constants/theme';
import { useAppTheme } from '@/hooks/useAppTheme';
import { ScreenBackground } from '@/components/ui/ScreenBackground';
import { KeyboardAvoidingWrapper } from '@/components/ui/KeyboardAvoidingWrapper';
import { ListScreenSkeleton, StaffListSkeleton } from '@/components/ui/ScreenSkeleton';
import { ScreenLoadingState } from '@/components/ui/ScreenLoadingState';
import { useTranslation } from '@/store/useLanguageStore';

// Mirrors UserPermissions (src/types/auth.ts) and useAuthStore.hasPermission's gating exactly —
// keep these two in sync if a new permission key is ever added.
const PERMISSION_FIELDS: { key: keyof UserPermissions; label: string; hint: string }[] = [
  { key: 'canManipulateStock', label: 'Manage Stock & Inventory', hint: 'Add/edit products, adjust stock' },
  { key: 'canAccessSuppliers', label: 'Access Suppliers', hint: 'View & manage vendor directory' },
  { key: 'canAccessPurchases', label: 'Access Purchases', hint: 'Record stock purchases' },
  { key: 'canAccessExpenses', label: 'Access Expenses', hint: 'View & log business expenses' },
  { key: 'canAccessReports', label: 'Access Reports', hint: 'View financial reports & analytics' },
  { key: 'canManageUsers', label: 'Manage Staff', hint: 'Add/edit/remove other staff accounts' },
  { key: 'canAccessKOT', label: 'Access KOT & Restaurant Orders', hint: 'View and manage kitchen order tickets, tables and restaurant billing' },
];

const EMPTY_PERMISSIONS: UserPermissions = {
  canManipulateStock: false,
  canAccessSuppliers: false,
  canAccessPurchases: false,
  canAccessExpenses: false,
  canAccessReports: false,
  canManageUsers: false,
  canAccessKOT: false,
};

export default function StaffScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const { t, currentLanguage } = useTranslation();
  const insets = useSafeAreaInsets();
  const topPadding = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0, 12);
  const { staff, isLoading, createStaff, isCreating, updateStaff, removeStaff, isSyncing } = useManagedUsers();

  const [showModal, setShowModal] = useState(false);
  const [editingStaff, setEditingStaff] = useState<ManagedUser | null>(null);

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'admin' | 'agent'>('agent');
  const [permissions, setPermissions] = useState<UserPermissions>(EMPTY_PERMISSIONS);
  const [submitting, setSubmitting] = useState(false);

  const handleOpenAdd = () => {
    setEditingStaff(null);
    setDisplayName('');
    setEmail('');
    setPassword('');
    setRole('agent');
    setPermissions(EMPTY_PERMISSIONS);
    setShowModal(true);
  };

  const handleOpenEdit = (member: ManagedUser) => {
    setEditingStaff(member);
    setDisplayName(member.displayName || '');
    setEmail(member.email || '');
    setPassword('');
    setRole((member.role as any) === 'admin' ? 'admin' : 'agent');
    setPermissions(member.permissions || EMPTY_PERMISSIONS);
    setShowModal(true);
  };

  const handleSaveStaff = async () => {
    if (!email.trim()) {
      Alert.alert('Validation', 'Email is required');
      return;
    }
    if (!editingStaff && !password.trim()) {
      Alert.alert('Validation', 'Password is required for new accounts');
      return;
    }

    setSubmitting(true);
    try {
      if (editingStaff) {
        await updateStaff(editingStaff.uid, {
          displayName: displayName.trim() || editingStaff.displayName,
          role,
          permissions,
        });
      } else {
        await createStaff({
          email: email.trim().toLowerCase(),
          password: password.trim(),
          displayName: displayName.trim() || email.split('@')[0] || 'Staff',
          role,
          permissions,
        });
      }
      setShowModal(false);
    } catch (e: any) {
      Alert.alert('Save Failed', e?.message || 'Could not save staff account.');
    } finally {
      setSubmitting(false);
    }
  };


  const handleDeleteStaff = (member: ManagedUser) => {
    Alert.alert('Remove Staff', `Are you sure you want to delete ${member.displayName || member.email}?`, [
      { text: t('cancel', 'Cancel'), style: 'cancel' },
      {
        text: t('delete', 'Delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            await removeStaff(member.uid);
          } catch (e: any) {
            Alert.alert('Delete Failed', e?.message || 'Could not delete staff account.');
          }
        },
      },
    ]);
  };

  const permissionCount = (p?: UserPermissions | null) =>
    PERMISSION_FIELDS.filter((f) => p?.[f.key]).length;

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
              <Text style={styles.addBtnText}>{t('addStaff', 'Add Staff')}</Text>
            </TouchableOpacity>
          </View>

          <Text style={[styles.title, { color: theme.textPrimary }]}>{t('staffAccounts', 'Staff & Permissions')}</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            {staff.length} staff sub-account{staff.length === 1 ? '' : 's'} under this admin
          </Text>

          {isLoading ? (
            <ScreenLoadingState
              message="Loading staff..."
              hint="Fetching team members and access permissions"
              skeleton={<StaffListSkeleton count={4} />}
            />
          ) : (
            <FlatList
              data={staff}
              keyExtractor={(item) => item.uid}
              contentContainerStyle={{ paddingBottom: 40 }}
              ListEmptyComponent={
                <View style={{ alignItems: 'center', marginTop: 40 }}>
                  <UserCog size={32} color={theme.textSecondary} style={{ marginBottom: 8 }} />
                  <Text style={{ color: theme.textSecondary, fontSize: 13, textAlign: 'center' }}>
                    {t('noStaffAccounts', 'No staff accounts yet. Tap "Add Staff" to give a team member their login.')}
                  </Text>
                </View>
              }
              renderItem={({ item }) => (
                <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
                  <View style={{ flex: 1, marginRight: 12 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Text style={[styles.staffName, { color: theme.textPrimary }]}>{item.displayName || 'Unnamed'}</Text>
                      <View style={[styles.roleBadge, item.role === 'admin' && { backgroundColor: 'rgba(37, 99, 235, 0.15)' }]}>
                        <Text style={[styles.roleBadgeText, item.role === 'admin' && { color: BRAND_COLORS.blue600 }]}>
                          {item.role === 'admin' ? 'Admin' : 'Agent'}
                        </Text>
                      </View>
                    </View>
                    {item.email ? <Text style={[styles.metaText, { color: theme.textSecondary }]}>{item.email}</Text> : null}
                    <Text style={[styles.metaText, { color: theme.textSecondary }]}>
                      {item.role === 'admin' ? 'Full access (all permissions)' : `${permissionCount(item.permissions)}/${PERMISSION_FIELDS.length} permissions granted`}
                    </Text>
                  </View>

                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <TouchableOpacity onPress={() => handleOpenEdit(item)} style={styles.iconBtn}>
                      <Edit3 size={16} color={theme.textSecondary} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleDeleteStaff(item)} style={[styles.iconBtn, { marginLeft: 8 }]}>
                      <Trash2 size={16} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            />
          )}
        </View>

        {/* Add / Edit Staff Modal */}
        <Modal visible={showModal} animationType="slide">
          <KeyboardAvoidingWrapper inModal>
          <SafeAreaView style={[styles.modalSafeArea, { backgroundColor: theme.bg }]}>
            <ScrollView style={{ flex: 1, padding: 16 }}>
              <View style={styles.sheetHeader}>
                <Text style={[styles.sheetTitle, { color: theme.textPrimary }]}>
                  {editingStaff ? 'Edit Staff Member' : 'Add Staff Member'}
                </Text>
                <TouchableOpacity onPress={() => setShowModal(false)}>
                  <X size={24} color={theme.textSecondary} />
                </TouchableOpacity>
              </View>

              <Text style={[styles.label, { color: theme.textPrimary }]}>Name *</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.cardBg, borderColor: theme.borderColor, color: theme.textPrimary }]}
                value={displayName}
                onChangeText={setDisplayName}
                placeholder="e.g. Ramesh Kumar"
                placeholderTextColor="#94A3B8"
              />

              <Text style={[styles.label, { color: theme.textPrimary }]}>Email</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.cardBg, borderColor: theme.borderColor, color: theme.textPrimary }]}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                placeholder="staff@example.com"
                placeholderTextColor="#94A3B8"
              />

              <Text style={[styles.label, { color: theme.textPrimary }]}>
                {editingStaff ? 'New Password (leave blank to keep current)' : 'Password *'}
              </Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.cardBg, borderColor: theme.borderColor, color: theme.textPrimary }]}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                placeholder={editingStaff ? '••••••••' : 'Set a login password'}
                placeholderTextColor="#94A3B8"
              />

              <Text style={[styles.label, { color: theme.textPrimary }]}>Role</Text>
              <View style={styles.roleRow}>
                {(['agent', 'admin'] as const).map((r) => (
                  <TouchableOpacity
                    key={r}
                    onPress={() => setRole(r)}
                    style={[
                      styles.roleChip,
                      { borderColor: theme.borderColor, backgroundColor: theme.cardBg },
                      role === r && { backgroundColor: BRAND_COLORS.blue600, borderColor: BRAND_COLORS.blue600 },
                    ]}
                  >
                    <Text style={[styles.roleChipText, { color: theme.textSecondary }, role === r && { color: '#FFFFFF' }]}>
                      {r === 'admin' ? 'Admin (full access)' : 'Agent (restricted)'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {role === 'agent' ? (
                <>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 18, marginBottom: 10 }}>
                    <ShieldCheck size={15} color={theme.textPrimary} />
                    <Text style={[styles.label, { color: theme.textPrimary, marginBottom: 0, marginLeft: 6 }]}>
                      Granular Permissions
                    </Text>
                  </View>
                  {PERMISSION_FIELDS.map((f) => (
                    <View key={f.key} style={[styles.permRow, { borderColor: theme.borderColor, backgroundColor: theme.cardBg }]}>
                      <View style={{ flex: 1, marginRight: 10 }}>
                        <Text style={[styles.permLabel, { color: theme.textPrimary }]}>{f.label}</Text>
                        <Text style={[styles.permHint, { color: theme.textSecondary }]}>{f.hint}</Text>
                      </View>
                      <Switch
                        value={!!permissions[f.key]}
                        onValueChange={(v) => setPermissions((prev) => ({ ...prev, [f.key]: v }))}
                        trackColor={{ false: '#64748B', true: BRAND_COLORS.blue600 }}
                      />
                    </View>
                  ))}
                </>
              ) : (
                <Text style={{ fontSize: 12, color: theme.textSecondary, marginTop: 18, lineHeight: 18 }}>
                  Admin accounts always have full access to every feature — granular permissions only apply to Agent accounts.
                </Text>
              )}

              <TouchableOpacity
                onPress={handleSaveStaff}
                disabled={submitting || isCreating || isSyncing}
                style={[styles.submitBtn, { marginTop: 24 }]}
              >
                {submitting || isCreating || isSyncing ? <ActivityIndicator color="#FFF" style={{ marginRight: 8 }} /> : null}
                <Text style={styles.submitBtnText}>{editingStaff ? 'Save Changes' : 'Create Staff Account'}</Text>
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
  subtitle: { fontSize: 12, marginTop: 2, marginBottom: 16 },
  card: { borderRadius: 16, padding: 14, borderWidth: 1, marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  staffName: { fontSize: 15, fontWeight: '800' },
  roleBadge: { backgroundColor: 'rgba(100, 116, 139, 0.15)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, marginLeft: 8 },
  roleBadgeText: { fontSize: 10, fontWeight: '800', color: '#64748B', textTransform: 'uppercase' },
  metaText: { fontSize: 11, marginTop: 3 },
  iconBtn: { padding: 8, borderRadius: 10, backgroundColor: 'rgba(100, 116, 139, 0.12)' },
  modalSafeArea: { flex: 1 },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sheetTitle: { fontSize: 20, fontWeight: '900' },
  label: { fontSize: 12, fontWeight: '700', marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: 12, padding: 12, fontSize: 14, marginBottom: 14 },
  roleRow: { flexDirection: 'row', gap: 8 },
  roleChip: { flex: 1, borderWidth: 1, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  roleChipText: { fontSize: 12, fontWeight: '800' },
  permRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 14, padding: 12, marginBottom: 8 },
  permLabel: { fontSize: 13, fontWeight: '700' },
  permHint: { fontSize: 10.5, marginTop: 2 },
  submitBtn: { backgroundColor: BRAND_COLORS.navyInk, borderRadius: 14, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 30 },
  submitBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },
});
