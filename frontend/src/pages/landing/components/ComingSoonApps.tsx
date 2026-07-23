import { useState } from 'react'
import { motion } from 'framer-motion'
import { Apple, Smartphone, Bell, Wifi, Battery, Signal } from 'lucide-react'
import { RevealOnScroll } from './RevealOnScroll'
import { CapsuleButton } from './CapsuleButton'

export const ComingSoonApps = () => {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return
    setSubmitted(true)
  }

  return (
    <section className="relative bg-[#05051a] py-24 px-4 sm:px-6 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_20%_30%,rgba(37,99,235,0.25),transparent),radial-gradient(ellipse_50%_50%_at_85%_70%,rgba(56,189,248,0.15),transparent)]" />

      <div className="relative max-w-6xl mx-auto grid lg:grid-cols-2 gap-16 items-center">
        <RevealOnScroll direction="left">
          <span className="text-xs font-semibold uppercase tracking-widest text-sky-300">Mobile Apps</span>
          <h2 className="mt-3 text-3xl sm:text-4xl font-bold text-white tracking-tight">
            Seznik is coming to Android &amp; iOS
          </h2>
          <p className="mt-4 text-slate-300/90 leading-relaxed max-w-lg">
            Manage stock, ring up sales and print labels from your pocket. Our native apps
            are in development — leave your email and we'll let you know the moment they land.
          </p>

          <div className="mt-7 flex flex-wrap gap-3">
            <span className="inline-flex items-center gap-2 px-5 py-3 rounded-full bg-white/5 border border-white/15 text-white/60 text-sm font-medium">
              <Apple size={18} /> App Store — Coming Soon
            </span>
            <span className="inline-flex items-center gap-2 px-5 py-3 rounded-full bg-white/5 border border-white/15 text-white/60 text-sm font-medium">
              <Smartphone size={18} /> Google Play — Coming Soon
            </span>
          </div>

          <form onSubmit={handleSubmit} className="mt-8 flex flex-col sm:flex-row gap-3 max-w-md">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@business.com"
              className="flex-1 px-5 py-3 rounded-full bg-white/5 border border-white/15 text-white placeholder:text-white/40 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400/50 focus:border-sky-400/50"
            />
            <CapsuleButton type="submit" variant="primary" leftIcon={<Bell size={16} />}>
              {submitted ? 'You’re on the list' : 'Notify Me'}
            </CapsuleButton>
          </form>
          {submitted && (
            <p className="mt-3 text-xs text-emerald-300">Thanks — we'll email {email} at launch.</p>
          )}
        </RevealOnScroll>

        <RevealOnScroll direction="right" delay={0.15} className="flex justify-center">
          <motion.div
            animate={{ y: [0, -14, 0] }}
            transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' }}
            className="relative w-64 h-[26rem] rounded-[2.5rem] border-8 border-slate-800 bg-gradient-to-b from-[#0f0f3d] to-[#0a0a2e] shadow-2xl overflow-hidden"
          >
            <div className="flex items-center justify-between px-5 pt-3 text-[10px] text-white/70">
              <span>9:41</span>
              <div className="flex items-center gap-1">
                <Signal size={11} />
                <Wifi size={11} />
                <Battery size={13} />
              </div>
            </div>
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-5 bg-slate-800 rounded-b-2xl" />

            <div className="px-5 pt-8 flex flex-col items-center">
              <img src="/seznik_white_logo.png" alt="Seznik" className="h-6 w-auto object-contain mb-4" />
              <div className="w-full space-y-2">
                <div className="h-16 rounded-2xl bg-gradient-to-r from-blue-600/40 to-sky-400/30 border border-white/10" />
                <div className="grid grid-cols-2 gap-2">
                  <div className="h-20 rounded-2xl bg-white/5 border border-white/10" />
                  <div className="h-20 rounded-2xl bg-white/5 border border-white/10" />
                </div>
                <div className="h-24 rounded-2xl bg-white/5 border border-white/10" />
              </div>
            </div>

            <div className="absolute bottom-5 inset-x-5 flex items-center justify-center">
              <span className="px-4 py-2 rounded-full bg-sky-400/15 border border-sky-400/30 text-sky-300 text-[10px] font-semibold tracking-wide uppercase">
                Coming Soon
              </span>
            </div>
          </motion.div>
        </RevealOnScroll>
      </div>
    </section>
  )
}
