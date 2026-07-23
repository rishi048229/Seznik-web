import { motion, useScroll, useSpring } from 'framer-motion'

export const ScrollProgressBar = () => {
  const { scrollYProgress } = useScroll()
  const scaleX = useSpring(scrollYProgress, { stiffness: 120, damping: 25, restDelta: 0.001 })

  return (
    <motion.div
      className="fixed top-0 left-0 right-0 h-1 origin-left z-[60] bg-gradient-to-r from-blue-600 via-sky-400 to-blue-600"
      style={{ scaleX }}
    />
  )
}
