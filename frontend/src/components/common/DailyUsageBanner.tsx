import { useQuery } from '@tanstack/react-query'
import { AlertTriangle } from 'lucide-react'
import { fetchApi } from '@/services/api'

type DailyUsageResponse = {
  success: boolean
  usage: {
    salesToday: number
    salesLimit: number
    salesRemaining: number
  }
  saleLimitMessage: string | null
}

export function DailyUsageBanner({ className = '' }: { className?: string }) {
  const { data } = useQuery({
    queryKey: ['daily-usage'],
    queryFn: () => fetchApi<DailyUsageResponse>('/reports/daily-usage'),
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  })

  const message = data?.saleLimitMessage
  if (!message) return null

  const atLimit = (data?.usage.salesRemaining ?? 1) <= 0

  return (
    <div
      className={`flex items-start gap-2 rounded-xl border px-3 py-2.5 text-xs ${
        atLimit
          ? 'border-red-200 bg-red-50 text-red-900 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-100'
          : 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100'
      } ${className}`}
      role="status"
    >
      <AlertTriangle size={16} className="shrink-0 mt-0.5" />
      <span>{message}</span>
    </div>
  )
}
