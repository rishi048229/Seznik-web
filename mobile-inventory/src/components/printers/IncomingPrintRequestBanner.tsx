import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, usePathname } from 'expo-router';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { Printer, X } from 'lucide-react-native';
import { usePendingPrintJobsForAgent } from '@/hooks/usePrintJobs';
import { useAuthStore } from '@/store/useAuthStore';
import { useAppTheme } from '@/hooks/useAppTheme';
import { BRAND_COLORS } from '@/constants/theme';

/** Polls slowly in the background for the whole session. A push is the primary delivery path, but
 *  it can silently never arrive — notification permission denied, Android Doze, a killed app on
 *  iOS — and a receipt nobody prints is the one failure this feature cannot have. 20s keeps that
 *  safety net cheap. */
const POLL_MS = 20000;

/**
 * Always-mounted watcher that surfaces a print request wherever the agent happens to be in the
 * app. Deliberately not a modal: it must never block what they were doing mid-sale.
 */
export function IncomingPrintRequestBanner() {
  const router = useRouter();
  const pathname = usePathname();
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const currentActorId = useAuthStore((s) => s.user?.id);

  // Suppressed on the print-job screens themselves — they already show this job in full.
  const onPrintJobScreen = pathname?.startsWith('/print-jobs') ?? false;
  const { jobs } = usePendingPrintJobsForAgent(isAuthenticated && !onPrintJobScreen, POLL_MS);

  const [dismissedIds, setDismissedIds] = useState<string[]>([]);
  const [dismissingId, setDismissingId] = useState<string | null>(null);
  const translateY = useSharedValue(-140);
  const opacity = useSharedValue(0);

  const topJob = useMemo(() => {
    return jobs.find(
      (job) =>
        job.status === 'delivered' &&
        !dismissedIds.includes(job.id) &&
        (job.targetAgentId === currentActorId || (!!job.targetLocationId && !job.acceptedByAgentId))
    );
  }, [jobs, dismissedIds, currentActorId]);

  // The effect below is the only place that drives the animation, so dismissing flips this flag
  // and lets the same exit animation play rather than mutating the shared values from a handler.
  const visible = !!topJob && !onPrintJobScreen && dismissingId !== topJob?.id;
  const wasVisible = useRef(false);

  useEffect(() => {
    if (visible === wasVisible.current) return;
    wasVisible.current = visible;
    if (visible) {
      translateY.value = withSpring(0, { damping: 16, stiffness: 160 });
      opacity.value = withTiming(1, { duration: 220 });
    } else {
      translateY.value = withTiming(-140, { duration: 200 });
      opacity.value = withTiming(0, { duration: 160 });
    }
  }, [visible, translateY, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  if (!topJob) return null;

  const topOffset = Math.max(insets.top, Platform.OS === 'android' ? StatusBar.currentHeight || 0 : 0) + 8;

  // Lets the exit animation finish before the job leaves the list and this view unmounts —
  // dismissing is the most common interaction here, so it shouldn't just blink out.
  const handleDismiss = () => {
    const jobId = topJob.id;
    setDismissingId(jobId);
    setTimeout(() => setDismissedIds((prev) => [...prev, jobId]), 220);
  };

  return (
    <Animated.View style={[styles.wrap, { top: topOffset }, animatedStyle]} pointerEvents="box-none">
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => router.push(`/print-jobs/${topJob.id}` as any)}
        style={[styles.banner, { backgroundColor: theme.cardBg, borderColor: BRAND_COLORS.blue600 }]}
      >
        <View style={styles.iconCircle}>
          <Printer size={18} color="#FFFFFF" />
        </View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={[styles.title, { color: theme.textPrimary }]}>New receipt to print</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]} numberOfLines={1}>
            {topJob.requestedByName} sent invoice {topJob.sale.invoiceNumber} · Tap to accept
          </Text>
        </View>
        <TouchableOpacity onPress={handleDismiss} hitSlop={12} style={styles.dismissBtn}>
          <X size={16} color={theme.textSecondary} />
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 12, right: 12, zIndex: 999, elevation: 12 },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: BRAND_COLORS.blue600,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 14, fontWeight: '800' },
  subtitle: { fontSize: 12, marginTop: 2 },
  dismissBtn: { padding: 4, marginLeft: 6 },
});
