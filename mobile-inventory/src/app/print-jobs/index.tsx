import React, { useState } from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet, StatusBar, Platform, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronLeft, Send, Inbox, Clock, CheckCircle2, XCircle, AlertTriangle, X, ChevronRight } from 'lucide-react-native';
import { usePrintJobsAdmin } from '@/hooks/usePrintJobs';
import { PrintJob } from '@/types/printJob';
import { useAppTheme } from '@/hooks/useAppTheme';
import { ScreenBackground } from '@/components/ui/ScreenBackground';
import { ScreenLoadingState, ScreenErrorState } from '@/components/ui/ScreenLoadingState';
import { RemotePrintTargetPicker } from '@/components/printers/RemotePrintTargetPicker';
import { BRAND_COLORS } from '@/constants/theme';
import { useAuthStore } from '@/store/useAuthStore';
import { sanitizeErrorMessage } from '@/utils/errorHandler';

const STATUS_META: Record<string, { label: string; color: string; icon: any }> = {
  queued: { label: 'Sending', color: '#F59E0B', icon: Clock },
  delivered: { label: 'Waiting', color: '#2563EB', icon: Clock },
  accepted: { label: 'Accepted', color: '#16A34A', icon: CheckCircle2 },
  printer_connect_pending: { label: 'Connecting', color: '#F59E0B', icon: Clock },
  printing: { label: 'Printing', color: '#2563EB', icon: Clock },
  completed: { label: 'Printed', color: '#16A34A', icon: CheckCircle2 },
  failed: { label: 'Failed', color: '#DC2626', icon: AlertTriangle },
  rejected: { label: 'Declined', color: '#6B7280', icon: XCircle },
  expired: { label: 'No response', color: '#6B7280', icon: XCircle },
  cancelled: { label: 'Cancelled', color: '#6B7280', icon: XCircle },
};

const RETRYABLE = ['expired', 'rejected', 'failed'];

