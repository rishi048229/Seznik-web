import { useAuth } from '@/contexts/AuthContext'
import { useTheme } from '@/contexts/ThemeContext'
import { Avatar } from '@/components/ui/Avatar'
import { DropdownMenu, DropdownMenuItem } from '@/components/ui/DropdownMenu'
import { Sun, Moon, LogOut, Menu, Bell, HelpCircle, Plus, Search, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useNavigate, useLocation } from 'react-router-dom'
import { ROUTES } from '@/constants/routes'
import toast from 'react-hot-toast'

interface TopbarProps {
  onMenuClick: () => void
}

export const Topbar = ({ onMenuClick }: TopbarProps) => {
  const { user, userProfile, clearWorkspaceSelection } = useAuth()
  const { isDark, toggleTheme } = useTheme()
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

  const handleSignOut = async () => {
    try {
      clearWorkspaceSelection()
      toast.success('Signed out to RBA workstation panel')
      navigate(ROUTES.ACCESS_SELECTION, { replace: true })
    } catch (error) {
      console.error('Sign out error:', error)
      toast.error('Failed to sign out')
    }
  }

  return (
    <header className="sticky top-0 z-20 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border-b border-gray-100 dark:border-gray-800 px-3 lg:px-6 py-2.5 flex items-center justify-between gap-2">
      <div className="flex items-center gap-2 min-w-0">
        <Button variant="ghost" size="sm" onClick={onMenuClick} className="lg:hidden p-2 flex-shrink-0">
          <Menu size={20} />
        </Button>
        {showBackButton && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleGoBack}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 flex-shrink-0"
          >
            <ArrowLeft size={20} />
          </Button>
        )}
        <h2 className="text-base lg:text-lg font-semibold text-gray-900 dark:text-gray-100 truncate">
          {userProfile?.businessName || 'Dashboard'}
        </h2>
        {/* Search Bar — desktop only */}
        <div className="hidden md:flex items-center gap-2 bg-gray-100 dark:bg-gray-800 rounded-xl px-4 py-2 min-w-[16rem]">
          <Search size={16} className="text-gray-400 flex-shrink-0" />
          <input
            type="text"
            placeholder="Search transactions, products..."
            className="bg-transparent text-sm text-gray-600 dark:text-gray-300 placeholder:text-gray-400 outline-none flex-1 min-w-0"
          />
        </div>
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
        <div className="hidden sm:block w-px h-6 bg-gray-200 dark:bg-gray-700 mx-1" />
        {/* New Sale — icon-only on mobile, icon+text on desktop */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(ROUTES.POS)}
          className="bg-[#0a0a2e] text-white hover:bg-[#1a1555] p-2 sm:px-4 sm:py-2 rounded-xl text-sm font-medium shadow-lg shadow-blue-500/20"
        >
          <Plus size={16} className="sm:mr-1" />
          <span className="hidden sm:inline">New Sale</span>
        </Button>
        <DropdownMenu
          trigger={
            <button className="flex items-center gap-2 focus:outline-none ml-1 hover:opacity-80 transition-opacity">
              <Avatar
                src={user?.photoURL ?? undefined}
                alt={user?.displayName ?? undefined}
                size="sm"
              />
            </button>
          }
          align="right"
        >
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
              {user?.displayName || 'User'}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
              {user?.email || ''}
            </p>
          </div>
          <DropdownMenuItem onClick={handleSignOut}>
            <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
              <LogOut size={16} />
              <span className="font-medium">Sign Out</span>
            </div>
          </DropdownMenuItem>
        </DropdownMenu>
      </div>
    </header>
  )
}
