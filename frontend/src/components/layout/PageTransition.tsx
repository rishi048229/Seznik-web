import { Outlet, useLocation } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'

export const PageTransition = () => {
  const location = useLocation()
  const reduceMotion = useReducedMotion()

  return (
    <motion.div
      key={location.pathname}
      className="page-shell min-w-0 max-w-full"
      initial={reduceMotion ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
    >
      <Outlet />
    </motion.div>
  )
}
