import { useState, useMemo } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Printer, Download, Bluetooth, CheckCircle2, FileText, RotateCcw } from 'lucide-react'
import type { PurchaseReturn } from '@/types/purchaseReturn.types'
import type { Purchase } from '@/types/purchase.types'
import { useSettings } from '@/hooks/useSettings'
import { useBlePrinter } from '@/hooks/useBlePrinter'
import { generateDebitNoteSlipHTML, generateDebitNoteSlipEscPos } from '@/utils/debitNoteSlip'
import { printReceipt } from '@/utils/receipt'
import { downloadA4InvoicePdf } from '@/utils/a4Invoice'
import { formatINR } from '@/utils/currency'
import toast from 'react-hot-toast'
import { toastError } from '@/utils/userMessage'

interface DebitNoteReceiptModalProps {
  isOpen: boolean
  onClose: () => void
  purchaseReturn: PurchaseReturn | null
  purchase: Purchase | null
}

export const DebitNoteReceiptModal = ({
  isOpen,
  onClose,
  purchaseReturn,
  purchase,
}: DebitNoteReceiptModalProps) => {
  const { data: settings } = useSettings()
  const [printFormat, setPrintFormat] = useState<'50mm' | '80mm' | '210mm'>('50mm')
  const [isBlePrinting, setIsBlePrinting] = useState(false)
  const blePrinter = useBlePrinter()

  if (!purchaseReturn || !purchase) return null

  // Determine Full vs Partial Return
  const totalOrigQty = Array.isArray(purchase.items)
    ? purchase.items.reduce((s, i) => s + (Number(i.quantity) || 0), 0)
    : 0
  const totalReturnQty = Array.isArray(purchaseReturn.items)
    ? purchaseReturn.items.reduce((s, i) => s + (Number(i.quantity) || 0), 0)
    : 0
  const isFullReturn = purchase.returnStatus === 'full' || (totalOrigQty > 0 && totalReturnQty >= totalOrigQty)

  const slipHtml = generateDebitNoteSlipHTML(purchaseReturn, purchase, settings, printFormat)

  // Direct Browser / USB / Thermal print using 58mm or 80mm
  const handlePrintThermal = (paperWidth: '50mm' | '80mm' = '50mm') => {
    const html = generateDebitNoteSlipHTML(purchaseReturn, purchase, settings, paperWidth)
    printReceipt(html, paperWidth, purchaseReturn.returnNumber, () => {}, settings?.printerConfig?.receiptFont)
  }

  // Bluetooth connected 58mm printer
  const handlePrintBluetooth = async () => {
    setIsBlePrinting(true)
    try {
      if (blePrinter.status !== 'connected') {
        await blePrinter.connect()
      }
      const paperSize = settings?.printerConfig?.paperSize || '58mm'
      const bytes = await generateDebitNoteSlipEscPos(purchaseReturn, purchase, settings, paperSize as any)
      await blePrinter.print(bytes)
      toast.success('Debit note slip printed to Bluetooth 58mm printer')
    } catch (err) {
      toastError(err, 'Failed to print debit note via Bluetooth')
    } finally {
      setIsBlePrinting(false)
    }
  }

  const handleDownloadA4 = () => {
    const html = generateDebitNoteSlipHTML(purchaseReturn, purchase, settings, '210mm')
    downloadA4InvoicePdf(html, `DebitNote-${purchaseReturn.returnNumber}.pdf`, 'A4')
    toast.success(`Debit Note ${purchaseReturn.returnNumber} downloaded`)
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Debit Note / Purchase Return (${purchaseReturn.returnNumber})`}
      size="lg"
    >
      <div className="space-y-4">
        {/* Status Banner */}
        <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-100 dark:bg-blue-950/60 rounded-xl text-blue-600 dark:text-blue-400">
              <RotateCcw size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                  Debit Note #{purchaseReturn.returnNumber}
                </h4>
                <Badge variant={isFullReturn ? 'danger' : 'warning'}>
                  {isFullReturn ? 'Full Return' : 'Partial Return'}
                </Badge>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Ref Purchase: <strong>#{purchase.invoiceNumber}</strong> • Supplier: <strong>{purchaseReturn.supplier?.name || purchase.supplier?.name || 'Supplier'}</strong>
              </p>
            </div>
          </div>
          <div className="text-right">
            <span className="text-xs text-slate-400 block font-medium">Total Debit Amount</span>
            <span className="text-lg font-extrabold text-blue-600 dark:text-blue-400">{formatINR(purchaseReturn.refundAmount)}</span>
          </div>
        </div>

        {/* Print Option Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* 58mm Thermal Print Card */}
          <button
            type="button"
            onClick={() => handlePrintThermal('50mm')}
            className="flex flex-col items-center gap-2 p-3.5 rounded-xl border-2 border-blue-200 dark:border-blue-900/60 hover:border-blue-600 dark:hover:border-blue-400 bg-white dark:bg-slate-900 transition-all text-center group shadow-sm hover:shadow-md"
          >
            <div className="p-2 bg-blue-50 dark:bg-blue-950/40 rounded-lg text-blue-600 group-hover:scale-110 transition-transform">
              <Printer size={22} />
            </div>
            <div>
              <p className="font-bold text-slate-900 dark:text-slate-100 text-xs">Print 58mm Thermal</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Connected 58mm POS Printer</p>
            </div>
          </button>

          {/* 80mm Thermal Print Card */}
          <button
            type="button"
            onClick={() => handlePrintThermal('80mm')}
            className="flex flex-col items-center gap-2 p-3.5 rounded-xl border-2 border-slate-200 dark:border-slate-700 hover:border-blue-600 dark:hover:border-blue-400 bg-white dark:bg-slate-900 transition-all text-center group shadow-sm hover:shadow-md"
          >
            <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-700 dark:text-slate-300 group-hover:scale-110 transition-transform">
              <Printer size={22} />
            </div>
            <div>
              <p className="font-bold text-slate-900 dark:text-slate-100 text-xs">Print 80mm Thermal</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Standard 3-Inch Slip</p>
            </div>
          </button>

          {/* Download PDF / A4 Card */}
          <button
            type="button"
            onClick={handleDownloadA4}
            className="flex flex-col items-center gap-2 p-3.5 rounded-xl border-2 border-slate-200 dark:border-slate-700 hover:border-emerald-600 dark:hover:border-emerald-400 bg-white dark:bg-slate-900 transition-all text-center group shadow-sm hover:shadow-md"
          >
            <div className="p-2 bg-emerald-50 dark:bg-emerald-950/40 rounded-lg text-emerald-600 group-hover:scale-110 transition-transform">
              <Download size={22} />
            </div>
            <div>
              <p className="font-bold text-slate-900 dark:text-slate-100 text-xs">Download A4 PDF</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Official Document Format</p>
            </div>
          </button>
        </div>

        {/* Bluetooth 58mm Direct Print Bar */}
        {blePrinter.isSupported && (
          <Button
            variant="outline"
            className="w-full border-blue-200 dark:border-blue-800 hover:bg-blue-50 dark:hover:bg-blue-950/30 text-blue-600 dark:text-blue-400"
            loading={isBlePrinting}
            leftIcon={<Bluetooth size={16} />}
            onClick={handlePrintBluetooth}
          >
            {blePrinter.status === 'connected'
              ? `Print to Connected 58mm Bluetooth (${blePrinter.deviceName})`
              : 'Connect & Print to 58mm Bluetooth Printer'}
          </Button>
        )}

        {/* Live Slip Preview Tab Switcher */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-700">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Preview Format:</span>
          <div className="flex gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
            <button
              onClick={() => setPrintFormat('50mm')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                printFormat === '50mm'
                  ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              58mm Roll
            </button>
            <button
              onClick={() => setPrintFormat('80mm')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                printFormat === '80mm'
                  ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              80mm Roll
            </button>
            <button
              onClick={() => setPrintFormat('210mm')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                printFormat === '210mm'
                  ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              A4 Page
            </button>
          </div>
        </div>

        {/* Preview Frame */}
        <div className="flex justify-center bg-slate-100 dark:bg-slate-900 p-4 rounded-xl max-h-[45vh] overflow-y-auto">
          <div
            className="bg-white text-black p-3 shadow-md rounded-lg overflow-hidden transition-all"
            style={{ width: printFormat === '50mm' ? '300px' : printFormat === '80mm' ? '400px' : '100%', maxWidth: '100%' }}
          >
            <iframe
              srcDoc={slipHtml}
              title="Debit Note Preview"
              className="w-full border-0 min-h-[380px]"
              style={{ height: printFormat === '210mm' ? '500px' : '400px' }}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-2 border-t border-slate-200 dark:border-slate-700">
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  )
}
