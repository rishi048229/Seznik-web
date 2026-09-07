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
  Printer,
  Sparkles,
  Zap,
  Shield,
  Headphones,
  ArrowRight,
  HelpCircle,
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
    sendPhoneOtp,
    isSendingPhoneOtp,
    verifyPhoneOtp,
    isVerifyingPhoneOtp,
    verifyAccessCode,
    isVerifyingAccessCode,
    register,
    isRegistering,
  } = useAuth();

  // Registration step: 1 = Email, 2 = Verify OTP, 3 = Basic Details, 4 = Hardware Verification
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Form State
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Phone OTP Verification State (default 000000)
  const [phoneOtp, setPhoneOtp] = useState('000000');
  const [phoneOtpSent, setPhoneOtpSent] = useState(false);
  const [isPhoneVerified, setIsPhoneVerified] = useState(false);
  const [phoneResendCooldown, setPhoneResendCooldown] = useState(0);
  const [phoneOtpMessage, setPhoneOtpMessage] = useState<string | null>(null);

  // Step 4: Hardware & Access Code State
  const [hasSeznikPrinter, setHasSeznikPrinter] = useState<boolean>(true);
  const [accessCode, setAccessCode] = useState('');
  const [codeVerificationState, setCodeVerificationState] = useState<'idle' | 'checking' | 'valid' | 'invalid'>('idle');
  const [codeVerificationMsg, setCodeVerificationMsg] = useState<string | null>(null);

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

  // Phone resend cooldown timer
  useEffect(() => {
    if (phoneResendCooldown <= 0) return;
    const timer = setInterval(() => {
      setPhoneResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [phoneResendCooldown]);

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

  // Phone OTP handlers (default 000000)
  const handleSendPhoneOtp = async () => {
    setErrorMessage(null);
    setPhoneOtpMessage(null);
    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length !== 10) {
      setErrorMessage(t('enterValid10DigitPhone', 'Please enter a valid 10-digit phone number'));
      return;
    }

    try {
      const res = await sendPhoneOtp(cleanPhone);
      setPhoneOtpSent(true);
      setPhoneResendCooldown(60);
      setPhoneOtp(res?.devOtp || '000000');
      setPhoneOtpMessage(res?.message || 'Verification code sent (Default code: 000000)');
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to send phone OTP. Please try again.');
    }
  };

  const handleVerifyPhoneOtp = async (codeOverride?: string) => {
    setErrorMessage(null);
    const cleanPhone = phone.replace(/\D/g, '');
    const code = (codeOverride !== undefined ? codeOverride : phoneOtp).trim();
    if (cleanPhone.length !== 10) {
      setErrorMessage(t('enterValid10DigitPhone', 'Please enter a valid 10-digit phone number'));
      return;
    }
    if (code.length < 6) {
      setErrorMessage('Please enter the 6-digit phone OTP');
      return;
    }

    try {
      await verifyPhoneOtp({ phone: cleanPhone, otp: code });
      setIsPhoneVerified(true);
      setPhoneOtpMessage(null);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Incorrect phone verification code.');
    }
  };

  // Step 3: Advance from Basic Details to Hardware Setup
  const handleAdvanceToHardwareStep = async () => {
    setErrorMessage(null);
    const cleanName = displayName.trim();
    const cleanPhone = phone.replace(/\D/g, '');
    if (!cleanName) {
      setErrorMessage(t('enterFullName', 'Please enter your full name or store name'));
      return;
    }
    if (cleanPhone.length !== 10) {
      setErrorMessage(t('enterValid10DigitPhone', 'Please enter a valid 10-digit phone number'));
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

    // Auto-verify phone OTP if not verified yet (default 000000)
    if (!isPhoneVerified) {
      try {
        const code = phoneOtp.trim() || '000000';
        await verifyPhoneOtp({ phone: cleanPhone, otp: code });
        setIsPhoneVerified(true);
      } catch (err: any) {
        setErrorMessage(err?.message || 'Please verify your phone number (default code: 000000)');
        return;
      }
    }

    setStep(4);
  };

  // Verify access code preflight
  const handleVerifyAccessCodePreflight = async (codeToCheck?: string) => {
    const raw = (codeToCheck !== undefined ? codeToCheck : accessCode).trim().toUpperCase();
    if (!raw) {
      setCodeVerificationState('idle');
      setCodeVerificationMsg(null);
      return;
    }

    if (raw.length < 6) {
      setCodeVerificationState('invalid');
      setCodeVerificationMsg(t('codeMinLength', 'Access code must be at least 6-7 alphanumeric characters'));
      return;
    }

    setCodeVerificationState('checking');
    setCodeVerificationMsg(null);

    try {
      const res = await verifyAccessCode(raw);
      if (res?.valid) {
        setCodeVerificationState('valid');
        setCodeVerificationMsg(t('codeVerifiedMsg', 'VIP Priority Support & Hardware Care Activated!'));
      } else {
        setCodeVerificationState('invalid');
        setCodeVerificationMsg(res?.error || t('invalidAccessCode', 'Invalid access code. Please check flyer or contact Support.'));
      }
    } catch (err: any) {
      setCodeVerificationState('invalid');
      setCodeVerificationMsg(err?.message || t('invalidAccessCode', 'Invalid access code. Please check flyer or contact Support.'));
    }
  };

  // Step 4: Final Complete Registration Submit
  const handleCompleteRegistration = async () => {
    setErrorMessage(null);
    const cleanName = displayName.trim();
    const cleanPhone = phone.trim();
    const cleanCode = accessCode.trim().toUpperCase();

    if (hasSeznikPrinter) {
      if (!cleanCode) {
        setErrorMessage(t('enterAccessCodeRequired', 'Please enter the 7-character access code from your printer flyer or contact Customer Support.'));
        return;
      }
    }

    try {
      await register({
        email: email.trim().toLowerCase(),
        phone: cleanPhone,
        displayName: cleanName,
        password,
        hasSeznikPrinter,
        accessCode: hasSeznikPrinter ? cleanCode : undefined,
      });
    } catch (err: any) {
      setErrorMessage(err?.message || 'Registration failed. Please check your information and try again.');
    }
  };

  const handleBackNavigation = () => {
    if (step === 4) setStep(3);
    else if (step === 3) setStep(2);
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
                {step === 3 && t('storeProfileSecurity', 'Store Profile & Password')}
                {step === 4 && t('hardwareVerificationTitle', 'Seznik Hardware Setup')}
              </Text>
              <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
                {step === 1 && t('enterEmailToStart', 'Step 1: Enter your business email to get started')}
                {step === 2 && t('enterOtpSent', `Step 2: Enter the 6-digit code sent to ${email}`)}
                {step === 3 && t('completeProfile', 'Step 3: Setup your store name, contact & password')}
                {step === 4 && t('hardwareVerificationSub', 'Step 4: Hardware setup & printer verification')}
              </Text>

              {/* Stepper Progress Bar (4 steps) */}
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
                <View
                  style={[
                    styles.stepperPill,
                    { backgroundColor: step >= 4 ? BRAND_COLORS.blue600 : theme.borderColor },
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

            {/* STEP 3: PROFILE SETUP & PASSWORD (PAGE 1 BASIC DETAILS) */}
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
                      onChangeText={(val) => {
                        setDisplayName(val);
                        if (errorMessage) setErrorMessage(null);
                      }}
                      onFocus={() => setFocusedField('name')}
                      onBlur={() => setFocusedField(null)}
                      autoCapitalize="words"
                    />
                  </View>
                </View>

                {/* Phone Number with OTP */}
                <View style={styles.inputGroup}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <Text style={[styles.label, { color: theme.textPrimary, marginBottom: 0 }]}>
                      {t('phone', 'Phone Number *')}
                    </Text>
                    {isPhoneVerified ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Check size={14} color="#10B981" style={{ marginRight: 4 }} />
                        <Text style={{ fontSize: 12, fontWeight: '700', color: '#10B981' }}>Verified</Text>
                      </View>
                    ) : null}
                  </View>
                  <View
                    style={[
                      styles.inputWrapper,
                      {
                        backgroundColor: theme.bg,
                        borderColor: isPhoneVerified
                          ? '#10B981'
                          : focusedField === 'phone'
                          ? BRAND_COLORS.blue600
                          : theme.borderColor,
                        borderWidth: isPhoneVerified || focusedField === 'phone' ? 1.5 : 1,
                      },
                    ]}
                  >
                    <Phone size={18} color={focusedField === 'phone' ? BRAND_COLORS.blue600 : theme.textSecondary} style={{ marginRight: 10 }} />
                    <TextInput
                      style={[styles.input, { color: theme.textPrimary }]}
                      placeholder="e.g. 9876543210"
                      placeholderTextColor="#94A3B8"
                      value={phone}
                      maxLength={10}
                      editable={!isPhoneVerified}
                      onChangeText={(val) => {
                        setPhone(val.replace(/\D/g, '').slice(0, 10));
                        if (isPhoneVerified) setIsPhoneVerified(false);
                        if (errorMessage) setErrorMessage(null);
                      }}
                      onFocus={() => setFocusedField('phone')}
                      onBlur={() => setFocusedField(null)}
                      keyboardType="phone-pad"
                    />
                    {!isPhoneVerified && (
                      <TouchableOpacity
                        onPress={handleSendPhoneOtp}
                        disabled={isSendingPhoneOtp || phone.replace(/\D/g, '').length !== 10 || phoneResendCooldown > 0}
                        style={{
                          backgroundColor: BRAND_COLORS.blue600,
                          paddingHorizontal: 10,
                          paddingVertical: 6,
                          borderRadius: 8,
                          opacity: phone.replace(/\D/g, '').length !== 10 || isSendingPhoneOtp ? 0.6 : 1,
                        }}
                      >
                        <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '700' }}>
                          {isSendingPhoneOtp
                            ? 'Sending…'
                            : phoneOtpSent
                            ? phoneResendCooldown > 0
                              ? `${phoneResendCooldown}s`
                              : 'Resend'
                            : 'Verify'}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  {phoneOtpMessage && !isPhoneVerified && (
                    <Text style={{ fontSize: 11, color: BRAND_COLORS.blue600, marginTop: 4, marginLeft: 2 }}>
                      {phoneOtpMessage}
                    </Text>
                  )}
                </View>

                {/* Phone OTP Input Box (when sent or not yet verified) */}
                {phoneOtpSent && !isPhoneVerified && (
                  <View style={styles.inputGroup}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <Text style={[styles.label, { color: theme.textPrimary, marginBottom: 0 }]}>
                        Phone OTP (Dev: 000000)
                      </Text>
                      <TouchableOpacity
                        onPress={() => handleVerifyPhoneOtp('000000')}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Text style={{ fontSize: 11, color: BRAND_COLORS.blue600, fontWeight: '700' }}>
                          Auto-fill 000000
                        </Text>
                      </TouchableOpacity>
                    </View>
                    <View
                      style={[
                        styles.inputWrapper,
                        {
                          backgroundColor: theme.bg,
                          borderColor: focusedField === 'phoneOtp' ? BRAND_COLORS.blue600 : theme.borderColor,
                          borderWidth: focusedField === 'phoneOtp' ? 1.5 : 1,
                        },
                      ]}
                    >
                      <KeyRound size={18} color={focusedField === 'phoneOtp' ? BRAND_COLORS.blue600 : theme.textSecondary} style={{ marginRight: 10 }} />
                      <TextInput
                        style={[styles.input, { color: theme.textPrimary, letterSpacing: 4, fontWeight: '700' }]}
                        placeholder="000000"
                        placeholderTextColor="#94A3B8"
                        value={phoneOtp}
                        maxLength={6}
                        onChangeText={(val) => {
                          setPhoneOtp(val.replace(/\D/g, '').slice(0, 6));
                          if (errorMessage) setErrorMessage(null);
                        }}
                        onFocus={() => setFocusedField('phoneOtp')}
                        onBlur={() => setFocusedField(null)}
                        keyboardType="number-pad"
                      />
                      <TouchableOpacity
                        onPress={() => handleVerifyPhoneOtp()}
                        disabled={isVerifyingPhoneOtp || phoneOtp.length !== 6}
                        style={{
                          backgroundColor: BRAND_COLORS.navyInk,
                          paddingHorizontal: 12,
                          paddingVertical: 6,
                          borderRadius: 8,
                          opacity: phoneOtp.length !== 6 || isVerifyingPhoneOtp ? 0.6 : 1,
                        }}
                      >
                        <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '700' }}>
                          {isVerifyingPhoneOtp ? '...' : 'Verify'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

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
                      onChangeText={(val) => {
                        setPassword(val);
                        if (errorMessage) setErrorMessage(null);
                      }}
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
                      onChangeText={(val) => {
                        setConfirmPassword(val);
                        if (errorMessage) setErrorMessage(null);
                      }}
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
                  onPress={handleAdvanceToHardwareStep}
                  style={[styles.primaryButton, { backgroundColor: BRAND_COLORS.navyInk }]}
                  activeOpacity={0.85}
                >
                  <Text style={styles.primaryButtonText}>
                    {t('continueToHardware', 'Continue to Hardware Setup')}
                  </Text>
                  <ArrowRight size={18} color="#FFFFFF" style={{ marginLeft: 8 }} />
                </TouchableOpacity>
              </View>
            )}

            {/* STEP 4: SEZNIK HARDWARE VERIFICATION (PAGE 2) */}
            {step === 4 && (
              <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
                <Text style={[styles.cardHeading, { color: theme.textPrimary }]}>
                  {t('hardwareVerificationQuestion', 'Are you a Seznik Printer user?')}
                </Text>
                <Text style={[styles.cardSubheading, { color: theme.textSecondary }]}>
                  {t('hardwareVerificationPrompt', 'Verify your printer for plug-and-play setup and active hardware warranty care')}
                </Text>

                {/* Option 1: Seznik Printer Owner (Recommended / VIP) */}
                <TouchableOpacity
                  onPress={() => {
                    setHasSeznikPrinter(true);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  activeOpacity={0.85}
                  style={[
                    styles.hardwareOptionCard,
                    {
                      borderColor: hasSeznikPrinter ? BRAND_COLORS.blue600 : theme.borderColor,
                      backgroundColor: hasSeznikPrinter
                        ? theme.isDark
                          ? 'rgba(37, 99, 235, 0.12)'
                          : 'rgba(37, 99, 235, 0.04)'
                        : theme.bg,
                    },
                  ]}
                >
                  <View style={styles.optionHeaderRow}>
                    <View style={styles.radioRow}>
                      <View
                        style={[
                          styles.radioOuter,
                          { borderColor: hasSeznikPrinter ? BRAND_COLORS.blue600 : theme.borderColor },
                        ]}
                      >
                        {hasSeznikPrinter && <View style={[styles.radioInner, { backgroundColor: BRAND_COLORS.blue600 }]} />}
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                          <Text style={[styles.optionTitle, { color: theme.textPrimary }]}>
                            {t('yesSeznikUser', 'Yes, I am a Seznik Printer User')}
                          </Text>
                          <View style={styles.vipPill}>
                            <Sparkles size={10} color="#D97706" />
                            <Text style={styles.vipPillText}>VIP Priority Tier</Text>
                          </View>
                        </View>
                      </View>
                    </View>
                  </View>

                  {/* VIP Benefit Bullets */}
                  <View style={styles.benefitList}>
                    <View style={styles.benefitItem}>
                      <Zap size={14} color="#D97706" style={{ marginTop: 2 }} />
                      <Text style={[styles.benefitText, { color: theme.textPrimary }]}>
                        <Text style={{ fontWeight: '700' }}>Priority support</Text> & rapid ticket turnaround
                      </Text>
                    </View>
                    <View style={styles.benefitItem}>
                      <Printer size={14} color={BRAND_COLORS.blue600} style={{ marginTop: 2 }} />
                      <Text style={[styles.benefitText, { color: theme.textPrimary }]}>
                        <Text style={{ fontWeight: '700' }}>Dedicated printer hardware care</Text> & direct diagnostics
                      </Text>
                    </View>
                    <View style={styles.benefitItem}>
                      <Shield size={14} color="#10B981" style={{ marginTop: 2 }} />
                      <Text style={[styles.benefitText, { color: theme.textPrimary }]}>
                        <Text style={{ fontWeight: '700' }}>Active hardware warranty</Text> coverage & calibration
                      </Text>
                    </View>
                  </View>

                  {/* Access Code Input Box (Visible when Yes is active) */}
                  {hasSeznikPrinter && (
                    <View style={[styles.codeEntryBox, { borderColor: theme.borderColor, backgroundColor: theme.cardBg }]}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <Text style={[styles.label, { color: theme.textPrimary, marginBottom: 0 }]}>
                          {t('enter7DigitCode', '7-Character Access Code *')}
                        </Text>
                        <Text style={[styles.codeCountHint, { color: theme.textSecondary }]}>
                          {accessCode.length}/7
                        </Text>
                      </View>

                      <View
                        style={[
                          styles.inputWrapper,
                          {
                            backgroundColor: theme.bg,
                            borderColor:
                              codeVerificationState === 'valid'
                                ? '#10B981'
                                : codeVerificationState === 'invalid'
                                ? '#EF4444'
                                : focusedField === 'code'
                                ? BRAND_COLORS.blue600
                                : theme.borderColor,
                            borderWidth: 1.5,
                          },
                        ]}
                      >
                        <KeyRound
                          size={18}
                          color={
                            codeVerificationState === 'valid'
                              ? '#10B981'
                              : focusedField === 'code'
                              ? BRAND_COLORS.blue600
                              : theme.textSecondary
                          }
                          style={{ marginRight: 10 }}
                        />
                        <TextInput
                          style={[
                            styles.input,
                            {
                              color: theme.textPrimary,
                              letterSpacing: 4,
                              fontSize: 16,
                              fontWeight: '800',
                            },
                          ]}
                          placeholder="e.g. K9X2P4A"
                          placeholderTextColor="#94A3B8"
                          value={accessCode}
                          onChangeText={(val) => {
                            const upper = val.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 7);
                            setAccessCode(upper);
                            if (codeVerificationState !== 'idle') {
                              setCodeVerificationState('idle');
                              setCodeVerificationMsg(null);
                            }
                            if (errorMessage) setErrorMessage(null);
                            if (upper.length === 7) {
                              void handleVerifyAccessCodePreflight(upper);
                            }
                          }}
                          onFocus={() => setFocusedField('code')}
                          onBlur={() => {
                            setFocusedField(null);
                            if (accessCode.length >= 6) {
                              void handleVerifyAccessCodePreflight(accessCode);
                            }
                          }}
                          autoCapitalize="characters"
                          autoCorrect={false}
                          maxLength={7}
                        />

                        {codeVerificationState === 'checking' && (
                          <ActivityIndicator size="small" color={BRAND_COLORS.blue600} />
                        )}
                        {codeVerificationState === 'valid' && (
                          <CheckCircle2 size={20} color="#10B981" />
                        )}
                        {codeVerificationState === 'invalid' && (
                          <X size={20} color="#EF4444" />
                        )}
                      </View>

                      {/* Verification Status Feedback */}
                      {codeVerificationMsg ? (
                        <Text
                          style={[
                            styles.verificationFeedback,
                            {
                              color: codeVerificationState === 'valid' ? '#10B981' : '#EF4444',
                            },
                          ]}
                        >
                          {codeVerificationMsg}
                        </Text>
                      ) : null}

                      {/* Instructions */}
                      <View style={styles.infoRow}>
                        <HelpCircle size={13} color={theme.textSecondary} style={{ marginTop: 2, marginRight: 6 }} />
                        <Text style={[styles.infoText, { color: theme.textSecondary }]}>
                          Enter the 7-character access code printed on the welcome flyer inside your Seznik printer package.
                        </Text>
                      </View>

                      {/* Support Callout */}
                      <View style={[styles.supportCallout, { backgroundColor: theme.isDark ? 'rgba(217, 119, 6, 0.12)' : '#FEF3C7', borderColor: '#FDE68A' }]}>
                        <Headphones size={15} color="#D97706" style={{ marginTop: 1, marginRight: 8 }} />
                        <Text style={[styles.supportCalloutText, { color: theme.isDark ? '#FDE68A' : '#92400E' }]}>
                          <Text style={{ fontWeight: '700' }}>Don't have your flyer code? </Text>
                          Contact Support now and our team will generate your VIP code instantly!
                        </Text>
                      </View>
                    </View>
                  )}
                </TouchableOpacity>

                {/* Option 2: Non-Seznik Printer User (Universal Setup / All Feature Access) */}
                <TouchableOpacity
                  onPress={() => {
                    setHasSeznikPrinter(false);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  activeOpacity={0.85}
                  style={[
                    styles.hardwareOptionCard,
                    {
                      borderColor: !hasSeznikPrinter ? BRAND_COLORS.blue600 : theme.borderColor,
                      backgroundColor: !hasSeznikPrinter
                        ? theme.isDark
                           ? 'rgba(37, 99, 235, 0.12)'
                          : 'rgba(37, 99, 235, 0.04)'
                        : theme.bg,
                      marginTop: 12,
                    },
                  ]}
                >
                  <View style={styles.optionHeaderRow}>
                    <View style={styles.radioRow}>
                      <View
                        style={[
                          styles.radioOuter,
                          { borderColor: !hasSeznikPrinter ? BRAND_COLORS.blue600 : theme.borderColor },
                        ]}
                      >
                        {!hasSeznikPrinter && <View style={[styles.radioInner, { backgroundColor: BRAND_COLORS.blue600 }]} />}
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                          <Text style={[styles.optionTitle, { color: theme.textPrimary }]}>
                            {t('noSeznikUser', 'No, I do not have a Seznik Printer')}
                          </Text>
                          <View style={styles.standardPill}>
                            <Text style={styles.standardPillText}>Universal Setup</Text>
                          </View>
                        </View>
                      </View>
                    </View>
                  </View>

                  {/* Standard Bullets: All Feature Access */}
                  <View style={styles.benefitList}>
                    <View style={styles.benefitItem}>
                      <CheckCircle2 size={14} color="#10B981" style={{ marginTop: 2 }} />
                      <Text style={[styles.benefitText, { color: theme.textPrimary }]}>
                        <Text style={{ fontWeight: '700' }}>All feature access</Text> — full POS billing, inventory & tax tools
                      </Text>
                    </View>
                    <View style={styles.benefitItem}>
                      <Printer size={14} color={BRAND_COLORS.blue600} style={{ marginTop: 2 }} />
                      <Text style={[styles.benefitText, { color: theme.textPrimary }]}>
                        <Text style={{ fontWeight: '700' }}>Universal printer compatibility</Text> with any standard thermal or USB printer
                      </Text>
                    </View>
                  </View>

                  {!hasSeznikPrinter && (
                    <View style={[styles.standardNoteBox, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
                      <Text style={[styles.standardNoteText, { color: theme.textSecondary }]}>
                        ℹ️ All POS application features are 100% identical. You can connect any standard printer or link a Seznik printer anytime in Settings.
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>

                {/* Complete Registration Action Button */}
                <TouchableOpacity
                  onPress={handleCompleteRegistration}
                  disabled={isRegistering || isVerifyingAccessCode}
                  style={[
                    styles.primaryButton,
                    { backgroundColor: BRAND_COLORS.navyInk, marginTop: 20 },
                    (isRegistering || isVerifyingAccessCode) && { opacity: 0.7 },
                  ]}
                  activeOpacity={0.85}
                >
                  {isRegistering ? (
                    <ActivityIndicator color="#FFFFFF" style={{ marginRight: 8 }} />
                  ) : (
                    <CheckCircle2 size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                  )}
                  <Text style={styles.primaryButtonText}>
                    {isRegistering
                      ? t('creatingAccount', 'Creating Account...')
                      : t('completeRegistration', 'Create Account & Sign In')}
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
    maxWidth: 200,
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
  hardwareOptionCard: {
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 16,
  },
  optionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  radioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  optionTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  vipPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  vipPillText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#D97706',
  },
  standardPill: {
    backgroundColor: 'rgba(148, 163, 184, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  standardPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
  },
  benefitList: {
    marginTop: 10,
    marginLeft: 30,
    gap: 6,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  benefitText: {
    fontSize: 12,
    lineHeight: 16,
    flex: 1,
  },
  bulletDot: {
    fontSize: 14,
    lineHeight: 16,
  },
  codeEntryBox: {
    marginTop: 14,
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
  },
  codeCountHint: {
    fontSize: 11,
    fontWeight: '600',
  },
  verificationFeedback: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: 6,
    marginLeft: 2,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 8,
  },
  infoText: {
    fontSize: 11,
    lineHeight: 15,
    flex: 1,
  },
  supportCallout: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
    marginTop: 10,
  },
  supportCalloutText: {
    fontSize: 11,
    lineHeight: 16,
    flex: 1,
  },
  standardNoteBox: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
    marginTop: 10,
    marginLeft: 30,
  },
  standardNoteText: {
    fontSize: 11,
    lineHeight: 15,
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
