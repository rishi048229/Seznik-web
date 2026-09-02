import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Platform,
  TouchableWithoutFeedback,
} from 'react-native';
import {
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Info,
  Trash2,
} from 'lucide-react-native';
import { useAlertStore, AlertType } from '@/store/useAlertStore';
import { useAppTheme } from '@/hooks/useAppTheme';
import { BRAND_COLORS } from '@/constants/theme';

const { width } = Dimensions.get('window');
const DIALOG_MAX_WIDTH = Math.min(width * 0.86, 360);

type AlertPalette = {
  accent: string;
  glow: string;
  ring: string;
};

const ALERT_PALETTES: Record<AlertType, AlertPalette> = {
  success: {
    accent: BRAND_COLORS.emerald500,
    glow: 'rgba(16, 185, 129, 0.18)',
    ring: 'rgba(16, 185, 129, 0.08)',
  },
  error: {
    accent: BRAND_COLORS.rose500,
    glow: 'rgba(244, 63, 94, 0.18)',
    ring: 'rgba(244, 63, 94, 0.08)',
  },
  warning: {
    accent: BRAND_COLORS.amber500,
    glow: 'rgba(245, 158, 11, 0.18)',
    ring: 'rgba(245, 158, 11, 0.08)',
  },
  destructive: {
    accent: '#EF4444',
    glow: 'rgba(239, 68, 68, 0.18)',
    ring: 'rgba(239, 68, 68, 0.08)',
  },
  info: {
    accent: BRAND_COLORS.blue600,
    glow: 'rgba(37, 99, 235, 0.18)',
    ring: 'rgba(37, 99, 235, 0.08)',
  },
};

function renderAlertIcon(type: AlertType) {
  const iconProps = { size: 30, color: '#FFFFFF', strokeWidth: 2.4 };

  switch (type) {
    case 'destructive':
      return <Trash2 {...iconProps} />;
    case 'error':
      return <AlertTriangle {...iconProps} />;
    case 'success':
      return <CheckCircle2 {...iconProps} />;
    case 'warning':
      return <AlertCircle {...iconProps} />;
    case 'info':
    default:
      return <Info {...iconProps} />;
  }
}

export function CustomAlertModal() {
  const { visible, title, message, type, buttons, options, hideAlert } = useAlertStore();
  const theme = useAppTheme();

  if (!visible) return null;

  const palette = ALERT_PALETTES[type];
  const isTwoButtons = buttons.length === 2;

  const handleButtonPress = (onPress?: () => void) => {
    hideAlert();
    if (onPress) {
      setTimeout(() => {
        onPress();
      }, 50);
    }
  };

  const handleBackdropPress = () => {
    if (options?.cancelable !== false) {
      hideAlert();
      options?.onDismiss?.();
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={handleBackdropPress}
    >
      <TouchableWithoutFeedback onPress={handleBackdropPress}>
        <View style={styles.backdrop}>
          <TouchableWithoutFeedback>
            <View style={styles.dialogWrapper}>
              {/* Floating icon badge */}
              <View style={styles.iconAnchor} pointerEvents="none">
                <View style={[styles.glowRing, styles.glowRingOuter, { backgroundColor: palette.ring }]} />
                <View style={[styles.glowRing, styles.glowRingInner, { backgroundColor: palette.glow }]} />
                <View style={[styles.iconBadge, { backgroundColor: palette.accent }]}>
                  {renderAlertIcon(type)}
                </View>
                <View style={[styles.sparkle, styles.sparkleTopLeft, { backgroundColor: palette.accent }]} />
                <View style={[styles.sparkle, styles.sparkleTopRight, { backgroundColor: palette.accent }]} />
                <View style={[styles.sparkle, styles.sparkleBottomRight, { backgroundColor: palette.accent }]} />
              </View>

              <View
                style={[
                  styles.dialogCardOuter,
                  { backgroundColor: palette.accent },
                ]}
              >
                <View
                  style={[
                    styles.dialogCard,
                    {
                      backgroundColor: theme.cardBg,
                      borderColor: theme.borderColor,
                    },
                  ]}
                >
                  <Text style={[styles.title, { color: theme.textPrimary }]}>{title}</Text>
                  {message ? (
                    <Text style={[styles.message, { color: theme.textSecondary }]}>{message}</Text>
                  ) : null}

                  <View
                    style={[
                      styles.buttonContainer,
                      isTwoButtons ? styles.buttonRow : styles.buttonCol,
                    ]}
                  >
                    {buttons.map((btn, index) => {
                      const isCancel = btn.style === 'cancel';
                      const isDestructive = btn.style === 'destructive';

                      let btnBg = palette.accent;
                      let textColor = '#FFFFFF';
                      let borderWidth = 0;
                      let borderColor = 'transparent';

                      if (isCancel) {
                        btnBg = theme.isDark ? 'rgba(255, 255, 255, 0.08)' : BRAND_COLORS.slate100;
                        textColor = theme.textSecondary;
                      } else if (isDestructive) {
                        btnBg = '#EF4444';
                        textColor = '#FFFFFF';
                      }

                      return (
                        <TouchableOpacity
                          key={`${btn.text}-${index}`}
                          onPress={() => handleButtonPress(btn.onPress)}
                          activeOpacity={0.82}
                          style={[
                            styles.btn,
                            isTwoButtons && { flex: 1 },
                            {
                              backgroundColor: btnBg,
                              borderWidth,
                              borderColor,
                            },
                          ]}
                        >
                          <Text style={[styles.btnText, { color: textColor }]}>{btn.text}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  dialogWrapper: {
    width: DIALOG_MAX_WIDTH,
    alignItems: 'center',
    paddingTop: 36,
  },
  iconAnchor: {
    position: 'absolute',
    top: 0,
    alignSelf: 'center',
    width: 96,
    height: 96,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  glowRing: {
    position: 'absolute',
    borderRadius: 999,
  },
  glowRingOuter: {
    width: 96,
    height: 96,
  },
  glowRingInner: {
    width: 76,
    height: 76,
  },
  iconBadge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.18,
        shadowRadius: 10,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  sparkle: {
    position: 'absolute',
    borderRadius: 999,
    opacity: 0.35,
  },
  sparkleTopLeft: {
    width: 7,
    height: 7,
    top: 10,
    left: 8,
  },
  sparkleTopRight: {
    width: 5,
    height: 5,
    top: 18,
    right: 10,
  },
  sparkleBottomRight: {
    width: 6,
    height: 6,
    bottom: 14,
    right: 6,
  },
  dialogCardOuter: {
    width: '100%',
    borderRadius: 28,
    overflow: 'hidden',
    paddingBottom: 4,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.2,
        shadowRadius: 24,
      },
      android: {
        elevation: 14,
      },
      web: {
        boxShadow: '0 16px 40px rgba(0, 0, 0, 0.22)',
      },
    }),
  },
  dialogCard: {
    width: '100%',
    borderRadius: 28,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingHorizontal: 24,
    paddingTop: 44,
    paddingBottom: 0,
    alignItems: 'center',
  },
  title: {
    fontSize: 19,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.3,
    marginBottom: 8,
    lineHeight: 26,
  },
  message: {
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    marginBottom: 22,
    paddingHorizontal: 2,
  },
  buttonContainer: {
    width: '100%',
    marginBottom: 20,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
  },
  buttonCol: {
    flexDirection: 'column',
    gap: 10,
  },
  btn: {
    height: 48,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  btnText: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.1,
  },
});
