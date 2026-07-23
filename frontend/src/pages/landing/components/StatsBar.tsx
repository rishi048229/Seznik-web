import { useEffect, useRef, useState } from 'react'
import { motion, useInView, animate } from 'framer-motion'

interface Stat {
  value: number
  suffix: string
  label: string
}

const STATS: Stat[] = [
  { value: 0, suffix: '₹', label: 'Setup & Platform Fees' },
  { value: 500, suffix: '+', label: 'Stores Onboarded' },
  { value: 50000, suffix: '+', label: 'Receipts Printed / mo' },
  { value: 24, suffix: '/7', label: 'Support Availability' },
]

const Counter = ({ value, suffix }: { value: number; suffix: string }) => {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, amount: 0.6 })
  const [display, setDisplay] = useState(suffix === '₹' ? value : 0)

  useEffect(() => {
    if (!inView) return
    const controls = animate(suffix === '₹' ? value : 0, value, {
      duration: 1.6,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => setDisplay(Math.round(v)),
    })
    return () => controls.stop()
  }, [inView, value, suffix])

  return (
    <span ref={ref}>
      {suffix === '₹' ? '₹0' : `${display.toLocaleString()}${suffix}`}
    </span>
  )
}

export const StatsBar = () => {
  return (
    <section id="stats" className="relative bg-[#0a0a2e] py-14 border-t border-white/5">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 grid grid-cols-2 lg:grid-cols-4 gap-8">
        {STATS.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.5 }}
            transition={{ duration: 0.5, delay: i * 0.1 }}
            className="text-center"
          >
            <div className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-blue-400 to-sky-300 bg-clip-text text-transparent">
              <Counter value={stat.value} suffix={stat.suffix} />
            </div>
            <p className="mt-2 text-xs sm:text-sm text-slate-400 font-medium">{stat.label}</p>
          </motion.div>
        ))}
      </div>
    </section>
  )
}
