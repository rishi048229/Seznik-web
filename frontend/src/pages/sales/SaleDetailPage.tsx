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
import { ArrowLeft, Printer, FileText, Bluetooth, Download, RotateCcw, Receipt, ArrowRightLeft } from 'lucide-react'
import { ProcessReturnModal } from '@/components/sales/ProcessReturnModal'
import { ReturnReceiptModal } from '@/components/sales/ReturnReceiptModal'
import { ProcessExchangeModal } from '@/components/sales/ProcessExchangeModal'
import { ExchangeReceiptModal } from '@/components/sales/ExchangeReceiptModal'
import { useReturnsForSale } from '@/hooks/useSaleReturns'
import { useExchangesForSale } from '@/hooks/useSaleExchanges'
import { useQueryClient } from '@tanstack/react-query'
import { QUERY_KEYS } from '@/constants/queryKeys'

import { formatINR } from '@/utils/currency'
import { generateReceiptHTML, generateReceiptEscPos, printReceipt, resolveEffectiveReceiptConfig } from '@/utils/receipt'
import { downloadA4InvoicePdf } from '@/utils/a4Invoice'
import { shouldPrintThermalOverBle } from '@/utils/printTarget'
import { ROUTES } from '@/constants/routes'
import { Modal } from '@/components/ui/Modal'
import { useBlePrinter } from '@/hooks/useBlePrinter'
import { useLanguage } from '@/contexts/LanguageContext'
import toast from 'react-hot-toast'
import { toastError } from '@/utils/userMessage'

