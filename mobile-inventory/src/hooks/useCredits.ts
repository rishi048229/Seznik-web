import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { reportsApi } from '@/api/reports';
import { creditsApi } from '@/api/credits';

/** Real Day Book for a given date (defaults to today) — no mock fallback, errors surface for real. */
export function useDaybook(date?: string) {
  const daybookQuery = useQuery({
    queryKey: ['daybook', date],
    queryFn: () => reportsApi.getDaybook(date),
  });

  return {
    daybook: daybookQuery.data,
    isLoading: !daybookQuery.data && daybookQuery.isLoading,
    isRefetching: daybookQuery.isRefetching,
    isError: daybookQuery.isError && !daybookQuery.data,
    error: daybookQuery.error as Error | null,
    refetch: daybookQuery.refetch,
  };
}

export function useCredits() {
  const queryClient = useQueryClient();

  const recordPaymentMutation = useMutation({
    mutationFn: async (payload: { customerId: string; amount: number; paymentMethod?: string; notes?: string }) => {
      return creditsApi.createTransaction({
        customerId: payload.customerId,
        amount: payload.amount,
        type: 'payment',
        notes: payload.notes,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['daybook'] });
      queryClient.invalidateQueries({ queryKey: ['remindersDue'] });
      queryClient.invalidateQueries({ queryKey: ['customerLedger'] });
    },
  });

  // Manually record credit given to a customer without going through a POS sale.
  const addCreditMutation = useMutation({
    mutationFn: async (payload: { customerId: string; amount: number; notes?: string }) => {
      return creditsApi.createTransaction({
        customerId: payload.customerId,
        amount: payload.amount,
        type: 'credit',
        notes: payload.notes,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['daybook'] });
      queryClient.invalidateQueries({ queryKey: ['remindersDue'] });
      queryClient.invalidateQueries({ queryKey: ['customerLedger'] });
    },
  });

  return {
    recordCreditPayment: recordPaymentMutation.mutateAsync,
    isRecordingPayment: recordPaymentMutation.isPending,
    addManualCredit: addCreditMutation.mutateAsync,
    isAddingCredit: addCreditMutation.isPending,
  };
}

/** Customers overdue by at least thresholdDays, not reminded in the last cooldownDays. */
export function useRemindersDue(thresholdDays: number, cooldownDays: number) {
  const query = useQuery({
    queryKey: ['remindersDue', thresholdDays, cooldownDays],
    queryFn: () => creditsApi.getRemindersDue(thresholdDays, cooldownDays),
  });

  return {
    remindersDue: query.data || [],
    isLoading: !query.data && query.isLoading,
    isRefetching: query.isRefetching,
    isError: query.isError && !query.data,
    refetch: query.refetch,
  };
}

/** Logs that a WhatsApp reminder was tapped/sent for a customer. */
export function useSendReminder() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: ({ customerId, amount }: { customerId: string; amount: number }) =>
      creditsApi.logReminderSent(customerId, amount),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['remindersDue'] });
      queryClient.invalidateQueries({ queryKey: ['daybook'] });
    },
  });

  return {
    sendReminder: mutation.mutateAsync,
    isSending: mutation.isPending,
  };
}

/** Full transaction history + running balance for one customer's "statement" view. */
export function useCustomerLedger(customerId: string | null) {
  const query = useQuery({
    queryKey: ['customerLedger', customerId],
    queryFn: () => creditsApi.getCustomerLedger(customerId as string),
    enabled: !!customerId,
  });

  return {
    ledger: query.data,
    isLoading: query.isLoading,
  };
}

export function useDayClose() {
  const queryClient = useQueryClient();

  const statusQuery = useQuery({
    queryKey: ['dayCloseStatus'],
    queryFn: () => reportsApi.getDayCloseStatus(),
  });

  const closeMutation = useMutation({
    mutationFn: ({ countedCash, notes }: { countedCash: number; notes?: string }) =>
      reportsApi.closeDayRegister(countedCash, notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dayCloseStatus'] });
      queryClient.invalidateQueries({ queryKey: ['daybook'] });
    },
  });

  return {
    dayClose: statusQuery.data || null,
    isLoading: statusQuery.isLoading,
    closeDayRegister: closeMutation.mutateAsync,
    isClosing: closeMutation.isPending,
  };
}
