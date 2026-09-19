import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { printJobsApi, deviceTokensApi } from '@/api/printJobs';
import { CreatePrintJobPayload, PrintJob } from '@/types/printJob';

/** Admin-side: every remote-print job this business has sent, most recent first. Polls slowly —
 *  this screen is a status board someone might leave open, not a chat. */
export function usePrintJobsAdmin(params?: { status?: string; targetAgentId?: string }) {
  const queryClient = useQueryClient();

  const jobsQuery = useQuery({
    queryKey: ['printJobs', 'admin', params],
    queryFn: () => printJobsApi.listForAdmin(params),
    staleTime: 0,
    refetchInterval: 8000,
  });

  const createMutation = useMutation({
    mutationFn: (payload: CreatePrintJobPayload) => printJobsApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['printJobs'] });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => printJobsApi.cancel(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['printJobs'] });
    },
  });

  const reassignMutation = useMutation({
    mutationFn: ({ id, targetAgentId }: { id: string; targetAgentId: string }) =>
      printJobsApi.reassign(id, targetAgentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['printJobs'] });
    },
  });

  return {
    jobs: jobsQuery.data || [],
    isLoading: !jobsQuery.data && jobsQuery.isLoading,
    isRefetching: jobsQuery.isRefetching,
    isError: jobsQuery.isError && !jobsQuery.data,
    refetch: jobsQuery.refetch,
    sendJob: createMutation.mutateAsync,
    isSending: createMutation.isPending,
    cancelJob: cancelMutation.mutateAsync,
    isCancelling: cancelMutation.isPending,
    reassignJob: reassignMutation.mutateAsync,
    isReassigning: reassignMutation.isPending,
  };
}

/** Agent-side: jobs currently waiting on this agent's action. This is the fallback for a push that
 *  never arrived (permission denied, Doze/battery saver, iOS killed the app), so it polls even when
 *  no print-job screen is open — hence the configurable interval: the always-mounted banner uses a
 *  slow one, a focused screen can ask for a faster one. */
export function usePendingPrintJobsForAgent(enabled = true, intervalMs = 5000) {
  const jobsQuery = useQuery({
    queryKey: ['printJobs', 'agentPending'],
    queryFn: () => printJobsApi.listPendingForAgent(),
    staleTime: 0,
    refetchInterval: enabled ? intervalMs : false,
    enabled,
  });

  return {
    jobs: jobsQuery.data || [],
    isLoading: !jobsQuery.data && jobsQuery.isLoading,
    isRefetching: jobsQuery.isRefetching,
    isError: jobsQuery.isError && !jobsQuery.data,
    refetch: jobsQuery.refetch,
  };
}

/** A single job's live status — used by the incoming-request/action screen on both sides while
 *  it's open, so a status change made from elsewhere (e.g. admin cancels) shows up without a
 *  manual pull-to-refresh. */
export function usePrintJob(id: string | undefined, options?: { pollWhileActive?: boolean }) {
  const queryClient = useQueryClient();
  const pollWhileActive = options?.pollWhileActive !== false;

  const jobQuery = useQuery({
    queryKey: ['printJobs', 'detail', id],
    queryFn: () => printJobsApi.getById(id as string),
    enabled: !!id,
    staleTime: 0,
    refetchInterval: (query) => {
      if (!pollWhileActive) return false;
      const status = query.state.data?.status;
      const isTerminal =
        status === 'completed' || status === 'failed' || status === 'expired' || status === 'cancelled';
      return isTerminal ? false : 4000;
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ status, failureReason }: { status: Parameters<typeof printJobsApi.updateStatus>[1]; failureReason?: string }) =>
      printJobsApi.updateStatus(id as string, status, failureReason),
    onSuccess: (updated) => {
      queryClient.setQueryData(['printJobs', 'detail', id], updated);
      queryClient.invalidateQueries({ queryKey: ['printJobs', 'agentPending'] });
      queryClient.invalidateQueries({ queryKey: ['printJobs', 'admin'] });
      if (updated.status === 'completed') {
        queryClient.invalidateQueries({ queryKey: ['sales'] });
        queryClient.invalidateQueries({ queryKey: ['daybook'] });
      }
    },
  });

  const cancelMutation = useMutation({
    mutationFn: () => printJobsApi.cancel(id as string),
    onSuccess: (updated) => {
      queryClient.setQueryData(['printJobs', 'detail', id], updated);
      queryClient.invalidateQueries({ queryKey: ['printJobs'] });
    },
  });

  const reassignMutation = useMutation({
    mutationFn: (targetAgentId: string) => printJobsApi.reassign(id as string, targetAgentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['printJobs'] });
    },
  });

  return {
    job: jobQuery.data as PrintJob | undefined,
    isLoading: !jobQuery.data && jobQuery.isLoading,
    isError: jobQuery.isError && !jobQuery.data,
    refetch: jobQuery.refetch,
    updateStatus: updateStatusMutation.mutateAsync,
    isUpdating: updateStatusMutation.isPending,
    cancelJob: cancelMutation.mutateAsync,
    isCancelling: cancelMutation.isPending,
    /** Creates a NEW job for the same sale aimed at someone else — resolves to that new job. */
    reassignJob: reassignMutation.mutateAsync,
    isReassigning: reassignMutation.isPending,
  };
}

export function useBusinessDevices(enabled = true) {
  const devicesQuery = useQuery({
    queryKey: ['deviceTokens', 'business'],
    queryFn: () => deviceTokensApi.listBusinessDevices(),
    enabled,
  });

  return {
    devices: devicesQuery.data || [],
    isLoading: devicesQuery.isLoading,
    refetch: devicesQuery.refetch,
  };
}
