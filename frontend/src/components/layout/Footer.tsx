import { Mail, Phone, MessageCircle, ShieldCheck, Headphones, MapPin } from 'lucide-react'

export const Footer = () => {
  const seznikEmail = 'tech_support@seznik.in'
  const seznikPhone = '+91 8237869618'
  const seznikAddress = 'Office No 201, Connaught Place, Pune - 411001'
  const seznikWhatsappUrl = 'https://wa.me/8237869618?text=Hello,%20I%20have%20questions%20regarding%20Seznik%20Billing%20App'
  const currentYear = new Date().getFullYear()

  return (
    <footer className="mt-8 pt-6 border-t border-gray-200/80 dark:border-gray-800 text-xs text-gray-500 dark:text-gray-400">
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 pb-4">
        {/* Seznik App Info & Support Tagline */}
        <div className="flex flex-col items-center md:items-start gap-1 text-center md:text-left">
          <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 font-bold text-gray-900 dark:text-gray-100">
            <div className="w-5 h-5 rounded-md bg-blue-600 flex items-center justify-center text-white text-xs">
              S
            </div>
            <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              Seznik POS
            </span>
            <span className="hidden sm:inline text-gray-300 dark:text-gray-700">•</span>
            <span className="text-gray-500 dark:text-gray-400 flex items-center gap-1 font-normal text-xs">
              <Headphones className="w-3.5 h-3.5 text-blue-500" />
              Official Technical & Help Desk Support
            </span>
          </div>
          <div className="flex items-center gap-1 text-gray-400 dark:text-gray-500 text-[11px] mt-0.5">
            <MapPin className="w-3 h-3 text-red-400 shrink-0" />
            <span>{seznikAddress}</span>
          </div>
        </div>

        {/* Official Seznik Contact Action Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-2.5">
          <a
            href={`mailto:${seznikEmail}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 hover:border-blue-300 dark:hover:border-blue-600 transition-all shadow-sm"
            title="Email Seznik Support"
          >
            <Mail className="w-3.5 h-3.5 text-blue-500" />
            <span className="font-medium">{seznikEmail}</span>
          </a>

          <a
            href={`tel:${seznikPhone}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-300 dark:hover:border-indigo-600 transition-all shadow-sm"
            title="Call Seznik Helpline"
          >
            <Phone className="w-3.5 h-3.5 text-indigo-500" />
            <span className="font-medium">{seznikPhone}</span>
          </a>

          <a
            href={seznikWhatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition-all shadow-sm font-semibold"
            title="Chat with Seznik Support on WhatsApp"
          >
            <MessageCircle className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Seznik WhatsApp Support</span>
          </a>
        </div>
      </div>

      {/* Footer Copyright & Trust Badge */}
      <div className="flex flex-col sm:flex-row items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-800/60 text-[11px] text-gray-400 gap-2">
        <p>© {currentYear} Seznik POS & Retail Technologies. All rights reserved.</p>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
            <ShieldCheck className="w-3.5 h-3.5" /> Seznik Cloud Verified
          </span>
        </div>
      </div>
    </footer>
  )
}
