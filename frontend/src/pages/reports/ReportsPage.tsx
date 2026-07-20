import { Tabs } from '@/components/ui/Tabs'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card } from '@/components/ui/Card'
import { useState } from 'react'
import { ROUTES } from '@/constants/routes'
import { useNavigate } from 'react-router-dom'

const reportTabs = [
  { key: 'sales', label: 'Sales Report' },
  { key: 'pl', label: 'Profit & Loss' },
  { key: 'tax', label: 'Tax Report' },
]

export const ReportsPage = () => {
  const [activeTab, setActiveTab] = useState('sales')
  const navigate = useNavigate()

  const handleTabChange = (key: string) => {
    setActiveTab(key)
    if (key === 'sales') navigate(ROUTES.REPORTS_SALES)
    else if (key === 'pl') navigate(ROUTES.REPORTS_PL)
    else if (key === 'tax') navigate(ROUTES.REPORTS_TAX)
  }

  return (
    <div>
      <PageHeader title="Reports" />
      <Tabs tabs={reportTabs} activeTab={activeTab} onChange={handleTabChange} className="mb-6" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card
          className="p-6 cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => navigate(ROUTES.REPORTS_SALES)}
        >
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Sales Report</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">View daily revenue trends, invoice counts, and export to Excel</p>
        </Card>
        <Card
          className="p-6 cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => navigate(ROUTES.REPORTS_PL)}
        >
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Profit & Loss</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">Revenue, costs, expenses and net profit analysis</p>
        </Card>
        <Card
          className="p-6 cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => navigate(ROUTES.REPORTS_TAX)}
        >
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Tax Report</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">Output tax collected and taxable sales summary</p>
        </Card>
      </div>
    </div>
  )
}
