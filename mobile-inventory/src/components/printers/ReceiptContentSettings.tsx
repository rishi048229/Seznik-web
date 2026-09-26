import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  Switch,
  TextInput,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  StyleSheet,
  Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { ChevronRight, ImageIcon, QrCode } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { BRAND_COLORS } from '@/constants/theme';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useSettings } from '@/hooks/useSettings';
import { settingsApi } from '@/api/settings';
import { persistBusinessLogo } from '@/utils/businessLogoStorage';
import { usePrinterStore } from '@/store/usePrinterStore';
import { useShallow } from 'zustand/react/shallow';
import { RECEIPT_FONT_LIBRARY, type ReceiptFontId } from '@shared/receiptFonts';
import { isValidUpiVpa } from '@/utils/billQrService';

type ReceiptToggleKey =
  | 'showCompanyHeader'
  | 'showAddress'
  | 'showPhone'
  | 'showGSTIN'
  | 'showCustomerDetails'
  | 'showInvoiceNoAndDate'
  | 'showPrintTime'
  | 'showSubtotalDiscount'
  | 'showTaxBreakdown'
  | 'showFooterMessage'
  | 'showTerms'
  | 'showBarcode';

const TOGGLE_ROWS: Array<{ key: ReceiptToggleKey; label: string; hint: string }> = [
  { key: 'showCompanyHeader', label: 'Store name header', hint: 'Business name at top of receipt' },
  { key: 'showAddress', label: 'Store address', hint: 'Address block under header' },
  { key: 'showPhone', label: 'Store phone', hint: 'Contact number on receipt' },
  { key: 'showGSTIN', label: 'GSTIN / tax ID', hint: 'GST or registration number' },
  { key: 'showCustomerDetails', label: 'Customer name & phone', hint: 'Buyer details when selected' },
  { key: 'showInvoiceNoAndDate', label: 'Invoice number & date', hint: 'Bill ID and sale date' },
  { key: 'showPrintTime', label: 'Print time', hint: 'Clock time next to date' },
  { key: 'showSubtotalDiscount', label: 'Subtotal & discount', hint: 'Line before tax totals' },
  { key: 'showTaxBreakdown', label: 'Tax breakdown', hint: 'CGST/SGST or tax lines' },
  { key: 'showFooterMessage', label: 'Footer message', hint: 'Thank-you / policy text' },
  { key: 'showTerms', label: 'Terms & conditions', hint: 'Terms lines at bottom' },
  { key: 'showBarcode', label: 'Invoice barcode', hint: 'Scannable invoice identifier' },
];

const MAX_IMAGE_BYTES = 1024 * 1024;

async function uriToDataUrlIfSmall(uri: string): Promise<string | null> {
  const info = await FileSystem.getInfoAsync(uri, { size: true });
  if (info.exists && typeof info.size === 'number' && info.size > MAX_IMAGE_BYTES) {
    return null;
  }
  const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
  const approxBytes = Math.floor((base64.length * 3) / 4);
  if (approxBytes > MAX_IMAGE_BYTES) return null;
  const ext = uri.toLowerCase().includes('.png') ? 'png' : 'jpeg';
  return `data:image/${ext};base64,${base64}`;
}

