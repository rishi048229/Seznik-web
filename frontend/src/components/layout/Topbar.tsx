import { useAuth } from '@/contexts/AuthContext'
import { useTheme } from '@/contexts/ThemeContext'
import { useSettings } from '@/hooks/useSettings'
import { Avatar } from '@/components/ui/Avatar'
import { Menu, Bell, HelpCircle, Plus, ArrowLeft } from 'lucide-react'
import { AnimatedThemeToggler } from '@/components/ui/animated-theme-toggler'

import { Button } from '@/components/ui/Button'
import { useNavigate, useLocation } from 'react-router-dom'
import { ROUTES } from '@/constants/routes'
import { useLanguage } from '@/contexts/LanguageContext'
import { isKotFirstNav } from '@/utils/businessFeatures'

interface TopbarProps {
  onMenuClick: () => void
}

export const Topbar = ({ onMenuClick }: TopbarProps) => {
  const { user, userProfile } = useAuth()
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

  const showBackButton = location.pathname !== ROUTES.DASHBOARD &&
                         location.pathname !== ROUTES.LOGIN &&
                         location.pathname !== ROUTES.ACCESS_SELECTION &&
                         location.pathname !== ROUTES.ONBOARDING

  return (
    <header className="sticky top-0 z-20 bg-white/80 dark:bg-dark-bg/90 backdrop-blur-xl border-b border-gray-100 dark:border-dark-border px-3 lg:px-6 py-2.5 flex items-center justify-between gap-2">
      <div className="flex items-center gap-2 min-w-0">
        <Button variant="ghost" size="sm" onClick={onMenuClick} className="lg:hidden p-2 flex-shrink-0">
          <Menu size={20} />
        </Button>
        {showBackButton && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleGoBack}
            className="p-2 hover:bg-gray-100 dark:hover:bg-dark-card flex-shrink-0"
          >
            <ArrowLeft size={20} />
          </Button>
        )}
        <h2 className="text-base lg:text-lg font-semibold text-gray-900 dark:text-gray-100 truncate">
          {settings?.businessName || userProfile?.businessName || t('nav.dashboard')}
        </h2>
      </div>

      <div className="flex items-center gap-1 flex-shrink-0">
        {/* Theme toggle — animated view transition */}
        <AnimatedThemeToggler
          theme={isDark ? 'dark' : 'light'}
          onThemeChange={(newTheme) => setTheme(newTheme === 'dark')}
          variant="circle"
          duration={450}
          className="p-2 inline-flex items-center justify-center rounded-lg text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-dark-elevated dark:hover:text-white transition-colors focus:outline-none"
          title={isDark ? (t('theme.light') || 'Switch to Light Mode') : (t('theme.dark') || 'Switch to Dark Mode')}
        />
        {/* Bell + Help — hidden on small screens */}
        <Button variant="ghost" size="sm" className="p-2 hidden sm:flex">
          <Bell size={18} className="text-gray-500" />
        </Button>
        <Button variant="ghost" size="sm" className="p-2 hidden sm:flex">
          <HelpCircle size={18} className="text-gray-500" />
        </Button>
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
        <button
          type="button"
          onClick={() => navigate(ROUTES.PROFILE)}
          className="flex items-center gap-2 focus:outline-none ml-1 hover:opacity-80 transition-opacity"
          aria-label={t('topbar.openProfile')}
        >
          <Avatar
            src={user?.photoURL ?? undefined}
            alt={user?.displayName ?? undefined}
            size="sm"
          />
        </button>
      </div>
    </header>
  )
}
