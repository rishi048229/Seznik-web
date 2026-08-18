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

export function CustomAlertModal() {
  const { visible, title, message, type, buttons, options, hideAlert } = useAlertStore();
  const theme = useAppTheme();

  if (!visible) return null;

  const handleButtonPress = (onPress?: () => void) => {
    hideAlert();
    if (onPress) {
      // Small timeout to allow modal animation to complete smoothly
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

  const renderIcon = () => {
    switch (type) {
      case 'destructive':
        return (
          <View style={[styles.iconCircle, { backgroundColor: 'rgba(239, 68, 68, 0.14)' }]}>
            <Trash2 size={26} color="#EF4444" />
          </View>
        );
      case 'error':
        return (
          <View style={[styles.iconCircle, { backgroundColor: 'rgba(239, 68, 68, 0.14)' }]}>
            <AlertTriangle size={26} color="#EF4444" />
          </View>
        );
      case 'success':
        return (
          <View style={[styles.iconCircle, { backgroundColor: 'rgba(16, 185, 129, 0.14)' }]}>
            <CheckCircle2 size={26} color="#10B981" />
          </View>
        );
      case 'warning':
        return (
          <View style={[styles.iconCircle, { backgroundColor: 'rgba(245, 158, 11, 0.14)' }]}>
            <AlertCircle size={26} color="#F59E0B" />
          </View>
        );
      case 'info':
      default:
        return (
          <View style={[styles.iconCircle, { backgroundColor: 'rgba(37, 99, 235, 0.14)' }]}>
            <Info size={26} color={BRAND_COLORS.blue600} />
          </View>
        );
    }
  };

  const isTwoButtons = buttons.length === 2;

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
            <View
              style={[
                styles.dialogCard,
                {
                  backgroundColor: theme.cardBg,
                  borderColor: theme.borderColor,
                },
              ]}
            >
              {/* Contextual Icon Header */}
              {renderIcon()}

              {/* Title & Message */}
              <Text style={[styles.title, { color: theme.textPrimary }]}>{title}</Text>
              {message ? (
                <Text style={[styles.message, { color: theme.textSecondary }]}>{message}</Text>
              ) : null}

              {/* Action Buttons */}
              <View
                style={[
                  styles.buttonContainer,
                  isTwoButtons ? styles.buttonRow : styles.buttonCol,
                ]}
              >
                {buttons.map((btn, index) => {
                  const isCancel = btn.style === 'cancel';
                  const isDestructive = btn.style === 'destructive';

                  let btnBg = BRAND_COLORS.blue600;
                  let textColor = '#FFFFFF';
                  let borderWidth = 0;
                  let borderColor = 'transparent';

                  if (isCancel) {
                    btnBg = theme.isDark ? 'rgba(255, 255, 255, 0.07)' : 'rgba(0, 0, 0, 0.05)';
                    textColor = theme.textPrimary;
                    borderWidth = 1;
                    borderColor = theme.borderColor;
                  } else if (isDestructive) {
                    btnBg = '#EF4444';
                    textColor = '#FFFFFF';
                  }

                  return (
                    <TouchableOpacity
                      key={`${btn.text}-${index}`}
                      onPress={() => handleButtonPress(btn.onPress)}
                      activeOpacity={0.8}
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
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.62)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  dialogCard: {
    width: DIALOG_MAX_WIDTH,
    borderRadius: 24,
    borderWidth: 1,
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 20,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.25,
        shadowRadius: 20,
      },
      android: {
        elevation: 12,
      },
      web: {
        boxShadow: '0 12px 36px rgba(0, 0, 0, 0.28)',
      },
    }),
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.2,
    marginBottom: 8,
  },
  message: {
    fontSize: 13.5,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  buttonContainer: {
    width: '100%',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
  },
  buttonCol: {
    flexDirection: 'column',
    gap: 8,
  },
  btn: {
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  btnText: {
    fontSize: 14.5,
    fontWeight: '700',
  },
});
