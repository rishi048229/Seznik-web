import { useNavigate } from 'react-router-dom'
import { Check, X, ArrowRight } from 'lucide-react'
import { ROUTES } from '@/constants/routes'
import { RevealOnScroll } from './RevealOnScroll'
import { CapsuleButton } from './CapsuleButton'

const ROWS = [
  'Unlimited products & categories',
  'Multi-user & role-based access',
  'Bluetooth label printing',
  'Barcode scanning',
  'Profit, loss & tax reports',
  'Multi-store management',
  'Priority customer support',
  'Cloud backup & sync',
]

export const FreeFeatures = () => {
  const navigate = useNavigate()

  return (
    <section className="relative bg-[#0a0a2e] py-24 px-4 sm:px-6 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_100%,rgba(37,99,235,0.25),transparent)]" />
      <div className="relative max-w-5xl mx-auto">
        <RevealOnScroll className="text-center max-w-2xl mx-auto mb-14">
          <span className="text-xs font-semibold uppercase tracking-widest text-sky-300">Pricing, Reimagined</span>
          <h2 className="mt-3 text-3xl sm:text-4xl font-bold text-white tracking-tight">
            What others charge extra for, we give free
          </h2>
          <p className="mt-4 text-slate-300/90">
            Every feature below is bundled into your Seznik account at no cost — no tiers, no paywalls.
          </p>
        </RevealOnScroll>

        <RevealOnScroll delay={0.15}>
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-sm overflow-hidden">
            <div className="grid grid-cols-3 text-center border-b border-white/10 bg-white/[0.04]">
              <div className="py-5 text-left pl-6 text-sm font-semibold text-slate-300">Feature</div>
              <div className="py-5 text-sm font-semibold text-slate-400">Other Platforms</div>
              <div className="py-5 text-sm font-semibold text-sky-300">Seznik POS</div>
            </div>
            {ROWS.map((row, i) => (
              <div
                key={row}
                className={`grid grid-cols-3 text-center items-center ${
                  i !== ROWS.length - 1 ? 'border-b border-white/5' : ''
                }`}
              >
                <div className="py-4 text-left pl-6 text-sm text-slate-200">{row}</div>
                <div className="py-4 flex justify-center">
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-red-300/90 bg-red-500/10 px-3 py-1 rounded-full">
                    <X size={13} /> Paid add-on
                  </span>
                </div>
                <div className="py-4 flex justify-center">
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-300 bg-emerald-500/10 px-3 py-1 rounded-full">
                    <Check size={13} /> Included
                  </span>
                </div>
              </div>
            ))}
          </div>
        </RevealOnScroll>

        <RevealOnScroll delay={0.25} className="mt-12 text-center">
          <CapsuleButton
            variant="primary"
            size="lg"
            rightIcon={<ArrowRight size={18} />}
            onClick={() => navigate(ROUTES.LOGIN)}
          >
            Start Free — No Credit Card Needed
          </CapsuleButton>
        </RevealOnScroll>
      </div>
    </section>
  )
}
