import React from 'react'
import type { BusinessType } from '@/constants/businessTypes'

interface BusinessTypeIconProps {
  type: BusinessType
  selected?: boolean
  size?: number
  className?: string
  showContainer?: boolean
}

export const BusinessTypeIcon: React.FC<BusinessTypeIconProps> = ({
  type,
  selected = false,
  size = 24,
  className = '',
  showContainer = true,
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
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="shrink-0"
          >
            {/* Dining Cutlery & Cloche / Plate */}
            <path d="M18 2v6a3 3 0 0 1-3 3 3 3 0 0 1-3-3V2" />
            <path d="M15 2v6" />
            <path d="M15 11v11" />
            <path d="M5 2v8a3 3 0 0 0 3 3h1v9" />
            <path d="M5 2c2 0 4 1.8 4 4.5V10" />
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
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="shrink-0"
          >
            {/* E-Commerce Shopping Bag with Digital Sparkle */}
            <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
            <path d="M3 6h18" />
            <path d="M16 10a4 4 0 0 1-8 0" />
            <circle cx="12" cy="15" r="1.5" fill="currentColor" stroke="none" />
            <path d="M9.5 15h-.5m6 0h-.5" />
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
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="shrink-0"
          >
            {/* Retail Storefront with Awning & Door */}
            <path d="M3 9 5 3h14l2 6" />
            <path d="M3 9a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9Z" />
            <path d="M10 21v-5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v5" />
          </svg>
        )
    }
  }

  if (!showContainer) {
    return <span className={`inline-flex items-center justify-center ${className}`}>{renderSvg()}</span>
  }

  return (
    <div
      className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all shrink-0 ${
        selected
          ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25 ring-2 ring-blue-500/30'
          : 'bg-slate-100 dark:bg-dark-elevated text-slate-700 dark:text-gray-300 border border-slate-200 dark:border-dark-border'
      } ${className}`}
    >
      {renderSvg()}
    </div>
  )
}
