import { useNavigate, useLocation } from 'react-router-dom'
import { Tabs } from '@/components/ui/Tabs'
import { ROUTES } from '@/constants/routes'

const reportTabs = [
  { key: 'overview', label: 'Reports Overview' },
  { key: 'sales', label: 'Sales Report' },
  { key: 'pl', label: 'Profit & Loss' },
  { key: 'tax', label: 'Tax Report' },
]

export const ReportTabs = () => {
  const navigate = useNavigate()
  const location = useLocation()

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
