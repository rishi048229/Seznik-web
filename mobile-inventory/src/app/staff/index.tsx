import React, { useEffect, useMemo, useState } from 'react';
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
  Switch,
  StyleSheet,
  StatusBar,
  Platform,
  useWindowDimensions,
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
  Search,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useManagedUsers } from '@/hooks/useManagedUsers';
import { useAuth } from '@/hooks/useAuth';
import { ManagedUser, UserPermissions } from '@/types/auth';
import { BRAND_COLORS } from '@/constants/theme';
import { useAppTheme, AppTheme } from '@/hooks/useAppTheme';
import { ScreenBackground } from '@/components/ui/ScreenBackground';
import { KeyboardAvoidingWrapper } from '@/components/ui/KeyboardAvoidingWrapper';
import { StaffListSkeleton } from '@/components/ui/ScreenSkeleton';
import { ScreenLoadingState, ScreenErrorState } from '@/components/ui/ScreenLoadingState';
import { useTranslation } from '@/store/useLanguageStore';
import { useNotificationStore } from '@/store/useNotificationStore';
import { isNavFeatureVisible } from '@/utils/businessFeatures';

type Role = 'admin' | 'agent';

const PERMISSION_FIELDS: {
  key: keyof UserPermissions;
  labelKey: string;
  label: string;
  hintKey: string;
  hint: string;
  chipKey: string;
  chip: string;
}[] = [
  {
    key: 'canManipulateStock',
    labelKey: 'permManageStock',
    label: 'Manage stock & inventory',
    hintKey: 'permManageStockHint',
    hint: 'Add and edit products, adjust quantities',
    chipKey: 'chipStock',
    chip: 'Stock',
  },
  {
    key: 'canAccessSuppliers',
    labelKey: 'permAccessSuppliers',
    label: 'Access suppliers',
    hintKey: 'permAccessSuppliersHint',
    hint: 'View and manage the vendor directory',
    chipKey: 'chipSuppliers',
    chip: 'Suppliers',
  },
  {
    key: 'canAccessPurchases',
    labelKey: 'permAccessPurchases',
    label: 'Access purchases',
    hintKey: 'permAccessPurchasesHint',
    hint: 'Record stock purchases',
    chipKey: 'chipPurchases',
    chip: 'Purchases',
  },
  {
    key: 'canAccessExpenses',
    labelKey: 'permAccessExpenses',
    label: 'Access expenses',
    hintKey: 'permAccessExpensesHint',
    hint: 'View and log business expenses',
    chipKey: 'chipExpenses',
    chip: 'Expenses',
  },
  {
    key: 'canAccessReports',
    labelKey: 'permAccessReports',
    label: 'Access reports',
    hintKey: 'permAccessReportsHint',
    hint: 'View reports and analytics',
    chipKey: 'chipReports',
    chip: 'Reports',
  },
  {
    key: 'canManageUsers',
    labelKey: 'permManageStaff',
    label: 'Manage staff',
    hintKey: 'permManageStaffHint',
    hint: 'Add, edit, or remove other staff accounts',
    chipKey: 'chipStaff',
    chip: 'Staff',
  },
  {
    key: 'canAccessKOT',
    labelKey: 'permAccessKot',
    label: 'Access KOT & restaurant orders',
    hintKey: 'permAccessKotHint',
    hint: 'Kitchen tickets, tables, and restaurant billing',
    chipKey: 'chipKot',
    chip: 'KOT',
  },
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

const FULL_PERMISSIONS: UserPermissions = {
  canManipulateStock: true,
  canAccessSuppliers: true,
  canAccessPurchases: true,
  canAccessExpenses: true,
  canAccessReports: true,
  canManageUsers: true,
  canAccessKOT: true,
};

function staffInitials(name: string | null | undefined) {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function StaffAvatar({ name, theme }: { name: string | null | undefined; theme: AppTheme }) {
  return (
    <View
      style={[
        styles.avatar,
        {
          backgroundColor: theme.isDark ? 'rgba(37, 99, 235, 0.28)' : 'rgba(37, 99, 235, 0.12)',
        },
      ]}
    >
      <Text style={styles.avatarText}>{staffInitials(name)}</Text>
    </View>
  );
}

function AccessSummary({
  member,
  fields,
  theme,
  t,
}: {
  member: ManagedUser;
  fields: typeof PERMISSION_FIELDS;
  theme: AppTheme;
  t: (key: string, fallback?: string) => string;
}) {
  if (member.role === 'admin') {
    return (
      <View style={[styles.chip, styles.chipFull]}>
        <Text style={styles.chipFullText}>{t('fullAccess', 'Full access')}</Text>
      </View>
    );
  }

  const granted = fields.filter((field) => member.permissions?.[field.key]);
  if (granted.length === 0) {
    return (
      <Text style={[styles.posOnlyText, { color: theme.textSecondary }]}>
        {t('posOnlyAccess', 'POS & products only')}
      </Text>
    );
  }

  return (
    <View style={styles.chipRow}>
      {granted.map((field) => (
        <View
          key={field.key}
          style={[
            styles.chip,
            {
              backgroundColor: theme.isDark ? 'rgba(37, 99, 235, 0.22)' : 'rgba(37, 99, 235, 0.1)',
            },
          ]}
        >
          <Text style={styles.chipText}>{t(field.chipKey, field.chip)}</Text>
        </View>
      ))}
    </View>
  );
}

function RolePicker({
  value,
  onChange,
  theme,
  t,
}: {
  value: Role;
  onChange: (role: Role) => void;
  theme: AppTheme;
  t: (key: string, fallback?: string) => string;
}) {
  return (
    <View>
      <Text style={[styles.label, { color: theme.textPrimary }]}>{t('role', 'Role')}</Text>
      <View style={styles.roleRow}>
        {([
          {
            id: 'agent' as const,
            title: t('staffRole', 'Staff'),
            hint: t('staffRoleHint', 'Choose what they can open'),
          },
          {
            id: 'admin' as const,
            title: t('adminRole', 'Admin'),
            hint: t('adminRoleHint', 'Full access to every area'),
          },
        ]).map((option) => {
          const selected = value === option.id;
          return (
            <TouchableOpacity
              key={option.id}
              onPress={() => onChange(option.id)}
              style={[
                styles.roleCard,
                {
                  borderColor: selected ? BRAND_COLORS.blue600 : theme.borderColor,
                  backgroundColor: selected
                    ? theme.isDark
                      ? 'rgba(37, 99, 235, 0.22)'
                      : 'rgba(37, 99, 235, 0.08)'
                    : theme.cardBg,
                },
              ]}
            >
              <Text style={[styles.roleCardTitle, { color: theme.textPrimary }]}>{option.title}</Text>
              <Text style={[styles.roleCardHint, { color: theme.textSecondary }]}>{option.hint}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

export default function StaffScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const { t } = useTranslation();
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const showColumns = width >= 700;
  const insets = useSafeAreaInsets();
  const topPadding = Math.max(insets.top, Platform.OS === 'android' ? StatusBar.currentHeight || 0 : 0, 12);
  const modalTopPad = Math.max(insets.top, Platform.OS === 'android' ? StatusBar.currentHeight || 0 : 0, 12);
  const modalBottomPad = Math.max(insets.bottom, 12);
  const dismissBanner = useNotificationStore((state) => state.dismissBanner);
  const setPauseInAppBanner = useNotificationStore((state) => state.setPauseInAppBanner);
  const { staff, isLoading, isRefetching, isError, refetch, createStaff, isCreating, updateStaff, removeStaff, isSyncing } =
    useManagedUsers();

  const showKot = isNavFeatureVisible(user?.businessType, 'kot');
  const permissionFields = useMemo(
    () => (showKot ? PERMISSION_FIELDS : PERMISSION_FIELDS.filter((field) => field.key !== 'canAccessKOT')),
    [showKot]
  );

  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingStaff, setEditingStaff] = useState<ManagedUser | null>(null);

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('agent');
  const [permissions, setPermissions] = useState<UserPermissions>(EMPTY_PERMISSIONS);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setPauseInAppBanner(showModal);
    if (showModal) dismissBanner();
    return () => setPauseInAppBanner(false);
  }, [showModal, dismissBanner, setPauseInAppBanner]);

  const filteredStaff = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return staff;
    return staff.filter((member) => {
      const name = (member.displayName || '').toLowerCase();
      const memberEmail = (member.email || '').toLowerCase();
      return name.includes(query) || memberEmail.includes(query);
    });
  }, [staff, search]);

  const applyRoleChange = (next: Role) => {
    setRole(next);
    if (next === 'admin') {
      setPermissions(FULL_PERMISSIONS);
    } else if (role === 'admin') {
      setPermissions(EMPTY_PERMISSIONS);
    }
  };

  const handleOpenAdd = () => {
    dismissBanner();
    setEditingStaff(null);
    setDisplayName('');
    setEmail('');
    setPassword('');
    setRole('agent');
    setPermissions(EMPTY_PERMISSIONS);
    setShowModal(true);
  };

  const handleOpenEdit = (member: ManagedUser) => {
    dismissBanner();
    setEditingStaff(member);
    setDisplayName(member.displayName || '');
    setEmail(member.email || '');
    setPassword('');
    setRole(member.role === 'admin' ? 'admin' : 'agent');
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
      const nextPermissions = role === 'admin' ? FULL_PERMISSIONS : permissions;
      if (editingStaff) {
        await updateStaff(editingStaff.uid, {
          displayName: displayName.trim() || editingStaff.displayName,
          role,
          permissions: nextPermissions,
        });
      } else {
        await createStaff({
          email: email.trim().toLowerCase(),
          password: password.trim(),
          displayName: displayName.trim() || email.split('@')[0] || 'Staff',
          role,
          permissions: nextPermissions,
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
    Alert.alert(
      t('removeStaff', 'Remove staff'),
      t('removeStaffConfirm', 'Remove this staff account? They will no longer be able to sign in.'),
      [
        { text: t('cancel', 'Cancel'), style: 'cancel' },
        {
          text: t('removeStaff', 'Remove'),
          style: 'destructive',
          onPress: async () => {
            try {
              await removeStaff(member.uid);
            } catch (e: any) {
              Alert.alert('Delete Failed', e?.message || 'Could not delete staff account.');
            }
          },
        },
      ]
    );
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
              <Text style={styles.addBtnText}>{t('addStaff', 'Add staff')}</Text>
            </TouchableOpacity>
          </View>

          <Text style={[styles.title, { color: theme.textPrimary }]}>
            {t('staffPageTitle', 'Staff & permissions')}
          </Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            {t('staffSubtitle', 'Who can sign in, and what they can change')}
          </Text>

          <View style={[styles.searchBox, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
            <Search size={16} color={theme.textSecondary} />
            <TextInput
              style={[styles.searchInput, { color: theme.textPrimary }]}
              placeholder={t('searchStaff', 'Search by name or email')}
              placeholderTextColor="#94A3B8"
              value={search}
              onChangeText={setSearch}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <Text style={[styles.countText, { color: theme.textSecondary }]}>
            {staff.length === 1
              ? t('staffCountOne', '1 staff account')
              : `${staff.length} ${t('staffCountSuffix', 'staff accounts')}`}
          </Text>

          {isLoading ? (
            <ScreenLoadingState
              message={t('loadingStaff', 'Loading staff...')}
              hint={t('loadingStaffHint', 'Fetching team members and access')}
              skeleton={<StaffListSkeleton count={4} />}
            />
          ) : isError ? (
            <ScreenErrorState
              message={t('staffLoadFailed', 'Could not load staff')}
              hint={t('staffLoadFailedHint', 'Check your connection and try again')}
              onRetry={refetch}
              isRetrying={isRefetching}
            />
          ) : (
            <FlatList
              data={filteredStaff}
              keyExtractor={(item) => item.uid}
              contentContainerStyle={{ paddingBottom: 40 }}
              ListHeaderComponent={
                showColumns && filteredStaff.length > 0 ? (
                  <View style={styles.colHeader}>
                    <Text style={[styles.colHeaderText, styles.colStaff, { color: theme.textSecondary }]}>
                      {t('staffColumn', 'Staff member')}
                    </Text>
                    <Text style={[styles.colHeaderText, styles.colAccess, { color: theme.textSecondary }]}>
                      {t('accessColumn', 'Access')}
                    </Text>
                    <Text style={[styles.colHeaderText, styles.colManage, { color: theme.textSecondary }]}>
                      {t('manageColumn', 'Manage')}
                    </Text>
                  </View>
                ) : null
              }
              ListEmptyComponent={
                <View style={[styles.emptyCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
                  <View style={styles.emptyIcon}>
                    <UserCog size={28} color={BRAND_COLORS.blue600} />
                  </View>
                  <Text style={[styles.emptyTitle, { color: theme.textPrimary }]}>
                    {search
                      ? t('noStaffSearchResults', 'No staff match that search')
                      : t('emptyStaffTitle', 'No staff accounts yet')}
                  </Text>
                  <Text style={[styles.emptySub, { color: theme.textSecondary }]}>
                    {search
                      ? t('noStaffSearchHint', 'Try a different name or email.')
                      : t(
                          'emptyStaffDesc',
                          'Add a cashier or manager so they can sign in with their own email and password.'
                        )}
                  </Text>
                  {!search ? (
                    <TouchableOpacity onPress={handleOpenAdd} style={styles.emptyAddBtn}>
                      <Plus size={16} color="#FFFFFF" />
                      <Text style={styles.addBtnText}>{t('addStaff', 'Add staff')}</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              }
              renderItem={({ item }) => (
                <View
                  style={[
                    styles.card,
                    showColumns && styles.cardWide,
                    { backgroundColor: theme.cardBg, borderColor: theme.borderColor },
                  ]}
                >
                  <View style={[styles.staffCell, showColumns && styles.colStaff]}>
                    <StaffAvatar name={item.displayName} theme={theme} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <View style={styles.nameRow}>
                        <Text style={[styles.staffName, { color: theme.textPrimary }]} numberOfLines={1}>
                          {item.displayName || t('staffRole', 'Staff')}
                        </Text>
                        <View
                          style={[
                            styles.roleBadge,
                            item.role === 'admin'
                              ? { backgroundColor: 'rgba(245, 158, 11, 0.18)' }
                              : { backgroundColor: theme.isDark ? 'rgba(37, 99, 235, 0.22)' : 'rgba(37, 99, 235, 0.12)' },
                          ]}
                        >
                          <Text
                            style={[
                              styles.roleBadgeText,
                              { color: item.role === 'admin' ? '#D97706' : BRAND_COLORS.blue600 },
                            ]}
                          >
                            {item.role === 'admin' ? t('adminRole', 'Admin') : t('staffRole', 'Staff')}
                          </Text>
                        </View>
                      </View>
                      {item.email ? (
                        <Text style={[styles.metaText, { color: theme.textSecondary }]} numberOfLines={1}>
                          {item.email}
                        </Text>
                      ) : null}
                      {!showColumns ? (
                        <View style={{ marginTop: 8 }}>
                          <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>
                            {t('accessColumn', 'Access')}
                          </Text>
                          <AccessSummary member={item} fields={permissionFields} theme={theme} t={t} />
                        </View>
                      ) : null}
                    </View>
                  </View>

                  {showColumns ? (
                    <View style={[styles.accessCell, styles.colAccess]}>
                      <AccessSummary member={item} fields={permissionFields} theme={theme} t={t} />
                    </View>
                  ) : null}

                  <View style={[styles.manageCell, showColumns && styles.colManage]}>
                    <TouchableOpacity
                      onPress={() => handleOpenEdit(item)}
                      style={styles.iconBtn}
                      accessibilityLabel={t('editAccess', 'Edit access')}
                    >
                      <Edit3 size={16} color={theme.textSecondary} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleDeleteStaff(item)}
                      style={[styles.iconBtn, { marginLeft: 8 }]}
                      accessibilityLabel={t('removeStaff', 'Remove')}
                    >
                      <Trash2 size={16} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            />
          )}
        </View>

        <Modal
          visible={showModal}
          animationType="slide"
          onRequestClose={() => setShowModal(false)}
        >
          <KeyboardAvoidingWrapper inModal keyboardVerticalOffset={modalTopPad}>
            <View
              style={[
                styles.modalSafeArea,
                {
                  backgroundColor: theme.bg,
                  paddingTop: modalTopPad,
                  paddingBottom: modalBottomPad,
                },
              ]}
            >
              <StatusBar
                barStyle={theme.isDark ? 'light-content' : 'dark-content'}
                backgroundColor={theme.bg}
              />
              <View style={[styles.sheetHeader, { borderBottomColor: theme.borderColor }]}>
                <Text style={[styles.sheetTitle, { color: theme.textPrimary }]} numberOfLines={1}>
                  {editingStaff
                    ? t('editAccess', 'Edit access')
                    : t('addStaffMember', 'Add staff member')}
                </Text>
                <TouchableOpacity
                  onPress={() => setShowModal(false)}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  style={styles.sheetCloseBtn}
                >
                  <X size={22} color={theme.textSecondary} />
                </TouchableOpacity>
              </View>
              <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={styles.sheetBody}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >

                <Text style={[styles.label, { color: theme.textPrimary }]}>
                  {t('fullNameRequired', 'Full name *')}
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    { backgroundColor: theme.cardBg, borderColor: theme.borderColor, color: theme.textPrimary },
                  ]}
                  value={displayName}
                  onChangeText={setDisplayName}
                  placeholder={t('fullNamePlaceholder', 'e.g. Ramesh Kumar')}
                  placeholderTextColor="#94A3B8"
                />

                <Text style={[styles.label, { color: theme.textPrimary }]}>
                  {t('emailRequired', 'Email *')}
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    { backgroundColor: theme.cardBg, borderColor: theme.borderColor, color: theme.textPrimary },
                  ]}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  editable={!editingStaff}
                  placeholder="staff@example.com"
                  placeholderTextColor="#94A3B8"
                />

                <Text style={[styles.label, { color: theme.textPrimary }]}>
                  {editingStaff
                    ? t('newPasswordOptional', 'New password (leave blank to keep current)')
                    : t('passwordRequired', 'Password *')}
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    { backgroundColor: theme.cardBg, borderColor: theme.borderColor, color: theme.textPrimary },
                  ]}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  placeholder={editingStaff ? '••••••••' : t('minChars', 'Min 6 characters')}
                  placeholderTextColor="#94A3B8"
                />

                <RolePicker value={role} onChange={applyRoleChange} theme={theme} t={t} />

                {role === 'agent' ? (
                  <>
                    <View style={styles.permHeader}>
                      <ShieldCheck size={15} color={theme.textPrimary} />
                      <Text style={[styles.label, { color: theme.textPrimary, marginBottom: 0, marginLeft: 6 }]}>
                        {t('granularPermissions', 'What they can access')}
                      </Text>
                    </View>
                    <View style={[styles.permList, { borderColor: theme.borderColor }]}>
                      {permissionFields.map((field, index) => (
                        <View
                          key={field.key}
                          style={[
                            styles.permRow,
                            {
                              backgroundColor: theme.cardBg,
                              borderBottomColor: theme.borderColor,
                              borderBottomWidth: index === permissionFields.length - 1 ? 0 : StyleSheet.hairlineWidth,
                            },
                          ]}
                        >
                          <View style={{ flex: 1, marginRight: 10 }}>
                            <Text style={[styles.permLabel, { color: theme.textPrimary }]}>
                              {t(field.labelKey, field.label)}
                            </Text>
                            <Text style={[styles.permHint, { color: theme.textSecondary }]}>
                              {t(field.hintKey, field.hint)}
                            </Text>
                          </View>
                          <Switch
                            value={!!permissions[field.key]}
                            onValueChange={(v) => setPermissions((prev) => ({ ...prev, [field.key]: v }))}
                            trackColor={{ false: '#64748B', true: BRAND_COLORS.blue600 }}
                          />
                        </View>
                      ))}
                    </View>
                  </>
                ) : (
                  <View
                    style={[
                      styles.adminNote,
                      { backgroundColor: theme.isDark ? 'rgba(100, 116, 139, 0.18)' : BRAND_COLORS.slate100 },
                    ]}
                  >
                    <Text style={{ fontSize: 13, color: theme.textSecondary, lineHeight: 18 }}>
                      {t(
                        'adminHasFullAccess',
                        'Admins can open every area. Switch to Staff to limit access.'
                      )}
                    </Text>
                  </View>
                )}

                <TouchableOpacity
                  onPress={handleSaveStaff}
                  disabled={submitting || isCreating || isSyncing}
                  style={[styles.submitBtn, { marginTop: 24 }]}
                >
                  {submitting || isCreating || isSyncing ? (
                    <ActivityIndicator color="#FFF" style={{ marginRight: 8 }} />
                  ) : null}
                  <Text style={styles.submitBtnText}>
                    {editingStaff ? t('saveAccess', 'Save access') : t('createStaffAccount', 'Create staff account')}
                  </Text>
                </TouchableOpacity>
              </ScrollView>
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
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  backBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 4, marginLeft: -4 },
  backBtnText: { fontSize: 13, fontWeight: '600', marginLeft: 4 },
  addBtn: {
    backgroundColor: BRAND_COLORS.navyInk,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  addBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 12, marginLeft: 4 },
  title: { fontSize: 24, fontWeight: '900' },
  subtitle: { fontSize: 13, marginTop: 4, marginBottom: 14, lineHeight: 18 },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 10,
  },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 14, paddingVertical: 2 },
  countText: { fontSize: 12, marginBottom: 10 },
  colHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, paddingBottom: 8 },
  colHeaderText: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4 },
  colStaff: { flex: 1.2 },
  colAccess: { flex: 1.4, paddingHorizontal: 8 },
  colManage: { width: 88, alignItems: 'flex-end' },
  card: {
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardWide: { alignItems: 'center' },
  staffCell: { flex: 1, flexDirection: 'row', alignItems: 'flex-start', marginRight: 8, minWidth: 0 },
  accessCell: { justifyContent: 'center' },
  manageCell: { flexDirection: 'row', alignItems: 'center', paddingTop: 2 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  avatarText: { fontSize: 12, fontWeight: '800', color: BRAND_COLORS.blue600 },
  nameRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  staffName: { fontSize: 15, fontWeight: '800', flexShrink: 1 },
  roleBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  roleBadgeText: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  metaText: { fontSize: 12, marginTop: 2 },
  fieldLabel: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 4 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  chip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  chipText: { fontSize: 11, fontWeight: '700', color: BRAND_COLORS.blue600 },
  chipFull: { backgroundColor: 'rgba(16, 185, 129, 0.16)', alignSelf: 'flex-start' },
  chipFullText: { fontSize: 11, fontWeight: '800', color: '#059669' },
  posOnlyText: { fontSize: 12 },
  iconBtn: { padding: 8, borderRadius: 10, backgroundColor: 'rgba(100, 116, 139, 0.12)' },
  emptyCard: { alignItems: 'center', marginTop: 24, borderWidth: 1, borderRadius: 18, padding: 24 },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(37, 99, 235, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyTitle: { fontSize: 16, fontWeight: '800', textAlign: 'center' },
  emptySub: { fontSize: 13, textAlign: 'center', marginTop: 6, lineHeight: 18 },
  emptyAddBtn: {
    marginTop: 16,
    backgroundColor: BRAND_COLORS.navyInk,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  modalSafeArea: { flex: 1 },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sheetTitle: { fontSize: 20, fontWeight: '900', flex: 1, marginRight: 12 },
  sheetCloseBtn: { padding: 4 },
  sheetBody: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 24 },
  label: { fontSize: 12, fontWeight: '700', marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: 12, padding: 12, fontSize: 14, marginBottom: 14 },
  roleRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  roleCard: { flex: 1, borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 12 },
  roleCardTitle: { fontSize: 14, fontWeight: '800' },
  roleCardHint: { fontSize: 11, marginTop: 4, lineHeight: 15 },
  permHeader: { flexDirection: 'row', alignItems: 'center', marginTop: 18, marginBottom: 10 },
  permList: { borderWidth: 1, borderRadius: 14, overflow: 'hidden' },
  permRow: { flexDirection: 'row', alignItems: 'center', padding: 12 },
  permLabel: { fontSize: 13, fontWeight: '700' },
  permHint: { fontSize: 11, marginTop: 2, lineHeight: 15 },
  adminNote: { marginTop: 16, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 12 },
  submitBtn: {
    backgroundColor: BRAND_COLORS.navyInk,
    borderRadius: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 30,
  },
  submitBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },
});
