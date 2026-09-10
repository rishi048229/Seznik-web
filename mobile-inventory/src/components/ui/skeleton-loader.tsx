import React, { useEffect, useRef } from 'react';
import { Animated, View, StyleSheet, ViewStyle, Dimensions, Easing } from 'react-native';
import { useColorScheme } from 'react-native';
import { Colors } from '@/constants/theme';

interface SkeletonLoaderProps {
  width?: ViewStyle['width'];
  height?: ViewStyle['height'];
  borderRadius?: ViewStyle['borderRadius'];
  style?: ViewStyle;
}

const { width: screenWidth } = Dimensions.get('window');

export function SkeletonLoader({
  width = '100%',
  height = 20,
  borderRadius = 4,
  style,
}: SkeletonLoaderProps) {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.timing(shimmerAnim, {
        toValue: 1,
        duration: 1250,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      })
    );
    animation.start();
    return () => animation.stop();
  }, [shimmerAnim]);

  const shimmerTranslate = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-screenWidth - 60, screenWidth + 60],
  });

  return (
    <Animated.View
      style={[
        styles.skeleton,
        {
          width,
          height,
          borderRadius,
          backgroundColor: colors.backgroundSelected,
        },
        style,
      ]}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          styles.shimmerBand,
          {
            backgroundColor: scheme === 'dark' ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.68)',
            transform: [{ translateX: shimmerTranslate }, { rotate: '18deg' }],
          },
        ]}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  skeleton: {
    overflow: 'hidden',
  },
  shimmerBand: {
    position: 'absolute',
    top: -24,
    bottom: -24,
    width: 42,
  },
});
