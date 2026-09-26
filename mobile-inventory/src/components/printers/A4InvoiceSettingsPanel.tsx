import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Switch,
  Alert,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { FileText } from 'lucide-react-native';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useSettings } from '@/hooks/useSettings';
import { settingsApi } from '@/api/settings';
import { BRAND_COLORS } from '@/constants/theme';
import {
  A4_COLOR_THEMES,
  A4_INVOICE_TEMPLATE_OPTIONS,
  type A4TemplateId,
} from '@/constants/a4InvoiceTemplateOptions';
import ThermalPrinterService from '@/services/PrinterService';
import { buildSampleTestSale, buildTestReceiptPrintOptions } from '@/utils/fastSaleCheckout';
import { usePrinterStore } from '@/store/usePrinterStore';
import { useShallow } from 'zustand/react/shallow';

/** A4 / PDF invoice settings — same options as web Printers → A4 invoice tab. */
export function A4InvoiceSettingsPanel() {
  const theme = useAppTheme();
  const { settings, refetch } = useSettings();
  const printerState = usePrinterStore(
    useShallow((s) => ({
      activeTemplateId: s.activeTemplateId,
      customTemplates: s.customTemplates,
      activeCustomTemplateId: s.activeCustomTemplateId,
      enableBillQrCode: s.enableBillQrCode,
      enablePaymentQr: s.enablePaymentQr,
      topMargin: s.topMargin,
      autoCut: s.autoCut,
      fontSize: s.fontSize,
    }))
  );

  const printer = useMemo(
    () =>
      settings?.printerConfig && typeof settings.printerConfig === 'object'
        ? (settings.printerConfig as Record<string, unknown>)
        : {},
    [settings?.printerConfig]
  );

  const [templateId, setTemplateId] = useState<A4TemplateId>('retail');
  const [colorTheme, setColorTheme] = useState<string>('navy');
  const [paperSize, setPaperSize] = useState<'A4' | 'Letter'>('A4');
  const [showPaymentOnInvoice, setShowPaymentOnInvoice] = useState(false);
  const [showHsn, setShowHsn] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setTemplateId((printer.invoiceTemplateId as A4TemplateId) || 'retail');
    setColorTheme(String(printer.invoiceColorTheme || 'navy'));
    setPaperSize(printer.invoicePaperSize === 'Letter' ? 'Letter' : 'A4');
    setShowPaymentOnInvoice(Boolean(printer.invoiceShowPaymentQR));
    setShowHsn(printer.invoiceShowHsn !== false);
  }, [printer]);

  const save = async () => {
    try {
      setSaving(true);
      await settingsApi.updatePrinterConfig({
        invoiceTemplateId: templateId,
        invoiceColorTheme: colorTheme,
        invoicePaperSize: paperSize,
        invoiceShowPaymentQR: showPaymentOnInvoice,
        invoiceShowHsn: showHsn,
      });
      await refetch();
      Alert.alert('Saved', 'A4 invoice layout synced with web.');
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not save A4 settings.');
    } finally {
      setSaving(false);
    }
  };

  const testA4 = async () => {
    try {
      const sample = buildSampleTestSale(settings);
      const ok = await ThermalPrinterService.printA4Invoice(
        sample,
        buildTestReceiptPrintOptions({
          ...printerState,
          settings,
          copies: 1,
        })
      );
      if (!ok) throw new Error('Could not open system print dialog.');
    } catch (e: any) {
      Alert.alert('Print', e?.message || 'Use Test A4 via system print or share PDF from a sale.');
    }
  };

  return (
    <View>
      <Text style={[styles.lead, { color: theme.textSecondary }]}>
        Full-page tax invoices — same 15 trade templates and color themes as web Printers.
      </Text>

      <Text style={[styles.sectionLabel, { color: theme.textPrimary }]}>Template</Text>
      {A4_INVOICE_TEMPLATE_OPTIONS.map((t) => {
        const active = templateId === t.id;
        return (
          <TouchableOpacity
            key={t.id}
            onPress={() => setTemplateId(t.id)}
            style={[
              styles.templateRow,
              { borderColor: active ? BRAND_COLORS.blue600 : theme.borderColor, backgroundColor: theme.cardBg },
            ]}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: '800', color: theme.textPrimary, fontSize: 13 }}>{t.name}</Text>
              <Text style={{ fontSize: 11, color: theme.textSecondary }}>{t.category}</Text>
            </View>
            {active ? <Text style={{ color: BRAND_COLORS.blue600, fontWeight: '800' }}>✓</Text> : null}
          </TouchableOpacity>
        );
      })}

      <Text style={[styles.sectionLabel, { color: theme.textPrimary, marginTop: 16 }]}>Color theme</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {A4_COLOR_THEMES.map((th) => {
          const active = colorTheme === th.id;
          return (
            <TouchableOpacity
              key={th.id}
              onPress={() => setColorTheme(th.id)}
              style={[
                styles.chip,
                { borderColor: active ? BRAND_COLORS.blue600 : theme.borderColor },
                active && { backgroundColor: 'rgba(37,99,235,0.1)' },
              ]}
            >
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: '700',
                  color: active ? BRAND_COLORS.blue600 : theme.textPrimary,
                }}
              >
                {th.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.borderColor, marginTop: 16 }]}>
        <Text style={[styles.sectionLabel, { color: theme.textPrimary, marginTop: 0 }]}>Paper</Text>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
          {(['A4', 'Letter'] as const).map((p) => (
            <TouchableOpacity
              key={p}
              onPress={() => setPaperSize(p)}
              style={[styles.chip, { borderColor: theme.borderColor }, paperSize === p && { borderColor: BRAND_COLORS.blue600 }]}
            >
              <Text style={{ fontWeight: '700', fontSize: 12, color: theme.textPrimary }}>{p}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={[styles.switchRow, { borderTopColor: theme.borderColor }]}>
          <Text style={{ flex: 1, color: theme.textPrimary, fontWeight: '600' }}>Payment QR on A4 bill</Text>
          <Switch value={showPaymentOnInvoice} onValueChange={setShowPaymentOnInvoice} />
        </View>
        <View style={[styles.switchRow, { borderTopColor: theme.borderColor }]}>
          <Text style={{ flex: 1, color: theme.textPrimary, fontWeight: '600' }}>Show HSN / SAC column</Text>
          <Switch value={showHsn} onValueChange={setShowHsn} />
        </View>
      </View>

      <TouchableOpacity onPress={testA4} style={[styles.secondaryAction, { borderColor: theme.borderColor }]}>
        <FileText size={18} color={theme.textPrimary} />
        <Text style={{ marginLeft: 8, fontWeight: '700', color: theme.textPrimary }}>Test A4 via system print</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={save} disabled={saving} style={styles.primaryAction}>
        {saving ? <ActivityIndicator color="#FFF" /> : <Text style={styles.primaryText}>Save A4 settings</Text>}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  lead: { fontSize: 12, lineHeight: 18, marginBottom: 12 },
  sectionLabel: { fontSize: 13, fontWeight: '800', marginTop: 8, marginBottom: 8 },
  templateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1 },
  card: { borderWidth: 1, borderRadius: 12, padding: 14 },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: 8,
  },
  secondaryAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginTop: 16,
  },
  primaryAction: {
    backgroundColor: BRAND_COLORS.blue600,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 12,
  },
  primaryText: { color: '#FFF', fontWeight: '800', fontSize: 15 },
});
