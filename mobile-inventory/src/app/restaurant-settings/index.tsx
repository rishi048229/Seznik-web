import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Platform,
  Switch,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronLeft, Building2, Receipt, ChefHat } from 'lucide-react-native';
import { useAppTheme, AppTheme } from '@/hooks/useAppTheme';
import { ScreenBackground } from '@/components/ui/ScreenBackground';
import { KeyboardAvoidingWrapper } from '@/components/ui/KeyboardAvoidingWrapper';
import { BRAND_COLORS } from '@/constants/theme';
import { useSettings } from '@/hooks/useSettings';
import { sanitizeErrorMessage } from '@/utils/errorHandler';
import {
  DEFAULT_KOT_CONFIG,
  VENUE_PRESETS,
  VENUE_TYPES,
  mergeKotConfig,
  applyVenuePreset,
  ORDER_TYPE_OPTIONS,
  tableNounLabel,
  type KotConfig,
  type KotVenueType,
  type KOTOrderType,
  type KotTableNoun,
  type KotRoomType,
} from '@shared/kotConfig';

type Tab = 'business' | 'bill' | 'kitchen';

const TABS: { id: Tab; label: string; icon: typeof Building2 }[] = [
  { id: 'business', label: 'Business', icon: Building2 },
  { id: 'bill', label: 'Customer bill', icon: Receipt },
  { id: 'kitchen', label: 'Kitchen', icon: ChefHat },
];

const TABLE_NOUNS: { id: KotTableNoun; label: string }[] = [
  { id: 'tables', label: 'Tables' },
  { id: 'seats', label: 'Seats' },
  { id: 'counters', label: 'Counters' },
];

const ROOM_TYPES: { id: KotRoomType; label: string }[] = [
  { id: 'none', label: 'None' },
  { id: 'ac', label: 'AC' },
  { id: 'non_ac', label: 'Non-AC' },
];

// These live at module scope on purpose. Declaring them inside the screen would give them a new
// component identity on every render, which remounts each TextInput as you type and drops the
// keyboard after a single character.
function Label({ theme, children }: { theme: AppTheme; children: React.ReactNode }) {
  return <Text style={[styles.label, { color: theme.textSecondary }]}>{children}</Text>;
}

function Hint({ theme, children }: { theme: AppTheme; children: React.ReactNode }) {
  return <Text style={[styles.sectionHint, { color: theme.textSecondary }]}>{children}</Text>;
}

function Field({
  theme,
  label,
  value,
  onChangeText,
  keyboardType,
  multiline,
}: {
  theme: AppTheme;
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  keyboardType?: 'default' | 'numeric' | 'phone-pad';
  multiline?: boolean;
}) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Label theme={theme}>{label}</Label>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType || 'default'}
        multiline={multiline}
        placeholderTextColor={theme.textSecondary}
        style={[
          styles.input,
          { color: theme.textPrimary, borderColor: theme.borderColor, backgroundColor: theme.cardBg },
          multiline ? { height: 88, textAlignVertical: 'top' } : null,
        ]}
      />
    </View>
  );
}

function Toggle({
  theme,
  label,
  hint,
  value,
  onValueChange,
}: {
  theme: AppTheme;
  label: string;
  hint?: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
}) {
  return (
    <View style={[styles.toggleRow, { borderBottomColor: theme.borderColor }]}>
      <View style={{ flex: 1, marginRight: 12 }}>
        <Text style={[styles.toggleLabel, { color: theme.textPrimary }]}>{label}</Text>
        {hint ? <Text style={[styles.toggleHint, { color: theme.textSecondary }]}>{hint}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: theme.borderColor, true: BRAND_COLORS.blue600 }}
        thumbColor="#FFFFFF"
      />
    </View>
  );
}

