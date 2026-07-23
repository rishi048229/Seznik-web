import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Menu, X } from 'lucide-react'
import { ROUTES } from '@/constants/routes'
import { CapsuleButton } from './CapsuleButton'

const NAV_LINKS = [
  { label: 'Services', href: '#services' },
  { label: 'Overview', href: '#overview' },
  { label: 'Printers', href: '#printers' },
  { label: 'How It Works', href: '#how-it-works' },
  { label: 'Reviews', href: '#reviews' },
]

export const Navbar = () => {
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const handleNavClick = (href: string) => {
    setMobileOpen(false)
    const el = document.querySelector(href)
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <motion.header
      initial={{ y: -80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
        scrolled ? 'py-3' : 'py-5'
      }`}
    >
      <div
        className={`mx-auto max-w-6xl px-4 sm:px-6 flex items-center justify-between rounded-full transition-all duration-300 ${
          scrolled
            ? 'bg-[#0a0a2e]/80 backdrop-blur-xl shadow-[0_8px_30px_-8px_rgba(0,0,0,0.4)] py-2.5 px-5 border border-white/10'
            : 'py-1'
        }`}
      >
        <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="flex items-center gap-2">
          <img src="/seznik_white_logo.png" alt="Seznik" className="h-8 w-auto object-contain" />
        </button>

        <nav className="hidden lg:flex items-center gap-1">
          {NAV_LINKS.map((link) => (
            <button
              key={link.href}
              onClick={() => handleNavClick(link.href)}
              className="px-4 py-2 text-sm font-medium text-white/70 hover:text-white transition-colors rounded-full hover:bg-white/10"
            >
              {link.label}
            </button>
          ))}
        </nav>

        <div className="hidden lg:flex items-center gap-3">
          <CapsuleButton variant="outline" size="sm" onClick={() => navigate(ROUTES.LOGIN)}>
            Log In
          </CapsuleButton>
          <CapsuleButton variant="primary" size="sm" onClick={() => navigate(ROUTES.LOGIN)}>
            Get Started Free
          </CapsuleButton>
        </div>

        <button
          className="lg:hidden text-white p-2"
          onClick={() => setMobileOpen((v) => !v)}
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            className="lg:hidden mx-4 mt-2 overflow-hidden rounded-3xl bg-[#0a0a2e]/95 backdrop-blur-xl border border-white/10 shadow-xl"
          >
            <div className="flex flex-col p-4 gap-1">
              {NAV_LINKS.map((link) => (
                <button
                  key={link.href}
                  onClick={() => handleNavClick(link.href)}
                  className="text-left px-4 py-3 text-sm font-medium text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition-colors"
                >
                  {link.label}
                </button>
              ))}
              <div className="flex gap-3 mt-2 px-2">
                <CapsuleButton variant="outline" size="sm" className="flex-1" onClick={() => navigate(ROUTES.LOGIN)}>
                  Log In
                </CapsuleButton>
                <CapsuleButton variant="primary" size="sm" className="flex-1" onClick={() => navigate(ROUTES.LOGIN)}>
                  Get Started
                </CapsuleButton>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  )
}