export default function PrintJobsInboxScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const topPadding = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0, 14);
  const currentActorId = useAuthStore((s) => s.user?.id);
  const canSend = useAuthStore((s) => s.hasPermission('canSendRemotePrint'));

  const [tab, setTab] = useState<'incoming' | 'sent'>('incoming');
  const [reassignTarget, setReassignTarget] = useState<PrintJob | null>(null);

  const incoming = usePrintJobsAdmin({ targetAgentId: currentActorId });
  const sent = usePrintJobsAdmin();

  const source = tab === 'incoming' ? incoming : sent;
  const { isLoading, isError, refetch, isRefetching } = source;
  const jobs = tab === 'sent' ? sent.jobs.filter((job) => job.requestedById === currentActorId) : incoming.jobs;

  const handleCancel = (job: PrintJob) => {
    Alert.alert('Cancel this request?', `Invoice ${job.sale.invoiceNumber} will no longer be printed.`, [
      { text: 'Keep it', style: 'cancel' },
      {
        text: 'Cancel Request',
        style: 'destructive',
        onPress: async () => {
          try {
            await sent.cancelJob(job.id);
          } catch (err: any) {
            Alert.alert('Could not cancel', sanitizeErrorMessage(err));
          }
        },
      },
    ]);
  };

  const handleReassign = async (agentId: string) => {
    if (!reassignTarget) return;
    try {
      const newJob = await sent.reassignJob({ id: reassignTarget.id, targetAgentId: agentId });
      setReassignTarget(null);
      router.push(`/print-jobs/${newJob.id}` as any);
    } catch (err: any) {
      setReassignTarget(null);
      Alert.alert('Could not resend', sanitizeErrorMessage(err));
    }
  };

  const renderItem = ({ item }: { item: PrintJob }) => {
    const meta = STATUS_META[item.status] || STATUS_META.queued;
    const StatusIcon = meta.icon;
    const needsMyAction = tab === 'incoming' && item.status === 'delivered';
    const canCancel = tab === 'sent' && !['completed', 'printing', 'cancelled'].includes(item.status);
    const canReassign = tab === 'sent' && RETRYABLE.includes(item.status);

    return (
      <TouchableOpacity
        style={[
          styles.card,
          { backgroundColor: theme.cardBg, borderColor: needsMyAction ? BRAND_COLORS.blue600 : theme.borderColor },
          needsMyAction && styles.cardHighlighted,
        ]}
        onPress={() => router.push(`/print-jobs/${item.id}` as any)}
        activeOpacity={0.8}
      >
        <View style={styles.cardTop}>
          <View style={{ flex: 1, marginRight: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <Text style={[styles.invoiceText, { color: theme.textPrimary }]}>{item.sale.invoiceNumber}</Text>
              <View style={[styles.statusPill, { backgroundColor: meta.color + '18' }]}>
                <StatusIcon size={11} color={meta.color} />
                <Text style={[styles.statusPillText, { color: meta.color }]}>{meta.label}</Text>
              </View>
            </View>
            <Text style={[styles.subText, { color: theme.textSecondary }]}>
              {tab === 'incoming'
                ? `From ${item.requestedByName}`
                : `To ${item.acceptedByAgentName || item.targetAgentName || item.targetLocationName || 'Team'}`}
              {' · '}
              {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={[styles.amountText, { color: theme.textPrimary }]}>₹{item.sale.grandTotal.toFixed(2)}</Text>
            <ChevronRight size={15} color={theme.textSecondary} style={{ marginTop: 4 }} />
          </View>
        </View>

        {needsMyAction && (
          <View style={styles.actionHint}>
            <Text style={styles.actionHintText}>Tap to accept and print</Text>
          </View>
        )}

        {(canCancel || canReassign) && (
          <View style={[styles.cardActions, { borderTopColor: theme.borderColor }]}>
            {canReassign && (
              <TouchableOpacity onPress={() => setReassignTarget(item)} style={styles.resendChip} hitSlop={6}>
                <Send size={12} color={BRAND_COLORS.blue600} />
                <Text style={styles.resendChipText}>Send to someone else</Text>
              </TouchableOpacity>
            )}
            {canCancel && (
              <TouchableOpacity onPress={() => handleCancel(item)} style={styles.cancelChip} hitSlop={6}>
                <X size={12} color="#DC2626" />
                <Text style={styles.cancelChipText}>Cancel</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <ScreenBackground color={theme.bg}>
      <View style={{ flex: 1, paddingTop: topPadding }}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={10}>
            <ChevronLeft size={24} color={theme.textPrimary} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>Remote Print Requests</Text>
          <View style={{ width: 24 }} />
        </View>

        <Text style={[styles.explainer, { color: theme.textSecondary }]}>
          Send a receipt to a teammate&apos;s phone and it prints on their printer, wherever they are.
        </Text>

        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[styles.tabBtn, tab === 'incoming' && styles.tabBtnActive]}
            onPress={() => setTab('incoming')}
          >
            <Inbox size={15} color={tab === 'incoming' ? '#FFFFFF' : theme.textSecondary} />
            <Text style={[styles.tabBtnText, { color: tab === 'incoming' ? '#FFFFFF' : theme.textSecondary }]}>
              Sent to Me
            </Text>
          </TouchableOpacity>
          {canSend && (
            <TouchableOpacity style={[styles.tabBtn, tab === 'sent' && styles.tabBtnActive]} onPress={() => setTab('sent')}>
              <Send size={15} color={tab === 'sent' ? '#FFFFFF' : theme.textSecondary} />
              <Text style={[styles.tabBtnText, { color: tab === 'sent' ? '#FFFFFF' : theme.textSecondary }]}>
                Sent by Me
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {isLoading ? (
          <ScreenLoadingState message="Loading print requests…" />
        ) : isError ? (
          <ScreenErrorState message="Couldn't load print requests" onRetry={refetch} />
        ) : jobs.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Inbox size={40} color={theme.textSecondary} />
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
              {tab === 'incoming'
                ? 'Nothing here yet. When a teammate sends you a receipt to print, it will appear here and your phone will buzz.'
                : "You haven't sent any receipts to print remotely yet. Open any sale and tap Remote to send one."}
            </Text>
          </View>
        ) : (
          <FlatList
            data={jobs}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={{ padding: 16, gap: 10 }}
            refreshing={isRefetching}
            onRefresh={refetch}
          />
        )}
      </View>

      <RemotePrintTargetPicker
        visible={!!reassignTarget}
        onClose={() => setReassignTarget(null)}
        title="Send to Someone Else"
        subtitle={
          reassignTarget ? `Invoice ${reassignTarget.sale.invoiceNumber} · ₹${reassignTarget.sale.grandTotal.toFixed(2)}` : undefined
        }
        submitLabel="Send Again"
        isSubmitting={sent.isReassigning}
        onSubmit={handleReassign}
        excludeAgentId={reassignTarget?.targetAgentId}
      />
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 17, fontWeight: '700' },
  explainer: { fontSize: 12.5, paddingHorizontal: 18, lineHeight: 18, marginBottom: 12 },
  tabRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 10, marginBottom: 10 },
  tabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: 'rgba(148, 163, 184, 0.15)',
  },
  tabBtnActive: { backgroundColor: BRAND_COLORS.blue600 },
  tabBtnText: { fontSize: 13, fontWeight: '700' },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 12 },
  emptyText: { fontSize: 13.5, textAlign: 'center', lineHeight: 20 },
  card: { borderWidth: 1, borderRadius: 14, padding: 14 },
  cardHighlighted: { borderWidth: 1.8 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  invoiceText: { fontSize: 15, fontWeight: '800' },
  subText: { fontSize: 12, marginTop: 4 },
  amountText: { fontSize: 14, fontWeight: '700' },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 3, paddingHorizontal: 8, borderRadius: 12 },
  statusPillText: { fontSize: 10.5, fontWeight: '800' },
  actionHint: {
    marginTop: 10,
    backgroundColor: 'rgba(37, 99, 235, 0.1)',
    borderRadius: 10,
    paddingVertical: 7,
    alignItems: 'center',
  },
  actionHintText: { fontSize: 12, fontWeight: '800', color: BRAND_COLORS.blue600 },
  cardActions: { flexDirection: 'row', gap: 16, marginTop: 12, paddingTop: 10, borderTopWidth: 1 },
  resendChip: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  resendChipText: { fontSize: 11.5, fontWeight: '700', color: BRAND_COLORS.blue600 },
  cancelChip: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  cancelChipText: { fontSize: 11.5, fontWeight: '700', color: '#DC2626' },
});
