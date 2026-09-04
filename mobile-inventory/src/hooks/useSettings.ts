import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { settingsApi, SettingsPayload } from '@/api/settings';
import { resolveBusinessLogoUri } from '@/utils/businessLogoStorage';

/** Latest Settings.trackStock for non-React callers (e.g. cart store). */
let cachedTrackStockSetting: boolean | null | undefined;

export function getCachedTrackStockSetting(): boolean | null | undefined {
  return cachedTrackStockSetting;
}

/**
 * Real business Settings (name/address/phone/GSTIN etc.), used anywhere a receipt/invoice
 * needs the store's real details instead of hardcoded placeholder text.
 */
export function useSettings() {
  const queryClient = useQueryClient();

  const settingsQuery = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const settings = await settingsApi.getSettings();
      if (!settings) {
        cachedTrackStockSetting = undefined;
        return null;
      }
      cachedTrackStockSetting = settings.trackStock;
      if (settings.businessLogoURL) {
        const resolved = await resolveBusinessLogoUri(settings.businessLogoURL);
        return { ...settings, businessLogoURL: resolved };
      }
      return settings;
    },
    staleTime: 1000 * 60 * 5,
  });

  useEffect(() => {
    if (settingsQuery.data) {
      cachedTrackStockSetting = settingsQuery.data.trackStock;
    }
  }, [settingsQuery.data]);

  const updateMutation = useMutation({
    mutationFn: (payload: SettingsPayload) => {
      if (settingsQuery.data?.id) {
        return settingsApi.updateSettings(settingsQuery.data.id, payload);
      }
      return settingsApi.createSettings(payload);
    },
    onSuccess: (data) => {
      if (data && typeof (data as { trackStock?: boolean }).trackStock === 'boolean') {
        cachedTrackStockSetting = (data as { trackStock?: boolean }).trackStock;
      }
      queryClient.invalidateQueries({ queryKey: ['settings'] });
    },
  });

  return {
    settings: settingsQuery.data || null,
    isLoading: !settingsQuery.data && settingsQuery.isLoading,
    isRefetching: settingsQuery.isRefetching,
    isError: settingsQuery.isError && !settingsQuery.data,
    refetch: settingsQuery.refetch,
    updateSettings: updateMutation.mutateAsync,
    isUpdating: updateMutation.isPending,
  };
}
