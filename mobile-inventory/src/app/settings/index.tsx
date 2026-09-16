import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  StyleSheet,
  Image,
  ActivityIndicator,
  Linking,
  StatusBar,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Building,
  FileText,
  Users,
  Globe,
  Printer,
  ChevronRight,
  Check,
  ImageIcon,
  QrCode,
  LifeBuoy,
  Phone,
  MessageCircle,
  Mail,
  Sparkles,
  Trash2,
  Store,
  MapPin,
  MessageSquareHeart,
  Camera,
  ChevronDown,
  ChevronUp,
  Scan,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { useSettings, setCachedSettings } from '@/hooks/useSettings';
import { resolveStoreProfile } from '@/hooks/useStoreProfile';
import { settingsApi, Settings } from '@/api/settings';
import { persistBusinessLogo, clearPersistedBusinessLogo } from '@/utils/businessLogoStorage';
import { useTranslation } from '@/store/useLanguageStore';
import { SUPPORTED_LANGUAGES, LanguageCode } from '@/constants/translations';
import { BRAND_COLORS } from '@/constants/theme';
import { LogoBackgroundModal } from '@/components/common/LogoBackgroundModal';
import { useAppTheme } from '@/hooks/useAppTheme';
import { ScreenBackground } from '@/components/ui/ScreenBackground';
import { KeyboardAvoidingWrapper } from '@/components/ui/KeyboardAvoidingWrapper';
import { BusinessTypeIcon } from '@/components/ui/BusinessTypeIcon';
import { BUSINESS_TYPE_OPTIONS, BusinessType, getBusinessTypeLabel } from '@/constants/businessTypes';
import { setStoredSettings } from '@/services/secureStore';
import { extractUpiFromQrImageAsync, isValidUpiVpa } from '@/utils/billQrService';


const SUPPORT_PHONE = '+918237869618';
const SUPPORT_EMAIL = 'tech_support@seznik.in';

