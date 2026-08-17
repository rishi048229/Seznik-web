import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { feedbackApi, CreateFeedbackPayload } from '@/api/feedback';

export function useFeedback() {
  const queryClient = useQueryClient();

  const listQuery = useQuery({
    queryKey: ['feedback'],
    queryFn: feedbackApi.getMyFeedback,
  });

  const submitMutation = useMutation({
    mutationFn: (payload: CreateFeedbackPayload) => feedbackApi.submitFeedback(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['feedback'] }),
  });

  return {
    feedback: listQuery.data || [],
    isLoading: listQuery.isLoading,
    submitFeedback: submitMutation.mutateAsync,
    isSubmitting: submitMutation.isPending,
  };
}
