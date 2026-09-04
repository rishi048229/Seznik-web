import { useState, useEffect, lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from '@/contexts/AuthContext'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { LanguageProvider } from '@/contexts/LanguageContext'
import { AppLayout } from '@/components/layout/AppLayout'
import { Sidebar } from '@/components/layout/Sidebar'
import { Topbar } from '@/components/layout/Topbar'
import { MobileNav } from '@/components/layout/MobileNav'
import { Spinner } from '@/components/ui/Spinner'
import { HelpChatBot } from '@/components/ui/HelpChatBot'
import { ROUTES } from '@/constants/routes'
import { useAuth } from '@/contexts/AuthContext'
import { prefetchCorePages } from '@/utils/prefetchPages'
import type { UserPermissions } from '@/types/auth.types'

// Helper to lazy-load named exports as default components.
//
// Retries once on a failed chunk load (import().catch below) before giving
// up. A stale browser tab left open across a redeploy still references the
// PREVIOUS build's hashed chunk filenames — those files no longer exist on
// the server once a new build has shipped, so the dynamic import 404s. That
// used to throw straight into render with nothing catching it, blanking the
// whole app until the user figured out to hit refresh themselves. Now it
// reloads once automatically (fetching a fresh index.html with the correct
// current hashes) instead of surfacing that as a blank screen; a genuinely
// persistent failure still surfaces normally via ErrorBoundary rather than
// reload-looping forever.
const CHUNK_RELOAD_KEY = 'chunk-reload-attempted'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const lazyPage = <T extends Record<string, any>>(importFn: () => Promise<T>, name: keyof T) =>
  lazy(() =>
    importFn()
      .then(module => {
        sessionStorage.removeItem(CHUNK_RELOAD_KEY)
        return { default: module[name] as React.ComponentType }
      })
      .catch(err => {
        if (!sessionStorage.getItem(CHUNK_RELOAD_KEY)) {
          sessionStorage.setItem(CHUNK_RELOAD_KEY, '1')
          window.location.reload()
          // Never resolves — the reload above replaces this page before
          // React would get a chance to render anything from this branch.
          return new Promise<{ default: React.ComponentType }>(() => {})
        }
        throw err
      })
  )

// Lazy-loaded pages (named exports → default for React.lazy)
// NOTE: the marketing landing page (src/pages/landing/) is built but intentionally
// disconnected from routing for this version — picking back up next version.
const LoginPage = lazyPage(() => import('@/pages/auth/LoginPage'), 'LoginPage')
const AccessSelectionPage = lazyPage(() => import('@/pages/auth/AccessSelectionPage'), 'AccessSelectionPage')
const OnboardingPage = lazyPage(() => import('@/pages/auth/OnboardingPage'), 'OnboardingPage')
const DashboardPage = lazyPage(() => import('@/pages/dashboard/DashboardPage'), 'DashboardPage')
const POSPage = lazyPage(() => import('@/pages/pos/POSPage'), 'POSPage')
const POSLitePage = lazyPage(() => import('@/pages/pos/POSLitePage'), 'POSLitePage')
const QuickTokensPage = lazyPage(() => import('@/pages/tokens/QuickTokensPage'), 'QuickTokensPage')
const ProductsPage = lazyPage(() => import('@/pages/products/ProductsPage'), 'ProductsPage')
const CategoriesPage = lazyPage(() => import('@/pages/categories/CategoriesPage'), 'CategoriesPage')
const CustomersPage = lazyPage(() => import('@/pages/customers/CustomersPage'), 'CustomersPage')
const CustomerDetailPage = lazyPage(() => import('@/pages/customers/CustomerDetailPage'), 'CustomerDetailPage')
const SuppliersPage = lazyPage(() => import('@/pages/suppliers/SuppliersPage'), 'SuppliersPage')
const SalesPage = lazyPage(() => import('@/pages/sales/SalesPage'), 'SalesPage')
const SaleDetailPage = lazyPage(() => import('@/pages/sales/SaleDetailPage'), 'SaleDetailPage')
const PurchasesPage = lazyPage(() => import('@/pages/purchases/PurchasesPage'), 'PurchasesPage')
const ExpensesPage = lazyPage(() => import('@/pages/expenses/ExpensesPage'), 'ExpensesPage')
const CreditsPage = lazyPage(() => import('@/pages/credits/CreditsPage'), 'CreditsPage')
const DaybookPage = lazyPage(() => import('@/pages/credits/DaybookPage'), 'DaybookPage')
const ReportsPage = lazyPage(() => import('@/pages/reports/ReportsPage'), 'ReportsPage')
const SalesReportPage = lazyPage(() => import('@/pages/reports/SalesReportPage'), 'SalesReportPage')
const ProfitLossPage = lazyPage(() => import('@/pages/reports/ProfitLossPage'), 'ProfitLossPage')
const TaxReportPage = lazyPage(() => import('@/pages/reports/TaxReportPage'), 'TaxReportPage')
const SettingsPage = lazyPage(() => import('@/pages/settings/SettingsPage'), 'SettingsPage')
const PrintersPage = lazyPage(() => import('@/pages/printers/PrintersPage'), 'PrintersPage')
const KOTPage = lazyPage(() => import('@/pages/kot/KOTPage'), 'KOTPage')
const KDSPage = lazyPage(() => import('@/pages/kot/KDSPage'), 'KDSPage')

const LoadingFallback = (
  <div className="flex justify-center py-12">
    <Spinner size="lg" />
  </div>
)

const MainLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    const idle = window.requestIdleCallback
    if (idle) {
      const id = idle(() => prefetchCorePages())
      return () => window.cancelIdleCallback(id)
    }
    const timer = window.setTimeout(() => prefetchCorePages(), 400)
    return () => window.clearTimeout(timer)
  }, [])

  return (
    <AppLayout
      sidebar={<Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />}
      topbar={<Topbar onMenuClick={() => setSidebarOpen(true)} />}
    >
      <Suspense fallback={LoadingFallback}>
        <Outlet />
      </Suspense>
      <MobileNav />
      <HelpChatBot />
    </AppLayout>
  )
}

