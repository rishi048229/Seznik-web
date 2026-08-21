import { useQuery, useQueryClient } from '@tanstack/react-query';
import { reportsApi } from '@/api/reports';

export function useDashboard() {
  const queryClient = useQueryClient();

  const dashboardQuery = useQuery({
    queryKey: ['reports', 'dashboard'],
    queryFn: reportsApi.getDashboardStats,
    staleTime: 1000 * 10,
    retry: 2,
  });

  const paymentModesQuery = useQuery({
    queryKey: ['reports', 'paymentModes'],
    queryFn: reportsApi.getPaymentModeBreakdown,
    staleTime: 1000 * 15,
  });

  const expenseQuery = useQuery({
    queryKey: ['reports', 'expenseSummary'],
    queryFn: reportsApi.getExpenseSummary,
    staleTime: 1000 * 15,
  });

  const topCustomersQuery = useQuery({
    queryKey: ['reports', 'topCustomers'],
    queryFn: () => reportsApi.getTopCustomers(5),
    staleTime: 1000 * 60 * 5,
  });

  const refetchAll = () => {
    dashboardQuery.refetch();
    paymentModesQuery.refetch();
    expenseQuery.refetch();
    topCustomersQuery.refetch();
    queryClient.invalidateQueries({ queryKey: ['reports', 'trend'] });
  };

  return {
    stats: dashboardQuery.data || {
      todayRevenue: 0,
      todayInvoices: 0,
      todayGrossProfit: 0,
      totalCustomers: 0,
      totalStockValue: 0,
      lowStockCount: 0,
      lowStockProducts: [],
      recentSales: [],
    },
    paymentModes: paymentModesQuery.data?.modes || [],
    expenseSummary: expenseQuery.data || { today: 0, thisMonth: 0, collectionsNonCredit: 0, net: 0 },
    topCustomers: topCustomersQuery.data || [],
    isLoading: !dashboardQuery.data && dashboardQuery.isLoading,
    isRefetching: dashboardQuery.isRefetching || paymentModesQuery.isRefetching,
    isError: dashboardQuery.isError,
    refetch: refetchAll,
  };
}

/** Drives the dashboard's Revenue Trend chart — real data bucketed by day/week/month from the backend. */
export function useRevenueTrend(period: 'daily' | 'weekly' | 'monthly') {
  const trendQuery = useQuery({
    queryKey: ['reports', 'trend', period],
    queryFn: () => reportsApi.getRevenueTrend(period),
    staleTime: 1000 * 15,
    retry: 2,
  });

  return {
    trend: trendQuery.data || { labels: [], revenue: [], profit: [] },
    isLoading: trendQuery.isLoading,
    refetch: trendQuery.refetch,
  };
}
