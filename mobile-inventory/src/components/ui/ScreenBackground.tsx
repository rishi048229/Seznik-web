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
 * Solid, theme-aware full-screen background.
 * Screen transitions are intentionally opt-in: POS navigation must reveal the
 * next workspace immediately.
 */
export function ScreenBackground({ color, children, style, animate = false }: ScreenBackgroundProps) {
  const fadeAnim = useRef(new Animated.Value(animate ? 0.0 : 1)).current;

  useEffect(() => {
    if (animate) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }).start();
    }
  }, [animate, fadeAnim]);

  return (
    <View style={[styles.container, { backgroundColor: color }]}>
      {animate ? (
        <Animated.View
          style={[
            styles.container,
            {
              opacity: fadeAnim,
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
