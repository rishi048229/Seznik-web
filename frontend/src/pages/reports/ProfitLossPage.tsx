import { useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Spinner } from '@/components/ui/Spinner'
import { TablePageSkeleton } from '@/components/ui/PageSkeleton'
import { usePLReport } from '@/hooks/useReports'
import { Download, TrendingUp, TrendingDown, Share2 } from 'lucide-react'
import { formatINR } from '@/utils/currency'
import * as XLSX from 'xlsx'
import toast from 'react-hot-toast'

import { ReportTabs } from './ReportTabs'
import { useLanguage } from '@/contexts/LanguageContext'

export const ProfitLossPage = () => {
  const { t } = useLanguage()
  const today = new Date()
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1)
  const [startDate, setStartDate] = useState(firstDay.toISOString().split('T')[0])
  const [endDate, setEndDate] = useState(today.toISOString().split('T')[0])
  const [isShareOpen, setIsShareOpen] = useState(false)
  const [sharePhone, setSharePhone] = useState('')

  const endOfDay = (d: string) => { const dt = new Date(d); dt.setHours(23, 59, 59, 999); return dt }
  const { data: report, isLoading } = usePLReport(new Date(startDate), endOfDay(endDate))

  const handleExport = () => {
    if (!report) {
      toast.error(t('reports.noDataToExport'))
      return
    }
    const ws = XLSX.utils.aoa_to_sheet([
      ['Profit & Loss Statement'],
      ['Period', report.period],
      ['', ''],
      ['Description', 'Amount'],
      ['Total Revenue', report.totalRevenue],
      ['Total Cost (estimated)', report.totalCost],
      ['Gross Profit', report.totalRevenue - report.totalCost],
      ['Total Expenses', report.totalExpenses],
      ['Net Profit', report.netProfit],
    ])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'P&L Report')
    XLSX.writeFile(wb, `profit-loss-${startDate}-${endDate}.xlsx`)
    toast.success(t('reports.exportedSuccess'))
  }

  if (isLoading) {
    return (
      <div>
        <PageHeader title={t('reports.profitLossTitle')} breadcrumb={[t('reports.breadcrumbReports'), t('reports.breadcrumbPL')]} />
        <ReportTabs />
        <TablePageSkeleton cards={4} rows={6} columns={4} />
      </div>
    )
  }

  if (!report) {
    return (
      <div>
        <PageHeader title={t('reports.profitLossTitle')} breadcrumb={[t('reports.breadcrumbReports'), t('reports.breadcrumbPL')]} />
        <ReportTabs />
        <Card className="p-8 text-center">
          <p className="text-gray-500">{t('reports.noDataPeriod')}</p>
        </Card>
      </div>
    )
  }

  const grossProfit = report.totalRevenue - report.totalCost
  const grossMargin = report.totalRevenue > 0 ? (grossProfit / report.totalRevenue) * 100 : 0
  const netMargin = report.totalRevenue > 0 ? (report.netProfit / report.totalRevenue) * 100 : 0

  const handleWhatsAppShare = () => {
    const raw = sharePhone.replace(/\D/g, '')
    const phone = raw.startsWith('0') ? '91' + raw.slice(1) : raw.length === 10 ? '91' + raw : raw
    if (phone.length < 10) { toast.error(t('sales.errValidPhone')); return }

    const msg = [
      `📊 *Profit & Loss Report*`,
      `Period: ${startDate} to ${endDate}`,
      ``,
      `Revenue          : ${formatINR(report.totalRevenue)}`,
      `Cost of Goods    : - ${formatINR(report.totalCost)}`,
      `*Gross Profit    : ${formatINR(grossProfit)} (${grossMargin.toFixed(1)}%)*`,
      `Operating Expenses: - ${formatINR(report.totalExpenses)}`,
      `*Net Profit      : ${formatINR(report.netProfit)} (${netMargin.toFixed(1)}%)*`,
    ].join('\n')

    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener,noreferrer')
    setIsShareOpen(false)
    setSharePhone('')
  }

  return (
    <div>
      <PageHeader
        title={t('reports.profitLossTitle')}
        breadcrumb={[t('reports.breadcrumbReports'), t('reports.breadcrumbPL')]}
        action={
          <div className="flex gap-2">
            <Button leftIcon={<Share2 size={16} />} onClick={() => setIsShareOpen(true)} variant="outline" className="text-green-600 border-green-300 hover:bg-green-50">
              {t('daybook.shareWhatsApp')}
            </Button>
            <Button leftIcon={<Download size={16} />} onClick={handleExport} variant="outline">
              {t('common.exportExcel')}
            </Button>
          </div>
        }
      />
      <ReportTabs />

      {/* Date Range Filter */}
      <Card className="p-4 mb-6">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[150px]">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('common.startDate')}</label>
            <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
          </div>
          <div className="flex-1 min-w-[150px]">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('common.endDate')}</label>
            <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
          </div>
        </div>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card className="p-5">
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('reports.revenueLabel')}</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">{formatINR(report.totalRevenue)}</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('reports.costOfGoods')}</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">{formatINR(report.totalCost)}</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('reports.expensesLabel')}</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">{formatINR(report.totalExpenses)}</p>
        </Card>
        <Card className={`p-5 ${report.netProfit >= 0 ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}>
          <div className="flex items-center gap-2 mb-1">
            {report.netProfit >= 0 ? <TrendingUp size={16} className="text-emerald-600" /> : <TrendingDown size={16} className="text-red-600" />}
            <p className={`text-sm ${report.netProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{t('reports.netProfit')}</p>
          </div>
          <p className={`text-2xl font-bold ${report.netProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            {formatINR(Math.abs(report.netProfit))}
          </p>
        </Card>
      </div>

      {/* P&L Statement */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">{t('reports.statement')}</h3>
          <div className="space-y-3">
            <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-700">
              <span className="text-gray-600 dark:text-gray-300">{t('reports.totalRevenue')}</span>
              <span className="font-medium text-gray-900 dark:text-gray-100">{formatINR(report.totalRevenue)}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-700">
              <span className="text-gray-600 dark:text-gray-300">{t('reports.costOfGoodsSold')}</span>
              <span className="font-medium text-gray-900 dark:text-gray-100">- {formatINR(report.totalCost)}</span>
            </div>
            <div className="flex justify-between py-2 bg-gray-50 dark:bg-gray-700/50 px-3 rounded-lg">
              <span className="font-medium text-gray-900 dark:text-gray-100">{t('reports.grossProfit')}</span>
              <span className={`font-bold ${grossProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {formatINR(grossProfit)} ({grossMargin.toFixed(1)}%)
              </span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-700">
              <span className="text-gray-600 dark:text-gray-300">{t('reports.operatingExpenses')}</span>
              <span className="font-medium text-gray-900 dark:text-gray-100">- {formatINR(report.totalExpenses)}</span>
            </div>
            <div className="flex justify-between py-3 bg-blue-50 dark:bg-blue-900/20 px-3 rounded-lg">
              <span className="font-bold text-gray-900 dark:text-gray-100">{t('reports.netProfit')}</span>
              <span className={`font-bold text-lg ${report.netProfit >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                {formatINR(report.netProfit)} ({netMargin.toFixed(1)}%)
              </span>
            </div>
          </div>
        </Card>

        {/* Visual Breakdown */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">{t('reports.revenueBreakdown')}</h3>
          {report.totalRevenue > 0 ? (
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-500">{t('reports.costOfGoods')}</span>
                  <span className="text-gray-900 dark:text-gray-100">{((report.totalCost / report.totalRevenue) * 100).toFixed(1)}%</span>
                </div>
                <div className="w-full h-3 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full" style={{ width: `${(report.totalCost / report.totalRevenue) * 100}%` }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-500">{t('reports.expensesLabel')}</span>
                  <span className="text-gray-900 dark:text-gray-100">{((report.totalExpenses / report.totalRevenue) * 100).toFixed(1)}%</span>
                </div>
                <div className="w-full h-3 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div className="h-full bg-amber-500 rounded-full" style={{ width: `${Math.min((report.totalExpenses / report.totalRevenue) * 100, 100)}%` }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-500">{t('reports.netProfit')}</span>
                  <span className="text-gray-900 dark:text-gray-100">{Math.max(netMargin, 0).toFixed(1)}%</span>
                </div>
                <div className="w-full h-3 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.max(netMargin, 0)}%` }} />
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-12">{t('reports.noRevenueDataPeriod')}</p>
          )}
        </Card>
      </div>

      <Modal isOpen={isShareOpen} onClose={() => { setIsShareOpen(false); setSharePhone('') }} title={t('reports.sharePLReportTitle')} size="sm">
        <div className="space-y-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('common.period')}: <span className="font-medium">{startDate} to {endDate}</span></p>
          <Input
            label={t('daybook.whatsappNumber')}
            placeholder={t('reports.phoneExamplePlaceholder')}
            value={sharePhone}
            onChange={e => setSharePhone(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleWhatsAppShare()}
          />
          <p className="text-xs text-gray-400">{t('sales.phoneHint')}</p>
          <div className="flex gap-3">
            <Button className="flex-1 bg-green-600 hover:bg-green-700 text-white" leftIcon={<Share2 size={16} />} onClick={handleWhatsAppShare}>
              {t('daybook.openWhatsApp')}
            </Button>
            <Button variant="ghost" className="flex-1" onClick={() => { setIsShareOpen(false); setSharePhone('') }}>
              {t('action.cancel')}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
