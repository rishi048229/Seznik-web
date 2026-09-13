import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useSupplierLedger } from '@/hooks/useSuppliers'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Spinner } from '@/components/ui/Spinner'
import {
  ArrowLeft,
  Phone,
  Mail,
  MapPin,
  Building2,
  Receipt,
  IndianRupee,
  RotateCcw,
  Plus,
  Clock,
  CheckCircle2,
  AlertCircle,
  Eye,
  Send,
  FileText,
  TrendingDown,
  TrendingUp,
  Wallet,
  Calendar,
} from 'lucide-react'
import { formatINR } from '@/utils/currency'
import { ROUTES } from '@/constants/routes'
import { RecordPurchasePaymentModal } from '@/components/purchases/RecordPurchasePaymentModal'
import { RecordPurchaseModal } from '@/components/purchases/RecordPurchaseModal'
import { PurchaseDetailModal } from '@/components/purchases/PurchaseDetailModal'
import { DebitNoteReceiptModal } from '@/components/purchases/DebitNoteReceiptModal'
import type { Purchase } from '@/types/purchase.types'
import type { SupplierTransaction } from '@/types/supplier.types'
import type { PurchaseReturn } from '@/types/purchaseReturn.types'

export const SupplierDetailPage = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: ledgerData, isLoading, refetch } = useSupplierLedger(id ?? '')

  const [activeTab, setActiveTab] = useState<'purchases' | 'ledger' | 'returns'>('purchases')
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false)
  const [isRecordPurchaseOpen, setIsRecordPurchaseOpen] = useState(false)
  const [selectedPurchase, setSelectedPurchase] = useState<Purchase | null>(null)
  const [paymentSpecificPurchase, setPaymentSpecificPurchase] = useState<Purchase | null>(null)
  const [selectedDebitNote, setSelectedDebitNote] = useState<PurchaseReturn | null>(null)

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner size="lg" />
      </div>
    )
  }

  if (!ledgerData || !ledgerData.supplier) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-4">
        <Building2 size={48} className="text-slate-300 dark:text-slate-600" />
        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">Supplier Not Found</h3>
        <Button onClick={() => navigate(ROUTES.SUPPLIERS)} leftIcon={<ArrowLeft size={16} />}>
          Back to Suppliers
        </Button>
      </div>
    )
  }

  const { supplier, stats, purchases = [], transactions = [], returns = [] } = ledgerData
  const payableBalance = typeof supplier.payableBalance === 'number' ? supplier.payableBalance : (stats?.payableBalance ?? 0)
  const hasPayableDues = payableBalance > 0.009

  const handleSendWhatsAppSummary = () => {
    if (!supplier) return
    const cleanPhone = supplier.phone ? supplier.phone.replace(/[^0-9]/g, '') : ''
    const phone = cleanPhone.startsWith('91') ? cleanPhone : `91${cleanPhone}`
    const unpaidCount = stats?.unpaidPurchasesCount ?? 0

    const msg = [
      `📑 *Account Statement for ${supplier.name}*`,
      ``,
      `Total Purchases: *${formatINR(stats?.totalPurchaseValue ?? 0)}* (${purchases.length} bills)`,
      `Total Settled: *${formatINR(stats?.totalPaidValue ?? 0)}*`,
      `Debit Note Returns: *${formatINR(stats?.totalReturnedValue ?? 0)}*`,
      ``,
      `*Current Outstanding Balance: ${formatINR(payableBalance)}*`,
      unpaidCount > 0 ? `Pending Bills: ${unpaidCount} invoice(s)` : `All previous invoices are settled.`,
      ``,
      `Thank you for your business cooperation! 🙏`,
    ].join('\n')

    const url = `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <PageHeader
        title={supplier.name}
        breadcrumb={['Suppliers', supplier.name]}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              onClick={handleSendWhatsAppSummary}
              className="text-emerald-600 border-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 text-xs sm:text-sm font-semibold flex items-center gap-1.5"
            >
              <Send size={15} />
              <span>WhatsApp Statement</span>
            </Button>
            {hasPayableDues && (
              <Button
                onClick={() => {
                  setPaymentSpecificPurchase(null)
                  setIsPaymentModalOpen(true)
                }}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-semibold flex items-center gap-1.5 shadow-sm"
              >
                <IndianRupee size={15} />
                <span>Record Payment ({formatINR(payableBalance)})</span>
              </Button>
            )}
            <Button
              onClick={() => setIsRecordPurchaseOpen(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-semibold flex items-center gap-1.5"
            >
              <Plus size={15} />
              <span>+ New Purchase</span>
            </Button>
            <Button variant="ghost" onClick={() => navigate(ROUTES.SUPPLIERS)} leftIcon={<ArrowLeft size={16} />}>
              Back
            </Button>
          </div>
        }
      />

      {/* Supplier Profile & Metrics Banner */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Supplier Profile Card */}
        <Card className="p-5 md:col-span-1 space-y-3 bg-white dark:bg-slate-900">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-lg shrink-0">
              {supplier.name.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base leading-tight">
                {supplier.name}
              </h3>
              {supplier.gstin ? (
                <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 block mt-0.5">
                  GSTIN: {supplier.gstin}
                </span>
              ) : null}
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2 text-xs text-slate-600 dark:text-slate-400">
            {supplier.phone && (
              <div className="flex items-center gap-2">
                <Phone size={13} className="text-slate-400" />
                <span>{supplier.phone}</span>
              </div>
            )}
            {supplier.email && (
              <div className="flex items-center gap-2">
                <Mail size={13} className="text-slate-400" />
                <span className="truncate">{supplier.email}</span>
              </div>
            )}
            {supplier.address && (
              <div className="flex items-start gap-2">
                <MapPin size={13} className="text-slate-400 shrink-0 mt-0.5" />
                <span className="leading-snug">{supplier.address}</span>
              </div>
            )}
          </div>
        </Card>

        {/* Metric 1: Net Payable Balance */}
        <Card className={`p-5 flex flex-col justify-between ${hasPayableDues ? 'bg-gradient-to-br from-red-500/10 via-amber-500/5 to-transparent border-red-200 dark:border-red-900/50' : 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/50'}`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Net Payable Balance
            </span>
            <div className={`p-2 rounded-xl ${hasPayableDues ? 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300' : 'bg-emerald-100 text-emerald-600'}`}>
              <Wallet size={18} />
            </div>
          </div>
          <div className="mt-3">
            <h4 className={`text-2xl font-extrabold ${hasPayableDues ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
              {formatINR(payableBalance)}
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1">
              {hasPayableDues ? (
                <>
                  <AlertCircle size={13} className="text-amber-500" />
                  <span>{stats?.unpaidPurchasesCount || 0} unpaid purchase bills</span>
                </>
              ) : (
                <>
                  <CheckCircle2 size={13} className="text-emerald-500" />
                  <span>All accounts settled with supplier</span>
                </>
              )}
            </p>
          </div>
        </Card>

        {/* Metric 2: Total Purchases Value */}
        <Card className="p-5 flex flex-col justify-between bg-white dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Total Purchases
            </span>
            <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
              <TrendingUp size={18} />
            </div>
          </div>
          <div className="mt-3">
            <h4 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100">
              {formatINR(stats?.totalPurchaseValue ?? 0)}
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Across {purchases.length} inward stock bills
            </p>
          </div>
        </Card>

        {/* Metric 3: Total Settled Payments */}
        <Card className="p-5 flex flex-col justify-between bg-white dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Total Payments Made
            </span>
            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400">
              <IndianRupee size={18} />
            </div>
          </div>
          <div className="mt-3">
            <h4 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100">
              {formatINR(stats?.totalPaidValue ?? 0)}
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Returns adjusted: {formatINR(stats?.totalReturnedValue ?? 0)}
            </p>
          </div>
        </Card>
      </div>

      {/* Tabs Navigation */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 gap-6 text-sm font-bold">
        <button
          type="button"
          onClick={() => setActiveTab('purchases')}
          className={`pb-3 border-b-2 transition-all cursor-pointer flex items-center gap-2 ${activeTab === 'purchases' ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400 font-extrabold' : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}
        >
          <Receipt size={16} />
          <span>Purchase Bills ({purchases.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('ledger')}
          className={`pb-3 border-b-2 transition-all cursor-pointer flex items-center gap-2 ${activeTab === 'ledger' ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400 font-extrabold' : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}
        >
          <FileText size={16} />
          <span>Account Ledger / Passbook ({transactions.length})</span>
        </button>

        {returns.length > 0 && (
          <button
            type="button"
            onClick={() => setActiveTab('returns')}
            className={`pb-3 border-b-2 transition-all cursor-pointer flex items-center gap-2 ${activeTab === 'returns' ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400 font-extrabold' : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}
          >
            <RotateCcw size={16} />
            <span>Debit Notes &amp; Returns ({returns.length})</span>
          </button>
        )}
      </div>

      {/* Tab 1: Purchase Bills */}
      {activeTab === 'purchases' && (
        <Card className="overflow-hidden bg-white dark:bg-slate-900">
          {purchases.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700 font-bold uppercase tracking-wider">
                    <th className="py-3 px-4">Invoice #</th>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4 text-center">Items</th>
                    <th className="py-3 px-4 text-right">Bill Total</th>
                    <th className="py-3 px-4 text-right">Paid So Far</th>
                    <th className="py-3 px-4 text-right">Balance Due</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-800 dark:text-slate-200">
                  {purchases.map((p) => {
                    const isPaid = p.paymentStatus === 'paid' || (p.amountPaid || 0) >= (p.grandTotal || 0) - 0.001
                    const isPartial = !isPaid && (p.amountPaid || 0) > 0
                    const outstanding = Math.max(0, (p.grandTotal || 0) - (p.amountPaid || 0))
                    const isOverdue = p.paymentDueDate && !isPaid && new Date(p.paymentDueDate).getTime() < Date.now()

                    return (
                      <tr key={p.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-4">
                          <button
                            type="button"
                            onClick={() => setSelectedPurchase(p)}
                            className="font-bold text-blue-600 dark:text-blue-400 hover:underline text-left"
                          >
                            {p.invoiceNumber}
                          </button>
                          {p.supplierBillNumber && (
                            <p className="text-[10px] text-slate-400 font-mono">Ref: {p.supplierBillNumber}</p>
                          )}
                        </td>
                        <td className="py-3 px-4 text-slate-500">
                          {new Date(p.createdAt).toLocaleDateString('en-IN', {
                            day: '2-digit', month: 'short', year: 'numeric',
                          })}
                        </td>
                        <td className="py-3 px-4 text-center">{p.items?.length || 0}</td>
                        <td className="py-3 px-4 text-right font-bold text-slate-900 dark:text-slate-100">
                          {formatINR(p.grandTotal)}
                        </td>
                        <td className="py-3 px-4 text-right font-semibold text-emerald-600 dark:text-emerald-400">
                          {formatINR(p.amountPaid || 0)}
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-amber-600 dark:text-amber-400">
                          {outstanding > 0 ? formatINR(outstanding) : '—'}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <Badge variant={isPaid ? 'success' : isPartial ? 'warning' : 'danger'} className="text-[10px]">
                            {isPaid ? 'PAID' : isPartial ? 'PARTIAL' : 'UNPAID'}
                          </Badge>
                          {p.paymentDueDate && !isPaid && (
                            <span className={`block text-[10px] mt-0.5 ${isOverdue ? 'text-red-500 font-bold' : 'text-slate-400'}`}>
                              {isOverdue ? 'Overdue' : 'Due'}: {new Date(p.paymentDueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setSelectedPurchase(p)}
                              title="View Bill Details"
                              className="p-1"
                            >
                              <Eye size={14} className="text-slate-500" />
                            </Button>
                            {!isPaid && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setPaymentSpecificPurchase(p)
                                  setIsPaymentModalOpen(true)
                                }}
                                className="text-[11px] py-0.5 px-2 text-emerald-600 border-emerald-200 hover:bg-emerald-50"
                              >
                                Pay
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-12 text-center text-slate-400 space-y-2">
              <Receipt size={36} className="mx-auto text-slate-300 dark:text-slate-600" />
              <p className="text-sm font-semibold">No purchase bills recorded for this supplier yet.</p>
              <Button onClick={() => setIsRecordPurchaseOpen(true)} size="sm">
                + Record First Purchase
              </Button>
            </div>
          )}
        </Card>
      )}

      {/* Tab 2: Account Ledger / Passbook */}
      {activeTab === 'ledger' && (
        <Card className="overflow-hidden bg-white dark:bg-slate-900">
          <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
            <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              Debit / Credit Statement ({transactions.length} entries)
            </h4>
            <span className="text-xs text-slate-500">
              Net Payable: <strong className={hasPayableDues ? 'text-red-600 dark:text-red-400' : 'text-emerald-600'}>{formatINR(payableBalance)}</strong>
            </span>
          </div>

          {transactions.length > 0 ? (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {transactions.map((tx: SupplierTransaction) => {
                const isPurchase = tx.type === 'purchase'
                const isPayment = tx.type === 'payment'
                const isReversal = tx.type === 'debit_note_reversal'

                return (
                  <div key={tx.id} className="p-4 flex items-center justify-between gap-4 text-xs hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${isPurchase ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/40' : isPayment ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40' : 'bg-blue-100 text-blue-600'}`}>
                        {isPurchase ? <Receipt size={14} /> : isPayment ? <IndianRupee size={14} /> : <RotateCcw size={14} />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                            {isPurchase ? 'Inward Purchase' : isPayment ? 'Payment Made' : 'Debit Note Return Reversal'}
                          </span>
                          <Badge variant={isPurchase ? 'warning' : 'success'} className="text-[10px]">
                            {(tx.paymentMethod || 'cash').toUpperCase()}
                          </Badge>
                        </div>
                        <p className="text-slate-500 dark:text-slate-400 mt-0.5">
                          {tx.notes || (tx.referenceId ? `Ref #${tx.referenceId.slice(0, 8)}` : 'Supplier Ledger Entry')}
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className={`font-extrabold text-sm ${isPurchase ? 'text-slate-900 dark:text-slate-100' : isPayment ? 'text-emerald-600 dark:text-emerald-400' : 'text-blue-600 dark:text-blue-400'}`}>
                        {isPurchase ? `+${formatINR(tx.amount)}` : `-${formatINR(tx.amount)}`}
                      </span>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {new Date(tx.createdAt).toLocaleDateString('en-IN', {
                          day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
                        })}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="p-12 text-center text-slate-400">
              <FileText size={36} className="mx-auto text-slate-300 dark:text-slate-600 mb-2" />
              <p className="text-sm font-semibold">No ledger transactions recorded yet.</p>
            </div>
          )}
        </Card>
      )}

      {/* Tab 3: Debit Notes / Returns */}
      {activeTab === 'returns' && (
        <Card className="overflow-hidden bg-white dark:bg-slate-900">
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {returns.map((ret) => (
              <div key={ret.id} className="p-4 flex items-center justify-between gap-4 text-xs">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 dark:text-slate-100 text-sm">{ret.returnNumber}</span>
                    <Badge variant="default">{(ret.settlementMethod || 'cash').toUpperCase()}</Badge>
                    {ret.reason && <span className="text-slate-500 capitalize">({ret.reason.replace('_', ' ')})</span>}
                  </div>
                  <p className="text-slate-400 mt-0.5">
                    {new Date(ret.createdAt).toLocaleDateString('en-IN', {
                      day: '2-digit', month: 'short', year: 'numeric',
                    })}
                    {' • '}
                    {Array.isArray(ret.items) ? `${ret.items.length} item(s) returned` : ''}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <span className="font-bold text-red-600 text-base">-{formatINR(ret.refundAmount)}</span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setSelectedDebitNote(ret)}
                    leftIcon={<Receipt size={14} />}
                  >
                    Debit Slip
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Record Purchase Modal */}
      {isRecordPurchaseOpen && (
        <RecordPurchaseModal
          isOpen={isRecordPurchaseOpen}
          onClose={() => setIsRecordPurchaseOpen(false)}
          onSuccess={() => {
            refetch()
          }}
        />
      )}

      {/* Record Payment Settlement Modal */}
      {isPaymentModalOpen && (
        <RecordPurchasePaymentModal
          isOpen={isPaymentModalOpen}
          onClose={() => {
            setIsPaymentModalOpen(false)
            setPaymentSpecificPurchase(null)
          }}
          purchase={paymentSpecificPurchase}
          supplier={supplier}
          onSuccess={() => {
            refetch()
          }}
        />
      )}

      {/* Purchase Details Modal */}
      {selectedPurchase && (
        <PurchaseDetailModal
          isOpen={Boolean(selectedPurchase)}
          onClose={() => setSelectedPurchase(null)}
          purchase={selectedPurchase}
          supplier={supplier}
          onPaymentRecorded={() => {
            refetch()
          }}
        />
      )}

      {/* Debit Note Slip Modal */}
      {selectedDebitNote && (
        <DebitNoteReceiptModal
          isOpen={Boolean(selectedDebitNote)}
          onClose={() => setSelectedDebitNote(null)}
          purchaseReturn={selectedDebitNote}
          purchase={purchases.find(p => p.id === selectedDebitNote.purchaseId) || null}
        />
      )}
    </div>
  )
}
