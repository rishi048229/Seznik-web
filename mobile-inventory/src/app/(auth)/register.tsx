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
  Modal,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  ArrowLeft,
  Mail,
  KeyRound,
  User,
  Phone,
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
import { useAuth } from '@/hooks/useAuth';
import { useAppTheme } from '@/hooks/useAppTheme';
import { BRAND_COLORS } from '@/constants/theme';
import { ScreenBackground } from '@/components/ui/ScreenBackground';
import { useTranslation } from '@/store/useLanguageStore';
import { SUPPORTED_LANGUAGES } from '@/constants/translations';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+?[0-9][0-9\s-]{6,14}$/;

export default function RegisterScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const { t, currentLanguage, setLanguage } = useTranslation();
  const {
    sendEmailOtp,
    verifyEmailOtp,
    register,
    isRegistering,
  } = useAuth();

  // Registration step: 1 = Email, 2 = Verify OTP, 3 = Profile Details
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Form State
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Focus tracking
  const [focusedField, setFocusedField] = useState<string | null>(null);

  // Loading & Error States
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
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

  // Step 1: Send OTP to Email
  const handleSendOtp = async () => {
    setErrorMessage(null);
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !EMAIL_RE.test(cleanEmail)) {
      setErrorMessage(t('invalidEmail', 'Please enter a valid email address'));
      return;
    }

    setIsSendingOtp(true);
    try {
      const res = await sendEmailOtp(cleanEmail);
      setResendCooldown(60);
      setStep(2);
      if (res?.devOtp) {
        setOtp(res.devOtp);
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to send verification code. Please try again.');
    } finally {
      setIsSendingOtp(false);
    }
  };

  // Step 2: Verify OTP
  const handleVerifyOtp = async () => {
    setErrorMessage(null);
    const cleanOtp = otp.trim();
    if (cleanOtp.length < 6) {
      setErrorMessage(t('enterValidOtp', 'Please enter the 6-digit verification code'));
      return;
    }

    setIsVerifyingOtp(true);
    try {
      await verifyEmailOtp({ email: email.trim().toLowerCase(), otp: cleanOtp });
      setStep(3);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Incorrect verification code. Please check and try again.');
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  // Step 3: Complete Registration
  const handleCompleteRegistration = async () => {
    setErrorMessage(null);
    const cleanName = displayName.trim();
    const cleanPhone = phone.trim();

    if (!cleanName) {
      setErrorMessage(t('enterFullName', 'Please enter your full name or store name'));
      return;
    }
    if (!cleanPhone || !PHONE_RE.test(cleanPhone)) {
      setErrorMessage(t('enterValidPhone', 'Please enter a valid phone number'));
      return;
    }
    if (!password || password.length < 8) {
      setErrorMessage(t('passwordMinLength', 'Password must be at least 8 characters long'));
      return;
    }
    if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
      setErrorMessage(t('passwordComplexity', 'Password must contain uppercase, lowercase letters, and a number'));
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage(t('passwordsDoNotMatch', 'Passwords do not match'));
      return;
    }

    try {
      await register({
        email: email.trim().toLowerCase(),
        phone: cleanPhone,
        displayName: cleanName,
        password,
      });
    } catch (err: any) {
      setErrorMessage(err?.message || 'Registration failed. Please try again.');
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
                {step === 1 && t('createAccount', 'Create Store Account')}
                {step === 2 && t('verifyEmail', 'Verify Your Email')}
                {step === 3 && t('storeProfileSecurity', 'Store & Security')}
              </Text>
              <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
                {step === 1 && t('enterEmailToStart', 'Step 1: Enter your business email to get started')}
                {step === 2 && t('enterOtpSent', `Step 2: Enter the 6-digit code sent to ${email}`)}
                {step === 3 && t('completeProfile', 'Step 3: Setup your store name, contact & password')}
              </Text>

              {/* Stepper Progress Bar */}
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
            {errorMessage ? (
              <View style={[styles.errorBox, { backgroundColor: 'rgba(239, 68, 68, 0.08)', borderColor: 'rgba(239, 68, 68, 0.25)' }]}>
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            ) : null}

            {/* STEP 1: EMAIL ENTRY */}
            {step === 1 && (
              <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
                <Text style={[styles.cardHeading, { color: theme.textPrimary }]}>
                  {t('businessEmail', 'Business Email')}
                </Text>
                <Text style={[styles.cardSubheading, { color: theme.textSecondary }]}>
                  {t('emailVerificationNotice', 'We will send a 6-digit verification code')}
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
                      value={email}
                      onChangeText={(val) => {
                        setEmail(val);
                        if (errorMessage) setErrorMessage(null);
                      }}
                      onFocus={() => setFocusedField('email')}
                      onBlur={() => setFocusedField(null)}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                      autoFocus
                    />
                  </View>
                </View>

                <TouchableOpacity
                  onPress={handleSendOtp}
                  disabled={isSendingOtp || !email.trim()}
                  style={[styles.primaryButton, { backgroundColor: BRAND_COLORS.navyInk }, (!email.trim() || isSendingOtp) && { opacity: 0.7 }]}
                  activeOpacity={0.85}
                >
                  {isSendingOtp ? (
                    <ActivityIndicator color="#FFFFFF" style={{ marginRight: 8 }} />
                  ) : (
                    <CheckCircle2 size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                  )}
                  <Text style={styles.primaryButtonText}>
                    {isSendingOtp ? t('sendingCode', 'Sending Code...') : t('sendVerificationCode', 'Send Verification Code')}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* STEP 2: OTP VERIFICATION */}
            {step === 2 && (
              <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
                <Text style={[styles.cardHeading, { color: theme.textPrimary }]}>
                  {t('verifyEmail', 'Verify Your Email')}
                </Text>
                <Text style={[styles.cardSubheading, { color: theme.textSecondary }]}>
                  {t('otpCodeSentNotice', 'Enter the 6-digit code sent to your inbox')}
                </Text>

                <View style={styles.inputGroup}>
                  <Text style={[styles.label, { color: theme.textPrimary }]}>
                    {t('enter6DigitOtp', '6-Digit Verification Code *')}
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
                      value={otp}
                      onChangeText={(val) => {
                        setOtp(val.replace(/[^0-9]/g, '').slice(0, 6));
                        if (errorMessage) setErrorMessage(null);
                      }}
                      onFocus={() => setFocusedField('otp')}
                      onBlur={() => setFocusedField(null)}
                      keyboardType="number-pad"
                      maxLength={6}
                      autoFocus
                    />
                  </View>
                </View>

                <TouchableOpacity
                  onPress={handleVerifyOtp}
                  disabled={isVerifyingOtp || otp.length < 6}
                  style={[styles.primaryButton, { backgroundColor: BRAND_COLORS.navyInk }, (otp.length < 6 || isVerifyingOtp) && { opacity: 0.7 }]}
                  activeOpacity={0.85}
                >
                  {isVerifyingOtp ? (
                    <ActivityIndicator color="#FFFFFF" style={{ marginRight: 8 }} />
                  ) : (
                    <CheckCircle2 size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                  )}
                  <Text style={styles.primaryButtonText}>
                    {isVerifyingOtp ? t('verifying', 'Verifying...') : t('verifyCode', 'Verify & Continue')}
                  </Text>
                </TouchableOpacity>

                {/* Resend Code Section */}
                <View style={styles.resendRow}>
                  <Text style={[styles.resendPrompt, { color: theme.textSecondary }]}>
                    {t('didNotReceiveCode', "Didn't receive code?")}
                  </Text>
                  <TouchableOpacity
                    onPress={handleSendOtp}
                    disabled={resendCooldown > 0 || isSendingOtp}
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

            {/* STEP 3: PROFILE SETUP & PASSWORD */}
            {step === 3 && (
              <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
                <Text style={[styles.cardHeading, { color: theme.textPrimary }]}>
                  {t('storeProfileSecurity', 'Store Profile & Password')}
                </Text>
                <Text style={[styles.cardSubheading, { color: theme.textSecondary }]}>
                  {t('setupProfileNotice', 'Set your store display name, phone, and login password')}
                </Text>

                {/* Full / Business Name */}
                <View style={styles.inputGroup}>
                  <Text style={[styles.label, { color: theme.textPrimary }]}>
                    {t('fullNameOrBusiness', 'Full Name / Store Name *')}
                  </Text>
                  <View
                    style={[
                      styles.inputWrapper,
                      {
                        backgroundColor: theme.bg,
                        borderColor: focusedField === 'name' ? BRAND_COLORS.blue600 : theme.borderColor,
                        borderWidth: focusedField === 'name' ? 1.5 : 1,
                      },
                    ]}
                  >
                    <User size={18} color={focusedField === 'name' ? BRAND_COLORS.blue600 : theme.textSecondary} style={{ marginRight: 10 }} />
                    <TextInput
                      style={[styles.input, { color: theme.textPrimary }]}
                      placeholder="e.g. Metro Mart"
                      placeholderTextColor="#94A3B8"
                      value={displayName}
                      onChangeText={setDisplayName}
                      onFocus={() => setFocusedField('name')}
                      onBlur={() => setFocusedField(null)}
                      autoCapitalize="words"
                    />
                  </View>
                </View>

                {/* Phone Number */}
                <View style={styles.inputGroup}>
                  <Text style={[styles.label, { color: theme.textPrimary }]}>
                    {t('phone', 'Phone Number *')}
                  </Text>
                  <View
                    style={[
                      styles.inputWrapper,
                      {
                        backgroundColor: theme.bg,
                        borderColor: focusedField === 'phone' ? BRAND_COLORS.blue600 : theme.borderColor,
                        borderWidth: focusedField === 'phone' ? 1.5 : 1,
                      },
                    ]}
                  >
                    <Phone size={18} color={focusedField === 'phone' ? BRAND_COLORS.blue600 : theme.textSecondary} style={{ marginRight: 10 }} />
                    <TextInput
                      style={[styles.input, { color: theme.textPrimary }]}
                      placeholder="e.g. 9876543210"
                      placeholderTextColor="#94A3B8"
                      value={phone}
                      onChangeText={setPhone}
                      onFocus={() => setFocusedField('phone')}
                      onBlur={() => setFocusedField(null)}
                      keyboardType="phone-pad"
                    />
                  </View>
                </View>

                {/* Password */}
                <View style={styles.inputGroup}>
                  <Text style={[styles.label, { color: theme.textPrimary }]}>
                    {t('password', 'Password *')}
                  </Text>
                  <View
                    style={[
                      styles.inputWrapper,
                      {
                        backgroundColor: theme.bg,
                        borderColor: focusedField === 'password' ? BRAND_COLORS.blue600 : theme.borderColor,
                        borderWidth: focusedField === 'password' ? 1.5 : 1,
                      },
                    ]}
                  >
                    <Lock size={18} color={focusedField === 'password' ? BRAND_COLORS.blue600 : theme.textSecondary} style={{ marginRight: 10 }} />
                    <TextInput
                      style={[styles.input, { color: theme.textPrimary }]}
                      placeholder="••••••••"
                      placeholderTextColor="#94A3B8"
                      value={password}
                      onChangeText={setPassword}
                      onFocus={() => setFocusedField('password')}
                      onBlur={() => setFocusedField(null)}
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
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
                    {t('confirmPassword', 'Confirm Password *')}
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
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      onFocus={() => setFocusedField('confirmPassword')}
                      onBlur={() => setFocusedField(null)}
                      secureTextEntry={!showConfirmPassword}
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
                  onPress={handleCompleteRegistration}
                  disabled={isRegistering}
                  style={[styles.primaryButton, { backgroundColor: BRAND_COLORS.navyInk }, isRegistering && { opacity: 0.7 }]}
                  activeOpacity={0.85}
                >
                  {isRegistering ? (
                    <ActivityIndicator color="#FFFFFF" style={{ marginRight: 8 }} />
                  ) : (
                    <CheckCircle2 size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                  )}
                  <Text style={styles.primaryButtonText}>
                    {isRegistering ? t('creatingAccount', 'Creating Account...') : t('completeRegistration', 'Create Account & Sign In')}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Bottom Return to Login */}
            <View style={styles.registerPromptRow}>
              <Text style={[styles.registerPromptText, { color: theme.textSecondary }]}>
                {t('alreadyHaveAccount', 'Already have a Seznik account?')}
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
