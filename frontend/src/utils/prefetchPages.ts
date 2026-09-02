import { ROUTES } from '@/constants/routes'

const PAGE_IMPORTS: Record<string, () => Promise<unknown>> = {
  [ROUTES.DASHBOARD]: () => import('@/pages/dashboard/DashboardPage'),
  [ROUTES.POS]: () => import('@/pages/pos/POSPage'),
  [ROUTES.POS_LITE]: () => import('@/pages/pos/POSLitePage'),
  [ROUTES.TOKENS]: () => import('@/pages/tokens/QuickTokensPage'),
  [ROUTES.PRODUCTS]: () => import('@/pages/products/ProductsPage'),
  [ROUTES.CATEGORIES]: () => import('@/pages/categories/CategoriesPage'),
  [ROUTES.LOCATIONS]: () => import('@/pages/locations/LocationsPage'),
  [ROUTES.CUSTOMERS]: () => import('@/pages/customers/CustomersPage'),
  [ROUTES.SUPPLIERS]: () => import('@/pages/suppliers/SuppliersPage'),
  [ROUTES.SALES]: () => import('@/pages/sales/SalesPage'),
  [ROUTES.PURCHASES]: () => import('@/pages/purchases/PurchasesPage'),
  [ROUTES.EXPENSES]: () => import('@/pages/expenses/ExpensesPage'),
  [ROUTES.CREDITS]: () => import('@/pages/credits/CreditsPage'),
  [ROUTES.DAYBOOK]: () => import('@/pages/credits/DaybookPage'),
  [ROUTES.REPORTS]: () => import('@/pages/reports/ReportsPage'),
  [ROUTES.REPORTS_SALES]: () => import('@/pages/reports/SalesReportPage'),
  [ROUTES.REPORTS_PL]: () => import('@/pages/reports/ProfitLossPage'),
  [ROUTES.REPORTS_TAX]: () => import('@/pages/reports/TaxReportPage'),
  [ROUTES.SETTINGS]: () => import('@/pages/settings/SettingsPage'),
  [ROUTES.PRINTERS]: () => import('@/pages/printers/PrintersPage'),
  [ROUTES.KOT]: () => import('@/pages/kot/KOTPage'),
  [ROUTES.KOT_KDS]: () => import('@/pages/kot/KDSPage'),
}

const CORE_PATHS = [
  ROUTES.DASHBOARD,
  ROUTES.POS,
  ROUTES.POS_LITE,
  ROUTES.KOT,
  ROUTES.PRODUCTS,
  ROUTES.SALES,
]

export const prefetchPage = (path: string) => {
  const loader = PAGE_IMPORTS[path]
  if (loader) void loader()
}

export const prefetchCorePages = () => {
  CORE_PATHS.forEach(prefetchPage)
}
