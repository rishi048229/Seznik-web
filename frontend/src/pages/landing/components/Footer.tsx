import { useNavigate } from 'react-router-dom'
import { ROUTES } from '@/constants/routes'

// lucide-react doesn't ship brand/social marks — small inline glyphs instead.
const XIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M18.9 2H22l-7.6 8.7L23 22h-6.9l-5.4-6.6L4.5 22H1.4l8.1-9.3L1 2h7l4.9 6z"/></svg>
)
const InstagramIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1"/></svg>
)
const FacebookIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M13.5 21v-8h2.7l.4-3.2h-3.1V7.7c0-.9.3-1.6 1.6-1.6h1.7V3.2C16.5 3.1 15.5 3 14.3 3c-2.5 0-4.2 1.5-4.2 4.3v2.5H7.4v3.2h2.7v8z"/></svg>
)
const LinkedinIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M6.94 5a2 2 0 1 1-4-.02 2 2 0 0 1 4 .02M7 8.48H3V21h4zM20.34 21h-.02v-6.8c0-1.63-.35-2.88-2.25-2.88a1.98 1.98 0 0 0-1.79 1.22 2.5 2.5 0 0 0-.1.88V21h-4s.05-11.3 0-12.52h4v1.78a3.94 3.94 0 0 1 3.58-2c2.6 0 4.58 1.7 4.58 5.36z"/></svg>
)

const COLUMNS = [
  {
    heading: 'Product',
    links: ['Services', 'Overview', 'Printers', 'How It Works', 'Pricing'],
  },
  {
    heading: 'Company',
    links: ['About Us', 'Careers', 'Blog', 'Contact'],
  },
  {
    heading: 'Resources',
    links: ['Help Center', 'Documentation', 'Community', 'Status'],
  },
  {
    heading: 'Legal',
    links: ['Privacy Policy', 'Terms of Service', 'Security'],
  },
]

const SOCIALS = [
  { icon: XIcon, label: 'Twitter' },
  { icon: InstagramIcon, label: 'Instagram' },
  { icon: FacebookIcon, label: 'Facebook' },
  { icon: LinkedinIcon, label: 'LinkedIn' },
]

export const Footer = () => {
  const navigate = useNavigate()

  return (
    <footer className="relative bg-[#05051a] pt-20 pb-10 px-4 sm:px-6 border-t border-white/5">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-10">
          <div className="col-span-2 lg:col-span-2">
            <button onClick={() => navigate(ROUTES.LANDING)}>
              <img src="/seznik_white_logo.png" alt="Seznik" className="h-8 w-auto object-contain" />
            </button>
            <p className="mt-4 text-sm text-slate-400 leading-relaxed max-w-xs">
              Inventory, POS and Bluetooth label printing — bundled free for growing businesses.
            </p>
            <div className="flex items-center gap-3 mt-6">
              {SOCIALS.map((social) => {
                const Icon = social.icon
                return (
                  <a
                    key={social.label}
                    href="#"
                    aria-label={social.label}
                    className="w-9 h-9 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                  >
                    <Icon />
                  </a>
                )
              })}
            </div>
          </div>

          {COLUMNS.map((col) => (
            <div key={col.heading}>
              <h4 className="text-xs font-semibold uppercase tracking-widest text-slate-300 mb-4">{col.heading}</h4>
              <ul className="space-y-2.5">
                {col.links.map((link) => (
                  <li key={link}>
                    <a href="#" className="text-sm text-slate-500 hover:text-white transition-colors">
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-16 pt-8 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-slate-500">© 2026 Seznik POS. All rights reserved.</p>
          <p className="text-xs text-slate-500">Built for businesses who'd rather sell than fight software.</p>
        </div>
      </div>
    </footer>
  )
}
