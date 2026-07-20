import { clsx } from 'clsx'

interface StatusBadgeProps {
  status: 'active' | 'inactive' | 'low' | 'out' | 'paid' | 'pending' | 'credit'
  label?: string
}

const statusConfig: Record<StatusBadgeProps['status'], { bg: string; text: string; label: string }> = {
  active: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-800 dark:text-green-300', label: 'Active' },
  inactive: { bg: 'bg-gray-100 dark:bg-gray-700', text: 'text-gray-800 dark:text-gray-300', label: 'Inactive' },
  low: { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-800 dark:text-yellow-300', label: 'Low Stock' },
  out: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-800 dark:text-red-300', label: 'Out of Stock' },
  paid: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-800 dark:text-green-300', label: 'Paid' },
  pending: { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-800 dark:text-yellow-300', label: 'Pending' },
  credit: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-800 dark:text-blue-300', label: 'Credit' },
}

export const StatusBadge = ({ status, label }: StatusBadgeProps) => {
  const config = statusConfig[status]
  return (
    <span className={clsx('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium', config.bg, config.text)}>
      {label ?? config.label}
    </span>
  )
}