function Chips<T extends string>({
  theme,
  options,
  selected,
  onSelect,
  multi,
}: {
  theme: AppTheme;
  options: { id: T; label: string }[];
  selected: T[] | T;
  onSelect: (id: T) => void;
  multi?: boolean;
}) {
  return (
    <View style={styles.chipRow}>
      {options.map((opt) => {
        const isOn = multi ? (selected as T[]).includes(opt.id) : selected === opt.id;
        return (
          <TouchableOpacity
            key={opt.id}
            onPress={() => onSelect(opt.id)}
            style={[
              styles.chip,
              {
                borderColor: isOn ? BRAND_COLORS.blue600 : theme.borderColor,
                backgroundColor: isOn ? BRAND_COLORS.blue600 : theme.cardBg,
              },
            ]}
          >
            <Text style={[styles.chipText, { color: isOn ? '#FFFFFF' : theme.textPrimary }]}>{opt.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

/**
 * Mobile counterpart of the web's "Restaurant settings" dialog (KOTSettingsModal +
 * KotSettingsFields). It reads and writes the same Settings.kotConfig through the same shared
 * presets and merge rules, so a venue configured on one platform behaves identically on the other.
 */
export default function RestaurantSettingsScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const topPadding = Math.max(insets.top, Platform.OS === 'android' ? StatusBar.currentHeight || 0 : 0, 14);

  const { settings, isLoading, updateSettings, isUpdating } = useSettings();

  const [tab, setTab] = useState<Tab>('business');
  const [businessName, setBusinessName] = useState('');
  const [businessPhone, setBusinessPhone] = useState('');
  const [businessAddress, setBusinessAddress] = useState('');
  const [businessGSTIN, setBusinessGSTIN] = useState('');
  const [invoicePrefix, setInvoicePrefix] = useState('INV');
  const [footerMessage, setFooterMessage] = useState('');
  const [termsLine1, setTermsLine1] = useState('');
  const [showLogo, setShowLogo] = useState(true);
  const [showPrintTime, setShowPrintTime] = useState(true);
  const [kot, setKot] = useState<Required<KotConfig>>(DEFAULT_KOT_CONFIG);

  // Seed the form from the fetched settings exactly once. Re-seeding on every settings change
  // would wipe whatever the user is mid-way through typing when the query refetches.
  const seededRef = useRef(false);
  useEffect(() => {
    if (!settings || seededRef.current) return;
    seededRef.current = true;
    const timer = setTimeout(() => {
      setBusinessName(settings.businessName ?? '');
      setBusinessPhone(settings.businessPhone ?? '');
      setBusinessAddress(settings.businessAddress ?? '');
      setBusinessGSTIN(settings.businessGSTIN ?? '');
      const invoice = (settings.invoiceConfig ?? {}) as Record<string, any>;
      const receipt = (settings.receiptConfig ?? {}) as Record<string, any>;
      setInvoicePrefix(invoice.prefix || 'INV');
      setFooterMessage(receipt.footerMessage || 'Thank you for your purchase!');
      setTermsLine1(receipt.termsLine1 || '');
      setShowLogo(receipt.showLogo ?? true);
      setShowPrintTime(receipt.showPrintTime ?? true);
      setKot(mergeKotConfig(settings.kotConfig));
    }, 0);
    return () => clearTimeout(timer);
  }, [settings]);

  const save = async () => {
    try {
      if (tab === 'business') {
        await updateSettings({
          businessName: businessName.trim(),
          businessPhone: businessPhone.trim(),
          businessAddress: businessAddress.trim(),
          businessGSTIN: businessGSTIN.trim(),
        });
        Alert.alert('Saved', 'Business profile updated.');
      } else if (tab === 'bill') {
        await updateSettings({
          invoiceConfig: { ...((settings?.invoiceConfig ?? {}) as object), prefix: invoicePrefix.trim() || 'INV' },
          receiptConfig: {
            ...((settings?.receiptConfig ?? {}) as object),
            footerMessage,
            termsLine1,
            showLogo,
            showPrintTime,
          },
        });
        Alert.alert('Saved', 'Customer bill settings updated.');
      } else {
        await updateSettings({ kotConfig: kot });
        Alert.alert('Saved', 'Kitchen settings updated.');
      }
    } catch (err: any) {
      Alert.alert('Could not save', sanitizeErrorMessage(err, 'Please try again.'));
    }
  };

  const toggleOrderType = (id: KOTOrderType) => {
    setKot((prev) => {
      const has = prev.allowedOrderTypes.includes(id);
      // At least one order type must stay on, or the KOT screen has nothing to offer.
      if (has && prev.allowedOrderTypes.length === 1) return prev;
      const next = has ? prev.allowedOrderTypes.filter((t) => t !== id) : [...prev.allowedOrderTypes, id];
      return {
        ...prev,
        allowedOrderTypes: next,
        defaultOrderType: next.includes(prev.defaultOrderType) ? prev.defaultOrderType : next[0],
      };
    });
  };

  if (isLoading && !settings) {
    return (
      <ScreenBackground color={theme.bg}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={BRAND_COLORS.blue600} />
        </View>
      </ScreenBackground>
    );
  }

  return (
    <ScreenBackground color={theme.bg}>
      <KeyboardAvoidingWrapper>
        <View style={{ flex: 1, paddingTop: topPadding }}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} hitSlop={10} style={{ padding: 4 }}>
              <ChevronLeft size={24} color={theme.textPrimary} />
            </TouchableOpacity>
            <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>Restaurant settings</Text>
            <View style={{ width: 24 }} />
          </View>

          <View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabRow}>
              {TABS.map(({ id, label, icon: Icon }) => {
                const active = tab === id;
                return (
                  <TouchableOpacity
                    key={id}
                    onPress={() => setTab(id)}
                    style={[
                      styles.tabBtn,
                      { backgroundColor: active ? BRAND_COLORS.navyInk : theme.cardBg, borderColor: theme.borderColor },
                    ]}
                  >
                    <Icon size={14} color={active ? '#FFFFFF' : theme.textSecondary} />
                    <Text style={[styles.tabText, { color: active ? '#FFFFFF' : theme.textSecondary }]}>{label}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
            {tab === 'business' && (
              <>
                <Field theme={theme} label="Business name" value={businessName} onChangeText={setBusinessName} />
                <Field theme={theme} label="Phone" value={businessPhone} onChangeText={setBusinessPhone} keyboardType="phone-pad" />
                <Field theme={theme} label="GSTIN" value={businessGSTIN} onChangeText={setBusinessGSTIN} />
                <Field theme={theme} label="Address" value={businessAddress} onChangeText={setBusinessAddress} multiline />
              </>
            )}

            {tab === 'bill' && (
              <>
                <Hint theme={theme}>These print on the customer bill. Changes apply to the next receipt.</Hint>
                <Field theme={theme} label="Invoice prefix" value={invoicePrefix} onChangeText={setInvoicePrefix} />
                <Field theme={theme} label="Footer message" value={footerMessage} onChangeText={setFooterMessage} />
                <Field theme={theme} label="Terms line 1" value={termsLine1} onChangeText={setTermsLine1} />
                <Toggle theme={theme} label="Show logo on customer bill" value={showLogo} onValueChange={setShowLogo} />
                <Toggle theme={theme} label="Print timings" value={showPrintTime} onValueChange={setShowPrintTime} />
              </>
            )}

            {tab === 'kitchen' && (
              <>
                <Label theme={theme}>STORE TYPE</Label>
                <Hint theme={theme}>KOT floor and billing follow this. You can still tweak the options below.</Hint>
                <Chips
                  theme={theme}
                  options={VENUE_TYPES.map((v) => ({ id: v, label: VENUE_PRESETS[v].label }))}
                  selected={kot.venueType}
                  onSelect={(v: KotVenueType) => setKot((prev) => applyVenuePreset(prev, v))}
                />

                <Label theme={theme}>ORDERS YOU TAKE</Label>
                <Hint theme={theme}>Turn off types you never use. At least one stays on.</Hint>
                <Chips theme={theme} options={ORDER_TYPE_OPTIONS} selected={kot.allowedOrderTypes} onSelect={toggleOrderType} multi />

                <Label theme={theme}>DEFAULT ORDER TYPE</Label>
                <Chips
                  theme={theme}
                  options={ORDER_TYPE_OPTIONS.filter((o) => kot.allowedOrderTypes.includes(o.id))}
                  selected={kot.defaultOrderType}
                  onSelect={(id: KOTOrderType) => setKot((p) => ({ ...p, defaultOrderType: id }))}
                />

                <Label theme={theme}>FLOOR NAMES</Label>
                <Hint theme={theme}>What staff see on the KOT page.</Hint>
                <Chips
                  theme={theme}
                  options={TABLE_NOUNS}
                  selected={kot.tableNoun}
                  onSelect={(id: KotTableNoun) => setKot((p) => ({ ...p, tableNoun: id }))}
                />

                <View style={{ marginTop: 6 }}>
                  <Toggle
                    theme={theme}
                    label={`Show ${tableNounLabel(kot.tableNoun).toLowerCase()}`}
                    hint="Floor plan on the KOT page"
                    value={kot.showTables}
                    onValueChange={(v) => setKot((p) => ({ ...p, showTables: v }))}
                  />
                  <Toggle
                    theme={theme}
                    label="Kitchen tickets (KOT)"
                    hint="Send to kitchen / print KOT. Turn off for cloud kitchens that only take online orders."
                    value={kot.kitchenTicketsEnabled}
                    onValueChange={(v) => setKot((p) => ({ ...p, kitchenTicketsEnabled: v }))}
                  />
                  <Toggle
                    theme={theme}
                    label="Waiter name on tickets"
                    value={kot.showWaiterField}
                    onValueChange={(v) => setKot((p) => ({ ...p, showWaiterField: v }))}
                  />
                  <Toggle
                    theme={theme}
                    label="Print waiter on KOT slip"
                    value={kot.showWaiterOnSlip}
                    onValueChange={(v) => setKot((p) => ({ ...p, showWaiterOnSlip: v }))}
                  />
                  <Toggle
                    theme={theme}
                    label="Service charge on bills"
                    value={kot.showServiceCharge}
                    onValueChange={(v) => setKot((p) => ({ ...p, showServiceCharge: v }))}
                  />
                  <Toggle
                    theme={theme}
                    label="AC / Non-AC room charges"
                    value={kot.showRoomCharges}
                    onValueChange={(v) => setKot((p) => ({ ...p, showRoomCharges: v }))}
                  />
                  <Toggle
                    theme={theme}
                    label="Override item tax with a bill tax %"
                    hint="When off, each food item keeps its own tax rate."
                    value={kot.applyTaxOverride}
                    onValueChange={(v) => setKot((p) => ({ ...p, applyTaxOverride: v }))}
                  />
                </View>

                <View style={{ height: 16 }} />
                <Field
                  theme={theme}
                  label="KOT slip title"
                  value={kot.kotSlipTitle}
                  onChangeText={(t) => setKot((p) => ({ ...p, kotSlipTitle: t }))}
                />
                <Field
                  theme={theme}
                  label="Default tax %"
                  value={String(kot.taxRate)}
                  keyboardType="numeric"
                  onChangeText={(t) => setKot((p) => ({ ...p, taxRate: Number(t) || 0 }))}
                />

                {kot.showServiceCharge ? (
                  <>
                    <Label theme={theme}>SERVICE CHARGE</Label>
                    <Chips
                      theme={theme}
                      options={[
                        { id: 'percent' as const, label: 'Percent of food' },
                        { id: 'flat' as const, label: 'Flat amount (₹)' },
                      ]}
                      selected={kot.serviceChargeType}
                      onSelect={(id) => setKot((p) => ({ ...p, serviceChargeType: id }))}
                    />
                    <Field
                      theme={theme}
                      label={kot.serviceChargeType === 'percent' ? 'Service charge %' : 'Service charge ₹'}
                      value={String(kot.serviceChargeValue)}
                      keyboardType="numeric"
                      onChangeText={(t) => setKot((p) => ({ ...p, serviceChargeValue: Number(t) || 0 }))}
                    />
                  </>
                ) : null}

                {kot.showRoomCharges ? (
                  <>
                    <Field
                      theme={theme}
                      label="AC room charge (₹)"
                      value={String(kot.acCharge)}
                      keyboardType="numeric"
                      onChangeText={(t) => setKot((p) => ({ ...p, acCharge: Number(t) || 0 }))}
                    />
                    <Field
                      theme={theme}
                      label="Non-AC room charge (₹)"
                      value={String(kot.nonAcCharge)}
                      keyboardType="numeric"
                      onChangeText={(t) => setKot((p) => ({ ...p, nonAcCharge: Number(t) || 0 }))}
                    />
                    <Label theme={theme}>DEFAULT ROOM TYPE</Label>
                    <Chips
                      theme={theme}
                      options={ROOM_TYPES}
                      selected={kot.defaultRoomType}
                      onSelect={(id: KotRoomType) => setKot((p) => ({ ...p, defaultRoomType: id }))}
                    />
                  </>
                ) : null}
              </>
            )}

            <TouchableOpacity
              onPress={save}
              disabled={isUpdating}
              style={[styles.saveBtn, { backgroundColor: BRAND_COLORS.blue600, opacity: isUpdating ? 0.6 : 1 }]}
            >
              {isUpdating ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.saveBtnText}>Save {TABS.find((t) => t.id === tab)?.label.toLowerCase()}</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingWrapper>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  headerTitle: { fontSize: 17, fontWeight: '800' },
  tabRow: { paddingHorizontal: 16, gap: 8, alignItems: 'center', paddingBottom: 10 },
  tabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    height: 38,
  },
  tabText: { fontSize: 13, fontWeight: '700' },
  label: { fontSize: 11, fontWeight: '800', letterSpacing: 0.6, marginBottom: 6, marginTop: 6 },
  sectionHint: { fontSize: 12, lineHeight: 17, marginBottom: 10 },
  input: { borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1 },
  toggleLabel: { fontSize: 14, fontWeight: '700' },
  toggleHint: { fontSize: 11.5, marginTop: 2, lineHeight: 16 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  chip: { paddingVertical: 9, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1.5 },
  chipText: { fontSize: 13, fontWeight: '700' },
  saveBtn: { marginTop: 22, paddingVertical: 15, borderRadius: 14, alignItems: 'center' },
  saveBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },
});
