import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { settingsApi, Settings, SettingsPayload } from '@/api/settings';
import { resolveBusinessLogoUri } from '@/utils/businessLogoStorage';
import { getStoredSettings, setStoredSettings } from '@/services/secureStore';

/** In-memory cache of latest Settings for non-React callers (e.g. cart, printer service, POS). */
let cachedSettings: Settings | null = null;
let cachedTrackStockSetting: boolean | null | undefined;

export function getCachedSettings(): Settings | null {
  return cachedSettings;
}

export function setCachedSettings(settings: Settings | null): void {
  cachedSettings = settings;
  if (settings && typeof settings.trackStock === 'boolean') {
    cachedTrackStockSetting = settings.trackStock;
  }
}

export function setCachedTrackStockSetting(track: boolean | null | undefined): void {
  cachedTrackStockSetting = track;
  if (cachedSettings && typeof track === 'boolean') {
    cachedSettings = { ...cachedSettings, trackStock: track };
  }
}

export function getCachedTrackStockSetting(): boolean | null | undefined {
  return cachedTrackStockSetting;
}

// Eagerly restore stored settings from disk into memory on startup
getStoredSettings<Settings>()
  .then((saved) => {
    if (saved && !cachedSettings) {
      cachedSettings = saved;
      if (typeof saved.trackStock === 'boolean') {
        cachedTrackStockSetting = saved.trackStock;
      }
    }
  })
  .catch(() => {});

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
      let resolvedSettings = settings;
      if (settings.businessLogoURL) {
        const resolved = await resolveBusinessLogoUri(settings.businessLogoURL);
        resolvedSettings = { ...settings, businessLogoURL: resolved };
      }
      cachedSettings = resolvedSettings;
      setStoredSettings(resolvedSettings).catch(() => {});
      return resolvedSettings;
    },
    initialData: () => cachedSettings || undefined,
    staleTime: 1000 * 60 * 5,
  });

  useEffect(() => {
    if (settingsQuery.data) {
      cachedSettings = settingsQuery.data;
      cachedTrackStockSetting = settingsQuery.data.trackStock;
      setStoredSettings(settingsQuery.data).catch(() => {});
    }
  }, [settingsQuery.data]);

  const updateMutation = useMutation({
    mutationFn: (payload: SettingsPayload) => {
      if (settingsQuery.data?.id) {
        return settingsApi.updateSettings(settingsQuery.data.id, payload);
      }
      return settingsApi.createSettings(payload);
    },
    onSuccess: (data: Settings) => {
      if (data) {
        cachedSettings = data;
        if (typeof data.trackStock === 'boolean') {
          cachedTrackStockSetting = data.trackStock;
        }
        setStoredSettings(data).catch(() => {});
        queryClient.setQueryData(['settings'], data);
      }
      queryClient.invalidateQueries({ queryKey: ['settings'] });
    },
  });

  return {
    settings: settingsQuery.data || cachedSettings || null,
    isLoading: !settingsQuery.data && !cachedSettings && settingsQuery.isLoading,
    isRefetching: settingsQuery.isRefetching,
    isError: settingsQuery.isError && !settingsQuery.data && !cachedSettings,
    refetch: settingsQuery.refetch,
    updateSettings: updateMutation.mutateAsync,
    isUpdating: updateMutation.isPending,
  };
}

