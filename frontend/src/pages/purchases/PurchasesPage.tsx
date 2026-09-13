import { useState, useMemo } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { PageVideoTutorialModal } from '@/components/common/PageVideoTutorialModal'
import { InteractivePageTour } from '@/components/common/InteractivePageTour'
import { usePageTutorial } from '@/hooks/usePageTutorial'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { FieldInfo } from '@/components/ui/FieldInfo'
import { DataTable, type ColumnDef } from '@/components/data-display/DataTable'
import { DateRangePicker } from '@/components/forms/DateRangePicker'
import { usePurchases, useCreatePurchase, useDeletePurchase } from '@/hooks/usePurchases'
import { useProducts } from '@/hooks/useProducts'
import { useSuppliers, useSupplierReminders } from '@/hooks/useSuppliers'
import { QuickAddProductModal } from '@/components/common/QuickAddProductModal'
import { RecordPurchaseModal } from '@/components/purchases/RecordPurchaseModal'
import { PurchaseDetailModal } from '@/components/purchases/PurchaseDetailModal'
import { RecordPurchasePaymentModal } from '@/components/purchases/RecordPurchasePaymentModal'
import { ProcessPurchaseReturnModal } from '@/components/purchases/ProcessPurchaseReturnModal'
import { DebitNoteReceiptModal } from '@/components/purchases/DebitNoteReceiptModal'
import { Plus, Trash2, Truck, Filter, RotateCcw, FileText, Eye, IndianRupee, Clock, Bell } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { formatINR } from '@/utils/currency'
import toast from 'react-hot-toast'
import type { Purchase } from '@/types/purchase.types'
import type { PurchaseReturn } from '@/types/purchaseReturn.types'
import { useLanguage } from '@/contexts/LanguageContext'

