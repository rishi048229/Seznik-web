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
} from 'react-native';
import { Sparkles, Image as ImageIcon, Check, X, Wand2, Receipt } from 'lucide-react-native';
import { useAppTheme } from '@/hooks/useAppTheme';
import { BRAND_COLORS } from '@/constants/theme';
import { removeImageBackground } from '@/utils/imageBackgroundRemoval';
import { useTranslation } from '@/store/useLanguageStore';

export interface LogoBackgroundModalProps {
  visible: boolean;
  imageUri: string | null;
  onApply: (finalUri: string, removedBg: boolean) => void;
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

  const [selectedMode, setSelectedMode] = useState<'remove_bg' | 'keep_bg'>('remove_bg');
  const [processedUri, setProcessedUri] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [previewTheme, setPreviewTheme] = useState<'receipt' | 'transparent'>('receipt');

  useEffect(() => {
    if (visible && imageUri) {
      setSelectedMode('remove_bg');
      setProcessedUri(null);
      setIsProcessing(true);

      let isMounted = true;
      removeImageBackground(imageUri, { tolerance: 38, softness: 16, trimPadding: true })
        .then((res) => {
          if (isMounted) {
            setProcessedUri(res.uri);
            setIsProcessing(false);
          }
        })
        .catch((err) => {
          console.warn('Background removal error:', err);
          if (isMounted) {
            setProcessedUri(imageUri);
            setIsProcessing(false);
          }
        });

      return () => {
        isMounted = false;
      };
    }
  }, [visible, imageUri]);

  if (!visible || !imageUri) return null;

  const currentPreviewUri = selectedMode === 'remove_bg' && processedUri ? processedUri : imageUri;

  const handleConfirm = () => {
    if (selectedMode === 'remove_bg' && processedUri) {
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
                  {t('logoBackgroundOption', 'Logo Background Option')}
                </Text>
                <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
                  {t('chooseLogoBackground', 'Choose how your logo appears on receipts & screens')}
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={onCancel} style={styles.closeBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <X size={20} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Options Selector Cards */}
          <View style={styles.optionsRow}>
            {/* Option 1: Remove Background */}
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setSelectedMode('remove_bg')}
              style={[
                styles.optionCard,
                {
                  backgroundColor: theme.isDark ? '#1E293B' : '#F8FAFC',
                  borderColor: selectedMode === 'remove_bg' ? BRAND_COLORS.blue600 : theme.borderColor,
                },
                selectedMode === 'remove_bg' && styles.optionCardActive,
              ]}
            >
              <View style={styles.optionHeader}>
                <View style={[styles.badgeIcon, { backgroundColor: selectedMode === 'remove_bg' ? BRAND_COLORS.blue600 : '#94A3B8' }]}>
                  <Sparkles size={14} color="#FFFFFF" />
                </View>
                <View style={[styles.radioCircle, selectedMode === 'remove_bg' && { borderColor: BRAND_COLORS.blue600 }]}>
                  {selectedMode === 'remove_bg' && <View style={[styles.radioDot, { backgroundColor: BRAND_COLORS.blue600 }]} />}
                </View>
              </View>
              <Text style={[styles.optionTitle, { color: theme.textPrimary }]}>
                {t('removeBackground', 'Remove Background')}
              </Text>
              <Text style={[styles.optionSub, { color: theme.textSecondary }]}>
                {t('removeBgSub', 'Transparent cut • Crisp for thermal receipts')}
              </Text>
              <View style={styles.recommendBadge}>
                <Text style={styles.recommendText}>✨ Recommended</Text>
              </View>
            </TouchableOpacity>

            {/* Option 2: Keep Background */}
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setSelectedMode('keep_bg')}
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
                  <ImageIcon size={14} color="#FFFFFF" />
                </View>
                <View style={[styles.radioCircle, selectedMode === 'keep_bg' && { borderColor: BRAND_COLORS.blue600 }]}>
                  {selectedMode === 'keep_bg' && <View style={[styles.radioDot, { backgroundColor: BRAND_COLORS.blue600 }]} />}
                </View>
              </View>
              <Text style={[styles.optionTitle, { color: theme.textPrimary }]}>
                {t('keepBackground', 'Keep Background')}
              </Text>
              <Text style={[styles.optionSub, { color: theme.textSecondary }]}>
                {t('keepBgSub', 'Original photo as-is • Keeps solid backdrop')}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Live Preview Section */}
          <View style={styles.previewContainer}>
            <View style={styles.previewHeaderRow}>
              <Text style={[styles.previewLabel, { color: theme.textSecondary }]}>
                LIVE PREVIEW ({selectedMode === 'remove_bg' ? 'Transparent' : 'Original'})
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
                  <Text style={[styles.previewToggleText, { color: theme.textPrimary }]}>Grid</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View
              style={[
                styles.previewBox,
                previewTheme === 'receipt'
                  ? { backgroundColor: '#FFFFFF', borderColor: '#E2E8F0' }
                  : { backgroundColor: theme.isDark ? '#0F172A' : '#F1F5F9', borderColor: theme.borderColor },
              ]}
            >
              {isProcessing && selectedMode === 'remove_bg' ? (
                <View style={styles.loadingBox}>
                  <ActivityIndicator size="small" color={BRAND_COLORS.blue600} />
                  <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
                    {t('processingImage', 'Removing background...')}
                  </Text>
                </View>
              ) : (
                <View style={styles.logoWrapper}>
                  <Image
                    source={{ uri: currentPreviewUri }}
                    style={styles.previewImage}
                    resizeMode="contain"
                  />
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
              disabled={isProcessing && selectedMode === 'remove_bg'}
              style={[
                styles.applyBtn,
                { backgroundColor: BRAND_COLORS.blue600 },
                isProcessing && selectedMode === 'remove_bg' && { opacity: 0.6 },
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
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 480,
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
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
    marginBottom: 16,
  },
  headerIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  closeBtn: {
    padding: 4,
  },
  optionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  optionCard: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 2,
    padding: 12,
    justifyContent: 'space-between',
  },
  optionCardActive: {
    borderColor: BRAND_COLORS.blue600,
  },
  optionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  badgeIcon: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: '#94A3B8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
  },
  optionTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
  },
  optionSub: {
    fontSize: 11,
    lineHeight: 14,
  },
  recommendBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 8,
  },
  recommendText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#D97706',
  },
  previewContainer: {
    marginBottom: 20,
  },
  previewHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  previewLabel: {
    fontSize: 11,
    fontWeight: '700',
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
    paddingVertical: 4,
    borderRadius: 6,
  },
  previewToggleText: {
    fontSize: 11,
    fontWeight: '600',
  },
  previewBox: {
    width: '100%',
    height: 170,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    padding: 12,
  },
  loadingBox: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  loadingText: {
    fontSize: 12,
    fontWeight: '600',
  },
  logoWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewImage: {
    width: 120,
    height: 70,
  },
  receiptSimText: {
    alignItems: 'center',
    marginTop: 8,
  },
  receiptStoreName: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: 0.5,
  },
  receiptPhone: {
    fontSize: 9,
    color: '#475569',
    marginTop: 1,
  },
  receiptDashes: {
    fontSize: 9,
    color: '#94A3B8',
    marginTop: 2,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  footer: {
    flexDirection: 'row',
    gap: 10,
  },
  cancelBtn: {
    flex: 1,
    height: 44,
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
    height: 44,
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
