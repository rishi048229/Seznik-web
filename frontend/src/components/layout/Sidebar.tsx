import React, { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { clsx } from 'clsx'
import { ROUTES } from '@/constants/routes'
import { useProducts } from '@/hooks/useProducts'
import { useSettings } from '@/hooks/useSettings'
import { useAuth } from '@/contexts/AuthContext'
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Users,
  Truck,
  FileText,
  TrendingUp,
  Wallet,
  CreditCard,
  BarChart3,
  Settings,
  Printer,
  Store,
  Tag,
  MoveLeft,
  ChevronsLeft,
  ChevronsRight,
  X,
  MessageSquareHeart,
  BookOpen,
  Ticket,
  UtensilsCrossed,
} from 'lucide-react'
import { FeedbackModal } from '@/components/common/FeedbackModal'
import { canAccessSuppliers, canAccessPurchases, canAccessExpenses, canAccessReports } from '@/utils/permissions'
import { useLanguage } from '@/contexts/LanguageContext'
import { useTheme } from '@/contexts/ThemeContext'
import type { TranslationKey } from '@/i18n/translations'
import { isNavFeatureVisible } from '@/utils/businessFeatures'
import { isRestaurantBusiness, type NavFeatureId } from '@/constants/businessTypes'

type NavSectionId = 'pos' | 'inventory' | 'finance' | 'system'

interface NavSectionConfig {
  id: NavSectionId
  titleKey: TranslationKey
  defaultTitle: string
}

const NAV_SECTIONS: NavSectionConfig[] = [
  { id: 'pos', titleKey: 'nav.sectionMain', defaultTitle: 'Point of Sale' },
  { id: 'inventory', titleKey: 'nav.sectionInventory', defaultTitle: 'Inventory' },
  { id: 'finance', titleKey: 'nav.sectionFinance', defaultTitle: 'Finance & Orders' },
  { id: 'system', titleKey: 'nav.sectionSystem', defaultTitle: 'System & Reports' },
]

interface NavItem {
  path: string
  labelKey: TranslationKey
  icon: typeof LayoutDashboard
  section: NavSectionId
  permission?: 'canAccessSuppliers' | 'canAccessPurchases' | 'canAccessExpenses' | 'canAccessReports'
  feature?: NavFeatureId
  /** Per-icon click animation — each icon moves in a way that matches what it depicts. */
  animClass: string
  /** Clip the icon box so slide-through animations (truck/cart) exit and re-enter invisibly. */
  clip?: boolean
}

const getAllNavItems = (): NavItem[] => [
  // Point of Sale
  { path: ROUTES.DASHBOARD, labelKey: 'nav.dashboard', icon: LayoutDashboard, section: 'pos', animClass: 'animate-nav-pop' },
  { path: ROUTES.PRINTERS, labelKey: 'nav.printers', icon: Printer, section: 'pos', animClass: 'animate-nav-pop' },
  { path: ROUTES.POS, labelKey: 'nav.pos', icon: ShoppingCart, section: 'pos', animClass: 'animate-nav-drive', clip: true },
  { path: ROUTES.POS_LITE, labelKey: 'nav.posLite', icon: MoveLeft, section: 'pos', animClass: 'animate-nav-drive-back', clip: true },
  { path: ROUTES.TOKENS, labelKey: 'page.tokens', icon: Ticket, section: 'pos', animClass: 'animate-nav-pop', feature: 'tokens' },
  { path: ROUTES.KOT, labelKey: 'nav.kot', icon: UtensilsCrossed, section: 'pos', animClass: 'animate-nav-pop', feature: 'kot' },

  // Inventory
  { path: ROUTES.PRODUCTS, labelKey: 'nav.products', icon: Package, section: 'inventory', animClass: 'animate-nav-bounce' },
  { path: ROUTES.DAYBOOK, labelKey: 'page.daybook', icon: BookOpen, section: 'inventory', animClass: 'animate-nav-swing origin-top' },
  { path: ROUTES.CATEGORIES, labelKey: 'nav.categories', icon: Tag, section: 'inventory', animClass: 'animate-nav-swing origin-top' },
  { path: ROUTES.LOCATIONS, labelKey: 'nav.locations', icon: Store, section: 'inventory', animClass: 'animate-nav-swing origin-top' },

  // Finance & Operations
  { path: ROUTES.CUSTOMERS, labelKey: 'nav.customers', icon: Users, section: 'finance', animClass: 'animate-nav-pulse' },
  { path: ROUTES.SUPPLIERS, labelKey: 'nav.suppliers', icon: Truck, section: 'finance', permission: 'canAccessSuppliers', animClass: 'animate-nav-drive', clip: true },
  { path: ROUTES.SALES, labelKey: 'nav.sales', icon: FileText, section: 'finance', animClass: 'animate-nav-flip' },
  { path: ROUTES.PURCHASES, labelKey: 'nav.purchases', icon: TrendingUp, section: 'finance', permission: 'canAccessPurchases', animClass: 'animate-nav-rise' },
  { path: ROUTES.EXPENSES, labelKey: 'nav.expenses', icon: Wallet, section: 'finance', permission: 'canAccessExpenses', animClass: 'animate-nav-shake' },
  { path: ROUTES.CREDITS, labelKey: 'nav.credits', icon: CreditCard, section: 'finance', animClass: 'animate-nav-swipe' },

  // System & Reports
  { path: ROUTES.REPORTS, labelKey: 'nav.reports', icon: BarChart3, section: 'system', permission: 'canAccessReports', animClass: 'animate-nav-grow origin-bottom' },
  { path: ROUTES.SETTINGS, labelKey: 'nav.settings', icon: Settings, section: 'system', animClass: 'animate-nav-spin' },
]

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
}

