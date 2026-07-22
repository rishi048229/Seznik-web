import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { DataTable, type ColumnDef } from '@/components/data-display/DataTable'
import { Spinner } from '@/components/ui/Spinner'
import { Modal } from '@/components/ui/Modal'
import { useSales, useDeleteSale, useBulkDeleteSales } from '@/hooks/useSales'
import { useSettings } from '@/hooks/useSettings'
import { useCustomers } from '@/hooks/useCustomers'
import { Eye, Printer, Trash2, CheckSquare, Square, FileText, Download, Share2, Bluetooth } from 'lucide-react'
import { formatINR } from '@/utils/currency'
import { generateReceiptHTML, generateReceiptEscPos, printReceipt } from '@/utils/receipt'
import { ROUTES } from '@/constants/routes'
import { useBlePrinter } from '@/hooks/useBlePrinter'
import toast from 'react-hot-toast'

export const SalesPage = () => {
  const { data: sales, isLoading } = useSales()
  const { mutate: deleteSale } = useDeleteSale()
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

  const handlePrint = () => {
    if (!printSale) return

    const receiptConfig = settings?.receiptConfig
    const customerName = printSale.customerId
      ? customers?.find(c => c.id === printSale.customerId)?.name
      : ''

    const receiptHTML = generateReceiptHTML({
      sale: printSale,
      receiptConfig,
      businessName: settings?.businessName,
      businessAddress: settings?.businessAddress,
      customerName,
      width: printFormat === 'thermal' ? '50mm' : '210mm',
      logoURL: settings?.businessLogoURL || receiptConfig?.logoURL,
    })

    printReceipt(receiptHTML, printFormat === 'thermal' ? '50mm' : '210mm', printSale.invoiceNumber, () => {
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
      const receiptConfig = settings?.receiptConfig
      const customerName = printSale.customerId
        ? customers?.find(c => c.id === printSale.customerId)?.name
        : ''
      const bytes = generateReceiptEscPos({
        sale: printSale,
        receiptConfig,
        businessName: settings?.businessName,
        businessAddress: settings?.businessAddress,
        customerName,
      })
      await blePrinter.print(bytes)
      setIsPrintModalOpen(false)
      setPrintSaleId(null)
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to print via Bluetooth'
      toast.error(msg)
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
    const receiptConfig = settings?.receiptConfig
    const customerName = sale.customerId
      ? customers?.find(c => c.id === sale.customerId)?.name
      : ''
    const html = generateReceiptHTML({
      sale,
      receiptConfig,
      businessName: settings?.businessName,
      businessAddress: settings?.businessAddress,
      customerName,
      width: '210mm',
      logoURL: settings?.businessLogoURL || receiptConfig?.logoURL,
    })
    const full = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${sale.invoiceNumber}</title>
<style>body{margin:0;padding:16px;font-family:Arial,sans-serif;}</style></head><body>${html}</body></html>`
    const blob = new Blob([full], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${sale.invoiceNumber}.html`
    a.click()
    URL.revokeObjectURL(url)
    toast.success(`Invoice ${sale.invoiceNumber} downloaded`)
  }

  const filtered = sales?.filter(sale => {
    if (dateFilter === 'all') return true
    const saleDate = (sale.createdAt as any)?.toDate ? (sale.createdAt as any).toDate() : new Date(sale.createdAt || Date.now())
    const now = new Date()
    if (dateFilter === 'today') {
      return saleDate.toDateString() === now.toDateString()
    }
    if (dateFilter === 'week') {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      return saleDate >= weekAgo
    }
    if (dateFilter === 'month') {
      return saleDate.getMonth() === now.getMonth() && saleDate.getFullYear() === now.getFullYear()
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

  const shareSale = sales?.find(s => s.id === shareSaleId) ?? null

  const handleWhatsAppShare = () => {
    if (!shareSale) return
    const raw = sharePhone.replace(/\D/g, '')
    const phone = raw.startsWith('0') ? '91' + raw.slice(1) : raw.length === 10 ? '91' + raw : raw
    if (phone.length < 10) {
      toast.error('Enter a valid phone number')
      return
    }

    const dateStr = (shareSale.createdAt as any)?.toDate
      ? new Date((shareSale.createdAt as any).toDate()).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
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
    if (!confirm(`Delete ${selectedIds.size} selected invoice(s)? This cannot be undone.`)) return
    bulkDeleteSales(Array.from(selectedIds), {
      onSuccess: () => {
        toast.success(`Deleted ${selectedIds.size} invoice(s)`)
        setSelectedIds(new Set())
      },
      onError: () => toast.error('Failed to delete invoices'),
    })
  }

  const allSelected = filtered.length > 0 && selectedIds.size === filtered.length
  const someSelected = selectedIds.size > 0

  const columns: ColumnDef<any>[] = [
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
      header: 'Invoice',
      render: (row) => (
        <div>
          <span className="font-medium">{row.invoiceNumber}</span>
          <p className="text-xs text-gray-400">{row.items?.length ?? 0} item(s)</p>
        </div>
      ),
      sortable: true,
    },
    {
      key: 'customer',
      header: 'Customer',
      render: (row) => (
        <span>{row.customerId ? 'Registered' : 'Walk-in'}</span>
      ),
    },
    {
      key: 'createdAt',
      header: 'Date',
      render: (row) => (
        <span>
          {row.createdAt
            ? new Date((row.createdAt as any)?.toDate ? (row.createdAt as any).toDate() : row.createdAt).toLocaleDateString('en-US', {
                month: 'short', day: 'numeric', year: 'numeric',
              })
            : '—'}
        </span>
      ),
      sortable: true,
    },
    {
      key: 'grandTotal',
      header: 'Total',
      render: (row) => (
        <span className="font-semibold">{formatINR(row.grandTotal)}</span>
      ),
      sortable: true,
    },
    {
      key: 'paymentMethod',
      header: 'Method',
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
      header: 'Actions',
      render: (row) => (
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={() => navigate(`${ROUTES.SALES}/${row.id}`)} title="View receipt">
            <Eye size={16} />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => openPrintModal(row.id)} title="Print receipt">
            <Printer size={16} />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => handleDownload(row.id)} title="Download invoice">
            <Download size={16} />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => { setShareSaleId(row.id); setSharePhone('') }} title="Share on WhatsApp">
            <Share2 size={16} className="text-green-600" />
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="Sales History"
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
                Delete Selected ({selectedIds.size})
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
                  {period.charAt(0).toUpperCase() + period.slice(1)}
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
          emptyMessage="No sales found for this period"
        />
      </Card>

      {/* WhatsApp Share Modal */}
      <Modal
        isOpen={!!shareSaleId}
        onClose={() => { setShareSaleId(null); setSharePhone('') }}
        title="Share Invoice on WhatsApp"
        size="sm"
      >
        <div className="space-y-5">
          {shareSale && (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Invoice: <span className="font-semibold text-gray-800 dark:text-gray-200">{shareSale.invoiceNumber}</span>
              {' · '}{formatINR(shareSale.grandTotal)}
            </p>
          )}
          <Input
            label="WhatsApp Number"
            placeholder="e.g. 9876543210"
            value={sharePhone}
            onChange={(e) => setSharePhone(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleWhatsAppShare()}
          />
          <p className="text-xs text-gray-400">Enter 10-digit mobile number. Country code +91 is added automatically.</p>
          <div className="flex gap-3">
            <Button
              className="flex-1 bg-green-600 hover:bg-green-700 text-white"
              onClick={handleWhatsAppShare}
              leftIcon={<Share2 size={16} />}
            >
              Open WhatsApp
            </Button>
            <Button variant="ghost" className="flex-1" onClick={() => { setShareSaleId(null); setSharePhone('') }}>
              Cancel
            </Button>
          </div>
        </div>
      </Modal>

      {/* Print Format Modal */}
      <Modal isOpen={isPrintModalOpen} onClose={() => { setIsPrintModalOpen(false); setPrintSaleId(null) }} title="Print Invoice" size="sm">
        <div className="space-y-6">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {printSale && `Invoice: ${printSale.invoiceNumber}`}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Select print format:</p>

          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => { setPrintFormat('a4'); handlePrint() }}
              className="flex flex-col items-center gap-3 p-6 rounded-xl border-2 border-gray-200 dark:border-gray-600 hover:border-[#0a0a2e] dark:hover:border-[#0a0a2e] transition-all"
            >
              <FileText size={32} className="text-gray-400" />
              <div className="text-center">
                <p className="font-bold text-gray-900 dark:text-gray-100">A4 Paper</p>
                <p className="text-xs text-gray-400">Standard format</p>
              </div>
            </button>
            <button
              onClick={() => { setPrintFormat('thermal'); handlePrint() }}
              className="flex flex-col items-center gap-3 p-6 rounded-xl border-2 border-gray-200 dark:border-gray-600 hover:border-[#0a0a2e] dark:hover:border-[#0a0a2e] transition-all"
            >
              <Printer size={32} className="text-gray-400" />
              <div className="text-center">
                <p className="font-bold text-gray-900 dark:text-gray-100">50mm Thermal</p>
                <p className="text-xs text-gray-400">POS printer</p>
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
              {blePrinter.status === 'connected' ? `Print to ${blePrinter.deviceName}` : 'Print via Bluetooth'}
            </Button>
          )}

          <Button
            variant="ghost"
            onClick={() => { setIsPrintModalOpen(false); setPrintSaleId(null) }}
            className="w-full"
          >
            Cancel
          </Button>
        </div>
      </Modal>
    </div>
  )
}
