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
import { Badge } from '@/components/ui/Badge'
import { DateRangePicker } from '@/components/forms/DateRangePicker'
import { ImageUpload } from '@/components/forms/ImageUpload'
import { useExpenses, useCreateExpense, useUpdateExpense, useDeleteExpense } from '@/hooks/useExpenses'
import { useAuth } from '@/contexts/AuthContext'
import { Plus, Pencil, Trash2, Filter, Image as ImageIcon } from 'lucide-react'
import { formatINR } from '@/utils/currency'

import { uploadExpenseReceipt } from '@/utils/storage'
import toast from 'react-hot-toast'
import { toastError } from '@/utils/userMessage'
import type { Expense } from '@/types/expense.types'
import { useLanguage } from '@/contexts/LanguageContext'


export const ExpensesPage = () => {
  const { t } = useLanguage()
  const CATEGORY_OPTIONS = [
    { value: 'rent', label: t('expenses.catRent') },
    { value: 'utilities', label: t('expenses.catUtilities') },
    { value: 'salaries', label: t('expenses.catSalaries') },
    { value: 'inventory', label: t('expenses.catInventory') },
    { value: 'marketing', label: t('expenses.catMarketing') },
    { value: 'maintenance', label: t('expenses.catMaintenance') },
    { value: 'other', label: t('expenses.catOther') },
  ]

  const PAYMENT_OPTIONS = [
    { value: 'cash', label: t('pos.cash') },
    { value: 'bank', label: t('common.bankTransfer') },
    { value: 'upi', label: t('pos.upi') },
    { value: 'card', label: t('pos.card') },
  ]
  const pageTutorial = usePageTutorial('expenses')
  const { user } = useAuth()
  const { data: expenses, isLoading } = useExpenses()
  const { mutate: createExpense, isPending: isCreating } = useCreateExpense()
  const { mutate: updateExpense, isPending: isUpdating } = useUpdateExpense()
  const { mutate: deleteExpense } = useDeleteExpense()
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [receiptImageURL, setReceiptImageURL] = useState('')
  const [form, setForm] = useState({
    category: 'other' as Expense['category'],
    amount: '',
    description: '',
    paymentMethod: 'cash' as Expense['paymentMethod'],
    expenseDate: new Date().toISOString().split('T')[0],
  })

  // Filters
  const [filterCategory, setFilterCategory] = useState('')
  const [filterStartDate, setFilterStartDate] = useState('')
  const [filterEndDate, setFilterEndDate] = useState('')
  const [showFilters, setShowFilters] = useState(false)

  const categoryFilterOptions = [
    { value: '', label: t('expenses.allCategories') },
    ...CATEGORY_OPTIONS,
  ]

  const handleReceiptUpload = async (file: File): Promise<string> => {
    if (!user) return ''
    return uploadExpenseReceipt(user.uid, file)
  }

  // Filtered expenses
  const filteredExpenses = useMemo(() => {
    let result = expenses ?? []

    const parseExpenseDate = (val: unknown): Date => {
      const raw = val as { toDate?: () => Date } | string | number | undefined
      if (typeof raw === 'object' && raw?.toDate) return raw.toDate()
      if (typeof raw === 'string' || typeof raw === 'number') return new Date(raw)


      return new Date()
    }

    if (filterCategory) {
      result = result.filter(e => e.category === filterCategory)
    }

    if (filterStartDate) {
      const start = new Date(filterStartDate)
      start.setHours(0, 0, 0, 0)
      result = result.filter(e => parseExpenseDate(e.expenseDate) >= start)
    }

    if (filterEndDate) {
      const end = new Date(filterEndDate)
      end.setHours(23, 59, 59, 999)
      result = result.filter(e => parseExpenseDate(e.expenseDate) <= end)
    }

    return result
  }, [expenses, filterCategory, filterStartDate, filterEndDate])


  const columns: ColumnDef<Expense>[] = [
    {
      key: 'category',
      header: t('common.category'),
      render: (row) => {
        const cat = CATEGORY_OPTIONS.find(c => c.value === row.category)
        return <Badge variant="info">{cat?.label ?? row.category}</Badge>
      },
      sortable: true,
    },
    {
      key: 'description',
      header: t('common.description'),
      render: (row) => (
        <span className="text-sm text-gray-600 dark:text-gray-300 max-w-xs truncate block">{row.description}</span>
      ),
    },
    {
      key: 'expenseDate',
      header: t('common.date'),
      render: (row) => (
        <span>
          {row.expenseDate
            ? new Date((row.expenseDate as unknown as { toDate?: () => Date })?.toDate ? (row.expenseDate as unknown as { toDate?: () => Date }).toDate!() : row.expenseDate).toLocaleDateString('en-US', {
                month: 'short', day: 'numeric', year: 'numeric',
              })
            : '—'}
        </span>
      ),
      sortable: true,
    },

    {
      key: 'paymentMethod',
      header: t('purchases.paymentHeader'),
      render: (row) => (
        <Badge variant={
          row.paymentMethod === 'cash' ? 'success' :
          row.paymentMethod === 'bank' ? 'info' :
          row.paymentMethod === 'upi' ? 'default' : 'warning'
        }>
          {row.paymentMethod?.toUpperCase()}
        </Badge>
      ),
    },
    {
      key: 'amount',
      header: t('common.amount'),
      render: (row) => (
        <span className="font-semibold text-gray-900 dark:text-gray-100">{formatINR(row.amount)}</span>
      ),
      sortable: true,
    },
    {
      key: 'receipt',
      header: t('expenses.receiptHeader'),
      render: (row) => (
        row.receiptImageURL ? (
          <button
            onClick={() => window.open(row.receiptImageURL, '_blank')}
            className="text-blue-500 hover:text-blue-700"
          >
            <ImageIcon size={16} />
          </button>
        ) : (
          <span className="text-gray-300">—</span>
        )
      ),
    },
    {
      key: 'actions',
      header: t('common.actions'),
      render: (row) => (
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={() => openEdit(row)}>
            <Pencil size={16} />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => handleDelete(row.id)}>
            <Trash2 size={16} className="text-red-500" />
          </Button>
        </div>
      ),
    },
  ]

  const resetForm = () => {
    setForm({ category: 'other', amount: '', description: '', paymentMethod: 'cash', expenseDate: new Date().toISOString().split('T')[0] })
    setEditId(null)
    setReceiptImageURL('')
  }

  const openCreate = () => {
    resetForm()
    setIsFormOpen(true)
  }

  const openEdit = (row: Expense) => {
    setForm({
      category: row.category,
      amount: String(row.amount),
      description: row.description,
      paymentMethod: row.paymentMethod,
      expenseDate: row.expenseDate ? new Date((row.expenseDate as unknown as { toDate?: () => Date })?.toDate ? (row.expenseDate as unknown as { toDate?: () => Date }).toDate!() : row.expenseDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],

    })
    setReceiptImageURL(row.receiptImageURL || '')
    setEditId(row.id)
    setIsFormOpen(true)
  }

  const handleSave = () => {
    if (!form.amount || parseFloat(form.amount) <= 0) {
      toast.error(t('expenses.errValidAmount'))
      return
    }

    if (!form.expenseDate) {
      toast.error(t('expenses.errSelectDate'))
      return
    }

    const payload: Omit<Expense, 'id' | 'createdAt'> = {
      category: form.category as Expense['category'],
      amount: parseFloat(form.amount),
      description: form.description || '',
      paymentMethod: form.paymentMethod,
      expenseDate: new Date(new Date(form.expenseDate)),
      receiptImageURL: receiptImageURL || '',
    } as Omit<Expense, 'id' | 'createdAt'>

    // Remove receiptImageURL if empty (Firebase doesn't accept undefined)
    if (!payload.receiptImageURL) {
      delete payload.receiptImageURL
    }

    console.log('Creating expense with payload:', payload)

    if (editId) {
      updateExpense(
        { expenseId: editId, data: payload },
        {
          onSuccess: () => {
            toast.success(t('expenses.updatedSuccess'))
            setIsFormOpen(false)
            resetForm()
          },
          onError: (error) => {
            console.error('Failed to update expense:', error)
            toastError(error, t('expenses.errUpdateFailedPrefix'))
          },
        }
      )
    } else {
      createExpense(payload, {
        onSuccess: () => {
          toast.success(t('expenses.createdSuccess'))
          setIsFormOpen(false)
          resetForm()
        },
        onError: (error) => {
          console.error('Failed to create expense:', error)
          toastError(error, t('expenses.errCreateFailedPrefix'))
        },
      })
    }
  }

  const handleDelete = (id: string) => {
    if (!confirm(t('expenses.deleteConfirm'))) return
    deleteExpense(id, {
      onSuccess: () => toast.success(t('expenses.deletedSuccess')),
      onError: () => toast.error(t('expenses.errDeleteFailed')),
    })
  }

  const clearFilters = () => {
    setFilterCategory('')
    setFilterStartDate('')
    setFilterEndDate('')
  }

  const hasActiveFilters = filterCategory || filterStartDate || filterEndDate

  return (
    <div>
      <div data-tour="expenses-header">
        <PageHeader
          title={t('page.expenses')}
          onWatchTutorial={pageTutorial.openTutorial}
          action={
            <Button data-tour="add-expense-btn" leftIcon={<Plus size={16} />} onClick={openCreate}>
              {t('expenses.addExpense')}
            </Button>
          }
        />
      </div>

      {/* Filters */}
      <Card className="p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <button
            data-tour="expense-filters-btn"
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Select
              label={t('common.category')}
              options={categoryFilterOptions}
              value={filterCategory}
              onChange={e => setFilterCategory(e.target.value)}
            />
            <DateRangePicker
              startDate={filterStartDate}
              endDate={filterEndDate}
              onStartDateChange={setFilterStartDate}
              onEndDateChange={setFilterEndDate}
            />
          </div>
        )}
      </Card>

      <Card data-tour="expenses-table" className="p-4">
        <DataTable
          data={filteredExpenses}
          columns={columns}
          loading={isLoading}
          searchable
          pagination
          emptyMessage={t('expenses.noExpensesYet')}
        />
      </Card>

      {/* Expense Form Modal */}
      <Modal
        isOpen={isFormOpen}
        onClose={() => { setIsFormOpen(false); resetForm() }}
        title={editId ? t('expenses.editExpense') : t('expenses.addExpense')}
        size="md"
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => { setIsFormOpen(false); resetForm() }}>
              {t('action.cancel')}
            </Button>
            <Button
              onClick={handleSave}
              loading={isCreating || isUpdating}
              disabled={!form.amount || parseFloat(form.amount) <= 0}
            >
              {editId ? t('action.update') : t('expenses.record')}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('common.category')} *
              <FieldInfo textKey="tip.expense.category" />
            </label>
            <Select
              options={CATEGORY_OPTIONS}
              value={form.category}
              onChange={e => setForm(prev => ({ ...prev, category: e.target.value as Expense['category'] }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('common.amount')} (₹) *
              <FieldInfo textKey="tip.expense.amount" />
            </label>
            <Input
              type="number"
              step="0.01"
              value={form.amount}
              onChange={e => setForm(prev => ({ ...prev, amount: e.target.value }))}
              placeholder="0.00"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('common.date')} *
              <FieldInfo textKey="tip.expense.date" />
            </label>
            <Input
              type="date"
              value={form.expenseDate}
              onChange={e => setForm(prev => ({ ...prev, expenseDate: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('common.description')}
              <FieldInfo textKey="tip.expense.description" />
            </label>
            <Input
              value={form.description}
              onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
              placeholder={t('expenses.descriptionPlaceholder')}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('common.paymentMethod')}
              <FieldInfo textKey="tip.expense.paymentMethod" />
            </label>
            <Select
              options={PAYMENT_OPTIONS}
              value={form.paymentMethod}
              onChange={e => setForm(prev => ({ ...prev, paymentMethod: e.target.value as Expense['paymentMethod'] }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('expenses.receiptImageOptional')}
              <FieldInfo textKey="tip.expense.receipt" />
            </label>
            <ImageUpload
              value={receiptImageURL}
              onChange={setReceiptImageURL}
              onFileSelect={handleReceiptUpload}
              previewSize="sm"
            />
          </div>
        </div>
      </Modal>

      {/* Tutorial Video Modal & Guided Onboarding Tour */}
      <PageVideoTutorialModal
        isOpen={pageTutorial.isTutorialOpen}
        onClose={pageTutorial.closeTutorial}
        tutorial={pageTutorial.tutorialData}
        onStartTour={pageTutorial.startTour}
      />
      <InteractivePageTour
        pageKey="expenses"
        steps={pageTutorial.tutorialData.tourSteps}
        isOpen={pageTutorial.isTourOpen}
        onClose={pageTutorial.closeTour}
      />
    </div>
  )
}
