import { type MouseEvent } from 'react'

import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion'
import { Bluetooth, BatteryFull, Zap, Ruler } from 'lucide-react'
import devPrinter from '@/assets/Dev.png'
import veerPrinter from '@/assets/veer.png'
import { RevealOnScroll } from './RevealOnScroll'
import { PrinterRollScene3D } from './PrinterRollScene3D'

interface PrinterInfo {
  name: string
  image: string
  tagline: string
  specs: { icon: typeof Bluetooth; label: string }[]
  accent: string
}

const PRINTERS: PrinterInfo[] = [
  {
    name: 'Seznik Dev',
    image: devPrinter,
    tagline: 'Compact daily-driver for counters and pop-ups.',
    specs: [
      { icon: Bluetooth, label: 'Bluetooth Low Energy pairing' },
      { icon: BatteryFull, label: 'All-day rechargeable battery' },
      { icon: Zap, label: 'High-speed thermal printing' },
      { icon: Ruler, label: '58mm receipt & label rolls' },
    ],
    accent: 'from-blue-600 to-sky-400',
  },
  {
    name: 'Seznik Veer',
    image: veerPrinter,
    tagline: 'Rugged build for high-volume, on-the-go printing.',
    specs: [
      { icon: Bluetooth, label: 'Web Bluetooth ready — zero drivers' },
      { icon: BatteryFull, label: 'Extended capacity battery pack' },
      { icon: Zap, label: 'TSPL label designer built-in' },
      { icon: Ruler, label: '80mm wide-format support' },
    ],
    accent: 'from-sky-400 to-blue-600',
  },
]

// Printer image floats free of any card/box — mouse-tilt plus a 3D flip-in entrance as it scrolls into view.
const FloatingPrinterImage = ({ printer, side }: { printer: PrinterInfo; side: 'left' | 'right' }) => {
  const mx = useMotionValue(0)
  const my = useMotionValue(0)
  const tiltX = useSpring(useTransform(my, [-0.5, 0.5], [12, -12]), { stiffness: 160, damping: 18 })
  const tiltY = useSpring(useTransform(mx, [-0.5, 0.5], [-12, 12]), { stiffness: 160, damping: 18 })

  const handleMove = (e: MouseEvent<HTMLDivElement>) => {
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
      style={{ perspective: 1200 }}
      className="relative flex items-center justify-center"
      initial={{ opacity: 0, x: side === 'left' ? -160 : 160, rotateY: side === 'left' ? -50 : 50, scale: 0.8 }}
      whileInView={{ opacity: 1, x: 0, rotateY: 0, scale: 1 }}
      viewport={{ once: true, amount: 0.4 }}
      transition={{ type: 'spring', stiffness: 70, damping: 16, mass: 0.9 }}
    >
      <motion.div
        style={{ rotateX: tiltX, rotateY: tiltY, transformStyle: 'preserve-3d' }}
        animate={{ y: [0, -14, 0] }}
        transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
        className="relative"
      >
        <div
          className={`absolute inset-0 rounded-full blur-[70px] opacity-30 bg-gradient-to-br ${printer.accent}`}
        />
        <img
          src={printer.image}
          alt={printer.name}
          draggable={false}
          className="relative z-10 w-56 sm:w-64 lg:w-72 h-auto object-contain drop-shadow-[0_35px_35px_rgba(15,23,42,0.35)] select-none"
        />
      </motion.div>
    </motion.div>
  )
}

const PrinterRow = ({ printer, index }: { printer: PrinterInfo; index: number }) => {
  const side: 'left' | 'right' = index % 2 === 0 ? 'left' : 'right'
  const textSide = side === 'left' ? 'right' : 'left'

  return (
    <div
      className={`grid lg:grid-cols-2 gap-10 lg:gap-16 items-center ${
        side === 'right' ? 'lg:[&>*:first-child]:order-2' : ''
      }`}
    >
      <FloatingPrinterImage printer={printer} side={side} />

      <RevealOnScroll direction={textSide} delay={0.1}>
        <div className="flex items-center gap-3 mb-3">
          <span className="text-[11px] font-semibold uppercase tracking-widest text-blue-600">
            Bluetooth Thermal Printer
          </span>
          <span className="text-[10px] font-medium text-slate-400">360° view coming soon</span>
        </div>
        <h3 className="text-3xl font-bold text-slate-900">{printer.name}</h3>
        <p className="mt-2 text-sm text-slate-500">{printer.tagline}</p>

        <ul className="mt-6 space-y-3.5">
          {printer.specs.map((spec) => {
            const Icon = spec.icon
            return (
              <li key={spec.label} className="flex items-center gap-3 text-sm text-slate-700">
                <span className={`w-8 h-8 shrink-0 rounded-full bg-gradient-to-br ${printer.accent} flex items-center justify-center text-white`}>
                  <Icon size={14} />
                </span>
                {spec.label}
              </li>
            )
          })}
        </ul>
      </RevealOnScroll>
    </div>
  )
}

export const PrintersShowcase = () => {
  return (
    <section id="printers" className="relative bg-slate-50 py-24 px-4 sm:px-6 overflow-hidden">
      <div className="max-w-6xl mx-auto">
        <RevealOnScroll className="text-center max-w-2xl mx-auto mb-6">
          <span className="text-xs font-semibold uppercase tracking-widest text-blue-600">Hardware, Included</span>
          <h2 className="mt-3 text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight">
            Meet Dev & Veer
          </h2>
          <p className="mt-4 text-slate-500">
            Purpose-built Bluetooth printers that pair directly with your Seznik dashboard.
          </p>
        </RevealOnScroll>

        <PrinterRollScene3D className="w-28 h-28 mx-auto -mb-2" />

        <div className="mt-10 space-y-24">
          {PRINTERS.map((printer, i) => (
            <PrinterRow key={printer.name} printer={printer} index={i} />
          ))}
        </div>
      </div>
    </section>
  )
}
