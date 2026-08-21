import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { BRAND_COLORS } from '@/constants/theme';
import { useAppTheme } from '@/hooks/useAppTheme';
import { ScreenBackground } from '@/components/ui/ScreenBackground';

interface ScreenLoadingStateProps {
  /** Primary status shown to the merchant, e.g. "Loading products..." */
  message: string;
  /** Optional secondary line explaining what is happening */
  hint?: string;
  /** Optional screen-specific skeleton below the status card */
  skeleton?: React.ReactNode;
  /** When true, fills the screen with the app background (for first-load gates) */
  fullScreen?: boolean;
}

export function ScreenLoadingState({
  message,
  hint,
  skeleton,
  fullScreen = false,
}: ScreenLoadingStateProps) {
  const theme = useAppTheme();

  const body = (
    <View style={[styles.wrap, fullScreen && styles.fullScreen]}>
      <View style={[styles.statusCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
        <ActivityIndicator size="large" color={BRAND_COLORS.blue600} />
        <Text style={[styles.message, { color: theme.textPrimary }]}>{message}</Text>
        {hint ? <Text style={[styles.hint, { color: theme.textSecondary }]}>{hint}</Text> : null}
      </View>
      {skeleton ? <View style={styles.skeletonWrap}>{skeleton}</View> : null}
    </View>
  );

  if (fullScreen) {
    return <ScreenBackground color={theme.bg}>{body}</ScreenBackground>;
  }

  return body;
}

interface ScreenLoadingGateProps extends ScreenLoadingStateProps {
  isLoading: boolean;
  children: React.ReactNode;
}

/** Blocks the screen with a branded loading state until initial data is ready. */
export function ScreenLoadingGate({ isLoading, children, ...loadingProps }: ScreenLoadingGateProps) {
  if (isLoading) {
    return <ScreenLoadingState {...loadingProps} fullScreen />;
  }
  return <>{children}</>;
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    paddingTop: 8,
  },
  fullScreen: {
    justifyContent: 'flex-start',
    paddingHorizontal: 16,
    paddingTop: 24,
  },
  statusCard: {
    borderRadius: 18,
    borderWidth: 1,
    paddingVertical: 22,
    paddingHorizontal: 18,
    alignItems: 'center',
  },
  message: {
    marginTop: 14,
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
  },
  hint: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 8,
  },
  skeletonWrap: {
    marginTop: 16,
  },
});
