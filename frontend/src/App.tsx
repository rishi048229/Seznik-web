import { useState, lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
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
import type { UserPermissions } from '@/types/auth.types'

// Helper to lazy-load named exports as default components
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const lazyPage = <T extends Record<string, any>>(importFn: () => Promise<T>, name: keyof T) =>
  lazy(() => importFn().then(module => ({ default: module[name] as React.ComponentType })))

// Lazy-loaded pages (named exports → default for React.lazy)
const LandingPage = lazyPage(() => import('@/pages/landing/LandingPage'), 'LandingPage')
const LoginPage = lazyPage(() => import('@/pages/auth/LoginPage'), 'LoginPage')
const AccessSelectionPage = lazyPage(() => import('@/pages/auth/AccessSelectionPage'), 'AccessSelectionPage')
const OnboardingPage = lazyPage(() => import('@/pages/auth/OnboardingPage'), 'OnboardingPage')
const DashboardPage = lazyPage(() => import('@/pages/dashboard/DashboardPage'), 'DashboardPage')
const POSPage = lazyPage(() => import('@/pages/pos/POSPage'), 'POSPage')
const POSLitePage = lazyPage(() => import('@/pages/pos/POSLitePage'), 'POSLitePage')
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
const ReportsPage = lazyPage(() => import('@/pages/reports/ReportsPage'), 'ReportsPage')
const SalesReportPage = lazyPage(() => import('@/pages/reports/SalesReportPage'), 'SalesReportPage')
const ProfitLossPage = lazyPage(() => import('@/pages/reports/ProfitLossPage'), 'ProfitLossPage')
const TaxReportPage = lazyPage(() => import('@/pages/reports/TaxReportPage'), 'TaxReportPage')
const SettingsPage = lazyPage(() => import('@/pages/settings/SettingsPage'), 'SettingsPage')
const PrintersPage = lazyPage(() => import('@/pages/printers/PrintersPage'), 'PrintersPage')

const LoadingFallback = (
  <div className="flex justify-center py-12">
    <Spinner size="lg" />
  </div>
)

const MainLayout = ({ children }: { children: React.ReactNode }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <AppLayout
      sidebar={<Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />}
      topbar={<Topbar onMenuClick={() => setSidebarOpen(true)} />}
    >
      {children}
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
    if (hasSelectedWorkspace || userProfile?.role) {
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

  if (hasSelectedWorkspace || userProfile?.role) {
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
              <Route path={ROUTES.LANDING} element={<LandingPage />} />
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
              <Route path={ROUTES.DASHBOARD} element={<AuthenticatedRoute><MainLayout><DashboardPage /></MainLayout></AuthenticatedRoute>} />
              <Route path={ROUTES.POS} element={<AuthenticatedRoute><MainLayout><POSPage /></MainLayout></AuthenticatedRoute>} />
              <Route path={ROUTES.POS_LITE} element={<AuthenticatedRoute><MainLayout><POSLitePage /></MainLayout></AuthenticatedRoute>} />
              <Route path={ROUTES.PRODUCTS} element={<AuthenticatedRoute><MainLayout><ProductsPage /></MainLayout></AuthenticatedRoute>} />
              <Route path={ROUTES.CATEGORIES} element={<AuthenticatedRoute><MainLayout><CategoriesPage /></MainLayout></AuthenticatedRoute>} />
              <Route path={ROUTES.CUSTOMERS} element={<AuthenticatedRoute><MainLayout><CustomersPage /></MainLayout></AuthenticatedRoute>} />
              <Route path="/customers/:id" element={<AuthenticatedRoute><MainLayout><CustomerDetailPage /></MainLayout></AuthenticatedRoute>} />
              <Route path={ROUTES.SUPPLIERS} element={<AuthenticatedRoute><PermissionRoute permission="canAccessSuppliers"><MainLayout><SuppliersPage /></MainLayout></PermissionRoute></AuthenticatedRoute>} />
              <Route path={ROUTES.SALES} element={<AuthenticatedRoute><MainLayout><SalesPage /></MainLayout></AuthenticatedRoute>} />
              <Route path="/sales/:id" element={<AuthenticatedRoute><MainLayout><SaleDetailPage /></MainLayout></AuthenticatedRoute>} />
              <Route path={ROUTES.PURCHASES} element={<AuthenticatedRoute><PermissionRoute permission="canAccessPurchases"><MainLayout><PurchasesPage /></MainLayout></PermissionRoute></AuthenticatedRoute>} />
              <Route path={ROUTES.EXPENSES} element={<AuthenticatedRoute><PermissionRoute permission="canAccessExpenses"><MainLayout><ExpensesPage /></MainLayout></PermissionRoute></AuthenticatedRoute>} />
              <Route path={ROUTES.CREDITS} element={<AuthenticatedRoute><MainLayout><CreditsPage /></MainLayout></AuthenticatedRoute>} />
              <Route path={ROUTES.REPORTS} element={<AuthenticatedRoute><PermissionRoute permission="canAccessReports"><MainLayout><ReportsPage /></MainLayout></PermissionRoute></AuthenticatedRoute>} />
              <Route path={ROUTES.REPORTS_SALES} element={<AuthenticatedRoute><PermissionRoute permission="canAccessReports"><MainLayout><SalesReportPage /></MainLayout></PermissionRoute></AuthenticatedRoute>} />
              <Route path={ROUTES.REPORTS_PL} element={<AuthenticatedRoute><PermissionRoute permission="canAccessReports"><MainLayout><ProfitLossPage /></MainLayout></PermissionRoute></AuthenticatedRoute>} />
              <Route path={ROUTES.REPORTS_TAX} element={<AuthenticatedRoute><PermissionRoute permission="canAccessReports"><MainLayout><TaxReportPage /></MainLayout></PermissionRoute></AuthenticatedRoute>} />
              <Route path={ROUTES.SETTINGS} element={<AuthenticatedRoute><MainLayout><SettingsPage /></MainLayout></AuthenticatedRoute>} />
              <Route path={ROUTES.PRINTERS} element={<AuthenticatedRoute><MainLayout><PrintersPage /></MainLayout></AuthenticatedRoute>} />
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
