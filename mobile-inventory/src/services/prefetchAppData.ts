import { QueryClient } from '@tanstack/react-query';
import { productsApi } from '@/api/products';
import { reportsApi } from '@/api/reports';
import { readCatalogCache, writeCatalogCache } from '@/services/catalogCache';
import { readDashboardCache, writeDashboardCache } from '@/services/dashboardCache';

export const PRODUCTS_QUERY_KEY = 'products';

export function productsQueryKey(userId: string) {
  return [PRODUCTS_QUERY_KEY, userId] as const;
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
    hydrateCatalogFromDisk(queryClient, userId),
    hydrateDashboardFromDisk(queryClient, userId),
  ]);

  await Promise.allSettled([
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
  ]);
}
