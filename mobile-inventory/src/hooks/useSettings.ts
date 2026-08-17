import { useQuery } from '@tanstack/react-query';
import { settingsApi } from '@/api/settings';

/**
 * Real business Settings (name/address/phone/GSTIN etc.), used anywhere a receipt/invoice
 * needs the store's real details instead of hardcoded placeholder text.
 */
export function useSettings() {
  const settingsQuery = useQuery({
    queryKey: ['settings'],
    queryFn: settingsApi.getSettings,
    staleTime: 1000 * 60 * 5,
  });

  return {
    settings: settingsQuery.data || null,
    isLoading: settingsQuery.isLoading,
  };
}
