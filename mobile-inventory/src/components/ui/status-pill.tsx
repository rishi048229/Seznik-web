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

export function StatusPill() {
  const router = useRouter();
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

  const { connectionState, warningText, initListener } = usePrinterStore();

  const [pulseAnim] = useState(() => new Animated.Value(1));

  // Initialize store listener for connection state changes
  useEffect(() => {
    const unsubscribe = initListener();
    return () => unsubscribe();
  }, [initListener]);

  // Set up pulsing animation for connecting state
  useEffect(() => {
    let animation: Animated.CompositeAnimation | null = null;
    if (connectionState === 'connecting') {
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
  }, [connectionState, pulseAnim]);

  // Determine styles and icons based on connectionState
  const getPillConfig = () => {
    let backgroundColor: string = colors.neutral + '20';
    let textColor: string = colors.textSecondary;
    let icon = <BluetoothOff size={16} color={textColor} />;
    let label = 'Printer Offline';

    switch (connectionState) {
      case 'disconnected':
        backgroundColor = colors.neutral + '20';
        textColor = colors.textSecondary;
        icon = <BluetoothOff size={16} color={textColor} />;
        label = 'Printer Offline';
        break;
      case 'connecting':
        backgroundColor = colors.primary + '20';
        textColor = colors.primary;
        icon = <BluetoothSearching size={16} color={textColor} />;
        label = 'Connecting…';
        break;
      case 'connected':
        backgroundColor = colors.success + '15';
        textColor = colors.success;
        icon = <BluetoothConnected size={16} color={textColor} />;
        label = 'Printer Ready';
        break;
      case 'warning':
        backgroundColor = colors.warning + '15';
        textColor = colors.warning;
        icon = <AlertTriangle size={16} color={textColor} />;
        label = warningText || 'Printer Warning';
        break;
    }

    return { backgroundColor, textColor, icon, label };
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
            opacity: connectionState === 'connecting' ? pulseAnim : 1,
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
