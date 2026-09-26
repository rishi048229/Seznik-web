import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, StatusBar, Platform, ActivityIndicator, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import {
  ChevronLeft,
  CheckCircle2,
  XCircle,
  Printer,
  Clock,
  Bluetooth,
  AlertTriangle,
  Receipt,
  User,
  MapPin,
  Send,
  Ban,
} from 'lucide-react-native';
import { usePrintJob } from '@/hooks/usePrintJobs';
import { salesApi } from '@/api/sales';
import { kotOrdersApi } from '@/api/kotOrders';
import { PrintJob, PrintJobStatus } from '@/types/printJob';
import { useAppTheme } from '@/hooks/useAppTheme';
import { ScreenBackground } from '@/components/ui/ScreenBackground';
import { ScreenLoadingState, ScreenErrorState } from '@/components/ui/ScreenLoadingState';
import { BRAND_COLORS } from '@/constants/theme';
import { usePrinterStore } from '@/store/usePrinterStore';
import { useShallow } from 'zustand/react/shallow';
import ThermalPrinterService from '@/services/PrinterService';
import { DirectPrinterConnectModal } from '@/components/printers/DirectPrinterConnectModal';
import { RemotePrintTargetPicker } from '@/components/printers/RemotePrintTargetPicker';
import { useStoreProfile } from '@/hooks/useStoreProfile';
import { parseGstBilling, gstPrintOptionOverrides } from '@/constants/gstBilling';
import { computeGstBillSummary, gstLinesFromSaleItems } from '@/utils/gst';
import { sanitizeErrorMessage } from '@/utils/errorHandler';
import { useAuthStore } from '@/store/useAuthStore';
import { debugFa19Log } from '@/utils/debugFa19Log';

const TERMINAL_STATUSES: PrintJobStatus[] = ['completed', 'rejected', 'expired', 'cancelled'];

/** Plain-language status text, written differently for the person who sent the request and the
 *  person who has to act on it — "Needs your response" is only true for one of them. */
function statusCopyFor(job: PrintJob, isSender: boolean): { label: string; hint: string; color: string } {
  const who = job.acceptedByAgentName || job.targetAgentName || job.targetLocationName || 'your teammate';
  switch (job.status) {
    case 'queued':
      return { label: 'Sending…', color: '#F59E0B', hint: 'Delivering this request now.' };
    case 'delivered':
      return isSender
        ? { label: `Waiting for ${who}`, color: '#2563EB', hint: 'They have been notified and need to accept it.' }
        : { label: 'Needs your response', color: '#2563EB', hint: 'Accept to print this receipt, or decline it.' };
    case 'accepted':
      return isSender
        ? { label: `${who} accepted`, color: '#16A34A', hint: 'They are getting their printer ready.' }
        : { label: 'Accepted — ready to print', color: '#16A34A', hint: 'Tap Print Now to send it to your printer.' };
    case 'printer_connect_pending':
      return isSender
        ? { label: 'Connecting a printer', color: '#F59E0B', hint: `${who} is choosing a printer. It will print automatically.` }
        : { label: 'Connect your printer', color: '#F59E0B', hint: 'Pick a printer — printing starts automatically once connected.' };
    case 'printing':
      return { label: 'Printing…', color: '#2563EB', hint: 'The receipt is being sent to the printer.' };
    case 'completed':
      return { label: 'Printed successfully', color: '#16A34A', hint: 'This receipt has been printed. It is now marked as a Remote Sale.' };
    case 'failed':
      return isSender
        ? { label: 'Print failed', color: '#DC2626', hint: job.failureReason || 'The printer could not finish. You can send it to someone else.' }
        : { label: 'Print failed', color: '#DC2626', hint: job.failureReason || 'Something went wrong. You can try printing again.' };
    case 'rejected':
      return isSender
        ? { label: `${who} declined`, color: '#6B7280', hint: 'You can send this receipt to someone else instead.' }
        : { label: 'You declined this', color: '#6B7280', hint: 'No receipt was printed.' };
    case 'expired':
      return isSender
        ? { label: 'No response in time', color: '#6B7280', hint: 'Nobody accepted it in time. Try sending it to someone else.' }
        : { label: 'Expired', color: '#6B7280', hint: 'This request timed out. Ask the sender to send it again.' };
    case 'cancelled':
      return { label: 'Cancelled', color: '#6B7280', hint: 'The sender cancelled this request.' };
    default:
      return { label: job.status, color: '#6B7280', hint: '' };
  }
}

