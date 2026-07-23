import { useNavigate } from 'react-router-dom'
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion'
import { ArrowRight, PlayCircle, ChevronDown } from 'lucide-react'
import { ROUTES } from '@/constants/routes'
import devPrinter from '@/assets/Dev.png'
import veerPrinter from '@/assets/veer.png'
import { CapsuleButton } from './CapsuleButton'
import { HeroScene3D } from './HeroScene3D'

// Mouse-driven 3D tilt for the printer product shots — perspective transform, no WebGL needed.
const TiltImage = ({
  src,
  alt,
  side,
}: {
  src: string
  alt: string
  side: 'left' | 'right'
}) => {
  const mx = useMotionValue(0)
  const my = useMotionValue(0)
  const rotateX = useSpring(useTransform(my, [-0.5, 0.5], [12, -12]), { stiffness: 150, damping: 18 })
  const rotateY = useSpring(useTransform(mx, [-0.5, 0.5], [side === 'left' ? -14 : 14, side === 'left' ? 14 : -14]), {
    stiffness: 150,
    damping: 18,
  })

  const handleMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    mx.set((e.clientX - rect.left) / rect.width - 0.5)
    my.set((e.clientY - rect.top) / rect.height - 0.5)
  }

  const handleLeave = () => {
    mx.set(0)
    my.set(0)
  }

  return (
    <motion.div
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      style={{ perspective: 900 }}
      className="relative"
      initial={{ opacity: 0, x: side === 'left' ? -60 : 60, y: 20 }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      transition={{ duration: 0.9, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
    >
      <motion.div
        style={{ rotateX, rotateY, transformStyle: 'preserve-3d' }}
        animate={{ y: [0, -16, 0] }}
        transition={{ duration: 5.5, repeat: Infinity, ease: 'easeInOut', delay: side === 'left' ? 0 : 0.6 }}
        className="relative"
      >
        <div
          className="absolute inset-0 rounded-full blur-3xl opacity-40"
          style={{ background: side === 'left' ? '#38bdf8' : '#2563eb' }}
        />
        <img
          src={src}
          alt={alt}
          draggable={false}
          className="relative w-40 sm:w-52 lg:w-64 h-auto object-contain drop-shadow-[0_30px_40px_rgba(0,0,0,0.45)] select-none"
        />
      </motion.div>
    </motion.div>
  )
}

export const Hero = () => {
  const navigate = useNavigate()

  return (
    <section className="relative min-h-[100dvh] flex flex-col overflow-hidden bg-[#05051a]">
      {/* Ambient gradient wash */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_0%,rgba(37,99,235,0.35),transparent),radial-gradient(ellipse_60%_50%_at_85%_80%,rgba(56,189,248,0.18),transparent)]" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,#05051a_0%,#0a0a2e_55%,#0a0a2e_100%)]" />

      <HeroScene3D className="absolute inset-0 pointer-events-none" />

      <div className="relative flex-1 flex items-center justify-center px-4 sm:px-6 pt-28 pb-16">
        <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-[auto_1fr_auto] items-center gap-8 lg:gap-4">
          {/* Left printer — hidden on small screens to keep copy legible, shown from md up */}
          <div className="hidden md:flex justify-center lg:justify-end order-2 lg:order-1">
            <TiltImage src={devPrinter} alt="Seznik Dev bluetooth thermal printer" side="left" />
          </div>

          {/* Center copy */}
          <div className="order-1 lg:order-2 text-center px-2">
            <motion.div
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-[11px] sm:text-xs font-semibold tracking-wide uppercase text-sky-300 bg-sky-400/10 border border-sky-400/20 mb-6"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse" />
              Everything Free. Forever.
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.1 }}
              className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-white leading-[1.08]"
            >
              Run your whole store,
              <br />
              <span className="bg-gradient-to-r from-blue-400 via-sky-300 to-blue-400 bg-clip-text text-transparent">
                print every receipt.
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.2 }}
              className="mt-6 text-base sm:text-lg text-slate-300/90 max-w-xl mx-auto leading-relaxed"
            >
              Seznik POS bundles inventory, billing, Bluetooth label printing and analytics
              into one dashboard — the features other platforms charge extra for, we give
              you free from day one.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.3 }}
              className="mt-9 flex flex-col sm:flex-row items-center justify-center gap-4"
            >
              <CapsuleButton
                variant="primary"
                size="lg"
                rightIcon={<ArrowRight size={18} />}
                onClick={() => navigate(ROUTES.LOGIN)}
              >
                Get Started Free
              </CapsuleButton>
              <CapsuleButton
                variant="outline"
                size="lg"
                leftIcon={<PlayCircle size={18} />}
                onClick={() => document.querySelector('#overview')?.scrollIntoView({ behavior: 'smooth' })}
              >
                See How It Works
              </CapsuleButton>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.7, delay: 0.5 }}
              className="mt-8 flex items-center justify-center gap-2 text-xs text-slate-400"
            >
              No credit card · No hidden fees · Set up in minutes
            </motion.div>
          </div>

          {/* Right printer */}
          <div className="hidden md:flex justify-center lg:justify-start order-3">
            <TiltImage src={veerPrinter} alt="Seznik Veer bluetooth thermal printer" side="right" />
          </div>
        </div>
      </div>

      {/* Mobile-only printer strip since side images are hidden below md */}
      <div className="md:hidden relative flex items-center justify-center gap-6 pb-10 px-6">
        <img src={devPrinter} alt="Seznik Dev printer" className="w-24 h-auto object-contain drop-shadow-2xl" />
        <img src={veerPrinter} alt="Seznik Veer printer" className="w-24 h-auto object-contain drop-shadow-2xl" />
      </div>

      <motion.button
        onClick={() => document.querySelector('#stats')?.scrollIntoView({ behavior: 'smooth' })}
        animate={{ y: [0, 8, 0] }}
        transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
        className="relative mx-auto mb-6 text-slate-400 hover:text-white transition-colors"
        aria-label="Scroll down"
      >
        <ChevronDown size={26} />
      </motion.button>
    </section>
  )
}
