import React from 'react';
import { View, Text, ActivityIndicator, TouchableOpacity, StyleSheet } from 'react-native';
import { AlertCircle } from 'lucide-react-native';
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

interface ScreenErrorStateProps {
  /** Primary status, e.g. "Couldn't load the dashboard" */
  message: string;
  /** Optional secondary line — usually a plain-language reason (offline, server unreachable). */
  hint?: string;
  onRetry: () => void;
  isRetrying?: boolean;
  fullScreen?: boolean;
}

/**
 * Shown instead of silently falling back to zeroed placeholder data when a first load genuinely
 * fails (no cached data to show at all) — a query that errors out with nothing cached previously
 * had no error UI at all, so the screen just rendered ₹0/empty everywhere with no indication
 * anything had gone wrong, which reads as "the data is broken" rather than "couldn't connect."
 */
export function ScreenErrorState({ message, hint, onRetry, isRetrying = false, fullScreen = false }: ScreenErrorStateProps) {
  const theme = useAppTheme();

  const body = (
    <View style={[styles.wrap, fullScreen && styles.fullScreen]}>
      <View style={[styles.statusCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
        <AlertCircle size={32} color="#EF4444" />
        <Text style={[styles.message, { color: theme.textPrimary }]}>{message}</Text>
        {hint ? <Text style={[styles.hint, { color: theme.textSecondary }]}>{hint}</Text> : null}
        <TouchableOpacity onPress={onRetry} disabled={isRetrying} style={[styles.retryBtn, { opacity: isRetrying ? 0.6 : 1 }]}>
          {isRetrying ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.retryBtnText}>Try Again</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );

  if (fullScreen) {
    return <ScreenBackground color={theme.bg}>{body}</ScreenBackground>;
  }

  return body;
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
  retryBtn: {
    marginTop: 16,
    backgroundColor: BRAND_COLORS.blue600,
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 12,
    minWidth: 120,
    alignItems: 'center',
  },
  retryBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
  },
});
