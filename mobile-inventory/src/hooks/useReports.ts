import { useQuery } from '@tanstack/react-query';
import { reportsApi } from '@/api/reports';

export function useReports(period: 'today' | '7days' | '30days' | 'year' = '30days', customStart?: string, customEnd?: string) {
  // Compute start/end dates
  const now = new Date();
  let startDate: string | undefined = customStart;
  let endDate: string | undefined = customEnd || now.toISOString();

  if (!customStart) {
    if (period === 'today') {
      const d = new Date(now);
      d.setHours(0, 0, 0, 0);
      startDate = d.toISOString();
    } else if (period === '7days') {
      const d = new Date(now);
      d.setDate(d.getDate() - 7);
      startDate = d.toISOString();
    } else if (period === '30days') {
      const d = new Date(now);
      d.setDate(d.getDate() - 30);
      startDate = d.toISOString();
    } else if (period === 'year') {
      const d = new Date(now.getFullYear(), 0, 1);
      startDate = d.toISOString();
    }
  }

  const salesReportQuery = useQuery({
    queryKey: ['reports', 'sales', period, startDate, endDate],
    queryFn: () => reportsApi.getSalesReport(startDate, endDate),
    staleTime: 1000 * 60 * 5,
  });

  const plReportQuery = useQuery({
    queryKey: ['reports', 'pl', period, startDate, endDate],
    queryFn: () => reportsApi.getPLReport(startDate, endDate),
    staleTime: 1000 * 60 * 5,
  });

  const taxReportQuery = useQuery({
    queryKey: ['reports', 'tax', period, startDate, endDate],
    queryFn: () => reportsApi.getTaxReport(startDate, endDate),
    staleTime: 1000 * 60 * 5,
  });

  const topProductsQuery = useQuery({
    queryKey: ['reports', 'topProducts', period, startDate, endDate],
    queryFn: () => reportsApi.getTopProducts(100, startDate, endDate),
    staleTime: 1000 * 60 * 5,
  });

  const totalSales = (salesReportQuery.data?.revenue || []).reduce((sum, val) => sum + val, 0);
  const totalInvoices = (salesReportQuery.data?.invoiceCount || []).reduce((sum, val) => sum + val, 0);
  const grossProfit = plReportQuery.data?.netProfit ?? 0;
  const totalTax = taxReportQuery.data?.totalOutputTax ?? 0;
  const totalExpenses = plReportQuery.data?.totalExpenses ?? 0;

  const data = {
    totalSales,
    grossProfit,
    totalTax,
    invoiceCount: totalInvoices,
    totalExpenses,
    salesLabels: salesReportQuery.data?.labels || [],
    salesRevenue: salesReportQuery.data?.revenue || [],
  };

  return {
    data,
    salesReport: salesReportQuery.data,
    plReport: plReportQuery.data,
    taxReport: taxReportQuery.data,
    productsReport: topProductsQuery.data || [],
    isLoading:
      (!salesReportQuery.data && salesReportQuery.isLoading) ||
      (!plReportQuery.data && plReportQuery.isLoading) ||
      (!topProductsQuery.data && topProductsQuery.isLoading),
    isRefetching:
      salesReportQuery.isRefetching || plReportQuery.isRefetching || topProductsQuery.isRefetching,
    isError:
      (salesReportQuery.isError && !salesReportQuery.data) ||
      (plReportQuery.isError && !plReportQuery.data) ||
      (topProductsQuery.isError && !topProductsQuery.data),
    refetchAll: () => {
      salesReportQuery.refetch();
      plReportQuery.refetch();
      taxReportQuery.refetch();
      topProductsQuery.refetch();
    },
  };
}
