import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  useColorScheme,
  Animated,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Store, ChevronRight, MapPin, Phone, FileText } from 'lucide-react-native';
import { Colors } from '@/constants/theme';
import { useShopStore } from '@/store/useShopStore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function StoreSetup() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile, updateProfile, mode, completeOnboarding } = useShopStore();

  const [name, setName] = useState(profile.name || '');
  const [address, setAddress] = useState(profile.address || '');
  const [phone, setPhone] = useState(profile.phone || '');
  const [taxId, setTaxId] = useState(profile.taxId || '');

  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
  }, []);

  const handleFinish = async () => {
    await updateProfile({ ...profile, name: name.trim() || 'My Shop', address, phone, taxId });
    await completeOnboarding();
    // Navigate to main app — the layout will now show AppTabs
    router.replace('/');
  };

  const inputStyle = (value: string) => [
    styles.input,
    {
      backgroundColor: colors.surface,
      borderColor: value ? colors.primary + '40' : colors.border,
      color: colors.text,
    },
  ];

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View style={{ opacity: fadeAnim }}>
          <Text style={[styles.step, { color: colors.textSecondary }]}>Step 2 of 3 — Almost there!</Text>
          <Text style={[styles.title, { color: colors.text }]}>Set up your store</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            This info appears on your printed receipts. You can edit it anytime in Settings.
          </Text>

          {/* Store icon */}
          <View style={[styles.iconWrap, { backgroundColor: colors.primary + '12' }]}>
            <Store size={36} color={colors.primary} strokeWidth={1.5} />
          </View>

          {/* Form fields */}
          <View style={styles.formGroup}>
            <View style={styles.labelRow}>
              <Store size={16} color={colors.textSecondary} />
              <Text style={[styles.label, { color: colors.textSecondary }]}>Store Name *</Text>
            </View>
            <TextInput
              style={inputStyle(name)}
              value={name}
              onChangeText={setName}
              placeholder="e.g., Rishi's Parking"
              placeholderTextColor={colors.neutral}
            />
          </View>

          <View style={styles.formGroup}>
            <View style={styles.labelRow}>
              <MapPin size={16} color={colors.textSecondary} />
              <Text style={[styles.label, { color: colors.textSecondary }]}>Address</Text>
            </View>
            <TextInput
              style={inputStyle(address)}
              value={address}
              onChangeText={setAddress}
              placeholder="123 Market Road, City"
              placeholderTextColor={colors.neutral}
            />
          </View>

          <View style={styles.formGroup}>
            <View style={styles.labelRow}>
              <Phone size={16} color={colors.textSecondary} />
              <Text style={[styles.label, { color: colors.textSecondary }]}>Phone</Text>
            </View>
            <TextInput
              style={inputStyle(phone)}
              value={phone}
              onChangeText={setPhone}
              placeholder="+91 98765 43210"
              placeholderTextColor={colors.neutral}
              keyboardType="phone-pad"
            />
          </View>

          <View style={styles.formGroup}>
            <View style={styles.labelRow}>
              <FileText size={16} color={colors.textSecondary} />
              <Text style={[styles.label, { color: colors.textSecondary }]}>Tax ID / GSTIN</Text>
            </View>
            <TextInput
              style={inputStyle(taxId)}
              value={taxId}
              onChangeText={setTaxId}
              placeholder="GSTIN1234567890"
              placeholderTextColor={colors.neutral}
              autoCapitalize="characters"
            />
          </View>

          {/* Mode badge */}
          <View style={[styles.modeBadge, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modeBadgeLabel, { color: colors.textSecondary }]}>Selected mode:</Text>
            <Text style={[styles.modeBadgeValue, { color: colors.primary }]}>
              {mode === 'fixed' ? '⚡ Fixed-Price' : mode === 'product' ? '🛒 Product-Based' : '🔀 Hybrid'}
            </Text>
          </View>
        </Animated.View>
      </ScrollView>

      {/* CTA */}
      <View style={[styles.ctaWrap, { paddingBottom: insets.bottom + 24, backgroundColor: colors.background }]}>
        <TouchableOpacity
          activeOpacity={0.85}
          disabled={!name.trim()}
          style={[styles.ctaButton, { backgroundColor: name.trim() ? colors.primary : colors.neutral, opacity: name.trim() ? 1 : 0.5 }]}
          onPress={handleFinish}
        >
          <Text style={styles.ctaText}>Finish Setup & Start</Text>
          <ChevronRight size={20} color="#FFF" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.skipBtn} onPress={handleFinish}>
          <Text style={[styles.skipText, { color: colors.textSecondary }]}>Skip for now</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: 24 },
  step: { fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
  title: { fontSize: 28, fontWeight: '800', lineHeight: 36, letterSpacing: -0.3 },
  subtitle: { fontSize: 15, lineHeight: 22, marginTop: 8 },
  iconWrap: { width: 72, height: 72, borderRadius: 20, justifyContent: 'center', alignItems: 'center', alignSelf: 'center', marginTop: 28, marginBottom: 28 },
  formGroup: { marginBottom: 18 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  label: { fontSize: 14, fontWeight: '600' },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16 },
  modeBadge: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 14, borderRadius: 12, marginTop: 12 },
  modeBadgeLabel: { fontSize: 14 },
  modeBadgeValue: { fontSize: 14, fontWeight: '700' },
  ctaWrap: { paddingHorizontal: 24, paddingTop: 16 },
  ctaButton: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, paddingVertical: 16, borderRadius: 16, elevation: 4, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
  ctaText: { color: '#FFF', fontSize: 17, fontWeight: '700' },
  skipBtn: { alignItems: 'center', paddingVertical: 12 },
  skipText: { fontSize: 15, fontWeight: '500' },
});
