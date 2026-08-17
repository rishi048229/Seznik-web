import React from 'react';
import { View, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';

interface GradientBackgroundProps {
  /** Gradient stop colors, top-left -> bottom-right. Typically theme.gradient from useAppTheme(). */
  colors: string[];
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /**
   * Default true: fills all available space via flex:1 — correct for wrapping a whole screen.
   * Set false when using this as an inline card/hero element that should size to its own content
   * (e.g. inside a ScrollView) — with flex:1 left on, it grows to fill the parent's remaining
   * space instead of hugging its children, which is what caused the oversized hero card.
   */
  fill?: boolean;
}

/**
 * Full-bleed diagonal gradient background, built on react-native-svg (already installed —
 * no native rebuild required, unlike expo-linear-gradient). Renders the gradient absolutely
 * behind `children`, which lay out normally on top of it.
 */
export function GradientBackground({ colors, children, style, fill = true }: GradientBackgroundProps) {
  return (
    <View style={[fill && styles.container, style]}>
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
        <Defs>
          <LinearGradient id="appBgGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            {colors.map((color, idx) => (
              <Stop
                key={`${color}-${idx}`}
                offset={`${(idx / Math.max(1, colors.length - 1)) * 100}%`}
                stopColor={color}
              />
            ))}
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#appBgGradient)" />
      </Svg>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
