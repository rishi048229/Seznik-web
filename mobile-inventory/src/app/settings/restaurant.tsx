import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Switch,
  ActivityIndicator,
  Alert,
  StyleSheet,
  StatusBar,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  ArrowLeft,
  ChefHat,
  Utensils,
  LayoutGrid,
  Save,
  CheckCircle2,
  Plus,
  Trash2,
  Receipt,
  Percent,
  DollarSign,
  Coffee,
  Sparkles,
  ShoppingBag,
  Truck,
  Layers,
  UserCheck,
} from 'lucide-react-native';
import { useSettings } from '@/hooks/useSettings';
import { useAppTheme } from '@/hooks/useAppTheme';
import { ScreenBackground } from '@/components/ui/ScreenBackground';
import { BRAND_COLORS } from '@/constants/theme';
import { useTranslation } from '@/store/useLanguageStore';
import {
  KotConfig,
  KotVenueType,
  KOTOrderType,
  KotRoomType,
  KotTableNoun,
  DEFAULT_KOT_CONFIG,
  VENUE_PRESETS,
} from '@shared/kotConfig';

export default function RestaurantSettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useAppTheme();
  const { t } = useTranslation();
  const { settings, updateSettings, isUpdating } = useSettings();

  const [venueType, setVenueType] = useState<KotVenueType>('restaurant');
  const [defaultOrderType, setDefaultOrderType] = useState<KOTOrderType>('dine_in');
  const [allowedOrderTypes, setAllowedOrderTypes] = useState<KOTOrderType[]>(['dine_in', 'takeaway', 'delivery']);
  const [showTables, setShowTables] = useState(true);
  const [tableNoun, setTableNoun] = useState<KotTableNoun>('tables');
  const [kitchenTicketsEnabled, setKitchenTicketsEnabled] = useState(true);
  const [kotSlipTitle, setKotSlipTitle] = useState('KITCHEN ORDER TICKET');
  const [showWaiterOnSlip, setShowWaiterOnSlip] = useState(true);
  const [showWaiterField, setShowWaiterField] = useState(true);
  const [showRoomCharges, setShowRoomCharges] = useState(true);
  const [acCharge, setAcCharge] = useState('0');
  const [nonAcCharge, setNonAcCharge] = useState('0');
  const [defaultRoomType, setDefaultRoomType] = useState<KotRoomType>('none');
  const [showServiceCharge, setShowServiceCharge] = useState(false);
  const [serviceChargeType, setServiceChargeType] = useState<'percent' | 'flat'>('percent');
  const [serviceChargeValue, setServiceChargeValue] = useState('0');
  const [waiterNames, setWaiterNames] = useState<string[]>([]);
  const [newWaiterName, setNewWaiterName] = useState('');

  // Hydrate from existing settings
  useEffect(() => {
    if (settings?.kotConfig) {
      const cfg = { ...DEFAULT_KOT_CONFIG, ...settings.kotConfig };
      setVenueType(cfg.venueType || 'restaurant');
      setDefaultOrderType(cfg.defaultOrderType || 'dine_in');
      setAllowedOrderTypes(cfg.allowedOrderTypes || ['dine_in', 'takeaway', 'delivery']);
      setShowTables(cfg.showTables ?? true);
      setTableNoun(cfg.tableNoun || 'tables');
      setKitchenTicketsEnabled(cfg.kitchenTicketsEnabled ?? true);
      setKotSlipTitle(cfg.kotSlipTitle || 'KITCHEN ORDER TICKET');
      setShowWaiterOnSlip(cfg.showWaiterOnSlip ?? true);
      setShowWaiterField(cfg.showWaiterField ?? true);
      setShowRoomCharges(cfg.showRoomCharges ?? true);
      setAcCharge(String(cfg.acCharge ?? 0));
      setNonAcCharge(String(cfg.nonAcCharge ?? 0));
      setDefaultRoomType(cfg.defaultRoomType || 'none');
      setShowServiceCharge(cfg.showServiceCharge ?? false);
      setServiceChargeType(cfg.serviceChargeType || 'percent');
      setServiceChargeValue(String(cfg.serviceChargeValue ?? 0));
      setWaiterNames(cfg.waiterNames || []);
    }
  }, [settings]);

  const handleSelectVenuePreset = (vt: KotVenueType) => {
    const preset = VENUE_PRESETS[vt];
    if (!preset) return;
    setVenueType(vt);
    setDefaultOrderType(preset.defaultOrderType);
    setShowTables(preset.showTables);
    setShowWaiterField(preset.showWaiterField);
    setShowRoomCharges(preset.showRoomCharges);
    setShowServiceCharge(preset.showServiceCharge);
    setShowWaiterOnSlip(preset.showWaiterOnSlip);
    setKotSlipTitle(preset.kotSlipTitle);
    setTableNoun(preset.tableNoun);
    setAllowedOrderTypes(preset.allowedOrderTypes);
    setKitchenTicketsEnabled(preset.kitchenTicketsEnabled);
  };

  const toggleOrderType = (ot: KOTOrderType) => {
    if (allowedOrderTypes.includes(ot)) {
      if (allowedOrderTypes.length === 1) {
        Alert.alert('Required', 'At least one order type must remain enabled.');
        return;
      }
      const updated = allowedOrderTypes.filter((x) => x !== ot);
      setAllowedOrderTypes(updated);
      if (defaultOrderType === ot) {
        setDefaultOrderType(updated[0]);
      }
    } else {
      setAllowedOrderTypes([...allowedOrderTypes, ot]);
    }
  };

  const handleAddWaiter = () => {
    const trimmed = newWaiterName.trim();
    if (!trimmed) return;
    if (waiterNames.some((w) => w.toLowerCase() === trimmed.toLowerCase())) {
      Alert.alert('Duplicate', 'This staff member is already in the list.');
      return;
    }
    setWaiterNames([...waiterNames, trimmed]);
    setNewWaiterName('');
  };

  const handleRemoveWaiter = (name: string) => {
    setWaiterNames(waiterNames.filter((w) => w !== name));
  };

  const handleSave = async () => {
    if (!settings?.id) {
      Alert.alert('Error', 'Store settings not loaded yet.');
      return;
    }

    const kotConfigPayload: KotConfig = {
      venueType,
      defaultOrderType,
      allowedOrderTypes,
      showTables,
      tableNoun,
      kitchenTicketsEnabled,
      kotSlipTitle: kotSlipTitle.trim() || 'KITCHEN ORDER TICKET',
      showWaiterOnSlip,
      showWaiterField,
      showRoomCharges,
      acCharge: Math.max(0, parseFloat(acCharge) || 0),
      nonAcCharge: Math.max(0, parseFloat(nonAcCharge) || 0),
      defaultRoomType,
      showServiceCharge,
      serviceChargeType,
      serviceChargeValue: Math.max(0, parseFloat(serviceChargeValue) || 0),
      waiterNames,
    };

    try {
      await updateSettings({
        kotConfig: kotConfigPayload as any,
      });
      Alert.alert(
        t('saved', 'Settings Saved'),
        t('restaurantSettingsSavedHint', 'Restaurant & KOT preferences synchronized across mobile and web.')
      );
    } catch (err: any) {
      Alert.alert(t('error', 'Error'), err?.message || 'Failed to update restaurant settings.');
    }
  };

  const topPadding = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0, 12);

  return (
    <ScreenBackground color={theme.bg}>
      <StatusBar barStyle={theme.isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
      <View style={[styles.container, { paddingTop: topPadding }]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <ArrowLeft size={22} color={theme.textPrimary} />
          </TouchableOpacity>
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>
              {t('restaurantSettings', 'Restaurant Settings')}
            </Text>
            <Text style={[styles.headerSub, { color: theme.textSecondary }]}>
              {t('restaurantSettingsSub', 'Venue presets, tables, KOT slip format & sync')}
            </Text>
          </View>
          <TouchableOpacity
            onPress={handleSave}
            disabled={isUpdating}
            style={[styles.saveBtn, { backgroundColor: BRAND_COLORS.blue600 }]}
          >
            {isUpdating ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Save size={16} color="#FFFFFF" style={{ marginRight: 5 }} />
                <Text style={styles.saveBtnText}>{t('save', 'Save')}</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16, paddingBottom: 60 }}
          showsVerticalScrollIndicator={false}
        >
          {/* VENUE TYPE PRESETS */}
          <View style={styles.sectionHeaderRow}>
            <ChefHat size={18} color={BRAND_COLORS.blue600} />
            <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>
              VENUE PRESETS
            </Text>
          </View>
          <Text style={[styles.sectionHint, { color: theme.textSecondary }]}>
            Pick your business type to automatically apply ideal defaults for tables, order types, and slips.
          </Text>

          <View style={styles.presetGrid}>
            {(Object.keys(VENUE_PRESETS) as KotVenueType[]).map((vt) => {
              const preset = VENUE_PRESETS[vt];
              const isSelected = venueType === vt;
              return (
                <TouchableOpacity
                  key={vt}
                  onPress={() => handleSelectVenuePreset(vt)}
                  style={[
                    styles.presetCard,
                    {
                      backgroundColor: theme.cardBg,
                      borderColor: isSelected ? BRAND_COLORS.blue600 : theme.borderColor,
                      borderWidth: isSelected ? 2 : 1,
                    },
                  ]}
                  activeOpacity={0.8}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={[styles.presetLabel, { color: isSelected ? BRAND_COLORS.blue600 : theme.textPrimary }]}>
                      {preset.label}
                    </Text>
                    {isSelected && <CheckCircle2 size={16} color={BRAND_COLORS.blue600} />}
                  </View>
                  <Text style={[styles.presetHint, { color: theme.textSecondary }]} numberOfLines={2}>
                    {preset.hint}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* TABLE & FLOOR MANAGEMENT */}
          <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
            <View style={styles.cardHeader}>
              <LayoutGrid size={18} color={BRAND_COLORS.blue600} />
              <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>Tables & Floor Layout</Text>
            </View>

            <View style={styles.settingRow}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={[styles.settingLabel, { color: theme.textPrimary }]}>Enable Tables</Text>
                <Text style={[styles.settingDesc, { color: theme.textSecondary }]}>
                  Show floor table picker for Dine-In orders
                </Text>
              </View>
              <Switch
                value={showTables}
                onValueChange={setShowTables}
                trackColor={{ false: '#64748B', true: BRAND_COLORS.blue600 }}
              />
            </View>

            {showTables && (
              <>
                <View style={[styles.settingRow, { borderTopWidth: 1, borderTopColor: theme.borderColor, paddingTop: 12 }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.settingLabel, { color: theme.textPrimary }]}>Naming Style</Text>
                    <Text style={[styles.settingDesc, { color: theme.textSecondary }]}>
                      Choose how tables are labeled
                    </Text>
                  </View>
                  <View style={styles.pillRow}>
                    {(['tables', 'seats', 'counters'] as KotTableNoun[]).map((noun) => (
                      <TouchableOpacity
                        key={noun}
                        onPress={() => setTableNoun(noun)}
                        style={[
                          styles.pillBtn,
                          {
                            backgroundColor: tableNoun === noun ? BRAND_COLORS.blue600 : theme.bg,
                            borderColor: tableNoun === noun ? BRAND_COLORS.blue600 : theme.borderColor,
                          },
                        ]}
                      >
                        <Text style={[styles.pillBtnText, { color: tableNoun === noun ? '#FFFFFF' : theme.textPrimary }]}>
                          {noun.charAt(0).toUpperCase() + noun.slice(1)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <TouchableOpacity
                  onPress={() => router.push('/kot/tables' as any)}
                  style={[styles.manageLinkBtn, { borderColor: BRAND_COLORS.blue600 }]}
                >
                  <Text style={[styles.manageLinkText, { color: BRAND_COLORS.blue600 }]}>
                    Manage Floor Tables & Sections →
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>

          {/* ALLOWED & DEFAULT ORDER TYPES */}
          <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
            <View style={styles.cardHeader}>
              <Utensils size={18} color={BRAND_COLORS.blue600} />
              <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>Order Types</Text>
            </View>

            <Text style={[styles.settingDesc, { color: theme.textSecondary, marginBottom: 10 }]}>
              Enable the order modes supported by your outlet:
            </Text>

            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
              {[
                { type: 'dine_in' as KOTOrderType, label: 'Dine-In', icon: Utensils },
                { type: 'takeaway' as KOTOrderType, label: 'Takeaway', icon: ShoppingBag },
                { type: 'delivery' as KOTOrderType, label: 'Delivery', icon: Truck },
              ].map(({ type, label, icon: Icon }) => {
                const isAllowed = allowedOrderTypes.includes(type);
                const isDefault = defaultOrderType === type;
                return (
                  <TouchableOpacity
                    key={type}
                    onPress={() => toggleOrderType(type)}
                    style={[
                      styles.orderTypeCard,
                      {
                        flex: 1,
                        backgroundColor: isAllowed ? (theme.isDark ? 'rgba(37,99,235,0.15)' : 'rgba(37,99,235,0.08)') : theme.bg,
                        borderColor: isAllowed ? BRAND_COLORS.blue600 : theme.borderColor,
                      },
                    ]}
                  >
                    <Icon size={18} color={isAllowed ? BRAND_COLORS.blue600 : theme.textSecondary} />
                    <Text style={[styles.orderTypeLabel, { color: isAllowed ? BRAND_COLORS.blue600 : theme.textSecondary }]}>
                      {label}
                    </Text>
                    {isDefault && (
                      <View style={[styles.defaultBadge, { backgroundColor: BRAND_COLORS.blue600 }]}>
                        <Text style={styles.defaultBadgeText}>Default</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={[styles.settingLabel, { color: theme.textPrimary, marginBottom: 6 }]}>
              Default Order Type:
            </Text>
            <View style={styles.pillRow}>
              {allowedOrderTypes.map((type) => (
                <TouchableOpacity
                  key={type}
                  onPress={() => setDefaultOrderType(type)}
                  style={[
                    styles.pillBtn,
                    {
                      backgroundColor: defaultOrderType === type ? BRAND_COLORS.navyInk : theme.bg,
                      borderColor: defaultOrderType === type ? BRAND_COLORS.navyInk : theme.borderColor,
                    },
                  ]}
                >
                  <Text style={[styles.pillBtnText, { color: defaultOrderType === type ? '#FFFFFF' : theme.textPrimary }]}>
                    {type === 'dine_in' ? 'Dine-In' : type === 'takeaway' ? 'Takeaway' : 'Delivery'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* KOT SLIP & PRINTER SETTINGS */}
          <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
            <View style={styles.cardHeader}>
              <Receipt size={18} color={BRAND_COLORS.blue600} />
              <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>Kitchen Slips & KOT Printing</Text>
            </View>

            <View style={styles.settingRow}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={[styles.settingLabel, { color: theme.textPrimary }]}>Kitchen Slips (KOT)</Text>
                <Text style={[styles.settingDesc, { color: theme.textSecondary }]}>
                  Generate print tickets for the kitchen upon placing order
                </Text>
              </View>
              <Switch
                value={kitchenTicketsEnabled}
                onValueChange={setKitchenTicketsEnabled}
                trackColor={{ false: '#64748B', true: BRAND_COLORS.blue600 }}
              />
            </View>

            <View style={[styles.inputGroup, { marginTop: 12 }]}>
              <Text style={[styles.inputLabel, { color: theme.textPrimary }]}>KOT Slip Header Title</Text>
              <TextInput
                style={[styles.textInput, { backgroundColor: theme.bg, color: theme.textPrimary, borderColor: theme.borderColor }]}
                value={kotSlipTitle}
                onChangeText={setKotSlipTitle}
                placeholder="e.g. KITCHEN ORDER TICKET"
                placeholderTextColor={theme.textSecondary}
              />
            </View>

            <View style={[styles.settingRow, { borderTopWidth: 1, borderTopColor: theme.borderColor, paddingTop: 12, marginTop: 10 }]}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={[styles.settingLabel, { color: theme.textPrimary }]}>Show Server / Waiter on Slip</Text>
                <Text style={[styles.settingDesc, { color: theme.textSecondary }]}>
                  Prints the waiter name on KOT receipts
                </Text>
              </View>
              <Switch
                value={showWaiterOnSlip}
                onValueChange={setShowWaiterOnSlip}
                trackColor={{ false: '#64748B', true: BRAND_COLORS.blue600 }}
              />
            </View>

            <View style={[styles.settingRow, { borderTopWidth: 1, borderTopColor: theme.borderColor, paddingTop: 12 }]}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={[styles.settingLabel, { color: theme.textPrimary }]}>Waiter Selector in POS</Text>
                <Text style={[styles.settingDesc, { color: theme.textSecondary }]}>
                  Show waiter dropdown when taking new orders
                </Text>
              </View>
              <Switch
                value={showWaiterField}
                onValueChange={setShowWaiterField}
                trackColor={{ false: '#64748B', true: BRAND_COLORS.blue600 }}
              />
            </View>
          </View>

          {/* CHARGES & ROOM RATES */}
          <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
            <View style={styles.cardHeader}>
              <DollarSign size={18} color={BRAND_COLORS.blue600} />
              <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>Charges & Rates</Text>
            </View>

            <View style={styles.settingRow}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={[styles.settingLabel, { color: theme.textPrimary }]}>AC / Non-AC Room Charges</Text>
                <Text style={[styles.settingDesc, { color: theme.textSecondary }]}>
                  Allow applying distinct floor / section charges
                </Text>
              </View>
              <Switch
                value={showRoomCharges}
                onValueChange={setShowRoomCharges}
                trackColor={{ false: '#64748B', true: BRAND_COLORS.blue600 }}
              />
            </View>

            {showRoomCharges && (
              <View style={{ flexDirection: 'row', gap: 12, marginTop: 10 }}>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={[styles.inputLabel, { color: theme.textPrimary }]}>AC Charge (₹)</Text>
                  <TextInput
                    style={[styles.textInput, { backgroundColor: theme.bg, color: theme.textPrimary, borderColor: theme.borderColor }]}
                    value={acCharge}
                    onChangeText={setAcCharge}
                    keyboardType="numeric"
                  />
                </View>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={[styles.inputLabel, { color: theme.textPrimary }]}>Non-AC Charge (₹)</Text>
                  <TextInput
                    style={[styles.textInput, { backgroundColor: theme.bg, color: theme.textPrimary, borderColor: theme.borderColor }]}
                    value={nonAcCharge}
                    onChangeText={setNonAcCharge}
                    keyboardType="numeric"
                  />
                </View>
              </View>
            )}

            <View style={[styles.settingRow, { borderTopWidth: 1, borderTopColor: theme.borderColor, paddingTop: 12, marginTop: 12 }]}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={[styles.settingLabel, { color: theme.textPrimary }]}>Service Charge</Text>
                <Text style={[styles.settingDesc, { color: theme.textSecondary }]}>
                  Automatically add service charge on Dine-In bills
                </Text>
              </View>
              <Switch
                value={showServiceCharge}
                onValueChange={setShowServiceCharge}
                trackColor={{ false: '#64748B', true: BRAND_COLORS.blue600 }}
              />
            </View>

            {showServiceCharge && (
              <View style={{ flexDirection: 'row', gap: 12, marginTop: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.inputLabel, { color: theme.textPrimary }]}>Charge Type</Text>
                  <View style={styles.pillRow}>
                    <TouchableOpacity
                      onPress={() => setServiceChargeType('percent')}
                      style={[
                        styles.pillBtn,
                        {
                          backgroundColor: serviceChargeType === 'percent' ? BRAND_COLORS.blue600 : theme.bg,
                          borderColor: serviceChargeType === 'percent' ? BRAND_COLORS.blue600 : theme.borderColor,
                        },
                      ]}
                    >
                      <Text style={[styles.pillBtnText, { color: serviceChargeType === 'percent' ? '#FFFFFF' : theme.textPrimary }]}>
                        Percentage (%)
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => setServiceChargeType('flat')}
                      style={[
                        styles.pillBtn,
                        {
                          backgroundColor: serviceChargeType === 'flat' ? BRAND_COLORS.blue600 : theme.bg,
                          borderColor: serviceChargeType === 'flat' ? BRAND_COLORS.blue600 : theme.borderColor,
                        },
                      ]}
                    >
                      <Text style={[styles.pillBtnText, { color: serviceChargeType === 'flat' ? '#FFFFFF' : theme.textPrimary }]}>
                        Flat (₹)
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={[styles.inputGroup, { width: 100 }]}>
                  <Text style={[styles.inputLabel, { color: theme.textPrimary }]}>Value</Text>
                  <TextInput
                    style={[styles.textInput, { backgroundColor: theme.bg, color: theme.textPrimary, borderColor: theme.borderColor }]}
                    value={serviceChargeValue}
                    onChangeText={setServiceChargeValue}
                    keyboardType="numeric"
                  />
                </View>
              </View>
            )}
          </View>

          {/* WAITERS & SERVICE STAFF */}
          <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
            <View style={styles.cardHeader}>
              <UserCheck size={18} color={BRAND_COLORS.blue600} />
              <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>Waiters & Service Staff</Text>
            </View>

            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
              <TextInput
                style={[styles.textInput, { flex: 1, backgroundColor: theme.bg, color: theme.textPrimary, borderColor: theme.borderColor }]}
                value={newWaiterName}
                onChangeText={setNewWaiterName}
                placeholder="Enter waiter name (e.g. Ramesh)"
                placeholderTextColor={theme.textSecondary}
              />
              <TouchableOpacity
                onPress={handleAddWaiter}
                style={[styles.addWaiterBtn, { backgroundColor: BRAND_COLORS.blue600 }]}
              >
                <Plus size={18} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            {waiterNames.length === 0 ? (
              <Text style={{ fontSize: 12, color: theme.textSecondary, fontStyle: 'italic' }}>
                No waiters configured yet. Add names above to enable server selection in POS.
              </Text>
            ) : (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {waiterNames.map((name) => (
                  <View
                    key={name}
                    style={[
                      styles.waiterChip,
                      { backgroundColor: theme.bg, borderColor: theme.borderColor },
                    ]}
                  >
                    <Text style={[styles.waiterChipText, { color: theme.textPrimary }]}>{name}</Text>
                    <TouchableOpacity onPress={() => handleRemoveWaiter(name)} style={{ marginLeft: 6 }}>
                      <Trash2 size={14} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* Bottom Save Action */}
          <TouchableOpacity
            onPress={handleSave}
            disabled={isUpdating}
            style={[styles.bottomSaveBtn, { backgroundColor: BRAND_COLORS.blue600 }]}
          >
            {isUpdating ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Save size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                <Text style={styles.bottomSaveBtnText}>Save & Sync Restaurant Settings</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </View>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(148, 163, 184, 0.2)',
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 17, fontWeight: '800' },
  headerSub: { fontSize: 11.5, marginTop: 1 },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  saveBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  sectionTitle: { fontSize: 13, fontWeight: '800', letterSpacing: 0.5 },
  sectionHint: { fontSize: 11.5, marginBottom: 12, lineHeight: 16 },
  presetGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  presetCard: {
    width: '48.5%',
    padding: 12,
    borderRadius: 14,
    minHeight: 74,
  },
  presetLabel: { fontSize: 13.5, fontWeight: '800' },
  presetHint: { fontSize: 10.5, marginTop: 4, lineHeight: 14 },
  card: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  cardTitle: { fontSize: 15, fontWeight: '800' },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  settingLabel: { fontSize: 13.5, fontWeight: '700' },
  settingDesc: { fontSize: 11, marginTop: 2, lineHeight: 15 },
  pillRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  pillBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  pillBtnText: { fontSize: 12, fontWeight: '700' },
  manageLinkBtn: {
    marginTop: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderRadius: 10,
    alignItems: 'center',
  },
  manageLinkText: { fontSize: 12.5, fontWeight: '700' },
  orderTypeCard: {
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  orderTypeLabel: { fontSize: 12, fontWeight: '700', marginTop: 4 },
  defaultBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  defaultBadgeText: { color: '#FFFFFF', fontSize: 9, fontWeight: '800' },
  inputGroup: { marginTop: 8 },
  inputLabel: { fontSize: 12, fontWeight: '700', marginBottom: 4 },
  textInput: {
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 13,
  },
  addWaiterBtn: {
    width: 42,
    height: 42,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  waiterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  waiterChipText: { fontSize: 12.5, fontWeight: '600' },
  bottomSaveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 8,
  },
  bottomSaveBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
});
