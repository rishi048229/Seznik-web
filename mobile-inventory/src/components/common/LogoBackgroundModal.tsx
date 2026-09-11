import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  Image,
  StyleSheet,
  ActivityIndicator,
  Platform,
  ScrollView,
} from 'react-native';
import { Image as ImageIcon, Check, X, Wand2, Receipt, SunMedium, Sliders, RefreshCw } from 'lucide-react-native';
import { useAppTheme } from '@/hooks/useAppTheme';
import { BRAND_COLORS } from '@/constants/theme';
import { removeImageBackground, analyzeLogoForThermal, type LogoProcessMode, type LogoThermalAnalysis } from '@/utils/imageBackgroundRemoval';
import { useTranslation } from '@/store/useLanguageStore';
import { ThermalReceiptLogoImage } from '@/components/ui/ThermalReceiptLogoImage';

export interface LogoBackgroundModalProps {
  visible: boolean;
  imageUri: string | null;
  onApply: (finalUri: string, isProcessed: boolean) => void;
  onCancel: () => void;
}

export const LogoBackgroundModal: React.FC<LogoBackgroundModalProps> = ({
  visible,
  imageUri,
  onApply,
  onCancel,
}) => {
  const theme = useAppTheme();
  const { t } = useTranslation();

  const [selectedMode, setSelectedMode] = useState<LogoProcessMode>('white_clean');
  const [isReceiptBw, setIsReceiptBw] = useState<boolean>(true);
  const [tolerance, setTolerance] = useState<number>(45);
  const [processedUri, setProcessedUri] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [previewTheme, setPreviewTheme] = useState<'receipt' | 'transparent'>('receipt');
  const [analysis, setAnalysis] = useState<LogoThermalAnalysis | null>(null);

  const reprocess = (uri: string, mode: LogoProcessMode, tol: number) => {
    if (mode === 'keep_bg') {
      setProcessedUri(uri);
      setIsProcessing(false);
      return;
    }

    setIsProcessing(true);
    removeImageBackground(uri, {
      mode: mode === 'white_clean' ? 'white_clean' : 'transparent',
      tolerance: tol,
      softness: 16,
      trimPadding: true,
      invert: false,
    })
      .then((res) => {
        setProcessedUri(res.uri);
        setIsProcessing(false);
      })
      .catch((err) => {
        console.warn('Background removal error:', err);
        setProcessedUri(uri);
        setIsProcessing(false);
      });
  };

  useEffect(() => {
    if (!visible || !imageUri) return;

    let cancelled = false;
    setSelectedMode('white_clean');
    setTolerance(45);
    setAnalysis(null);
    setIsProcessing(true);

    analyzeLogoForThermal(imageUri)
      .then((result) => {
        if (cancelled) return;
        const mode = result?.recommendedMode ?? 'white_clean';
        setAnalysis(result);
        setSelectedMode(mode);
        reprocess(imageUri, mode, 45);
      })
      .catch(() => {
        if (cancelled) return;
        setSelectedMode('white_clean');
        reprocess(imageUri, 'white_clean', 45);
      });

    return () => {
      cancelled = true;
    };
  }, [visible, imageUri]);

  if (!visible || !imageUri) return null;

  const currentPreviewUri = selectedMode === 'keep_bg' ? imageUri : (processedUri || imageUri);

  const handleModeChange = (mode: LogoProcessMode) => {
    setSelectedMode(mode);
    reprocess(imageUri, mode, tolerance);
  };

  const handleToleranceChange = (tol: number) => {
    setTolerance(tol);
    reprocess(imageUri, selectedMode, tol);
  };

  const handleConfirm = () => {
    if (selectedMode !== 'keep_bg' && processedUri) {
      onApply(processedUri, true);
    } else {
      onApply(imageUri, false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <View style={[styles.modalCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={[styles.headerIconBox, { backgroundColor: 'rgba(37, 99, 235, 0.12)' }]}>
                <Wand2 size={20} color={BRAND_COLORS.blue600} />
              </View>
              <View>
                <Text style={[styles.title, { color: theme.textPrimary }]}>
                  {t('logoBackgroundOption', 'Logo Background Options')}
                </Text>
                <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
                  {t('chooseLogoBackground', 'We auto-pick the thermal-safe option — you can still change it')}
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={onCancel} style={styles.closeBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <X size={20} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }}>
            {/* Options Selector Cards */}
            <View style={styles.optionsRow}>
              {/* Option 1: Remove Background (Transparent) */}
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => handleModeChange('transparent')}
                style={[
                  styles.optionCard,
                  {
                    backgroundColor: theme.isDark ? '#1E293B' : '#F8FAFC',
                    borderColor: selectedMode === 'transparent' ? BRAND_COLORS.blue600 : theme.borderColor,
                  },
                  selectedMode === 'transparent' && styles.optionCardActive,
                ]}
              >
                <View style={styles.optionHeader}>
                  <View style={[styles.badgeIcon, { backgroundColor: selectedMode === 'transparent' ? BRAND_COLORS.blue600 : '#94A3B8' }]}>
                    <Wand2 size={13} color="#FFFFFF" />
                  </View>
                  <View style={[styles.radioCircle, selectedMode === 'transparent' && { borderColor: BRAND_COLORS.blue600 }]}>
                    {selectedMode === 'transparent' && <View style={[styles.radioDot, { backgroundColor: BRAND_COLORS.blue600 }]} />}
                  </View>
                </View>
                <Text style={[styles.optionTitle, { color: theme.textPrimary }]}>
                  {t('removeBackground', 'Remove Background')}
                </Text>
                <Text style={[styles.optionSub, { color: theme.textSecondary }]}>
                  {t('removeBgSub', 'Cut colored backdrop • prints on white paper')}
                </Text>
                {analysis?.recommendedMode === 'transparent' && (
                  <View style={styles.recommendBadge}>
                    <Text style={styles.recommendText}>Best</Text>
                  </View>
                )}
              </TouchableOpacity>

              {/* Option 2: Clean White Background */}
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => handleModeChange('white_clean')}
                style={[
                  styles.optionCard,
                  {
                    backgroundColor: theme.isDark ? '#1E293B' : '#F8FAFC',
                    borderColor: selectedMode === 'white_clean' ? BRAND_COLORS.blue600 : theme.borderColor,
                  },
                  selectedMode === 'white_clean' && styles.optionCardActive,
                ]}
              >
                <View style={styles.optionHeader}>
                  <View style={[styles.badgeIcon, { backgroundColor: selectedMode === 'white_clean' ? '#10B981' : '#94A3B8' }]}>
                    <SunMedium size={13} color="#FFFFFF" />
                  </View>
                  <View style={[styles.radioCircle, selectedMode === 'white_clean' && { borderColor: BRAND_COLORS.blue600 }]}>
                    {selectedMode === 'white_clean' && <View style={[styles.radioDot, { backgroundColor: BRAND_COLORS.blue600 }]} />}
                  </View>
                </View>
                <Text style={[styles.optionTitle, { color: theme.textPrimary }]}>
                  {t('whiteBackground', 'Clean White')}
                </Text>
                <Text style={[styles.optionSub, { color: theme.textSecondary }]}>
                  {t('whiteBgSub', 'Best when the logo already has a white background')}
                </Text>
                {analysis?.recommendedMode === 'white_clean' && (
                  <View style={styles.recommendBadge}>
                    <Text style={styles.recommendText}>Best</Text>
                  </View>
                )}
              </TouchableOpacity>

              {/* Option 3: Keep Original Background */}
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => handleModeChange('keep_bg')}
                style={[
                  styles.optionCard,
                  {
                    backgroundColor: theme.isDark ? '#1E293B' : '#F8FAFC',
                    borderColor: selectedMode === 'keep_bg' ? BRAND_COLORS.blue600 : theme.borderColor,
                  },
                  selectedMode === 'keep_bg' && styles.optionCardActive,
                ]}
              >
                <View style={styles.optionHeader}>
                  <View style={[styles.badgeIcon, { backgroundColor: selectedMode === 'keep_bg' ? BRAND_COLORS.blue600 : '#94A3B8' }]}>
                    <ImageIcon size={13} color="#FFFFFF" />
                  </View>
                  <View style={[styles.radioCircle, selectedMode === 'keep_bg' && { borderColor: BRAND_COLORS.blue600 }]}>
                    {selectedMode === 'keep_bg' && <View style={[styles.radioDot, { backgroundColor: BRAND_COLORS.blue600 }]} />}
                  </View>
                </View>
                <Text style={[styles.optionTitle, { color: theme.textPrimary }]}>
                  {t('keepBackground', 'Keep Original')}
                </Text>
                <Text style={[styles.optionSub, { color: theme.textSecondary }]}>
                  {t('keepBgSub', 'Keep full photo as-is')}
                </Text>
                {analysis?.recommendedMode === 'keep_bg' && (
                  <View style={styles.recommendBadge}>
                    <Text style={styles.recommendText}>Best</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>

            {analysis?.hint ? (
              <View style={[styles.hintBar, { backgroundColor: theme.isDark ? 'rgba(37, 99, 235, 0.12)' : '#EFF6FF', borderColor: theme.isDark ? 'rgba(37, 99, 235, 0.35)' : '#BFDBFE' }]}>
                <Text style={[styles.hintText, { color: theme.textPrimary }]}>{analysis.hint}</Text>
              </View>
            ) : null}

            {selectedMode === 'transparent' && analysis?.backgroundIsWhite ? (
              <View style={[styles.hintBar, { backgroundColor: theme.isDark ? 'rgba(245, 158, 11, 0.12)' : '#FFFBEB', borderColor: theme.isDark ? 'rgba(245, 158, 11, 0.4)' : '#FDE68A' }]}>
                <Text style={[styles.hintText, { color: theme.textPrimary }]}>
                  {t(
                    'whiteBgRemoveWarning',
                    'This logo already has a white background. Clean White is recommended — Remove Background can print as a black block on thermal printers.'
                  )}
                </Text>
              </View>
            ) : null}

            {/* Fine Tuning Controls (Invert + Tolerance) */}
            {selectedMode !== 'keep_bg' && (
              <View style={[styles.tuneBar, { backgroundColor: theme.isDark ? '#1E293B' : '#F1F5F9', borderColor: theme.borderColor }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Sliders size={13} color={theme.textSecondary} />
                    <Text style={{ fontSize: 11, fontWeight: '700', color: theme.textPrimary }}>Cleanup Sensitivity:</Text>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 4 }}>
                    {[
                      { label: 'Low', val: 25 },
                      { label: 'Medium', val: 45 },
                      { label: 'High', val: 70 },
                    ].map((s) => (
                      <TouchableOpacity
                        key={s.label}
                        onPress={() => handleToleranceChange(s.val)}
                        style={[
                          styles.tuneChip,
                          { borderColor: theme.borderColor },
                          tolerance === s.val && { backgroundColor: BRAND_COLORS.blue600, borderColor: BRAND_COLORS.blue600 },
                        ]}
                      >
                        <Text style={[styles.tuneChipText, { color: tolerance === s.val ? '#FFFFFF' : theme.textSecondary }]}>
                          {s.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <TouchableOpacity
                  onPress={() => setIsReceiptBw((v) => !v)}
                  style={[
                    styles.invertBtn,
                    {
                      borderColor: isReceiptBw ? (theme.isDark ? '#38BDF8' : '#0284C7') : theme.borderColor,
                      backgroundColor: isReceiptBw ? (theme.isDark ? 'rgba(56, 189, 248, 0.12)' : 'rgba(2, 132, 199, 0.08)') : 'transparent',
                    },
                  ]}
                >
                  <Receipt size={13} color={isReceiptBw ? (theme.isDark ? '#38BDF8' : '#0284C7') : theme.textSecondary} />
                  <Text style={{ fontSize: 11, fontWeight: '700', color: isReceiptBw ? (theme.isDark ? '#38BDF8' : '#0284C7') : theme.textPrimary, marginLeft: 6 }}>
                    Receipt B&amp;W View: {isReceiptBw ? 'ON (Thermal Print Preview)' : 'OFF (Color Preview)'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Live Preview Section */}
            <View style={styles.previewContainer}>
              <View style={styles.previewHeaderRow}>
                <Text style={[styles.previewLabel, { color: theme.textSecondary }]}>
                  REALTIME RECEIPT PREVIEW
                </Text>
                <View style={styles.previewToggles}>
                  <TouchableOpacity
                    onPress={() => setPreviewTheme('receipt')}
                    style={[
                      styles.previewToggleBtn,
                      previewTheme === 'receipt' && { backgroundColor: theme.isDark ? '#334155' : '#E2E8F0' },
                    ]}
                  >
                    <Receipt size={12} color={theme.textPrimary} />
                    <Text style={[styles.previewToggleText, { color: theme.textPrimary }]}>Receipt</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setPreviewTheme('transparent')}
                    style={[
                      styles.previewToggleBtn,
                      previewTheme === 'transparent' && { backgroundColor: theme.isDark ? '#334155' : '#E2E8F0' },
                    ]}
                  >
                    <Text style={[styles.previewToggleText, { color: theme.textPrimary }]}>Canvas</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View
                style={[
                  styles.previewBox,
                  previewTheme === 'receipt'
                    ? { backgroundColor: '#FFFFFF', borderColor: '#CBD5E1' }
                    : { backgroundColor: theme.isDark ? '#0F172A' : '#F1F5F9', borderColor: theme.borderColor },
                ]}
              >
                {isProcessing ? (
                  <View style={styles.loadingBox}>
                    <ActivityIndicator size="small" color={BRAND_COLORS.blue600} />
                    <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
                      {t('processingImage', 'Preparing logo for thermal print...')}
                    </Text>
                  </View>
                ) : (
                  <View style={styles.logoWrapper}>
                    <View style={styles.logoCanvasBacking}>
                      {isReceiptBw ? (
                        <ThermalReceiptLogoImage
                          uri={currentPreviewUri}
                          style={styles.previewImage}
                          resizeMode="contain"
                        />
                      ) : (
                        <Image
                          source={{ uri: currentPreviewUri }}
                          style={styles.previewImage}
                          resizeMode="contain"
                        />
                      )}
                    </View>
                    {previewTheme === 'receipt' && (
                      <View style={styles.receiptSimText}>
                        <Text style={styles.receiptStoreName}>YOUR STORE NAME</Text>
                        <Text style={styles.receiptPhone}>123 Market St • Phone: 9876543210</Text>
                        <Text style={styles.receiptDashes}>--------------------------------</Text>
                      </View>
                    )}
                  </View>
                )}
              </View>
            </View>
          </ScrollView>

          {/* Action Buttons */}
          <View style={styles.footer}>
            <TouchableOpacity
              onPress={onCancel}
              style={[styles.cancelBtn, { borderColor: theme.borderColor }]}
            >
              <Text style={[styles.cancelBtnText, { color: theme.textSecondary }]}>
                {t('cancel', 'Cancel')}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleConfirm}
              disabled={isProcessing}
              style={[
                styles.applyBtn,
                { backgroundColor: BRAND_COLORS.blue600 },
                isProcessing && { opacity: 0.6 },
              ]}
            >
              <Check size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.applyBtnText}>
                {t('applyLogo', 'Use This Logo')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 14,
  },
  modalCard: {
    width: '100%',
    maxWidth: 480,
    borderRadius: 20,
    borderWidth: 1,
    padding: 18,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.25,
        shadowRadius: 16,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  headerIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 15,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 11,
    marginTop: 2,
  },
  closeBtn: {
    padding: 4,
  },
  optionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  hintBar: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 12,
  },
  hintText: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '600',
  },
  optionCard: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 2,
    padding: 10,
    justifyContent: 'space-between',
  },
  optionCardActive: {
    borderColor: BRAND_COLORS.blue600,
  },
  optionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  badgeIcon: {
    width: 24,
    height: 24,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCircle: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#94A3B8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  optionTitle: {
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 2,
  },
  optionSub: {
    fontSize: 10,
    lineHeight: 13,
  },
  recommendBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 5,
    marginTop: 6,
  },
  recommendText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#D97706',
  },
  tuneBar: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
  },
  tuneChip: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  tuneChipText: {
    fontSize: 10,
    fontWeight: '700',
  },
  invertBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 6,
    paddingVertical: 5,
    paddingHorizontal: 8,
    alignSelf: 'flex-start',
  },
  previewContainer: {
    marginBottom: 14,
  },
  previewHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  previewLabel: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  previewToggles: {
    flexDirection: 'row',
    gap: 4,
  },
  previewToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  previewToggleText: {
    fontSize: 10.5,
    fontWeight: '700',
  },
  previewBox: {
    width: '100%',
    height: 155,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    padding: 10,
  },
  loadingBox: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  loadingText: {
    fontSize: 11.5,
    fontWeight: '600',
  },
  logoWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoCanvasBacking: {
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewImage: {
    width: 130,
    height: 60,
  },
  receiptSimText: {
    alignItems: 'center',
    marginTop: 6,
  },
  receiptStoreName: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: 0.5,
  },
  receiptPhone: {
    fontSize: 8.5,
    color: '#475569',
    marginTop: 1,
  },
  receiptDashes: {
    fontSize: 8.5,
    color: '#94A3B8',
    marginTop: 2,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  footer: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  cancelBtn: {
    flex: 1,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  applyBtn: {
    flex: 2,
    height: 42,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
});
