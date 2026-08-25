import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Switch,
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
  User,
  FileText,
  Bell,
  Users,
  Shield,
  Globe,
  Printer,
  Percent,
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
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { useSettings } from '@/hooks/useSettings';
import { settingsApi } from '@/api/settings';
import { persistBusinessLogo } from '@/utils/businessLogoStorage';
import { useLanguageStore, useTranslation } from '@/store/useLanguageStore';
import { SUPPORTED_LANGUAGES, LanguageCode } from '@/constants/translations';
import { BRAND_COLORS } from '@/constants/theme';
import { LogoBackgroundModal } from '@/components/common/LogoBackgroundModal';
import { useAppTheme } from '@/hooks/useAppTheme';
import { ScreenBackground } from '@/components/ui/ScreenBackground';
import { KeyboardAvoidingWrapper } from '@/components/ui/KeyboardAvoidingWrapper';
import { FeatureGridTile } from '@/components/ui/FeatureGridTile';
import { GstBillingSettingsPanel } from '@/components/billing/GstBillingSettingsPanel';
import { useGstBillingSettings } from '@/hooks/useGstBillingSettings';
import {
  BillChargePreset,
  DEFAULT_RESTAURANT_PRESETS,
  createPresetId,
  parseRestaurantBilling,
  toRestaurantBillingPayload,
} from '@/constants/restaurantBilling';
import { BUSINESS_TYPE_OPTIONS, BusinessType, getBusinessTypeLabel } from '@/constants/businessTypes';

const SUPPORT_PHONE = '+918237869618';
const SUPPORT_EMAIL = 'tech_support@seznik.in';

