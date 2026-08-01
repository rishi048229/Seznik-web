import { useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Spinner } from '@/components/ui/Spinner'
import { TablePageSkeleton } from '@/components/ui/PageSkeleton'
import { useTaxReport } from '@/hooks/useReports'
import { Download, Receipt, Share2 } from 'lucide-react'
import { formatINR } from '@/utils/currency'
import * as XLSX from 'xlsx'
import toast from 'react-hot-toast'

import { ReportTabs } from './ReportTabs'

export const TaxReportPage = () => {
  const today = new Date()
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1)
  const [startDate, setStartDate] = useState(firstDay.toISOString().split('T')[0])
  const [endDate, setEndDate] = useState(today.toISOString().split('T')[0])
  const [isShareOpen, setIsShareOpen] = useState(false)
  const [sharePhone, setSharePhone] = useState('')

  const endOfDay = (d: string) => { const dt = new Date(d); dt.setHours(23, 59, 59, 999); return dt }
  const { data: report, isLoading } = useTaxReport(new Date(startDate), endOfDay(endDate))

  const handleExport = () => {
    if (!report) {
      toast.error('No data to export')
      return
    }
    const ws = XLSX.utils.aoa_to_sheet([
      ['Tax Report'],
      ['Period', report.period],
      ['', ''],
      ['Description', 'Amount'],
      ['Total Output Tax', report.totalOutputTax],
      ['Taxable Sales', report.taxableSales],
    ])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Tax Report')
    XLSX.writeFile(wb, `tax-report-${startDate}-${endDate}.xlsx`)
    toast.success('Report exported')
  }

  if (isLoading) {
    return (
      <div>
        <PageHeader title="Tax Report" breadcrumb={['Reports', 'Tax']} />
        <ReportTabs />
        <TablePageSkeleton cards={3} rows={6} columns={4} />
      </div>
    )
  }

  if (!report) {
    return (
      <div>
        <PageHeader title="Tax Report" breadcrumb={['Reports', 'Tax']} />
        <ReportTabs />
        <Card className="p-8 text-center">
          <p className="text-gray-500">No data for this period</p>
        </Card>
      </div>
    )
  }

  const avgTaxPerSale = report.taxableSales > 0 ? report.totalOutputTax / report.taxableSales : 0

  const handleWhatsAppShare = () => {
    const raw = sharePhone.replace(/\D/g, '')
    const phone = raw.startsWith('0') ? '91' + raw.slice(1) : raw.length === 10 ? '91' + raw : raw
    if (phone.length < 10) { toast.error('Enter a valid phone number'); return }

    const msg = [
      `🧾 *Tax Report*`,
      `Period: ${startDate} to ${endDate}`,
      ``,
      `Total Output Tax Collected : ${formatINR(report.totalOutputTax)}`,
      `Number of Taxable Sales    : ${report.taxableSales}`,
      `Avg Tax per Sale           : ${formatINR(avgTaxPerSale)}`,
      `Reporting Period           : ${report.period}`,
    ].join('\n')

    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener,noreferrer')
    setIsShareOpen(false)
    setSharePhone('')
  }

  return (
    <div>
      <PageHeader
        title="Tax Report"
        breadcrumb={['Reports', 'Tax']}
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
      <ReportTabs />

      {/* Date Range Filter */}
      <Card className="p-4 mb-6">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[150px]">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Start Date</label>
            <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
          </div>
          <div className="flex-1 min-w-[150px]">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">End Date</label>
            <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
          </div>
        </div>
      </Card>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-2">
            <Receipt size={20} className="text-blue-600" />
            <p className="text-sm text-gray-500 dark:text-gray-400">Total Output Tax</p>
          </div>
          <p className="text-2xl font-bold text-blue-600">{formatINR(report.totalOutputTax)}</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-gray-500 dark:text-gray-400">Taxable Sales</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">{report.taxableSales}</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-gray-500 dark:text-gray-400">Avg Tax per Sale</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">{formatINR(avgTaxPerSale)}</p>
        </Card>
      </div>

      <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Tax Summary</h3>
        <div className="space-y-3 max-w-md">
          <div className="flex justify-between py-3 border-b border-gray-100 dark:border-gray-700">
            <span className="text-gray-600 dark:text-gray-300">Total Output Tax Collected</span>
            <span className="font-bold text-blue-600">{formatINR(report.totalOutputTax)}</span>
          </div>
          <div className="flex justify-between py-3 border-b border-gray-100 dark:border-gray-700">
            <span className="text-gray-600 dark:text-gray-300">Number of Taxable Sales</span>
            <span className="font-medium text-gray-900 dark:text-gray-100">{report.taxableSales}</span>
          </div>
          <div className="flex justify-between py-3">
            <span className="text-gray-600 dark:text-gray-300">Reporting Period</span>
            <span className="font-medium text-gray-900 dark:text-gray-100">{report.period}</span>
          </div>
        </div>
      </Card>

      <Modal isOpen={isShareOpen} onClose={() => { setIsShareOpen(false); setSharePhone('') }} title="Share Tax Report on WhatsApp" size="sm">
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
