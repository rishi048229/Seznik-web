import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { Home, ShoppingCart, Package, Settings, MoreHorizontal, X, FileText, Users, BarChart3, Wallet, CreditCard, Truck, TrendingUp, Tag, MoveLeft } from 'lucide-react'
import { clsx } from 'clsx'
import { ROUTES } from '@/constants/routes'
import { useAuth } from '@/contexts/AuthContext'
import { canAccessSuppliers, canAccessPurchases, canAccessExpenses, canAccessReports } from '@/utils/permissions'

const primaryItems = [
  { path: ROUTES.DASHBOARD, label: 'Home', icon: <Home size={20} /> },
  { path: ROUTES.POS, label: 'POS', icon: <ShoppingCart size={20} /> },
  { path: ROUTES.PRODUCTS, label: 'Products', icon: <Package size={20} /> },
  { path: ROUTES.SALES, label: 'Sales', icon: <FileText size={20} /> },
]

const getMoreItems = (permissions: ReturnType<typeof useAuth>['permissions']) => {
  const p = permissions ?? undefined
  return [
    { path: ROUTES.POS_LITE, label: 'POS Lite', icon: <MoveLeft size={20} /> },
    { path: ROUTES.CATEGORIES, label: 'Categories', icon: <Tag size={20} /> },
    { path: ROUTES.CUSTOMERS, label: 'Customers', icon: <Users size={20} /> },
    ...(canAccessSuppliers(p) ? [{ path: ROUTES.SUPPLIERS, label: 'Suppliers', icon: <Truck size={20} /> }] : []),
    ...(canAccessPurchases(p) ? [{ path: ROUTES.PURCHASES, label: 'Purchases', icon: <TrendingUp size={20} /> }] : []),
    ...(canAccessExpenses(p) ? [{ path: ROUTES.EXPENSES, label: 'Expenses', icon: <Wallet size={20} /> }] : []),
    { path: ROUTES.CREDITS, label: 'Credits', icon: <CreditCard size={20} /> },
    ...(canAccessReports(p) ? [{ path: ROUTES.REPORTS, label: 'Reports', icon: <BarChart3 size={20} /> }] : []),
    { path: ROUTES.SETTINGS, label: 'Settings', icon: <Settings size={20} /> },
  ]
}

export const MobileNav = () => {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const { permissions } = useAuth()
  const moreItems = getMoreItems(permissions)

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-30 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 lg:hidden safe-bottom">
        <div className="flex justify-around items-center h-16">
          {primaryItems.map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                clsx(
                  'flex flex-col items-center justify-center gap-0.5 flex-1 h-full text-[11px] font-medium transition-colors',
                  isActive
                    ? 'text-blue-600 dark:text-blue-400'
                    : 'text-gray-500 dark:text-gray-400'
                )
              }
            >
              {item.icon}
              <span>{item.label}</span>
            </NavLink>
          ))}
          <button
            onClick={() => setIsDrawerOpen(true)}
            className="flex flex-col items-center justify-center gap-0.5 flex-1 h-full text-[11px] font-medium text-gray-500 dark:text-gray-400"
          >
            <MoreHorizontal size={20} />
            <span>More</span>
          </button>
        </div>
      </nav>

      {/* More drawer */}
      {isDrawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setIsDrawerOpen(false)} />
          <div className="absolute bottom-0 left-0 right-0 bg-white dark:bg-gray-900 rounded-t-2xl pb-safe">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800">
              <span className="text-base font-semibold text-gray-900 dark:text-gray-100">Menu</span>
              <button onClick={() => setIsDrawerOpen(false)} className="p-1 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800">
                <X size={20} />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-1 p-4 max-h-[60vh] overflow-y-auto">
              {moreItems.map(item => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={() => setIsDrawerOpen(false)}
                  className={({ isActive }) =>
                    clsx(
                      'flex flex-col items-center justify-center gap-2 p-4 rounded-xl text-xs font-medium transition-colors',
                      isActive
                        ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                    )
                  }
                >
                  {item.icon}
                  <span className="text-center leading-tight">{item.label}</span>
                </NavLink>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
