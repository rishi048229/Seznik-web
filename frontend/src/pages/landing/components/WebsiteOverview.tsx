import { LayoutDashboard, ShoppingCart, Printer, LineChart } from 'lucide-react'
import { RevealOnScroll } from './RevealOnScroll'

interface OverviewItem {
  icon: typeof LayoutDashboard
  eyebrow: string
  title: string
  description: string
  bullets: string[]
  accent: string
}

const ITEMS: OverviewItem[] = [
  {
    icon: LayoutDashboard,
    eyebrow: 'Dashboard',
    title: 'One screen for your whole business',
    description:
      'Sales, stock levels, credits and expenses roll up into a single live dashboard — no more switching between spreadsheets.',
    bullets: ['Live revenue & profit widgets', 'Low-stock and credit alerts', 'Configurable per store'],
    accent: 'from-blue-600 to-sky-400',
  },
  {
    icon: ShoppingCart,
    eyebrow: 'Point of Sale',
    title: 'Checkout that keeps up with the queue',
    description:
      'A distraction-free POS and a POS-Lite mode for quick counters, both built to stay fast even on patchy connections.',
    bullets: ['Barcode scan-to-sell', 'Cart holds & quick discounts', 'Instant receipt printing'],
    accent: 'from-sky-400 to-blue-600',
  },
  {
    icon: Printer,
    eyebrow: 'Label Studio',
    title: 'Design labels, print in one tap',
    description:
      'A built-in TSPL label designer talks directly to your Dev or Veer printer over Bluetooth — straight from the browser.',
    bullets: ['Drag-and-drop label builder', 'Web Bluetooth, zero drivers', 'Browser-print fallback'],
    accent: 'from-blue-600 to-sky-400',
  },
  {
    icon: LineChart,
    eyebrow: 'Reports',
    title: 'Know your numbers without asking your accountant',
    description:
      'Profit & loss, tax summaries and sales trends are generated automatically from the transactions you already record.',
    bullets: ['Profit & loss breakdowns', 'Tax-ready exports', 'Sales trend charts'],
    accent: 'from-sky-400 to-blue-600',
  },
]

// Stylized "browser window" mock — stands in for real product screenshots.
const MockScreen = ({ item }: { item: OverviewItem }) => {
  const Icon = item.icon
  return (
    <div className="relative rounded-2xl bg-white border border-slate-200 shadow-xl overflow-hidden">
      <div className="flex items-center gap-1.5 px-4 py-3 border-b border-slate-100 bg-slate-50">
        <span className="w-2.5 h-2.5 rounded-full bg-red-300" />
        <span className="w-2.5 h-2.5 rounded-full bg-amber-300" />
        <span className="w-2.5 h-2.5 rounded-full bg-emerald-300" />
        <div className="ml-3 h-5 flex-1 max-w-[220px] rounded-md bg-white border border-slate-200" />
      </div>
      <div className="p-6">
        <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${item.accent} flex items-center justify-center text-white mb-4`}>
          <Icon size={18} />
        </div>
        <div className="space-y-2.5">
          <div className="h-3 rounded-full bg-slate-200 w-3/4" />
          <div className="h-3 rounded-full bg-slate-100 w-full" />
          <div className="h-3 rounded-full bg-slate-100 w-5/6" />
        </div>
        <div className="mt-5 grid grid-cols-3 gap-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
              <div className={`h-2 w-8 rounded-full bg-gradient-to-r ${item.accent} mb-2 opacity-70`} />
              <div className="h-2 w-full rounded-full bg-slate-200" />
            </div>
          ))}
        </div>
        <div className="mt-5 h-20 rounded-xl bg-gradient-to-t from-blue-50 to-transparent border border-slate-100 flex items-end gap-1.5 p-3">
          {[40, 65, 45, 80, 55, 90, 60].map((h, i) => (
            <div
              key={i}
              className={`flex-1 rounded-t-sm bg-gradient-to-t ${item.accent} opacity-70`}
              style={{ height: `${h}%` }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

export const WebsiteOverview = () => {
  return (
    <section id="overview" className="relative bg-white py-24 px-4 sm:px-6">
      <div className="max-w-6xl mx-auto">
        <RevealOnScroll className="text-center max-w-2xl mx-auto mb-20">
          <span className="text-xs font-semibold uppercase tracking-widest text-blue-600">Product Overview</span>
          <h2 className="mt-3 text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight">
            See how Seznik fits your workflow
          </h2>
        </RevealOnScroll>

        <div className="space-y-24">
          {ITEMS.map((item, i) => {
            const reversed = i % 2 === 1
            return (
              <div
                key={item.title}
                className={`grid lg:grid-cols-2 gap-10 lg:gap-16 items-center ${
                  reversed ? 'lg:[&>*:first-child]:order-2' : ''
                }`}
              >
                <RevealOnScroll direction={reversed ? 'right' : 'left'}>
                  <MockScreen item={item} />
                </RevealOnScroll>
                <RevealOnScroll direction={reversed ? 'left' : 'right'} delay={0.1}>
                  <span className="text-xs font-semibold uppercase tracking-widest text-blue-600">
                    {item.eyebrow}
                  </span>
                  <h3 className="mt-3 text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                    {item.title}
                  </h3>
                  <p className="mt-4 text-slate-500 leading-relaxed">{item.description}</p>
                  <ul className="mt-6 space-y-3">
                    {item.bullets.map((b) => (
                      <li key={b} className="flex items-center gap-3 text-sm text-slate-700">
                        <span className={`w-1.5 h-1.5 rounded-full bg-gradient-to-r ${item.accent}`} />
                        {b}
                      </li>
                    ))}
                  </ul>
                </RevealOnScroll>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
