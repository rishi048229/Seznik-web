import { type ReactNode } from 'react'
import { motion, type Variants } from 'framer-motion'

interface RevealOnScrollProps {
  children: ReactNode
  className?: string
  direction?: 'up' | 'down' | 'left' | 'right' | 'none'
  delay?: number
  duration?: number
  once?: boolean
  amount?: number
}

const offset = 48

const buildVariants = (direction: RevealOnScrollProps['direction']): Variants => {
  const hidden: Record<string, number> = { opacity: 0 }
  if (direction === 'up') hidden.y = offset
  if (direction === 'down') hidden.y = -offset
  if (direction === 'left') hidden.x = offset
  if (direction === 'right') hidden.x = -offset

  return {
    hidden,
    visible: { opacity: 1, x: 0, y: 0 },
  }
}

export const RevealOnScroll = ({
  children,
  className,
  direction = 'up',
  delay = 0,
  duration = 0.7,
  once = true,
  amount = 0.25,
}: RevealOnScrollProps) => {
  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={{ once, amount }}
      variants={buildVariants(direction)}
      transition={{ duration, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  )
}
