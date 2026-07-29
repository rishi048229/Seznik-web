import { useState, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useCustomers, useRecordPayment, useCreditTransactions } from '@/hooks/useCustomers'
import { useSales } from '@/hooks/useSales'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import {
  ArrowLeft, Mail, Phone, MapPin, CreditCard, TrendingUp, ShoppingCart,
  Calendar, Wallet, ShoppingBag, PlusCircle, AlertCircle, CheckCircle2,
  Send, MessageCircle, DollarSign
} from 'lucide-react'
import { formatINR } from '@/utils/currency'
import { ROUTES } from '@/constants/routes'
import toast from 'react-hot-toast'
import type { Customer, CreditTransaction } from '@/types/customer.types'


export const CustomerDetailPage = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: customers } = useCustomers()
  const { data: sales } = useSales()
  const { data: transactions } = useCreditTransactions()
  const { mutate: recordPayment, isPending: isRecordingPayment } = useRecordPayment()

  const [isPaymentOpen, setIsPaymentOpen] = useState(false)
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentNotes, setPaymentNotes] = useState('')

  const customer = (customers ?? []).find(c => c.id === id) as Customer | undefined
  const customerSales = sales?.filter(s => s.customerId === id) ?? []
  const customerTransactions = transactions?.filter((t: CreditTransaction) => t.customerId === id) ?? []

  // Calculate unpaid credit sales total
  const creditSales = customerSales.filter(s => s.paymentMethod === 'credit')
  const unpaidCreditSalesSum = creditSales.reduce((sum, s) => {
    const unpaid = s.grandTotal - (s.amountPaid ?? 0)
    return sum + Math.max(0, unpaid)
  }, 0)

  // Combined credit balance (database record or calculated from credit sales)
  const customerCreditBalance = customer?.creditBalance || 0
  const totalCreditBalance = Math.max(customerCreditBalance, unpaidCreditSalesSum)
  const hasUnpaidCredit = totalCreditBalance > 0

  const totalSpent = customerSales.reduce((sum, s) => sum + s.grandTotal, 0)
  const avgOrderValue = customerSales.length > 0 ? totalSpent / customerSales.length : 0

  const accountAge = useMemo(() => {
    if (!customer?.createdAt) return 0
    const raw = customer.createdAt as { toDate?: () => Date } | string | number
    const d = typeof raw === 'object' && raw?.toDate ? raw.toDate() : (typeof raw === 'string' || typeof raw === 'number') ? new Date(raw) : new Date(0)

    const dTime = d.getTime()
    if (isNaN(dTime)) return 0
    return Math.round((new Date().getFullYear() - d.getFullYear()) * 10) / 10
  }, [customer])



  const initials = customer?.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() ?? ''

  const handleOpenPaymentModal = () => {
    setPaymentAmount(String(totalCreditBalance > 0 ? totalCreditBalance : ''))
    setPaymentNotes('')
    setIsPaymentOpen(true)
  }

  const handleRecordPaymentSubmit = () => {
    const amount = parseFloat(paymentAmount)
    if (!amount || amount <= 0 || !customer) {
      toast.error('Please enter a valid payment amount')
      return
    }

    recordPayment(
      { customerId: customer.id, amount, notes: paymentNotes || 'Credit settlement' },
      {
        onSuccess: () => {
          toast.success(`Recorded payment of ${formatINR(amount)} for ${customer.name}`)
          setIsPaymentOpen(false)
          setPaymentAmount('')
          setPaymentNotes('')
        },
        onError: (err: unknown) => {
          toast.error(err instanceof Error ? err.message : 'Failed to record payment')
        }
      }
    )
  }


  const handleSendWhatsAppReminder = () => {
    if (!customer) return
    const cleanPhone = customer.phone ? customer.phone.replace(/[^0-9]/g, '') : ''
    const msg = `Hello ${customer.name}, this is a gentle reminder that your store credit balance of ${formatINR(totalCreditBalance)} is currently due. Please settle your account at your earliest convenience. Thank you!`
    const url = cleanPhone
      ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`
    window.open(url, '_blank')
  }

  if (!customer) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" onClick={() => navigate(ROUTES.CUSTOMERS)} className="p-2">
            <ArrowLeft size={20} />
          </Button>
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Customer Not Found</h2>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate(ROUTES.CUSTOMERS)} className="p-2">
            <ArrowLeft size={20} />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{customer.name}</h2>
              {hasUnpaidCredit ? (
                <Badge variant="danger" className="text-xs px-2.5 py-1 font-bold animate-pulse">
                  UNPAID CREDIT DUE
                </Badge>
              ) : (
                <Badge variant="success" className="text-xs px-2.5 py-1 font-bold">
                  CREDITS PAID
                </Badge>
              )}
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">ID: #{customer.id.slice(0, 8).toUpperCase()}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
          {hasUnpaidCredit && (
            <Button
              onClick={handleSendWhatsAppReminder}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold flex items-center gap-1.5"
            >
              <MessageCircle size={16} />
              <span>Reminder</span>
            </Button>
          )}
          <Button
            onClick={handleOpenPaymentModal}
            className="bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-bold flex items-center gap-1.5"
          >
            <DollarSign size={16} />
            <span>Settle Credit</span>
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate(ROUTES.POS)}
            className="text-xs sm:text-sm"
          >
            New Sale
          </Button>
        </div>
      </div>

      {/* Outstanding Credit Reminder Card */}
      {hasUnpaidCredit ? (
        <Card className="p-5 sm:p-6 bg-gradient-to-r from-amber-500/10 via-red-500/10 to-amber-500/10 border-2 border-red-500/30 rounded-2xl relative overflow-hidden">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-red-100 dark:bg-red-900/40 text-red-600 flex items-center justify-center shrink-0">
                <AlertCircle size={28} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">Outstanding Credit Balance</h3>
                  <Badge variant="danger" className="font-extrabold text-xs">PAYMENT PENDING</Badge>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                  This customer took credit purchases and currently owes <span className="font-bold text-red-600 dark:text-red-400">{formatINR(totalCreditBalance)}</span>.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto justify-end shrink-0">
              <Button
                onClick={handleSendWhatsAppReminder}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm px-4 py-2 flex items-center gap-2 rounded-xl shadow-md"
              >
                <Send size={15} />
                <span>Send WhatsApp Reminder</span>
              </Button>
              <Button
                onClick={handleOpenPaymentModal}
                className="bg-[#0a0a2e] hover:bg-[#1a1555] text-white font-bold text-xs sm:text-sm px-4 py-2 flex items-center gap-2 rounded-xl shadow-md"
              >
                <PlusCircle size={15} />
                <span>Record Payment</span>
              </Button>
            </div>
          </div>
        </Card>
      ) : (
        <Card className="p-4 sm:p-5 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 flex items-center justify-center shrink-0">
              <CheckCircle2 size={24} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-emerald-900 dark:text-emerald-300">All Credits Paid & Settled</h3>
              <p className="text-xs text-emerald-700 dark:text-emerald-400">This customer has no outstanding dues or unpaid credit balances.</p>
            </div>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-12 gap-6">
        {/* Left Sidebar - Customer Card + Credit Summary */}
        <div className="col-span-12 lg:col-span-4 space-y-6">
          {/* Customer Card */}
          <Card className="p-6 sm:p-8 text-center relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 dark:bg-blue-900/20 rounded-full -mr-16 -mt-16 blur-3xl" />
            <div className="relative z-10">
              <div className="relative inline-block mb-4">
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 text-2xl font-bold mx-auto">
                  {initials}
                </div>
                <span className={`absolute bottom-1 right-1 w-5 h-5 border-4 border-white dark:border-gray-800 rounded-full ${hasUnpaidCredit ? 'bg-red-500' : 'bg-green-500'}`} />
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">{customer.name}</h3>
              <p className="text-sm font-medium text-blue-600">
                {totalSpent > 5000 ? 'VIP Member' : 'Regular Customer'}
              </p>
            </div>

            <div className="mt-6 space-y-4 pt-6 border-t border-gray-100 dark:border-gray-700 text-left">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-500">
                  <Mail size={18} />
                </div>
                <div>
                  <p className="text-xs text-gray-400 font-medium">Email Address</p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{customer.email || '—'}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-500">
                  <Phone size={18} />
                </div>
                <div>
                  <p className="text-xs text-gray-400 font-medium">Phone Number</p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{customer.phone}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-500">
                  <MapPin size={18} />
                </div>
                <div>
                  <p className="text-xs text-gray-400 font-medium">Address</p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{customer.address || '—'}</p>
                </div>
              </div>
            </div>
          </Card>

          {/* Credit Summary Card */}
          <Card className={`p-6 sm:p-8 text-white relative overflow-hidden ${hasUnpaidCredit ? 'bg-gradient-to-br from-red-700 to-amber-700' : 'bg-gradient-to-br from-blue-800 to-sky-600'}`}>
            <div className="absolute inset-0 bg-gradient-to-br from-black/20 to-transparent" />
            <div className="relative z-10">
              <div className="flex justify-between items-start mb-6">
                <CreditCard size={28} />
                <span className="px-3 py-1 rounded-full bg-white/20 text-xs font-bold backdrop-blur-md">
                  {hasUnpaidCredit ? 'CREDIT DUE' : 'NO DUES'}
                </span>
              </div>
              <p className="text-sm opacity-80 font-medium">Outstanding Credit Balance</p>
              <h4 className="text-3xl font-extrabold mt-1">{formatINR(totalCreditBalance)}</h4>
              <div className="mt-6 w-full bg-white/20 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-white h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.min((totalCreditBalance / (customer.creditLimit || 10000)) * 100, 100)}%` }}
                />
              </div>
              <div className="flex justify-between mt-3 text-xs font-medium">
                <span>Credit Taken: {formatINR(totalCreditBalance)}</span>
                <span>Limit: {formatINR(customer.creditLimit || 10000)}</span>
              </div>
            </div>
          </Card>
        </div>

        {/* Right Side - Purchase History + Credit History */}
        <div className="col-span-12 lg:col-span-8 space-y-6">
          {/* Recent Purchases */}
          <Card className="overflow-hidden">
            <div className="px-6 py-4 sm:px-8 sm:py-6 flex justify-between items-center border-b border-gray-100 dark:border-gray-700">
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">Recent Purchases</h3>
                <p className="text-xs text-gray-400">All transactions & payment statuses for this customer</p>
              </div>
              <button
                onClick={() => navigate(ROUTES.SALES)}
                className="text-sm font-semibold text-blue-600 hover:underline"
              >
                View All
              </button>
            </div>
            {customerSales.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-800">
                    <tr className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                      <th className="px-6 py-4">Invoice #</th>
                      <th className="px-6 py-4">Date</th>
                      <th className="px-6 py-4 text-right">Amount</th>
                      <th className="px-6 py-4 text-center">Payment Method</th>
                      <th className="px-6 py-4 text-center">Credit Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {customerSales.slice(0, 8).map(sale => {
                      const isCreditSale = sale.paymentMethod === 'credit'
                      const isUnpaid = isCreditSale && (sale.grandTotal - (sale.amountPaid ?? 0) > 0) && totalCreditBalance > 0

                      return (
                        <tr key={sale.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                          <td className="px-6 py-4 font-mono font-medium text-blue-600">
                            #{sale.invoiceNumber}
                          </td>
                          <td className="px-6 py-4 text-gray-500 text-xs">
                            {sale.createdAt
                              ? new Date((sale.createdAt as unknown as { toDate?: () => Date })?.toDate ? (sale.createdAt as unknown as { toDate?: () => Date }).toDate!() : sale.createdAt).toLocaleDateString('en-US', {
                                  month: 'short', day: 'numeric', year: 'numeric',
                                })
                              : '—'}
                          </td>

                          <td className="px-6 py-4 font-bold text-right text-gray-900 dark:text-gray-100">
                            {formatINR(sale.grandTotal)}
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold uppercase ${
                              isCreditSale
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                                : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                            }`}>
                              {sale.paymentMethod || 'cash'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            {isCreditSale ? (
                              isUnpaid ? (
                                <Badge variant="danger" className="font-extrabold text-[10px] uppercase">UNPAID CREDIT</Badge>
                              ) : (
                                <Badge variant="success" className="font-extrabold text-[10px] uppercase">CREDIT PAID</Badge>
                              )
                            ) : (
                              <Badge variant="success" className="font-extrabold text-[10px] uppercase">PAID</Badge>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="px-8 py-12 text-center text-gray-400">
                <ShoppingCart size={40} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm">No purchases recorded yet</p>
              </div>
            )}
          </Card>

          {/* Credit History */}
          <Card className="overflow-hidden">
            <div className="px-6 py-4 sm:px-8 sm:py-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">Credit Transactions Ledger</h3>
              {hasUnpaidCredit && (
                <Button size="sm" onClick={handleOpenPaymentModal} className="bg-blue-600 hover:bg-blue-700 text-xs font-bold">
                  Settle Credit
                </Button>
              )}
            </div>
            <div className="p-6 sm:p-8 space-y-3">
              {customerTransactions.length > 0 ? customerTransactions.map((tx: CreditTransaction) => (

                <div
                  key={tx.id}
                  className={`flex items-center justify-between p-4 rounded-xl transition-all border-l-4 ${
                    tx.type === 'payment'
                      ? 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-500'
                      : 'bg-red-50 dark:bg-red-900/10 border-red-500'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      tx.type === 'payment'
                        ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600'
                        : 'bg-red-100 dark:bg-red-900/30 text-red-600'
                    }`}>
                      {tx.type === 'payment' ? <PlusCircle size={20} /> : <ShoppingBag size={20} />}
                    </div>
                    <div>
                      <p className="font-bold text-sm text-gray-900 dark:text-gray-100">
                        {tx.type === 'payment' ? 'Credit Payment Received' : 'Credit Purchase'}
                      </p>
                      <p className="text-xs text-gray-400">
                        {tx.notes || `Transaction #${tx.id?.slice(0, 8)}`}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-extrabold ${
                      tx.type === 'payment' ? 'text-emerald-600' : 'text-red-600'
                    }`}>
                      {tx.type === 'payment' ? '-' : '+'}{formatINR(tx.amount)}
                    </p>
                    <p className="text-[10px] font-bold text-gray-400 uppercase">
                      {(() => {
                        const rawTx = tx.createdAt as unknown as { toDate?: () => Date } | string | number | undefined
                        const d = typeof rawTx === 'object' && rawTx?.toDate ? rawTx.toDate() : (typeof rawTx === 'string' || typeof rawTx === 'number') ? new Date(rawTx) : null
                        return d ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'
                      })()}
                    </p>

                  </div>
                </div>
              )) : (
                <div className="text-center py-8 text-gray-400">
                  <CreditCard size={40} className="mx-auto mb-3 opacity-30" />
                  <p className="text-sm">No credit transactions ledger found</p>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Bottom Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-6 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600">
            <TrendingUp size={24} />
          </div>
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Avg. Order Value</p>
            <h5 className="text-xl font-bold text-gray-900 dark:text-gray-100">{formatINR(avgOrderValue)}</h5>
          </div>
        </Card>
        <Card className="p-6 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-sky-100 dark:bg-sky-900/30 flex items-center justify-center text-sky-600">
            <Wallet size={24} />
          </div>
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Total Orders</p>
            <h5 className="text-xl font-bold text-gray-900 dark:text-gray-100">{customerSales.length}</h5>
          </div>
        </Card>
        <Card className="p-6 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-600">
            <Calendar size={24} />
          </div>
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Account Age</p>
            <h5 className="text-xl font-bold text-gray-900 dark:text-gray-100">{accountAge} Years</h5>
          </div>
        </Card>
      </div>

      {/* Record Payment Settlement Modal */}
      <Modal
        isOpen={isPaymentOpen}
        onClose={() => setIsPaymentOpen(false)}
        title={`Record Payment for ${customer.name}`}
        size="md"
        footer={
          <div className="flex gap-3 w-full">
            <Button
              variant="outline"
              onClick={() => setIsPaymentOpen(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleRecordPaymentSubmit}
              loading={isRecordingPayment}
              className="flex-1 bg-[#0a0a2e] hover:bg-[#1a1555] text-white font-bold"
            >
              Confirm Payment
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
            <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">Current Outstanding Credit</p>
            <p className="text-2xl font-extrabold text-blue-900 dark:text-blue-100">{formatINR(totalCreditBalance)}</p>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase mb-1">
              Payment Amount (₹)
            </label>
            <Input
              type="number"
              placeholder="Enter amount paid by customer"
              value={paymentAmount}
              onChange={e => setPaymentAmount(e.target.value)}
              className="h-11 text-lg font-bold"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase mb-1">
              Payment Notes / Reference (Optional)
            </label>
            <Input
              type="text"
              placeholder="e.g. Cash payment, GPay / PhonePe reference"
              value={paymentNotes}
              onChange={e => setPaymentNotes(e.target.value)}
              className="h-10"
            />
          </div>
        </div>
      </Modal>
    </div>
  )
}
