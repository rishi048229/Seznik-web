import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import {
  Home,
  ShoppingCart,
  Package,
  Settings,
  MoreHorizontal,
  X,
  FileText,
  Users,
  BarChart3,
  Wallet,
  CreditCard,
  Truck,
  TrendingUp,
  Tag,
  MoveLeft,
  UtensilsCrossed,
  LayoutGrid,
  Plus,
  BookOpen,
  Ticket,
  Zap,
  Inbox,
} from 'lucide-react'
import { clsx } from 'clsx'
import { ROUTES } from '@/constants/routes'
import { useAuth } from '@/contexts/AuthContext'
import { canAccessSuppliers, canAccessPurchases, canAccessExpenses, canAccessReports } from '@/utils/permissions'
import { prefetchPage } from '@/utils/prefetchPages'
import { isKotFirstNav, isNavFeatureVisible } from '@/utils/businessFeatures'

type NavItem = {
  path: string
  label: string
  icon: React.ReactNode
}

export const MobileNav = () => {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const shouldReduceMotion = useReducedMotion()
  const { permissions, userProfile } = useAuth()
  const navigate = useNavigate()
  const businessType = userProfile?.businessType
  const kotFirst = isKotFirstNav(businessType)
  const showKot = isNavFeatureVisible(businessType, 'kot')
  const showTokens = isNavFeatureVisible(businessType, 'tokens')

  const primaryItems: NavItem[] = kotFirst
    ? [
        { path: ROUTES.DASHBOARD, label: 'Dashboard', icon: <Home size={20} /> },
        { path: ROUTES.KOT, label: 'Tables', icon: <LayoutGrid size={20} /> },
        { path: ROUTES.KOT_KDS, label: 'KOT Board', icon: <UtensilsCrossed size={20} /> },
      ]
    : [
        { path: ROUTES.DASHBOARD, label: 'Home', icon: <Home size={20} /> },
        { path: ROUTES.POS, label: 'Billing Counter', icon: <ShoppingCart size={20} /> },
        { path: ROUTES.PRODUCTS, label: 'Products', icon: <Package size={20} /> },
        { path: ROUTES.SALES, label: 'Sales', icon: <FileText size={20} /> },
      ]

  const p = permissions ?? undefined
  const moreItems: NavItem[] = kotFirst
    ? [
        { path: ROUTES.PRODUCTS, label: 'Menu', icon: <BookOpen size={20} /> },
        { path: ROUTES.KITCHEN_INVENTORY, label: 'Kitchen Inventory', icon: <UtensilsCrossed size={20} /> },
        ...(canAccessReports(p) ? [{ path: ROUTES.REPORTS, label: 'Reports', icon: <BarChart3 size={20} /> }] : []),
        { path: ROUTES.PRINTERS, label: 'Printers', icon: <Inbox size={20} /> },
        { path: `${ROUTES.SETTINGS}?tab=staff`, label: 'Staff & Roles', icon: <Users size={20} /> },
        { path: ROUTES.SETTINGS, label: 'Business Settings', icon: <Settings size={20} /> },
      ]
    : [
          { path: ROUTES.POS_LITE, label: 'Quick Bill', icon: <MoveLeft size={20} /> },
          ...(showKot
            ? [{ path: ROUTES.KOT, label: 'Tables / KOT', icon: <UtensilsCrossed size={20} /> }]
            : []),
          ...(showTokens
            ? [{ path: ROUTES.TOKENS, label: 'Quick Tokens', icon: <Ticket size={20} /> }]
            : []),
          { path: ROUTES.UTILITY_KIOSK, label: 'Utility Kiosk', icon: <Zap size={20} /> },
          { path: ROUTES.PRINT_JOBS, label: 'Requests', icon: <Inbox size={20} /> },
          { path: ROUTES.CATEGORIES, label: 'Categories', icon: <Tag size={20} /> },
          { path: ROUTES.CUSTOMERS, label: 'Customers', icon: <Users size={20} /> },
          ...(canAccessSuppliers(p) ? [{ path: ROUTES.SUPPLIERS, label: 'Suppliers', icon: <Truck size={20} /> }] : []),
          ...(canAccessPurchases(p) ? [{ path: ROUTES.PURCHASES, label: 'Purchases', icon: <TrendingUp size={20} /> }] : []),
          ...(canAccessExpenses(p) ? [{ path: ROUTES.EXPENSES, label: 'Expenses', icon: <Wallet size={20} /> }] : []),
          { path: ROUTES.CREDITS, label: 'Credits', icon: <CreditCard size={20} /> },
          ...(canAccessReports(p) ? [{ path: ROUTES.REPORTS, label: 'Reports', icon: <BarChart3 size={20} /> }] : []),
          { path: ROUTES.SETTINGS, label: 'Settings', icon: <Settings size={20} /> },
        ]

  return (
    <>
      <motion.nav
        initial={shouldReduceMotion ? false : { y: 26, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.08, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="fixed bottom-0 left-0 right-0 z-30 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border-t border-gray-200/80 dark:border-gray-700 lg:hidden safe-bottom"
      >
        <div className="flex justify-around items-center h-16">
          {primaryItems.slice(0, 2).map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              onMouseEnter={() => prefetchPage(item.path)}
              onFocus={() => prefetchPage(item.path)}
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

          {kotFirst ? (
            <button
              type="button"
              onClick={() => navigate(`${ROUTES.KOT}?new=1`)}
              className="flex flex-col items-center justify-center gap-0.5 flex-1 h-full text-[11px] font-medium text-blue-600 dark:text-blue-400"
              aria-label="New Bill"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#0a0a2e] text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-md -mt-3">
                <Plus size={20} strokeWidth={2.5} />
              </span>
              <span>New Bill</span>
            </button>
          ) : null}

          {primaryItems.slice(kotFirst ? 2 : 2).map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              onMouseEnter={() => prefetchPage(item.path)}
              onFocus={() => prefetchPage(item.path)}
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
          {!kotFirst ? (
          <button
            onClick={() => setIsDrawerOpen(true)}
            className="flex flex-col items-center justify-center gap-0.5 flex-1 h-full text-[11px] font-medium text-gray-500 dark:text-gray-400"
          >
            <MoreHorizontal size={20} />
            <span>More</span>
          </button>
          ) : null}
        </div>
      </motion.nav>

      {/* More drawer */}
      <AnimatePresence>
      {isDrawerOpen && (
        <motion.div
          className="fixed inset-0 z-50 lg:hidden"
          initial={shouldReduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          <motion.div className="absolute inset-0 bg-black/50" onClick={() => setIsDrawerOpen(false)} />
          <motion.div
            className="absolute bottom-0 left-0 right-0 bg-white dark:bg-gray-900 rounded-t-2xl pb-safe shadow-[0_-12px_36px_rgba(15,23,42,0.16)]"
            initial={shouldReduceMotion ? false : { y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 27, stiffness: 300 }}
          >
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
                  onMouseEnter={() => prefetchPage(item.path)}
                  onFocus={() => prefetchPage(item.path)}
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
          </motion.div>
        </motion.div>
      )}
      </AnimatePresence>
    </>
  )
}
