import { useState } from 'react'
import { CheckCircle2, Printer, XCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { useQueryClient } from '@tanstack/react-query'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { toastError } from '@/utils/userMessage'
import { updatePrintJobStatus, type PrintJob } from '@/services/printJobService'
import { getSaleById } from '@/services/saleService'
import { useAuth } from '@/contexts/AuthContext'
import { useSettings } from '@/hooks/useSettings'
import { useBlePrinter } from '@/hooks/useBlePrinter'
import { printCompletedSale } from '@/utils/printCompletedSale'
import { QUERY_KEYS } from '@/constants/queryKeys'

interface IncomingPrintJobModalProps {
  job: PrintJob | null
  onClose: () => void
  onHandled: (jobId: string) => void
}

export const IncomingPrintJobModal = ({ job, onClose, onHandled }: IncomingPrintJobModalProps) => {
  const { user } = useAuth()
  const { data: settings } = useSettings()
  const ble = useBlePrinter()
  const queryClient = useQueryClient()
  const [busy, setBusy] = useState(false)

  if (!job) return null

  const mark = async (status: PrintJob['status'], failureReason?: string) => {
    return updatePrintJobStatus(job.id, status, failureReason)
  }

  const handleReject = async () => {
    setBusy(true)
    try {
      await mark('rejected')
      toast.success('Print request declined')
      onHandled(job.id)
    } catch (error) {
      toastError(error, 'Could not decline this request')
    } finally {
      setBusy(false)
    }
  }

  const handleAcceptAndPrint = async () => {
    setBusy(true)
    try {
      await mark('accepted')
      const sale = await getSaleById(user?.uid || user?.id || '', job.saleId)
      if (!sale) throw new Error('Sale not found')

      await mark('printing')
      await printCompletedSale({
        sale,
        settings,
        customerName: sale.customerName || job.sale?.customer?.name || undefined,
        ble,
        skipBrowserFallback: ble.isSupported,
      })
      await mark('completed')
      await queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.SALES] })
      await queryClient.invalidateQueries({ queryKey: ['printJobs'] })
      toast.success(`Printed invoice ${job.sale?.invoiceNumber || ''}`)
      onHandled(job.id)
    } catch (error) {
      try {
        await mark('failed', error instanceof Error ? error.message : 'Print failed')
      } catch {
        /* ignore */
      }
      toastError(error, 'Accepted, but printing failed. You can retry from Sales.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      isOpen={!!job}
      onClose={onClose}
      title="Remote print request"
      size="md"
      footer={
        <div className="flex flex-col sm:flex-row gap-2 w-full">
          <Button variant="ghost" onClick={handleReject} disabled={busy} leftIcon={<XCircle size={16} />}>
            Decline
          </Button>
          <Button
            className="flex-1"
            onClick={handleAcceptAndPrint}
            loading={busy}
            leftIcon={<Printer size={16} />}
          >
            Accept & print
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="flex items-center gap-3 p-3 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
          <span className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center">
            <CheckCircle2 size={20} />
          </span>
          <div>
            <p className="text-sm font-bold text-slate-900 dark:text-gray-100">
              {job.requestedByName} sent invoice {job.sale?.invoiceNumber}
            </p>
            <p className="text-xs text-slate-500 dark:text-gray-400">
              ₹{Number(job.sale?.grandTotal || 0).toFixed(2)} · Accept to print it on this device
            </p>
          </div>
        </div>
        <p className="text-sm text-slate-600 dark:text-gray-300">
          After you accept, this receipt prints on the Bluetooth printer connected here, and the sale is highlighted as a remote print on the Sales page.
        </p>
      </div>
    </Modal>
  )
}
