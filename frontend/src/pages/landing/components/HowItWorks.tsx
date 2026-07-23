import { useRef } from 'react'
import { motion, useScroll, useTransform } from 'framer-motion'
import { UserPlus, PackagePlus, Bluetooth, Sparkles } from 'lucide-react'
import { RevealOnScroll } from './RevealOnScroll'

const STEPS = [
  {
    icon: UserPlus,
    title: 'Create your account',
    description: 'Sign up free, verify your email, and pick admin or staff access in under a minute.',
  },
  {
    icon: PackagePlus,
    title: 'Add your products',
    description: 'Import via Excel or add items one by one — categories, pricing and stock all in one form.',
  },
  {
    icon: Bluetooth,
    title: 'Connect your printer',
    description: 'Pair a Dev or Veer printer over Bluetooth, no drivers, and design your first label.',
  },
  {
    icon: Sparkles,
    title: 'Start selling',
    description: 'Open the POS, scan a barcode, and print the receipt. That’s the whole workflow.',
  },
]

export const HowItWorks = () => {
  const containerRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: containerRef, offset: ['start 80%', 'end 60%'] })
  const lineScale = useTransform(scrollYProgress, [0, 1], [0, 1])

  return (
    <section id="how-it-works" className="relative bg-white py-24 px-4 sm:px-6">
      <div className="max-w-6xl mx-auto">
        <RevealOnScroll className="text-center max-w-2xl mx-auto mb-20">
          <span className="text-xs font-semibold uppercase tracking-widest text-blue-600">How It Works</span>
          <h2 className="mt-3 text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight">
            From setup to sale in minutes
          </h2>
        </RevealOnScroll>

        <div ref={containerRef} className="relative">
          {/* connecting line, draws in on scroll */}
          <div className="hidden lg:block absolute top-8 left-[12.5%] right-[12.5%] h-0.5 bg-slate-200">
            <motion.div
              style={{ scaleX: lineScale }}
              className="h-full origin-left bg-gradient-to-r from-blue-600 to-sky-400"
            />
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-10 lg:gap-6">
            {STEPS.map((step, i) => {
              const Icon = step.icon
              return (
                <RevealOnScroll key={step.title} direction="up" delay={i * 0.12}>
                  <div className="text-center">
                    <div className="relative w-16 h-16 mx-auto rounded-full bg-gradient-to-br from-blue-600 to-sky-400 flex items-center justify-center text-white shadow-lg shadow-blue-500/25 z-10">
                      <Icon size={24} />
                      <span className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-white border-2 border-blue-600 text-blue-600 text-xs font-bold flex items-center justify-center">
                        {i + 1}
                      </span>
                    </div>
                    <h3 className="mt-5 text-base font-semibold text-slate-900">{step.title}</h3>
                    <p className="mt-2 text-sm text-slate-500 leading-relaxed max-w-[220px] mx-auto">
                      {step.description}
                    </p>
                  </div>
                </RevealOnScroll>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}
