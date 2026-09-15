import React, { useEffect, useState } from 'react';
import {
  Pressable,
  Text,
  StyleSheet,
  Animated,
  useColorScheme,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  BluetoothConnected,
  BluetoothSearching,
  BluetoothOff,
  AlertTriangle,
} from 'lucide-react-native';
import { Colors } from '@/constants/theme';
import { usePrinterStore } from '@/store/usePrinterStore';
import { useShallow } from 'zustand/react/shallow';
export function StatusPill() {
  const router = useRouter();
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

  // The store subscription lives in the root layout, not here — printer drops have to be noticed
  // whether or not this pill happens to be mounted.
  const {
    connectionState,
    warningText,
    isAutoReconnecting,
  } = usePrinterStore(
    useShallow((s) => ({
    connectionState: s.connectionState,
    warningText: s.warningText,
    isAutoReconnecting: s.isAutoReconnecting,
    }))
  );

  const [pulseAnim] = useState(() => new Animated.Value(1));

  // Set up pulsing animation for connecting state
  useEffect(() => {
    let animation: Animated.CompositeAnimation | null = null;
    if (connectionState === 'connecting' || isAutoReconnecting) {
      animation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 0.4,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      );
      animation.start();
    } else {
      pulseAnim.setValue(1);
    }
    return () => {
      if (animation) animation.stop();
    };
  }, [connectionState, isAutoReconnecting, pulseAnim]);

  // Determine styles and icons based on connectionState
  const getPillConfig = () => {
    if (connectionState === 'connected') {
      const textColor: string = colors.success;
      return {
        backgroundColor: colors.success + '15',
        textColor,
        icon: <BluetoothConnected size={16} color={textColor} />,
        label: 'Printer Ready',
      };
    }

    if (connectionState === 'connecting' || isAutoReconnecting) {
      const textColor: string = colors.primary;
      return {
        backgroundColor: colors.primary + '20',
        textColor,
        icon: <BluetoothSearching size={16} color={textColor} />,
        label: isAutoReconnecting ? 'Reconnecting…' : 'Connecting…',
      };
    }

    // Disconnected with a reason to show. PrinterService never emits a 'warning' state — the warning
    // rides alongside the state as text — so this has to be derived rather than switched on.
    if (warningText) {
      const textColor: string = colors.warning;
      return {
        backgroundColor: colors.warning + '15',
        textColor,
        icon: <AlertTriangle size={16} color={textColor} />,
        label: warningText,
      };
    }

    const textColor: string = colors.textSecondary;
    return {
      backgroundColor: colors.neutral + '20',
      textColor,
      icon: <BluetoothOff size={16} color={textColor} />,
      label: 'Printer Offline',
    };
  };

  const config = getPillConfig();

  const handlePress = () => {
    router.push('/settings');
  };

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [
        styles.pressedContainer,
        pressed && styles.pressedScale,
      ]}>
      <Animated.View
        style={[
          styles.container,
          {
            backgroundColor: config.backgroundColor,
            opacity: connectionState === 'connecting' || isAutoReconnecting ? pulseAnim : 1,
          },
        ]}>
        {config.icon}
        <Text style={[styles.text, { color: config.textColor }]}>
          {config.label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressedContainer: {
    alignSelf: 'flex-start',
  },
  pressedScale: {
    transform: [{ scale: 0.96 }],
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
    borderWidth: 0.5,
    borderColor: 'transparent',
  },
  text: {
    fontSize: 12,
    fontWeight: '600',
  },
});
