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
import { useAlertStore } from '@/store/useAlertStore';
import { useAppTheme } from '@/hooks/useAppTheme';

const { width } = Dimensions.get('window');
/** Native iOS UIAlertController is ~270pt wide. */
const ALERT_WIDTH = Math.min(270, width * 0.78);

const IOS_BLUE = '#007AFF';
const IOS_BLUE_DARK = '#0A84FF';
const IOS_RED = '#FF3B30';
const IOS_RED_DARK = '#FF453A';

export function CustomAlertModal() {
  const { visible, title, message, buttons, options, hideAlert } = useAlertStore();
  const theme = useAppTheme();

  if (!visible) return null;

  const isTwoButtons = buttons.length === 2;
  const actionBlue = theme.isDark ? IOS_BLUE_DARK : IOS_BLUE;
  const actionRed = theme.isDark ? IOS_RED_DARK : IOS_RED;
  const separator = theme.isDark ? 'rgba(84, 84, 88, 0.65)' : 'rgba(60, 60, 67, 0.29)';
  const cardBg = theme.isDark ? '#252526' : '#F2F2F7';

  const handleButtonPress = (onPress?: () => void) => {
    hideAlert();
    if (onPress) {
      setTimeout(() => {
        onPress();
      }, 60);
    }
  };

  const handleBackdropPress = () => {
    if (options?.cancelable !== false) {
      hideAlert();
      options?.onDismiss?.();
    }
  };

  const renderButton = (
    btn: (typeof buttons)[number],
    index: number,
    layout: 'row' | 'stack' | 'single',
  ) => {
    const isCancel = btn.style === 'cancel';
    const isDestructive = btn.style === 'destructive';

    // iOS rule: In a 2-button alert, the primary/preferred action is semibold ('600').
    // If one button is destructive and the other is cancel, the cancel action is semibold.
    let isEmphasized = false;
    if (layout === 'single') {
      isEmphasized = true;
    } else if (layout === 'row') {
      const hasDestructive = buttons.some((b) => b.style === 'destructive');
      if (hasDestructive) {
        isEmphasized = isCancel;
      } else {
        isEmphasized = !isCancel;
      }
    } else if (layout === 'stack') {
      isEmphasized = isCancel;
    }

    return (
      <TouchableOpacity
        key={`${btn.text}-${index}`}
        onPress={() => handleButtonPress(btn.onPress)}
        activeOpacity={0.4}
        style={[
          styles.btn,
          layout === 'row' && styles.btnRow,
          layout === 'stack' && styles.btnStack,
          layout === 'single' && styles.btnSingle,
        ]}
      >
        <Text
          style={[
            styles.btnText,
            {
              color: isDestructive ? actionRed : actionBlue,
              fontWeight: isEmphasized ? '600' : '400',
            },
          ]}
          numberOfLines={1}
        >
          {btn.text}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      hardwareAccelerated
      onRequestClose={handleBackdropPress}
    >
      <TouchableWithoutFeedback onPress={handleBackdropPress}>
        <View style={styles.backdrop}>
          <TouchableWithoutFeedback>
            <View
              style={[
                styles.alertCard,
                {
                  backgroundColor: cardBg,
                  ...Platform.select({
                    ios: {
                      shadowColor: '#000000',
                      shadowOffset: { width: 0, height: 10 },
                      shadowOpacity: theme.isDark ? 0.45 : 0.18,
                      shadowRadius: 24,
                    },
                    android: { elevation: 16 },
                    default: {},
                  }),
                },
              ]}
            >
              <View style={styles.content}>
                <Text style={[styles.title, { color: theme.isDark ? '#FFFFFF' : '#000000' }]}>
                  {title}
                </Text>
                {message ? (
                  <Text
                    style={[
                      styles.message,
                      { color: theme.isDark ? 'rgba(255, 255, 255, 0.82)' : 'rgba(0, 0, 0, 0.82)' },
                    ]}
                  >
                    {message}
                  </Text>
                ) : null}
              </View>

              <View style={[styles.separatorH, { backgroundColor: separator }]} />

              {isTwoButtons ? (
                <View style={styles.buttonRow}>
                  {renderButton(buttons[0], 0, 'row')}
                  <View style={[styles.separatorV, { backgroundColor: separator }]} />
                  {renderButton(buttons[1], 1, 'row')}
                </View>
              ) : buttons.length > 2 ? (
                <View style={styles.buttonStack}>
                  {buttons.map((btn, index) => (
                    <React.Fragment key={`${btn.text}-${index}`}>
                      {index > 0 ? (
                        <View style={[styles.separatorH, { backgroundColor: separator }]} />
                      ) : null}
                      {renderButton(btn, index, 'stack')}
                    </React.Fragment>
                  ))}
                </View>
              ) : (
                renderButton(buttons[0] ?? { text: 'OK' }, 0, 'single')
              )}
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
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  alertCard: {
    width: ALERT_WIDTH,
    borderRadius: 14,
    overflow: 'hidden',
  },
  content: {
    paddingTop: 20,
    paddingBottom: 16,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    textAlign: 'center',
    letterSpacing: -0.4,
    lineHeight: 22,
  },
  message: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: '400',
    textAlign: 'center',
    letterSpacing: -0.2,
    lineHeight: 18,
  },
  separatorH: {
    height: StyleSheet.hairlineWidth,
    width: '100%',
  },
  separatorV: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
  },
  buttonRow: {
    flexDirection: 'row',
    minHeight: 44,
  },
  buttonStack: {
    flexDirection: 'column',
  },
  btn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    paddingHorizontal: 8,
    minHeight: 44,
  },
  btnRow: {
    flex: 1,
  },
  btnStack: {
    width: '100%',
  },
  btnSingle: {
    width: '100%',
  },
  btnText: {
    fontSize: 17,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
});
