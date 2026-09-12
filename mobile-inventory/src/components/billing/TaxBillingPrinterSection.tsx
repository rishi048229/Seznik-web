import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  Switch,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from 'react-native';
import { ChevronDown, ChevronUp, Percent, Trash2 } from 'lucide-react-native';
import { GstBillingSettingsPanel } from '@/components/billing/GstBillingSettingsPanel';
import { useGstBillingSettings } from '@/hooks/useGstBillingSettings';
import {
  BillChargePreset,
  DEFAULT_RESTAURANT_PRESETS,
  createPresetId,
  parseRestaurantBilling,
  toRestaurantBillingPayload,
} from '@/constants/restaurantBilling';
import { BRAND_COLORS } from '@/constants/theme';
import type { AppTheme } from '@/hooks/useAppTheme';

interface TaxBillingPrinterSectionProps {
  theme: AppTheme;
  compact?: boolean;
  collapsible?: boolean;
  defaultExpanded?: boolean;
  hintText?: string;
  className?: string;
  onFormChange?: (form: import('@/hooks/useGstBillingSettings').GstBillingFormState) => void;
}

export function TaxBillingPrinterSection({
  theme,
  compact = false,
  collapsible = false,
  defaultExpanded = true,
  hintText = 'GST breakdown and bill extra charges for checkout and printed receipts. Synced across web and mobile.',
  onFormChange,
}: TaxBillingPrinterSectionProps) {
  const {
    form: gstForm,
    setShowBreakdown: setGstShowBreakdown,
    setStyle: setGstStyle,
    setPrintOnReceipt: setGstPrintOnReceipt,
    setItemWiseGst: setGstItemWise,
    saveGstBilling,
    isSaving: isSavingGstBilling,
    settings,
  } = useGstBillingSettings();
  const [chargePresets, setChargePresets] = useState<BillChargePreset[]>(DEFAULT_RESTAURANT_PRESETS);
  const [expanded, setExpanded] = useState(defaultExpanded);

  useEffect(() => {
    onFormChange?.(gstForm);
  }, [gstForm, onFormChange]);


  useEffect(() => {
    if (!settings) return;
    setChargePresets(parseRestaurantBilling(settings.invoiceConfig).presets);
  }, [settings?.id, settings?.invoiceConfig]);

  const handleSave = async () => {
    try {
      await saveGstBilling({
        extraInvoiceConfig: {
          restaurantBilling: toRestaurantBillingPayload({ presets: chargePresets }),
        },
        onSuccess: () => {
          Alert.alert('Tax & Billing Saved', 'Settings apply to checkout and all receipt prints.');
        },
      });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Please check your connection and try again.';
      Alert.alert('Could Not Save', message);
    }
  };

  const body = (
    <>
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
        hintText={hintText}
        compact={compact}
      />

      <Text style={[styles.sectionHeader, { color: theme.textSecondary, marginTop: 18 }]}>BILL CHARGES</Text>
      <Text style={{ fontSize: 11, color: theme.textSecondary, marginBottom: 10, lineHeight: 16 }}>
        Configure service charge, packing, delivery, or other add-ons. Cashiers toggle these presets at checkout.
      </Text>

      {chargePresets.map((preset, index) => (
        <View
          key={preset.id}
          style={[
            styles.chargeRow,
            { backgroundColor: theme.cardBg, borderColor: theme.borderColor },
          ]}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
            <TextInput
              style={[
                styles.chargePresetInput,
                { flex: 1, color: theme.textPrimary, borderColor: theme.borderColor, backgroundColor: theme.bg },
              ]}
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
              style={[
                styles.chargePresetInput,
                { flex: 1, color: theme.textPrimary, borderColor: theme.borderColor, backgroundColor: theme.bg },
              ]}
              value={String(preset.value)}
              onChangeText={(text) => {
                setChargePresets((prev) =>
                  prev.map((p, i) => (i === index ? { ...p, value: Math.max(0, parseFloat(text) || 0) } : p)),
                );
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
        onPress={handleSave}
        disabled={isSavingGstBilling}
        style={[styles.saveBtn, isSavingGstBilling && { opacity: 0.6 }]}
      >
        {isSavingGstBilling ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.saveBtnText}>Save Tax & Billing</Text>
        )}
      </TouchableOpacity>
    </>
  );

  if (collapsible) {
    return (
      <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
        <TouchableOpacity
          onPress={() => setExpanded((prev) => !prev)}
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
          activeOpacity={0.85}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Percent size={16} color="#0F766E" />
            <Text style={{ fontSize: 15, fontWeight: '800', color: theme.textPrimary }}>Tax & Billing</Text>
          </View>
          {expanded ? <ChevronUp size={18} color={theme.textSecondary} /> : <ChevronDown size={18} color={theme.textSecondary} />}
        </TouchableOpacity>
        {expanded ? (
          <View style={{ marginTop: 12 }}>{body}</View>
        ) : (
          <Text style={{ fontSize: 11, color: theme.textSecondary, marginTop: 6 }}>
            Tap to configure GST breakdown and bill charges for printed receipts
          </Text>
        )}
      </View>
    );
  }

  return (
    <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <Percent size={16} color="#0F766E" />
        <Text style={{ fontSize: 15, fontWeight: '800', color: theme.textPrimary }}>Tax & Billing</Text>
      </View>
      {body}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  chargeRow: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  chargePresetInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
  },
  chargeTypeBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(100,116,139,0.15)',
  },
  chargeAddBtn: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 8,
  },
  saveBtn: {
    backgroundColor: BRAND_COLORS.blue600,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },
});
