import React from 'react';
import { View, Text, Switch, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { Check } from 'lucide-react-native';
import { GST_BREAKDOWN_STYLE_OPTIONS, type GstBreakdownStyle } from '@/constants/gstBilling';
import { BRAND_COLORS } from '@/constants/theme';
import type { AppTheme } from '@/hooks/useAppTheme';

export interface GstBillingSettingsPanelProps {
  theme: AppTheme;
  showBreakdown: boolean;
  style: GstBreakdownStyle;
  printOnReceipt: boolean;
  itemWiseGst: boolean;
  onShowBreakdownChange: (value: boolean) => void;
  onStyleChange: (value: GstBreakdownStyle) => void;
  onPrintOnReceiptChange: (value: boolean) => void;
  onItemWiseGstChange: (value: boolean) => void;
  onSave?: () => void;
  isSaving?: boolean;
  showSaveButton?: boolean;
  hintText?: string;
  compact?: boolean;
}

export function GstBillingSettingsPanel({
  theme,
  showBreakdown,
  style: gstStyle,
  printOnReceipt,
  itemWiseGst,
  onShowBreakdownChange,
  onStyleChange,
  onPrintOnReceiptChange,
  onItemWiseGstChange,
  onSave,
  isSaving = false,
  showSaveButton = true,
  hintText = 'Show a GST bill breakdown at checkout and on printed receipts. Use this if you sell on base price (GST extra) or run a restaurant with mixed GST slabs.',
  compact = false,
}: GstBillingSettingsPanelProps) {
  return (
    <View>
      {hintText ? (
        <Text style={{ fontSize: 12, color: theme.textSecondary, marginBottom: compact ? 10 : 14, lineHeight: 18 }}>
          {hintText}
        </Text>
      ) : null}

      <View style={[styles.permRow, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
        <View style={{ flex: 1, marginRight: 12 }}>
          <Text style={[styles.permTitle, { color: theme.textPrimary }]}>Show GST breakdown on bills</Text>
          <Text style={{ fontSize: 11, color: theme.textSecondary, marginTop: 3 }}>
            Taxable value, CGST and SGST on Scan to Bill, Quick Bill, and past invoices
          </Text>
        </View>
        <Switch
          value={showBreakdown}
          onValueChange={(val) => {
            onShowBreakdownChange(val);
            if (val && !printOnReceipt) onPrintOnReceiptChange(true);
          }}
          trackColor={{ false: '#64748B', true: BRAND_COLORS.blue600 }}
        />
      </View>

      <Text style={[styles.sectionHeader, { color: theme.textSecondary, marginTop: compact ? 12 : 16 }]}>
        BREAKDOWN STYLE
      </Text>
      {GST_BREAKDOWN_STYLE_OPTIONS.map((option) => {
        const selected = gstStyle === option.value;
        return (
          <TouchableOpacity
            key={option.value}
            onPress={() => onStyleChange(option.value)}
            style={[
              styles.langCard,
              {
                backgroundColor: selected ? 'rgba(37, 99, 235, 0.15)' : theme.cardBg,
                borderColor: selected ? BRAND_COLORS.blue600 : theme.borderColor,
              },
            ]}
          >
            <View style={{ flex: 1, marginRight: 10 }}>
              <Text style={[styles.langText, { color: selected ? BRAND_COLORS.blue600 : theme.textPrimary }]}>
                {option.label}
              </Text>
              <Text style={{ fontSize: 11, color: theme.textSecondary, marginTop: 3, fontWeight: '600' }}>
                {option.description}
              </Text>
            </View>
            {selected ? <Check size={18} color={BRAND_COLORS.blue600} /> : null}
          </TouchableOpacity>
        );
      })}

      <View style={[styles.permRow, { backgroundColor: theme.cardBg, borderColor: theme.borderColor, marginTop: 8 }]}>
        <View style={{ flex: 1, marginRight: 12 }}>
          <Text style={[styles.permTitle, { color: theme.textPrimary }]}>Print breakdown on receipt</Text>
          <Text style={{ fontSize: 11, color: theme.textSecondary, marginTop: 3 }}>
            Thermal and A4 bills. Kitchen tickets (KOT) never print GST.
          </Text>
        </View>
        <Switch
          value={printOnReceipt}
          onValueChange={onPrintOnReceiptChange}
          trackColor={{ false: '#64748B', true: BRAND_COLORS.blue600 }}
        />
      </View>

      <View style={[styles.permRow, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
        <View style={{ flex: 1, marginRight: 12 }}>
          <Text style={[styles.permTitle, { color: theme.textPrimary }]}>Show GST % on each item</Text>
          <Text style={{ fontSize: 11, color: theme.textSecondary, marginTop: 3 }}>
            Prints the slab under every line — useful for mixed restaurant menus
          </Text>
        </View>
        <Switch
          value={itemWiseGst}
          onValueChange={onItemWiseGstChange}
          trackColor={{ false: '#64748B', true: BRAND_COLORS.blue600 }}
        />
      </View>

      {showSaveButton && onSave ? (
        <TouchableOpacity
          onPress={onSave}
          disabled={isSaving}
          style={[styles.saveBtn, { backgroundColor: BRAND_COLORS.blue600, opacity: isSaving ? 0.7 : 1 }]}
        >
          {isSaving ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={styles.saveBtnText}>Save Tax & Billing</Text>
          )}
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  permRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 8,
  },
  permTitle: { fontSize: 14, fontWeight: '700' },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  langCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  langText: { fontSize: 14, fontWeight: '700' },
  saveBtn: {
    marginTop: 12,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  saveBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 14 },
});