const EVENT_LABELS: Record<string, string> = {
  queued: 'Request created',
  delivered: 'Sent to their phone',
  accepted: 'Accepted',
  rejected: 'Declined',
  printer_connect_pending: 'Choosing a printer',
  printing: 'Printing started',
  completed: 'Printed successfully',
  failed: 'Print failed',
  expired: 'Expired — no response in time',
  cancelled: 'Cancelled by sender',
};

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function PrintJobActionScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const topPadding = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0, 14);
  const currentUser = useAuthStore((s) => s.user);
  const currentActorId = currentUser?.id;
  const currentActorUid = (currentUser as any)?.uid || currentUser?.id;

  const { job, isLoading, isError, refetch, updateStatus, isUpdating, cancelJob, isCancelling, reassignJob, isReassigning } =
    usePrintJob(id);
  const storeProfile = useStoreProfile();
  const { connectionState } = usePrinterStore(useShallow((s) => ({ connectionState: s.connectionState })));

  const [isPrinting, setIsPrinting] = useState(false);
  const [printerModalVisible, setPrinterModalVisible] = useState(false);
  const [reassignVisible, setReassignVisible] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [nowTs, setNowTs] = useState(() => Date.now());
  // Guards against firing a second auto-print if the status poll and the onConnected callback
  // both resolve around the same moment.
  const printInFlightRef = useRef(false);
  const autoResumeKeyRef = useRef<string | null>(null);

  const isAwaitingResponse = job?.status === 'delivered';

  // Ticks only while a response deadline is actually running, so the screen isn't re-rendering
  // once per second for a job that has already been answered.
  useEffect(() => {
    if (!isAwaitingResponse) return;
    const timer = setInterval(() => setNowTs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [isAwaitingResponse]);

  const secondsLeft = useMemo(() => {
    if (!job || !isAwaitingResponse) return null;
    return Math.max(0, Math.round((new Date(job.expiresAt).getTime() - nowTs) / 1000));
  }, [job, isAwaitingResponse, nowTs]);

  const runPrint = useCallback(async () => {
    if (!job || printInFlightRef.current) return;
    printInFlightRef.current = true;
    setLocalError(null);
    setIsPrinting(true);
    try {
      await updateStatus({ status: 'printing' });

      const isKotJob = job.jobType === 'kot' || Boolean(job.kotOrderId);
      if (isKotJob && job.kotOrderId) {
        const order = await kotOrdersApi.getOrderById(job.kotOrderId);
        const activeItems = (order.items || [])
          .filter((it) => it.status !== 'voided')
          .map((it) => ({
            productName: it.productName,
            quantity: it.quantity,
            notes: it.notes || undefined,
            modifiers: it.modifiers,
          }));
        const kotPayload = {
          storeName: storeProfile.storeName || 'SEZNIK KITCHEN',
          orderNumber: order.orderNumber,
          orderType: order.orderType,
          tableName: order.table?.name,
          partyLabel: order.partyLabel || undefined,
          guestCount: order.guestCount || undefined,
          contactNumber: order.contactNumber || undefined,
          priority: order.priority,
          notes: order.notes || undefined,
          time: new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          copyType: 'KITCHEN COPY' as const,
          items: activeItems,
        };
        const copies = Math.max(1, job.copies || 1);
        for (let i = 0; i < copies; i += 1) {
          await ThermalPrinterService.printKotTicket(kotPayload, job.paperWidth);
        }
        await updateStatus({ status: 'completed' });
        return;
      }

      if (!job.saleId) {
        throw new Error('This print job has no sale or KOT linked.');
      }

      const sale = await salesApi.getSaleById(job.saleId);
      const items = (sale.items || []).map((it: any) => ({
        productName: it.productName || it.name || 'Item',
        quantity: it.quantity || 1,
        unitPrice: it.unitPrice || it.price || 0,
        total: it.total || (it.quantity || 1) * (it.unitPrice || 0),
        unit: it.unit || 'piece',
      }));
      const gstBilling = parseGstBilling(storeProfile.settings?.invoiceConfig);
      const summary = computeGstBillSummary(gstLinesFromSaleItems(sale.items || []));

      await ThermalPrinterService.printSaleReceipt(
        {
          storeName: storeProfile.storeName,
          storeAddress: storeProfile.storeAddress,
          storePhone: storeProfile.storePhone,
          storeGstin: storeProfile.storeGstin,
          storeLogoUrl: storeProfile.storeLogoUrl,
          upiId: storeProfile.upiId,
          invoiceNumber: sale.invoiceNumber,
          date:
            new Date(sale.createdAt).toLocaleDateString('en-GB') +
            ' ' +
            new Date(sale.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          customerName: sale.customerName || 'Walk-in Customer',
          items,
          subtotal: sale.subtotal,
          totalTax: sale.totalTax || 0,
          totalDiscount: sale.totalDiscount || 0,
          grandTotal: sale.grandTotal,
          amountPaid: sale.amountPaid !== undefined ? sale.amountPaid : sale.grandTotal,
          changeReturned: sale.changeReturned || 0,
          paymentMethod: (sale.paymentMethod || 'CASH').toUpperCase(),
          taxableAmt: summary.taxableValue,
          cgst: summary.cgstAmount,
          sgst: summary.sgstAmount,
          gstStyle: gstBilling.printOnReceipt ? gstBilling.style : undefined,
          gstSlabs: summary.slabs,
        },
        {
          paperWidth: job.paperWidth,
          copies: job.copies,
          ...gstPrintOptionOverrides(gstBilling),
        }
      );

      await updateStatus({ status: 'completed' });
    } catch (err: any) {
      const message = sanitizeErrorMessage(err, 'Failed to print this receipt.');
      setLocalError(message);
      await updateStatus({ status: 'failed', failureReason: message }).catch(() => {});
    } finally {
      setIsPrinting(false);
      printInFlightRef.current = false;
    }
  }, [job, storeProfile, updateStatus]);

  const printerIsReady = useCallback(async () => {
    const model = usePrinterStore.getState().connectedPrinterModel;
    if (model === 'rudra' || model === 'tejas') {
      return ThermalPrinterService.td404IsConnected();
    }
    if (await ThermalPrinterService.td404IsConnected()) return true;
    if (await ThermalPrinterService.joshEnsureConnected()) return true;
    return connectionState === 'connected';
  }, [connectionState]);

  const handlePrintNow = async () => {
    const ready = await printerIsReady();
    if (!ready) {
      await updateStatus({ status: 'printer_connect_pending' }).catch(() => {});
      setPrinterModalVisible(true);
      return;
    }
    await runPrint();
  };

  const handleAccept = async () => {
    setLocalError(null);
    try {
      await updateStatus({ status: 'accepted' });
      const ready = await printerIsReady();
      // #region agent log
      debugFa19Log({
        hypothesisId: 'C',
        location: 'print-jobs/[id].tsx:handleAccept',
        message: 'Print job accepted on detail screen',
        data: {
          jobId: job?.id,
          printerReady: ready,
          connectionState,
          connectedModel: usePrinterStore.getState().connectedPrinterModel,
        },
      });
      // #endregion
      if (ready) {
        await runPrint();
      } else {
        await updateStatus({ status: 'printer_connect_pending' }).catch(() => {});
        setPrinterModalVisible(true);
      }
    } catch (err: any) {
      setLocalError(sanitizeErrorMessage(err, 'Could not accept this request.'));
    }
  };

  const handleReject = async () => {
    setLocalError(null);
    try {
      await updateStatus({ status: 'rejected' });
    } catch (err: any) {
      setLocalError(sanitizeErrorMessage(err, 'Could not decline this request.'));
    }
  };

  const handlePrinterConnected = useCallback(() => {
    setPrinterModalVisible(false);
    // Give the native connect state a beat to settle before printing immediately after pairing.
    setTimeout(() => {
      runPrint();
    }, 400);
  }, [runPrint]);

  const handleCancel = () => {
    Alert.alert('Cancel this request?', 'They will no longer be able to print this receipt.', [
      { text: 'Keep it', style: 'cancel' },
      {
        text: 'Cancel Request',
        style: 'destructive',
        onPress: async () => {
          try {
            await cancelJob();
          } catch (err: any) {
            setLocalError(sanitizeErrorMessage(err, 'Could not cancel this request.'));
          }
        },
      },
    ]);
  };

  const handleReassign = async (agentId: string) => {
    try {
      const newJob = await reassignJob(agentId);
      setReassignVisible(false);
      router.replace(`/print-jobs/${newJob.id}` as any);
    } catch (err: any) {
      setReassignVisible(false);
      setLocalError(sanitizeErrorMessage(err, 'Could not send this to someone else.'));
    }
  };

  // After accept (banner or detail screen), resume printing automatically when the printer is
  // ready — VEER/MPT-II often reports ready via native SDK while connectionState lags.
  useEffect(() => {
    if (!job || isPrinting || printInFlightRef.current) return;

    const isTargetJob =
      job.targetAgentId === currentActorId ||
      job.targetAgentId === currentActorUid ||
      job.acceptedByAgentId === currentActorId ||
      job.acceptedByAgentId === currentActorUid ||
      (!!job.targetLocationId && !job.acceptedByAgentId);

    if (!isTargetJob) return;
    if (!['accepted', 'printer_connect_pending', 'failed'].includes(job.status)) return;

    const resumeKey = `${job.id}:${job.status}`;
    if (autoResumeKeyRef.current === resumeKey) return;
    autoResumeKeyRef.current = resumeKey;

    void (async () => {
      const ready = await printerIsReady();
      // #region agent log
      debugFa19Log({
        hypothesisId: 'C',
        runId: 'post-fix',
        location: 'print-jobs/[id].tsx:autoResume',
        message: 'Auto-resume print evaluation',
        data: {
          jobId: job.id,
          status: job.status,
          printerReady: ready,
          connectionState,
        },
      });
      // #endregion
      if (ready) {
        await runPrint();
        return;
      }
      if (job.status === 'accepted' || job.status === 'failed') {
        await updateStatus({ status: 'printer_connect_pending' }).catch(() => {});
        setPrinterModalVisible(true);
      }
    })();
  }, [job?.id, job?.status, currentActorId, currentActorUid, connectionState, isPrinting]); // eslint-disable-line react-hooks/exhaustive-deps

  if (isLoading) {
    return <ScreenLoadingState message="Loading print request…" fullScreen />;
  }
  if (isError || !job) {
    return <ScreenErrorState message="Couldn't load this print request" onRetry={refetch} fullScreen />;
  }

  const isSender =
    job.requestedById === currentActorId || job.requestedById === currentActorUid;
  const isTarget =
    job.targetAgentId === currentActorId ||
    job.targetAgentId === currentActorUid ||
    job.acceptedByAgentId === currentActorId ||
    job.acceptedByAgentId === currentActorUid ||
    (!!job.targetLocationId && !job.acceptedByAgentId);
  const statusCopy = statusCopyFor(job, isSender && !isTarget);

  const canRespond = job.status === 'delivered' && isTarget;
  const canPrint = (job.status === 'accepted' || job.status === 'printer_connect_pending' || job.status === 'failed') && isTarget;
  const canCancel = isSender && !['completed', 'printing', 'cancelled'].includes(job.status);
  const canReassign = isSender && ['expired', 'rejected', 'failed'].includes(job.status);
  const isTerminal = TERMINAL_STATUSES.includes(job.status);
  const isBusy = job.status === 'printing' || isPrinting;

  return (
    <ScreenBackground color={theme.bg}>
      <View style={{ flex: 1, paddingTop: topPadding }}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={10}>
            <ChevronLeft size={24} color={theme.textPrimary} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>Remote Print Request</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
          <View style={[styles.statusBanner, { borderColor: statusCopy.color, backgroundColor: statusCopy.color + '18' }]}>
            {isBusy ? (
              <ActivityIndicator size="small" color={statusCopy.color} />
            ) : job.status === 'completed' ? (
              <CheckCircle2 size={22} color={statusCopy.color} />
            ) : job.status === 'failed' ? (
              <AlertTriangle size={22} color={statusCopy.color} />
            ) : job.status === 'rejected' || job.status === 'expired' || job.status === 'cancelled' ? (
              <XCircle size={22} color={statusCopy.color} />
            ) : (
              <Clock size={22} color={statusCopy.color} />
            )}
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={[styles.statusLabel, { color: statusCopy.color }]}>{statusCopy.label}</Text>
              <Text style={[styles.statusHint, { color: theme.textSecondary }]}>{statusCopy.hint}</Text>
              {secondsLeft !== null && (
                <Text style={[styles.countdown, { color: secondsLeft <= 20 ? '#DC2626' : theme.textSecondary }]}>
                  {secondsLeft > 0
                    ? `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, '0')} left to respond`
                    : 'Time is up — refreshing…'}
                </Text>
              )}
            </View>
          </View>

          <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
            {job.jobType === 'kot' ? (
              <View style={styles.cardRow}>
                <Receipt size={16} color={theme.textSecondary} />
                <Text style={[styles.cardLabel, { color: theme.textSecondary }]}>Ticket</Text>
                <Text style={[styles.cardValue, { color: theme.textPrimary }]}>Kitchen KOT</Text>
              </View>
            ) : (
              <>
                <View style={styles.cardRow}>
                  <Receipt size={16} color={theme.textSecondary} />
                  <Text style={[styles.cardLabel, { color: theme.textSecondary }]}>Invoice</Text>
                  <Text style={[styles.cardValue, { color: theme.textPrimary }]}>
                    {job.sale?.invoiceNumber || '—'}
                  </Text>
                </View>
                <View style={styles.cardRow}>
                  <Text style={[styles.cardLabel, { color: theme.textSecondary, marginLeft: 24 }]}>Amount</Text>
                  <Text style={[styles.cardValue, { color: theme.textPrimary }]}>
                    ₹{(job.sale?.grandTotal ?? 0).toFixed(2)}
                  </Text>
                </View>
                {job.sale?.customer?.name ? (
                  <View style={styles.cardRow}>
                    <User size={16} color={theme.textSecondary} />
                    <Text style={[styles.cardLabel, { color: theme.textSecondary }]}>Customer</Text>
                    <Text style={[styles.cardValue, { color: theme.textPrimary }]}>{job.sale.customer.name}</Text>
                  </View>
                ) : null}
              </>
            )}
            <View style={styles.cardRow}>
              <Send size={16} color={theme.textSecondary} />
              <Text style={[styles.cardLabel, { color: theme.textSecondary }]}>{isSender ? 'Sent to' : 'Sent by'}</Text>
              <Text style={[styles.cardValue, { color: theme.textPrimary }]}>
                {isSender ? job.acceptedByAgentName || job.targetAgentName || job.targetLocationName || 'Team' : job.requestedByName}
              </Text>
            </View>
            {job.targetLocationName ? (
              <View style={styles.cardRow}>
                <MapPin size={16} color={theme.textSecondary} />
                <Text style={[styles.cardLabel, { color: theme.textSecondary }]}>Location</Text>
                <Text style={[styles.cardValue, { color: theme.textPrimary }]}>{job.targetLocationName}</Text>
              </View>
            ) : null}
            <View style={[styles.cardRow, { marginBottom: 0 }]}>
              <Printer size={16} color={theme.textSecondary} />
              <Text style={[styles.cardLabel, { color: theme.textSecondary }]}>Paper</Text>
              <Text style={[styles.cardValue, { color: theme.textPrimary }]}>
                {job.paperWidth}
                {job.copies > 1 ? ` · ${job.copies} copies` : ''}
              </Text>
            </View>
          </View>

          {localError ? (
            <View style={[styles.errorBox, { borderColor: '#DC2626' }]}>
              <Text style={styles.errorText}>{localError}</Text>
            </View>
          ) : null}

          {canRespond && (
            <View style={styles.actionRow}>
              <TouchableOpacity style={[styles.actionBtn, styles.rejectBtn]} onPress={handleReject} disabled={isUpdating}>
                <XCircle size={20} color="#DC2626" />
                <Text style={styles.rejectBtnText}>Decline</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionBtn, styles.acceptBtn]} onPress={handleAccept} disabled={isUpdating}>
                {isUpdating ? <ActivityIndicator size="small" color="#FFFFFF" /> : <CheckCircle2 size={20} color="#FFFFFF" />}
                <Text style={styles.acceptBtnText}>Accept</Text>
              </TouchableOpacity>
            </View>
          )}

          {canPrint && (
            <TouchableOpacity style={[styles.printBtn, { opacity: isPrinting ? 0.7 : 1 }]} onPress={handlePrintNow} disabled={isPrinting}>
              {isPrinting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : connectionState === 'connected' ? (
                <Printer size={20} color="#FFFFFF" />
              ) : (
                <Bluetooth size={20} color="#FFFFFF" />
              )}
              <Text style={styles.printBtnText}>
                {isPrinting ? 'Printing…' : connectionState === 'connected' ? 'Print Now' : 'Connect Printer & Print'}
              </Text>
            </TouchableOpacity>
          )}

          {canReassign && (
            <TouchableOpacity style={styles.printBtn} onPress={() => setReassignVisible(true)} disabled={isReassigning}>
              {isReassigning ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Send size={20} color="#FFFFFF" />}
              <Text style={styles.printBtnText}>Send to Someone Else</Text>
            </TouchableOpacity>
          )}

          {canCancel && (
            <TouchableOpacity style={styles.cancelBtn} onPress={handleCancel} disabled={isCancelling}>
              {isCancelling ? <ActivityIndicator size="small" color="#DC2626" /> : <Ban size={17} color="#DC2626" />}
              <Text style={styles.cancelBtnText}>Cancel This Request</Text>
            </TouchableOpacity>
          )}

          {job.events && job.events.length > 0 ? (
            <View style={{ marginTop: 22 }}>
              <Text style={[styles.timelineHeader, { color: theme.textSecondary }]}>WHAT HAPPENED</Text>
              <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.borderColor, marginBottom: 0 }]}>
                {job.events.map((event, idx) => {
                  const isLast = idx === job.events!.length - 1;
                  const dotColor = statusCopyFor({ ...job, status: event.status }, isSender && !isTarget).color;
                  return (
                    <View key={event.id} style={styles.timelineRow}>
                      <View style={styles.timelineGutter}>
                        <View style={[styles.timelineDot, { backgroundColor: dotColor }]} />
                        {!isLast && <View style={[styles.timelineLine, { backgroundColor: theme.borderColor }]} />}
                      </View>
                      <View style={{ flex: 1, paddingBottom: isLast ? 0 : 16 }}>
                        <Text style={[styles.timelineLabel, { color: theme.textPrimary }]}>
                          {EVENT_LABELS[event.status] || event.status}
                        </Text>
                        <Text style={[styles.timelineTime, { color: theme.textSecondary }]}>
                          {formatTime(event.createdAt)}
                          {event.note ? ` · ${event.note}` : ''}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          ) : null}

          {isTerminal && (
            <TouchableOpacity style={styles.doneBtn} onPress={() => router.replace('/print-jobs' as any)}>
              <Text style={styles.doneBtnText}>Back to Print Requests</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </View>

      <DirectPrinterConnectModal
        visible={printerModalVisible}
        onClose={() => setPrinterModalVisible(false)}
        onConnected={handlePrinterConnected}
        title="Connect a Printer"
        subtitle="Pick your printer to print this receipt"
        showContinueWithoutPrinter={false}
      />

      <RemotePrintTargetPicker
        visible={reassignVisible}
        onClose={() => setReassignVisible(false)}
        title="Send to Someone Else"
        subtitle={
          job.jobType === 'kot'
            ? 'Kitchen KOT ticket'
            : `Invoice ${job.sale?.invoiceNumber || '—'} · ₹${(job.sale?.grandTotal ?? 0).toFixed(2)}`
        }
        submitLabel="Send Again"
        isSubmitting={isReassigning}
        onSubmit={handleReassign}
        excludeAgentId={job.targetAgentId}
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
    paddingBottom: 12,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 17, fontWeight: '700' },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: 1.5,
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
  },
  statusLabel: { fontSize: 15, fontWeight: '800' },
  statusHint: { fontSize: 13, marginTop: 2, lineHeight: 18 },
  countdown: { fontSize: 12, fontWeight: '700', marginTop: 6 },
  card: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
  },
  cardRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  cardLabel: { fontSize: 13, marginLeft: 8, flex: 1 },
  cardValue: { fontSize: 14, fontWeight: '700' },
  errorBox: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    backgroundColor: 'rgba(220, 38, 38, 0.08)',
  },
  errorText: { color: '#DC2626', fontSize: 13, fontWeight: '600' },
  actionRow: { flexDirection: 'row', gap: 12 },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 15,
    borderRadius: 14,
  },
  rejectBtn: { backgroundColor: 'rgba(220, 38, 38, 0.1)', borderWidth: 1.5, borderColor: '#DC2626' },
  rejectBtnText: { color: '#DC2626', fontWeight: '800', fontSize: 15 },
  acceptBtn: { backgroundColor: '#16A34A' },
  acceptBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },
  printBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: BRAND_COLORS.blue600,
    paddingVertical: 16,
    borderRadius: 14,
  },
  printBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 16 },
  cancelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    marginTop: 10,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(220, 38, 38, 0.4)',
  },
  cancelBtnText: { color: '#DC2626', fontWeight: '700', fontSize: 14 },
  timelineHeader: { fontSize: 11, fontWeight: '800', letterSpacing: 0.8, marginBottom: 10 },
  timelineRow: { flexDirection: 'row' },
  timelineGutter: { width: 20, alignItems: 'center' },
  timelineDot: { width: 10, height: 10, borderRadius: 6, marginTop: 4 },
  timelineLine: { width: 2, flex: 1, marginTop: 3 },
  timelineLabel: { fontSize: 13.5, fontWeight: '700' },
  timelineTime: { fontSize: 11.5, marginTop: 2 },
  doneBtn: { alignItems: 'center', paddingVertical: 14, marginTop: 14 },
  doneBtnText: { color: BRAND_COLORS.blue600, fontWeight: '700', fontSize: 14 },
});
