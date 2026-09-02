import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { DataTable, type ColumnDef } from '@/components/data-display/DataTable'
import { Modal } from '@/components/ui/Modal'
import { useSales, useBulkDeleteSales } from '@/hooks/useSales'
import { useSettings } from '@/hooks/useSettings'
import { useCustomers } from '@/hooks/useCustomers'
import { Eye, Printer, Trash2, CheckSquare, Square, FileText, Download, Bluetooth } from 'lucide-react'
import { WhatsAppIcon } from '@/components/ui/WhatsAppIcon'
import { formatINR } from '@/utils/currency'
import { generateReceiptHTML, generateReceiptEscPos, printReceipt, resolveEffectiveReceiptConfig } from '@/utils/receipt'
import { downloadA4InvoicePdf } from '@/utils/a4Invoice'
import { shouldPrintThermalOverBle } from '@/utils/printTarget'
import { ROUTES } from '@/constants/routes'
import { useBlePrinter } from '@/hooks/useBlePrinter'
import type { Sale } from '@/types/sale.types'
import toast from 'react-hot-toast'
import { toastError } from '@/utils/userMessage'
import { useLanguage } from '@/contexts/LanguageContext'

export const SalesPage = () => {
  const { t } = useLanguage()
  const { data: sales, isLoading } = useSales()
  const { mutate: bulkDeleteSales, isPending: isBulkDeleting } = useBulkDeleteSales()

  const { data: settings } = useSettings()
  const { data: customers } = useCustomers()
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week' | 'month'>('all')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [printSaleId, setPrintSaleId] = useState<string | null>(null)
  const [printFormat, setPrintFormat] = useState<'a4' | 'thermal'>('a4')
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false)
  const [isBlePrinting, setIsBlePrinting] = useState(false)
  const [shareSaleId, setShareSaleId] = useState<string | null>(null)
  const [sharePhone, setSharePhone] = useState('')
  const navigate = useNavigate()
  const blePrinter = useBlePrinter()

  const printSale = sales?.find(s => s.id === printSaleId) ?? null

  const handlePrint = async () => {
    if (!printSale) return

    const receiptConfig = resolveEffectiveReceiptConfig(settings)
    const customerName = printSale.customerId
      ? customers?.find(c => c.id === printSale.customerId)?.name
      : ''

    const paperSize = settings?.printerConfig?.paperSize || '58mm'
    const paperWidth: '50mm' | '80mm' | '210mm' = printFormat === 'thermal'
      ? (paperSize === '80mm' ? '80mm' : '50mm')
      : '210mm'

    if (printFormat === 'thermal' && shouldPrintThermalOverBle(settings, blePrinter)) {
      setIsBlePrinting(true)
      try {
        if (blePrinter.status !== 'connected') await blePrinter.connect()
        const bytes = await generateReceiptEscPos({
          sale: printSale,
          receiptConfig,
          paperSize,
          businessName: settings?.businessName,
          businessAddress: settings?.businessAddress,
          customerName,
        })
        await blePrinter.print(bytes)
        setIsPrintModalOpen(false)
        setPrintSaleId(null)
        toast.success('Printed to Bluetooth printer')
      } catch (error) {
        toastError(error, t('pos.errFailedPrintBluetooth'))
      } finally {
        setIsBlePrinting(false)
      }
      return
    }

    const receiptHTML = generateReceiptHTML({
      sale: printSale,
      receiptConfig,
      printerConfig: settings?.printerConfig,
      businessName: settings?.businessName,
      businessAddress: settings?.businessAddress,
      customerName,
      width: paperWidth,
      logoURL: settings?.businessLogoURL || receiptConfig?.logoURL,
      settingsTaxName: 'GST',
    })

    printReceipt(receiptHTML, paperWidth, printSale.invoiceNumber, () => {
      setIsPrintModalOpen(false)
      setPrintSaleId(null)
    })
  }

  const handlePrintBluetooth = async () => {
    if (!printSale) return
    setIsBlePrinting(true)
    try {
      if (blePrinter.status !== 'connected') {
        await blePrinter.connect()
      }
      const receiptConfig = resolveEffectiveReceiptConfig(settings)
      const customerName = printSale.customerId
        ? customers?.find(c => c.id === printSale.customerId)?.name
        : ''
      const bytes = await generateReceiptEscPos({
        sale: printSale,
        receiptConfig,
        paperSize: settings?.printerConfig?.paperSize || '58mm',
        businessName: settings?.businessName,
        businessAddress: settings?.businessAddress,
        customerName,
      })
      await blePrinter.print(bytes)
      setIsPrintModalOpen(false)
      setPrintSaleId(null)
    } catch (error) {
      toastError(error, t('pos.errFailedPrintBluetooth'))
    } finally {
      setIsBlePrinting(false)
    }
  }

  const openPrintModal = (saleId: string) => {
    setPrintSaleId(saleId)
    setIsPrintModalOpen(true)
  }

  const handleDownload = (saleId: string) => {
    const sale = sales?.find(s => s.id === saleId)
    if (!sale) return
    const receiptConfig = resolveEffectiveReceiptConfig(settings)
    const customerName = sale.customerId
      ? customers?.find(c => c.id === sale.customerId)?.name
      : ''
    const html = generateReceiptHTML({
      sale,
      receiptConfig,
      printerConfig: settings?.printerConfig,
      businessName: settings?.businessName,
      businessAddress: settings?.businessAddress,
      customerName,
      customer: sale.customerId ? customers?.find(c => c.id === sale.customerId) : null,
      width: '210mm',
      logoURL: settings?.businessLogoURL || receiptConfig?.logoURL,
      settingsTaxName: 'GST',
    })
    downloadA4InvoicePdf(html, `${sale.invoiceNumber}.pdf`, settings?.printerConfig?.invoicePaperSize || 'A4')
    toast.success(`${t('sales.invoiceHeader')} ${sale.invoiceNumber} — click Save as PDF`)
  }

  const filtered = sales?.filter(sale => {
    if (dateFilter === 'all') return true
    const rawDate = sale.createdAt as unknown as { toDate?: () => Date }
    const saleDate = rawDate?.toDate ? rawDate.toDate() : new Date(sale.createdAt || Date.now())
    const now = new Date()
    if (dateFilter === 'today') {
      return saleDate.toDateString() === now.toDateString()
    }
    if (dateFilter === 'week') {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      return saleDate >= weekAgo
    }
    if (dateFilter === 'month') {
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      return saleDate >= monthAgo
    }
    return true
  }) ?? []

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filtered.map(s => s.id)))
    }
  }

  const handleWhatsAppShare = () => {
    if (!shareSaleId) return
    const shareSale = sales?.find(s => s.id === shareSaleId)
    if (!shareSale) return

    const raw = sharePhone.trim().replace(/\D/g, '')
    const phone = raw.startsWith('0') ? '91' + raw.slice(1) : raw.length === 10 ? '91' + raw : raw
    if (phone.length < 10) {
      toast.error(t('sales.errValidPhone'))
      return
    }

    const rawCreated = shareSale.createdAt as unknown as { toDate?: () => Date }
    const dateStr = rawCreated?.toDate
      ? rawCreated.toDate().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
      : (shareSale.createdAt ? new Date(shareSale.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—')
    const customerName = shareSale.customerId
      ? customers?.find(c => c.id === shareSale.customerId)?.name ?? 'Customer'
      : 'Walk-in Customer'
    const businessName = settings?.businessName || 'Our Store'
    const items = (shareSale.items ?? [])
      .map(i => `  • ${i.productName} x${i.quantity} — ${formatINR(i.sellingPrice * i.quantity)}`)
      .join('\n')

    const msg = [
      `🧾 *Invoice from ${businessName}*`,
      ``,
      `Invoice No : *${shareSale.invoiceNumber}*`,
      `Date       : ${dateStr}`,
      `Customer   : ${customerName}`,
      ``,
      `*Items:*`,
      items,
      ``,
      `Sub Total  : ${formatINR(shareSale.subtotal)}`,
      shareSale.totalDiscount > 0 ? `Discount   : -${formatINR(shareSale.totalDiscount)}` : null,
      shareSale.totalTax > 0 ? `Tax        : ${formatINR(shareSale.totalTax)}` : null,
      `*Total      : ${formatINR(shareSale.grandTotal)}*`,
      `Payment    : ${shareSale.paymentMethod?.toUpperCase()}`,
      ``,
      `Thank you for your purchase! 🙏`,
    ].filter(Boolean).join('\n')

    const url = `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`
    window.open(url, '_blank', 'noopener,noreferrer')
    setShareSaleId(null)
    setSharePhone('')
  }

  const handleBulkDelete = () => {
    if (selectedIds.size === 0) return
    if (!confirm(`${t('sales.deleteConfirmPrefix')} ${selectedIds.size} ${t('sales.deleteConfirmSuffix')}`)) return
    bulkDeleteSales(Array.from(selectedIds), {
      onSuccess: () => {
        toast.success(`${t('sales.deletedPrefix')} ${selectedIds.size} ${t('sales.invoicesSuffix')}`)
        setSelectedIds(new Set())
      },
      onError: () => toast.error(t('sales.errDeleteFailed')),
    })
  }

  const allSelected = (filtered?.length ?? 0) > 0 && selectedIds.size === filtered?.length
  const someSelected = selectedIds.size > 0

  const columns: ColumnDef<Sale>[] = [
    {
      key: 'select',
      header: () => (
        <button
          onClick={toggleSelectAll}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        >
          {allSelected ? <CheckSquare size={16} /> : <Square size={16} />}
        </button>
      ),
      render: (row) => (
        <button
          onClick={() => toggleSelect(row.id)}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        >
          {selectedIds.has(row.id) ? <CheckSquare size={16} className="text-blue-600" /> : <Square size={16} />}
        </button>
      ),
    },
    {
      key: 'invoiceNumber',
      header: t('sales.invoiceHeader'),
      render: (row) => (
        <div>
          <span className="font-medium">{row.invoiceNumber}</span>
          <p className="text-xs text-gray-400">{row.items?.length ?? 0} {t('sales.itemsSuffix')}</p>
        </div>
      ),
      sortable: true,
    },
    {
      key: 'customer',
      header: t('sales.customerHeader'),
      render: (row) => (
        <span>{row.customerId ? t('sales.registered') : t('sales.walkin')}</span>
      ),
    },
    {
      key: 'createdAt',
      header: t('common.date'),
      render: (row) => {
        const raw = row.createdAt as unknown as { toDate?: () => Date }
        const d = raw?.toDate ? raw.toDate() : new Date(row.createdAt)

        return (
          <span>
            {row.createdAt
              ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
              : '—'}
          </span>
        )
      },
      sortable: true,
    },
    {
      key: 'grandTotal',
      header: t('common.total'),
      render: (row) => (
        <span className="font-semibold">{formatINR(row.grandTotal)}</span>
      ),
      sortable: true,
    },
    {
      key: 'paymentMethod',
      header: t('sales.methodHeader'),
      render: (row) => (
        <Badge variant={
          row.paymentMethod === 'cash' ? 'success' :
          row.paymentMethod === 'card' ? 'info' :
          row.paymentMethod === 'upi' ? 'default' : 'warning'
        }>
          {row.paymentMethod?.toUpperCase()}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: t('common.actions'),
      render: (row) => (
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={() => navigate(`${ROUTES.SALES}/${row.id}`)} title={t('sales.viewReceiptTitle')}>
            <Eye size={16} />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => openPrintModal(row.id)} title={t('pos.printReceiptTitle')}>
            <Printer size={16} />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => handleDownload(row.id)} title={t('sales.downloadInvoiceTitle')}>
            <Download size={16} />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => { setShareSaleId(row.id); setSharePhone('') }} title={t('daybook.shareWhatsApp')}>
            <WhatsAppIcon size={16} className="text-green-600" />
          </Button>
        </div>
      ),
    },
  ]

  const shareSale = sales?.find(s => s.id === shareSaleId)

  return (


    <div>
      <PageHeader
        title={t('page.salesHistory')}
        action={
          <div className="flex items-center gap-2">
            {someSelected && (
              <Button
                variant="danger"
                size="sm"
                onClick={handleBulkDelete}
                loading={isBulkDeleting}
                leftIcon={<Trash2 size={16} />}
              >
                {t('sales.deleteSelected')} ({selectedIds.size})
              </Button>
            )}
            <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
              {(['all', 'today', 'week', 'month'] as const).map(period => (
                <button
                  key={period}
                  onClick={() => setDateFilter(period)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                    dateFilter === period
                      ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow-sm'
                      : 'text-gray-500 dark:text-gray-400'
                  }`}
                >
                  {period === 'all' ? t('sales.periodAll') : period === 'today' ? t('daybook.today') : period === 'week' ? t('sales.periodWeek') : t('sales.periodMonth')}
                </button>
              ))}
            </div>
          </div>
        }
      />

      <Card className="p-4">
        <DataTable
          data={filtered}
          columns={columns}
          loading={isLoading}
          searchable
          pagination
          emptyMessage={t('sales.noSalesForPeriod')}
        />
      </Card>

      {/* WhatsApp Share Modal */}
      <Modal
        isOpen={!!shareSaleId}
        onClose={() => { setShareSaleId(null); setSharePhone('') }}
        title={t('sales.shareInvoiceTitle')}
        size="sm"
      >
        <div className="space-y-5">
          {shareSale && (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {t('sales.invoiceHeader')}: <span className="font-semibold text-gray-800 dark:text-gray-200">{shareSale.invoiceNumber}</span>
              {' · '}{formatINR(shareSale.grandTotal)}
            </p>
          )}
          <Input
            label={t('daybook.whatsappNumber')}
            placeholder="e.g. 9876543210"
            value={sharePhone}
            onChange={(e) => setSharePhone(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleWhatsAppShare()}
          />
          <p className="text-xs text-gray-400">{t('sales.phoneHint')}</p>
          <div className="flex gap-3">
            <Button
              className="flex-1 bg-green-600 hover:bg-green-700 text-white"
              onClick={handleWhatsAppShare}
              leftIcon={<WhatsAppIcon size={16} />}
            >
              {t('daybook.openWhatsApp')}
            </Button>
            <Button variant="ghost" className="flex-1" onClick={() => { setShareSaleId(null); setSharePhone('') }}>
              {t('action.cancel')}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Print Format Modal */}
      <Modal isOpen={isPrintModalOpen} onClose={() => { setIsPrintModalOpen(false); setPrintSaleId(null) }} title={t('sales.printInvoiceTitle')} size="sm">
        <div className="space-y-6">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {printSale && `${t('sales.invoiceHeader')}: ${printSale.invoiceNumber}`}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('pos.selectPrintFormat')}</p>

          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => { setPrintFormat('a4'); handlePrint() }}
              className="flex flex-col items-center gap-3 p-6 rounded-xl border-2 border-gray-200 dark:border-gray-600 hover:border-[#0a0a2e] dark:hover:border-[#0a0a2e] transition-all"
            >
              <FileText size={32} className="text-gray-400" />
              <div className="text-center">
                <p className="font-bold text-gray-900 dark:text-gray-100">{t('pos.a4Paper')}</p>
                <p className="text-xs text-gray-400">{t('pos.standardFormat')}</p>
              </div>
            </button>
            <button
              onClick={() => { setPrintFormat('thermal'); handlePrint() }}
              className="flex flex-col items-center gap-3 p-6 rounded-xl border-2 border-gray-200 dark:border-gray-600 hover:border-[#0a0a2e] dark:hover:border-[#0a0a2e] transition-all"
            >
              <Printer size={32} className="text-gray-400" />
              <div className="text-center">
                <p className="font-bold text-gray-900 dark:text-gray-100">{t('pos.thermal50mm')}</p>
                <p className="text-xs text-gray-400">{t('pos.posPrinter')}</p>
              </div>
            </button>
          </div>

          {blePrinter.isSupported && (
            <Button
              variant="outline"
              className="w-full"
              loading={isBlePrinting}
              leftIcon={<Bluetooth size={16} />}
              onClick={handlePrintBluetooth}
            >
              {blePrinter.status === 'connected' ? `${t('pos.printToDevice')} ${blePrinter.deviceName}` : t('pos.printViaBluetooth')}
            </Button>
          )}

          {printSaleId && (
            <Button
              variant="outline"
              className="w-full"
              leftIcon={<Download size={16} />}
              onClick={() => handleDownload(printSaleId)}
            >
              Download PDF
            </Button>
          )}

          <Button
            variant="ghost"
            onClick={() => { setIsPrintModalOpen(false); setPrintSaleId(null) }}
            className="w-full"
          >
            {t('action.cancel')}
          </Button>
        </div>
      </Modal>
    </div>
  )
}