// Route guard for login page
const LoginRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, userProfile, hasSelectedWorkspace, loading } = useAuth()
  const needsOnboarding = userProfile?.onboardingCompleted === false

  if (loading) {
    return LoadingFallback
  }

  // If already authenticated, continue to dashboard if role selected, else access selection.
  if (user) {
    if (needsOnboarding) {
      return <Navigate to={ROUTES.ONBOARDING} replace />
    }
    if (hasSelectedWorkspace && userProfile?.role) {
      return <Navigate to={ROUTES.DASHBOARD} replace />
    }
    return <Navigate to={ROUTES.ACCESS_SELECTION} replace />
  }

  return <>{children}</>
}

// Route guard for role selection
const RoleSelectionRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, userProfile, hasSelectedWorkspace, loading } = useAuth()
  const needsOnboarding = userProfile?.onboardingCompleted === false
  
  if (loading) {
    return LoadingFallback
  }
  
  // If no user, redirect to login
  if (!user) {
    return <Navigate to={ROUTES.LOGIN} replace />
  }

  // New users must finish onboarding before creating/selecting credentials.
  if (needsOnboarding) {
    return <Navigate to={ROUTES.ONBOARDING} replace />
  }

  if (hasSelectedWorkspace && userProfile?.role) {
    return <Navigate to={ROUTES.DASHBOARD} replace />
  }

  return <>{children}</>
}

// Route guard for onboarding
const OnboardingRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, userProfile, loading } = useAuth()
  const needsOnboarding = userProfile?.onboardingCompleted === false

  if (loading) {
    return LoadingFallback
  }

  if (!user) {
    return <Navigate to={ROUTES.LOGIN} replace />
  }

  if (!needsOnboarding) {
    return <Navigate to={ROUTES.ACCESS_SELECTION} replace />
  }

  return <>{children}</>
}

// Route guard for authenticated users with role
const AuthenticatedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, userProfile, hasSelectedWorkspace, loading } = useAuth()

  if (loading) {
    return LoadingFallback
  }

  // If no user, redirect to login
  if (!user) {
    return <Navigate to={ROUTES.LOGIN} replace />
  }

  // If user doesn't have role, redirect to access selection
  if (!hasSelectedWorkspace || !userProfile?.role) {
    return <Navigate to={ROUTES.ACCESS_SELECTION} replace />
  }

  return <>{children}</>
}

