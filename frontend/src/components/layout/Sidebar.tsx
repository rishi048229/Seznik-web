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
  Tag,
  MoveLeft,
} from 'lucide-react'
import { canAccessSuppliers, canAccessPurchases, canAccessExpenses, canAccessReports } from '@/utils/permissions'
import { useLanguage } from '@/contexts/LanguageContext'
import type { TranslationKey } from '@/i18n/translations'

const getAllNavItems = (): { path: string; labelKey: TranslationKey; icon: typeof LayoutDashboard; permission?: 'canAccessSuppliers' | 'canAccessPurchases' | 'canAccessExpenses' | 'canAccessReports' }[] => [
  { path: ROUTES.DASHBOARD, labelKey: 'nav.dashboard', icon: LayoutDashboard },
  { path: ROUTES.POS, labelKey: 'nav.pos', icon: ShoppingCart },
  { path: ROUTES.POS_LITE, labelKey: 'nav.posLite', icon: MoveLeft },
  { path: ROUTES.PRODUCTS, labelKey: 'nav.products', icon: Package },
  { path: ROUTES.CATEGORIES, labelKey: 'nav.categories', icon: Tag },
  { path: ROUTES.CUSTOMERS, labelKey: 'nav.customers', icon: Users },
  { path: ROUTES.SUPPLIERS, labelKey: 'nav.suppliers', icon: Truck, permission: 'canAccessSuppliers' },
  { path: ROUTES.SALES, labelKey: 'nav.sales', icon: FileText },
  { path: ROUTES.PURCHASES, labelKey: 'nav.purchases', icon: TrendingUp, permission: 'canAccessPurchases' },
  { path: ROUTES.EXPENSES, labelKey: 'nav.expenses', icon: Wallet, permission: 'canAccessExpenses' },
  { path: ROUTES.CREDITS, labelKey: 'nav.credits', icon: CreditCard },
  { path: ROUTES.REPORTS, labelKey: 'nav.reports', icon: BarChart3, permission: 'canAccessReports' },
  { path: ROUTES.SETTINGS, labelKey: 'nav.settings', icon: Settings },
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

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 bg-black/50 z-30 lg:hidden" onClick={onClose} />
      )}
      <aside
        className={clsx(
          'fixed lg:static inset-y-0 left-0 z-40 w-72 lg:w-64 bg-[#f1f5f9] border-r border-gray-200 dark:bg-gray-900 dark:border-gray-700 transform transition-transform duration-200 ease-in-out flex-shrink-0',
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="px-5 py-5 flex items-center gap-3">
            {/* <div style={{
              width: '2.5rem',
              height: '2.5rem',
              borderRadius: '0.75rem',
              background: '#0a0a2e',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0.375rem',
            }}>
              <img src="/seznik_logo.png" alt="Seznik" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            </div> */}
            <div>
              <img src="/seznik_logo.png" alt="Seznik" style={{ width: '8rem', height: 'auto', objectFit: 'contain', }} />
              <div style={{ fontSize: '0.725rem', fontWeight: 500, color: '#94a3b8', letterSpacing: '0.05em' }}>
                PREMIUM RETAIL POS
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto py-4 px-3">
            {navItems.map(item => {
              const isProducts = item.path === ROUTES.PRODUCTS
              const Icon = item.icon
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={() => onClose()}
                  className={({ isActive }) =>
                    clsx(
                      'flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-all mb-1',
                      isActive
                        ? 'bg-[#4f46e5] text-white shadow-lg shadow-indigo-500/20'
                        : 'text-gray-600 hover:bg-gray-200/60 dark:text-gray-400 dark:hover:bg-gray-700/50'
                    )
                  }
                >
                  <Icon size={18} className="mr-3 flex-shrink-0" />
                  {t(item.labelKey)}
                  {isProducts && lowStockCount > 0 && (
                    <span className="ml-auto bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 text-xs font-medium px-2 py-0.5 rounded-full">
                      {lowStockCount}
                    </span>
                  )}
                </NavLink>
              )
            })}
          </nav>

          {/* User Card */}
          <div className="px-3 pb-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl p-3 shadow-sm border border-gray-100 dark:border-gray-700">
              <div className="flex items-center gap-3">
                <img
                  src={user?.photoURL || `https://ui-avatars.com/api/?name=${userProfile?.displayName || user?.displayName || 'User'}&background=4f46e5&color=fff`}
                  alt={userProfile?.displayName || user?.displayName || 'User'}
                  className="w-9 h-9 rounded-full object-cover"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                    {userProfile?.displayName || user?.displayName || 'User'}
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
