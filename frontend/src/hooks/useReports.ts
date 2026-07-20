import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/contexts/AuthContext'
import { QUERY_KEYS } from '@/constants/queryKeys'
import * as reportService from '@/services/reportService'

export const useDashboardStats = () => {
  const { user } = useAuth()
  return useQuery({
    queryKey: [QUERY_KEYS.REPORTS_DASHBOARD, user?.uid],
    queryFn: () => reportService.getDashboardStats(user!.uid),
    enabled: !!user,
    staleTime: 1 * 60 * 1000,
  })
}

export const useRevenueTrend = (days: number) => {
  const { user } = useAuth()
  return useQuery({
    queryKey: [QUERY_KEYS.REPORTS_DASHBOARD, user?.uid, 'revenue-trend', days],
    queryFn: () => reportService.getRevenueTrend(user!.uid, days),
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  })
}

export const useTopCustomers = (limit = 10) => {
  const { user } = useAuth()
  return useQuery({
    queryKey: [QUERY_KEYS.REPORTS_DASHBOARD, user?.uid, 'top-customers', limit],
    queryFn: () => reportService.getTopCustomers(user!.uid, limit),
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  })
}

export const useSalesReport = (startDate: Date, endDate: Date) => {
  const { user } = useAuth()
  return useQuery({
    queryKey: [QUERY_KEYS.REPORTS_SALES, user?.uid, startDate.toISOString(), endDate.toISOString()],
    queryFn: () => reportService.getSalesReport(user!.uid, startDate, endDate),
    enabled: !!user,
  })
}

export const usePLReport = (startDate: Date, endDate: Date) => {
  const { user } = useAuth()
  return useQuery({
    queryKey: [QUERY_KEYS.REPORTS_PL, user?.uid, startDate.toISOString(), endDate.toISOString()],
    queryFn: () => reportService.getPLReport(user!.uid, startDate, endDate),
    enabled: !!user,
  })
}

export const useTaxReport = (startDate: Date, endDate: Date) => {
  const { user } = useAuth()
  return useQuery({
    queryKey: [QUERY_KEYS.REPORTS_TAX, user?.uid, startDate.toISOString(), endDate.toISOString()],
    queryFn: () => reportService.getTaxReport(user!.uid, startDate, endDate),
    enabled: !!user,
  })
}
