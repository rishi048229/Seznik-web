import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { settingsApi, SettingsPayload } from '@/api/settings';

/**
 * Real business Settings (name/address/phone/GSTIN etc.), used anywhere a receipt/invoice
 * needs the store's real details instead of hardcoded placeholder text.
 */
export function useSettings() {
  const queryClient = useQueryClient();

  const settingsQuery = useQuery({
    queryKey: ['settings'],
    queryFn: settingsApi.getSettings,
    staleTime: 1000 * 60 * 5,
  });

  const updateMutation = useMutation({
    mutationFn: (payload: SettingsPayload) => {
      if (settingsQuery.data?.id) {
        return settingsApi.updateSettings(settingsQuery.data.id, payload);
      }
      return settingsApi.createSettings(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
    },
  });

  return {
    settings: settingsQuery.data || null,
    isLoading: settingsQuery.isLoading,
    updateSettings: updateMutation.mutateAsync,
    isUpdating: updateMutation.isPending,
  };
}
