import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, ViewStyle, StyleProp, Animated } from 'react-native';

interface ScreenBackgroundProps {
  /** Solid theme background color — pass theme.bg from useAppTheme(). */
  color: string;
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  animate?: boolean;
}

/**
 * Solid, theme-aware full-screen background with ultra-smooth native fade & slide-in entrance transition.
 */
export function ScreenBackground({ color, children, style, animate = true }: ScreenBackgroundProps) {
  const fadeAnim = useRef(new Animated.Value(animate ? 0.0 : 1)).current;
  const slideAnim = useRef(new Animated.Value(animate ? 6 : 0)).current;

  useEffect(() => {
    if (animate) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [animate, fadeAnim, slideAnim]);

  return (
    <View style={[styles.container, { backgroundColor: color }]}>
      {animate ? (
        <Animated.View
          style={[
            styles.container,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
            style,
          ]}
        >
          {children}
        </Animated.View>
      ) : (
        <View style={[styles.container, style]}>{children}</View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