export const PurchasesPage = () => {
  const { t } = useLanguage()
  const pageTutorial = usePageTutorial('purchases')
  const { data: purchases, isLoading } = usePurchases()
  const { data: suppliers } = useSuppliers()
  const { data: reminders } = useSupplierReminders()
  const { mutate: deletePurchase } = useDeletePurchase()

  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isAddProductOpen, setIsAddProductOpen] = useState(false)
  const [selectedDetailPurchase, setSelectedDetailPurchase] = useState<Purchase | null>(null)
  const [paymentPurchase, setPaymentPurchase] = useState<Purchase | null>(null)
  const [returnPurchase, setReturnPurchase] = useState<Purchase | null>(null)
  const [debitNoteModalData, setDebitNoteModalData] = useState<{
    purchaseReturn: PurchaseReturn | null
    purchase: Purchase | null
  }>({ purchaseReturn: null, purchase: null })

  // Filters
  const [filterSupplier, setFilterSupplier] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterStartDate, setFilterStartDate] = useState('')
  const [filterEndDate, setFilterEndDate] = useState('')
  const [showFilters, setShowFilters] = useState(false)

  const supplierOptions = [
    { value: '', label: t('purchases.allSuppliers') },
    ...(suppliers ?? []).map(s => ({ value: s.id, label: s.name })),
  ]

  // Filtered purchases
  const filteredPurchases = useMemo(() => {
    let result = purchases ?? []

    if (filterSupplier) {
      result = result.filter(p => p.supplierId === filterSupplier)
    }

    if (filterStatus !== 'all') {
      result = result.filter(p => {
        const isPaid = p.paymentStatus === 'paid' || (p.amountPaid || 0) >= (p.grandTotal || 0) - 0.001
        if (filterStatus === 'paid') return isPaid
        if (filterStatus === 'unpaid') return !isPaid
        if (filterStatus === 'overdue') {
          return !isPaid && p.paymentDueDate && new Date(p.paymentDueDate).getTime() < Date.now()
        }
        return true
      })
    }

    if (filterStartDate) {
      const start = new Date(filterStartDate)
      start.setHours(0, 0, 0, 0)
      result = result.filter(p => new Date(p.createdAt) >= start)
    }

    if (filterEndDate) {
      const end = new Date(filterEndDate)
      end.setHours(23, 59, 59, 999)
      result = result.filter(p => new Date(p.createdAt) <= end)
    }

    return result
  }, [purchases, filterSupplier, filterStatus, filterStartDate, filterEndDate])

  const columns: ColumnDef<Purchase>[] = [
    {
      key: 'invoiceNumber',
      header: 'Invoice / Bill #',
      render: (row) => (
        <div
          onClick={() => setSelectedDetailPurchase(row)}
          className="cursor-pointer group"
        >
          <span className="font-semibold text-blue-600 group-hover:underline dark:text-blue-400">
            {row.invoiceNumber}
          </span>
          {row.supplierBillNumber && (
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
              Ref: {row.supplierBillNumber}
            </p>
          )}
          {row.returnStatus && row.returnStatus !== 'none' && (
            <div className="mt-1">
              <Badge variant={row.returnStatus === 'full' ? 'danger' : 'warning'} className="text-[10px] py-0">
                {row.returnStatus === 'full' ? 'FULLY RETURNED' : 'PARTIAL RETURN'}
              </Badge>
            </div>
          )}
        </div>
      ),
      sortable: true,
    },
    {
      key: 'supplierId',
      header: t('common.supplier'),
      render: (row) => {
        const supplier = suppliers?.find(s => s.id === row.supplierId)
        return (
          <div className="flex items-center gap-2">
            <Truck size={16} className="text-gray-400 shrink-0" />
            <div>
              <span className="font-medium text-slate-900 dark:text-slate-100">{supplier?.name ?? t('purchases.unknownSupplier')}</span>
              {supplier?.phone && <p className="text-[11px] text-slate-400">{supplier.phone}</p>}
            </div>
          </div>
        )
      },
    },
    {
      key: 'createdAt',
      header: t('common.date'),
      render: (row) => (
        <span className="text-xs text-slate-600 dark:text-slate-300">
          {new Date(row.createdAt).toLocaleDateString('en-IN', {
            day: '2-digit', month: 'short', year: 'numeric',
          })}
        </span>
      ),
      sortable: true,
    },
    {
      key: 'items',
      header: t('common.items'),
      render: (row) => (
        <span className="text-xs text-gray-500">{row.items?.length ?? 0} {t('purchases.itemCountSuffix')}</span>
      ),
    },
    {
      key: 'paymentStatus',
      header: 'Payment Status',
      render: (row) => {
        const isPaid = row.paymentStatus === 'paid' || (row.amountPaid || 0) >= (row.grandTotal || 0) - 0.001
        const isPartial = !isPaid && (row.amountPaid || 0) > 0
        const isOverdue = row.paymentDueDate && !isPaid && new Date(row.paymentDueDate).getTime() < Date.now()
        const outstanding = Math.max(0, (row.grandTotal || 0) - (row.amountPaid || 0))

        return (
          <div className="space-y-1">
            <div className="flex items-center gap-1.5">
              <Badge variant={isPaid ? 'success' : isPartial ? 'warning' : 'danger'} className="text-[10px] font-bold">
                {isPaid ? 'PAID' : isPartial ? 'PARTIAL' : 'UNPAID'}
              </Badge>
              <span className="text-[10px] text-slate-400 uppercase font-mono">
                {row.paymentMethod}
              </span>
            </div>
            {!isPaid && (
              <p className="text-[11px] font-bold text-amber-600 dark:text-amber-400">
                Due: {formatINR(outstanding)}
              </p>
            )}
            {row.paymentDueDate && !isPaid && (
              <div className="flex items-center gap-1 text-[10px]">
                <Clock size={11} className={isOverdue ? 'text-red-500' : 'text-slate-400'} />
                <span className={isOverdue ? 'text-red-600 dark:text-red-400 font-bold' : 'text-slate-500'}>
                  {isOverdue ? 'Overdue' : 'Due'}: {new Date(row.paymentDueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                </span>
              </div>
            )}
          </div>
        )
      },
    },
    {
      key: 'grandTotal',
      header: t('common.total'),
      render: (row) => (
        <div>
          <span className="font-bold text-slate-900 dark:text-slate-100">{formatINR(row.grandTotal)}</span>
          {row.totalReturned ? (
            <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">
              Returned: -{formatINR(row.totalReturned)}
            </p>
          ) : null}
        </div>
      ),
      sortable: true,
    },
    {
      key: 'actions',
      header: t('common.actions'),
      render: (row) => {
        const isPaid = row.paymentStatus === 'paid' || (row.amountPaid || 0) >= (row.grandTotal || 0) - 0.001
        return (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedDetailPurchase(row)}
              title="View Purchase Bill Details"
              className="p-1.5"
            >
              <Eye size={15} className="text-slate-600 dark:text-slate-400" />
            </Button>
            {!isPaid && (
              <Button
                variant="outline"
                size="sm"
                className="text-xs py-1 px-2 text-emerald-600 border-emerald-200 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                onClick={() => setPaymentPurchase(row)}
                title="Record Payment"
              >
                <IndianRupee size={13} className="mr-0.5" />
                Pay
              </Button>
            )}
            {row.returns && row.returns.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="text-xs py-1 px-2 text-blue-600 border-blue-200 hover:bg-blue-50 dark:hover:bg-blue-950/30"
                onClick={() => {
                  const latestReturn = row.returns ? row.returns[row.returns.length - 1] : null
                  if (latestReturn) {
                    setDebitNoteModalData({ purchaseReturn: latestReturn, purchase: row })
                  }
                }}
                title="View Debit Note Slip"
              >
                <FileText size={13} className="mr-0.5" />
                Debit Note
              </Button>
            )}
            {row.returnStatus !== 'full' && (
              <Button
                variant="outline"
                size="sm"
                className="text-xs py-1 px-2 text-amber-600 border-amber-200 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                onClick={() => setReturnPurchase(row)}
                title="Return to Supplier"
              >
                <RotateCcw size={13} className="mr-0.5" />
                Return
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleDelete(row.id)}
              title="Delete Purchase"
              className="p-1.5"
            >
              <Trash2 size={15} className="text-red-500" />
            </Button>
          </div>
        )
      },
    },
  ]

  const handleDelete = (id: string) => {
    if (!confirm(t('purchases.deleteConfirm'))) return
    deletePurchase(id, {
      onSuccess: () => toast.success(t('purchases.deletedSuccess')),
      onError: () => toast.error(t('purchases.errDeleteFailed')),
    })
  }

  const clearFilters = () => {
    setFilterSupplier('')
    setFilterStartDate('')
    setFilterEndDate('')
  }

  const hasActiveFilters = filterSupplier || filterStartDate || filterEndDate

  return (
    <div>
      {/* Supplier Payment Dues Reminder Banner */}
      {reminders && (reminders.overdue?.length > 0 || reminders.upcoming?.length > 0) && (
        <div className="mb-4 p-4 bg-gradient-to-r from-red-500/10 via-amber-500/10 to-blue-500/10 border border-amber-300 dark:border-amber-800 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-sm">
              <Bell size={20} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <span>Supplier Payment Reminders</span>
                <Badge variant="warning" size="sm">
                  {(reminders.overdue?.length || 0) + (reminders.upcoming?.length || 0)} due bills
                </Badge>
              </h4>
              <p className="text-xs text-gray-600 dark:text-gray-300 mt-0.5">
                {reminders.overdue?.length > 0 && (
                  <span className="font-semibold text-red-700 dark:text-red-400">
                    ⚠️ {reminders.overdue.length} supplier bills are past due date.
                  </span>
                )}
                {reminders.overdue?.length > 0 && reminders.upcoming?.length > 0 && ' • '}
                {reminders.upcoming?.length > 0 && (
                  <span className="font-semibold text-amber-800 dark:text-amber-200">
                    🗓️ {reminders.upcoming.length} bills due within the next 7 days.
                  </span>
                )}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setShowFilters(true)
              setFilterStatus('overdue')
            }}
            className="text-xs font-bold px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors shrink-0 cursor-pointer"
          >
            View Overdue Bills
          </button>
        </div>
      )}

      <div data-tour="purchases-header">
        <PageHeader
          title={t('page.purchases')}
          onWatchTutorial={pageTutorial.openTutorial}
          action={
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                className="text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800 hover:bg-purple-50 dark:hover:bg-purple-950/30"
                leftIcon={<Plus size={16} />}
                onClick={() => setIsAddProductOpen(true)}
              >
                {t('products.addProduct') || 'Add New Product'}
              </Button>
              <Button data-tour="record-purchase-btn" leftIcon={<Plus size={16} />} onClick={() => setIsFormOpen(true)}>
                {t('purchases.recordPurchase')}
              </Button>
            </div>
          }
        />
      </div>

      {/* Filters */}
      <Card className="p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900"
          >
            <Filter size={16} />
            {t('action.filters')}
            {hasActiveFilters && (
              <span className="w-2 h-2 rounded-full bg-blue-500" />
            )}
          </button>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              {t('action.clearAll')}
            </Button>
          )}
        </div>

        {showFilters && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Select
              label={t('common.supplier')}
              options={supplierOptions}
              value={filterSupplier}
              onChange={e => setFilterSupplier(e.target.value)}
            />
            <Select
              label="Payment Status"
              options={[
                { value: 'all', label: 'All Statuses' },
                { value: 'paid', label: 'Paid in Full' },
                { value: 'unpaid', label: 'Unpaid / Partial' },
                { value: 'overdue', label: 'Overdue Dues' },
              ]}
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
            />
            <div className="md:col-span-2">
              <DateRangePicker
                startDate={filterStartDate}
                endDate={filterEndDate}
                onStartDateChange={setFilterStartDate}
                onEndDateChange={setFilterEndDate}
              />
            </div>
          </div>
        )}
      </Card>

      <Card data-tour="purchases-table" className="p-4">
        <DataTable
          data={filteredPurchases}
          columns={columns}
          loading={isLoading}
          searchable
          pagination
          emptyMessage={t('purchases.noPurchasesYet')}
        />
      </Card>

      {/* Guided Tour & Video Tutorial */}
      <PageVideoTutorialModal
        isOpen={pageTutorial.isTutorialOpen}
        onClose={pageTutorial.closeTutorial}
        tutorial={pageTutorial.tutorialData}
        onStartTour={pageTutorial.startTour}
      />
      <InteractivePageTour
        pageKey="purchases"
        steps={pageTutorial.tutorialData.tourSteps}
        isOpen={pageTutorial.isTourOpen}
        onClose={pageTutorial.closeTour}
      />

      {/* Record Purchase Modal */}
      {isFormOpen && (
        <RecordPurchaseModal
          isOpen={isFormOpen}
          onClose={() => setIsFormOpen(false)}
        />
      )}

      {/* Purchase Details Modal */}
      {selectedDetailPurchase && (
        <PurchaseDetailModal
          isOpen={Boolean(selectedDetailPurchase)}
          onClose={() => setSelectedDetailPurchase(null)}
          purchase={selectedDetailPurchase}
          onPaymentRecorded={() => {
            setSelectedDetailPurchase(null)
          }}
        />
      )}

      {/* Record Purchase Payment Modal */}
      {paymentPurchase && (
        <RecordPurchasePaymentModal
          isOpen={Boolean(paymentPurchase)}
          onClose={() => setPaymentPurchase(null)}
          purchase={paymentPurchase}
          onSuccess={() => {
            setPaymentPurchase(null)
          }}
        />
      )}

      {/* Quick Add Product Modal */}
      <QuickAddProductModal
        isOpen={isAddProductOpen}
        onClose={() => setIsAddProductOpen(false)}
      />

      {/* Process Purchase Return Modal */}
      {returnPurchase && (
        <ProcessPurchaseReturnModal
          purchase={returnPurchase}
          isOpen={Boolean(returnPurchase)}
          onClose={() => setReturnPurchase(null)}
          onSuccess={(newReturn) => {
            setDebitNoteModalData({ purchaseReturn: newReturn, purchase: returnPurchase })
          }}
        />
      )}

      {/* Debit Note Slip Preview & Print Modal */}
      {debitNoteModalData.purchaseReturn && debitNoteModalData.purchase && (
        <DebitNoteReceiptModal
          isOpen={Boolean(debitNoteModalData.purchaseReturn && debitNoteModalData.purchase)}
          onClose={() => setDebitNoteModalData({ purchaseReturn: null, purchase: null })}
          purchaseReturn={debitNoteModalData.purchaseReturn}
          purchase={debitNoteModalData.purchase}
        />
      )}
    </div>
  )
}
