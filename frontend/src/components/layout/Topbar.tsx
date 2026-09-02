import { useAuth } from '@/contexts/AuthContext'
import { useTheme } from '@/contexts/ThemeContext'
import { useSettings } from '@/hooks/useSettings'
import { Avatar } from '@/components/ui/Avatar'
import { Sun, Moon, Menu, Bell, HelpCircle, Plus, ArrowLeft } from 'lucide-react'

import { Button } from '@/components/ui/Button'
import { useNavigate, useLocation } from 'react-router-dom'
import { ROUTES } from '@/constants/routes'
import { useLanguage } from '@/contexts/LanguageContext'

interface TopbarProps {
  onMenuClick: () => void
}

export const Topbar = ({ onMenuClick }: TopbarProps) => {
  const { user, userProfile } = useAuth()
  const { isDark, toggleTheme } = useTheme()
  const { data: settings } = useSettings()
  const { t } = useLanguage()
  const navigate = useNavigate()
  const location = useLocation()

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
        {/* Theme toggle — always visible */}
        <Button variant="ghost" size="sm" onClick={toggleTheme} className="p-2">
          {isDark ? <Sun size={18} /> : <Moon size={18} />}
        </Button>
        {/* Bell + Help — hidden on small screens */}
        <Button variant="ghost" size="sm" className="p-2 hidden sm:flex">
          <Bell size={18} className="text-gray-500" />
        </Button>
        <Button variant="ghost" size="sm" className="p-2 hidden sm:flex">
          <HelpCircle size={18} className="text-gray-500" />
        </Button>
        <div className="hidden sm:block w-px h-6 bg-gray-200 dark:bg-dark-elevated mx-1" />
        {/* New Sale — icon-only on mobile, icon+text on desktop */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(ROUTES.POS)}
          className="bg-[#0a0a2e] text-white hover:bg-[#1a1555] dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white dark:shadow-none p-2 sm:px-4 sm:py-2 rounded-xl text-sm font-medium shadow-lg shadow-blue-500/20"
        >
          <Plus size={16} className="sm:mr-1" />
          <span className="hidden sm:inline">{t('action.newSale')}</span>
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
