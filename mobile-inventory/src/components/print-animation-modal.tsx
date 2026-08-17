import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Modal, ActivityIndicator, Vibration, Pressable } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withRepeat, withSequence, Easing } from 'react-native-reanimated';
import { Printer, CheckCircle2, XCircle } from 'lucide-react-native';
import { Colors } from '@/constants/theme';
import ReceiptPreview from './receipt-preview';
import { Bill, ShopProfile } from '@/types';

interface PrintAnimationModalProps {
  visible: boolean;
  onClose: () => void;
  onRetry?: () => void;
  printState: 'idle' | 'sending' | 'printing' | 'success' | 'failed';
  printerName: string;
  bill: Partial<Bill> & { items: any[] };
  shopProfile: ShopProfile;
  currency?: string;
}

export default function PrintAnimationModal({
  visible,
  onClose,
  onRetry,
  printState,
  printerName,
  bill,
  shopProfile,
  currency = '₹',
}: PrintAnimationModalProps) {
  const colors = Colors.dark;

  // Reanimated Shared Values
  const receiptTranslateY = useSharedValue(220); // Start hidden inside printer slot
  const printIconScale = useSharedValue(1);
  const successScale = useSharedValue(0);

  // Trigger animations based on print state changes
  useEffect(() => {
    if (visible) {
      if (printState === 'sending' || printState === 'printing') {
        // Reset scale
        successScale.value = 0;
        
        // Slide receipt out
        receiptTranslateY.value = withTiming(-40, {
          duration: 1200,
          easing: Easing.out(Easing.quad),
        });

        // Pulse print icon
        printIconScale.value = withRepeat(
          withSequence(
            withTiming(1.2, { duration: 400 }),
            withTiming(1.0, { duration: 400 })
          ),
          -1,
          true
        );
      } else if (printState === 'success') {
        // Keep receipt out and trigger success checkmark pop
        receiptTranslateY.value = withTiming(-60, { duration: 500 });
        printIconScale.value = withTiming(1, { duration: 300 });
        successScale.value = withSequence(
          withTiming(1.2, { duration: 300 }),
          withTiming(1.0, { duration: 200 })
        );
        
        // Haptic feedback
        try {
          Vibration.vibrate([0, 100, 50, 100]);
        } catch (e) {}

        // Auto close after 2.5s
        const timer = setTimeout(() => {
          onClose();
        }, 2500);
        return () => clearTimeout(timer);
      } else if (printState === 'failed') {
        // Reverse receipt back into the printer slot
        receiptTranslateY.value = withTiming(220, { duration: 800 });
        printIconScale.value = withTiming(1, { duration: 300 });
        
        // Negative haptic vibration
        try {
          Vibration.vibrate(300);
        } catch (e) {}
      }
    } else {
      // Reset values
      receiptTranslateY.value = 220;
      printIconScale.value = 1;
      successScale.value = 0;
    }
  }, [visible, printState]);

  // Animated Styles
  const receiptAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateY: receiptTranslateY.value }],
    };
  });

  const printIconAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: printIconScale.value }],
    };
  });

  const successAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: successScale.value }],
      opacity: successScale.value,
    };
  });

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Printer status information */}
          <Text style={styles.title}>
            {printState === 'sending' && 'Preparing Document...'}
            {printState === 'printing' && 'Printing Invoice...'}
            {printState === 'success' && 'Print Complete!'}
            {printState === 'failed' && 'Printing Failed'}
          </Text>
          <Text style={styles.printerName}>
            Connected to: {printerName || 'PT-210 Receipt Printer'}
          </Text>

          {/* Printer Visual Graphics Frame */}
          <View style={styles.printerFrame}>
            {/* The sliding receipt */}
            <Animated.View style={[styles.receiptWrapper, receiptAnimatedStyle]}>
              <View style={styles.receiptContainer}>
                <ReceiptPreview bill={bill} profile={shopProfile} currency={currency} />
              </View>
            </Animated.View>

            {/* Printer Graphic Mask Body / Slot mouth */}
            <View style={styles.printerBody}>
              <View style={styles.printerSlot} />
              <View style={styles.printerLogoContainer}>
                <Animated.View style={printIconAnimatedStyle}>
                  <Printer size={32} color={colors.primary} />
                </Animated.View>
              </View>
            </View>
          </View>

          {/* Overlay Status Details */}
          <View style={styles.statusFooter}>
            {(printState === 'sending' || printState === 'printing') && (
              <View style={styles.printingProgressRow}>
                <ActivityIndicator color={colors.primary} size="small" />
                <Text style={styles.statusLabel}>Sending thermal stream...</Text>
              </View>
            )}

            {printState === 'success' && (
              <Animated.View style={[styles.successBanner, successAnimatedStyle]}>
                <CheckCircle2 size={36} color={colors.success} />
                <Text style={[styles.statusLabel, { color: colors.success, marginTop: 6 }]}>
                  Receipt fed and cut successfully!
                </Text>
              </Animated.View>
            )}

            {printState === 'failed' && (
              <View style={styles.failedContainer}>
                <XCircle size={36} color={colors.danger} />
                <Text style={[styles.errorLabel, { color: colors.danger }]}>
                  Connection interrupted or hardware issue.
                </Text>
                <View style={styles.actionsRow}>
                  {onRetry && (
                    <Pressable style={[styles.btn, styles.btnPrimary]} onPress={onRetry}>
                      <Text style={styles.btnText}>Retry Print</Text>
                    </Pressable>
                  )}
                  <Pressable style={[styles.btn, styles.btnSecondary]} onPress={onClose}>
                    <Text style={styles.btnText}>Dismiss</Text>
                  </Pressable>
                </View>
              </View>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  container: {
    width: '100%',
    maxWidth: 380,
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 4,
    textAlign: 'center',
  },
  printerName: {
    fontSize: 13,
    color: '#94A3B8',
    marginBottom: 24,
    textAlign: 'center',
  },
  printerFrame: {
    width: 260,
    height: 280,
    overflow: 'hidden',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  receiptWrapper: {
    position: 'absolute',
    bottom: 90, // Positioned right above/in the slot mouth
    width: 200,
    zIndex: 1,
  },
  receiptContainer: {
    // Transform to make it look miniature
    transform: [{ scale: 0.8 }],
    alignSelf: 'center',
  },
  printerBody: {
    width: '100%',
    height: 100,
    backgroundColor: '#334155',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderWidth: 2,
    borderColor: '#475569',
    zIndex: 2, // Sits on top of receipt
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  printerSlot: {
    width: 220,
    height: 8,
    backgroundColor: '#0F172A',
    borderRadius: 4,
    position: 'absolute',
    top: 12,
  },
  printerLogoContainer: {
    marginTop: 20,
  },
  statusFooter: {
    marginTop: 24,
    minHeight: 100,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  printingProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#E2E8F0',
  },
  successBanner: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  failedContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  errorLabel: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  btn: {
    flex: 1,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimary: {
    backgroundColor: '#0EA5E9',
  },
  btnSecondary: {
    backgroundColor: '#475569',
  },
  btnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
