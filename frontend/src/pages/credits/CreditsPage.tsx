import { useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Spinner } from '@/components/ui/Spinner'
import { TableSkeleton } from '@/components/ui/TableSkeleton'
import { Badge } from '@/components/ui/Badge'
import { useCredits, useCreditTransactions } from '@/hooks/useCredits'
import { useCustomers, useRecordPayment } from '@/hooks/useCustomers'
import { CreditCard, Receipt, Wallet, ChevronDown, ChevronUp, BookOpen } from 'lucide-react'
import { formatINR } from '@/utils/currency'
import { useLanguage } from '@/contexts/LanguageContext'
import { ROUTES } from '@/constants/routes'
import toast from 'react-hot-toast'

import type { Customer } from '@/types/customer.types'
import type { CreditTransaction } from '@/types/customer.types'

export const CreditsPage = () => {
  const { t } = useLanguage()
  const { data: allCustomers } = useCustomers()
  const { data: creditCustomers, isLoading: customersLoading } = useCredits()
  const { data: transactions, isLoading: txLoading } = useCreditTransactions()
  const { mutate: recordPayment, isPending } = useRecordPayment()

  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentNotes, setPaymentNotes] = useState('')
  const [isPaymentOpen, setIsPaymentOpen] = useState(false)
  const [expandedCustomerId, setExpandedCustomerId] = useState<string | null>(null)

  const customerList = (allCustomers ?? creditCustomers ?? []) as Customer[]
  const totalOutstanding = customerList.reduce((sum, c) => sum + (c.creditBalance ?? 0), 0)
  const customersWithBalance = customerList.filter(c => (c.creditBalance ?? 0) > 0)

  const handlePayment = () => {
    const amount = parseFloat(paymentAmount)
    if (!amount || amount <= 0 || !selectedCustomer) {
      toast.error('Please enter a valid amount')
      return
    }
    if (amount > selectedCustomer.creditBalance) {
      toast.error('Amount exceeds outstanding balance')
      return
    }

    recordPayment(
      { customerId: selectedCustomer.id, amount, notes: paymentNotes },
      {
        onSuccess: () => {
          toast.success(`Payment of ${formatINR(amount)} recorded`)
          setIsPaymentOpen(false)
          setSelectedCustomer(null)
          setPaymentAmount('')
          setPaymentNotes('')
        },
        onError: () => toast.error('Failed to record payment'),
      }
    )
  }

  const getCustomerTransactions = (customerId: string): CreditTransaction[] => {
    return (transactions ?? []).filter(tx => tx.customerId === customerId)
  }

  const formatDate = (ts: unknown): string => {
    const d = (ts as { toDate?: () => Date })?.toDate?.() ?? new Date()
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }


  return (
    <div>
      <PageHeader
        title={t('page.credits')}
        action={
          <Link to={ROUTES.DAYBOOK}>
            <Button variant="outline" leftIcon={<BookOpen size={16} />}>
              {t('page.daybook')}
            </Button>
          </Link>
        }
      />

      {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Card className="p-5 bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-900/20 dark:to-orange-900/20 border border-red-100 dark:border-red-800">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                  <CreditCard size={20} className="text-red-600 dark:text-red-400" />
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-300">{t('credits.totalOutstanding')}</p>
              </div>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">{formatINR(totalOutstanding)}</p>
            </Card>

            <Card className="p-5 bg-white border border-gray-100 shadow-sm">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                  <Wallet size={20} className="text-gray-600 dark:text-gray-300" />
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400">{t('credits.customersWithDues')}</p>
              </div>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{customersWithBalance.length}</p>
            </Card>

            <Card className="p-5 bg-white border border-gray-100 shadow-sm">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                  <Receipt size={20} className="text-gray-600 dark:text-gray-300" />
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400">{t('credits.totalTransactions')}</p>
              </div>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{transactions?.length ?? 0}</p>
            </Card>
          </div>

          {/* Customers with Outstanding Balance */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">{t('credits.outstandingBalances')}</h3>

              {customersLoading ? (
                <TableSkeleton rows={4} columns={3} />
              ) : customersWithBalance.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <CreditCard size={48} className="mx-auto mb-3 opacity-30" />
                  <p className="text-sm">{t('credits.noOutstandingCredits')}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {customersWithBalance.map(customer => {
                    const isExpanded = expandedCustomerId === customer.id
                    const custTxs = getCustomerTransactions(customer.id)

                    return (
                      <div
                        key={customer.id}
                        className="bg-gray-50 dark:bg-gray-700/50 rounded-xl overflow-hidden"
                      >
                        <div className="flex items-center justify-between p-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 font-semibold text-sm">
                              {customer.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{customer.name}</p>
                              <p className="text-xs text-gray-400">{customer.phone}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-lg font-bold text-red-600 dark:text-red-400">
                              {formatINR(customer.creditBalance)}
                            </span>
                            <Button
                              size="sm"
                              onClick={() => {
                                setSelectedCustomer(customer as Customer)
                                setPaymentAmount(String(customer.creditBalance))
                                setIsPaymentOpen(true)
                              }}
                              className="bg-[#0a0a2e] hover:bg-[#1a1555] text-white"
                            >
                              {t('action.pay')}
                            </Button>
                            {custTxs.length > 0 && (
                              <button
                                onClick={() => setExpandedCustomerId(isExpanded ? null : customer.id)}
                                className="p-1 text-gray-400 hover:text-gray-600"
                              >
                                {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Credit History */}
                        {isExpanded && custTxs.length > 0 && (
                          <div className="border-t border-gray-200 dark:border-gray-600 p-3 space-y-2 bg-gray-100 dark:bg-gray-800/50">
                            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Credit History ({custTxs.length} entries)</p>
                            {custTxs.slice(0, 10).map(tx => (
                              <div key={tx.id} className="flex items-center justify-between text-sm">
                                <div className="flex items-center gap-2">
                                  <Badge variant={tx.type === 'payment' ? 'success' : 'warning'}>
                                    {tx.type === 'payment' ? t('credits.paymentReceived') : t('credits.creditAdded')}
                                  </Badge>
                                  <span className="text-gray-600 dark:text-gray-300">
                                    {tx.notes || ''}
                                  </span>
                                </div>
                                <div className="flex items-center gap-3">
                                  <span className={`font-medium ${
                                    tx.type === 'payment' ? 'text-emerald-600' : 'text-red-600'
                                  }`}>
                                    {tx.type === 'payment' ? '+' : '-'}{formatINR(tx.amount)}
                                  </span>
                                  <span className="text-xs text-gray-400">
                                    {formatDate(tx.createdAt)}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </Card>

            {/* Recent Credit Transactions */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">{t('credits.recentTransactions')}</h3>

              {txLoading ? (
                <TableSkeleton rows={4} columns={3} />
              ) : (transactions ?? []).length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <Receipt size={48} className="mx-auto mb-3 opacity-30" />
                  <p className="text-sm">{t('credits.noCreditTransactionsYet')}</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {(transactions ?? []).slice(0, 10).map(tx => {
                    const customerObj = customerList.find(c => c.id === tx.customerId) || (tx as any).customer
                    const customerName = customerObj?.name || (tx as any).customerName || (tx as any).customer?.name || 'Customer'
                    return (
                      <div key={tx.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                            tx.type === 'payment'
                              ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600'
                              : 'bg-red-100 dark:bg-red-900/30 text-red-600'
                          }`}>
                            {tx.type === 'payment' ? <Wallet size={16} /> : <CreditCard size={16} />}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                              {customerName}
                            </p>
                            <p className="text-xs text-gray-400">
                              {tx.type === 'payment' ? t('credits.paymentReceived') : t('credits.creditAdded')}
                              {tx.notes ? ` — ${tx.notes}` : ''}
                            </p>
                          </div>
                        </div>
                        <span className={`text-sm font-semibold ${
                          tx.type === 'payment' ? 'text-emerald-600' : 'text-red-600'
                        }`}>
                          {tx.type === 'payment' ? '+' : '-'}{formatINR(tx.amount)}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </Card>
          </div>

      {/* Record Payment Modal */}
      <Modal
        isOpen={isPaymentOpen}
        onClose={() => { setIsPaymentOpen(false); setSelectedCustomer(null); setPaymentAmount(''); setPaymentNotes('') }}
        title="Record Payment"
        size="sm"
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => { setIsPaymentOpen(false); setSelectedCustomer(null); setPaymentAmount(''); setPaymentNotes('') }}>
              Cancel
            </Button>
            <Button
              onClick={handlePayment}
              loading={isPending}
              disabled={!paymentAmount || parseFloat(paymentAmount) <= 0}
            >
              Record Payment
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          {selectedCustomer && (
            <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
              <p className="text-sm text-gray-500 dark:text-gray-400">Customer</p>
              <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">{selectedCustomer.name}</p>
              <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                Outstanding: {formatINR(selectedCustomer.creditBalance)}
              </p>
            </div>
          )}

          <Input
            label="Payment Amount (₹) *"
            type="number"
            step="0.01"
            value={paymentAmount}
            onChange={e => setPaymentAmount(e.target.value)}
            placeholder="0.00"
            autoFocus
          />

          <Input
            label="Notes (optional)"
            value={paymentNotes}
            onChange={e => setPaymentNotes(e.target.value)}
            placeholder="e.g. Partial payment via UPI"
          />
        </div>
      </Modal>
    </div>
  )
}
