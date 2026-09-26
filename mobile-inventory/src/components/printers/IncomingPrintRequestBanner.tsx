import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, StatusBar, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, usePathname } from 'expo-router';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { Printer, X } from 'lucide-react-native';
import { usePendingPrintJobsForAgent } from '@/hooks/usePrintJobs';
import { printJobsApi } from '@/api/printJobs';
import { useAuthStore } from '@/store/useAuthStore';
import { useAppTheme } from '@/hooks/useAppTheme';
import { BRAND_COLORS } from '@/constants/theme';
import { useQueryClient } from '@tanstack/react-query';
import { debugFa19Log } from '@/utils/debugFa19Log';
import { dispatchRemotePrintLocalNotification } from '@/services/notificationService';

/** Polls slowly in the background for the whole session. A push is the primary delivery path, but
 *  it can silently never arrive — notification permission denied, Android Doze, a killed app on
 *  iOS — and a receipt nobody prints is the one failure this feature cannot have. 20s keeps that
 *  safety net cheap. */
const POLL_MS = 20000;
const BANNER_AUTO_DISMISS_MS = 10000;

/**
 * Always-mounted watcher that surfaces a print request wherever the agent happens to be in the
 * app. Deliberately not a modal: it must never block what they were doing mid-sale.
 */
export function IncomingPrintRequestBanner() {
  const router = useRouter();
  const pathname = usePathname();
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [accepting, setAccepting] = useState(false);

  // Suppressed on the print-job screens themselves — they already show this job in full.
  const onPrintJobScreen = pathname?.startsWith('/print-jobs') ?? false;
  const { jobs } = usePendingPrintJobsForAgent(isAuthenticated && !onPrintJobScreen, POLL_MS);

  const [dismissedIds, setDismissedIds] = useState<string[]>([]);
  const [dismissingId, setDismissingId] = useState<string | null>(null);
  const notifiedJobIdsRef = useRef<Set<string>>(new Set());
  const translateY = useSharedValue(-140);
  const opacity = useSharedValue(0);

  const topJob = useMemo(() => {
    return jobs.find(
      (job) =>
        (job.status === 'delivered' || job.status === 'queued' || job.status === 'accepted' || job.status === 'printer_connect_pending') &&
        !dismissedIds.includes(job.id)
    );
  }, [jobs, dismissedIds]);

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

  useEffect(() => {
    if (!topJob || onPrintJobScreen) return;
    if (notifiedJobIdsRef.current.has(topJob.id)) return;
    notifiedJobIdsRef.current.add(topJob.id);
    const isKot = topJob.jobType === 'kot';
    const title = isKot ? 'New KOT to print' : 'New receipt to print';
    const body = isKot
      ? `${topJob.requestedByName} sent a kitchen ticket — tap to print.`
      : `${topJob.requestedByName} sent invoice ${topJob.sale?.invoiceNumber || ''} — tap to print.`;
    void dispatchRemotePrintLocalNotification({
      printJobId: topJob.id,
      title,
      body: body.trim() || 'Tap to accept and print.',
      jobType: topJob.jobType,
    });
  }, [topJob?.id, onPrintJobScreen, topJob]);

  useEffect(() => {
    if (!topJob || !visible) return;
    const timer = setTimeout(() => {
      setDismissedIds((prev) => (prev.includes(topJob.id) ? prev : [...prev, topJob.id]));
    }, BANNER_AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [topJob?.id, visible, topJob]);

  useEffect(() => {
    for (const job of jobs) {
      if (job.status === 'printing' || job.status === 'completed' || job.status === 'rejected') {
        setDismissedIds((prev) => (prev.includes(job.id) ? prev : [...prev, job.id]));
      }
    }
  }, [jobs]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  if (!topJob) return null;

  const topOffset = Math.max(insets.top, Platform.OS === 'android' ? StatusBar.currentHeight || 0 : 0) + 8;
  const needsAccept = topJob.status === 'delivered' || topJob.status === 'queued';

  // Lets the exit animation finish before the job leaves the list and this view unmounts —
  // dismissing is the most common interaction here, so it shouldn't just blink out.
  const handleDismiss = () => {
    const jobId = topJob.id;
    setDismissingId(jobId);
    setTimeout(() => setDismissedIds((prev) => [...prev, jobId]), 220);
  };

  const handleAccept = async () => {
    if (accepting) return;
    setAccepting(true);
    try {
      if (needsAccept) {
        await printJobsApi.updateStatus(topJob.id, 'accepted');
        queryClient.invalidateQueries({ queryKey: ['printJobs'] });
      }
      // #region agent log
      debugFa19Log({
        hypothesisId: 'C',
        location: 'IncomingPrintRequestBanner.tsx:handleAccept',
        message: 'Banner accept — navigating to print job',
        data: { jobId: topJob.id, needsAccept, priorStatus: topJob.status },
      });
      // #endregion
      setDismissedIds((prev) => [...prev, topJob.id]);
      router.push(`/print-jobs/${topJob.id}` as any);
    } catch {
      setDismissedIds((prev) => [...prev, topJob.id]);
      router.push(`/print-jobs/${topJob.id}` as any);
    } finally {
      setAccepting(false);
    }
  };

  const bannerTitle = topJob.jobType === 'kot' ? 'New KOT to print' : 'New receipt to print';
  const bannerSubtitle =
    topJob.jobType === 'kot'
      ? `${topJob.requestedByName} sent a kitchen ticket`
      : `${topJob.requestedByName} sent invoice ${topJob.sale?.invoiceNumber || '—'}`;

  return (
    <Animated.View style={[styles.wrap, { top: topOffset }, animatedStyle]} pointerEvents="box-none">
      <View style={[styles.banner, { backgroundColor: theme.cardBg, borderColor: BRAND_COLORS.blue600 }]}>
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => router.push(`/print-jobs/${topJob.id}` as any)}
          style={styles.bannerMain}
        >
          <View style={styles.iconCircle}>
            <Printer size={18} color="#FFFFFF" />
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={[styles.title, { color: theme.textPrimary }]}>{bannerTitle}</Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]} numberOfLines={1}>
              {bannerSubtitle}
            </Text>
          </View>
        </TouchableOpacity>
        {needsAccept ? (
          <TouchableOpacity
            onPress={handleAccept}
            disabled={accepting}
            style={styles.acceptBtn}
            hitSlop={8}
          >
            {accepting ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.acceptBtnText}>Accept</Text>
            )}
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity onPress={handleDismiss} hitSlop={12} style={styles.dismissBtn}>
          <X size={16} color={theme.textSecondary} />
        </TouchableOpacity>
      </View>
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
  bannerMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
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
  acceptBtn: {
    backgroundColor: BRAND_COLORS.blue600,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    marginLeft: 8,
    minWidth: 68,
    alignItems: 'center',
  },
  acceptBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 13 },
  dismissBtn: { padding: 6, marginLeft: 4 },
});
