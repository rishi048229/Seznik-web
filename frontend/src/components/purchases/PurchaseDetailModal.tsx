import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import {
  Building2,
  Receipt,
  Calendar,
  CreditCard,
  RotateCcw,
  Printer,
  Clock,
  CheckCircle2,
  FileText,
  IndianRupee,
  PlusCircle,
  Download,
} from 'lucide-react'
import { formatINR } from '@/utils/currency'
import type { Purchase } from '@/types/purchase.types'
import type { Supplier } from '@/types/supplier.types'
import type { PurchaseReturn } from '@/types/purchaseReturn.types'
import { RecordPurchasePaymentModal } from './RecordPurchasePaymentModal'
import { ProcessPurchaseReturnModal } from './ProcessPurchaseReturnModal'
import { DebitNoteReceiptModal } from './DebitNoteReceiptModal'

export interface PurchaseDetailModalProps {
  isOpen: boolean
  onClose: () => void
  purchase: Purchase | null
  supplier?: Supplier | null
  onReturnProcessed?: (newReturn: PurchaseReturn) => void
  onPaymentRecorded?: () => void
}

export const PurchaseDetailModal = ({
  isOpen,
  onClose,
  purchase,
  supplier,
  onReturnProcessed,
  onPaymentRecorded,
}: PurchaseDetailModalProps) => {
  const [isPaymentOpen, setIsPaymentOpen] = useState(false)
  const [isReturnOpen, setIsReturnOpen] = useState(false)
  const [selectedDebitNote, setSelectedDebitNote] = useState<PurchaseReturn | null>(null)

  if (!purchase) return null

  const supplierObj = supplier || (purchase.supplier as Supplier | undefined)
  const isPaid = purchase.paymentStatus === 'paid' || (purchase.amountPaid || 0) >= (purchase.grandTotal || 0) - 0.001
  const isPartial = !isPaid && (purchase.amountPaid || 0) > 0
  const isPending = !isPaid && !isPartial
  const outstandingAmount = Math.max(0, (purchase.grandTotal || 0) - (purchase.amountPaid || 0))

  const purchaseDate = purchase.createdAt
    ? new Date(purchase.createdAt).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : '—'

  const dueDate = purchase.paymentDueDate
    ? new Date(purchase.paymentDueDate).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : null

  const isOverdue = purchase.paymentDueDate && !isPaid && new Date(purchase.paymentDueDate).getTime() < Date.now()

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={`Purchase Details — ${purchase.invoiceNumber}`}
        size="xl"
        footer={
          <div className="flex flex-wrap items-center justify-between gap-3 w-full">
            <div className="flex items-center gap-2">
              {outstandingAmount > 0 && (
                <Button
                  onClick={() => setIsPaymentOpen(true)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex items-center gap-1.5 shadow-sm"
                >
                  <IndianRupee size={15} />
                  <span>Record Payment ({formatINR(outstandingAmount)})</span>
                </Button>
              )}
              {purchase.returnStatus !== 'full' && (
                <Button
                  variant="outline"
                  onClick={() => setIsReturnOpen(true)}
                  className="text-amber-600 border-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/30 flex items-center gap-1.5"
                >
                  <RotateCcw size={15} />
                  <span>Return to Supplier</span>
                </Button>
              )}
            </div>

            <Button variant="ghost" onClick={onClose}>
              Close
            </Button>
          </div>
        }
      >
        <div className="space-y-6 max-h-[75vh] overflow-y-auto pr-1">
          {/* Header Metadata Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Supplier Card */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1.5">
              <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">
                <Building2 size={14} className="text-blue-600 dark:text-blue-400" />
                <span>Supplier</span>
              </div>
              <p className="font-bold text-slate-900 dark:text-slate-100 text-base">
                {supplierObj?.name || 'Unknown Supplier'}
              </p>
              {supplierObj?.phone && <p className="text-xs text-slate-500">📞 {supplierObj.phone}</p>}
              {supplierObj?.gstin && (
                <p className="text-xs text-slate-500 font-mono">GSTIN: {supplierObj.gstin}</p>
              )}
            </div>

            {/* Bill & Invoice Number */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1.5">
              <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">
                <Receipt size={14} className="text-blue-600 dark:text-blue-400" />
                <span>Invoice / Bill</span>
              </div>
              <div className="flex items-center gap-2">
                <p className="font-bold text-slate-900 dark:text-slate-100 text-base">
                  {purchase.invoiceNumber}
                </p>
                {purchase.returnStatus && purchase.returnStatus !== 'none' && (
                  <Badge variant={purchase.returnStatus === 'full' ? 'danger' : 'warning'}>
                    {purchase.returnStatus === 'full' ? 'RETURNED' : 'PARTIAL RETURN'}
                  </Badge>
                )}
              </div>
              {purchase.supplierBillNumber && (
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  Vendor Bill #: <strong>{purchase.supplierBillNumber}</strong>
                </p>
              )}
              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <Calendar size={13} />
                <span>Date: {purchaseDate}</span>
              </div>
            </div>

            {/* Payment & Terms Status */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1.5">
              <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">
                <CreditCard size={14} className="text-blue-600 dark:text-blue-400" />
                <span>Payment Terms</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={isPaid ? 'success' : isPartial ? 'warning' : 'danger'}>
                  {isPaid ? 'PAID IN FULL' : isPartial ? 'PARTIALLY PAID' : 'PAYMENT PENDING'}
                </Badge>
                <span className="text-xs text-slate-500 font-mono uppercase">
                  ({purchase.paymentMethod})
                </span>
              </div>
              {dueDate && (
                <div className="flex items-center gap-1.5 text-xs font-medium">
                  <Clock size={13} className={isOverdue ? 'text-red-500' : 'text-slate-400'} />
                  <span className={isOverdue ? 'text-red-600 dark:text-red-400 font-bold' : 'text-slate-600 dark:text-slate-300'}>
                    {isOverdue ? `Overdue since ${dueDate}` : `Due by ${dueDate}`}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Items Table */}
          <div>
            <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
              Purchase Line Items ({purchase.items?.length ?? 0})
            </h4>
            <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden bg-white dark:bg-slate-900 shadow-sm">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700 font-bold uppercase tracking-wider">
                    <th className="py-2.5 px-3">#</th>
                    <th className="py-2.5 px-3">Item Description</th>
                    <th className="py-2.5 px-3 text-center">Unit Cost (₹)</th>
                    <th className="py-2.5 px-3 text-center">GST %</th>
                    <th className="py-2.5 px-3 text-center">Qty</th>
                    <th className="py-2.5 px-3 text-right">Tax (₹)</th>
                    <th className="py-2.5 px-3 text-right">Total (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-800 dark:text-slate-200">
                  {purchase.items?.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-2.5 px-3 text-slate-400 font-mono">{idx + 1}</td>
                      <td className="py-2.5 px-3">
                        <p className="font-semibold text-slate-900 dark:text-slate-100">{item.productName || item.name}</p>
                        {item.sku && <p className="text-[10px] text-slate-400 font-mono">SKU: {item.sku}</p>}
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono">{formatINR(item.costPrice || item.unitPrice || 0)}</td>
                      <td className="py-2.5 px-3 text-center">{item.taxRate || 0}%</td>
                      <td className="py-2.5 px-3 text-center font-bold">{item.quantity}</td>
                      <td className="py-2.5 px-3 text-right text-slate-500">{formatINR(item.taxAmount || item.gstAmount || 0)}</td>
                      <td className="py-2.5 px-3 text-right font-bold text-slate-900 dark:text-slate-100">
                        {formatINR(item.total || (item.costPrice * item.quantity))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Financial Totals & Settlement Summary */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
            {/* Notes if any */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700 text-xs space-y-1">
              <span className="font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">Notes & Details</span>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed italic">
                {purchase.notes || 'No specific notes entered for this purchase.'}
              </p>
            </div>

            {/* Financial Totals Card */}
            <Card className="p-4 space-y-2 text-xs bg-slate-50 dark:bg-slate-800/80">
              <div className="flex justify-between text-slate-600 dark:text-slate-300">
                <span>Subtotal (Taxable Value):</span>
                <span className="font-semibold text-slate-900 dark:text-slate-100">{formatINR(purchase.subtotal)}</span>
              </div>
              <div className="flex justify-between text-slate-600 dark:text-slate-300">
                <span>GST / Input Tax Credit (ITC):</span>
                <span className="font-semibold text-slate-900 dark:text-slate-100">{formatINR(purchase.totalTax)}</span>
              </div>
              <div className="flex justify-between text-sm font-extrabold text-slate-900 dark:text-slate-100 pt-2 border-t border-slate-200 dark:border-slate-700">
                <span>Grand Total:</span>
                <span className="text-blue-600 dark:text-blue-400 text-base">{formatINR(purchase.grandTotal)}</span>
              </div>
              <div className="flex justify-between text-slate-600 dark:text-slate-300 pt-1">
                <span>Amount Paid to Supplier:</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">{formatINR(purchase.amountPaid || 0)}</span>
              </div>
              {outstandingAmount > 0 && (
                <div className="flex justify-between text-xs font-bold text-amber-600 dark:text-amber-400 pt-1 border-t border-dashed border-slate-200 dark:border-slate-700">
                  <span>Balance Payable:</span>
                  <span>{formatINR(outstandingAmount)}</span>
                </div>
              )}
              {purchase.totalReturned ? (
                <div className="flex justify-between text-xs font-bold text-red-600 dark:text-red-400 pt-1">
                  <span>Total Debit Note Returns:</span>
                  <span>-{formatINR(purchase.totalReturned)}</span>
                </div>
              ) : null}
            </Card>
          </div>

          {/* Linked Debit Notes / Returns */}
          {purchase.returns && purchase.returns.length > 0 && (
            <div className="space-y-2 pt-2">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                <RotateCcw size={14} className="text-amber-600" />
                <span>Debit Notes &amp; Returns on this Invoice ({purchase.returns.length})</span>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden bg-white dark:bg-slate-900">
                {purchase.returns.map((ret) => (
                  <div key={ret.id} className="p-3 flex items-center justify-between gap-3 text-xs">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 dark:text-slate-100">{ret.returnNumber}</span>
                        <Badge variant="default">{(ret.settlementMethod || 'cash').toUpperCase()}</Badge>
                        {ret.reason && <span className="text-slate-500 capitalize">({ret.reason.replace('_', ' ')})</span>}
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {new Date(ret.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="font-bold text-red-600 text-sm">-{formatINR(ret.refundAmount)}</span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSelectedDebitNote(ret)}
                        leftIcon={<FileText size={13} />}
                      >
                        Debit Slip
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* Record Payment Sub-Modal */}
      {isPaymentOpen && (
        <RecordPurchasePaymentModal
          isOpen={isPaymentOpen}
          onClose={() => setIsPaymentOpen(false)}
          purchase={purchase}
          supplier={supplierObj}
          onSuccess={() => {
            onPaymentRecorded?.()
          }}
        />
      )}

      {/* Process Return Sub-Modal */}
      {isReturnOpen && (
        <ProcessPurchaseReturnModal
          isOpen={isReturnOpen}
          onClose={() => setIsReturnOpen(false)}
          purchase={purchase}
          onSuccess={(newRet) => {
            setIsReturnOpen(false)
            onReturnProcessed?.(newRet)
            setSelectedDebitNote(newRet)
          }}
        />
      )}

      {/* Debit Note Slip Preview */}
      {selectedDebitNote && (
        <DebitNoteReceiptModal
          isOpen={Boolean(selectedDebitNote)}
          onClose={() => setSelectedDebitNote(null)}
          purchaseReturn={selectedDebitNote}
          purchase={purchase}
        />
      )}
    </>
  )
}
