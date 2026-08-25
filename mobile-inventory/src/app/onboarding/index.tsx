import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  StyleSheet,
  StatusBar,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Store, Layers, ArrowRight, Check } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { BRAND_COLORS } from '@/constants/theme';
import { useAppTheme } from '@/hooks/useAppTheme';
import { ScreenBackground } from '@/components/ui/ScreenBackground';
import { KeyboardAvoidingWrapper } from '@/components/ui/KeyboardAvoidingWrapper';
import { BUSINESS_TYPE_OPTIONS, BusinessType } from '@/constants/businessTypes';
import { useAuth } from '@/hooks/useAuth';

export default function OnboardingScreen() {
  const router = useRouter();
  const { completeOnboarding, isCompletingOnboarding } = useAuth();

  const [step, setStep] = useState<1 | 2>(1);
  const [businessName, setBusinessName] = useState('');
  const [selectedBusinessType, setSelectedBusinessType] = useState<BusinessType>('retail_shop');

  const theme = useAppTheme();
  const isDark = theme.isDark;

  const handleNext = async () => {
    const trimmedName = businessName.trim();
    if (step === 1) {
      if (!trimmedName) {
        Alert.alert('Business name required', 'Please enter your business name to continue.');
        return;
      }
      setStep(2);
      return;
    }

    try {
      await completeOnboarding({
        businessName: trimmedName,
        businessType: selectedBusinessType,
      });
      router.replace('/');
    } catch (err: any) {
      Alert.alert('Setup failed', err?.message || 'Could not save your business profile. Please try again.');
    }
  };

  return (
    <ScreenBackground color={theme.bg}>
      <SafeAreaView style={[styles.container, { backgroundColor: 'transparent' }]}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={theme.bg} />
        <KeyboardAvoidingWrapper>
          <View style={styles.mainWrapper}>
            <View style={styles.topRow}>
              <Text style={styles.stepIndicator}>Step {step} of 2</Text>
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
                  style={[
                    styles.input,
                    {
                      backgroundColor: theme.cardBg,
                      borderColor: theme.borderColor,
                      color: theme.textPrimary,
                    },
                  ]}
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
                <Text style={[styles.title, { color: theme.textPrimary }]}>What type of business do you run?</Text>
                <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
                  We will tailor your app navigation to match how you sell
                </Text>

                <View style={styles.catGrid}>
                  {BUSINESS_TYPE_OPTIONS.map((option) => {
                    const selected = selectedBusinessType === option.id;
                    return (
                      <TouchableOpacity
                        key={option.id}
                        onPress={() => setSelectedBusinessType(option.id)}
                        style={[
                          styles.catChip,
                          {
                            backgroundColor: selected ? 'rgba(37, 99, 235, 0.15)' : theme.cardBg,
                            borderColor: selected ? BRAND_COLORS.blue600 : theme.borderColor,
                          },
                        ]}
                      >
                        <View style={styles.optionTextWrap}>
                          <Text style={styles.optionEmoji}>{option.emoji}</Text>
                          <View style={{ flex: 1 }}>
                            <Text
                              style={[
                                styles.catChipText,
                                { color: selected ? BRAND_COLORS.blue600 : theme.textPrimary },
                              ]}
                            >
                              {option.label}
                            </Text>
                            <Text style={[styles.optionDescription, { color: theme.textSecondary }]}>
                              {option.description}
                            </Text>
                          </View>
                        </View>
                        {selected ? <Check size={16} color={BRAND_COLORS.blue600} /> : null}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            <TouchableOpacity
              onPress={handleNext}
              style={[styles.nextBtn, isCompletingOnboarding && styles.nextBtnDisabled]}
              disabled={isCompletingOnboarding}
            >
              {isCompletingOnboarding ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Text style={styles.nextBtnText}>{step === 1 ? 'Next Step' : 'Finish & Continue'}</Text>
                  <ArrowRight size={18} color="#FFFFFF" style={{ marginLeft: 8 }} />
                </>
              )}
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
  stepBox: { marginTop: 20 },
  iconCircle: {
    width: 58,
    height: 58,
    borderRadius: 18,
    backgroundColor: BRAND_COLORS.navyInk,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: { fontSize: 22, fontWeight: '900', marginBottom: 6 },
  subtitle: { fontSize: 13, marginBottom: 24 },
  input: { borderWidth: 1, borderRadius: 14, padding: 14, fontSize: 15 },
  catGrid: { marginTop: 8 },
  catChip: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  optionTextWrap: { flexDirection: 'row', alignItems: 'center', flex: 1, paddingRight: 8 },
  optionEmoji: { fontSize: 22, marginRight: 12 },
  catChipText: { fontSize: 14, fontWeight: '800', marginBottom: 2 },
  optionDescription: { fontSize: 11, lineHeight: 15 },
  nextBtn: {
    backgroundColor: BRAND_COLORS.navyInk,
    borderRadius: 16,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  nextBtnDisabled: { opacity: 0.7 },
  nextBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },
});
