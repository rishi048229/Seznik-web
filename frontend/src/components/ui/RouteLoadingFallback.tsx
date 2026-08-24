import { useLocation } from 'react-router-dom'
import { ROUTES } from '@/constants/routes'
import { AppShellSkeleton } from './AppShellSkeleton'
import {
  AuthPageSkeleton,
  DashboardSkeleton,
  DetailPageSkeleton,
  POSPageSkeleton,
  SettingsPageSkeleton,
  TablePageSkeleton,
  TokensPageSkeleton,
} from './PageSkeleton'

function isAuthRoute(pathname: string) {
  return (
    pathname === ROUTES.LOGIN ||
    pathname === ROUTES.ACCESS_SELECTION ||
    pathname === ROUTES.ONBOARDING
  )
}

function getPageSkeleton(pathname: string) {
  if (pathname.startsWith(ROUTES.DASHBOARD)) return <DashboardSkeleton />
  if (pathname.startsWith(ROUTES.POS_LITE) || pathname.startsWith(ROUTES.POS)) return <POSPageSkeleton />
  if (pathname.startsWith(ROUTES.SETTINGS) || pathname.startsWith(ROUTES.PRINTERS)) {
    return <SettingsPageSkeleton />
  }
  if (pathname.startsWith(ROUTES.REPORTS)) {
    return <TablePageSkeleton cards={3} rows={6} columns={4} />
  }
  if (pathname.startsWith('/sales/') || pathname.startsWith('/customers/')) {
    return <DetailPageSkeleton />
  }
  if (pathname.startsWith(ROUTES.TOKENS)) return <TokensPageSkeleton />
  if (pathname.startsWith(ROUTES.CREDITS) || pathname.startsWith(ROUTES.DAYBOOK)) {
    return <TablePageSkeleton cards={4} rows={6} columns={5} />
  }
  return <TablePageSkeleton />
}

export const RouteLoadingFallback = () => {
  const { pathname } = useLocation()

  if (isAuthRoute(pathname)) {
    return <AuthPageSkeleton />
  }

  return <AppShellSkeleton>{getPageSkeleton(pathname)}</AppShellSkeleton>
}
