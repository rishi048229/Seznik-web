import { type CSSProperties, type HTMLAttributes, type ReactNode, useMemo } from 'react'
import { useLocation } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

function cn(...inputs: (string | undefined | false | null)[]): string {
  return twMerge(clsx(inputs))
}

interface CardProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onDrag' | 'onDragStart' | 'onDragEnd' | 'onAnimationStart'> {
  children: ReactNode
  className?: string
  onClick?: () => void
}

let delayPath = ''
let delayIndex = 0

const nextCardEnterDelay = (pathname: string) => {
  if (pathname !== delayPath) {
    delayPath = pathname
    delayIndex = 0
  }
  const delay = Math.min(delayIndex, 8) * 0.05
  delayIndex += 1
  return delay
}

export const Card = ({ children, className, onClick, style, ...rest }: CardProps) => {
  const { pathname } = useLocation()
  const reduceMotion = useReducedMotion()
  const delay = useMemo(() => nextCardEnterDelay(pathname), [pathname])
  const mergedStyle = {
    ...style,
    ...(reduceMotion ? undefined : { animationDelay: `${delay}s` }),
  } as CSSProperties

  return (
    <motion.div
      {...rest}
      style={mergedStyle}
      onClick={onClick}
      whileHover={
        reduceMotion
          ? undefined
          : {
              y: onClick ? -4 : -2,
              boxShadow: '0 12px 28px -16px rgba(15, 23, 42, 0.22)',
            }
      }
      transition={{ type: 'spring', stiffness: 420, damping: 30 }}
      className={cn(
        'ui-card bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 transition-[transform,box-shadow] duration-300 ease-out',
        onClick && 'cursor-pointer',
        className
      )}
    >
      {children}
    </motion.div>
  )
}