export function ReceiptContentSettings() {
  const theme = useAppTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { settings, refetch } = useSettings();
  const { enablePaymentQr, setEnablePaymentQr, setReceiptFont, receiptFont } = usePrinterStore(
    useShallow((s) => ({
      enablePaymentQr: s.enablePaymentQr,
      setEnablePaymentQr: s.setEnablePaymentQr,
      setReceiptFont: s.setReceiptFont,
      receiptFont: s.receiptFont,
    }))
  );

  const receipt = useMemo(
    () => (settings?.receiptConfig && typeof settings.receiptConfig === 'object' ? settings.receiptConfig : {}) as Record<string, any>,
    [settings?.receiptConfig]
  );
  const printer = useMemo(
    () => (settings?.printerConfig && typeof settings.printerConfig === 'object' ? settings.printerConfig : {}) as Record<string, any>,
    [settings?.printerConfig]
  );

  const [draft, setDraft] = useState<Record<string, any>>({});
  const [showLogo, setShowLogo] = useState(true);
  const [autoPrintOnSale, setAutoPrintOnSale] = useState(false);
  const [logoUri, setLogoUri] = useState<string | null>(null);
  const [paymentQrPreview, setPaymentQrPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    setDraft({ ...receipt });
    setShowLogo(printer.showLogo !== false && receipt.showLogo !== false);
    setAutoPrintOnSale(Boolean(printer.autoPrintOnSale));
    setLogoUri(receipt.logoURL || settings?.businessLogoURL || null);
    setPaymentQrPreview(typeof receipt.paymentQrURL === 'string' ? receipt.paymentQrURL : null);
  }, [receipt, printer, settings?.businessLogoURL]);

  const patchReceipt = useCallback((partial: Record<string, unknown>) => {
    setDraft((prev) => ({ ...prev, ...partial }));
  }, []);

  const toggleVal = (key: ReceiptToggleKey, defaultVal = true) =>
    draft[key] !== undefined ? Boolean(draft[key]) : defaultVal;

  const applyPreset = (mode: 'all' | 'minimal') => {
    if (mode === 'all') {
      const allOn: Record<string, boolean> = {};
      TOGGLE_ROWS.forEach((r) => {
        allOn[r.key] = true;
      });
      setDraft((prev) => ({ ...prev, ...allOn }));
    } else {
      setDraft((prev) => ({
        ...prev,
        showCompanyHeader: true,
        showInvoiceNoAndDate: true,
        showTaxBreakdown: true,
        showFooterMessage: true,
        showAddress: false,
        showPhone: false,
        showGSTIN: false,
        showCustomerDetails: false,
        showPrintTime: false,
        showSubtotalDiscount: false,
        showTerms: false,
        showBarcode: false,
      }));
    }
  };

  const pickLogo = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Allow photo access to upload your store logo.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.75,
      allowsEditing: true,
    });
    if (!result.canceled && result.assets[0]?.uri) {
      setLogoUri(result.assets[0].uri);
      setShowLogo(true);
    }
  };

  const pickStaticPaymentQr = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (!result.canceled && result.assets[0]?.uri) {
      const dataUrl = await uriToDataUrlIfSmall(result.assets[0].uri);
      if (!dataUrl) {
        Alert.alert('Image too large', 'Payment QR image must be under 1 MB.');
        return;
      }
      setPaymentQrPreview(dataUrl);
      patchReceipt({ paymentQrURL: dataUrl, showPaymentQR: true });
      setEnablePaymentQr(true).catch(() => {});
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      let logoUrl = logoUri;
      if (logoUri && !logoUri.startsWith('http') && !logoUri.startsWith('data:')) {
        logoUrl = await persistBusinessLogo(logoUri);
        setLogoUri(logoUrl);
      } else if (logoUri?.startsWith('file:')) {
        const dataUrl = await uriToDataUrlIfSmall(logoUri);
        if (!dataUrl) {
          Alert.alert('Logo too large', 'Logo must be under 1 MB.');
          setSaving(false);
          return;
        }
        logoUrl = dataUrl;
      }

      const upi = String(draft.upiId || settings?.upiId || '').trim();
      const receiptPatch = {
        ...draft,
        logoURL: showLogo ? logoUrl : draft.logoURL,
        showLogo,
        upiId: upi,
        paymentQrURL: paymentQrPreview || draft.paymentQrURL || '',
        receiptConfigUpdatedAt: new Date().toISOString(),
      };

      await settingsApi.updateReceiptConfig(receiptPatch);
      await settingsApi.updatePrinterConfig({
        showLogo,
        autoPrintOnSale,
        receiptFont,
      });

      if (settings?.id) {
        await settingsApi.updateSettings(settings.id, {
          businessLogoURL: showLogo ? logoUrl : settings.businessLogoURL,
          upiId: upi,
          receiptConfig: receiptPatch,
        });
      }

      await refetch();
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      Alert.alert('Saved', 'Receipt content settings synced with web.');
    } catch (e: any) {
      Alert.alert('Save failed', e?.message || 'Could not sync receipt settings.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={{ marginBottom: 8 }}>
      <Text style={[styles.sectionHeader, { color: theme.textPrimary }]}>RECEIPT CONTENT (WEB PARITY)</Text>
      <Text style={[styles.sectionSub, { color: theme.textSecondary }]}>
        Same toggles as web Printers → Receipt. Syncs to cloud for Josh, Rudra, Tejas, and ESC/POS.
      </Text>

      <TouchableOpacity
        onPress={() => router.push('/printers/a4-invoice' as any)}
        style={[styles.card, styles.rowBetween, { backgroundColor: theme.cardBg, borderColor: BRAND_COLORS.blue600 }]}
      >
        <View style={{ flex: 1 }}>
          <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>A4 / PDF invoice templates</Text>
          <Text style={[styles.cardSub, { color: theme.textSecondary }]}>
            15 layouts, color themes — matches web A4 tab
          </Text>
        </View>
        <ChevronRight size={20} color={BRAND_COLORS.blue600} />
      </TouchableOpacity>

      <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
        <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>Header & footer text</Text>
        <TextInput
          value={String(draft.headerTitle ?? receipt.headerTitle ?? '')}
          onChangeText={(v) => patchReceipt({ headerTitle: v })}
          placeholder="Receipt title (e.g. TAX INVOICE)"
          placeholderTextColor={theme.textSecondary}
          style={[styles.input, { color: theme.textPrimary, borderColor: theme.borderColor }]}
        />
        <TextInput
          value={String(draft.footerMessage ?? receipt.footerMessage ?? '')}
          onChangeText={(v) => patchReceipt({ footerMessage: v })}
          placeholder="Footer message"
          placeholderTextColor={theme.textSecondary}
          style={[styles.input, { color: theme.textPrimary, borderColor: theme.borderColor, marginTop: 8 }]}
        />
        <TextInput
          value={String(draft.upiId ?? settings?.upiId ?? '')}
          onChangeText={(v) => patchReceipt({ upiId: v.trim() })}
          placeholder="UPI ID (yourname@bank)"
          placeholderTextColor={theme.textSecondary}
          autoCapitalize="none"
          style={[styles.input, { color: theme.textPrimary, borderColor: theme.borderColor, marginTop: 8 }]}
        />
        {draft.upiId && !isValidUpiVpa(String(draft.upiId)) ? (
          <Text style={{ fontSize: 11, color: '#DC2626', marginTop: 4 }}>Enter a valid UPI VPA for amount-encoded QRs.</Text>
        ) : null}
      </View>

      <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
        <View style={styles.rowBetween}>
          <View style={{ flex: 1, paddingRight: 8 }}>
            <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>Print store logo</Text>
            <Text style={[styles.cardSub, { color: theme.textSecondary }]}>Top of thermal receipt</Text>
          </View>
          <Switch
            value={showLogo}
            onValueChange={setShowLogo}
            trackColor={{ false: theme.borderColor, true: BRAND_COLORS.blue600 }}
            thumbColor="#FFF"
          />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12, gap: 12 }}>
          <View style={[styles.logoBox, { borderColor: theme.borderColor, backgroundColor: theme.bg }]}>
            {logoUri ? (
              <Image source={{ uri: logoUri }} style={{ width: 56, height: 56, borderRadius: 8 }} resizeMode="contain" />
            ) : (
              <ImageIcon size={28} color={theme.textSecondary} />
            )}
          </View>
          <TouchableOpacity onPress={pickLogo} style={styles.secondaryBtn}>
            <Text style={{ color: BRAND_COLORS.blue600, fontWeight: '700', fontSize: 12 }}>Upload logo</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
        <View style={styles.rowBetween}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>Auto-print after sale</Text>
            <Text style={[styles.cardSub, { color: theme.textSecondary }]}>Print receipt when checkout completes</Text>
          </View>
          <Switch
            value={autoPrintOnSale}
            onValueChange={setAutoPrintOnSale}
            trackColor={{ false: theme.borderColor, true: BRAND_COLORS.blue600 }}
            thumbColor="#FFF"
          />
        </View>
      </View>

      <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
        <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>Receipt typeface</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
          {RECEIPT_FONT_LIBRARY.slice(0, 8).map((font) => {
            const active = receiptFont === font.id;
            return (
              <TouchableOpacity
                key={font.id}
                onPress={() => setReceiptFont(font.id as ReceiptFontId)}
                style={[
                  styles.chip,
                  { borderColor: active ? BRAND_COLORS.blue600 : theme.borderColor },
                  active && { backgroundColor: 'rgba(37, 99, 235, 0.12)' },
                ]}
              >
                <Text style={{ fontSize: 11, fontWeight: '700', color: active ? BRAND_COLORS.blue600 : theme.textPrimary }}>
                  {font.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
        <View style={styles.rowBetween}>
          <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>Static payment QR image</Text>
          <TouchableOpacity onPress={pickStaticPaymentQr} style={styles.secondaryBtn}>
            <QrCode size={14} color={BRAND_COLORS.blue600} />
            <Text style={{ color: BRAND_COLORS.blue600, fontWeight: '700', fontSize: 11, marginLeft: 4 }}>Upload</Text>
          </TouchableOpacity>
        </View>
        <Text style={[styles.cardSub, { color: theme.textSecondary, marginTop: 4 }]}>
          Fallback when no UPI ID — same as web. Max 1 MB.
        </Text>
        {paymentQrPreview ? (
          <Image source={{ uri: paymentQrPreview }} style={{ width: 80, height: 80, marginTop: 10, alignSelf: 'center' }} />
        ) : null}
      </View>

      <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
        <View style={styles.rowBetween}>
          <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>Receipt line details</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity onPress={() => applyPreset('all')} style={styles.presetBtn}>
              <Text style={styles.presetText}>Show all</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => applyPreset('minimal')} style={styles.presetBtn}>
              <Text style={styles.presetText}>Minimal</Text>
            </TouchableOpacity>
          </View>
        </View>
        {(expanded ? TOGGLE_ROWS : TOGGLE_ROWS.slice(0, 6)).map((row) => (
          <View key={row.key} style={[styles.toggleRow, { borderTopColor: theme.borderColor }]}>
            <View style={{ flex: 1, paddingRight: 8 }}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: theme.textPrimary }}>{row.label}</Text>
              <Text style={{ fontSize: 11, color: theme.textSecondary }}>{row.hint}</Text>
            </View>
            <Switch
              value={toggleVal(row.key)}
              onValueChange={(v) => patchReceipt({ [row.key]: v })}
              trackColor={{ false: theme.borderColor, true: BRAND_COLORS.blue600 }}
              thumbColor="#FFF"
            />
          </View>
        ))}
        {TOGGLE_ROWS.length > 6 ? (
          <TouchableOpacity onPress={() => setExpanded((e) => !e)} style={{ marginTop: 10 }}>
            <Text style={{ color: BRAND_COLORS.blue600, fontWeight: '700', fontSize: 12 }}>
              {expanded ? 'Show less' : `Show ${TOGGLE_ROWS.length - 6} more lines`}
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <TouchableOpacity
        onPress={handleSave}
        disabled={saving}
        style={[styles.saveBtn, { opacity: saving ? 0.7 : 1 }]}
      >
        {saving ? (
          <ActivityIndicator color="#FFF" />
        ) : (
          <Text style={styles.saveBtnText}>Save receipt content</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionHeader: { fontSize: 12, fontWeight: '800', letterSpacing: 0.6, marginTop: 4, marginBottom: 4 },
  sectionSub: { fontSize: 11, lineHeight: 16, marginBottom: 10 },
  card: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    width: '100%',
  },
  cardTitle: { fontSize: 14, fontWeight: '800' },
  cardSub: { fontSize: 11, marginTop: 2 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%' },
  input: {
    width: '100%',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    fontSize: 13,
    marginTop: 10,
  },
  logoBox: {
    width: 64,
    height: 64,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(37, 99, 235, 0.08)',
  },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: 4,
  },
  presetBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: 'rgba(100,116,139,0.12)',
  },
  presetText: { fontSize: 10, fontWeight: '700', color: '#475569' },
  saveBtn: {
    backgroundColor: BRAND_COLORS.blue600,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 8,
  },
  saveBtnText: { color: '#FFF', fontWeight: '800', fontSize: 14 },
});
