interface ScanReadyIndicatorProps {
  isActive: boolean
  label?: string
}

export const ScanReadyIndicator = ({ isActive, label = 'Scan Ready' }: ScanReadyIndicatorProps) => {
  return (
    <div className="flex items-center gap-2">
      <span className="relative flex h-3 w-3">
        {isActive && (
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
        )}
        <span
          className={`relative inline-flex rounded-full h-3 w-3 transition-colors ${
            isActive ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-600'
          }`}
        />
      </span>
      <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</span>
    </div>
  )
}
