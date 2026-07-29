import { useSettings } from '@/hooks/useSettings'
import { Mail, Phone, MessageCircle, Building2, ShieldCheck } from 'lucide-react'

export const Footer = () => {
  const { data: settings } = useSettings()

  const companyName = settings?.businessName || settings?.receiptConfig?.companyName || 'Inventory Manager'
  const companyAddress = settings?.businessAddress || settings?.receiptConfig?.address || ''
  const supportEmail = settings?.supportEmail || ''
  const supportPhone = settings?.supportPhone || settings?.businessPhone || settings?.receiptConfig?.phone || ''
  const rawWhatsapp = settings?.whatsappNumber || settings?.supportPhone || settings?.businessPhone || ''
  
  // Clean phone number for WhatsApp link (only numbers)
  const cleanWhatsapp = rawWhatsapp.replace(/[^0-9]/g, '')
  const whatsappUrl = cleanWhatsapp ? `https://wa.me/${cleanWhatsapp}` : ''

  const currentYear = new Date().getFullYear()

  return (
    <footer className="mt-8 pt-6 border-t border-gray-200/80 dark:border-gray-800 text-xs text-gray-500 dark:text-gray-400">
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 pb-4">
        {/* Company & Copyright Details */}
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-2 text-center sm:text-left">
          <div className="flex items-center gap-1.5 font-semibold text-gray-800 dark:text-gray-200">
            <Building2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span>{companyName}</span>
          </div>
          {companyAddress && (
            <span className="hidden sm:inline text-gray-300 dark:text-gray-700">•</span>
          )}
          {companyAddress && (
            <span className="text-gray-500 dark:text-gray-400 max-w-xs truncate">{companyAddress}</span>
          )}
        </div>

        {/* Support & Contact Action Badges */}
        <div className="flex flex-wrap items-center justify-center gap-3">
          {supportEmail && (
            <a
              href={`mailto:${supportEmail}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 hover:border-blue-300 dark:hover:border-blue-600 transition-colors shadow-sm"
              title="Send Support Email"
            >
              <Mail className="w-3.5 h-3.5 text-blue-500" />
              <span>{supportEmail}</span>
            </a>
          )}

          {supportPhone && (
            <a
              href={`tel:${supportPhone}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:text-emerald-600 dark:hover:text-emerald-400 hover:border-emerald-300 dark:hover:border-emerald-600 transition-colors shadow-sm"
              title="Call Support Phone"
            >
              <Phone className="w-3.5 h-3.5 text-emerald-500" />
              <span>{supportPhone}</span>
            </a>
          )}

          {whatsappUrl && (
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition-colors shadow-sm font-medium"
              title="Chat on WhatsApp"
            >
              <MessageCircle className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>WhatsApp Support</span>
            </a>
          )}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-800/60 text-[11px] text-gray-400 gap-2">
        <p>© {currentYear} {companyName}. All rights reserved.</p>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1">
            <ShieldCheck className="w-3 h-3 text-emerald-500" /> Secure Business Cloud
          </span>
        </div>
      </div>
    </footer>
  )
}
