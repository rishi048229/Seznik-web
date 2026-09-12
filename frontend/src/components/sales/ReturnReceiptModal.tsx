import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import type { SaleReturn, Sale } from '@/types/sale.types'
import { useSettings } from '@/hooks/useSettings'
import { generateReturnSlipHTML, generateReturnSlipEscPos } from '@/utils/returnSlip'
import { printReceipt } from '@/utils/receipt'
import { downloadA4InvoicePdf } from '@/utils/a4Invoice'
import { useBlePrinter } from '@/hooks/useBlePrinter'
import { Printer, FileText, Download, CheckCircle2, Bluetooth } from 'lucide-react'
import { formatINR } from '@/utils/currency'
import toast from 'react-hot-toast'
import { toastError } from '@/utils/userMessage'

interface ReturnReceiptModalProps {
  isOpen: boolean
  onClose: () => void
  saleReturn: SaleReturn | null
  sale: Sale | null
}

export const ReturnReceiptModal = ({
  isOpen,
  onClose,
  saleReturn,
  sale,
}: ReturnReceiptModalProps) => {
  const { data: settings } = useSettings()
  const [isBlePrinting, setIsBlePrinting] = useState(false)
  const blePrinter = useBlePrinter()

  if (!saleReturn || !sale) return null

  const handlePrintThermal = (paperWidth: '50mm' | '80mm' = '50mm') => {
    const html = generateReturnSlipHTML(saleReturn, sale, settings, paperWidth)
    printReceipt(html, paperWidth, saleReturn.returnNumber, () => {}, settings?.printerConfig?.receiptFont)
  }

  const handlePrintBluetooth = async () => {
    setIsBlePrinting(true)
    try {
      if (blePrinter.status !== 'connected') {
        await blePrinter.connect()
      }
      const paperSize = settings?.printerConfig?.paperSize || '58mm'
      const bytes = await generateReturnSlipEscPos(saleReturn, sale, settings, paperSize as any)
      await blePrinter.print(bytes)
      toast.success('Return slip printed to Bluetooth printer')
    } catch (err) {
      toastError(err, 'Failed to print return slip via Bluetooth')
    } finally {
      setIsBlePrinting(false)
    }
  }

  const handleDownloadA4 = () => {
    const html = generateReturnSlipHTML(saleReturn, sale, settings, '210mm')
    downloadA4InvoicePdf(html, `${saleReturn.returnNumber}.pdf`, 'A4')
    toast.success(`Credit Note ${saleReturn.returnNumber} downloaded`)
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Credit Note / Return Slip" size="md">
      <div className="space-y-5">
        {/* Success Banner */}
        <div className="flex items-center gap-3 p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl">
          <CheckCircle2 className="text-emerald-600 dark:text-emerald-400 shrink-0" size={24} />
          <div>
            <h4 className="font-bold text-emerald-950 dark:text-emerald-200 text-sm">
              Return Processed Successfully
            </h4>
            <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-0.5">
              Credit Note <strong>{saleReturn.returnNumber}</strong> has been generated for invoice #{sale.invoiceNumber}.
            </p>
          </div>
        </div>

        {/* Refund Details Summary */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-500 dark:text-slate-400">Total Refund:</span>
            <span className="font-bold text-slate-900 dark:text-slate-100">{formatINR(saleReturn.refundAmount)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500 dark:text-slate-400">Settlement Mode:</span>
            <span className="font-semibold text-slate-800 dark:text-slate-200 uppercase">{saleReturn.refundMethod.replace('_', ' ')}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500 dark:text-slate-400">Items Returned:</span>
            <span className="text-slate-800 dark:text-slate-200">{saleReturn.items.reduce((sum, i) => sum + i.quantity, 0)} units</span>
          </div>
        </div>

        {/* Print / Download Options */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => handlePrintThermal('50mm')}
            className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-slate-200 dark:border-slate-700 hover:border-[#0a0a2e] dark:hover:border-blue-500 transition-all text-center group"
          >
            <Printer size={28} className="text-blue-600 group-hover:scale-105 transition-transform" />
            <div>
              <p className="font-bold text-slate-900 dark:text-slate-100 text-sm">58mm Thermal Slip</p>
              <p className="text-[11px] text-slate-400">Compact POS Roll</p>
            </div>
          </button>

          <button
            onClick={handleDownloadA4}
            className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-slate-200 dark:border-slate-700 hover:border-[#0a0a2e] dark:hover:border-blue-500 transition-all text-center group"
          >
            <Download size={28} className="text-emerald-600 group-hover:scale-105 transition-transform" />
            <div>
              <p className="font-bold text-slate-900 dark:text-slate-100 text-sm">Download PDF</p>
              <p className="text-[11px] text-slate-400">Full A4 Credit Note</p>
            </div>
          </button>
        </div>

        {/* Bluetooth Direct Print (if supported) */}
        {blePrinter.isSupported && (
          <Button
            variant="outline"
            className="w-full"
            loading={isBlePrinting}
            leftIcon={<Bluetooth size={16} />}
            onClick={handlePrintBluetooth}
          >
            {blePrinter.status === 'connected' ? `Print to Bluetooth (${blePrinter.deviceName})` : 'Print via Bluetooth Printer (58mm)'}
          </Button>
        )}

        <div className="flex justify-end pt-2">
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  )
}