export default function SettingsScreen() {
  const router = useRouter();
  const { user, updateBusinessType, isUpdatingBusinessType } = useAuth();
  const { currentLanguage, setLanguage, t } = useTranslation();
  const { settings, isError: isSettingsError, isRefetching: isSettingsRefetching, refetch: refetchSettings } = useSettings();
  const {
    form: gstForm,
    setShowBreakdown: setGstShowBreakdown,
    setStyle: setGstStyle,
    setPrintOnReceipt: setGstPrintOnReceipt,
    setItemWiseGst: setGstItemWise,
    saveGstBilling,
    isSaving: isSavingGstBilling,
  } = useGstBillingSettings();
  const queryClient = useQueryClient();

  const [activeSection, setActiveSection] = useState<
    'menu' | 'profile' | 'invoice' | 'permissions' | 'language' | 'notifications' | 'support'
  >('menu');

  // Business Profile Form State — seeded from the real backend Settings once loaded, not hardcoded.
  const [storeName, setStoreName] = useState('');
  const [storeGstin, setStoreGstin] = useState('');
  const [storePhone, setStorePhone] = useState('');
  const [storeAddress, setStoreAddress] = useState('');
  const [logoUri, setLogoUri] = useState<string | null>(null);
  const [upiId, setUpiId] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [chargePresets, setChargePresets] = useState<BillChargePreset[]>(DEFAULT_RESTAURANT_PRESETS);
  const [selectedBusinessType, setSelectedBusinessType] = useState<BusinessType>('retail_shop');

  // Seed the form once real Settings arrive from the backend — done as a conditional setState
  // during render (React's documented pattern for "adjust state when a prop/query result
  // changes") rather than in a useEffect, so it doesn't trigger a redundant extra render.
  const [hasSeededProfile, setHasSeededProfile] = useState(false);
  const [hasSeededBusinessType, setHasSeededBusinessType] = useState(false);
  if (settings && !hasSeededProfile) {
    setStoreName(settings.businessName || user?.businessName || user?.displayName || '');
    setStoreGstin(settings.businessGSTIN || '');
    setStorePhone(settings.businessPhone || user?.phone || '');
    setStoreAddress(settings.businessAddress || '');
    setLogoUri(settings.businessLogoURL || null);
    setUpiId(settings.upiId || '');
    const restaurant = parseRestaurantBilling(settings.invoiceConfig);
    setChargePresets(restaurant.presets);
    setHasSeededProfile(true);
  }
  if (user && !hasSeededBusinessType) {
    if (user.businessType) {
      setSelectedBusinessType(user.businessType);
    }
    setHasSeededBusinessType(true);
  }

  // ManagedUser Granular Permissions State
  const [perms, setPerms] = useState({
    canManipulateStock: true,
    canAccessSuppliers: true,
    canAccessPurchases: false,
    canAccessExpenses: false,
    canAccessReports: false,
    canManageUsers: false,
  });

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
      setLogoUri(pickerResult.assets[0].uri);
    }
  };

  const handleSaveGstBilling = async () => {
    try {
      await saveGstBilling({
        extraInvoiceConfig: {
          restaurantBilling: toRestaurantBillingPayload({ presets: chargePresets }),
        },
        onSuccess: () => {
          Alert.alert('GST Billing Saved', 'Customer bills will use this GST breakdown from the next sale.');
          setActiveSection('menu');
        },
      });
    } catch (e: any) {
      Alert.alert('Could Not Save', e?.message || 'Please check your connection and try again.');
    }
  };

  const handleSaveSettings = async () => {
    if (activeSection === 'invoice') {
      await handleSaveGstBilling();
      return;
    }
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
      }
      const payload = {
        businessName: storeName.trim() || undefined,
        businessGSTIN: storeGstin.trim() || undefined,
        businessPhone: storePhone.trim() || undefined,
        businessAddress: storeAddress,
        businessLogoURL: persistedLogo ?? null,
        upiId: upiId || undefined,
      };
      if (settings?.id) {
        await settingsApi.updateSettings(settings.id, payload);
      } else {
        await settingsApi.createSettings(payload);
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
      Alert.alert('Business type updated', `Navigation is now tailored for ${getBusinessTypeLabel(selectedBusinessType)}.`);
    } catch (e: any) {
      Alert.alert('Could not update', e?.message || 'Please try again.');
    }
  };

  const multiStoreEnabled = settings?.locationConfig?.enabled ?? false;
  const [isTogglingMultiStore, setIsTogglingMultiStore] = useState(false);

  const toggleMultiStore = async (value: boolean) => {
    setIsTogglingMultiStore(true);
    try {
      if (settings?.id) {
        await settingsApi.updateSettings(settings.id, { locationConfig: { enabled: value } });
      } else {
        await settingsApi.createSettings({ locationConfig: { enabled: value } });
      }
      queryClient.invalidateQueries({ queryKey: ['settings'] });
    } catch (e: any) {
      Alert.alert('Could Not Save', e?.message || 'Please check your connection and try again.');
    } finally {
      setIsTogglingMultiStore(false);
    }
  };

  return (
    <ScreenBackground color={theme.bg}>
      <StatusBar
        barStyle={theme.isDark ? 'light-content' : 'dark-content'}
        backgroundColor={theme.bg}
      />
      <View style={[styles.container, { backgroundColor: 'transparent', paddingTop: topPadding }]}>
      <KeyboardAvoidingWrapper>
      <View style={styles.mainWrapper}>
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
            ? t('settings', 'Store Configuration')
            : activeSection === 'profile'
            ? 'Business Profile'
            : activeSection === 'invoice'
            ? 'Tax & Billing'
            : activeSection === 'permissions'
            ? 'Staff Permissions'
            : activeSection === 'support'
            ? 'Help & Support'
            : t('appLanguage', 'Language & Locale')}
        </Text>

        <ScrollView style={{ flex: 1, marginTop: 12 }} contentContainerStyle={{ paddingBottom: 40 }}>
          {activeSection === 'menu' ? (
            /* Main Menu Grid */
            <View>
              <View style={[styles.multiStoreCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
                <View style={[styles.menuIconBox, { backgroundColor: 'rgba(37, 99, 235, 0.12)' }]}>
                  <Store size={20} color={BRAND_COLORS.blue600} />
                </View>
                <View style={{ flex: 1, marginLeft: 12, marginRight: 8 }}>
                  <Text style={[styles.menuTitle, { color: theme.textPrimary }]}>
                    {t('enableMultiStore', 'Enable Multi-Store Inventory')}
                  </Text>
                  <Text style={[styles.menuSub, { color: theme.textSecondary }]}>
                    {t(
                      'enableMultiStoreDesc',
                      'Track separate stock & price per store. Off = billing works exactly as one store.'
                    )}
                  </Text>
                </View>
                {isTogglingMultiStore ? (
                  <ActivityIndicator size="small" color={BRAND_COLORS.blue600} />
                ) : (
                  <Switch
                    value={multiStoreEnabled}
                    onValueChange={toggleMultiStore}
                    trackColor={{ false: '#64748B', true: BRAND_COLORS.blue600 }}
                  />
                )}
              </View>

              <View style={styles.menuGrid}>
              {[
                { id: 'profile', icon: Building, label: 'Business Profile', color: BRAND_COLORS.blue600 },
                { id: 'invoice', icon: Percent, label: 'Tax & Billing', color: '#0F766E' },
                { id: 'permissions', icon: Users, label: 'Staff Permissions', color: '#F59E0B' },
                { id: 'language', icon: Globe, label: t('appLanguage', 'Language'), color: '#10B981' },
                { id: 'printers', icon: Printer, label: t('thermalPrinter', 'Printers'), color: BRAND_COLORS.sky500, link: '/printers' },
                { id: 'stores', icon: Store, label: t('stores', 'Stores'), color: '#2563EB', link: '/stores' },
                { id: 'support', icon: LifeBuoy, label: 'Help & Support', color: '#EF4444' },
              ].map((item) => (
                <FeatureGridTile
                  key={item.id}
                  label={item.label}
                  icon={item.icon}
                  color={item.color}
                  onPress={() => (item.link ? router.push(item.link as any) : setActiveSection(item.id as any))}
                  theme={theme}
                />
              ))}
              </View>
            </View>
          ) : activeSection === 'support' ? (
            /* Help & Support Section */
            <View>
              <Text style={{ fontSize: 12, color: theme.textSecondary, marginBottom: 14 }}>
                {t('needHelp', 'Need help with Seznik POS? Reach us any of these ways:')}
              </Text>
              <TouchableOpacity
                onPress={() => Linking.openURL(`tel:${SUPPORT_PHONE}`)}
                style={[styles.menuItem, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}
              >
                <View style={[styles.menuIconBox, { backgroundColor: 'rgba(16, 185, 129, 0.12)' }]}>
                  <Phone size={20} color="#10B981" />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={[styles.menuTitle, { color: theme.textPrimary }]}>{t('callSupport', 'Call Support')}</Text>
                  <Text style={[styles.menuSub, { color: theme.textSecondary }]}>{SUPPORT_PHONE}</Text>
                </View>
                <ChevronRight size={18} color={theme.textSecondary} />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => Linking.openURL(`https://wa.me/${SUPPORT_PHONE.replace(/[^0-9]/g, '')}`)}
                style={[styles.menuItem, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}
              >
                <View style={[styles.menuIconBox, { backgroundColor: 'rgba(16, 185, 129, 0.12)' }]}>
                  <MessageCircle size={20} color="#10B981" />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={[styles.menuTitle, { color: theme.textPrimary }]}>{t('whatsappSupport', 'WhatsApp Support')}</Text>
                  <Text style={[styles.menuSub, { color: theme.textSecondary }]}>{SUPPORT_PHONE}</Text>
                </View>
                <ChevronRight size={18} color={theme.textSecondary} />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`)}
                style={[styles.menuItem, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}
              >
                <View style={styles.menuIconBox}>
                  <Mail size={20} color={BRAND_COLORS.blue600} />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={[styles.menuTitle, { color: theme.textPrimary }]}>{t('emailSupport', 'Email Support')}</Text>
                  <Text style={[styles.menuSub, { color: theme.textSecondary }]}>{SUPPORT_EMAIL}</Text>
                </View>
                <ChevronRight size={18} color={theme.textSecondary} />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => router.push('/feedback' as any)}
                style={[styles.menuItem, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}
              >
                <View style={[styles.menuIconBox, { backgroundColor: 'rgba(245, 158, 11, 0.12)' }]}>
                  <FileText size={20} color="#F59E0B" />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={[styles.menuTitle, { color: theme.textPrimary }]}>{t('suggestFeature', 'Suggest a Feature / Report a Bug')}</Text>
                  <Text style={[styles.menuSub, { color: theme.textSecondary }]}>{t('rateApp', 'Rate the app & leave feedback')}</Text>
                </View>
                <ChevronRight size={18} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>
          ) : activeSection === 'invoice' ? (
            <View>
              <GstBillingSettingsPanel
                theme={theme}
                showBreakdown={gstForm.showBreakdown}
                style={gstForm.style}
                printOnReceipt={gstForm.printOnReceipt}
                itemWiseGst={gstForm.itemWiseGst}
                onShowBreakdownChange={setGstShowBreakdown}
                onStyleChange={setGstStyle}
                onPrintOnReceiptChange={setGstPrintOnReceipt}
                onItemWiseGstChange={setGstItemWise}
                showSaveButton={false}
              />

              <Text style={[styles.sectionHeader, { color: theme.textSecondary, marginTop: 18 }]}>
                    BILL CHARGES
                  </Text>
                  <Text style={{ fontSize: 11, color: theme.textSecondary, marginBottom: 10, lineHeight: 16 }}>
                    Configure service charge, packing, delivery, or other add-ons. Cashiers toggle these presets at checkout.
                  </Text>

                  {chargePresets.map((preset, index) => (
                    <View
                      key={preset.id}
                      style={[styles.permRow, { backgroundColor: theme.cardBg, borderColor: theme.borderColor, marginBottom: 8, flexDirection: 'column', alignItems: 'stretch' }]}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                        <TextInput
                          style={[styles.chargePresetInput, { flex: 1, color: theme.textPrimary, borderColor: theme.borderColor, backgroundColor: theme.bg }]}
                          value={preset.label}
                          onChangeText={(text) => {
                            setChargePresets((prev) => prev.map((p, i) => (i === index ? { ...p, label: text } : p)));
                          }}
                          placeholder="Charge label"
                          placeholderTextColor="#94A3B8"
                        />
                        <TouchableOpacity
                          onPress={() => setChargePresets((prev) => prev.filter((_, i) => i !== index))}
                          style={{ marginLeft: 8, padding: 8 }}
                        >
                          <Trash2 size={16} color="#EF4444" />
                        </TouchableOpacity>
                      </View>

                      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
                        <TouchableOpacity
                          onPress={() => setChargePresets((prev) => prev.map((p, i) => (i === index ? { ...p, type: 'percent' } : p)))}
                          style={[styles.chargeTypeBtn, preset.type === 'percent' && { backgroundColor: BRAND_COLORS.blue600 }]}
                        >
                          <Text style={{ fontSize: 11, fontWeight: '800', color: preset.type === 'percent' ? '#FFF' : theme.textSecondary }}>%</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => setChargePresets((prev) => prev.map((p, i) => (i === index ? { ...p, type: 'flat' } : p)))}
                          style={[styles.chargeTypeBtn, preset.type === 'flat' && { backgroundColor: BRAND_COLORS.blue600 }]}
                        >
                          <Text style={{ fontSize: 11, fontWeight: '800', color: preset.type === 'flat' ? '#FFF' : theme.textSecondary }}>₹</Text>
                        </TouchableOpacity>
                        <TextInput
                          style={[styles.chargePresetInput, { flex: 1, color: theme.textPrimary, borderColor: theme.borderColor, backgroundColor: theme.bg }]}
                          value={String(preset.value)}
                          onChangeText={(text) => {
                            setChargePresets((prev) => prev.map((p, i) => (i === index ? { ...p, value: Math.max(0, parseFloat(text) || 0) } : p)));
                          }}
                          keyboardType="numeric"
                          placeholder={preset.type === 'percent' ? '10' : '50'}
                          placeholderTextColor="#94A3B8"
                        />
                      </View>

                      {preset.type === 'percent' ? (
                        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
                          <TouchableOpacity
                            onPress={() => setChargePresets((prev) => prev.map((p, i) => (i === index ? { ...p, applyOn: 'net_subtotal' } : p)))}
                            style={[styles.chargeTypeBtn, { flex: 1 }, preset.applyOn !== 'gross' && { backgroundColor: BRAND_COLORS.blue600 }]}
                          >
                            <Text style={{ fontSize: 10, fontWeight: '800', color: preset.applyOn !== 'gross' ? '#FFF' : theme.textSecondary, textAlign: 'center' }}>
                              On net (after discount)
                            </Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => setChargePresets((prev) => prev.map((p, i) => (i === index ? { ...p, applyOn: 'gross' } : p)))}
                            style={[styles.chargeTypeBtn, { flex: 1 }, preset.applyOn === 'gross' && { backgroundColor: BRAND_COLORS.blue600 }]}
                          >
                            <Text style={{ fontSize: 10, fontWeight: '800', color: preset.applyOn === 'gross' ? '#FFF' : theme.textSecondary, textAlign: 'center' }}>
                              On gross (before discount)
                            </Text>
                          </TouchableOpacity>
                        </View>
                      ) : null}

                      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <Text style={{ fontSize: 11, color: theme.textSecondary, marginRight: 8 }}>Show at checkout</Text>
                          <Switch
                            value={preset.enabled}
                            onValueChange={(val) => setChargePresets((prev) => prev.map((p, i) => (i === index ? { ...p, enabled: val } : p)))}
                            trackColor={{ false: '#64748B', true: BRAND_COLORS.blue600 }}
                          />
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <Text style={{ fontSize: 11, color: theme.textSecondary, marginRight: 8 }}>Default on</Text>
                          <Switch
                            value={preset.defaultSelected}
                            onValueChange={(val) => setChargePresets((prev) => prev.map((p, i) => (i === index ? { ...p, defaultSelected: val } : p)))}
                            trackColor={{ false: '#64748B', true: '#7C3AED' }}
                          />
                        </View>
                      </View>
                    </View>
                  ))}

                  <TouchableOpacity
                    onPress={() =>
                      setChargePresets((prev) => [
                        ...prev,
                        {
                          id: createPresetId(),
                          label: 'New Charge',
                          kind: 'other',
                          type: 'percent',
                          value: 5,
                          enabled: true,
                          defaultSelected: false,
                          applyOn: 'net_subtotal',
                        },
                      ])
                    }
                    style={[styles.chargeAddBtn, { borderColor: theme.borderColor }]}
                  >
                    <Text style={{ fontSize: 12, fontWeight: '800', color: BRAND_COLORS.blue600 }}>+ Add Charge Preset</Text>
                  </TouchableOpacity>

              <TouchableOpacity
                onPress={handleSaveGstBilling}
                disabled={isSavingGstBilling}
                style={[styles.saveBtn, isSavingGstBilling && { opacity: 0.6 }]}
              >
                {isSavingGstBilling ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.saveBtnText}>Save GST Billing</Text>
                )}
              </TouchableOpacity>
            </View>
          ) : activeSection === 'profile' ? (
            /* Business Profile Section */
            <View>
              {isSettingsError ? (
                <View style={[styles.settingsErrorBanner, { backgroundColor: theme.isDark ? '#3F1D1D' : '#FEF2F2', borderColor: '#EF4444' }]}>
                  <Text style={[styles.settingsErrorText, { color: theme.textPrimary }]}>
                    {t('settingsLoadError', "Couldn't load your saved business details — showing defaults. Saving will overwrite them.")}
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
              <Text style={[styles.label, { color: theme.textPrimary, marginTop: 0 }]}>{t('businessLogo', 'Business Logo')}</Text>
              <Text style={{ fontSize: 11, color: theme.textSecondary, marginBottom: 8 }}>
                {t('businessLogoSub', 'Prints at the top of every thermal receipt')}
              </Text>
              {logoUri ? (
                <View style={styles.logoContainer}>
                  <Image source={{ uri: logoUri }} style={styles.logoPreview} resizeMode="contain" />
                  <View style={styles.logoActions}>
                    <TouchableOpacity
                      onPress={() => {
                        setRawPickedLogo(logoUri);
                        setShowLogoBgModal(true);
                      }}
                      style={[styles.logoActionBtn, { backgroundColor: theme.isDark ? '#1E293B' : '#EFF6FF', borderColor: BRAND_COLORS.blue600 }]}
                    >
                      <Sparkles size={13} color={BRAND_COLORS.blue600} />
                      <Text style={[styles.logoActionText, { color: BRAND_COLORS.blue600 }]}>Background Options</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={handlePickLogo}
                      style={[styles.logoActionBtn, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}
                    >
                      <ImageIcon size={13} color={theme.textPrimary} />
                      <Text style={[styles.logoActionText, { color: theme.textPrimary }]}>Replace</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => setLogoUri('')}
                      style={[styles.logoActionBtn, { backgroundColor: 'rgba(239, 68, 68, 0.1)', borderColor: 'rgba(239, 68, 68, 0.3)' }]}
                    >
                      <Trash2 size={13} color="#EF4444" />
                      <Text style={[styles.logoActionText, { color: "#EF4444" }]}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <TouchableOpacity onPress={handlePickLogo} style={styles.logoPicker}>
                  <View style={[styles.logoPlaceholder, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
                    <ImageIcon size={22} color={theme.textSecondary} />
                    <Text style={{ fontSize: 11, color: theme.textSecondary, marginTop: 4, fontWeight: '700' }}>{t('tapToUploadLogo', 'Tap to Upload Logo')}</Text>
                  </View>
                </TouchableOpacity>
              )}

              <Text style={[styles.label, { color: theme.textPrimary }]}>{t('businessName', 'Store / Business Name')}</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.cardBg, borderColor: theme.borderColor, color: theme.textPrimary }]}
                value={storeName}
                onChangeText={setStoreName}
              />

              {user?.accountType !== 'managed' ? (
                <View style={{ marginTop: 8 }}>
                  <Text style={[styles.label, { color: theme.textPrimary }]}>Business Type</Text>
                  <Text style={{ fontSize: 11, color: theme.textSecondary, marginBottom: 10 }}>
                    Current: {getBusinessTypeLabel(user?.businessType)}. Changing this updates which features appear in your navigation.
                  </Text>
                  {BUSINESS_TYPE_OPTIONS.map((option) => {
                    const selected = selectedBusinessType === option.id;
                    return (
                      <TouchableOpacity
                        key={option.id}
                        onPress={() => setSelectedBusinessType(option.id)}
                        style={[
                          styles.businessTypeChip,
                          {
                            backgroundColor: selected ? 'rgba(37, 99, 235, 0.12)' : theme.cardBg,
                            borderColor: selected ? BRAND_COLORS.blue600 : theme.borderColor,
                          },
                        ]}
                      >
                        <Text style={styles.businessTypeEmoji}>{option.emoji}</Text>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.businessTypeLabel, { color: theme.textPrimary }]}>{option.label}</Text>
                          <Text style={{ fontSize: 11, color: theme.textSecondary }}>{option.description}</Text>
                        </View>
                        {selected ? <Check size={16} color={BRAND_COLORS.blue600} /> : null}
                      </TouchableOpacity>
                    );
                  })}
                  <TouchableOpacity
                    onPress={handleSaveBusinessType}
                    disabled={isUpdatingBusinessType || selectedBusinessType === user?.businessType}
                    style={[
                      styles.saveBtn,
                      (isUpdatingBusinessType || selectedBusinessType === user?.businessType) && { opacity: 0.6 },
                      { marginTop: 4, marginBottom: 8 },
                    ]}
                  >
                    {isUpdatingBusinessType ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <Text style={styles.saveBtnText}>Update Business Type</Text>
                    )}
                  </TouchableOpacity>
                </View>
              ) : null}

              <Text style={[styles.label, { color: theme.textPrimary }]}>{t('taxIdGstin', 'GSTIN Number')}</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.cardBg, borderColor: theme.borderColor, color: theme.textPrimary }]}
                value={storeGstin}
                onChangeText={setStoreGstin}
              />

              <Text style={[styles.label, { color: theme.textPrimary }]}>{t('businessPhone', 'Store Phone Number')}</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.cardBg, borderColor: theme.borderColor, color: theme.textPrimary }]}
                value={storePhone}
                onChangeText={setStorePhone}
              />

              <Text style={[styles.label, { color: theme.textPrimary }]}>{t('businessAddress', 'Store Address')}</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.cardBg, borderColor: theme.borderColor, color: theme.textPrimary }]}
                value={storeAddress}
                onChangeText={setStoreAddress}
                multiline
              />

              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10 }}>
                <QrCode size={14} color={theme.textPrimary} />
                <Text style={[styles.label, { color: theme.textPrimary, marginTop: 0, marginLeft: 6 }]}>UPI ID (VPA)</Text>
              </View>
              <Text style={{ fontSize: 11, color: theme.textSecondary, marginBottom: 6 }}>
                Prints a scannable payment QR on every receipt, e.g. yourstore@upi
              </Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.cardBg, borderColor: theme.borderColor, color: theme.textPrimary }]}
                value={upiId}
                onChangeText={setUpiId}
                placeholder="yourstore@upi"
                placeholderTextColor="#94A3B8"
                autoCapitalize="none"
              />

              <TouchableOpacity onPress={handleSaveSettings} disabled={isSavingProfile} style={[styles.saveBtn, isSavingProfile && { opacity: 0.6 }]}>
                {isSavingProfile ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.saveBtnText}>Save Business Profile</Text>}
              </TouchableOpacity>
            </View>
          ) : activeSection === 'permissions' ? (
            /* ManagedUser Staff Permissions Section */
            <View>
              <Text style={[styles.sectionHeader, { color: theme.textSecondary }]}>STAFF ROLE PERMISSIONS</Text>
              {Object.keys(perms).map((key) => {
                const k = key as keyof typeof perms;
                return (
                  <View key={k} style={[styles.permRow, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
                    <Text style={[styles.permTitle, { color: theme.textPrimary }]}>{k}</Text>
                    <Switch
                      value={perms[k]}
                      onValueChange={(val) => setPerms({ ...perms, [k]: val })}
                      trackColor={{ false: '#64748B', true: BRAND_COLORS.blue600 }}
                    />
                  </View>
                );
              })}

              <TouchableOpacity onPress={handleSaveSettings} style={styles.saveBtn}>
                <Text style={styles.saveBtnText}>Save Staff Permissions</Text>
              </TouchableOpacity>
            </View>
          ) : (
            /* Language Switcher Section */
            <View>
              <Text style={[styles.sectionHeader, { color: theme.textSecondary }]}>SELECT PREFERRED LANGUAGE</Text>
              {SUPPORTED_LANGUAGES.map((lang) => {
                const selected = currentLanguage === lang.code;
                return (
                  <TouchableOpacity
                    key={lang.code}
                    onPress={() => setLanguage(lang.code as LanguageCode)}
                    style={[
                      styles.langCard,
                      {
                        backgroundColor: selected ? 'rgba(37, 99, 235, 0.15)' : theme.cardBg,
                        borderColor: selected ? BRAND_COLORS.blue600 : theme.borderColor,
                      },
                    ]}
                  >
                    <Text style={[styles.langText, { color: selected ? BRAND_COLORS.blue600 : theme.textPrimary }]}>
                      {lang.name} ({lang.nativeName})
                    </Text>
                    {selected ? <Check size={18} color={BRAND_COLORS.blue600} /> : null}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </ScrollView>
      </View>
      </KeyboardAvoidingWrapper>

      <LogoBackgroundModal
        visible={showLogoBgModal}
        imageUri={rawPickedLogo}
        onApply={(finalUri) => {
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
  settingsErrorBanner: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    marginBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingsErrorText: { flex: 1, fontSize: 12, fontWeight: '600', lineHeight: 17, marginRight: 10 },
  settingsErrorRetryBtn: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 10, backgroundColor: 'rgba(239, 68, 68, 0.12)', minWidth: 56, alignItems: 'center' },
  settingsErrorRetryText: { color: '#EF4444', fontWeight: '800', fontSize: 12 },
  mainWrapper: { flex: 1, paddingHorizontal: 16, paddingTop: 4 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  backBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 4, marginLeft: -4 },
  backBtnText: { fontSize: 13, fontWeight: '600', marginLeft: 4 },
  title: { fontSize: 24, fontWeight: '900', marginBottom: 6 },
  menuGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  menuItem: { borderRadius: 18, padding: 14, borderWidth: 1, marginBottom: 10, flexDirection: 'row', alignItems: 'center' },
  multiStoreCard: { borderRadius: 18, padding: 14, borderWidth: 1, marginBottom: 16, flexDirection: 'row', alignItems: 'center' },
  menuIconBox: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(37, 99, 235, 0.12)', alignItems: 'center', justifyContent: 'center' },
  menuTitle: { fontSize: 14, fontWeight: '800' },
  menuSub: { fontSize: 11, marginTop: 2 },
  label: { fontSize: 12, fontWeight: '700', marginBottom: 6, marginTop: 10 },
  input: { borderWidth: 1, borderRadius: 12, padding: 12, fontSize: 14, marginBottom: 10 },
  logoPicker: { alignSelf: 'flex-start', marginBottom: 4 },
  logoContainer: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  logoPreview: { width: 84, height: 84, borderRadius: 14, backgroundColor: '#FFFFFF' },
  logoActions: { gap: 6, flex: 1 },
  logoActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  logoActionText: { fontSize: 11, fontWeight: '700' },
  logoPlaceholder: { width: 88, height: 88, borderRadius: 16, borderWidth: 1, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', padding: 8 },
  saveBtn: { backgroundColor: BRAND_COLORS.navyInk, borderRadius: 14, paddingVertical: 14, alignItems: 'center', justifyContent: 'center', marginTop: 16 },
  saveBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 14 },
  sectionHeader: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5, marginBottom: 10 },
  permRow: { borderRadius: 14, padding: 14, borderWidth: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  permTitle: { fontSize: 13, fontWeight: '700' },
  langCard: { borderRadius: 14, padding: 14, borderWidth: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  langText: { fontSize: 14, fontWeight: '700' },
  businessTypeChip: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  businessTypeEmoji: { fontSize: 20, marginRight: 10 },
  businessTypeLabel: { fontSize: 13, fontWeight: '800', marginBottom: 2 },
  chargePresetInput: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, fontSize: 13 },
  chargeTypeBtn: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(100,116,139,0.15)' },
  chargeAddBtn: { borderWidth: 1, borderStyle: 'dashed', borderRadius: 12, paddingVertical: 12, alignItems: 'center', marginBottom: 8 },
});
