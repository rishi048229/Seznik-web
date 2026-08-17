import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import type { AppTheme } from '@/hooks/useAppTheme';

export interface FeatureGridTileProps {
  label: string;
  /** Small corner badge, e.g. "NEW" — omit for no badge. */
  badge?: string;
  icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  /** Tint color for the icon */
  color: string;
  onPress: () => void;
  theme: Pick<AppTheme, 'cardBg' | 'borderColor' | 'textPrimary' | 'textSecondary'>;
}

/**
 * Frameless Quick App Launcher Item:
 * Borderless, tile-free icon layout matching modern mobile app launchers.
 * Pure icon + clean typography with smooth spring press animation.
 */
export function FeatureGridTile({ label, badge, icon: Icon, color, onPress, theme }: FeatureGridTileProps) {
  const [isPressed, setIsPressed] = useState(false);
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    setIsPressed(true);
    // eslint-disable-next-line react-hooks/immutability
    scale.value = withSpring(0.88, { damping: 12, stiffness: 240 });
  };

  const handlePressOut = () => {
    setIsPressed(false);
    // eslint-disable-next-line react-hooks/immutability
    scale.value = withSpring(1, { damping: 10, stiffness: 200 });
  };

  return (
    <Animated.View style={[styles.itemContainer, animatedStyle]}>
      <TouchableOpacity
        activeOpacity={0.7}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={onPress}
        style={styles.touchArea}
      >
        <View style={styles.iconWrapper}>
          {badge ? (
            <View style={[styles.badge, { backgroundColor: color }]}>
              <Text style={styles.badgeText}>{badge}</Text>
            </View>
          ) : null}
          <Icon size={28} color={color} strokeWidth={1.9} />
        </View>

        <Text style={[styles.label, { color: theme.textPrimary }]} numberOfLines={1}>
          {label}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  itemContainer: {
    width: '25%',
    alignItems: 'center',
    marginBottom: 16,
  },
  touchArea: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    paddingHorizontal: 2,
    width: '100%',
  },
  iconWrapper: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
    position: 'relative',
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 14,
    paddingHorizontal: 2,
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -4,
    borderRadius: 6,
    paddingHorizontal: 4,
    paddingVertical: 1.5,
    zIndex: 2,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
});