// Permission-gated route: admins bypass; agents need the specific flag, else
// they're bounced to the dashboard (they also can't see the nav link).
const PermissionRoute = ({ permission, children }: { permission: keyof UserPermissions; children: React.ReactNode }) => {
  const { userProfile, permissions } = useAuth()

  if (userProfile?.role === 'admin') {
    return <>{children}</>
  }
  if (!permissions || !permissions[permission]) {
    return <Navigate to={ROUTES.DASHBOARD} replace />
  }
  return <>{children}</>
}

function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <LanguageProvider>
        <AuthProvider>
          <Toaster position="top-right" />
          <Suspense fallback={LoadingFallback}>
            <Routes>
              <Route path="/" element={<Navigate to={ROUTES.LOGIN} replace />} />
              <Route
                path={ROUTES.LOGIN}
                element={
                  <LoginRoute>
                    <LoginPage />
                  </LoginRoute>
                }
              />
              <Route
                path={ROUTES.ACCESS_SELECTION}
                element={
                  <RoleSelectionRoute>
                    <AccessSelectionPage />
                  </RoleSelectionRoute>
                }
              />
              <Route path={ROUTES.ONBOARDING} element={<OnboardingRoute><OnboardingPage /></OnboardingRoute>} />
              <Route element={<AuthenticatedRoute><MainLayout /></AuthenticatedRoute>}>
                <Route path={ROUTES.DASHBOARD} element={<DashboardPage />} />
                <Route path={ROUTES.POS} element={<POSPage />} />
                <Route path={ROUTES.POS_LITE} element={<POSLitePage />} />
                <Route path={ROUTES.TOKENS} element={<QuickTokensPage />} />
                <Route path={ROUTES.PRODUCTS} element={<ProductsPage />} />
                <Route path={ROUTES.CATEGORIES} element={<CategoriesPage />} />
                <Route path={ROUTES.LOCATIONS} element={<Navigate to={ROUTES.DASHBOARD} replace />} />
                <Route path={ROUTES.CUSTOMERS} element={<CustomersPage />} />
                <Route path="/customers/:id" element={<CustomerDetailPage />} />
                <Route path={ROUTES.SUPPLIERS} element={<PermissionRoute permission="canAccessSuppliers"><SuppliersPage /></PermissionRoute>} />
                <Route path={ROUTES.SALES} element={<SalesPage />} />
                <Route path="/sales/:id" element={<SaleDetailPage />} />
                <Route path={ROUTES.PURCHASES} element={<PermissionRoute permission="canAccessPurchases"><PurchasesPage /></PermissionRoute>} />
                <Route path={ROUTES.EXPENSES} element={<PermissionRoute permission="canAccessExpenses"><ExpensesPage /></PermissionRoute>} />
                <Route path={ROUTES.CREDITS} element={<CreditsPage />} />
                <Route path={ROUTES.DAYBOOK} element={<DaybookPage />} />
                <Route path={ROUTES.REPORTS} element={<PermissionRoute permission="canAccessReports"><ReportsPage /></PermissionRoute>} />
                <Route path={ROUTES.REPORTS_SALES} element={<PermissionRoute permission="canAccessReports"><SalesReportPage /></PermissionRoute>} />
                <Route path={ROUTES.REPORTS_PL} element={<PermissionRoute permission="canAccessReports"><ProfitLossPage /></PermissionRoute>} />
                <Route path={ROUTES.REPORTS_TAX} element={<PermissionRoute permission="canAccessReports"><TaxReportPage /></PermissionRoute>} />
                <Route path={ROUTES.SETTINGS} element={<SettingsPage />} />
                <Route path={ROUTES.PRINTERS} element={<PrintersPage />} />
                <Route path={ROUTES.KOT_KDS} element={<KDSPage />} />
                <Route path={ROUTES.KOT} element={<KOTPage />} />
              </Route>
              <Route path="*" element={<Navigate to={ROUTES.ACCESS_SELECTION} replace />} />
            </Routes>
          </Suspense>
        </AuthProvider>
        </LanguageProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}

export default App
