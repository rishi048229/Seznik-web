import { Card } from '@/components/ui/Card'
import { clsx } from 'clsx'

interface StatsCardProps {
  title: string
  value: string | number
  icon?: React.ReactNode
  trend?: 'up' | 'down'
  trendValue?: string
  className?: string
}

export const StatsCard = ({ title, value, icon, trend, trendValue, className }: StatsCardProps) => {
  return (
    <Card className={clsx('p-6', className)}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">{title}</p>
          <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">{value}</p>
          {trend && trendValue && (
            <p
              className={clsx(
                'mt-1 text-sm',
                trend === 'up' ? 'text-green-600' : 'text-red-600'
              )}
            >
              {trend === 'up' ? '↑' : '↓'} {trendValue}
            </p>
          )}
        </div>
        {icon && <div className="text-gray-400 dark:text-gray-500">{icon}</div>}
      </div>
    </Card>
  )
}
