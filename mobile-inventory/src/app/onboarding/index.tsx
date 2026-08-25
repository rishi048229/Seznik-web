import React, { useMemo, useState } from 'react';
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
  ScrollView,
  Image,
} from 'react-native';
import { Store, Layers, ArrowRight, ArrowLeft, Check, ImageIcon } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { BRAND_COLORS } from '@/constants/theme';
import { useAppTheme } from '@/hooks/useAppTheme';
import { ScreenBackground } from '@/components/ui/ScreenBackground';
import { KeyboardAvoidingWrapper } from '@/components/ui/KeyboardAvoidingWrapper';
import {
  BUSINESS_TEMPLATES,
  BUSINESS_TYPE_OPTIONS,
  BusinessType,
} from '@/constants/businessTypes';
import { SUPPORTED_LANGUAGES, LanguageCode } from '@/constants/translations';
import { useTranslation } from '@/store/useLanguageStore';
import { persistBusinessLogo } from '@/utils/businessLogoStorage';
import { useAuth } from '@/hooks/useAuth';

export default function OnboardingScreen() {
  const router = useRouter();
  const {
    user,
    completeOnboarding,
    isCompletingOnboarding,
    updateBusinessType,
    isUpdatingBusinessType,
  } = useAuth();
  const { currentLanguage, setLanguage } = useTranslation();

  const pickTypeOnly = user?.onboardingCompleted === true && !user?.businessType;

  const [step, setStep] = useState<1 | 2>(1);
  const [businessName, setBusinessName] = useState(user?.businessName ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [businessAddress, setBusinessAddress] = useState('');
  const [selectedBusinessType, setSelectedBusinessType] = useState<BusinessType>(
    user?.businessType ?? 'retail_shop'
  );
  const [logoUri, setLogoUri] = useState<string | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState<LanguageCode>(currentLanguage);

  const theme = useAppTheme();
  const isDark = theme.isDark;
  const isSaving = isCompletingOnboarding || isUpdatingBusinessType;
  const template = BUSINESS_TEMPLATES[selectedBusinessType];
  const selectedLabel = useMemo(
    () => BUSINESS_TYPE_OPTIONS.find((option) => option.id === selectedBusinessType)?.label,
    [selectedBusinessType]
  );

  const validateShopDetails = () => {
    if (!businessName.trim()) {
      Alert.alert('Shop name required', 'Please enter the name of your shop to continue.');
      return false;
    }
    if (!phone.trim()) {
      Alert.alert('Phone number required', 'Please enter a phone number for your shop.');
      return false;
    }
    if (!businessAddress.trim()) {
      Alert.alert('Shop address required', 'Please enter your shop address to continue.');
      return false;
    }
    return true;
  };

  const handlePickLogo = async () => {
    const permResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permResult.granted) {
      Alert.alert('Permission needed', 'Allow photo library access to add your shop logo.');
      return;
    }
    const pickerResult = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      allowsEditing: true,
    });
    if (!pickerResult.canceled && pickerResult.assets[0]?.uri) {
      setLogoUri(pickerResult.assets[0].uri);
    }
  };

  const cacheLogoForLaterS3 = async (uri: string): Promise<string> => {
    const persisted = await persistBusinessLogo(uri);
    if (persisted.startsWith('data:')) return persisted;
    const base64 = await FileSystem.readAsStringAsync(persisted, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return `data:image/jpeg;base64,${base64}`;
  };

  const handleSelectLanguage = (code: LanguageCode) => {
    setSelectedLanguage(code);
    void setLanguage(code);
  };

  const handleNext = async () => {
    if (step === 1) {
      if (!pickTypeOnly && !validateShopDetails()) return;
      setStep(2);
      return;
    }

    try {
      await setLanguage(selectedLanguage);
      if (pickTypeOnly) {
        await updateBusinessType(selectedBusinessType);
      } else {
        let businessLogoURL: string | undefined;
        if (logoUri) {
          businessLogoURL = await cacheLogoForLaterS3(logoUri);
        }
        await completeOnboarding({
          businessName: businessName.trim(),
          businessType: selectedBusinessType,
          phone: phone.trim(),
          businessAddress: businessAddress.trim(),
          ...(businessLogoURL ? { businessLogoURL } : {}),
        });
      }
      router.replace('/');
    } catch (err: any) {
      Alert.alert(
        'Setup failed',
        err?.message || 'Could not save your business profile. Please try again.'
      );
    }
  };

  const inputStyle = [
    styles.input,
    {
      backgroundColor: theme.cardBg,
      borderColor: theme.borderColor,
      color: theme.textPrimary,
    },
  ];

  return (
    <ScreenBackground color={theme.bg}>
      <SafeAreaView style={[styles.container, { backgroundColor: 'transparent' }]}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={theme.bg} />
        <KeyboardAvoidingWrapper>
          <View style={styles.mainWrapper}>
            <View style={styles.topRow}>
              <Text style={styles.stepIndicator}>
                {pickTypeOnly ? 'Choose your workspace' : `Step ${step} of 2`}
              </Text>
              {step === 2 ? (
                <TouchableOpacity onPress={() => setStep(1)} hitSlop={12}>
                  <View style={styles.backRow}>
                    <ArrowLeft size={14} color={BRAND_COLORS.sky500} />
                    <Text style={styles.backText}>Change type</Text>
                  </View>
                </TouchableOpacity>
              ) : null}
            </View>

            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {step === 1 ? (
                <View style={styles.stepBox}>
                  <View style={styles.iconCircle}>
                    <Store size={32} color="#FFFFFF" />
                  </View>
                  <Text style={[styles.title, { color: theme.textPrimary }]}>
                    {pickTypeOnly ? 'What type of business do you run?' : 'Enter your shop details'}
                  </Text>
                  <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
                    {pickTypeOnly
                      ? 'We will tailor your dashboard to kitchen service or general retail.'
                      : 'This information appears on receipts and personalizes your workspace.'}
                  </Text>

                  {pickTypeOnly ? (
                    <>
                      <BusinessTypePicker
                        selectedBusinessType={selectedBusinessType}
                        onSelect={setSelectedBusinessType}
                        theme={theme}
                      />
                      <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>
                        App language
                      </Text>
                      <LanguagePicker
                        selectedLanguage={selectedLanguage}
                        onSelect={handleSelectLanguage}
                        theme={theme}
                      />
                    </>
                  ) : (
                    <>
                      <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>
                        Name of shop *
                      </Text>
                      <TextInput
                        style={inputStyle}
                        value={businessName}
                        onChangeText={setBusinessName}
                        placeholder="e.g. Seznik Cafe"
                        placeholderTextColor="#94A3B8"
                        autoCapitalize="words"
                      />

                      <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>
                        Shop logo
                      </Text>
                      <Text style={[styles.helperText, { color: theme.textSecondary }]}>
                        Optional — skip if you want to add it later.
                      </Text>
                      {logoUri ? (
                        <View style={styles.logoRow}>
                          <Image source={{ uri: logoUri }} style={styles.logoPreview} />
                          <View style={{ flex: 1 }}>
                            <TouchableOpacity onPress={handlePickLogo} style={styles.logoSecondaryBtn}>
                              <Text style={styles.logoSecondaryText}>Replace</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={() => setLogoUri(null)}
                              style={[styles.logoSecondaryBtn, { marginTop: 8 }]}
                            >
                              <Text style={[styles.logoSecondaryText, { color: '#EF4444' }]}>Remove</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      ) : (
                        <TouchableOpacity
                          onPress={handlePickLogo}
                          style={[
                            styles.logoPicker,
                            { backgroundColor: theme.cardBg, borderColor: theme.borderColor },
                          ]}
                        >
                          <ImageIcon size={22} color={theme.textSecondary} />
                          <Text style={[styles.logoPickerText, { color: theme.textSecondary }]}>
                            Tap to upload logo
                          </Text>
                        </TouchableOpacity>
                      )}

                      <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>
                        Phone number *
                      </Text>
                      <TextInput
                        style={inputStyle}
                        value={phone}
                        onChangeText={setPhone}
                        placeholder="e.g. 9876543210"
                        placeholderTextColor="#94A3B8"
                        keyboardType="phone-pad"
                      />

                      <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>
                        Shop address *
                      </Text>
                      <TextInput
                        style={[inputStyle, styles.multiline]}
                        value={businessAddress}
                        onChangeText={setBusinessAddress}
                        placeholder="Street, area, city"
                        placeholderTextColor="#94A3B8"
                        multiline
                      />

                      <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>
                        Type of business *
                      </Text>
                      <BusinessTypePicker
                        selectedBusinessType={selectedBusinessType}
                        onSelect={setSelectedBusinessType}
                        theme={theme}
                      />

                      <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>
                        App language
                      </Text>
                      <LanguagePicker
                        selectedLanguage={selectedLanguage}
                        onSelect={handleSelectLanguage}
                        theme={theme}
                      />
                    </>
                  )}
                </View>
              ) : (
                <View style={styles.stepBox}>
                  <View style={styles.iconCircle}>
                    <Layers size={32} color="#FFFFFF" />
                  </View>
                  <Text style={[styles.title, { color: theme.textPrimary }]}>
                    Your {selectedLabel} setup
                  </Text>
                  <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
                    Confirm this workspace. You can change business type later in Settings.
                  </Text>

                  <View
                    style={[
                      styles.templateCard,
                      {
                        backgroundColor: theme.cardBg,
                        borderColor: BRAND_COLORS.blue600,
                      },
                    ]}
                  >
                    <Text style={[styles.templateTitle, { color: theme.textPrimary }]}>
                      {template.title}
                    </Text>
                    <Text style={[styles.templateSubtitle, { color: theme.textSecondary }]}>
                      {template.subtitle}
                    </Text>
                    {template.features.map((feature) => (
                      <View key={feature} style={styles.featureRow}>
                        <Check size={14} color={BRAND_COLORS.blue600} />
                        <Text style={[styles.featureText, { color: theme.textPrimary }]}>
                          {feature}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}
            </ScrollView>

            <TouchableOpacity
              onPress={handleNext}
              style={[styles.nextBtn, isSaving && styles.nextBtnDisabled]}
              disabled={isSaving}
            >
              {isSaving ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Text style={styles.nextBtnText}>
                    {step === 1 ? 'Next Step' : 'Use this setup'}
                  </Text>
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

function LanguagePicker({
  selectedLanguage,
  onSelect,
  theme,
}: {
  selectedLanguage: LanguageCode;
  onSelect: (code: LanguageCode) => void;
  theme: { cardBg: string; borderColor: string; textPrimary: string; textSecondary: string };
}) {
  return (
    <View style={styles.langGrid}>
      {SUPPORTED_LANGUAGES.map((lang) => {
        const selected = selectedLanguage === lang.code;
        return (
          <TouchableOpacity
            key={lang.code}
            onPress={() => onSelect(lang.code)}
            style={[
              styles.langChip,
              {
                backgroundColor: selected ? 'rgba(37, 99, 235, 0.15)' : theme.cardBg,
                borderColor: selected ? BRAND_COLORS.blue600 : theme.borderColor,
              },
            ]}
          >
            <Text
              style={[
                styles.langChipText,
                { color: selected ? BRAND_COLORS.blue600 : theme.textPrimary },
              ]}
            >
              {lang.nativeName}
            </Text>
            <Text style={[styles.langChipSub, { color: theme.textSecondary }]}>{lang.name}</Text>
            {selected ? <Check size={14} color={BRAND_COLORS.blue600} /> : null}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function BusinessTypePicker({
  selectedBusinessType,
  onSelect,
  theme,
}: {
  selectedBusinessType: BusinessType;
  onSelect: (type: BusinessType) => void;
  theme: { cardBg: string; borderColor: string; textPrimary: string; textSecondary: string };
}) {
  return (
    <View style={styles.catGrid}>
      {BUSINESS_TYPE_OPTIONS.map((option) => {
        const selected = selectedBusinessType === option.id;
        return (
          <TouchableOpacity
            key={option.id}
            onPress={() => onSelect(option.id)}
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
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  mainWrapper: { flex: 1, padding: 24 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  stepIndicator: { fontSize: 12, fontWeight: '800', color: BRAND_COLORS.sky500, textTransform: 'uppercase' },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  backText: { fontSize: 12, fontWeight: '700', color: BRAND_COLORS.sky500 },
  scroll: { flex: 1, marginTop: 12 },
  scrollContent: { paddingBottom: 16 },
  stepBox: { marginTop: 8 },
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
  subtitle: { fontSize: 13, marginBottom: 20, lineHeight: 18 },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginBottom: 8,
    marginTop: 12,
  },
  input: { borderWidth: 1, borderRadius: 14, padding: 14, fontSize: 15 },
  multiline: { minHeight: 88, textAlignVertical: 'top' },
  catGrid: { marginTop: 4 },
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
  templateCard: {
    borderWidth: 2,
    borderRadius: 16,
    padding: 16,
  },
  templateTitle: { fontSize: 16, fontWeight: '800', marginBottom: 6 },
  templateSubtitle: { fontSize: 13, lineHeight: 18, marginBottom: 14 },
  featureRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 8 },
  featureText: { fontSize: 13, fontWeight: '600', flex: 1, lineHeight: 18 },
  nextBtn: {
    backgroundColor: BRAND_COLORS.navyInk,
    borderRadius: 16,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: 10,
  },
  nextBtnDisabled: { opacity: 0.7 },
  nextBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },
  helperText: { fontSize: 11, marginTop: -4, marginBottom: 8 },
  logoPicker: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 14,
    height: 88,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoPickerText: { fontSize: 12, fontWeight: '700', marginTop: 6 },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  logoPreview: { width: 72, height: 72, borderRadius: 14 },
  logoSecondaryBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(37, 99, 235, 0.08)',
    alignSelf: 'flex-start',
  },
  logoSecondaryText: { fontSize: 12, fontWeight: '700', color: BRAND_COLORS.blue600 },
  langGrid: { marginTop: 4 },
  langChip: {
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  langChipText: { fontSize: 14, fontWeight: '800', flex: 1 },
  langChipSub: { fontSize: 11, fontWeight: '600' },
});
