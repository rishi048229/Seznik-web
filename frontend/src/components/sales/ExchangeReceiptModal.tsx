import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import type { SaleExchange, SaleReturn, Sale } from '@/types/sale.types'
import { useSettings } from '@/hooks/useSettings'
import { generateExchangeSlipHTML, generateExchangeSlipEscPos } from '@/utils/exchangeSlip'
import { printReceipt } from '@/utils/receipt'
import { downloadA4InvoicePdf } from '@/utils/a4Invoice'
import { useBlePrinter } from '@/hooks/useBlePrinter'
import { Printer, Download, CheckCircle2, Bluetooth, ArrowRightLeft } from 'lucide-react'
import { formatINR } from '@/utils/currency'
import toast from 'react-hot-toast'
import { toastError } from '@/utils/userMessage'

interface ExchangeReceiptModalProps {
  isOpen: boolean
  onClose: () => void
  exchange: SaleExchange | null
  originalSale: Sale | null
  saleReturn: SaleReturn | null
  newSale: Sale | null
}

export const ExchangeReceiptModal = ({
  isOpen,
  onClose,
  exchange,
  originalSale,
  saleReturn,
  newSale,
}: ExchangeReceiptModalProps) => {
  const { data: settings } = useSettings()
  const [isBlePrinting, setIsBlePrinting] = useState(false)
  const blePrinter = useBlePrinter()

  if (!exchange || !originalSale || !saleReturn || !newSale) return null

  const isEven = Math.abs(exchange.differenceAmount) < 0.01
  const isUpgrade = exchange.differenceAmount > 0

  const handlePrintThermal = (paperWidth: '50mm' | '80mm' = '50mm') => {
    const html = generateExchangeSlipHTML(exchange, originalSale, saleReturn, newSale, settings, paperWidth)
    printReceipt(html, paperWidth, exchange.exchangeNumber, () => {}, settings?.printerConfig?.receiptFont)
  }

  const handlePrintBluetooth = async () => {
    setIsBlePrinting(true)
    try {
      if (blePrinter.status !== 'connected') {
        await blePrinter.connect()
      }
      const paperSize = settings?.printerConfig?.paperSize || '58mm'
      const bytes = await generateExchangeSlipEscPos(
        exchange,
        originalSale,
        saleReturn,
        newSale,
        settings,
        paperSize as any
      )
      await blePrinter.print(bytes)
      toast.success('Exchange voucher printed to Bluetooth printer')
    } catch (err) {
      toastError(err, 'Failed to print exchange voucher via Bluetooth')
    } finally {
      setIsBlePrinting(false)
    }
  }

  const handleDownloadA4 = () => {
    const html = generateExchangeSlipHTML(exchange, originalSale, saleReturn, newSale, settings, '210mm')
    downloadA4InvoicePdf(html, `${exchange.exchangeNumber}.pdf`, 'A4')
    toast.success(`Exchange Voucher ${exchange.exchangeNumber} downloaded`)
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Exchange Voucher" size="md">
      <div className="space-y-5">
        {/* Success Banner */}
        <div className="flex items-center gap-3 p-4 bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 rounded-xl">
          <div className="w-10 h-10 rounded-full bg-sky-500/10 flex items-center justify-center shrink-0">
            <ArrowRightLeft className="text-sky-600 dark:text-sky-400" size={22} />
          </div>
          <div>
            <h4 className="font-bold text-sky-950 dark:text-sky-200 text-sm">
              Exchange Processed Successfully
            </h4>
            <p className="text-xs text-sky-700 dark:text-sky-400 mt-0.5">
              Voucher <strong>{exchange.exchangeNumber}</strong> linked to Return <strong>{saleReturn.returnNumber}</strong> &amp; New Sale <strong>#{newSale.invoiceNumber}</strong>.
            </p>
          </div>
        </div>

        {/* Settlement Summary */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-500 dark:text-slate-400">New Items Total:</span>
            <span className="font-semibold text-slate-800 dark:text-slate-200">{formatINR(newSale.grandTotal)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500 dark:text-slate-400">Less Return Credit:</span>
            <span className="font-semibold text-emerald-600 dark:text-emerald-400">-{formatINR(saleReturn.refundAmount)}</span>
          </div>
          <div className="flex justify-between pt-2 border-t border-slate-200 dark:border-slate-700 font-bold">
            <span className="text-slate-700 dark:text-slate-300">
              {isEven ? 'Net Difference:' : isUpgrade ? 'Customer Paid:' : 'Store Refunded:'}
            </span>
            <span className={`text-base ${isUpgrade ? 'text-blue-600 dark:text-blue-400' : isEven ? 'text-slate-800 dark:text-slate-200' : 'text-emerald-600 dark:text-emerald-400'}`}>
              {formatINR(Math.abs(exchange.differenceAmount))}
            </span>
          </div>
          <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 pt-1">
            <span>Settlement Mode:</span>
            <span className="font-medium uppercase text-slate-700 dark:text-slate-300">{exchange.settlementMethod.replace('_', ' ')}</span>
          </div>
        </div>

        {/* Print / Download Options */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => handlePrintThermal('50mm')}
            className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-slate-200 dark:border-slate-700 hover:border-blue-500 transition-all text-center group"
          >
            <Printer size={28} className="text-blue-600 group-hover:scale-105 transition-transform" />
            <div>
              <p className="font-bold text-slate-900 dark:text-slate-100 text-sm">58mm Thermal Slip</p>
              <p className="text-[11px] text-slate-400">Compact POS Roll</p>
            </div>
          </button>

          <button
            onClick={handleDownloadA4}
            className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-slate-200 dark:border-slate-700 hover:border-emerald-500 transition-all text-center group"
          >
            <Download size={28} className="text-emerald-600 group-hover:scale-105 transition-transform" />
            <div>
              <p className="font-bold text-slate-900 dark:text-slate-100 text-sm">Download PDF</p>
              <p className="text-[11px] text-slate-400">Full A4 Voucher</p>
            </div>
          </button>
        </div>

        {/* Bluetooth Direct Print (if supported) */}
        {blePrinter.isSupported && (
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
            <Button
              variant="outline"
              onClick={handlePrintBluetooth}
              isLoading={isBlePrinting}
              className="w-full flex items-center justify-center gap-2 py-2.5 text-xs font-semibold"
            >
              <Bluetooth size={16} className="text-blue-600" />
              {blePrinter.status === 'connected' ? 'Print via Connected Bluetooth' : 'Connect & Print Bluetooth'}
            </Button>
          </div>
        )}

        <div className="flex justify-end pt-2">
          <Button variant="outline" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </Modal>
  )
}
