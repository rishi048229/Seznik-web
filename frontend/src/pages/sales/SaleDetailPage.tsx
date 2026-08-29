import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useSaleById } from '@/hooks/useSales'
import { useSettings } from '@/hooks/useSettings'
import { useCustomers } from '@/hooks/useCustomers'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Spinner } from '@/components/ui/Spinner'
import { ArrowLeft, Printer, FileText, Bluetooth, Download } from 'lucide-react'

import { formatINR } from '@/utils/currency'
import { generateReceiptHTML, generateReceiptEscPos, printReceipt, resolveEffectiveReceiptConfig } from '@/utils/receipt'
import { downloadA4InvoicePdf } from '@/utils/a4Invoice'
import { shouldPrintThermalOverBle } from '@/utils/printTarget'
import { ROUTES } from '@/constants/routes'
import { Modal } from '@/components/ui/Modal'
import { useBlePrinter } from '@/hooks/useBlePrinter'
import { useLanguage } from '@/contexts/LanguageContext'
import toast from 'react-hot-toast'

export const SaleDetailPage = () => {
  const { t } = useLanguage()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: sale, isLoading } = useSaleById(id ?? '')
  const { data: settings } = useSettings()
  const { data: customers } = useCustomers()
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false)
  const [showTaxBreakdown, setShowTaxBreakdown] = useState<boolean>(() => settings?.receiptConfig?.showTaxBreakdown ?? true)
  const [isBlePrinting, setIsBlePrinting] = useState(false)
  const blePrinter = useBlePrinter()

  // Accept format directly to avoid React state update race condition
  const handlePrint = async (format: 'a4' | 'thermal') => {
    if (!sale) return

    const receiptConfig = resolveEffectiveReceiptConfig(settings)
    const customerName = sale.customerId
      ? customers?.find(c => c.id === sale.customerId)?.name
      : ''

    const paperSize = settings?.printerConfig?.paperSize || '58mm'
    const paperWidth: '50mm' | '80mm' | '210mm' = format === 'thermal'
      ? (paperSize === '80mm' ? '80mm' : '50mm')
      : '210mm'

    if (format === 'thermal' && shouldPrintThermalOverBle(settings, blePrinter)) {
      setIsBlePrinting(true)
      try {
        if (blePrinter.status !== 'connected') await blePrinter.connect()
        const bytes = await generateReceiptEscPos({
          sale,
          receiptConfig: { ...receiptConfig, showTaxBreakdown },
          paperSize,
          businessName: settings?.businessName,
          businessAddress: settings?.businessAddress,
          customerName,
        })
        await blePrinter.print(bytes)
        setIsPrintModalOpen(false)
        toast.success('Printed to Bluetooth printer')
      } catch (error) {
        toast.error(error instanceof Error ? error.message : t('pos.errFailedPrintBluetooth'))
      } finally {
        setIsBlePrinting(false)
      }
      return
    }

    const receiptHTML = generateReceiptHTML({
      sale,
      receiptConfig: { ...receiptConfig, showTaxBreakdown },
      printerConfig: settings?.printerConfig,
      businessName: settings?.businessName,
      businessAddress: settings?.businessAddress,
      customerName,
      width: paperWidth,
      logoURL: settings?.businessLogoURL || receiptConfig?.logoURL,
      settingsTaxName: 'GST',
    })

    printReceipt(receiptHTML, paperWidth, sale.invoiceNumber, () => {
      setIsPrintModalOpen(false)
    })
  }

  const handleDownloadPdf = () => {
    if (!sale) return
    const receiptConfig = resolveEffectiveReceiptConfig(settings)
    const customerName = sale.customerId
      ? customers?.find(c => c.id === sale.customerId)?.name
      : ''
    const html = generateReceiptHTML({
      sale,
      receiptConfig: { ...receiptConfig, showTaxBreakdown },
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

  const handlePrintBluetooth = async () => {
    if (!sale) return
    setIsBlePrinting(true)
    try {
      if (blePrinter.status !== 'connected') {
        await blePrinter.connect()
      }
      const receiptConfig = resolveEffectiveReceiptConfig(settings)
      const customerName = sale.customerId
        ? customers?.find(c => c.id === sale.customerId)?.name
        : ''
      const bytes = await generateReceiptEscPos({
        sale,
        receiptConfig,
        paperSize: settings?.printerConfig?.paperSize || '58mm',
        businessName: settings?.businessName,
        businessAddress: settings?.businessAddress,
        customerName,
      })
      await blePrinter.print(bytes)
      setIsPrintModalOpen(false)
    } catch (error) {
      const msg = error instanceof Error ? error.message : t('pos.errFailedPrintBluetooth')
      toast.error(msg)
    } finally {
      setIsBlePrinting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-12"><Spinner size="lg" /></div>
    )
  }

  if (!sale) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <p className="text-gray-500 dark:text-gray-400 mb-4">{t('sales.saleNotFound')}</p>
        <Button onClick={() => navigate(ROUTES.SALES)} leftIcon={<ArrowLeft size={16} />}>
          {t('sales.backToSales')}
        </Button>
      </div>
    )
  }

  const saleDate = (sale.createdAt as unknown as { toDate?: () => Date })?.toDate ? new Date((sale.createdAt as unknown as { toDate?: () => Date }).toDate!()) : new Date(sale.createdAt || Date.now())

  const uniqueTaxRates = Array.from(new Set(sale.items?.map(item => item.taxRate || 0).filter(rate => rate > 0) ?? []))
  const formattedTaxRate = uniqueTaxRates.length === 1 ? (Math.round(uniqueTaxRates[0] * 100) / 100).toString() : ''
  const taxLabel = uniqueTaxRates.length === 0
    ? 'GST'
    : uniqueTaxRates.length === 1
      ? `GST (${formattedTaxRate}%)`
      : t('sales.gstItemWise')

  return (
    <div>
      <PageHeader
        title={t('sales.saleDetailsTitle')}
        breadcrumb={[t('page.salesHistory'), sale.invoiceNumber]}
        action={
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setIsPrintModalOpen(true)} leftIcon={<Printer size={16} />}>
              {t('pos.print')}
            </Button>
            <Button variant="ghost" onClick={handleDownloadPdf} leftIcon={<Download size={16} />}>
              Download PDF
            </Button>
            <Button variant="ghost" onClick={() => navigate(ROUTES.SALES)} leftIcon={<ArrowLeft size={16} />}>
              {t('common.back')}
            </Button>
          </div>
        }
      />

      {/* Sale details card (for screen viewing) */}
      <div className="max-w-2xl mx-auto">
        <Card className="overflow-hidden">
          {/* Receipt Header */}
          <div className="bg-[#0a0a2e] text-white p-6 text-center">
            <div className="flex flex-col items-center justify-center gap-1.5 mb-1">
              <img
                src={settings?.businessLogoURL || '/seznik_logo.png'}
                alt={settings?.businessName || 'Business Logo'}
                className="max-h-14 max-w-[200px] object-contain rounded p-1 bg-white/10 shadow-sm"
              />
              <h3 className="text-xl font-bold text-white tracking-wide mt-1">
                {settings?.businessName || 'Seznik Retail'}
              </h3>
              {settings?.businessAddress && (
                <p className="text-xs text-slate-300 font-medium">{settings.businessAddress}</p>
              )}
            </div>
          </div>

          <div className="p-6 space-y-4">
            {/* Invoice Info */}
            <div className="flex justify-between items-start pb-4 border-b border-gray-200 dark:border-gray-700">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">{t('sales.invoiceHeader')}</p>
                <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{sale.invoiceNumber}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-500 dark:text-gray-400">{t('common.date')}</p>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {saleDate.toLocaleDateString('en-US', {
                    month: 'long', day: 'numeric', year: 'numeric',
                  })}
                </p>
                <p className="text-xs text-gray-400">
                  {saleDate.toLocaleTimeString('en-US', {
                    hour: '2-digit', minute: '2-digit',
                  })}
                </p>
              </div>
            </div>

            {/* Customer */}
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('dashboard.customerLabel')}</p>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {sale.customerId ? t('sales.registeredCustomer') : t('dashboard.walkInCustomer')}
              </p>
            </div>

            {/* Payment Method */}
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('pos.paymentMethod')}</p>
              <Badge variant={
                sale.paymentMethod === 'cash' ? 'success' :
                sale.paymentMethod === 'card' ? 'info' :
                sale.paymentMethod === 'upi' ? 'default' : 'warning'
              }>
                {sale.paymentMethod?.toUpperCase()}
              </Badge>
            </div>

            {/* Items Table */}
            <div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left py-2 text-gray-500 dark:text-gray-400 font-medium">{t('sales.itemHeader')}</th>
                    <th className="text-center py-2 text-gray-500 dark:text-gray-400 font-medium">{t('sales.qtyHeader')}</th>
                    <th className="text-right py-2 text-gray-500 dark:text-gray-400 font-medium">{t('common.price')}</th>
                    <th className="text-right py-2 text-gray-500 dark:text-gray-400 font-medium">{t('common.total')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {sale.items?.map((item, i) => (
                    <tr key={i}>
                      <td className="py-3">
                        <p className="font-medium text-gray-900 dark:text-gray-100">{item.productName}</p>
                        {item.discount > 0 && (
                          <p className="text-xs text-emerald-600">{t('sales.discPrefix')} {formatINR(item.discount)}</p>
                        )}
                      </td>
                      <td className="py-3 text-center text-gray-600 dark:text-gray-300">{item.quantity}</td>
                      <td className="py-3 text-right text-gray-600 dark:text-gray-300">
                        {formatINR(item.sellingPrice)}
                      </td>
                      <td className="py-3 text-right font-medium text-gray-900 dark:text-gray-100">
                        {formatINR(item.sellingPrice * item.quantity - item.discount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals */}
            <div className="border-t border-gray-200 dark:border-gray-700 pt-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500 dark:text-gray-400">{t('pos.subtotal')}</span>
                <span className="text-gray-900 dark:text-gray-100">{formatINR(sale.subtotal)}</span>
              </div>
              {sale.totalDiscount > 0 && (
                <div className="flex justify-between text-sm text-emerald-600">
                  <span>{t('pos.discount')}</span>
                  <span>-{formatINR(sale.totalDiscount)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-gray-500 dark:text-gray-400">
                  {taxLabel}
                </span>
                <span className="text-gray-900 dark:text-gray-100">{formatINR(sale.totalTax)}</span>
              </div>
              <div className="flex justify-between text-lg font-bold pt-3 border-t border-gray-200 dark:border-gray-700">
                <span className="text-gray-900 dark:text-gray-100">{t('sales.grandTotal')}</span>
                <span className="text-[#0a0a2e]">{formatINR(sale.grandTotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500 dark:text-gray-400">{t('sales.amountPaid')}</span>
                <span className="font-medium text-gray-900 dark:text-gray-100">{formatINR(sale.amountPaid)}</span>
              </div>
              {sale.amountPaid !== sale.grandTotal && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">
                    {sale.amountPaid > sale.grandTotal ? t('pos.change') : t('sales.due')}
                  </span>
                  <span className={`font-medium ${
                    sale.amountPaid >= sale.grandTotal ? 'text-emerald-600' : 'text-red-600'
                  }`}>
                    {formatINR(Math.abs(sale.amountPaid - sale.grandTotal))}
                  </span>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="text-center pt-4 border-t border-gray-200 dark:border-gray-700">
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('sales.thankYouShopping')}</p>
              <p className="text-xs text-gray-400 mt-1">{t('sales.poweredBy')}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Print Format Modal */}
      <Modal isOpen={isPrintModalOpen} onClose={() => setIsPrintModalOpen(false)} title={t('pos.printReceiptTitle')} size="sm">
        <div className="space-y-5">
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('pos.selectPrintFormat')}</p>

          {/* Show / Hide Tax Info Toggle */}
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
            <div>
              <p className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200">Show Tax &amp; GST Info</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Include GST columns &amp; tax breakdown in bill</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={showTaxBreakdown}
                onChange={(e) => setShowTaxBreakdown(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
            </label>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => handlePrint('a4')}
              className="flex flex-col items-center gap-3 p-6 rounded-xl border-2 border-gray-200 dark:border-gray-600 hover:border-[#0a0a2e] dark:hover:border-[#0a0a2e] transition-all"
            >
              <FileText size={32} className="text-gray-400" />
              <div className="text-center">
                <p className="font-bold text-gray-900 dark:text-gray-100">{t('pos.a4Paper')}</p>
                <p className="text-xs text-gray-400">{t('pos.standardFormat')}</p>
              </div>
            </button>
            <button
              onClick={() => handlePrint('thermal')}
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

          <Button
            variant="ghost"
            onClick={() => { setIsPrintModalOpen(false); }}
            className="w-full"
          >
            {t('action.cancel')}
          </Button>
        </div>
      </Modal>
    </div>
  )
}
