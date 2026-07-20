import { useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Spinner } from '@/components/ui/Spinner'
import { useSalesReport } from '@/hooks/useReports'
import { Download, Share2 } from 'lucide-react'
import { formatINR } from '@/utils/currency'
import * as XLSX from 'xlsx'
import toast from 'react-hot-toast'

export const SalesReportPage = () => {
  const today = new Date()
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1)
  const [startDate, setStartDate] = useState(firstDay.toISOString().split('T')[0])
  const [endDate, setEndDate] = useState(today.toISOString().split('T')[0])
  const endOfDay = (d: string) => { const dt = new Date(d); dt.setHours(23, 59, 59, 999); return dt }
  const { data: report, isLoading } = useSalesReport(new Date(startDate), endOfDay(endDate))

  const totalRevenue = report?.revenue.reduce((s, v) => s + v, 0) ?? 0
  const totalInvoices = report?.invoiceCount.reduce((s, v) => s + v, 0) ?? 0
  const avgOrderValue = totalInvoices > 0 ? totalRevenue / totalInvoices : 0

  const [isShareOpen, setIsShareOpen] = useState(false)
  const [sharePhone, setSharePhone] = useState('')

  const handleWhatsAppShare = () => {
    const raw = sharePhone.replace(/\D/g, '')
    const phone = raw.startsWith('0') ? '91' + raw.slice(1) : raw.length === 10 ? '91' + raw : raw
    if (phone.length < 10) { toast.error('Enter a valid phone number'); return }

    const rows = report?.labels.map((label, i) =>
      `  ${label}: ${formatINR(report.revenue[i])} (${report.invoiceCount[i]} invoices)`
    ).join('\n') ?? ''

    const msg = [
      `📊 *Sales Report*`,
      `Period: ${startDate} to ${endDate}`,
      ``,
      `*Summary*`,
      `Total Revenue   : ${formatINR(totalRevenue)}`,
      `Total Invoices  : ${totalInvoices}`,
      `Avg Order Value : ${formatINR(avgOrderValue)}`,
      ``,
      `*Daily Breakdown*`,
      rows,
    ].join('\n')

    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener,noreferrer')
    setIsShareOpen(false)
    setSharePhone('')
  }

  const handleExport = () => {
    if (!report || report.labels.length === 0) {
      toast.error('No data to export')
      return
    }
    const ws = XLSX.utils.aoa_to_sheet([
      ['Date', 'Revenue', 'Invoices'],
      ...report.labels.map((label, i) => [label, report.revenue[i], report.invoiceCount[i]]),
      ['', '', ''],
      ['Total', totalRevenue, totalInvoices],
      ['Avg Order Value', avgOrderValue, ''],
    ])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Sales Report')
    XLSX.writeFile(wb, `sales-report-${startDate}-${endDate}.xlsx`)
    toast.success('Report exported')
  }

  return (
    <div>
      <PageHeader
        title="Sales Report"
        breadcrumb={['Reports', 'Sales']}
        action={
          <div className="flex gap-2">
            <Button leftIcon={<Share2 size={16} />} onClick={() => setIsShareOpen(true)} variant="outline" className="text-green-600 border-green-300 hover:bg-green-50">
              Share on WhatsApp
            </Button>
            <Button leftIcon={<Download size={16} />} onClick={handleExport} variant="outline">
              Export Excel
            </Button>
          </div>
        }
      />

      {/* Date Range Filter */}
      <Card className="p-4 mb-6">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[150px]">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Start Date</label>
            <Input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
            />
          </div>
          <div className="flex-1 min-w-[150px]">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">End Date</label>
            <Input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
            />
          </div>
        </div>
      </Card>

      {isLoading ? (
        <div className="flex justify-center py-12"><Spinner size="lg" /></div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <Card className="p-5">
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Revenue</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">{formatINR(totalRevenue)}</p>
            </Card>
            <Card className="p-5">
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Invoices</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">{totalInvoices}</p>
            </Card>
            <Card className="p-5">
              <p className="text-sm text-gray-500 dark:text-gray-400">Avg Order Value</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">{formatINR(avgOrderValue)}</p>
            </Card>
          </div>

          {/* Chart + Table */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Bar Chart */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Daily Revenue</h3>
              {report && report.labels.length > 0 ? (
                <div className="flex items-end gap-1 h-48">
                  {report.revenue.map((rev, i) => {
                    const maxRev = Math.max(...report.revenue)
                    const height = maxRev > 0 ? (rev / maxRev) * 100 : 0
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1">
                        <span className="text-[10px] text-gray-500 truncate w-full text-center">
                          {formatINR(rev)}
                        </span>
                        <div
                          className="w-full bg-indigo-500 rounded-t hover:bg-indigo-600 transition-colors min-h-[2px]"
                          style={{ height: `${Math.max(height, 2)}%` }}
                        />
                        <span className="text-[10px] text-gray-400 truncate w-full text-center">
                          {report.labels[i].slice(5)}
                        </span>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="text-sm text-gray-400 text-center py-12">No sales data for this period</p>
              )}
            </Card>

            {/* Data Table */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Daily Breakdown</h3>
              {report && report.labels.length > 0 ? (
                <div className="overflow-y-auto max-h-64">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-white dark:bg-gray-800">
                      <tr className="border-b border-gray-200 dark:border-gray-700">
                        <th className="text-left py-2 text-gray-500 font-medium">Date</th>
                        <th className="text-right py-2 text-gray-500 font-medium">Revenue</th>
                        <th className="text-right py-2 text-gray-500 font-medium">Invoices</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {report.labels.map((label, i) => (
                        <tr key={i}>
                          <td className="py-2 text-gray-900 dark:text-gray-100">{label}</td>
                          <td className="py-2 text-right font-medium text-gray-900 dark:text-gray-100">
                            {formatINR(report.revenue[i])}
                          </td>
                          <td className="py-2 text-right text-gray-500">{report.invoiceCount[i]}</td>
                        </tr>
                      ))}
                      <tr className="border-t-2 border-gray-200 dark:border-gray-700 font-semibold">
                        <td className="py-3 text-gray-900 dark:text-gray-100">Total</td>
                        <td className="py-3 text-right text-indigo-600">{formatINR(totalRevenue)}</td>
                        <td className="py-3 text-right text-gray-900 dark:text-gray-100">{totalInvoices}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-gray-400 text-center py-12">No data available</p>
              )}
            </Card>
          </div>
        </>
      )}

      <Modal isOpen={isShareOpen} onClose={() => { setIsShareOpen(false); setSharePhone('') }} title="Share Sales Report on WhatsApp" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">Period: <span className="font-medium">{startDate} to {endDate}</span></p>
          <Input
            label="WhatsApp Number"
            placeholder="e.g. 9876543210"
            value={sharePhone}
            onChange={e => setSharePhone(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleWhatsAppShare()}
          />
          <p className="text-xs text-gray-400">10-digit mobile number — +91 added automatically.</p>
          <div className="flex gap-3">
            <Button className="flex-1 bg-green-600 hover:bg-green-700 text-white" leftIcon={<Share2 size={16} />} onClick={handleWhatsAppShare}>
              Open WhatsApp
            </Button>
            <Button variant="ghost" className="flex-1" onClick={() => { setIsShareOpen(false); setSharePhone('') }}>
              Cancel
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
