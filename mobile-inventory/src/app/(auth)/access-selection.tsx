import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
  StyleSheet,
  StatusBar,
} from 'react-native';
import { ShieldCheck, UserCheck, ArrowRight, Shield } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { BRAND_COLORS } from '@/constants/theme';
import { useAppTheme } from '@/hooks/useAppTheme';
import { ScreenBackground } from '@/components/ui/ScreenBackground';

export default function AccessSelectionScreen() {
  const router = useRouter();

  const [selectedRole, setSelectedRole] = useState<'admin' | 'agent'>('admin');

  const theme = useAppTheme();
  const isDark = theme.isDark;

  const handleContinue = () => {
    router.replace('/(tabs)');
  };

  return (
    <ScreenBackground color={theme.bg}>
    <SafeAreaView style={[styles.container, { backgroundColor: 'transparent' }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={theme.bg} />
      <View style={styles.mainWrapper}>
        {/* Header */}
        <View style={styles.headerBox}>
          <View style={styles.iconCircle}>
            <ShieldCheck size={36} color="#FFFFFF" />
          </View>
          <Text style={[styles.title, { color: theme.textPrimary }]}>Choose Account Role</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            Select your operating role for Seznik POS
          </Text>
        </View>

        {/* Role Options */}
        <View style={styles.rolesRow}>
          {/* Admin Role Card */}
          <TouchableOpacity
            onPress={() => setSelectedRole('admin')}
            style={[
              styles.roleCard,
              {
                backgroundColor: theme.cardBg,
                borderColor: selectedRole === 'admin' ? BRAND_COLORS.blue600 : theme.borderColor,
              },
            ]}
          >
            <View style={[styles.cardIconBox, { backgroundColor: 'rgba(37, 99, 235, 0.15)' }]}>
              <Shield size={24} color={BRAND_COLORS.blue600} />
            </View>
            <Text style={[styles.roleTitle, { color: theme.textPrimary }]}>Store Owner / Admin</Text>
            <Text style={[styles.roleDesc, { color: theme.textSecondary }]}>
              Full access to inventory, sales, financial reports & staff permissions
            </Text>
          </TouchableOpacity>

          {/* Agent Role Card */}
          <TouchableOpacity
            onPress={() => setSelectedRole('agent')}
            style={[
              styles.roleCard,
              {
                backgroundColor: theme.cardBg,
                borderColor: selectedRole === 'agent' ? BRAND_COLORS.sky500 : theme.borderColor,
              },
            ]}
          >
            <View style={[styles.cardIconBox, { backgroundColor: 'rgba(2, 132, 199, 0.15)' }]}>
              <UserCheck size={24} color={BRAND_COLORS.sky500} />
            </View>
            <Text style={[styles.roleTitle, { color: theme.textPrimary }]}>Staff / Cashier Agent</Text>
            <Text style={[styles.roleDesc, { color: theme.textSecondary }]}>
              Optimized for fast POS sales checkout with restricted permission flags
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={handleContinue} style={styles.continueBtn}>
          <Text style={styles.continueBtnText}>Continue to POS</Text>
          <ArrowRight size={18} color="#FFFFFF" style={{ marginLeft: 8 }} />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  mainWrapper: { flex: 1, padding: 24, justifyContent: 'center' },
  headerBox: { alignItems: 'center', marginBottom: 32 },
  iconCircle: { width: 64, height: 64, borderRadius: 20, backgroundColor: BRAND_COLORS.navyInk, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  title: { fontSize: 24, fontWeight: '900', textAlign: 'center' },
  subtitle: { fontSize: 13, marginTop: 4, textAlign: 'center' },
  rolesRow: { marginBottom: 32 },
  roleCard: { borderRadius: 20, padding: 20, borderWidth: 2, marginBottom: 16 },
  cardIconBox: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  roleTitle: { fontSize: 16, fontWeight: '800', marginBottom: 4 },
  roleDesc: { fontSize: 12, lineHeight: 18 },
  continueBtn: { backgroundColor: BRAND_COLORS.navyInk, borderRadius: 16, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  continueBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },
});