export const SaleDetailPage = () => {
  const { t } = useLanguage()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { data: sale, isLoading } = useSaleById(id ?? '')
  const { data: returns = [] } = useReturnsForSale(id ?? '')
  const { data: exchanges = [] } = useExchangesForSale(id ?? '')
  const { data: settings } = useSettings()
  const { data: customers } = useCustomers()
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false)
  const [showTaxBreakdown, setShowTaxBreakdown] = useState<boolean>(() => settings?.receiptConfig?.showTaxBreakdown ?? true)
  const [isBlePrinting, setIsBlePrinting] = useState(false)
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false)
  const [selectedReturnSlip, setSelectedReturnSlip] = useState<any | null>(null)
  const [isExchangeModalOpen, setIsExchangeModalOpen] = useState(false)
  const [selectedExchangeSlip, setSelectedExchangeSlip] = useState<any | null>(null)
  const blePrinter = useBlePrinter()

  // Accept format directly to avoid React state update race condition
  const handlePrint = async (format: 'a4' | 'thermal') => {
    if (!sale) return

    const receiptConfig = resolveEffectiveReceiptConfig(settings)
    const customerName = (sale.customerId
      ? customers?.find(c => c.id === sale.customerId)?.name
      : undefined) || (sale as any).customerName || (sale as any).customer?.name || 'Walk-in Customer'

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
          printerConfig: settings?.printerConfig,
          receiptFont: settings?.printerConfig?.receiptFont,
          businessName: settings?.businessName,
          businessAddress: settings?.businessAddress,
          customerName,
        })
        await blePrinter.print(bytes)
        setIsPrintModalOpen(false)
        toast.success('Printed to Bluetooth printer')
      } catch (error) {
        toastError(error, t('pos.errFailedPrintBluetooth'))
      } finally {
        setIsBlePrinting(false)
      }
      return
    }

    const customerObj = sale.customerId ? customers?.find(c => c.id === sale.customerId) : undefined
    const customerPhone = customerObj?.phone || (sale as any).customerPhone || (sale as any).customer?.phone || undefined

    const receiptHTML = generateReceiptHTML({
      sale,
      receiptConfig: { ...receiptConfig, showTaxBreakdown },
      printerConfig: settings?.printerConfig,
      businessName: settings?.businessName,
      businessAddress: settings?.businessAddress,
      businessPhone: settings?.businessPhone,
      businessGSTIN: settings?.businessGSTIN,
      customerName,
      customerPhone,
      width: paperWidth,
      logoURL: settings?.businessLogoURL || receiptConfig?.logoURL,
      settingsTaxName: 'GST',
    })

    printReceipt(receiptHTML, paperWidth, sale.invoiceNumber, () => {
      setIsPrintModalOpen(false)
    }, settings?.printerConfig?.receiptFont)
  }

  const handleDownloadPdf = () => {
    if (!sale) return
    const receiptConfig = resolveEffectiveReceiptConfig(settings)
    const customerObj = sale.customerId ? customers?.find(c => c.id === sale.customerId) : undefined
    const customerName = (customerObj?.name) || (sale as any).customerName || (sale as any).customer?.name || 'Walk-in Customer'
    const customerPhone = customerObj?.phone || (sale as any).customerPhone || (sale as any).customer?.phone || undefined
    const html = generateReceiptHTML({
      sale,
      receiptConfig: { ...receiptConfig, showTaxBreakdown },
      printerConfig: settings?.printerConfig,
      businessName: settings?.businessName,
      businessAddress: settings?.businessAddress,
      businessPhone: settings?.businessPhone,
      businessGSTIN: settings?.businessGSTIN,
      customerName,
      customerPhone,
      customer: customerObj || null,
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
      const customerObj = sale.customerId ? customers?.find(c => c.id === sale.customerId) : undefined
      const customerName = (customerObj?.name) || (sale as any).customerName || (sale as any).customer?.name || 'Walk-in Customer'
      const customerPhone = customerObj?.phone || (sale as any).customerPhone || (sale as any).customer?.phone || undefined
      const bytes = await generateReceiptEscPos({
        sale,
        receiptConfig,
        paperSize: settings?.printerConfig?.paperSize || '58mm',
        printerConfig: settings?.printerConfig,
        receiptFont: settings?.printerConfig?.receiptFont,
        businessName: settings?.businessName,
        businessAddress: settings?.businessAddress,
        businessPhone: settings?.businessPhone,
        businessGSTIN: settings?.businessGSTIN,
        businessLogoURL: settings?.businessLogoURL || receiptConfig?.logoURL,
        customerName,
        customerPhone,
      })
      await blePrinter.print(bytes)
      setIsPrintModalOpen(false)
    } catch (error) {
      toastError(error, t('pos.errFailedPrintBluetooth'))
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
          <div className="flex flex-wrap gap-2">
            {sale.returnStatus !== 'full' && (
              <>
                <Button
                  variant="primary"
                  onClick={() => setIsExchangeModalOpen(true)}
                  leftIcon={<ArrowRightLeft size={16} />}
                >
                  Exchange Items
                </Button>
                <Button
                  variant="danger"
                  onClick={() => setIsReturnModalOpen(true)}
                  leftIcon={<RotateCcw size={16} />}
                >
                  Return / Refund
                </Button>
              </>
            )}
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
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Return Status Banner (if returned) */}
        {sale.returnStatus && sale.returnStatus !== 'none' && (
          <div className="flex items-center justify-between p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-2xl">
            <div className="flex items-center gap-3">
              <RotateCcw className="text-amber-600 dark:text-amber-400 shrink-0" size={20} />
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-amber-950 dark:text-amber-200 text-sm">
                    {sale.returnStatus === 'full' ? 'Invoice Fully Returned' : 'Invoice Partially Returned'}
                  </span>
                  <Badge variant={sale.returnStatus === 'full' ? 'danger' : 'warning'}>
                    {sale.returnStatus === 'full' ? 'FULL RETURN' : 'PARTIAL RETURN'}
                  </Badge>
                </div>
                <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
                  Total Refunded: <strong>{formatINR(sale.totalRefunded || 0)}</strong>
                </p>
              </div>
            </div>
            {sale.returnStatus !== 'full' && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsReturnModalOpen(true)}
                leftIcon={<RotateCcw size={14} />}
              >
                Return More
              </Button>
            )}
          </div>
        )}

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
                <span className="text-[#0a0a2e] dark:text-blue-400">{formatINR(sale.grandTotal)}</span>
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

        {/* Returns / Credit Notes Section */}
        {returns.length > 0 && (
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <RotateCcw className="text-rose-600" size={18} />
                <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">
                  Credit Notes &amp; Returns History ({returns.length})
                </h3>
              </div>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {returns.map((ret: any) => (
                <div key={ret.id} className="py-3 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 dark:text-slate-100">
                        {ret.returnNumber}
                      </span>
                      <Badge variant="default">
                        {(ret.refundMethod || 'cash').toUpperCase()}
                      </Badge>
                      {ret.reason && (
                        <span className="text-xs text-slate-500 capitalize">
                          ({ret.reason.replace('_', ' ')})
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {new Date(ret.createdAt).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                      {' • '}
                      {Array.isArray(ret.items) ? `${ret.items.reduce((s: number, i: any) => s + (i.quantity || 0), 0)} items returned` : ''}
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="font-bold text-rose-600 text-base">
                      -{formatINR(ret.refundAmount)}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      leftIcon={<Receipt size={14} />}
                      onClick={() => setSelectedReturnSlip(ret)}
                    >
                      Return Slip
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Exchange History Card */}
        {exchanges.length > 0 && (
          <Card className="p-5">
            <h4 className="font-bold text-slate-900 dark:text-slate-100 text-sm mb-3 flex items-center gap-2">
              <ArrowRightLeft className="text-sky-600" size={16} />
              Exchange Vouchers ({exchanges.length})
            </h4>
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {exchanges.map((exc: any) => {
                const isEven = Math.abs(exc.differenceAmount) < 0.01
                const isUpgrade = exc.differenceAmount > 0
                return (
                  <div key={exc.id} className="py-3 flex items-center justify-between gap-3 text-sm">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                          {exc.exchangeNumber}
                        </span>
                        <Badge variant={isEven ? 'secondary' : isUpgrade ? 'primary' : 'success'}>
                          {isEven ? 'EVEN' : isUpgrade ? 'UPGRADE' : 'DOWNGRADE'}
                        </Badge>
                        <span className="text-xs text-slate-500 uppercase">
                          ({exc.settlementMethod?.replace('_', ' ')})
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {new Date(exc.createdAt).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                        {' • '}
                        Return: <strong>{exc.saleReturn?.returnNumber}</strong>
                        {' • '}
                        New Inv: <strong>#{exc.newSale?.invoiceNumber}</strong>
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className={`font-bold text-base ${isUpgrade ? 'text-blue-600' : isEven ? 'text-slate-700 dark:text-slate-300' : 'text-emerald-600'}`}>
                        {isEven ? 'Rs. 0.00' : `${isUpgrade ? '+' : '-'}${formatINR(Math.abs(exc.differenceAmount))}`}
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        leftIcon={<Receipt size={14} />}
                        onClick={() => setSelectedExchangeSlip(exc)}
                      >
                        Voucher
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>
        )}
      </div>

      {/* Process Return Modal */}
      {sale && (
        <ProcessReturnModal
          sale={sale}
          isOpen={isReturnModalOpen}
          onClose={() => setIsReturnModalOpen(false)}
          onSuccess={(newReturn) => {
            qc.invalidateQueries({ queryKey: [QUERY_KEYS.SALES] })
            qc.invalidateQueries({ queryKey: ['sale-returns'] })
            setSelectedReturnSlip(newReturn)
          }}
        />
      )}

      {/* Process Exchange Modal */}
      {sale && (
        <ProcessExchangeModal
          sale={sale}
          isOpen={isExchangeModalOpen}
          onClose={() => setIsExchangeModalOpen(false)}
          onSuccess={(result) => {
            qc.invalidateQueries({ queryKey: [QUERY_KEYS.SALES] })
            qc.invalidateQueries({ queryKey: ['sale-returns'] })
            qc.invalidateQueries({ queryKey: ['sale-exchanges'] })
            setIsExchangeModalOpen(false)
            setSelectedExchangeSlip(result.exchange)
          }}
        />
      )}

      {/* Return Slip Print/Download Modal */}
      {selectedReturnSlip && sale && (
        <ReturnReceiptModal
          isOpen={!!selectedReturnSlip}
          onClose={() => setSelectedReturnSlip(null)}
          saleReturn={selectedReturnSlip}
          sale={sale}
        />
      )}

      {/* Exchange Voucher Print/Download Modal */}
      {selectedExchangeSlip && sale && (
        <ExchangeReceiptModal
          isOpen={!!selectedExchangeSlip}
          onClose={() => setSelectedExchangeSlip(null)}
          exchange={selectedExchangeSlip}
          originalSale={sale}
          saleReturn={selectedExchangeSlip.saleReturn}
          newSale={selectedExchangeSlip.newSale}
        />
      )}

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
