import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
  StyleSheet,
  StatusBar,
  ActivityIndicator,
  TextInput,
  Alert,
  ScrollView,
  Modal,
} from 'react-native';
import {
  ShieldCheck,
  UserCheck,
  ArrowRight,
  Shield,
  Lock,
  ChevronDown,
  CheckCircle2,
  X,
  LogOut,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { BRAND_COLORS } from '@/constants/theme';
import { useAppTheme } from '@/hooks/useAppTheme';
import { ScreenBackground } from '@/components/ui/ScreenBackground';
import { useAuthStore } from '@/store/useAuthStore';
import { authApi } from '@/api/auth';
import { UserProfile } from '@/types/auth';
import { sanitizeErrorMessage } from '@/utils/errorHandler';

export default function AccessSelectionScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const isDark = theme.isDark;

  const { user, setUserRole, logout } = useAuthStore();

  const [selectedRole, setSelectedRole] = useState<'admin' | 'agent' | null>(null);
  const [agents, setAgents] = useState<(UserProfile & { uid?: string })[]>([]);
  const [isLoadingAgents, setIsLoadingAgents] = useState(true);
  const [selectedAgentUid, setSelectedAgentUid] = useState<string>('');
  const [password, setPassword] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAgentPicker, setShowAgentPicker] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const loadAgents = async () => {
      try {
        const list = await authApi.getAllUsers(user?.id);
        if (isMounted) {
          const agentList = ((list || []) as (UserProfile & { uid?: string })[]).filter((u) => u.role === 'agent');
          setAgents(agentList);
          if (agentList.length > 0) {
            setSelectedAgentUid(agentList[0].uid || agentList[0].id || '');
          }
        }
      } catch (err) {
        console.warn('Could not load agents list:', err);
      } finally {
        if (isMounted) setIsLoadingAgents(false);
      }
    };

    loadAgents();
    return () => {
      isMounted = false;
    };
  }, [user]);

  const isCurrentUserAgent = user?.role === 'agent';
  const hasAgents = isCurrentUserAgent || agents.length > 0;

  const handleRoleCardClick = (role: 'admin' | 'agent') => {
    if (role === 'admin' && user?.role === 'agent') {
      Alert.alert(
        'Access Restricted',
        'Your current session is an Agent account. To access Store Admin, please log in with your primary Store Owner credentials.'
      );
      return;
    }

    if (role === 'agent' && !hasAgents) {
      Alert.alert(
        'No Agent Accounts Found',
        'Agent workstation is currently unavailable because no agent profiles have been created yet.\n\nPlease log in as Admin first, then create staff accounts under Settings > Staff & Permissions.'
      );
      return;
    }

    setSelectedRole(role);
    setPassword('');
    setIsModalOpen(true);
  };

  const handleConfirmRole = async () => {
    if (!password.trim()) {
      Alert.alert('Password Required', 'Please enter your password to confirm authentication.');
      return;
    }

    if (selectedRole === 'agent' && !isCurrentUserAgent && !selectedAgentUid) {
      Alert.alert('Select Agent', 'Please select an agent profile from the list.');
      return;
    }

    setIsSubmitting(true);
    try {
      await setUserRole(
        selectedRole as 'admin' | 'agent',
        password,
        selectedRole === 'agent' && !isCurrentUserAgent ? selectedAgentUid : undefined
      );

      setIsModalOpen(false);
      router.replace('/(tabs)');
    } catch (err: any) {
      console.error('Role confirmation error:', err);
      Alert.alert(
        'Authentication Failed',
        sanitizeErrorMessage(err, 'Invalid password or role assignment. Please try again.')
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedAgent = agents.find((a) => (a.uid || a.id) === selectedAgentUid) || agents[0];

  return (
    <ScreenBackground color={theme.bg}>
      <SafeAreaView style={[styles.container, { backgroundColor: 'transparent' }]}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={theme.bg} />
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Header */}
          <View style={styles.headerBox}>
            <View style={[styles.iconCircle, { backgroundColor: BRAND_COLORS.navyInk }]}>
              <ShieldCheck size={36} color="#FFFFFF" />
            </View>
            <Text style={[styles.title, { color: theme.textPrimary }]}>Choose Workstation Role</Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
              Select your access privileges for Seznik POS
            </Text>
          </View>

          {/* Role Cards */}
          <View style={styles.rolesRow}>
            {/* Admin Role Card */}
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => handleRoleCardClick('admin')}
              style={[
                styles.roleCard,
                {
                  backgroundColor: theme.cardBg,
                  borderColor: user?.role === 'admin' ? '#10B981' : theme.borderColor,
                },
              ]}
            >
              <View style={styles.cardHeaderRow}>
                <View style={[styles.cardIconBox, { backgroundColor: 'rgba(37, 99, 235, 0.15)' }]}>
                  <Shield size={24} color={BRAND_COLORS.blue600} />
                </View>
                <View style={styles.badgeWrap}>
                  <View style={[styles.roleBadge, { backgroundColor: 'rgba(37, 99, 235, 0.12)' }]}>
                    <Text style={[styles.roleBadgeText, { color: BRAND_COLORS.blue600 }]}>STORE OWNER</Text>
                  </View>
                </View>
              </View>

              <Text style={[styles.roleTitle, { color: theme.textPrimary }]}>Store Owner / Admin</Text>
              <Text style={[styles.roleDesc, { color: theme.textSecondary }]}>
                Full privileges across catalog, live POS checkout, financial ledgers, P&L reports, and staff management.
              </Text>

              <View style={styles.cardFooter}>
                <Text style={[styles.cardActionText, { color: BRAND_COLORS.blue600 }]}>Enter as Admin</Text>
                <ArrowRight size={16} color={BRAND_COLORS.blue600} />
              </View>
            </TouchableOpacity>

            {/* Agent Role Card */}
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => handleRoleCardClick('agent')}
              style={[
                styles.roleCard,
                {
                  backgroundColor: theme.cardBg,
                  borderColor: user?.role === 'agent' ? '#10B981' : theme.borderColor,
                  opacity: hasAgents || isLoadingAgents ? 1 : 0.6,
                },
              ]}
            >
              <View style={styles.cardHeaderRow}>
                <View style={[styles.cardIconBox, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
                  <UserCheck size={24} color="#10B981" />
                </View>
                <View style={styles.badgeWrap}>
                  <View
                    style={[
                      styles.roleBadge,
                      { backgroundColor: hasAgents ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)' },
                    ]}
                  >
                    <Text style={[styles.roleBadgeText, { color: hasAgents ? '#10B981' : '#EF4444' }]}>
                      {hasAgents ? `${agents.length || 1} AGENTS READY` : 'DISABLED'}
                    </Text>
                  </View>
                </View>
              </View>

              <Text style={[styles.roleTitle, { color: theme.textPrimary }]}>Staff / Cashier Agent</Text>
              <Text style={[styles.roleDesc, { color: theme.textSecondary }]}>
                {hasAgents
                  ? 'Limited workstation access customized by your store admin with strict permission flags for sales & billings.'
                  : 'Agent access is currently disabled because no staff accounts exist yet. Create one under Admin Settings.'}
              </Text>

              <View style={styles.cardFooter}>
                <Text style={[styles.cardActionText, { color: hasAgents ? '#10B981' : theme.textSecondary }]}>
                  {hasAgents ? 'Enter as Agent' : 'Create Agent Account'}
                </Text>
                <ArrowRight size={16} color={hasAgents ? '#10B981' : theme.textSecondary} />
              </View>
            </TouchableOpacity>
          </View>

          {/* Logout Button */}
          <TouchableOpacity
            onPress={async () => {
              await logout();
              router.replace('/(auth)/login');
            }}
            style={styles.logoutBtn}
          >
            <LogOut size={16} color={theme.textSecondary} style={{ marginRight: 8 }} />
            <Text style={[styles.logoutText, { color: theme.textSecondary }]}>Log Out to Switch Store Account</Text>
          </TouchableOpacity>
        </ScrollView>

        {/* PASSWORD / AGENT SELECTION MODAL */}
        <Modal visible={isModalOpen} transparent animationType="slide" onRequestClose={() => setIsModalOpen(false)}>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: theme.cardBg }]}>
              {/* Header */}
              <View style={styles.modalHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Lock size={20} color={selectedRole === 'admin' ? BRAND_COLORS.blue600 : '#10B981'} style={{ marginRight: 8 }} />
                  <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>
                    {selectedRole === 'admin' ? 'Admin Verification' : 'Agent Workstation Login'}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setIsModalOpen(false)} style={styles.modalCloseBtn}>
                  <X size={20} color={theme.textSecondary} />
                </TouchableOpacity>
              </View>

              {/* Agent Picker Dropdown (If Agent Role) */}
              {selectedRole === 'agent' && !isCurrentUserAgent && agents.length > 0 && (
                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Select Agent Profile</Text>
                  <TouchableOpacity
                    onPress={() => setShowAgentPicker(!showAgentPicker)}
                    style={[styles.agentDropdown, { borderColor: theme.borderColor, backgroundColor: theme.bg }]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.agentName, { color: theme.textPrimary }]}>
                        {selectedAgent?.displayName || selectedAgent?.email || 'Select Agent'}
                      </Text>
                      {selectedAgent?.email ? (
                        <Text style={[styles.agentEmail, { color: theme.textSecondary }]}>{selectedAgent.email}</Text>
                      ) : null}
                    </View>
                    <ChevronDown size={18} color={theme.textSecondary} />
                  </TouchableOpacity>

                  {/* Agent List Dropdown Options */}
                  {showAgentPicker && (
                    <View style={[styles.dropdownList, { backgroundColor: theme.bg, borderColor: theme.borderColor }]}>
                      {agents.map((ag) => {
                        const uid = ag.uid || ag.id || '';
                        const isThis = uid === selectedAgentUid;
                        return (
                          <TouchableOpacity
                            key={uid}
                            onPress={() => {
                              setSelectedAgentUid(uid);
                              setShowAgentPicker(false);
                            }}
                            style={[
                              styles.dropdownItem,
                              { backgroundColor: isThis ? (isDark ? '#1E293B' : '#F1F5F9') : 'transparent' },
                            ]}
                          >
                            <View style={{ flex: 1 }}>
                              <Text style={[styles.agentName, { color: theme.textPrimary }]}>
                                {ag.displayName || ag.email}
                              </Text>
                              {ag.email ? (
                                <Text style={[styles.agentEmail, { color: theme.textSecondary }]}>{ag.email}</Text>
                              ) : null}
                            </View>
                            {isThis && <CheckCircle2 size={16} color="#10B981" />}
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}
                </View>
              )}

              {/* Password Input */}
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>
                  {selectedRole === 'admin' ? 'Store Admin Password' : 'Agent Password'}
                </Text>
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Enter account password"
                  placeholderTextColor={theme.textSecondary}
                  secureTextEntry
                  style={[
                    styles.passwordInput,
                    {
                      backgroundColor: theme.bg,
                      borderColor: theme.borderColor,
                      color: theme.textPrimary,
                    },
                  ]}
                />
              </View>

              {/* Confirm Button */}
              <TouchableOpacity
                onPress={handleConfirmRole}
                disabled={isSubmitting}
                style={[
                  styles.confirmBtn,
                  {
                    backgroundColor: selectedRole === 'admin' ? BRAND_COLORS.blue600 : '#10B981',
                    opacity: isSubmitting ? 0.7 : 1,
                  },
                ]}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Text style={styles.confirmBtnText}>
                      {selectedRole === 'admin' ? 'Verify & Enter as Admin' : 'Login as Agent'}
                    </Text>
                    <ArrowRight size={18} color="#FFFFFF" style={{ marginLeft: 8 }} />
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 24, justifyContent: 'center', minHeight: '100%' },
  headerBox: { alignItems: 'center', marginBottom: 28 },
  iconCircle: { width: 64, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  title: { fontSize: 24, fontWeight: '900', textAlign: 'center' },
  subtitle: { fontSize: 13, marginTop: 4, textAlign: 'center' },
  rolesRow: { marginBottom: 24 },
  roleCard: { borderRadius: 20, padding: 20, borderWidth: 2, marginBottom: 16 },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  cardIconBox: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  badgeWrap: {},
  roleBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  roleBadgeText: { fontSize: 10, fontWeight: '800' },
  roleTitle: { fontSize: 17, fontWeight: '800', marginBottom: 6 },
  roleDesc: { fontSize: 12, lineHeight: 18, marginBottom: 16 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(150, 150, 150, 0.1)' },
  cardActionText: { fontSize: 13, fontWeight: '800' },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12 },
  logoutText: { fontSize: 12, fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.65)', justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 17, fontWeight: '800' },
  modalCloseBtn: { padding: 4 },
  inputGroup: { marginBottom: 16 },
  inputLabel: { fontSize: 12, fontWeight: '700', marginBottom: 6 },
  agentDropdown: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12 },
  agentName: { fontSize: 14, fontWeight: '700' },
  agentEmail: { fontSize: 11, marginTop: 2 },
  dropdownList: { borderWidth: 1, borderRadius: 12, marginTop: 6, overflow: 'hidden' },
  dropdownItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(150, 150, 150, 0.15)' },
  passwordInput: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14 },
  confirmBtn: { borderRadius: 14, paddingVertical: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  confirmBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },
});
