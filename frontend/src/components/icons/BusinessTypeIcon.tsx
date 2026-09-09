import React from 'react'
import type { BusinessType } from '@/constants/businessTypes'

interface BusinessTypeIconProps {
  type: BusinessType
  selected?: boolean
  size?: number
  className?: string
  showContainer?: boolean
  containerSize?: 'sm' | 'md' | 'lg'
}

export const BusinessTypeIcon: React.FC<BusinessTypeIconProps> = ({
  type,
  selected = false,
  size = 22,
  className = '',
  showContainer = true,
  containerSize = 'md',
}) => {
  const renderSvg = () => {
    switch (type) {
      case 'restaurant_cafe':
        return (
          <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="shrink-0"
          >
            {/* Dining cloche plate */}
            <path d="M2 19h20" strokeWidth="2" />
            {/* Cloche cover dome */}
            <path
              d="M4 16a8 8 0 0 1 16 0H4Z"
              fill="currentColor"
              fillOpacity={selected ? '0.2' : '0.12'}
              strokeWidth="1.8"
            />
            {/* Top handle */}
            <circle cx="12" cy="7" r="1.5" fill="currentColor" />
            <path d="M12 7v1" strokeWidth="2" />
            {/* Steam aroma curls */}
            <path d="M9.5 4c-.3-.7-.2-1.3.3-1.7.6-.5 1.5-.3 1.2.7" strokeWidth="1.2" strokeOpacity="0.8" />
            <path d="M14 3.5c-.3-.7-.2-1.3.3-1.7.6-.5 1.5-.3 1.2.7" strokeWidth="1.2" strokeOpacity="0.8" />
            {/* Fork & Knife silhouette in the cloche */}
            <path d="M9 13.5v-3m0 0a1 1 0 0 0-1-1m1 1a1 1 0 0 1 1-1" strokeWidth="1.3" />
            <path d="M15 9.5v4" strokeWidth="1.3" />
          </svg>
        )

      case 'online_store':
        return (
          <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="shrink-0"
          >
            {/* E-Commerce Shopping Bag */}
            <path
              d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"
              fill="currentColor"
              fillOpacity={selected ? '0.2' : '0.12'}
              strokeWidth="1.8"
            />
            <path d="M3 6h18" strokeWidth="1.8" />
            <path d="M16 10a4 4 0 0 1-8 0" strokeWidth="1.8" />
            {/* Central lightning / digital dispatch symbol */}
            <path
              d="M12.2 12.5 10.5 15h2.2l-.7 2.8 2.8-3.6h-2.1l.8-1.7h-1.3z"
              fill="currentColor"
              stroke="none"
            />
          </svg>
        )

      case 'retail_shop':
      default:
        return (
          <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="shrink-0"
          >
            {/* Retail Storefront with Awning */}
            <path
              d="M3 9 5 3h14l2 6"
              fill="currentColor"
              fillOpacity={selected ? '0.2' : '0.12'}
              strokeWidth="1.8"
            />
            <path
              d="M3 9a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9Z"
              strokeWidth="1.8"
            />
            {/* Awning stripes */}
            <line x1="9" y1="3" x2="9" y2="9" strokeWidth="1.2" strokeOpacity="0.6" />
            <line x1="15" y1="3" x2="15" y2="9" strokeWidth="1.2" strokeOpacity="0.6" />
            {/* Glass door & counter */}
            <path d="M10 21v-5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v5" strokeWidth="1.6" />
            {/* Barcode scanner lines in shop display */}
            <line x1="6" y1="13.5" x2="6" y2="16" strokeWidth="1.5" />
            <line x1="8" y1="13.5" x2="8" y2="16" strokeWidth="1" />
          </svg>
        )
    }
  }

  if (!showContainer) {
    return <span className={`inline-flex items-center justify-center ${className}`}>{renderSvg()}</span>
  }

  const containerDimensions =
    containerSize === 'sm'
      ? 'w-9 h-9 rounded-lg'
      : containerSize === 'lg'
      ? 'w-12 h-12 rounded-2xl'
      : 'w-11 h-11 rounded-xl'

  const themedBadgeStyles = () => {
    if (selected) {
      return 'bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/25 ring-2 ring-blue-500/30'
    }
    switch (type) {
      case 'restaurant_cafe':
        return 'bg-amber-500/10 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20'
      case 'online_store':
        return 'bg-indigo-500/10 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20'
      case 'retail_shop':
      default:
        return 'bg-emerald-500/10 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
    }
  }

  return (
    <div
      className={`${containerDimensions} flex items-center justify-center transition-all shrink-0 ${themedBadgeStyles()} ${className}`}
    >
      {renderSvg()}
    </div>
  )
}
