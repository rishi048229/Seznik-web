import { type ReactNode } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { useLocation } from 'react-router-dom'

/**
 * A quick, low-distraction acknowledgement of page changes.
 */
export const PageTransition = ({ children }: { children: ReactNode }) => {
  const location = useLocation()
  const shouldReduceMotion = useReducedMotion()

  if (shouldReduceMotion) {
    return <div className="page-transition">{children}</div>
  }

  return (
    <motion.div
      key={location.pathname}
      className="page-transition"
      initial={{ opacity: 0, y: 3 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.16, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  )
}