export default function SettingsScreen() {
  const router = useRouter();
  const { user, updateBusinessType, isUpdatingBusinessType } = useAuth();
  const { currentLanguage, setLanguage, t } = useTranslation();
  const { settings, isError: isSettingsError, isRefetching: isSettingsRefetching, refetch: refetchSettings } = useSettings();
  const queryClient = useQueryClient();

  const [activeSection, setActiveSection] = useState<'menu' | 'profile' | 'language' | 'support'>('menu');

  // Business Profile Form State
  const [storeName, setStoreName] = useState('');
  const [storeGstin, setStoreGstin] = useState('');
  const [storePhone, setStorePhone] = useState('');
  const [storeAddress, setStoreAddress] = useState('');
  const [logoUri, setLogoUri] = useState<string | null>(null);
  const [upiId, setUpiId] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [selectedBusinessType, setSelectedBusinessType] = useState<BusinessType>('retail_shop');
  const [showBusinessTypePicker, setShowBusinessTypePicker] = useState(false);

  // Track if user manually typed in each field during the current session
  const userEditedRef = useRef<{ [key: string]: boolean }>({});

  useEffect(() => {
    if (settings || user) {
      const profile = resolveStoreProfile(settings, user);
      if (!userEditedRef.current.storeName && profile.storeName && profile.storeName !== 'Your Store Name') {
        setStoreName(profile.storeName);
      }
      if (!userEditedRef.current.storeGstin && profile.storeGstin) {
        setStoreGstin(profile.storeGstin);
      }
      if (!userEditedRef.current.storePhone && profile.storePhone) {
        setStorePhone(profile.storePhone);
      }
      if (!userEditedRef.current.storeAddress && profile.storeAddress) {
        setStoreAddress(profile.storeAddress);
      }
      const resolvedLogo = profile.storeLogoUrl || settings?.businessLogoURL || null;
      if (!userEditedRef.current.logoUri && resolvedLogo) {
        setLogoUri(resolvedLogo);
      }
      const resolvedUpi = profile.upiId || settings?.upiId || '';
      if (!userEditedRef.current.upiId && resolvedUpi) {
        setUpiId(resolvedUpi);
      }
      if (user?.businessType) {
        setSelectedBusinessType(user.businessType);
      }
    }
  }, [settings, user]);

  useEffect(() => {
    if (activeSection === 'profile' && (settings || user)) {
      const profile = resolveStoreProfile(settings, user);
      if (!storeName && profile.storeName && profile.storeName !== 'Your Store Name') {
        setStoreName(profile.storeName);
      }
      if (!storeGstin && profile.storeGstin) setStoreGstin(profile.storeGstin);
      if (!storePhone && profile.storePhone) setStorePhone(profile.storePhone);
      if (!storeAddress && profile.storeAddress) setStoreAddress(profile.storeAddress);
      if (!logoUri && (profile.storeLogoUrl || settings?.businessLogoURL)) {
        setLogoUri(profile.storeLogoUrl || settings?.businessLogoURL || null);
      }
      if (!upiId && (profile.upiId || settings?.upiId)) {
        setUpiId(profile.upiId || settings?.upiId || '');
      }
    }
  }, [activeSection]);

  const [rawPickedLogo, setRawPickedLogo] = useState<string | null>(null);
  const [showLogoBgModal, setShowLogoBgModal] = useState<boolean>(false);

  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const topPadding = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0, 12);

  const handlePickLogo = async () => {
    const permResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permResult.granted) {
      Alert.alert('Permission Needed', 'Please allow photo library access to set your business logo.');
      return;
    }
    const pickerResult = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsEditing: true,
    });
    if (!pickerResult.canceled && pickerResult.assets[0]?.uri) {
      userEditedRef.current.logoUri = true;
      setLogoUri(pickerResult.assets[0].uri);
    }
  };

  const [isScanningQr, setIsScanningQr] = useState(false);

  const handlePickUpiQrImage = async () => {
    try {
      const permResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permResult.granted) {
        Alert.alert('Permission Needed', 'Please allow photo library access to upload your QR code standee or screenshot.');
        return;
      }
      setIsScanningQr(true);
      const pickerResult = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.9,
        allowsEditing: false,
      });
      if (!pickerResult.canceled && pickerResult.assets[0]?.uri) {
        const assetUri = pickerResult.assets[0].uri;
        const extracted = await extractUpiFromQrImageAsync(assetUri);
        if (extracted && extracted.upiId) {
          userEditedRef.current.upiId = true;
          setUpiId(extracted.upiId);
          if (extracted.payeeName && (!storeName.trim() || storeName === 'Your Store Name')) {
            userEditedRef.current.storeName = true;
            setStoreName(extracted.payeeName);
          }
          Alert.alert(
            'UPI ID Extracted! 🎉',
            `Found UPI ID: ${extracted.upiId}${extracted.payeeName ? `\nMerchant: ${extracted.payeeName}` : ''}\n\nReceipts and POS checkouts will now generate dynamic payment QR codes with the customer's exact invoice total prefilled!`
          );
        } else {
          Alert.alert(
            'QR Code Not Recognized',
            'Could not find a valid UPI QR code in the selected photo. Please check that the QR is clear and well-lit, or type your UPI ID directly.'
          );
        }
      }
    } catch (err: any) {
      Alert.alert('Scan Failed', err?.message || 'Failed to scan QR image. You can enter UPI ID manually.');
    } finally {
      setIsScanningQr(false);
    }
  };

  const handleSaveSettings = async () => {
    if (activeSection !== 'profile') {
      Alert.alert('Settings Saved!', 'Your store configuration has been updated.');
      setActiveSection('menu');
      return;
    }


    try {
      setIsSavingProfile(true);
      let persistedLogo: string | null = logoUri;
      if (logoUri) {
        persistedLogo = await persistBusinessLogo(logoUri);
        setLogoUri(persistedLogo);
      } else {
        await clearPersistedBusinessLogo().catch(() => {});
      }
      const existingReceipt =
        settings?.receiptConfig && typeof settings.receiptConfig === 'object'
          ? settings.receiptConfig
          : {};
      const payload = {
        businessName: storeName.trim() || undefined,
        businessGSTIN: storeGstin.trim() || undefined,
        businessPhone: storePhone.trim() || undefined,
        businessAddress: storeAddress,
        businessLogoURL: persistedLogo ?? null,
        upiId: upiId || undefined,
        receiptConfig: {
          ...existingReceipt,
          companyName: storeName.trim(),
          address: storeAddress,
          phone: storePhone.trim(),
          gstin: storeGstin.trim(),
          logoURL: persistedLogo ?? null,
          ...(upiId ? { upiId } : {}),
          receiptConfigUpdatedAt: new Date().toISOString(),
        },
      };
      let savedResult: Settings;
      if (settings?.id) {
        savedResult = await settingsApi.updateSettings(settings.id, payload);
      } else {
        savedResult = await settingsApi.createSettings(payload);
      }
      if (savedResult) {
        setCachedSettings(savedResult);
        setStoredSettings(savedResult).catch(() => {});
        queryClient.setQueryData(['settings'], savedResult);
      }
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      Alert.alert('Settings Saved!', 'Your store configuration has been updated.');
      setActiveSection('menu');
    } catch (e: any) {
      Alert.alert('Could Not Save', e?.message || 'Please check your connection and try again.');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleSaveBusinessType = async () => {
    if (user?.accountType === 'managed') {
      Alert.alert('Not available', 'Only the store owner can change the business type.');
      return;
    }

    try {
      await updateBusinessType(selectedBusinessType);
      setShowBusinessTypePicker(false);
      Alert.alert('Business type updated', `Navigation is now tailored for ${getBusinessTypeLabel(selectedBusinessType)}.`);
    } catch (e: any) {
      Alert.alert('Could not update', e?.message || 'Please try again.');
    }
  };

  const currentProfile = resolveStoreProfile(settings, user);
  const displayBusinessName = storeName || currentProfile.storeName || settings?.businessName || user?.displayName || 'Seznik Store';
  const displayBusinessType = user?.businessType || selectedBusinessType;
  const currentLangObj = SUPPORTED_LANGUAGES.find((l) => l.code === currentLanguage) || SUPPORTED_LANGUAGES[0];

  return (
    <ScreenBackground color={theme.bg}>
      <StatusBar
        barStyle={theme.isDark ? 'light-content' : 'dark-content'}
        backgroundColor={theme.bg}
      />
      <View style={[styles.container, { backgroundColor: 'transparent', paddingTop: topPadding }]}>
        <KeyboardAvoidingWrapper>
          <View style={styles.mainWrapper}>
            {/* Header Navigation Row */}
            <View style={styles.headerRow}>
              <TouchableOpacity
                onPress={() => (activeSection === 'menu' ? router.back() : setActiveSection('menu'))}
                style={styles.backBtn}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <ArrowLeft size={20} color={theme.textSecondary} />
                <Text style={[styles.backBtnText, { color: theme.textSecondary }]}>
                  {activeSection === 'menu' ? t('back', 'Back') : t('settings', 'Settings Menu')}
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={[styles.title, { color: theme.textPrimary }]}>
              {activeSection === 'menu'
                ? t('settings', 'Settings')
                : activeSection === 'profile'
                ? 'Business Profile'
                : activeSection === 'support'
                ? 'Help & Support'
                : t('appLanguage', 'Language & Locale')}
            </Text>

            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
              {activeSection === 'menu' ? (
                /* Main Menu: Executive Inset Layout */
                <View style={{ gap: 20 }}>
                  {/* Merchant Identity Hero Card */}
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() => setActiveSection('profile')}
                    style={[
                      styles.heroCard,
                      {
                        backgroundColor: theme.isDark ? 'rgba(37, 99, 235, 0.10)' : '#FFFFFF',
                        borderColor: theme.isDark ? 'rgba(56, 189, 248, 0.22)' : BRAND_COLORS.slate200,
                      },
                    ]}
                  >
                    <View style={styles.heroAvatarBox}>
                      {logoUri ? (
                        <Image source={{ uri: logoUri }} style={styles.heroLogoImg} resizeMode="contain" />
                      ) : (
                        <View style={[styles.heroAvatarFallback, { backgroundColor: theme.isDark ? 'rgba(56, 189, 248, 0.18)' : 'rgba(37, 99, 235, 0.12)' }]}>
                          <Store size={26} color={theme.isDark ? BRAND_COLORS.sky400 : BRAND_COLORS.blue600} />
                        </View>
                      )}
                    </View>

                    <View style={{ flex: 1, marginLeft: 14 }}>
                      <Text style={[styles.heroStoreName, { color: theme.textPrimary }]} numberOfLines={1}>
                        {displayBusinessName}
                      </Text>

                      <View style={styles.heroBadgeRow}>
                        <View style={[styles.heroTypePill, { backgroundColor: theme.isDark ? 'rgba(56, 189, 248, 0.16)' : 'rgba(37, 99, 235, 0.1)' }]}>
                          <BusinessTypeIcon type={displayBusinessType} size={14} showContainer={false} />
                          <Text style={[styles.heroTypePillText, { color: theme.isDark ? BRAND_COLORS.sky400 : BRAND_COLORS.blue600 }]}>
                            {getBusinessTypeLabel(displayBusinessType)}
                          </Text>
                        </View>
                      </View>
                    </View>

                    <ChevronRight size={18} color={theme.isDark ? BRAND_COLORS.sky400 : theme.textSecondary} />
                  </TouchableOpacity>

                  {/* Section 1: Store & Team */}
                  <View style={styles.settingsGroup}>
                    <Text style={[styles.groupHeading, { color: theme.textSecondary }]}>STORE & TEAM</Text>
                    <View style={[styles.insetCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
                      <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => setActiveSection('profile')}
                        style={styles.settingRow}
                      >
                        <View style={[styles.iconBox, { backgroundColor: 'rgba(37, 99, 235, 0.12)' }]}>
                          <Building size={18} color={BRAND_COLORS.blue600} />
                        </View>
                        <View style={styles.settingCopy}>
                          <Text style={[styles.settingTitle, { color: theme.textPrimary }]}>Business Profile & Branding</Text>
                          <Text style={[styles.settingSub, { color: theme.textSecondary }]}>Store name, logo, GSTIN & UPI QR</Text>
                        </View>
                        <ChevronRight size={16} color={theme.textSecondary} />
                      </TouchableOpacity>

                      <View style={[styles.rowDivider, { backgroundColor: theme.borderColor }]} />

                      <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => router.push('/staff' as any)}
                        style={styles.settingRow}
                      >
                        <View style={[styles.iconBox, { backgroundColor: 'rgba(139, 92, 246, 0.12)' }]}>
                          <Users size={18} color="#8B5CF6" />
                        </View>
                        <View style={styles.settingCopy}>
                          <Text style={[styles.settingTitle, { color: theme.textPrimary }]}>{t('staffAccounts', 'Staff & Permissions')}</Text>
                          <Text style={[styles.settingSub, { color: theme.textSecondary }]}>Cashiers, managers, PINs & access control</Text>
                        </View>
                        <ChevronRight size={16} color={theme.textSecondary} />
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Section 2: Hardware & Printing */}
                  <View style={styles.settingsGroup}>
                    <Text style={[styles.groupHeading, { color: theme.textSecondary }]}>HARDWARE & PRINTING</Text>
                    <View style={[styles.insetCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
                      <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => router.push('/printers' as any)}
                        style={styles.settingRow}
                      >
                        <View style={[styles.iconBox, { backgroundColor: 'rgba(2, 132, 199, 0.12)' }]}>
                          <Printer size={18} color={BRAND_COLORS.sky500} />
                        </View>
                        <View style={styles.settingCopy}>
                          <Text style={[styles.settingTitle, { color: theme.textPrimary }]}>{t('thermalPrinter', 'Thermal Printers')}</Text>
                          <Text style={[styles.settingSub, { color: theme.textSecondary }]}>Bluetooth pairing, calibration & auto-cut</Text>
                        </View>
                        <ChevronRight size={16} color={theme.textSecondary} />
                      </TouchableOpacity>

                      <View style={[styles.rowDivider, { backgroundColor: theme.borderColor }]} />

                      <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => router.push('/printers/quick-print' as any)}
                        style={styles.settingRow}
                      >
                        <View style={[styles.iconBox, { backgroundColor: 'rgba(6, 182, 212, 0.12)' }]}>
                          <FileText size={18} color="#06B6D4" />
                        </View>
                        <View style={styles.settingCopy}>
                          <Text style={[styles.settingTitle, { color: theme.textPrimary }]}>Quick Thermal Print</Text>
                          <Text style={[styles.settingSub, { color: theme.textSecondary }]}>Text to receipt, tokens & custom notes</Text>
                        </View>
                        <ChevronRight size={16} color={theme.textSecondary} />
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Section 3: Preferences & Community */}
                  <View style={styles.settingsGroup}>
                    <Text style={[styles.groupHeading, { color: theme.textSecondary }]}>PREFERENCES & COMMUNITY</Text>
                    <View style={[styles.insetCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
                      <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => setActiveSection('language')}
                        style={styles.settingRow}
                      >
                        <View style={[styles.iconBox, { backgroundColor: 'rgba(16, 185, 129, 0.12)' }]}>
                          <Globe size={18} color="#10B981" />
                        </View>
                        <View style={styles.settingCopy}>
                          <Text style={[styles.settingTitle, { color: theme.textPrimary }]}>{t('appLanguage', 'Language & Locale')}</Text>
                          <Text style={[styles.settingSub, { color: theme.textSecondary }]}>{currentLangObj.nativeName} ({currentLangObj.name})</Text>
                        </View>
                        <View style={[styles.pillTag, { backgroundColor: theme.isDark ? 'rgba(16, 185, 129, 0.18)' : 'rgba(16, 185, 129, 0.1)' }]}>
                          <Text style={[styles.pillTagText, { color: '#10B981' }]}>{currentLangObj.nativeName}</Text>
                        </View>
                        <ChevronRight size={16} color={theme.textSecondary} style={{ marginLeft: 6 }} />
                      </TouchableOpacity>

                      <View style={[styles.rowDivider, { backgroundColor: theme.borderColor }]} />

                      <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => router.push('/feedback' as any)}
                        style={styles.settingRow}
                      >
                        <View style={[styles.iconBox, { backgroundColor: 'rgba(245, 158, 11, 0.12)' }]}>
                          <MessageSquareHeart size={18} color="#F59E0B" />
                        </View>
                        <View style={styles.settingCopy}>
                          <Text style={[styles.settingTitle, { color: theme.textPrimary }]}>{t('feedback', 'Reviews & Suggestions')}</Text>
                          <Text style={[styles.settingSub, { color: theme.textSecondary }]}>Rate the app, report bugs & suggest features</Text>
                        </View>
                        <ChevronRight size={16} color={theme.textSecondary} />
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Section 4: Help & Support */}
                  <View style={styles.settingsGroup}>
                    <Text style={[styles.groupHeading, { color: theme.textSecondary }]}>HELP & SUPPORT</Text>
                    <View style={[styles.insetCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
                      <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => setActiveSection('support')}
                        style={styles.settingRow}
                      >
                        <View style={[styles.iconBox, { backgroundColor: 'rgba(239, 68, 68, 0.12)' }]}>
                          <LifeBuoy size={18} color="#EF4444" />
                        </View>
                        <View style={styles.settingCopy}>
                          <Text style={[styles.settingTitle, { color: theme.textPrimary }]}>Help & Support Hotline</Text>
                          <Text style={[styles.settingSub, { color: theme.textSecondary }]}>Direct WhatsApp, phone & email concierge</Text>
                        </View>
                        <ChevronRight size={16} color={theme.textSecondary} />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              ) : activeSection === 'support' ? (
                /* Help & Support Section */
                <View style={{ gap: 14 }}>
                  <Text style={{ fontSize: 13, color: theme.textSecondary, marginBottom: 4 }}>
                    {t('needHelp', 'Need help with Seznik POS? Reach us any of these ways:')}
                  </Text>

                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => Linking.openURL(`https://wa.me/${SUPPORT_PHONE.replace(/[^0-9]/g, '')}`)}
                    style={[styles.supportCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}
                  >
                    <View style={[styles.supportIconBox, { backgroundColor: 'rgba(37, 211, 102, 0.14)' }]}>
                      <MessageCircle size={22} color="#25D366" />
                    </View>
                    <View style={{ flex: 1, marginLeft: 14 }}>
                      <Text style={[styles.supportTitle, { color: theme.textPrimary }]}>{t('whatsappSupport', 'WhatsApp Support')}</Text>
                      <Text style={[styles.supportSub, { color: theme.textSecondary }]}>{SUPPORT_PHONE} · Instant Chat</Text>
                    </View>
                    <View style={[styles.actionPill, { backgroundColor: 'rgba(37, 211, 102, 0.15)' }]}>
                      <Text style={{ color: '#25D366', fontWeight: '800', fontSize: 11 }}>Chat</Text>
                    </View>
                  </TouchableOpacity>

                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => Linking.openURL(`tel:${SUPPORT_PHONE}`)}
                    style={[styles.supportCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}
                  >
                    <View style={[styles.supportIconBox, { backgroundColor: 'rgba(16, 185, 129, 0.14)' }]}>
                      <Phone size={22} color="#10B981" />
                    </View>
                    <View style={{ flex: 1, marginLeft: 14 }}>
                      <Text style={[styles.supportTitle, { color: theme.textPrimary }]}>{t('callSupport', 'Phone Support')}</Text>
                      <Text style={[styles.supportSub, { color: theme.textSecondary }]}>{SUPPORT_PHONE}</Text>
                    </View>
                    <View style={[styles.actionPill, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
                      <Text style={{ color: '#10B981', fontWeight: '800', fontSize: 11 }}>Call</Text>
                    </View>
                  </TouchableOpacity>

                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`)}
                    style={[styles.supportCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}
                  >
                    <View style={[styles.supportIconBox, { backgroundColor: 'rgba(37, 99, 235, 0.14)' }]}>
                      <Mail size={22} color={BRAND_COLORS.blue600} />
                    </View>
                    <View style={{ flex: 1, marginLeft: 14 }}>
                      <Text style={[styles.supportTitle, { color: theme.textPrimary }]}>{t('emailSupport', 'Email Support')}</Text>
                      <Text style={[styles.supportSub, { color: theme.textSecondary }]}>{SUPPORT_EMAIL}</Text>
                    </View>
                    <View style={[styles.actionPill, { backgroundColor: 'rgba(37, 99, 235, 0.15)' }]}>
                      <Text style={{ color: BRAND_COLORS.blue600, fontWeight: '800', fontSize: 11 }}>Email</Text>
                    </View>
                  </TouchableOpacity>

                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => router.push('/feedback' as any)}
                    style={[styles.supportCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}
                  >
                    <View style={[styles.supportIconBox, { backgroundColor: 'rgba(245, 158, 11, 0.14)' }]}>
                      <MessageSquareHeart size={22} color="#F59E0B" />
                    </View>
                    <View style={{ flex: 1, marginLeft: 14 }}>
                      <Text style={[styles.supportTitle, { color: theme.textPrimary }]}>{t('suggestFeature', 'Reviews & Suggestions')}</Text>
                      <Text style={[styles.supportSub, { color: theme.textSecondary }]}>{t('rateApp', 'Rate the app & leave ideas')}</Text>
                    </View>
                    <ChevronRight size={18} color={theme.textSecondary} />
                  </TouchableOpacity>
                </View>
              ) : activeSection === 'profile' ? (
                /* Business Profile Section */
                <View style={{ gap: 16 }}>
                  {isSettingsError ? (
                    <View style={[styles.settingsErrorBanner, { backgroundColor: theme.isDark ? '#3F1D1D' : '#FEF2F2', borderColor: '#EF4444' }]}>
                      <Text style={[styles.settingsErrorText, { color: theme.textPrimary }]}>
                        {t('settingsLoadError', "Couldn't load saved business details — showing defaults. Saving will overwrite them.")}
                      </Text>
                      <TouchableOpacity onPress={() => refetchSettings()} disabled={isSettingsRefetching} style={styles.settingsErrorRetryBtn}>
                        {isSettingsRefetching ? (
                          <ActivityIndicator size="small" color="#EF4444" />
                        ) : (
                          <Text style={styles.settingsErrorRetryText}>{t('retry', 'Retry')}</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  ) : null}

                  {/* Logo Upload Squircle Card */}
                  <View style={[styles.profileCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
                    <Text style={[styles.cardHeaderTitle, { color: theme.textPrimary }]}>{t('businessLogo', 'Business Logo')}</Text>
                    <Text style={[styles.cardHeaderSub, { color: theme.textSecondary }]}>
                      {t('businessLogoSub', 'Prints at the top of every thermal receipt')}
                    </Text>

                    <View style={styles.logoSectionRow}>
                      <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={handlePickLogo}
                        style={[styles.logoSquircle, { backgroundColor: theme.isDark ? '#18181B' : '#F8FAFC', borderColor: theme.borderColor }]}
                      >
                        {logoUri ? (
                          <Image source={{ uri: logoUri }} style={styles.logoImagePreview} resizeMode="contain" />
                        ) : (
                          <View style={styles.logoPlaceholderContent}>
                            <Camera size={24} color={theme.textSecondary} />
                            <Text style={[styles.logoPlaceholderText, { color: theme.textSecondary }]}>Upload</Text>
                          </View>
                        )}
                      </TouchableOpacity>

                      <View style={styles.logoButtonsCol}>
                        <TouchableOpacity
                          activeOpacity={0.7}
                          onPress={handlePickLogo}
                          style={[styles.logoBtnPill, { backgroundColor: theme.isDark ? 'rgba(37, 99, 235, 0.2)' : 'rgba(37, 99, 235, 0.1)', borderColor: BRAND_COLORS.blue600 }]}
                        >
                          <ImageIcon size={13} color={BRAND_COLORS.blue600} />
                          <Text style={[styles.logoBtnPillText, { color: BRAND_COLORS.blue600 }]}>
                            {logoUri ? 'Replace Logo' : 'Select Photo'}
                          </Text>
                        </TouchableOpacity>

                        {logoUri ? (
                          <>
                            <TouchableOpacity
                              activeOpacity={0.7}
                              onPress={() => {
                                setRawPickedLogo(logoUri);
                                setShowLogoBgModal(true);
                              }}
                              style={[styles.logoBtnPill, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}
                            >
                              <Sparkles size={13} color={theme.textPrimary} />
                              <Text style={[styles.logoBtnPillText, { color: theme.textPrimary }]}>AI Background</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                              activeOpacity={0.7}
                              onPress={() => {
                                userEditedRef.current.logoUri = true;
                                setLogoUri(null);
                              }}
                              style={[styles.logoBtnPill, { backgroundColor: 'rgba(239, 68, 68, 0.1)', borderColor: 'rgba(239, 68, 68, 0.3)' }]}
                            >
                              <Trash2 size={13} color="#EF4444" />
                              <Text style={[styles.logoBtnPillText, { color: '#EF4444' }]}>Remove</Text>
                            </TouchableOpacity>
                          </>
                        ) : null}
                      </View>
                    </View>
                  </View>

                  {/* Business Type Selection */}
                  {user?.accountType !== 'managed' ? (
                    <View style={[styles.profileCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
                      <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() => setShowBusinessTypePicker(!showBusinessTypePicker)}
                        style={styles.businessTypeHeaderRow}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.cardHeaderTitle, { color: theme.textPrimary }]}>Business Type</Text>
                          <Text style={[styles.cardHeaderSub, { color: theme.textSecondary }]}>
                            Current: <Text style={{ color: BRAND_COLORS.blue600, fontWeight: '800' }}>{getBusinessTypeLabel(selectedBusinessType)}</Text>
                          </Text>
                        </View>
                        {showBusinessTypePicker ? (
                          <ChevronUp size={20} color={theme.textSecondary} />
                        ) : (
                          <ChevronDown size={20} color={theme.textSecondary} />
                        )}
                      </TouchableOpacity>

                      {showBusinessTypePicker ? (
                        <View style={{ marginTop: 12, gap: 8 }}>
                          {BUSINESS_TYPE_OPTIONS.map((option) => {
                            const isSelected = selectedBusinessType === option.id;
                            return (
                              <TouchableOpacity
                                key={option.id}
                                activeOpacity={0.75}
                                onPress={() => setSelectedBusinessType(option.id)}
                                style={[
                                  styles.businessTypeOptionCard,
                                  {
                                    backgroundColor: isSelected ? (theme.isDark ? 'rgba(37, 99, 235, 0.2)' : 'rgba(37, 99, 235, 0.08)') : theme.cardBg,
                                    borderColor: isSelected ? BRAND_COLORS.blue600 : theme.borderColor,
                                  },
                                ]}
                              >
                                <BusinessTypeIcon type={option.id} selected={isSelected} size={22} />
                                <View style={{ flex: 1, marginLeft: 12 }}>
                                  <Text style={[styles.businessTypeOptionTitle, { color: theme.textPrimary }]}>{option.label}</Text>
                                  <Text style={[styles.businessTypeOptionDesc, { color: theme.textSecondary }]}>{option.description}</Text>
                                </View>
                                {isSelected ? <Check size={18} color={BRAND_COLORS.blue600} /> : null}
                              </TouchableOpacity>
                            );
                          })}

                          <TouchableOpacity
                            onPress={handleSaveBusinessType}
                            disabled={isUpdatingBusinessType || selectedBusinessType === user?.businessType}
                            style={[
                              styles.updateBusinessTypeBtn,
                              (isUpdatingBusinessType || selectedBusinessType === user?.businessType) && { opacity: 0.6 },
                            ]}
                          >
                            {isUpdatingBusinessType ? (
                              <ActivityIndicator color="#FFFFFF" size="small" />
                            ) : (
                              <Text style={styles.updateBusinessTypeBtnText}>Update Navigation for {getBusinessTypeLabel(selectedBusinessType)}</Text>
                            )}
                          </TouchableOpacity>
                        </View>
                      ) : null}
                    </View>
                  ) : null}

                  {/* Store Details Input Group */}
                  <View style={[styles.profileCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
                    <Text style={[styles.cardHeaderTitle, { color: theme.textPrimary }]}>Store Contact & Legal Info</Text>

                    <View style={styles.inputFieldGroup}>
                      <Text style={[styles.inputLabel, { color: theme.textPrimary }]}>{t('businessName', 'Store / Business Name')}</Text>
                      <View style={[styles.inputWrapper, { backgroundColor: theme.isDark ? '#18181B' : '#F8FAFC', borderColor: theme.borderColor }]}>
                        <Store size={18} color={theme.textSecondary} style={styles.fieldIcon} />
                        <TextInput
                          style={[styles.inputControl, { color: theme.textPrimary }]}
                          value={storeName}
                          onChangeText={(text) => {
                            userEditedRef.current.storeName = true;
                            setStoreName(text);
                          }}
                          placeholder="e.g. Blue Moon Cafe & Retail"
                          placeholderTextColor="#94A3B8"
                        />
                      </View>
                    </View>

                    <View style={styles.inputFieldGroup}>
                      <Text style={[styles.inputLabel, { color: theme.textPrimary }]}>{t('taxIdGstin', 'GSTIN Number')}</Text>
                      <View style={[styles.inputWrapper, { backgroundColor: theme.isDark ? '#18181B' : '#F8FAFC', borderColor: theme.borderColor }]}>
                        <FileText size={18} color={theme.textSecondary} style={styles.fieldIcon} />
                        <TextInput
                          style={[styles.inputControl, { color: theme.textPrimary }]}
                          value={storeGstin}
                          onChangeText={(text) => {
                            userEditedRef.current.storeGstin = true;
                            setStoreGstin(text);
                          }}
                          placeholder="22AAAAA0000A1Z5"
                          placeholderTextColor="#94A3B8"
                          autoCapitalize="characters"
                        />
                      </View>
                    </View>

                    <View style={styles.inputFieldGroup}>
                      <Text style={[styles.inputLabel, { color: theme.textPrimary }]}>{t('businessPhone', 'Store Phone Number')}</Text>
                      <View style={[styles.inputWrapper, { backgroundColor: theme.isDark ? '#18181B' : '#F8FAFC', borderColor: theme.borderColor }]}>
                        <Phone size={18} color={theme.textSecondary} style={styles.fieldIcon} />
                        <TextInput
                          style={[styles.inputControl, { color: theme.textPrimary }]}
                          value={storePhone}
                          onChangeText={(text) => {
                            userEditedRef.current.storePhone = true;
                            setStorePhone(text);
                          }}
                          placeholder="+91 98765 43210"
                          placeholderTextColor="#94A3B8"
                          keyboardType="phone-pad"
                        />
                      </View>
                    </View>

                    <View style={styles.inputFieldGroup}>
                      <Text style={[styles.inputLabel, { color: theme.textPrimary }]}>{t('businessAddress', 'Store Address')}</Text>
                      <View style={[styles.inputWrapper, styles.multilineWrapper, { backgroundColor: theme.isDark ? '#18181B' : '#F8FAFC', borderColor: theme.borderColor }]}>
                        <MapPin size={18} color={theme.textSecondary} style={[styles.fieldIcon, { marginTop: 4 }]} />
                        <TextInput
                          style={[styles.inputControl, styles.multilineInput, { color: theme.textPrimary }]}
                          value={storeAddress}
                          onChangeText={(text) => {
                            userEditedRef.current.storeAddress = true;
                            setStoreAddress(text);
                          }}
                          placeholder="Street, City, State, PIN"
                          placeholderTextColor="#94A3B8"
                          multiline
                          numberOfLines={3}
                          textAlignVertical="top"
                        />
                      </View>
                    </View>

                    <View style={styles.inputFieldGroup}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <Text style={[styles.inputLabel, { color: theme.textPrimary, marginBottom: 0 }]}>UPI ID (VPA)</Text>
                          <Text style={[styles.inputHelp, { color: theme.textSecondary }]}>· Dynamic Receipt QR</Text>
                        </View>
                        <TouchableOpacity
                          activeOpacity={0.75}
                          onPress={handlePickUpiQrImage}
                          disabled={isScanningQr}
                          style={[
                            styles.miniQrScanBtn,
                            {
                              backgroundColor: theme.isDark ? 'rgba(37, 99, 235, 0.2)' : 'rgba(37, 99, 235, 0.08)',
                              borderColor: BRAND_COLORS.blue600,
                            },
                          ]}
                        >
                          {isScanningQr ? (
                            <ActivityIndicator size="small" color={BRAND_COLORS.blue600} />
                          ) : (
                            <>
                              <Scan size={13} color={BRAND_COLORS.blue600} />
                              <Text style={[styles.miniQrScanBtnText, { color: BRAND_COLORS.blue600 }]}>
                                Upload Standee QR
                              </Text>
                            </>
                          )}
                        </TouchableOpacity>
                      </View>
                      <View style={[styles.inputWrapper, { backgroundColor: theme.isDark ? '#18181B' : '#F8FAFC', borderColor: theme.borderColor }]}>
                        <QrCode size={18} color={theme.textSecondary} style={styles.fieldIcon} />
                        <TextInput
                          style={[styles.inputControl, { color: theme.textPrimary }]}
                          value={upiId}
                          onChangeText={(text) => {
                            userEditedRef.current.upiId = true;
                            setUpiId(text);
                          }}
                          placeholder="storename@okhdfcbank"
                          placeholderTextColor="#94A3B8"
                          autoCapitalize="none"
                        />
                      </View>
                      <Text style={[styles.helperText, { color: theme.textSecondary, marginTop: 4, fontSize: 11 }]}>
                        {upiId.trim() && isValidUpiVpa(upiId.trim())
                          ? '✅ Enabled: Thermal receipts & POS checkouts will automatically encode each bill’s exact amount.'
                          : 'Upload a photo of your QR standee to auto-extract your UPI ID, or type it manually.'}
                      </Text>
                    </View>
                  </View>


                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={handleSaveSettings}
                    disabled={isSavingProfile}
                    style={[
                      styles.saveProfileBtn,
                      {
                        backgroundColor: theme.isDark ? BRAND_COLORS.blue600 : BRAND_COLORS.navyInk,
                      },
                      isSavingProfile && { opacity: 0.6 },
                    ]}
                  >
                    {isSavingProfile ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <Text style={styles.saveProfileBtnText}>Save Business Profile</Text>
                    )}
                  </TouchableOpacity>
                </View>
              ) : (
                /* Language Switcher Section */
                <View style={{ gap: 10 }}>
                  <Text style={[styles.groupHeading, { color: theme.textSecondary }]}>SELECT PREFERRED LANGUAGE</Text>
                  <View style={[styles.insetCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
                    {SUPPORTED_LANGUAGES.map((lang, idx) => {
                      const isSelected = currentLanguage === lang.code;
                      return (
                        <React.Fragment key={lang.code}>
                          <TouchableOpacity
                            activeOpacity={0.7}
                            onPress={() => setLanguage(lang.code as LanguageCode)}
                            style={styles.langRow}
                          >
                            <View style={{ flex: 1 }}>
                              <Text style={[styles.langNativeName, { color: isSelected ? BRAND_COLORS.blue600 : theme.textPrimary }]}>
                                {lang.nativeName}
                              </Text>
                              <Text style={[styles.langEnglishName, { color: theme.textSecondary }]}>
                                {lang.name}
                              </Text>
                            </View>
                            {isSelected ? (
                              <View style={styles.langCheckCircle}>
                                <Check size={16} color="#FFFFFF" strokeWidth={3} />
                              </View>
                            ) : null}
                          </TouchableOpacity>
                          {idx < SUPPORTED_LANGUAGES.length - 1 ? (
                            <View style={[styles.rowDivider, { backgroundColor: theme.borderColor }]} />
                          ) : null}
                        </React.Fragment>
                      );
                    })}
                  </View>
                </View>
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingWrapper>

        <LogoBackgroundModal
          visible={showLogoBgModal}
          imageUri={rawPickedLogo}
          onApply={(finalUri) => {
            userEditedRef.current.logoUri = true;
            setLogoUri(finalUri);
            setShowLogoBgModal(false);
          }}
          onCancel={() => setShowLogoBgModal(false)}
        />
      </View>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  mainWrapper: { flex: 1, paddingHorizontal: 16, paddingTop: 4 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  backBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 4, marginLeft: -4 },
  backBtnText: { fontSize: 13, fontWeight: '600', marginLeft: 4 },
  title: { fontSize: 24, fontWeight: '900', marginBottom: 14, letterSpacing: -0.3 },

  // Merchant Hero Card
  heroCard: {
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  heroAvatarBox: {
    width: 52,
    height: 52,
    borderRadius: 16,
    overflow: 'hidden',
  },
  heroLogoImg: {
    width: '100%',
    height: '100%',
  },
  heroAvatarFallback: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroStoreName: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  heroBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 8,
    flexWrap: 'wrap',
  },
  heroTypePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  heroTypePillText: {
    fontSize: 11,
    fontWeight: '700',
  },

  // Grouped Inset Cards
  settingsGroup: {
    gap: 8,
  },
  groupHeading: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginLeft: 4,
  },
  insetCard: {
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 14,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingCopy: {
    flex: 1,
    marginLeft: 12,
    marginRight: 6,
  },
  settingTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  settingSub: {
    fontSize: 11,
    marginTop: 2,
  },
  rowDivider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 62,
  },
  pillTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  pillTagText: {
    fontSize: 11,
    fontWeight: '700',
  },

  // Support Screen Cards
  supportCard: {
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  supportIconBox: {
    width: 44,
    height: 44,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  supportTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  supportSub: {
    fontSize: 12,
    marginTop: 2,
  },
  actionPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },

  // Business Profile Form
  profileCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
  },
  cardHeaderTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  cardHeaderSub: {
    fontSize: 11,
    marginTop: 2,
    marginBottom: 12,
  },
  logoSectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  logoSquircle: {
    width: 84,
    height: 84,
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoImagePreview: {
    width: '100%',
    height: '100%',
  },
  logoPlaceholderContent: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  logoPlaceholderText: {
    fontSize: 10,
    fontWeight: '700',
  },
  logoButtonsCol: {
    flex: 1,
    gap: 8,
  },
  logoBtnPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  logoBtnPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  businessTypeHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  businessTypeOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  businessTypeOptionTitle: {
    fontSize: 13,
    fontWeight: '800',
  },
  businessTypeOptionDesc: {
    fontSize: 11,
    marginTop: 2,
  },
  updateBusinessTypeBtn: {
    backgroundColor: BRAND_COLORS.blue600,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  updateBusinessTypeBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 12,
  },
  inputFieldGroup: {
    marginTop: 12,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
  },
  inputHelp: {
    fontSize: 10,
    marginLeft: 6,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 46,
  },
  multilineWrapper: {
    height: 84,
    alignItems: 'flex-start',
    paddingVertical: 8,
  },
  fieldIcon: {
    marginRight: 10,
  },
  inputControl: {
    flex: 1,
    fontSize: 14,
  },
  multilineInput: {
    height: '100%',
  },
  saveProfileBtn: {
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  saveProfileBtnText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 15,
  },

  // Language Selection
  langRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  langNativeName: {
    fontSize: 15,
    fontWeight: '700',
  },
  langEnglishName: {
    fontSize: 11,
    marginTop: 2,
  },
  langCheckCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: BRAND_COLORS.blue600,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Error Banner
  settingsErrorBanner: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingsErrorText: { flex: 1, fontSize: 12, fontWeight: '600', lineHeight: 17, marginRight: 10 },
  settingsErrorRetryBtn: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 10, backgroundColor: 'rgba(239, 68, 68, 0.12)', minWidth: 56, alignItems: 'center' },
  settingsErrorRetryText: { color: '#EF4444', fontWeight: '800', fontSize: 12 },

  miniQrScanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 5,
    paddingHorizontal: 9,
    borderRadius: 8,
    borderWidth: 1,
  },
  miniQrScanBtnText: {
    fontSize: 11,
    fontWeight: '800',
  },
  helperText: {
    fontSize: 11,
    lineHeight: 16,
  },
});


