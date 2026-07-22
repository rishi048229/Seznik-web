import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { clsx } from 'clsx'
import { ROUTES } from '@/constants/routes'
import { useProducts } from '@/hooks/useProducts'
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
  Tag,
  MoveLeft,
  ChevronsLeft,
} from 'lucide-react'
import { canAccessSuppliers, canAccessPurchases, canAccessExpenses, canAccessReports } from '@/utils/permissions'
import { useLanguage } from '@/contexts/LanguageContext'
import type { TranslationKey } from '@/i18n/translations'

interface NavItem {
  path: string
  labelKey: TranslationKey
  icon: typeof LayoutDashboard
  permission?: 'canAccessSuppliers' | 'canAccessPurchases' | 'canAccessExpenses' | 'canAccessReports'
  /** Per-icon click animation — each icon moves in a way that matches what it depicts. */
  animClass: string
  /** Clip the icon box so slide-through animations (truck/cart) exit and re-enter invisibly. */
  clip?: boolean
}

const getAllNavItems = (): NavItem[] => [
  { path: ROUTES.DASHBOARD, labelKey: 'nav.dashboard', icon: LayoutDashboard, animClass: 'animate-nav-pop' },
  { path: ROUTES.PRINTERS, labelKey: 'nav.printers', icon: Printer, animClass: 'animate-nav-pop' },
  { path: ROUTES.POS, labelKey: 'nav.pos', icon: ShoppingCart, animClass: 'animate-nav-drive', clip: true },
  { path: ROUTES.POS_LITE, labelKey: 'nav.posLite', icon: MoveLeft, animClass: 'animate-nav-drive-back', clip: true },
  { path: ROUTES.PRODUCTS, labelKey: 'nav.products', icon: Package, animClass: 'animate-nav-bounce' },
  { path: ROUTES.CATEGORIES, labelKey: 'nav.categories', icon: Tag, animClass: 'animate-nav-swing origin-top' },
  { path: ROUTES.CUSTOMERS, labelKey: 'nav.customers', icon: Users, animClass: 'animate-nav-pulse' },
  { path: ROUTES.SUPPLIERS, labelKey: 'nav.suppliers', icon: Truck, permission: 'canAccessSuppliers', animClass: 'animate-nav-drive', clip: true },
  { path: ROUTES.SALES, labelKey: 'nav.sales', icon: FileText, animClass: 'animate-nav-flip' },
  { path: ROUTES.PURCHASES, labelKey: 'nav.purchases', icon: TrendingUp, permission: 'canAccessPurchases', animClass: 'animate-nav-rise' },
  { path: ROUTES.EXPENSES, labelKey: 'nav.expenses', icon: Wallet, permission: 'canAccessExpenses', animClass: 'animate-nav-shake' },
  { path: ROUTES.CREDITS, labelKey: 'nav.credits', icon: CreditCard, animClass: 'animate-nav-swipe' },
  { path: ROUTES.REPORTS, labelKey: 'nav.reports', icon: BarChart3, permission: 'canAccessReports', animClass: 'animate-nav-grow origin-bottom' },
  { path: ROUTES.SETTINGS, labelKey: 'nav.settings', icon: Settings, animClass: 'animate-nav-spin' },
]

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
}

