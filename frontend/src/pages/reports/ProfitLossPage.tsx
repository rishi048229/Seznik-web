import { useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { TablePageSkeleton } from '@/components/ui/PageSkeleton'
import { usePLReport } from '@/hooks/useReports'
import { Download, TrendingUp, TrendingDown, Share2, Receipt, ShoppingBag, Landmark } from 'lucide-react'
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

  const grossBilled = report?.grossBilled ?? report?.totalRevenue ?? 0
  const taxCollected = report?.taxCollected ?? 0
  const netRevenue = report?.netRevenue ?? (grossBilled - taxCollected)
  const totalCost = report?.totalCost ?? 0
  const grossProfit = report?.grossProfit ?? (netRevenue - totalCost)
  const totalExpenses = report?.totalExpenses ?? 0
  const netProfit = report?.netProfit ?? (grossProfit - totalExpenses)

  const grossMargin = netRevenue > 0 ? (grossProfit / netRevenue) * 100 : 0
  const netMargin = netRevenue > 0 ? (netProfit / netRevenue) * 100 : 0

  const handleExport = () => {
    if (!report) {
      toast.error(t('reports.noDataToExport'))
      return
    }
    const ws = XLSX.utils.aoa_to_sheet([
      ['Profit & Loss Statement'],
      ['Period', report.period],
      ['', ''],
      ['Accounting Waterfall', 'Amount (INR)'],
      ['Gross Billed (Total Invoiced)', grossBilled],
      ['Less: GST Output Tax Collected', -taxCollected],
      ['= Net Revenue (Taxable Sales)', netRevenue],
      ['Less: Cost of Goods Sold (COGS)', -totalCost],
      ['= Gross Profit', grossProfit],
      ['Less: Operating Expenses', -totalExpenses],
      ['= Net Operating Profit', netProfit],
      ['', ''],
      ['Gross Margin (%)', `${grossMargin.toFixed(2)}%`],
      ['Net Margin (%)', `${netMargin.toFixed(2)}%`],
    ])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'P&L Statement')
    XLSX.writeFile(wb, `profit-loss-${startDate}-${endDate}.xlsx`)
    toast.success(t('reports.exportedSuccess'))
  }

  const handleWhatsAppShare = () => {
    const raw = sharePhone.replace(/\D/g, '')
    const phone = raw.startsWith('0') ? '91' + raw.slice(1) : raw.length === 10 ? '91' + raw : raw
    if (phone.length < 10) { toast.error(t('sales.errValidPhone')); return }

    const msg = [
      `📊 *Profit & Loss Statement*`,
      `Period: ${startDate} to ${endDate}`,
      ``,
      `Gross Billed (Invoiced)     : ${formatINR(grossBilled)}`,
      `Less: GST Output Tax Collected: - ${formatINR(taxCollected)}`,
      `*Net Revenue (Taxable)*      : *${formatINR(netRevenue)}*`,
      ``,
      `Less: Cost of Goods (COGS)  : - ${formatINR(totalCost)}`,
      `*Gross Profit*              : *${formatINR(grossProfit)} (${grossMargin.toFixed(1)}%)*`,
      ``,
      `Less: Operating Expenses    : - ${formatINR(totalExpenses)}`,
      `*Net Operating Profit*      : *${formatINR(netProfit)} (${netMargin.toFixed(1)}%)*`,
    ].join('\n')

    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener,noreferrer')
    setIsShareOpen(false)
    setSharePhone('')
  }

  if (isLoading) {
    return (
      <div>
        <PageHeader title={t('reports.profitLossTitle')} breadcrumb={[t('reports.breadcrumbReports'), t('reports.breadcrumbPL')]} />
        <ReportTabs />
        <TablePageSkeleton cards={5} rows={6} columns={4} />
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <Card className="p-4">
          <div className="flex items-center justify-between text-gray-500 dark:text-gray-400 mb-1">
            <span className="text-xs font-medium uppercase tracking-wider">{t('reports.grossBilled') || 'Gross Billed'}</span>
            <Receipt size={16} className="text-gray-400" />
          </div>
          <p className="text-xl font-bold text-gray-900 dark:text-gray-100">{formatINR(grossBilled)}</p>
          <p className="text-[11px] text-gray-400 mt-1">Total Invoiced</p>
        </Card>

        <Card className="p-4 bg-blue-50/50 dark:bg-blue-950/20 border-blue-100 dark:border-blue-900/30">
          <div className="flex items-center justify-between text-blue-600 dark:text-blue-400 mb-1">
            <span className="text-xs font-medium uppercase tracking-wider">{t('reports.netRevenueTaxable') || 'Net Revenue'}</span>
            <Landmark size={16} className="text-blue-500" />
          </div>
          <p className="text-xl font-bold text-blue-700 dark:text-blue-300">{formatINR(netRevenue)}</p>
          <p className="text-[11px] text-blue-500/80 mt-1">Excl. GST ({formatINR(taxCollected)})</p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between text-gray-500 dark:text-gray-400 mb-1">
            <span className="text-xs font-medium uppercase tracking-wider">{t('reports.costOfGoods')}</span>
            <ShoppingBag size={16} className="text-gray-400" />
          </div>
          <p className="text-xl font-bold text-gray-900 dark:text-gray-100">{formatINR(totalCost)}</p>
          <p className="text-[11px] text-gray-400 mt-1">COGS (Stock Cost)</p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between text-gray-500 dark:text-gray-400 mb-1">
            <span className="text-xs font-medium uppercase tracking-wider">{t('reports.expensesLabel')}</span>
            <span className="text-xs text-gray-400">Store</span>
          </div>
          <p className="text-xl font-bold text-gray-900 dark:text-gray-100">{formatINR(totalExpenses)}</p>
          <p className="text-[11px] text-gray-400 mt-1">Operating Expenses</p>
        </Card>

        <Card className={`p-4 ${netProfit >= 0 ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800/40' : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800/40'}`}>
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1.5">
              {netProfit >= 0 ? <TrendingUp size={16} className="text-emerald-600" /> : <TrendingDown size={16} className="text-red-600" />}
              <span className={`text-xs font-semibold uppercase tracking-wider ${netProfit >= 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300'}`}>
                {t('reports.netProfit')}
              </span>
            </div>
            <span className={`text-xs font-bold ${netProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{netMargin.toFixed(1)}%</span>
          </div>
          <p className={`text-xl font-bold ${netProfit >= 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300'}`}>
            {formatINR(Math.abs(netProfit))}
          </p>
          <p className={`text-[11px] mt-1 ${netProfit >= 0 ? 'text-emerald-600/80' : 'text-red-600/80'}`}>
            {netProfit >= 0 ? 'Net Operating Gain' : 'Operating Deficit'}
          </p>
        </Card>
      </div>

      {/* P&L Statement */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">{t('reports.statement')}</h3>
          <div className="space-y-3">
            <div className="flex justify-between py-2 border-b border-gray-100 dark:border-dark-border">
              <span className="text-gray-600 dark:text-gray-300">{t('reports.grossBilled') || 'Gross Billed (Total Invoiced)'}</span>
              <span className="font-medium text-gray-900 dark:text-gray-100">{formatINR(grossBilled)}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-100 dark:border-dark-border text-amber-700 dark:text-amber-400">
              <span>Less: {t('reports.gstOutputTaxCollected') || 'GST Output Tax Collected'}</span>
              <span className="font-medium">- {formatINR(taxCollected)}</span>
            </div>
            <div className="flex justify-between py-2.5 bg-blue-50/70 dark:bg-blue-900/30 px-3 rounded-lg border border-blue-100 dark:border-blue-900/40">
              <span className="font-semibold text-blue-900 dark:text-blue-200">{t('reports.netRevenueTaxable') || '= Net Revenue (Taxable Sales)'}</span>
              <span className="font-bold text-blue-700 dark:text-blue-300">{formatINR(netRevenue)}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-100 dark:border-dark-border">
              <span className="text-gray-600 dark:text-gray-300">{t('reports.costOfGoodsSold')}</span>
              <span className="font-medium text-gray-900 dark:text-gray-100">- {formatINR(totalCost)}</span>
            </div>
            <div className="flex justify-between py-2 bg-gray-50 dark:bg-dark-elevated/50 px-3 rounded-lg">
              <span className="font-medium text-gray-900 dark:text-gray-100">{t('reports.grossProfit')}</span>
              <span className={`font-bold ${grossProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {formatINR(grossProfit)} ({grossMargin.toFixed(1)}%)
              </span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-100 dark:border-dark-border">
              <span className="text-gray-600 dark:text-gray-300">{t('reports.operatingExpenses')}</span>
              <span className="font-medium text-gray-900 dark:text-gray-100">- {formatINR(totalExpenses)}</span>
            </div>
            <div className="flex justify-between py-3 bg-emerald-50/70 dark:bg-emerald-900/30 px-3 rounded-lg border border-emerald-100 dark:border-emerald-900/40">
              <span className="font-bold text-gray-900 dark:text-gray-100">{t('reports.netProfit')}</span>
              <span className={`font-bold text-lg ${netProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {formatINR(netProfit)} ({netMargin.toFixed(1)}%)
              </span>
            </div>
          </div>
        </Card>

        {/* Visual Breakdown */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">{t('reports.revenueBreakdown')}</h3>
          {netRevenue > 0 ? (
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-500">{t('reports.costOfGoods')}</span>
                  <span className="text-gray-900 dark:text-gray-100">{((totalCost / netRevenue) * 100).toFixed(1)}%</span>
                </div>
                <div className="w-full h-3 bg-gray-100 dark:bg-dark-elevated rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full" style={{ width: `${Math.min((totalCost / netRevenue) * 100, 100)}%` }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-500">{t('reports.expensesLabel')}</span>
                  <span className="text-gray-900 dark:text-gray-100">{((totalExpenses / netRevenue) * 100).toFixed(1)}%</span>
                </div>
                <div className="w-full h-3 bg-gray-100 dark:bg-dark-elevated rounded-full overflow-hidden">
                  <div className="h-full bg-amber-500 rounded-full" style={{ width: `${Math.min((totalExpenses / netRevenue) * 100, 100)}%` }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-500">{t('reports.netProfit')}</span>
                  <span className="text-gray-900 dark:text-gray-100">{Math.max(netMargin, 0).toFixed(1)}%</span>
                </div>
                <div className="w-full h-3 bg-gray-100 dark:bg-dark-elevated rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.max(Math.min(netMargin, 100), 0)}%` }} />
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
