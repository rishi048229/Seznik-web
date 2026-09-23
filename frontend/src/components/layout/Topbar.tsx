import { useAuth } from '@/contexts/AuthContext'
import { useTheme } from '@/contexts/ThemeContext'
import { useSettings } from '@/hooks/useSettings'
import { Menu, HelpCircle, Plus, ArrowLeft } from 'lucide-react'
import { AnimatedThemeToggler } from '@/components/ui/animated-theme-toggler'
import { NotificationCenterPopover } from '@/components/notifications/NotificationCenterPopover'

import { Button } from '@/components/ui/Button'
import { useNavigate, useLocation } from 'react-router-dom'
import { ROUTES } from '@/constants/routes'
import { useLanguage } from '@/contexts/LanguageContext'
import { isKotFirstNav } from '@/utils/businessFeatures'

interface TopbarProps {
  onMenuClick: () => void
}

export const Topbar = ({ onMenuClick }: TopbarProps) => {
  const { userProfile } = useAuth()
  const { isDark, setTheme } = useTheme()
  const { data: settings } = useSettings()
  const { t } = useLanguage()
  const navigate = useNavigate()
  const location = useLocation()
  const kotFirst = isKotFirstNav(userProfile?.businessType)

  const openPrimaryAction = () => {
    if (kotFirst) {
      void import('@/pages/kot/components/KOTWorkspace')
      navigate(`${ROUTES.KOT}?new=1`)
      return
    }
    navigate(ROUTES.POS)
  }

  const handleGoBack = () => {
    // If we're on a detail page or nested page, go back, otherwise go to dashboard
    if (location.pathname !== ROUTES.DASHBOARD) {
      navigate(-1)
    }
  }

  return (
    <header className="h-16 bg-white dark:bg-dark-card border-b border-gray-200 dark:border-dark-border px-4 flex items-center justify-between sticky top-0 z-30">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={onMenuClick}
          className="lg:hidden p-2"
          aria-label="Open menu"
        >
          <Menu size={20} />
        </Button>
        
        {/* Back Button and Store Details */}
        <div className="flex items-center gap-2">
          {location.pathname !== ROUTES.DASHBOARD && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleGoBack}
              className="p-1.5 hover:bg-gray-100 dark:hover:bg-dark-elevated rounded-lg transition-colors"
              aria-label="Go back"
            >
              <ArrowLeft size={18} className="text-gray-600 dark:text-gray-300" />
            </Button>
          )}
          
          <div
            className="flex flex-col cursor-pointer"
            onClick={() => navigate(ROUTES.PROFILE)}
            title="Profile"
          >
            <h1 className="text-base font-semibold text-gray-900 dark:text-gray-100 leading-tight">
              {settings?.businessName || 'My Store'}
            </h1>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2">
        {/* Theme toggle — animated view transition */}
        <AnimatedThemeToggler
          theme={isDark ? 'dark' : 'light'}
          onThemeChange={(newTheme) => setTheme(newTheme === 'dark')}
          variant="circle"
          duration={450}
          className="w-9 h-9 inline-flex items-center justify-center rounded-lg text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-dark-elevated transition-colors focus:outline-none cursor-pointer"
          title={isDark ? (t('theme.light') || 'Switch to Light Mode') : (t('theme.dark') || 'Switch to Dark Mode')}
        />
        {/* Notifications Popover */}
        <NotificationCenterPopover />

        <button
          type="button"
          onClick={() => navigate(ROUTES.FEEDBACK)}
          title="Help & Feedback"
          className="w-9 h-9 hidden sm:inline-flex items-center justify-center rounded-lg text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-dark-elevated transition-colors focus:outline-none cursor-pointer"
        >
          <HelpCircle size={18} className="shrink-0" />
        </button>


        <div className="hidden sm:block w-px h-6 bg-gray-200 dark:bg-dark-elevated mx-1" />
        {/* New Bill (restaurant) or New Sale (retail) */}
        <Button
          data-tour="pos-shortcut"
          variant="ghost"
          size="sm"
          onClick={openPrimaryAction}
          onMouseEnter={() => {
            if (kotFirst) void import('@/pages/kot/components/KOTWorkspace')
          }}
          className="bg-[#0a0a2e] text-white hover:bg-[#1a1555] hover:text-white dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white dark:hover:text-zinc-900 dark:shadow-none p-2 sm:px-4 sm:py-2 rounded-xl text-sm font-medium shadow-lg shadow-blue-500/20 transition-colors"
        >
          <Plus size={16} className="sm:mr-1 shrink-0 text-white dark:text-zinc-900" />
          <span className="hidden sm:inline text-white dark:text-zinc-900">
            {kotFirst ? t('action.newBill') : t('action.newSale')}
          </span>
        </Button>
      </div>
    </header>
  )
}
