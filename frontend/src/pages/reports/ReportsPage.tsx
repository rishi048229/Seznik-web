import { PageHeader } from '@/components/layout/PageHeader'
import { Card } from '@/components/ui/Card'
import { ROUTES } from '@/constants/routes'
import { useNavigate } from 'react-router-dom'
import { ReportTabs } from './ReportTabs'
import { TrendingUp, FileText, Receipt } from 'lucide-react'
import { PageVideoTutorialModal } from '@/components/common/PageVideoTutorialModal'
import { InteractivePageTour } from '@/components/common/InteractivePageTour'
import { usePageTutorial } from '@/hooks/usePageTutorial'
import { useLanguage } from '@/contexts/LanguageContext'

export const ReportsPage = () => {
  const { t } = useLanguage()
  const pageTutorial = usePageTutorial('reports')
  const navigate = useNavigate()

  return (
    <div>
      <div data-tour="reports-header">
        <PageHeader title={t('page.reports')} onWatchTutorial={pageTutorial.openTutorial} />
      </div>
      <ReportTabs />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card
          data-tour="report-card-sales"
          className="p-6 cursor-pointer hover:shadow-lg transition-all hover:border-blue-200 dark:hover:border-blue-800"
          onClick={() => navigate(ROUTES.REPORTS_SALES)}
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="p-3 bg-blue-50 dark:bg-blue-900/30 text-blue-600 rounded-xl">
              <FileText size={24} />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Sales Report</h3>
              <p className="text-xs text-blue-600 font-medium">View Revenue & Invoices →</p>
            </div>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">View daily revenue trends, invoice counts, order averages, and export to Excel.</p>
        </Card>

        <Card
          data-tour="report-card-pl"
          className="p-6 cursor-pointer hover:shadow-lg transition-all hover:border-emerald-200 dark:hover:border-emerald-800"
          onClick={() => navigate(ROUTES.REPORTS_PL)}
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="p-3 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 rounded-xl">
              <TrendingUp size={24} />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Profit & Loss</h3>
              <p className="text-xs text-emerald-600 font-medium">View Net Profit Statement →</p>
            </div>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">Detailed breakdown of total revenue, estimated costs, operating expenses, and net profit.</p>
        </Card>

        <Card
          data-tour="report-card-tax"
          className="p-6 cursor-pointer hover:shadow-lg transition-all hover:border-purple-200 dark:hover:border-purple-800"
          onClick={() => navigate(ROUTES.REPORTS_TAX)}
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="p-3 bg-purple-50 dark:bg-purple-900/30 text-purple-600 rounded-xl">
              <Receipt size={24} />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Tax Report</h3>
              <p className="text-xs text-purple-600 font-medium">View Output Tax Collected →</p>
            </div>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">Summary of total output tax collected, taxable sales count, and average tax per sale.</p>
        </Card>
      </div>

      {/* Tutorial Video Modal & Guided Onboarding Tour */}
      <PageVideoTutorialModal
        isOpen={pageTutorial.isTutorialOpen}
        onClose={pageTutorial.closeTutorial}
        tutorial={pageTutorial.tutorialData}
        onStartTour={pageTutorial.startTour}
      />
      <InteractivePageTour
        pageKey="reports"
        steps={pageTutorial.tutorialData.tourSteps}
        isOpen={pageTutorial.isTourOpen}
        onClose={pageTutorial.closeTour}
      />
    </div>
  )
}