export const Sidebar = ({ isOpen, onClose }: SidebarProps) => {
  const { data: products } = useProducts()
  const { user, userProfile, permissions } = useAuth()
  const { t } = useLanguage()
  const lowStockCount = products?.filter(p => p.currentStock <= p.lowStockThreshold).length ?? 0

  // Drives the one-shot "pop" animation on the icon of the item just clicked.
  const [poppedPath, setPoppedPath] = useState<string | null>(null)

  // Desktop-only collapse to an icon rail; the mobile drawer always shows labels.
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('sidebar_collapsed') === 'true')

  const toggleCollapsed = () => {
    setCollapsed(current => {
      localStorage.setItem('sidebar_collapsed', String(!current))
      return !current
    })
  }

  const handleNavClick = (path: string) => {
    setPoppedPath(path)
    // Longest per-icon animation is 600ms; clear a touch later so it can replay next click.
    window.setTimeout(() => setPoppedPath(current => (current === path ? null : current)), 650)
    onClose()
  }

  // Filter nav items based on permissions
  const navItems = getAllNavItems().filter(item => {
    if (!item.permission) return true
    if (userProfile?.role === 'admin') return true

    if (item.permission === 'canAccessSuppliers') return canAccessSuppliers(permissions ?? undefined)
    if (item.permission === 'canAccessPurchases') return canAccessPurchases(permissions ?? undefined)
    if (item.permission === 'canAccessExpenses') return canAccessExpenses(permissions ?? undefined)
    if (item.permission === 'canAccessReports') return canAccessReports(permissions ?? undefined)
    return true
  })

  const displayName = userProfile?.displayName || user?.displayName || 'User'

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 bg-black/50 z-30 lg:hidden" onClick={onClose} />
      )}
      <aside
        className={clsx(
          'fixed lg:relative inset-y-0 left-0 z-40 w-72 bg-[#f1f5f9] border-r border-gray-200 dark:bg-gray-900 dark:border-gray-700 transform transition-all duration-300 ease-in-out flex-shrink-0',
          collapsed ? 'lg:w-[76px]' : 'lg:w-64',
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        {/* Collapse toggle — floats on the sidebar edge (desktop only) */}
        <button
          type="button"
          onClick={toggleCollapsed}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="hidden lg:flex absolute -right-3 top-7 z-50 w-6 h-6 items-center justify-center rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 shadow-md text-gray-500 dark:text-gray-400 hover:text-blue-600 hover:border-blue-300 hover:shadow-sky-200/60 transition-all duration-200 active:scale-90"
        >
          <ChevronsLeft
            size={14}
            className={clsx('transition-transform duration-300', collapsed && 'rotate-180')}
          />
        </button>

        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className={clsx('py-5 flex items-center gap-3', collapsed ? 'px-5 lg:px-0 lg:justify-center' : 'px-5')}>
            {/* Compact brand mark shown only in the collapsed rail */}
            {collapsed && (
              <div className="hidden lg:flex w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-sky-400 text-white font-bold text-lg items-center justify-center shadow-md shadow-sky-400/30">
                S
              </div>
            )}
            <div className={clsx(collapsed && 'lg:hidden')}>
              <img src="/seznik_logo.png" alt="Seznik" style={{ width: '8rem', height: 'auto', objectFit: 'contain', }} />
              <div style={{ fontSize: '0.725rem', fontWeight: 500, color: '#94a3b8', letterSpacing: '0.05em' }}>
                PREMIUM RETAIL POS
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className={clsx('flex-1 overflow-y-auto py-4', collapsed ? 'px-3 lg:px-[15px]' : 'px-3')}>
            {navItems.map(item => {
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
                      'group relative flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 mb-1',
                      'active:scale-[0.98]',
                      collapsed && 'lg:px-0 lg:justify-center',
                      isActive
                        ? 'bg-gradient-to-r from-blue-600 to-sky-400 text-white shadow-lg shadow-sky-400/40'
                        : clsx(
                            'text-gray-600 hover:bg-gray-200/60 dark:text-gray-400 dark:hover:bg-gray-700/50',
                            // The slide-right hover only suits the expanded, left-aligned layout.
                            !collapsed && 'hover:translate-x-1'
                          )
                    )
                  }
                >
                  {/* Wrapper carries hover/press scale + optional clipping window;
                      the icon inside runs its per-item click animation. */}
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
                  <span className={clsx('truncate whitespace-nowrap', collapsed && 'lg:hidden')}>
                    {t(item.labelKey)}
                  </span>
                  {isProducts && lowStockCount > 0 && (
                    <>
                      {/* Expanded / mobile: pill at the row end */}
                      <span
                        className={clsx(
                          'ml-auto bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 text-xs font-medium px-2 py-0.5 rounded-full transition-transform duration-200 group-hover:scale-105',
                          collapsed && 'lg:hidden'
                        )}
                      >
                        {lowStockCount}
                      </span>
                      {/* Collapsed rail: mini count pinned to the icon corner */}
                      {collapsed && (
                        <span className="hidden lg:flex absolute top-0.5 right-1 min-w-[16px] h-4 px-1 items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-semibold leading-none">
                          {lowStockCount}
                        </span>
                      )}
                    </>
                  )}
                </NavLink>
              )
            })}
          </nav>

          {/* User Card */}
          <div className={clsx('pb-4', collapsed ? 'px-3 lg:px-2' : 'px-3')}>
            <div
              className={clsx(
                'bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700',
                collapsed ? 'p-3 lg:p-1.5' : 'p-3'
              )}
            >
              <div className={clsx('flex items-center gap-3', collapsed && 'lg:justify-center lg:gap-0')}>
                <img
                  src={user?.photoURL || `https://ui-avatars.com/api/?name=${displayName}&background=2563eb&color=fff`}
                  alt={displayName}
                  title={collapsed ? `${displayName} (${userProfile?.role?.toUpperCase() || 'USER'})` : undefined}
                  className="w-9 h-9 rounded-full object-cover"
                />
                <div className={clsx('flex-1 min-w-0', collapsed && 'lg:hidden')}>
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                    {displayName}
                  </p>
                  <p className="text-xs text-gray-500 truncate">{userProfile?.email || user?.email || ''}</p>
                  <p className="text-xs text-gray-400">{userProfile?.role?.toUpperCase() || 'USER'}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}
