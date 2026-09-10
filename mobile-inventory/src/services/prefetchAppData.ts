import { QueryClient } from '@tanstack/react-query';
import { productsApi } from '@/api/products';
import { reportsApi } from '@/api/reports';
import { settingsApi } from '@/api/settings';
import { readCatalogCache, writeCatalogCache } from '@/services/catalogCache';
import { readDashboardCache, writeDashboardCache } from '@/services/dashboardCache';
import { getStoredSettings, setStoredSettings } from '@/services/secureStore';
import { setCachedSettings } from '@/hooks/useSettings';
import { resolveBusinessLogoUri } from '@/utils/businessLogoStorage';

export const PRODUCTS_QUERY_KEY = 'products';

export function productsQueryKey(userId: string) {
  return [PRODUCTS_QUERY_KEY, userId] as const;
}

/** Warm store settings from disk so receipts/POS have merchant branding immediately on cold start. */
export async function hydrateSettingsFromDisk(queryClient: QueryClient) {
  try {
    const cached = await getStoredSettings();
    if (cached) {
      setCachedSettings(cached);
      queryClient.setQueryData(['settings'], cached);
    }
    return cached;
  } catch (err) {
    console.warn('[prefetchAppData] Failed to hydrate settings from disk:', err);
    return null;
  }
}

/** Warm in-memory cache from disk so POS/Products can render instantly on cold start. */
export async function hydrateCatalogFromDisk(queryClient: QueryClient, userId: string) {
  const cached = await readCatalogCache(userId);
  if (cached?.length) {
    queryClient.setQueryData(productsQueryKey(userId), cached);
  }
  return cached;
}

/** Warm dashboard stats from disk so home screen renders instantly on startup or offline. */
export async function hydrateDashboardFromDisk(queryClient: QueryClient, userId: string) {
  const cached = await readDashboardCache(userId);
  if (cached) {
    queryClient.setQueryData(['reports', 'dashboard'], cached);
  }
  return cached;
}

export function prefetchSettings(queryClient: QueryClient) {
  return queryClient.prefetchQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const settings = await settingsApi.getSettings();
      if (settings) {
        let resolvedSettings = settings;
        if (settings.businessLogoURL) {
          const resolved = await resolveBusinessLogoUri(settings.businessLogoURL);
          resolvedSettings = { ...settings, businessLogoURL: resolved };
        }
        setCachedSettings(resolvedSettings);
        await setStoredSettings(resolvedSettings);
        return resolvedSettings;
      }
      return null;
    },
    staleTime: 1000 * 60 * 5,
  });
}

export function prefetchProductCatalog(queryClient: QueryClient, userId: string) {
  return queryClient.prefetchQuery({
    queryKey: productsQueryKey(userId),
    queryFn: async () => {
      const list = await productsApi.getCatalog();
      await writeCatalogCache(userId, list);
      return list;
    },
    staleTime: 1000 * 60 * 5,
  });
}

export async function hydrateAndPrefetchAppData(queryClient: QueryClient, userId: string) {
  await Promise.allSettled([
    hydrateSettingsFromDisk(queryClient),
    hydrateCatalogFromDisk(queryClient, userId),
    hydrateDashboardFromDisk(queryClient, userId),
  ]);

  // Disk data is enough to paint the first screen. Wait until that first
  // interaction has settled before competing for radio/CPU with five requests.
  setTimeout(() => {
    Promise.allSettled([
      prefetchSettings(queryClient),
      prefetchProductCatalog(queryClient, userId),
      queryClient.prefetchQuery({
        queryKey: ['reports', 'dashboard'],
        queryFn: async () => {
          const stats = await reportsApi.getDashboardStats();
          if (stats) {
            await writeDashboardCache(userId, stats);
          }
          return stats;
        },
        staleTime: 1000 * 60,
      }),
      queryClient.prefetchQuery({
        queryKey: ['categories', userId],
        queryFn: productsApi.getCategories,
        staleTime: 1000 * 60 * 5,
      }),
      queryClient.prefetchQuery({
        queryKey: ['reports', 'trend', 'month'],
        queryFn: () => reportsApi.getRevenueTrend('month'),
        staleTime: 1000 * 60,
      }),
    ]).catch(() => undefined);
  }, 650);
}
