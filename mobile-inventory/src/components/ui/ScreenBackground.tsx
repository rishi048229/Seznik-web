import React from 'react';
import { View, StyleSheet, ViewStyle, StyleProp } from 'react-native';

interface ScreenBackgroundProps {
  /** Solid theme background color — pass theme.bg from useAppTheme(). */
  color: string;
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

/**
 * Plain solid, theme-aware full-screen background — dark in dark mode, light in light mode.
 * Replaces the old diagonal <GradientBackground> app-wide (the gradient didn't read well);
 * kept as its own component (not just an inline View) so every screen shares one place to
 * change the "what does the screen sit on" treatment again in future.
 */
export function ScreenBackground({ color, children, style }: ScreenBackgroundProps) {
  return <View style={[styles.container, { backgroundColor: color }, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
