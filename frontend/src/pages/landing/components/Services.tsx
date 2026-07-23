import { useRef, type MouseEvent } from 'react'
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion'
import {
  Boxes,
  ScanBarcode,
  Receipt,
  Users,
  BarChart3,
  Printer,
  type LucideIcon,
} from 'lucide-react'
import { RevealOnScroll } from './RevealOnScroll'

interface ServiceItem {
  icon: LucideIcon
  title: string
  description: string
}

const SERVICES: ServiceItem[] = [
  {
    icon: Boxes,
    title: 'Inventory Management',
    description: 'Track stock across categories and warehouses in real time, with low-stock alerts built in.',
  },
  {
    icon: Receipt,
    title: 'Point of Sale',
    description: 'A fast, offline-friendly POS and POS-Lite counter built for high-volume checkout days.',
  },
  {
    icon: Printer,
    title: 'Bluetooth Label Printing',
    description: 'Design and print TSPL labels straight from the browser to Dev & Veer printers — no drivers.',
  },
  {
    icon: ScanBarcode,
    title: 'Barcode Scanning',
    description: 'Scan-to-sell and scan-to-restock with instant barcode lookups baked into every workflow.',
  },
  {
    icon: Users,
    title: 'Multi-Store & Team Access',
    description: 'Role-based permissions for admins and staff, across as many stores as you can open.',
  },
  {
    icon: BarChart3,
    title: 'Reports & Analytics',
    description: 'Profit & loss, tax and sales reports generated automatically — no spreadsheets required.',
  },
]

const ServiceCard = ({ item, index }: { item: ServiceItem; index: number }) => {
  const cardRef = useRef<HTMLDivElement>(null)
  const mx = useMotionValue(0)
  const my = useMotionValue(0)
  const rotateX = useSpring(useTransform(my, [-0.5, 0.5], [8, -8]), { stiffness: 200, damping: 20 })
  const rotateY = useSpring(useTransform(mx, [-0.5, 0.5], [-8, 8]), { stiffness: 200, damping: 20 })

  const handleMove = (e: MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    mx.set((e.clientX - rect.left) / rect.width - 0.5)
    my.set((e.clientY - rect.top) / rect.height - 0.5)
  }
  const handleLeave = () => {
    mx.set(0)
    my.set(0)
  }

  const Icon = item.icon

  return (
    <RevealOnScroll direction="up" delay={index * 0.08}>
      <motion.div
        ref={cardRef}
        onMouseMove={handleMove}
        onMouseLeave={handleLeave}
        style={{ rotateX, rotateY, transformStyle: 'preserve-3d', perspective: 800 }}
        className="group relative h-full rounded-2xl border border-slate-200 bg-white p-7 shadow-sm hover:shadow-xl transition-shadow duration-300"
      >
        <div
          style={{ transform: 'translateZ(40px)' }}
          className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-600 to-sky-400 flex items-center justify-center text-white mb-5 shadow-lg shadow-blue-500/20 group-hover:scale-110 transition-transform duration-300"
        >
          <Icon size={22} />
        </div>
        <h3 style={{ transform: 'translateZ(30px)' }} className="text-lg font-semibold text-slate-900 mb-2">
          {item.title}
        </h3>
        <p style={{ transform: 'translateZ(20px)' }} className="text-sm text-slate-500 leading-relaxed">
          {item.description}
        </p>
      </motion.div>
    </RevealOnScroll>
  )
}

export const Services = () => {
  return (
    <section id="services" className="relative bg-slate-50 py-24 px-4 sm:px-6">
      <div className="max-w-6xl mx-auto">
        <RevealOnScroll className="text-center max-w-2xl mx-auto mb-16">
          <span className="text-xs font-semibold uppercase tracking-widest text-blue-600">What You Get</span>
          <h2 className="mt-3 text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight">
            Everything your business needs, in one place
          </h2>
          <p className="mt-4 text-slate-500 text-base leading-relaxed">
            No add-ons, no upsells. Every core module ships free with your account.
          </p>
        </RevealOnScroll>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {SERVICES.map((item, i) => (
            <ServiceCard key={item.title} item={item} index={i} />
          ))}
        </div>
      </div>
    </section>
  )
}
