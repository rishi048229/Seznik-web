import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  useColorScheme,
} from 'react-native';
import { Sparkles, Receipt, Tag, Check, X } from 'lucide-react-native';
import { BRAND_COLORS } from '@/constants/theme';

interface JoshDualModeModalProps {
  visible: boolean;
  onDismiss: () => void;
  onDontShowAgain: () => void;
}

export const JoshDualModeModal: React.FC<JoshDualModeModalProps> = ({
  visible,
  onDismiss,
  onDontShowAgain,
}) => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
    >
      <View style={styles.backdrop}>
        <View
          style={[
            styles.card,
            {
              backgroundColor: isDark ? '#1C1E24' : '#FFFFFF',
              borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)',
            },
          ]}
        >
          {/* Header pill & close button */}
          <View style={styles.headerRow}>
            <View style={styles.badge}>
              <Sparkles size={13} color="#6366F1" />
              <Text style={styles.badgeText}>Dual-Mode Smart Printer</Text>
            </View>
            <TouchableOpacity
              onPress={onDismiss}
              style={styles.closeBtn}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <X size={18} color={isDark ? '#9CA3AF' : '#6B7280'} />
            </TouchableOpacity>
          </View>

          {/* Title */}
          <Text style={[styles.title, { color: isDark ? '#F3F4F6' : '#111827' }]}>
            Prints Both Labels & Receipts!
          </Text>

          <Text style={[styles.subtitle, { color: isDark ? '#9CA3AF' : '#4B5563' }]}>
            Your connected Josh printer is a 2-in-1 device capable of printing customer bills as well as adhesive product barcode labels.
          </Text>

          {/* Feature Highlights */}
          <View style={styles.featuresContainer}>
            <View
              style={[
                styles.featureItem,
                {
                  backgroundColor: isDark ? 'rgba(99, 102, 241, 0.08)' : '#EEF2FF',
                  borderColor: isDark ? 'rgba(99, 102, 241, 0.2)' : '#C7D2FE',
                },
              ]}
            >
              <View style={[styles.iconCircle, { backgroundColor: '#6366F1' }]}>
                <Receipt size={16} color="#FFFFFF" />
              </View>
              <View style={styles.featureTextWrapper}>
                <Text style={[styles.featureTitle, { color: isDark ? '#E0E7FF' : '#312E81' }]}>
                  Customer Receipts & Bills
                </Text>
                <Text style={[styles.featureDesc, { color: isDark ? '#9CA3AF' : '#4F46E5' }]}>
                  Load continuous thermal receipt roll for fast, clean POS billing.
                </Text>
              </View>
            </View>

            <View
              style={[
                styles.featureItem,
                {
                  backgroundColor: isDark ? 'rgba(16, 185, 129, 0.08)' : '#ECFDF5',
                  borderColor: isDark ? 'rgba(16, 185, 129, 0.2)' : '#A7F3D0',
                },
              ]}
            >
              <View style={[styles.iconCircle, { backgroundColor: '#10B981' }]}>
                <Tag size={16} color="#FFFFFF" />
              </View>
              <View style={styles.featureTextWrapper}>
                <Text style={[styles.featureTitle, { color: isDark ? '#D1FAE5' : '#064E3B' }]}>
                  Barcode & Product Sticker Labels
                </Text>
                <Text style={[styles.featureDesc, { color: isDark ? '#9CA3AF' : '#047857' }]}>
                  Swap paper roll with die-cut sticker labels to print barcodes.
                </Text>
              </View>
            </View>
          </View>

          {/* Tip Banner */}
          <View
            style={[
              styles.tipBox,
              {
                backgroundColor: isDark ? '#262933' : '#F9FAFB',
                borderColor: isDark ? 'rgba(255,255,255,0.08)' : '#E5E7EB',
              },
            ]}
          >
            <Text style={[styles.tipText, { color: isDark ? '#D1D5DB' : '#374151' }]}>
              💡 <Text style={{ fontWeight: '700' }}>Quick Tip:</Text> When switching between receipts and stickers, simply change the paper roll inside your printer.
            </Text>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={styles.dontShowBtn}
              onPress={onDontShowAgain}
              activeOpacity={0.7}
            >
              <Text style={[styles.dontShowText, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
                Don't show again
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.gotItBtn, { backgroundColor: BRAND_COLORS.blue600 }]}
              onPress={onDismiss}
              activeOpacity={0.8}
            >
              <Check size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.gotItText}>Got it</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 20,
    padding: 22,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(99, 102, 241, 0.12)',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 20,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6366F1',
    letterSpacing: 0.3,
  },
  closeBtn: {
    padding: 4,
  },
  title: {
    fontSize: 19,
    fontWeight: '800',
    letterSpacing: -0.3,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 16,
  },
  featuresContainer: {
    gap: 10,
    marginBottom: 14,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    gap: 12,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  featureTextWrapper: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  featureDesc: {
    fontSize: 11.5,
    lineHeight: 16,
  },
  tipBox: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 18,
  },
  tipText: {
    fontSize: 12,
    lineHeight: 17,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  dontShowBtn: {
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  dontShowText: {
    fontSize: 13,
    fontWeight: '600',
  },
  gotItBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    paddingHorizontal: 22,
    borderRadius: 12,
    shadowColor: BRAND_COLORS.blue600,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  gotItText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
