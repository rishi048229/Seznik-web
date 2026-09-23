import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Alert,
  Modal,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Eye,
  EyeOff,
  Lock,
  Mail,
  Server,
  ArrowRight,
  Globe,
  Check,
  X,
  QrCode,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { authApi } from '@/api/auth';
import { useAuthStore } from '@/store/useAuthStore';
import { useAppTheme } from '@/hooks/useAppTheme';
import { BRAND_COLORS } from '@/constants/theme';
import { ScreenBackground } from '@/components/ui/ScreenBackground';
import { getApiBaseUrl, setApiBaseUrl } from '@/api/client';
import { useTranslation } from '@/store/useLanguageStore';
import { SUPPORTED_LANGUAGES } from '@/constants/translations';
import { LoginQrScanner } from '@/components/auth/LoginQrScanner';

const loginSchema = z.object({
  email: z.string().min(1, 'Email or username is required'),
  password: z.string().min(1, 'Password is required'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const { t, currentLanguage, setLanguage } = useTranslation();
  const { login, isLoggingIn, loginWithQr, isLoggingInWithQr } = useAuth();
  const setAuth = useAuthStore((s) => s.setAuth);

  const [showPassword, setShowPassword] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [showApiConfig, setShowApiConfig] = useState(false);
  const [showLangModal, setShowLangModal] = useState(false);
  const [showQrScanner, setShowQrScanner] = useState(false);
  const [baseUrlInput, setBaseUrlInput] = useState(getApiBaseUrl());

  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  const currentLangObj = SUPPORTED_LANGUAGES.find((l) => l.code === currentLanguage) || SUPPORTED_LANGUAGES[0];

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const [showAgentLogin, setShowAgentLogin] = useState(false);
  const [agentEmail, setAgentEmail] = useState('');
  const [agentOtp, setAgentOtp] = useState('');
  const [agentName, setAgentName] = useState('');
  const [agentSent, setAgentSent] = useState(false);
  const [agentNames, setAgentNames] = useState<string[]>([]);
  const [agentBusy, setAgentBusy] = useState(false);

  const onSubmit = async (data: LoginFormValues) => {
    setApiError(null);
    try {
      await login(data);
    } catch (err: any) {
      const msg = err?.message || 'Login failed. Please check your credentials.';
      setApiError(msg);
    }
  };

  const sendAgentCode = async () => {
    setAgentBusy(true);
    setApiError(null);
    try {
      const res = await authApi.requestAgentOtp(agentEmail.trim());
      setAgentNames(res.existingAgents || []);
      setAgentSent(true);
    } catch (err: any) {
      setApiError(err?.message || 'Could not send the code');
    } finally {
      setAgentBusy(false);
    }
  };

  const verifyAgent = async () => {
    setAgentBusy(true);
    setApiError(null);
    try {
      const data = await authApi.verifyAgentOtp(agentEmail.trim(), agentOtp.trim(), agentName.trim());
      await setAuth(data.token, data.user);
      router.replace('/(tabs)' as any);
    } catch (err: any) {
      setApiError(err?.message || 'Could not sign in');
    } finally {
      setAgentBusy(false);
    }
  };

  const handleQrLogin = async (code: string) => {
    setApiError(null);
    await loginWithQr(code);
    setShowQrScanner(false);
  };

  const handleSaveApiUrl = () => {
    if (baseUrlInput.trim()) {
      setApiBaseUrl(baseUrlInput);
      setShowApiConfig(false);
      Alert.alert('API URL Updated', `API Base URL set to: ${getApiBaseUrl()}`);
    }
  };

  return (
    <ScreenBackground color={theme.bg}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <StatusBar
          barStyle={theme.isDark ? 'light-content' : 'dark-content'}
          backgroundColor={theme.bg}
        />

        {/* Top Bar with Language Selector */}
        <View style={styles.topBar}>
          <View style={{ flex: 1 }} />
          <TouchableOpacity
            onPress={() => setShowLangModal(true)}
            style={[
              styles.langPill,
              { backgroundColor: theme.cardBg, borderColor: theme.borderColor },
            ]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            activeOpacity={0.75}
          >
            <Globe size={14} color={BRAND_COLORS.blue600} />
            <Text style={[styles.langPillText, { color: theme.textPrimary }]}>
              {currentLangObj.nativeName}
            </Text>
          </TouchableOpacity>
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <ScrollView
            contentContainerStyle={[styles.scrollContent, { paddingBottom: 120 }]}
            keyboardShouldPersistTaps="handled"
            automaticallyAdjustKeyboardInsets={true}
            showsVerticalScrollIndicator={false}
          >
            {/* Brand Header */}
            <View style={styles.header}>
              <View style={[styles.iconContainer, { backgroundColor: BRAND_COLORS.navyInk }]}>
                <Image
                  source={require('../../../assets/images/seznik_white_logo.png')}
                  style={{ width: 44, height: 44 }}
                  resizeMode="contain"
                />
              </View>
              <Text style={[styles.brandTitle, { color: theme.textPrimary }]}>
                Seznik <Text style={{ color: BRAND_COLORS.blue600 }}>POS</Text>
              </Text>
              <Text style={[styles.brandSubtitle, { color: theme.textSecondary }]}>
                {t('mobileCompanion', 'Cloud Billing & Retail Management')}
              </Text>
            </View>

            {/* Login Card */}
            <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
              <Text style={[styles.cardHeading, { color: theme.textPrimary }]}>
                {t('welcomeBack', 'Welcome Back')}
              </Text>
              <Text style={[styles.cardSubheading, { color: theme.textSecondary }]}>
                {t('signInToContinue', 'Sign in to access your store')}
              </Text>

              {/* Error Message */}
              {apiError ? (
                <View style={[styles.errorBox, { backgroundColor: 'rgba(239, 68, 68, 0.08)', borderColor: 'rgba(239, 68, 68, 0.25)' }]}>
                  <Text style={styles.errorText}>{apiError}</Text>
                </View>
              ) : null}

              {/* Email / Username Field */}
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: theme.textPrimary }]}>
                  {t('emailOrUsername', 'Email or Username')}
                </Text>
                <Controller
                  control={control}
                  name="email"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <View
                      style={[
                        styles.inputWrapper,
                        {
                          backgroundColor: theme.bg,
                          borderColor: emailFocused ? BRAND_COLORS.blue600 : theme.borderColor,
                          borderWidth: emailFocused ? 1.5 : 1,
                        },
                      ]}
                    >
                      <Mail size={18} color={emailFocused ? BRAND_COLORS.blue600 : theme.textSecondary} style={{ marginRight: 10 }} />
                      <TextInput
                        style={[styles.input, { color: theme.textPrimary }]}
                        placeholder={t('enterEmailOrUsername', 'store@seznik.com or username')}
                        placeholderTextColor="#94A3B8"
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoCorrect={false}
                        onFocus={() => setEmailFocused(true)}
                        onBlur={() => {
                          setEmailFocused(false);
                          onBlur();
                        }}
                        onChangeText={(val) => {
                          onChange(val);
                          if (apiError) setApiError(null);
                        }}
                        value={value}
                      />
                    </View>
                  )}
                />
                {errors.email ? (
                  <Text style={styles.fieldError}>{errors.email.message}</Text>
                ) : null}
              </View>

              {/* Password Field */}
              <View style={styles.inputGroup}>
                <View style={styles.labelRow}>
                  <Text style={[styles.label, { color: theme.textPrimary }]}>
                    {t('password', 'Password')}
                  </Text>
                  <TouchableOpacity
                    onPress={() => router.push('/(auth)/forgot-password' as any)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Text style={styles.forgotPasswordText}>
                      {t('forgotPasswordPrompt', 'Forgot Password?')}
                    </Text>
                  </TouchableOpacity>
                </View>
                <Controller
                  control={control}
                  name="password"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <View
                      style={[
                        styles.inputWrapper,
                        {
                          backgroundColor: theme.bg,
                          borderColor: passwordFocused ? BRAND_COLORS.blue600 : theme.borderColor,
                          borderWidth: passwordFocused ? 1.5 : 1,
                        },
                      ]}
                    >
                      <Lock size={18} color={passwordFocused ? BRAND_COLORS.blue600 : theme.textSecondary} style={{ marginRight: 10 }} />
                      <TextInput
                        style={[styles.input, { color: theme.textPrimary }]}
                        placeholder="••••••••"
                        placeholderTextColor="#94A3B8"
                        secureTextEntry={!showPassword}
                        autoCapitalize="none"
                        onFocus={() => setPasswordFocused(true)}
                        onBlur={() => {
                          setPasswordFocused(false);
                          onBlur();
                        }}
                        onChangeText={(val) => {
                          onChange(val);
                          if (apiError) setApiError(null);
                        }}
                        value={value}
                      />
                      <TouchableOpacity
                        onPress={() => setShowPassword(!showPassword)}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        style={{ padding: 4 }}
                      >
                        {showPassword ? (
                          <EyeOff size={18} color={theme.textSecondary} />
                        ) : (
                          <Eye size={18} color={theme.textSecondary} />
                        )}
                      </TouchableOpacity>
                    </View>
                  )}
                />
                {errors.password ? (
                  <Text style={styles.fieldError}>{errors.password.message}</Text>
                ) : null}
              </View>

              <TouchableOpacity onPress={() => setShowAgentLogin(true)} style={{ marginTop: 14, alignItems: 'center' }}>
                <Text style={{ color: BRAND_COLORS.blue600, fontWeight: '700' }}>Agent login</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSubmit(onSubmit)}
                disabled={isLoggingIn}
                style={[styles.primaryButton, { backgroundColor: BRAND_COLORS.navyInk }, isLoggingIn && { opacity: 0.7 }]}
                activeOpacity={0.85}
              >
                {isLoggingIn ? (
                  <ActivityIndicator color="#FFFFFF" style={{ marginRight: 8 }} />
                ) : (
                  <ArrowRight size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                )}
                <Text style={styles.primaryButtonText}>
                  {isLoggingIn ? t('signingIn', 'Signing In...') : t('signIn', 'Sign In')}
                </Text>
              </TouchableOpacity>

              <View style={styles.orRow}>
                <View style={[styles.orLine, { backgroundColor: theme.borderColor }]} />
                <Text style={[styles.orText, { color: theme.textSecondary }]}>
                  {t('orDivider', 'or')}
                </Text>
                <View style={[styles.orLine, { backgroundColor: theme.borderColor }]} />
              </View>

              <TouchableOpacity
                onPress={() => setShowQrScanner(true)}
                disabled={isLoggingIn || isLoggingInWithQr}
                style={[
                  styles.qrButton,
                  { borderColor: theme.borderColor, backgroundColor: theme.bg },
                ]}
                activeOpacity={0.85}
              >
                <QrCode size={18} color={BRAND_COLORS.blue600} style={{ marginRight: 8 }} />
                <Text style={[styles.qrButtonText, { color: theme.textPrimary }]}>
                  {t('scanDashboardQr', 'Scan dashboard QR')}
                </Text>
              </TouchableOpacity>
              <Text style={[styles.qrHint, { color: theme.textSecondary }]}>
                {t('scanDashboardQrSub', 'Sign in with the QR on your web dashboard')}
              </Text>
            </View>

            {/* Bottom Register Prompt */}
            <View style={styles.registerPromptRow}>
              <Text style={[styles.registerPromptText, { color: theme.textSecondary }]}>
                {t('dontHaveAccount', "Don't have an account?")}
              </Text>
              <TouchableOpacity
                onPress={() => router.push('/(auth)/register' as any)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.registerPromptLink}>
                  {t('createAccount', 'Create Account')}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Developer Server Setting Link */}
            <View style={styles.devBoxContainer}>
              <TouchableOpacity
                onPress={() => setShowApiConfig(!showApiConfig)}
                style={styles.devToggle}
              >
                <Server size={12} color={theme.textSecondary} />
                <Text style={[styles.devToggleText, { color: theme.textSecondary }]}>
                  API: {getApiBaseUrl()}
                </Text>
              </TouchableOpacity>

              {showApiConfig ? (
                <View style={[styles.devCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
                  <Text style={[styles.devCardTitle, { color: theme.textPrimary }]}>
                    Server API Base URL
                  </Text>
                  <TextInput
                    style={[styles.devInput, { backgroundColor: theme.bg, borderColor: theme.borderColor, color: theme.textPrimary }]}
                    value={baseUrlInput}
                    onChangeText={setBaseUrlInput}
                    placeholder="http://192.168.0.11:5001/api"
                    placeholderTextColor="#94A3B8"
                    autoCapitalize="none"
                  />
                  <TouchableOpacity
                    onPress={handleSaveApiUrl}
                    style={styles.devSaveBtn}
                  >
                    <Text style={styles.devSaveBtnText}>Save URL</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>

        {/* Language Modal */}
        <Modal
          visible={showLangModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowLangModal(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={[styles.modalContent, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
              <View style={styles.modalHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Globe size={18} color={BRAND_COLORS.blue600} style={{ marginRight: 8 }} />
                  <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>
                    {t('selectLanguage', 'Select Language')}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setShowLangModal(false)}>
                  <X size={20} color={theme.textSecondary} />
                </TouchableOpacity>
              </View>

              <ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={false}>
                {SUPPORTED_LANGUAGES.map((l) => {
                  const isSelected = l.code === currentLanguage;
                  return (
                    <TouchableOpacity
                      key={l.code}
                      onPress={() => {
                        setLanguage(l.code);
                        setShowLangModal(false);
                      }}
                      style={[
                        styles.langRow,
                        { borderColor: isSelected ? BRAND_COLORS.blue600 : theme.borderColor },
                        isSelected && { backgroundColor: 'rgba(37, 99, 235, 0.08)' },
                      ]}
                    >
                      <View>
                        <Text style={[styles.langNative, { color: theme.textPrimary }, isSelected && { color: BRAND_COLORS.blue600, fontWeight: '800' }]}>
                          {l.nativeName}
                        </Text>
                        <Text style={[styles.langEnglish, { color: theme.textSecondary }]}>
                          {l.name}
                        </Text>
                      </View>
                      {isSelected ? <Check size={18} color={BRAND_COLORS.blue600} /> : null}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          </View>
        </Modal>

        <Modal visible={showAgentLogin} transparent animationType="slide" onRequestClose={() => setShowAgentLogin(false)}>
          <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' }}>
            <View style={{ backgroundColor: theme.cardBg, padding: 20, borderTopLeftRadius: 20, borderTopRightRadius: 20 }}>
              <Text style={{ fontSize: 18, fontWeight: '800', color: theme.textPrimary, marginBottom: 8 }}>Agent login</Text>
              <Text style={{ color: theme.textSecondary, marginBottom: 12 }}>
                Store email, then the code we send there, then your name. Two agents per store.
              </Text>
              <TextInput
                value={agentEmail}
                onChangeText={setAgentEmail}
                placeholder="Store email"
                autoCapitalize="none"
                keyboardType="email-address"
                placeholderTextColor="#94A3B8"
                style={[styles.input, { color: theme.textPrimary, borderWidth: 1, borderColor: theme.borderColor, borderRadius: 10, padding: 12, marginBottom: 8 }]}
              />
              {agentSent ? (
                <>
                  <TextInput
                    value={agentOtp}
                    onChangeText={setAgentOtp}
                    placeholder="6-digit code"
                    keyboardType="number-pad"
                    placeholderTextColor="#94A3B8"
                    style={[styles.input, { color: theme.textPrimary, borderWidth: 1, borderColor: theme.borderColor, borderRadius: 10, padding: 12, marginBottom: 8 }]}
                  />
                  {agentNames.length > 0 ? (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                      {agentNames.map((name) => (
                        <TouchableOpacity key={name} onPress={() => setAgentName(name)} style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: theme.bg }}>
                          <Text style={{ color: theme.textPrimary, fontWeight: '700' }}>{name}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  ) : null}
                  <TextInput
                    value={agentName}
                    onChangeText={setAgentName}
                    placeholder="Agent name"
                    placeholderTextColor="#94A3B8"
                    style={[styles.input, { color: theme.textPrimary, borderWidth: 1, borderColor: theme.borderColor, borderRadius: 10, padding: 12, marginBottom: 8 }]}
                  />
                  <TouchableOpacity onPress={verifyAgent} disabled={agentBusy} style={[styles.primaryButton, { backgroundColor: BRAND_COLORS.navyInk }]}>
                    <Text style={{ color: '#fff', fontWeight: '800' }}>{agentBusy ? 'Signing in…' : 'Enter store'}</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity onPress={sendAgentCode} disabled={agentBusy} style={[styles.primaryButton, { backgroundColor: BRAND_COLORS.navyInk }]}>
                  <Text style={{ color: '#fff', fontWeight: '800' }}>{agentBusy ? 'Sending…' : 'Send code'}</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={() => setShowAgentLogin(false)} style={{ marginTop: 12, alignItems: 'center' }}>
                <Text style={{ color: theme.textSecondary }}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        <LoginQrScanner
          visible={showQrScanner}
          onClose={() => setShowQrScanner(false)}
          onCodeScanned={handleQrLogin}
          isSubmitting={isLoggingInWithQr}
        />
      </SafeAreaView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
  },
  langPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    gap: 6,
  },
  langPillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 32,
    justifyContent: 'center',
    flexGrow: 1,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  iconContainer: {
    width: 68,
    height: 68,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    shadowColor: BRAND_COLORS.navyInk,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 5,
  },
  brandTitle: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  brandSubtitle: {
    fontSize: 13,
    marginTop: 4,
    fontWeight: '500',
    textAlign: 'center',
  },
  card: {
    borderRadius: 20,
    padding: 22,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
    marginBottom: 20,
  },
  cardHeading: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  cardSubheading: {
    fontSize: 12,
    marginTop: 3,
    marginBottom: 18,
  },
  errorBox: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 12,
    fontWeight: '600',
  },
  inputGroup: {
    marginBottom: 16,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
  },
  forgotPasswordText: {
    color: BRAND_COLORS.blue600,
    fontSize: 12,
    fontWeight: '700',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 52,
  },
  input: {
    flex: 1,
    fontSize: 15,
  },
  fieldError: {
    color: '#EF4444',
    fontSize: 11,
    marginTop: 4,
    fontWeight: '600',
  },
  primaryButton: {
    borderRadius: 14,
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  orRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 4,
    gap: 10,
  },
  orLine: {
    flex: 1,
    height: 1,
  },
  orText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  qrButton: {
    marginTop: 8,
    borderRadius: 14,
    height: 52,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrButtonText: {
    fontSize: 15,
    fontWeight: '800',
  },
  qrHint: {
    marginTop: 8,
    fontSize: 12,
    textAlign: 'center',
    fontWeight: '500',
  },
  registerPromptRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginBottom: 16,
  },
  registerPromptText: {
    fontSize: 13,
  },
  registerPromptLink: {
    color: BRAND_COLORS.blue600,
    fontSize: 13,
    fontWeight: '800',
  },
  devBoxContainer: {
    alignItems: 'center',
    marginTop: 10,
  },
  devToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  devToggleText: {
    fontSize: 11,
    fontWeight: '600',
  },
  devCard: {
    width: '100%',
    marginTop: 8,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  devCardTitle: {
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 6,
  },
  devInput: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 8,
    fontSize: 11,
    marginBottom: 8,
  },
  devSaveBtn: {
    backgroundColor: BRAND_COLORS.navyInk,
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: 'center',
  },
  devSaveBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(150, 150, 150, 0.15)',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  langRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  langNative: {
    fontSize: 14,
    fontWeight: '700',
  },
  langEnglish: {
    fontSize: 11,
    marginTop: 1,
  },
});
