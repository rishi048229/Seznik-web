import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Share,
  TextInput,
  Alert,
  ScrollView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  X,
  QrCode,
  CheckCircle2,
  Share2,
  Edit2,
  Check,
  ShieldCheck,
  Smartphone,
  Printer,
} from 'lucide-react-native';
import QRCodeSVG from 'react-native-qrcode-svg';
import { BRAND_COLORS } from '@/constants/theme';
import { useAppTheme } from '@/hooks/useAppTheme';
import { buildUpiPayString, isValidUpiVpa } from '@/utils/billQrService';
import { useSettings } from '@/hooks/useSettings';

interface Props {
  visible: boolean;
  onClose: () => void;
  amount: number;
  invoiceNumber?: string;
  customerName?: string;
  onPaymentConfirmed?: () => void;
}

export function DynamicUpiPaymentModal({
  visible,
  onClose,
  amount,
  invoiceNumber,
  customerName,
  onPaymentConfirmed,
}: Props) {
  const theme = useAppTheme();
  const isDark = theme.isDark;
  const { settings, updateSettings } = useSettings();

  const [isEditingUpi, setIsEditingUpi] = useState(false);
  const [upiInput, setUpiInput] = useState(settings?.upiId || '');

  const storeName = settings?.businessName || 'Seznik Store';
  const effectiveUpiId = (settings?.upiId || upiInput || '').trim();
  const upiPayString = isValidUpiVpa(effectiveUpiId)
    ? buildUpiPayString(effectiveUpiId, storeName, amount, invoiceNumber)
    : '';

  const handleSaveUpiId = async () => {
    const clean = upiInput.trim();
    if (!clean || !clean.includes('@')) {
      Alert.alert('Invalid UPI ID', 'Please enter a valid UPI ID (e.g. yourname@okhdfcbank or 9876543210@paytm).');
      return;
    }
    try {
      await updateSettings({ upiId: clean });
      setIsEditingUpi(false);
      Alert.alert('UPI ID Saved', `Dynamic QR code will now use "${clean}".`);
    } catch (err: any) {
      setIsEditingUpi(false);
    }
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Payment request for ₹${amount.toFixed(2)} from ${storeName}.\n\nPay via UPI: ${upiPayString}`,
        title: `UPI Payment - ₹${amount.toFixed(2)}`,
      });
    } catch (err) {
      // Ignored
    }
  };

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <SafeAreaView style={styles.modalSafeArea}>
          <View style={[styles.card, { backgroundColor: isDark ? '#0F172A' : '#FFFFFF', borderColor: theme.borderColor }]}>
            {/* Header */}
            <View style={[styles.headerRow, { borderBottomColor: theme.borderColor }]}>
              <View style={styles.headerLeft}>
                <View style={styles.qrBadge}>
                  <QrCode size={18} color="#FFFFFF" />
                </View>
                <View style={{ marginLeft: 10 }}>
                  <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>Scan to Pay via UPI</Text>
                  <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>{storeName}</Text>
                </View>
              </View>
              <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                <X size={22} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
              {/* Dynamic Amount Hero */}
              <View style={styles.amountBox}>
                <Text style={styles.amountLabel}>EXACT BILL AMOUNT</Text>
                <Text style={styles.amountValue}>₹{amount.toFixed(2)}</Text>
                {invoiceNumber ? (
                  <Text style={[styles.invoiceTag, { color: theme.textSecondary }]}>
                    Invoice #{invoiceNumber} {customerName && customerName !== 'Walk-in Customer' ? `• ${customerName}` : ''}
                  </Text>
                ) : null}
              </View>

              {/* High-Contrast Crisp Scannable QR Code */}
              <View style={styles.qrContainerWrapper}>
                <View style={styles.qrWhiteBox}>
                  {upiPayString ? (
                    <QRCodeSVG
                      value={upiPayString}
                      size={210}
                      color="#000000"
                      backgroundColor="#FFFFFF"
                      quietZone={8}
                    />
                  ) : (
                    <Text style={{ color: '#64748B', textAlign: 'center', fontSize: 12, padding: 16 }}>
                      Enter a valid UPI ID to generate the payment QR
                    </Text>
                  )}
                </View>
              </View>

              {/* UPI ID Display & Inline Editor */}
              <View style={[styles.upiInfoCard, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F8FAFC', borderColor: theme.borderColor }]}>
                {isEditingUpi ? (
                  <View style={styles.upiEditRow}>
                    <TextInput
                      style={[styles.upiInput, { color: theme.textPrimary, borderColor: BRAND_COLORS.blue600 }]}
                      value={upiInput}
                      onChangeText={setUpiInput}
                      placeholder="merchant@okhdfcbank"
                      placeholderTextColor="#94A3B8"
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                    <TouchableOpacity onPress={handleSaveUpiId} style={styles.saveUpiBtn}>
                      <Check size={16} color="#FFFFFF" />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.upiDisplayRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.upiIdLabel, { color: theme.textSecondary }]}>Merchant UPI ID</Text>
                      <Text style={[styles.upiIdValue, { color: theme.textPrimary }]} numberOfLines={1}>
                        {settings?.upiId || 'store@upi (Tap edit to set)'}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => {
                        setUpiInput(settings?.upiId || '');
                        setIsEditingUpi(true);
                      }}
                      style={styles.editUpiBtn}
                    >
                      <Edit2 size={14} color={BRAND_COLORS.blue600} />
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              {/* Accepted UPI Apps Badge Banner */}
              <View style={styles.appsBanner}>
                <Smartphone size={14} color="#10B981" style={{ marginRight: 6 }} />
                <Text style={[styles.appsText, { color: theme.textSecondary }]}>
                  Works with Google Pay, PhonePe, Paytm, BHIM & all UPI apps
                </Text>
              </View>
            </ScrollView>

            {/* Action Buttons */}
            <View style={[styles.footerActions, { borderTopColor: theme.borderColor }]}>
              <TouchableOpacity
                onPress={() => {
                  onClose();
                  if (onPaymentConfirmed) onPaymentConfirmed();
                }}
                style={styles.confirmBtn}
                activeOpacity={0.85}
              >
                <CheckCircle2 size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                <Text style={styles.confirmBtnText}>Payment Received (Print Bill)</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={handleShare} style={[styles.shareBtn, { borderColor: theme.borderColor }]}>
                <Share2 size={16} color={theme.textPrimary} style={{ marginRight: 6 }} />
                <Text style={[styles.shareBtnText, { color: theme.textPrimary }]}>Share UPI Link</Text>
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalSafeArea: {
    width: '100%',
    maxWidth: 420,
    alignItems: 'center',
  },
  card: {
    width: '100%',
    borderRadius: 24,
    borderWidth: 1,
    overflow: 'hidden',
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  qrBadge: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: BRAND_COLORS.blue600,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '900',
  },
  headerSubtitle: {
    fontSize: 11,
    marginTop: 1,
  },
  closeBtn: {
    padding: 4,
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingVertical: 14,
    alignItems: 'center',
  },
  amountBox: {
    alignItems: 'center',
    marginBottom: 12,
  },
  amountLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    color: '#94A3B8',
  },
  amountValue: {
    fontSize: 32,
    fontWeight: '900',
    color: BRAND_COLORS.blue600,
    marginVertical: 2,
  },
  invoiceTag: {
    fontSize: 11,
    fontWeight: '600',
  },
  qrContainerWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    marginBottom: 14,
  },
  qrWhiteBox: {
    padding: 6,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
  },
  upiInfoCard: {
    width: '100%',
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 10,
  },
  upiDisplayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  upiIdLabel: {
    fontSize: 10,
    fontWeight: '700',
  },
  upiIdValue: {
    fontSize: 13,
    fontWeight: '800',
    marginTop: 1,
  },
  editUpiBtn: {
    padding: 6,
  },
  upiEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  upiInput: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginRight: 6,
  },
  saveUpiBtn: {
    backgroundColor: BRAND_COLORS.blue600,
    padding: 8,
    borderRadius: 8,
  },
  appsBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  appsText: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  footerActions: {
    padding: 16,
    borderTopWidth: 1,
    gap: 8,
  },
  confirmBtn: {
    backgroundColor: '#10B981',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    elevation: 4,
  },
  confirmBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  shareBtnText: {
    fontSize: 12,
    fontWeight: '800',
  },
});
