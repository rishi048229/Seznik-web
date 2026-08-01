import { useNavigate, useLocation } from 'react-router-dom'
import { Tabs } from '@/components/ui/Tabs'
import { ROUTES } from '@/constants/routes'
import { useLanguage } from '@/contexts/LanguageContext'

export const ReportTabs = () => {
  const { t } = useLanguage()
  const navigate = useNavigate()
  const location = useLocation()

  const reportTabs = [
    { key: 'overview', label: t('reports.tabOverview') },
    { key: 'sales', label: t('reports.salesReportTitle') },
    { key: 'pl', label: t('reports.profitLossTitle') },
    { key: 'tax', label: t('reports.taxReportTitle') },
  ]

  let activeTab = 'overview'
  if (location.pathname === ROUTES.REPORTS_SALES) activeTab = 'sales'
  else if (location.pathname === ROUTES.REPORTS_PL) activeTab = 'pl'
  else if (location.pathname === ROUTES.REPORTS_TAX) activeTab = 'tax'

  const handleTabChange = (key: string) => {
    if (key === 'overview') navigate(ROUTES.REPORTS)
    else if (key === 'sales') navigate(ROUTES.REPORTS_SALES)
    else if (key === 'pl') navigate(ROUTES.REPORTS_PL)
    else if (key === 'tax') navigate(ROUTES.REPORTS_TAX)
  }

  return <Tabs tabs={reportTabs} activeTab={activeTab} onChange={handleTabChange} className="mb-6" />
}
