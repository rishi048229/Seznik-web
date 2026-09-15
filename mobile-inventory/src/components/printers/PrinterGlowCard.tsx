import React, { useEffect, useRef } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { Sparkles } from 'lucide-react-native';
import Animated, {
  Easing,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

interface PrinterGlowCardProps {
  /** Connected — slow ambient pulse, the "this one is live" signal. */
  active: boolean;
  /** Selected but not yet connected — steady glow, no pulse. */
  highlighted?: boolean;
  glowColor?: string;
  borderRadius?: number;
  style?: ViewStyle;
  children: React.ReactNode;
}

/** Fixed layout for the burst so every particle's own useAnimatedStyle can stay a plain
 *  hook call (no loops/conditionals around hooks) while still reading one shared driver. */
const SPARKLE_LAYOUT: { top: string; left: string; size: number }[] = [
  { top: '4%', left: '12%', size: 13 },
  { top: '8%', left: '82%', size: 16 },
  { top: '48%', left: '-3%', size: 12 },
  { top: '52%', left: '98%', size: 14 },
  { top: '88%', left: '20%', size: 12 },
  { top: '92%', left: '75%', size: 15 },
];

function SparkleParticle({
  index,
  progress,
  color,
}: {
  index: number;
  progress: SharedValue<number>;
  color: string;
}) {
  const spot = SPARKLE_LAYOUT[index];
  // Staggered phase per particle so the burst reads as scattering outward, not one flat pop.
  const delay = index * 0.06;

  const style = useAnimatedStyle(() => {
    const local = interpolate(progress.value, [delay, delay + 0.35, delay + 0.8], [0, 1, 0], 'clamp');
    const scale = interpolate(progress.value, [delay, delay + 0.35, delay + 0.8], [0.2, 1.15, 0.7], 'clamp');
    const drift = interpolate(progress.value, [delay, delay + 0.8], [0, index % 2 === 0 ? -6 : 6], 'clamp');
    return {
      opacity: local,
      transform: [{ scale }, { translateY: drift }],
    };
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[{ position: 'absolute', top: spot.top as any, left: spot.left as any }, style]}
    >
      <Sparkles size={spot.size} color={color} fill={color} />
    </Animated.View>
  );
}

/**
 * Ambient glow halo for printer cards, shared across SeznikPrinterGrid / JoshPrinterCard /
 * YxPrinterCard so "connected" reads the same way everywhere in the app.
 *
 * Built as a plain animated View with a colored border + animated opacity, not native
 * shadowColor/shadowOpacity — Android's shadow model is driven by `elevation`, which has no
 * color and can't be smoothly animated the way iOS's shadow properties can, so a
 * shadow-based glow would pulse on iOS and sit static (or not render at all) on Android.
 * An opacity/color animation on a normal View behaves identically on both.
 */
export function PrinterGlowCard({
  active,
  highlighted = false,
  glowColor = '#10B981',
  borderRadius = 16,
  style,
  children,
}: PrinterGlowCardProps) {
  const glowOpacity = useSharedValue(highlighted ? 0.5 : 0);
  const sparkleProgress = useSharedValue(0);
  // Tracks the previous `active` so the burst fires only on the actual disconnected→connected
  // edge — not on every render while already connected, and not on first mount if a printer
  // happens to already be connected when this card appears (that would read as a bug, not a
  // celebration). undefined on the very first render means "don't know yet, don't fire".
  const wasActive = useRef<boolean | undefined>(undefined);

  useEffect(() => {
    cancelAnimation(glowOpacity);
    if (active) {
      // Slow breathing pulse — a live signal, not an alert, so it stays gentle.
      glowOpacity.value = withRepeat(
        withSequence(
          withTiming(0.85, { duration: 1400, easing: Easing.inOut(Easing.sin) }),
          withTiming(0.28, { duration: 1400, easing: Easing.inOut(Easing.sin) })
        ),
        -1,
        true
      );
    } else {
      glowOpacity.value = withTiming(highlighted ? 0.5 : 0, { duration: 220 });
    }

    if (active && wasActive.current === false) {
      sparkleProgress.value = 0;
      sparkleProgress.value = withTiming(1, { duration: 900, easing: Easing.out(Easing.cubic) });
    }
    wasActive.current = active;

    return () => cancelAnimation(glowOpacity);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, highlighted]);

  const glowStyle = useAnimatedStyle(() => ({ opacity: glowOpacity.value }));

  return (
    <View style={[{ borderRadius }, style]}>
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          glowStyle,
          {
            borderRadius: borderRadius + 5,
            margin: -5,
            borderWidth: 5,
            borderColor: glowColor,
            shadowColor: glowColor,
            shadowOpacity: 0.7,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: 0 },
          },
        ]}
      />
      {children}
      {/* One-shot burst on the moment a printer connects — SPARKLE_LAYOUT.length particles,
          each reading the same progress value at a staggered phase so they scatter outward
          together rather than blinking on as one flat flash. */}
      {SPARKLE_LAYOUT.map((_, i) => (
        <SparkleParticle key={i} index={i} progress={sparkleProgress} color={glowColor} />
      ))}
    </View>
  );
}
