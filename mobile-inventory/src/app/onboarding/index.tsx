import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  StyleSheet,
  StatusBar,
} from 'react-native';
import { Store, Layers, ArrowRight, Check } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { BRAND_COLORS } from '@/constants/theme';
import { useAppTheme } from '@/hooks/useAppTheme';
import { ScreenBackground } from '@/components/ui/ScreenBackground';
import { KeyboardAvoidingWrapper } from '@/components/ui/KeyboardAvoidingWrapper';

export default function OnboardingScreen() {
  const router = useRouter();

  const [step, setStep] = useState<1 | 2>(1);
  const [businessName, setBusinessName] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Grocery & Supermarket');

  const categories = [
    'Grocery & Supermarket',
    'Clothing & Apparel',
    'Electronics & Mobile',
    'Pharmacy & Medical',
    'Restaurant & Cafe',
    'General Retail',
  ];

  const theme = useAppTheme();
  const isDark = theme.isDark;

  const handleNext = () => {
    if (step === 1) {
      setStep(2);
    } else {
      router.replace('/(auth)/access-selection');
    }
  };

  const handleSkip = () => {
    router.replace('/(auth)/access-selection');
  };

  return (
    <ScreenBackground color={theme.bg}>
    <SafeAreaView style={[styles.container, { backgroundColor: 'transparent' }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={theme.bg} />
      <KeyboardAvoidingWrapper>
      <View style={styles.mainWrapper}>
        <View style={styles.topRow}>
          <Text style={styles.stepIndicator}>Step {step} of 2</Text>
          <TouchableOpacity onPress={handleSkip}>
            <Text style={styles.skipText}>Skip Onboarding</Text>
          </TouchableOpacity>
        </View>

        {step === 1 ? (
          <View style={styles.stepBox}>
            <View style={styles.iconCircle}>
              <Store size={32} color="#FFFFFF" />
            </View>
            <Text style={[styles.title, { color: theme.textPrimary }]}>What is your business name?</Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
              This will appear on your receipts and customer invoices
            </Text>

            <TextInput
              style={[styles.input, { backgroundColor: theme.cardBg, borderColor: theme.borderColor, color: theme.textPrimary }]}
              value={businessName}
              onChangeText={setBusinessName}
              placeholder="e.g. Seznik Supermarket"
              placeholderTextColor="#94A3B8"
            />
          </View>
        ) : (
          <View style={styles.stepBox}>
            <View style={styles.iconCircle}>
              <Layers size={32} color="#FFFFFF" />
            </View>
            <Text style={[styles.title, { color: theme.textPrimary }]}>Select Store Category</Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
              Pre-configures relevant units and GST tax slabs for your store
            </Text>

            <View style={styles.catGrid}>
              {categories.map((cat) => {
                const selected = selectedCategory === cat;
                return (
                  <TouchableOpacity
                    key={cat}
                    onPress={() => setSelectedCategory(cat)}
                    style={[
                      styles.catChip,
                      {
                        backgroundColor: selected ? 'rgba(37, 99, 235, 0.15)' : theme.cardBg,
                        borderColor: selected ? BRAND_COLORS.blue600 : theme.borderColor,
                      },
                    ]}
                  >
                    <Text style={[styles.catChipText, { color: selected ? BRAND_COLORS.blue600 : theme.textPrimary }]}>
                      {cat}
                    </Text>
                    {selected ? <Check size={16} color={BRAND_COLORS.blue600} /> : null}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        <TouchableOpacity onPress={handleNext} style={styles.nextBtn}>
          <Text style={styles.nextBtnText}>{step === 1 ? 'Next Step' : 'Finish & Continue'}</Text>
          <ArrowRight size={18} color="#FFFFFF" style={{ marginLeft: 8 }} />
        </TouchableOpacity>
      </View>
      </KeyboardAvoidingWrapper>
    </SafeAreaView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  mainWrapper: { flex: 1, padding: 24, justifyContent: 'space-between' },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  stepIndicator: { fontSize: 12, fontWeight: '800', color: BRAND_COLORS.sky500, textTransform: 'uppercase' },
  skipText: { fontSize: 13, fontWeight: '700', color: '#94A3B8' },
  stepBox: { marginTop: 20 },
  iconCircle: { width: 58, height: 58, borderRadius: 18, backgroundColor: BRAND_COLORS.navyInk, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  title: { fontSize: 22, fontWeight: '900', marginBottom: 6 },
  subtitle: { fontSize: 13, marginBottom: 24 },
  input: { borderWidth: 1, borderRadius: 14, padding: 14, fontSize: 15 },
  catGrid: { marginTop: 8 },
  catChip: { padding: 14, borderRadius: 14, borderWidth: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  catChipText: { fontSize: 14, fontWeight: '700' },
  nextBtn: { backgroundColor: BRAND_COLORS.navyInk, borderRadius: 16, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  nextBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },
});