export const Sidebar = ({ isOpen, onClose }: SidebarProps) => {
  const navigate = useNavigate()
  const { data: products } = useProducts()
  const { data: settings } = useSettings()
  const { user, userProfile, permissions } = useAuth()
  const { t } = useLanguage()
  const { isDark } = useTheme()
  const lowStockCount = products?.filter(p => p.currentStock <= p.lowStockThreshold).length ?? 0

  const displayName = settings?.businessName || userProfile?.businessName || userProfile?.displayName || user?.displayName || 'User'
  const logoUrl = settings?.businessLogoURL || user?.photoURL

  const [poppedPath, setPoppedPath] = useState<string | null>(null)
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('sidebar_collapsed') === 'true')
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false)

  const toggleCollapsed = () => {
    setCollapsed(current => {
      localStorage.setItem('sidebar_collapsed', String(!current))
      return !current
    })
  }

  const handleNavClick = (path: string) => {
    setPoppedPath(path)
    window.setTimeout(() => setPoppedPath(current => (current === path ? null : current)), 650)
    onClose()
  }

  const navItems = getAllNavItems().filter(item => {
    if (item.feature && !isNavFeatureVisible(userProfile?.businessType, item.feature)) return false
    if (!item.permission) return true
    if (userProfile?.role === 'admin') return true

    if (item.permission === 'canAccessSuppliers') return canAccessSuppliers(permissions ?? undefined)
    if (item.permission === 'canAccessPurchases') return canAccessPurchases(permissions ?? undefined)
    if (item.permission === 'canAccessExpenses') return canAccessExpenses(permissions ?? undefined)
    if (item.permission === 'canAccessReports') return canAccessReports(permissions ?? undefined)
    return true
  })

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 bg-black/50 z-30 lg:hidden" onClick={onClose} />
      )}
      <aside
        className={clsx(
          'fixed lg:relative inset-y-0 left-0 z-40 w-72 h-[100dvh] max-h-[100dvh] bg-[#f8fafc] border-r border-gray-200/80 dark:bg-dark-sidebar dark:border-dark-border transform transition-all duration-300 ease-in-out flex-shrink-0 flex flex-col',
          collapsed ? 'lg:w-[76px]' : 'lg:w-64',
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        {/* Header: Brand & Toggles */}
        <div
          className={clsx(
            'flex items-center justify-between border-b border-gray-200/70 dark:border-dark-border/70 flex-shrink-0',
            collapsed ? 'py-3 px-3 lg:px-0 lg:flex-col lg:gap-2' : 'py-3 px-4'
          )}
        >
          {/* Collapsed desktop brand & expand button */}
          {collapsed && (
            <div className="hidden lg:flex flex-col items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-sky-400 text-white font-bold text-base flex items-center justify-center shadow-md shadow-sky-400/30 flex-shrink-0">
                S
              </div>
              <button
                type="button"
                onClick={toggleCollapsed}
                aria-label={t('sidebar.expand')}
                title={t('sidebar.expand')}
                className="w-7 h-7 flex items-center justify-center rounded-lg bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 hover:border-blue-300 dark:hover:border-blue-500 shadow-sm transition-all duration-200 active:scale-95"
              >
                <ChevronsRight size={16} />
              </button>
            </div>
          )}

          {/* Full brand (mobile always, desktop when not collapsed) */}
          <div className={clsx('flex flex-col min-w-0', collapsed && 'lg:hidden')}>
            <img
              src={isDark ? '/seznik_white_logo.png' : '/seznik_logo.png'}
              alt="Seznik"
              className="w-28 sm:w-30 h-auto object-contain"
            />
            <div className="text-[0.68rem] font-medium text-slate-400 tracking-wider mt-0.5 truncate">
              {isRestaurantBusiness(userProfile?.businessType)
                ? t('sidebar.restaurantPos')
                : t('sidebar.retailPos')}
            </div>
          </div>

          {/* Toggle buttons (mobile close, desktop collapse) */}
          <div className={clsx('flex items-center gap-1 flex-shrink-0', collapsed && 'lg:hidden')}>
            {/* Desktop collapse button */}
            <button
              type="button"
              onClick={toggleCollapsed}
              aria-label={t('sidebar.collapse')}
              title={t('sidebar.collapse')}
              className="hidden lg:flex w-7 h-7 items-center justify-center rounded-lg bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 hover:border-blue-300 dark:hover:border-blue-500 shadow-sm transition-all duration-200 active:scale-95"
            >
              <ChevronsLeft size={16} />
            </button>
            {/* Mobile close button */}
            <button
              type="button"
              onClick={onClose}
              aria-label={t('sidebar.close')}
              title={t('sidebar.close')}
              className="lg:hidden w-7 h-7 items-center justify-center rounded-lg bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border text-gray-600 dark:text-gray-300 hover:text-red-500 dark:hover:text-red-400 hover:border-red-300 dark:hover:border-red-500 shadow-sm transition-all duration-200 active:scale-95"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Navigation */}
        <nav
          className={clsx(
            'flex-1 min-h-0 overflow-hidden py-2 select-none',
            collapsed ? 'px-2 lg:px-2' : 'px-3'
          )}
        >
          {NAV_SECTIONS.map((section, sIdx) => {
            const items = navItems.filter(item => item.section === section.id)
            if (items.length === 0) return null

            return (
              <div key={section.id} className={clsx(sIdx > 0 && 'mt-2 pt-0.5')}>
                {/* Section divider with subtle label */}
                {sIdx > 0 && (
                  <div className="pt-0.5 pb-1 px-2.5 flex items-center gap-2 select-none">
                    <span
                      className={clsx(
                        'text-[9.5px] font-bold tracking-wider uppercase text-gray-400 dark:text-gray-500 whitespace-nowrap',
                        collapsed && 'lg:hidden'
                      )}
                    >
                      {t(section.titleKey) || section.defaultTitle}
                    </span>
                    <div className="flex-1 h-px bg-gray-200/80 dark:bg-dark-border/80" />
                  </div>
                )}

                {/* Nav links */}
                <div className="space-y-1">
                  {items.map(item => {
                    const isProducts = item.path === ROUTES.PRODUCTS
                    const Icon = item.icon
                    return (
                      <NavLink
                        key={item.path}
                        to={item.path}
                        onClick={() => handleNavClick(item.path)}
                        title={collapsed ? t(item.labelKey) : undefined}
                        className={({ isActive }) =>
                          clsx(
                            'group relative flex items-center px-3 py-2 rounded-xl text-[13.5px] font-medium transition-all duration-200',
                            'active:scale-[0.98]',
                            collapsed && 'lg:px-0 lg:justify-center lg:py-2.5',
                            isActive
                              ? 'bg-gradient-to-r from-blue-600 to-sky-400 text-white shadow-sm dark:from-blue-600 dark:to-blue-600 dark:text-white dark:shadow-sm dark:ring-1 dark:ring-blue-400/40 font-semibold'
                              : clsx(
                                  'text-gray-600 hover:bg-gray-200/60 dark:text-gray-300 dark:hover:bg-white/[0.08] dark:hover:text-white',
                                  !collapsed && 'hover:translate-x-0.5'
                                )
                          )
                        }
                      >
                        {/* Icon */}
                        <span
                          className={clsx(
                            'mr-3 flex-shrink-0 inline-flex items-center justify-center w-[18px] h-[18px]',
                            collapsed && 'lg:mr-0',
                            'transition-transform duration-200 ease-out group-hover:scale-110 group-active:scale-90',
                            item.clip && 'overflow-hidden'
                          )}
                        >
                          <Icon
                            size={18}
                            className={clsx(
                              'flex-shrink-0',
                              poppedPath === item.path && item.animClass
                            )}
                          />
                        </span>

                        {/* Label */}
                        <span className={clsx('truncate whitespace-nowrap leading-tight', collapsed && 'lg:hidden')}>
                          {t(item.labelKey)}
                        </span>

                        {/* Badges */}
                        {isProducts && lowStockCount > 0 && (
                          <>
                            {/* Expanded / mobile pill */}
                            <span
                              className={clsx(
                                'ml-auto bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 text-[10px] font-semibold px-1.5 py-0.2 rounded-full transition-transform duration-200 group-hover:scale-105',
                                collapsed && 'lg:hidden'
                              )}
                            >
                              {lowStockCount}
                            </span>
                            {/* Collapsed rail badge */}
                            {collapsed && (
                              <span className="hidden lg:flex absolute top-0.5 right-1 min-w-[14px] h-3.5 px-1 items-center justify-center rounded-full bg-red-500 text-white text-[9px] font-semibold leading-none">
                                {lowStockCount}
                              </span>
                            )}
                          </>
                        )}
                      </NavLink>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </nav>

        {/* Feedback — "Review and suggest" */}
        <div className={clsx('pt-2 pb-1.5 flex-shrink-0 border-t border-gray-200/60 dark:border-dark-border/60', collapsed ? 'px-2' : 'px-3')}>
          <button
            type="button"
            onClick={() => { setIsFeedbackOpen(true); onClose() }}
            title={collapsed ? t('sidebar.reviewSuggest') : undefined}
            className={clsx(
              'w-full flex items-center gap-2.5 rounded-lg border border-dashed border-blue-300 dark:border-blue-800 bg-blue-50/60 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 hover:bg-blue-100/80 dark:hover:bg-blue-900/40 transition-colors active:scale-[0.98]',
              collapsed ? 'p-2 lg:justify-center' : 'px-3 py-1.5'
            )}
          >
            <MessageSquareHeart size={18} className="flex-shrink-0" />
            <span className={clsx('text-left min-w-0', collapsed && 'lg:hidden')}>
              <span className="block text-xs font-bold truncate leading-tight">{t('sidebar.reviewSuggest')}</span>
              <span className="block text-[9.5px] text-blue-500/80 dark:text-gray-400 truncate leading-tight">{t('sidebar.reviewSuggestSub')}</span>
            </span>
          </button>
        </div>

        {/* User Card */}
        <div className={clsx('pb-3 pt-0.5 flex-shrink-0', collapsed ? 'px-2' : 'px-3')}>
          <button
            type="button"
            onClick={() => { navigate(ROUTES.PROFILE); onClose() }}
            title={collapsed ? `${displayName} — ${t('profile.viewProfile')}` : t('profile.viewProfile')}
            className={clsx(
              'w-full text-left bg-white dark:bg-dark-card rounded-lg shadow-sm border border-gray-100 dark:border-dark-border',
              'hover:border-blue-200 dark:hover:border-blue-800 hover:shadow-md transition-all active:scale-[0.98]',
              collapsed ? 'p-1.5' : 'p-2'
            )}
          >
            <div className={clsx('flex items-center gap-2.5', collapsed && 'lg:justify-center lg:gap-0')}>
              <img
                src={logoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=2563eb&color=fff`}
                alt={displayName}
                title={collapsed ? `${displayName} (${userProfile?.role?.toUpperCase() || 'USER'})` : undefined}
                className="w-7 h-7 rounded-full object-cover border border-gray-200 dark:border-dark-border bg-white flex-shrink-0"
              />
              <div className={clsx('flex-1 min-w-0', collapsed && 'lg:hidden')}>
                <p className="text-xs font-semibold text-gray-900 dark:text-gray-100 truncate leading-tight">
                  {displayName}
                </p>
                <p className="text-[10px] text-gray-500 truncate leading-tight">{userProfile?.email || user?.email || ''}</p>
                <p className="text-[9.5px] text-gray-400 font-medium leading-tight">{userProfile?.role?.toUpperCase() || 'USER'}</p>
              </div>
            </div>
          </button>
        </div>
      </aside>

      <FeedbackModal
        isOpen={isFeedbackOpen}
        onClose={() => setIsFeedbackOpen(false)}
      />
    </>
  )
}
