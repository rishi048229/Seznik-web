import React, { useState, useEffect } from 'react';
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
import {
  ArrowLeft,
  KeyRound,
  Mail,
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  ShieldCheck,
  RotateCcw,
  Globe,
  Check,
  X,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { useAppTheme } from '@/hooks/useAppTheme';
import { BRAND_COLORS } from '@/constants/theme';
import { ScreenBackground } from '@/components/ui/ScreenBackground';
import { useTranslation } from '@/store/useLanguageStore';
import { SUPPORTED_LANGUAGES } from '@/constants/translations';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const { t, currentLanguage, setLanguage } = useTranslation();
  const {
    sendForgotPasswordOtp,
    verifyForgotPasswordOtp,
    resetPassword,
  } = useAuth();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Focus tracking
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [devOtpHint, setDevOtpHint] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [showLangModal, setShowLangModal] = useState(false);

  const currentLangObj = SUPPORTED_LANGUAGES.find((l) => l.code === currentLanguage) || SUPPORTED_LANGUAGES[0];

  // Resend OTP countdown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const handleSendOtp = async () => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !EMAIL_RE.test(cleanEmail)) {
      setErrorMsg(t('invalidEmail', 'Please enter a valid email address'));
      return;
    }
    setErrorMsg(null);
    setLoading(true);
    try {
      const res = await sendForgotPasswordOtp(cleanEmail);
      setResendCooldown(60);
      if (res?.devOtp) {
        setDevOtpHint(res.devOtp);
        setOtp(res.devOtp);
      }
      setStep(2);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to send verification code. Please check email address.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    const cleanOtp = otp.trim();
    if (!cleanOtp || cleanOtp.length < 4) {
      setErrorMsg(t('enterValidOtp', 'Please enter a valid verification code'));
      return;
    }
    setErrorMsg(null);
    setLoading(true);
    try {
      await verifyForgotPasswordOtp({ email: email.trim().toLowerCase(), otp: cleanOtp });
      setStep(3);
    } catch (err: any) {
      setErrorMsg(err.message || 'Verification failed. Incorrect code.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!newPassword || newPassword.length < 8) {
      setErrorMsg(t('passwordMinLength', 'Password must be at least 8 characters long'));
      return;
    }
    if (!/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      setErrorMsg(t('passwordComplexity', 'Password must contain uppercase, lowercase letters, and a number'));
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMsg(t('passwordsDoNotMatch', 'Passwords do not match'));
      return;
    }
    setErrorMsg(null);
    setLoading(true);
    try {
      await resetPassword({ email: email.trim().toLowerCase(), newPassword });
      Alert.alert(t('success', 'Success'), 'Password updated successfully! You can now sign in with your new password.', [
        { text: t('signIn', 'Sign In'), onPress: () => router.replace('/(auth)/login' as any) },
      ]);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  const handleBackNavigation = () => {
    if (step === 3) setStep(2);
    else if (step === 2) setStep(1);
    else router.replace('/(auth)/login' as any);
  };

  return (
    <ScreenBackground color={theme.bg}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <StatusBar
          barStyle={theme.isDark ? 'light-content' : 'dark-content'}
          backgroundColor={theme.bg}
        />

        {/* Top Navigation Bar */}
        <View style={styles.topNavBar}>
          <TouchableOpacity
            onPress={handleBackNavigation}
            style={styles.backButtonRow}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            activeOpacity={0.7}
          >
            <ArrowLeft size={20} color={theme.textPrimary} />
            <Text style={[styles.backButtonText, { color: theme.textPrimary }]}>
              {step === 1 ? t('backToLogin', 'Back to Login') : t('previous', 'Previous')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setShowLangModal(true)}
            style={[
              styles.langPill,
              { backgroundColor: theme.cardBg, borderColor: theme.borderColor },
            ]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            activeOpacity={0.75}
          >
            <Globe size={13} color={BRAND_COLORS.blue600} />
            <Text style={[styles.langPillText, { color: theme.textPrimary }]}>
              {currentLangObj.nativeName}
            </Text>
          </TouchableOpacity>
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Header Hero Section */}
            <View style={styles.header}>
              <View style={[styles.iconContainer, { backgroundColor: BRAND_COLORS.navyInk }]}>
                <Image
                  source={require('../../../assets/images/seznik_white_logo.png')}
                  style={{ width: 44, height: 44 }}
                  resizeMode="contain"
                />
              </View>

              <Text style={[styles.title, { color: theme.textPrimary }]}>
                {step === 1 && t('forgotPassword', 'Reset Password')}
                {step === 2 && t('enterVerificationCode', 'Verify Code')}
                {step === 3 && t('setNewPassword', 'Set New Password')}
              </Text>
              <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
                {step === 1 && t('enterEmailForOtp', 'Enter your account email to receive a password reset code')}
                {step === 2 && t('enterOtpSent', `Enter the 6-digit verification code sent to ${email}`)}
                {step === 3 && t('chooseNewPassword', 'Create a strong, secure new password for your store account')}
              </Text>

              {/* Progress Stepper */}
              <View style={styles.stepperContainer}>
                <View
                  style={[
                    styles.stepperPill,
                    { backgroundColor: step >= 1 ? BRAND_COLORS.blue600 : theme.borderColor },
                  ]}
                />
                <View
                  style={[
                    styles.stepperPill,
                    { backgroundColor: step >= 2 ? BRAND_COLORS.blue600 : theme.borderColor },
                  ]}
                />
                <View
                  style={[
                    styles.stepperPill,
                    { backgroundColor: step >= 3 ? BRAND_COLORS.blue600 : theme.borderColor },
                  ]}
                />
              </View>
            </View>

            {/* Error Message Box */}
            {errorMsg ? (
              <View style={[styles.errorBox, { backgroundColor: 'rgba(239, 68, 68, 0.08)', borderColor: 'rgba(239, 68, 68, 0.25)' }]}>
                <Text style={styles.errorText}>{errorMsg}</Text>
              </View>
            ) : null}

            {/* Developer OTP Helper Box */}
            {devOtpHint ? (
              <View style={[styles.devBox, { backgroundColor: 'rgba(245, 158, 11, 0.1)', borderColor: 'rgba(245, 158, 11, 0.3)' }]}>
                <Text style={styles.devText}>🔑 Dev Code: {devOtpHint}</Text>
              </View>
            ) : null}

            {/* Form Card */}
            <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
              {/* STEP 1: EMAIL ENTRY */}
              {step === 1 && (
                <View>
                  <Text style={[styles.cardHeading, { color: theme.textPrimary }]}>
                    {t('accountEmail', 'Account Email')}
                  </Text>
                  <Text style={[styles.cardSubheading, { color: theme.textSecondary }]}>
                    {t('resetOtpNotice', 'We will send a 6-digit recovery code to your registered email')}
                  </Text>

                  <View style={styles.inputGroup}>
                    <Text style={[styles.label, { color: theme.textPrimary }]}>
                      {t('emailAddress', 'Email Address *')}
                    </Text>
                    <View
                      style={[
                        styles.inputWrapper,
                        {
                          backgroundColor: theme.bg,
                          borderColor: focusedField === 'email' ? BRAND_COLORS.blue600 : theme.borderColor,
                          borderWidth: focusedField === 'email' ? 1.5 : 1,
                        },
                      ]}
                    >
                      <Mail size={18} color={focusedField === 'email' ? BRAND_COLORS.blue600 : theme.textSecondary} style={{ marginRight: 10 }} />
                      <TextInput
                        style={[styles.input, { color: theme.textPrimary }]}
                        placeholder="store@seznik.com"
                        placeholderTextColor="#94A3B8"
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoCorrect={false}
                        value={email}
                        onChangeText={(val) => {
                          setEmail(val);
                          if (errorMsg) setErrorMsg(null);
                        }}
                        onFocus={() => setFocusedField('email')}
                        onBlur={() => setFocusedField(null)}
                        autoFocus
                      />
                    </View>
                  </View>

                  <TouchableOpacity
                    onPress={handleSendOtp}
                    disabled={loading || !email.trim()}
                    style={[styles.primaryButton, { backgroundColor: BRAND_COLORS.navyInk }, (!email.trim() || loading) && { opacity: 0.7 }]}
                    activeOpacity={0.85}
                  >
                    {loading ? (
                      <ActivityIndicator color="#FFFFFF" style={{ marginRight: 8 }} />
                    ) : (
                      <CheckCircle2 size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                    )}
                    <Text style={styles.primaryButtonText}>
                      {loading ? t('sendingCode', 'Sending Code...') : t('sendOtp', 'Send Reset Code')}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* STEP 2: OTP VERIFICATION */}
              {step === 2 && (
                <View>
                  <Text style={[styles.cardHeading, { color: theme.textPrimary }]}>
                    {t('verificationCode', 'Verification Code')}
                  </Text>
                  <Text style={[styles.cardSubheading, { color: theme.textSecondary }]}>
                    {t('enter6DigitOtpSub', 'Enter the 6-digit code sent to verify password reset')}
                  </Text>

                  <View style={styles.inputGroup}>
                    <Text style={[styles.label, { color: theme.textPrimary }]}>
                      {t('enter6DigitOtp', '6-Digit Verification Code')}
                    </Text>
                    <View
                      style={[
                        styles.inputWrapper,
                        {
                          backgroundColor: theme.bg,
                          borderColor: focusedField === 'otp' ? BRAND_COLORS.blue600 : theme.borderColor,
                          borderWidth: focusedField === 'otp' ? 1.5 : 1,
                          justifyContent: 'center',
                        },
                      ]}
                    >
                      <KeyRound size={18} color={focusedField === 'otp' ? BRAND_COLORS.blue600 : theme.textSecondary} style={{ marginRight: 10 }} />
                      <TextInput
                        style={[
                          styles.input,
                          {
                            color: theme.textPrimary,
                            letterSpacing: 6,
                            fontSize: 20,
                            fontWeight: '800',
                            textAlign: 'center',
                          },
                        ]}
                        placeholder="••••••"
                        placeholderTextColor="#94A3B8"
                        keyboardType="number-pad"
                        maxLength={6}
                        value={otp}
                        onChangeText={(val) => {
                          setOtp(val.replace(/[^0-9]/g, '').slice(0, 6));
                          if (errorMsg) setErrorMsg(null);
                        }}
                        onFocus={() => setFocusedField('otp')}
                        onBlur={() => setFocusedField(null)}
                        autoFocus
                      />
                    </View>
                  </View>

                  <TouchableOpacity
                    onPress={handleVerifyOtp}
                    disabled={loading || otp.length < 4}
                    style={[styles.primaryButton, { backgroundColor: BRAND_COLORS.navyInk }, (otp.length < 4 || loading) && { opacity: 0.7 }]}
                    activeOpacity={0.85}
                  >
                    {loading ? (
                      <ActivityIndicator color="#FFFFFF" style={{ marginRight: 8 }} />
                    ) : (
                      <CheckCircle2 size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                    )}
                    <Text style={styles.primaryButtonText}>
                      {loading ? t('verifying', 'Verifying...') : t('verifyCode', 'Verify Code')}
                    </Text>
                  </TouchableOpacity>

                  {/* Resend Code Section */}
                  <View style={styles.resendRow}>
                    <Text style={[styles.resendPrompt, { color: theme.textSecondary }]}>
                      {t('didNotReceiveCode', "Didn't receive code?")}
                    </Text>
                    <TouchableOpacity
                      onPress={handleSendOtp}
                      disabled={resendCooldown > 0 || loading}
                      style={styles.resendBtn}
                    >
                      <RotateCcw size={12} color={resendCooldown > 0 ? theme.textSecondary : BRAND_COLORS.blue600} style={{ marginRight: 4 }} />
                      <Text
                        style={[
                          styles.resendAction,
                          { color: resendCooldown > 0 ? theme.textSecondary : BRAND_COLORS.blue600 },
                        ]}
                      >
                        {resendCooldown > 0
                          ? `${t('resendIn', 'Resend in')} ${resendCooldown}s`
                          : t('resendNow', 'Resend Code')}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* STEP 3: RESET PASSWORD */}
              {step === 3 && (
                <View>
                  <Text style={[styles.cardHeading, { color: theme.textPrimary }]}>
                    {t('createNewPassword', 'Create New Password')}
                  </Text>
                  <Text style={[styles.cardSubheading, { color: theme.textSecondary }]}>
                    {t('enterNewSecurePassword', 'Enter your new strong password below')}
                  </Text>

                  {/* New Password */}
                  <View style={styles.inputGroup}>
                    <Text style={[styles.label, { color: theme.textPrimary }]}>
                      {t('newPassword', 'New Password *')}
                    </Text>
                    <View
                      style={[
                        styles.inputWrapper,
                        {
                          backgroundColor: theme.bg,
                          borderColor: focusedField === 'newPassword' ? BRAND_COLORS.blue600 : theme.borderColor,
                          borderWidth: focusedField === 'newPassword' ? 1.5 : 1,
                        },
                      ]}
                    >
                      <Lock size={18} color={focusedField === 'newPassword' ? BRAND_COLORS.blue600 : theme.textSecondary} style={{ marginRight: 10 }} />
                      <TextInput
                        style={[styles.input, { color: theme.textPrimary }]}
                        placeholder="••••••••"
                        placeholderTextColor="#94A3B8"
                        secureTextEntry={!showPassword}
                        value={newPassword}
                        onChangeText={(val) => {
                          setNewPassword(val);
                          if (errorMsg) setErrorMsg(null);
                        }}
                        onFocus={() => setFocusedField('newPassword')}
                        onBlur={() => setFocusedField(null)}
                        autoCapitalize="none"
                        autoFocus
                      />
                      <TouchableOpacity
                        onPress={() => setShowPassword(!showPassword)}
                        style={{ padding: 4 }}
                      >
                        {showPassword ? (
                          <EyeOff size={18} color={theme.textSecondary} />
                        ) : (
                          <Eye size={18} color={theme.textSecondary} />
                        )}
                      </TouchableOpacity>
                    </View>
                    <Text style={[styles.helperHint, { color: theme.textSecondary }]}>
                      Min 8 characters with 1 uppercase, 1 lowercase & 1 number
                    </Text>
                  </View>

                  {/* Confirm Password */}
                  <View style={styles.inputGroup}>
                    <Text style={[styles.label, { color: theme.textPrimary }]}>
                      {t('confirmPassword', 'Confirm New Password *')}
                    </Text>
                    <View
                      style={[
                        styles.inputWrapper,
                        {
                          backgroundColor: theme.bg,
                          borderColor: focusedField === 'confirmPassword' ? BRAND_COLORS.blue600 : theme.borderColor,
                          borderWidth: focusedField === 'confirmPassword' ? 1.5 : 1,
                        },
                      ]}
                    >
                      <Lock size={18} color={focusedField === 'confirmPassword' ? BRAND_COLORS.blue600 : theme.textSecondary} style={{ marginRight: 10 }} />
                      <TextInput
                        style={[styles.input, { color: theme.textPrimary }]}
                        placeholder="••••••••"
                        placeholderTextColor="#94A3B8"
                        secureTextEntry={!showConfirmPassword}
                        value={confirmPassword}
                        onChangeText={(val) => {
                          setConfirmPassword(val);
                          if (errorMsg) setErrorMsg(null);
                        }}
                        onFocus={() => setFocusedField('confirmPassword')}
                        onBlur={() => setFocusedField(null)}
                        autoCapitalize="none"
                      />
                      <TouchableOpacity
                        onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                        style={{ padding: 4 }}
                      >
                        {showConfirmPassword ? (
                          <EyeOff size={18} color={theme.textSecondary} />
                        ) : (
                          <Eye size={18} color={theme.textSecondary} />
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>

                  <TouchableOpacity
                    onPress={handleResetPassword}
                    disabled={loading}
                    style={[styles.primaryButton, { backgroundColor: BRAND_COLORS.navyInk }, loading && { opacity: 0.7 }]}
                    activeOpacity={0.85}
                  >
                    {loading ? (
                      <ActivityIndicator color="#FFFFFF" style={{ marginRight: 8 }} />
                    ) : (
                      <ShieldCheck size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                    )}
                    <Text style={styles.primaryButtonText}>
                      {loading ? t('updating', 'Updating...') : t('updatePassword', 'Update Password')}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* Bottom Return to Login */}
            <View style={styles.registerPromptRow}>
              <Text style={[styles.registerPromptText, { color: theme.textSecondary }]}>
                {t('rememberPassword', 'Remember your password?')}
              </Text>
              <TouchableOpacity
                onPress={() => router.replace('/(auth)/login' as any)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.registerPromptLink}>
                  {t('signIn', 'Sign In')}
                </Text>
              </TouchableOpacity>
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
      </SafeAreaView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  topNavBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  backButtonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 4,
    marginLeft: -4,
  },
  backButtonText: {
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 6,
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
    paddingTop: 8,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    shadowColor: BRAND_COLORS.navyInk,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 12,
    marginTop: 3,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 10,
  },
  stepperContainer: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 14,
    width: '100%',
    maxWidth: 160,
  },
  stepperPill: {
    flex: 1,
    height: 4,
    borderRadius: 2,
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
  devBox: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },
  devText: {
    color: '#B45309',
    fontSize: 12,
    fontWeight: '700',
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
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  cardSubheading: {
    fontSize: 12,
    marginTop: 2,
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 14,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
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
  helperHint: {
    fontSize: 11,
    marginTop: 4,
    marginLeft: 2,
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
  resendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
    gap: 6,
  },
  resendPrompt: {
    fontSize: 12,
  },
  resendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  resendAction: {
    fontSize: 12,
    fontWeight: '800',
  },
  registerPromptRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    gap: 6,
  },
  registerPromptText: {
    fontSize: 13,
  },
  registerPromptLink: {
    color: BRAND_COLORS.blue600,
    fontSize: 13,
    fontWeight: '800',
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
