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
import { DataTable, type ColumnDef } from '@/components/data-display/DataTable'
import { Spinner } from '@/components/ui/Spinner'
import { Badge } from '@/components/ui/Badge'
import { DateRangePicker } from '@/components/forms/DateRangePicker'
import { ImageUpload } from '@/components/forms/ImageUpload'
import { useExpenses, useCreateExpense, useUpdateExpense, useDeleteExpense } from '@/hooks/useExpenses'
import { useAuth } from '@/contexts/AuthContext'
import { Plus, Pencil, Trash2, Receipt, Filter, Image as ImageIcon } from 'lucide-react'
import { formatINR } from '@/utils/currency'
import { uploadExpenseReceipt } from '@/utils/storage'
import toast from 'react-hot-toast'
import type { Expense } from '@/types/expense.types'


const CATEGORY_OPTIONS = [
  { value: 'rent', label: 'Rent' },
  { value: 'utilities', label: 'Utilities' },
  { value: 'salaries', label: 'Salaries' },
  { value: 'inventory', label: 'Inventory' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'other', label: 'Other' },
]

const PAYMENT_OPTIONS = [
  { value: 'cash', label: 'Cash' },
  { value: 'bank', label: 'Bank Transfer' },
  { value: 'upi', label: 'UPI' },
  { value: 'card', label: 'Card' },
]

export const ExpensesPage = () => {
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
    { value: '', label: 'All Categories' },
    ...CATEGORY_OPTIONS,
  ]

  const handleReceiptUpload = async (file: File): Promise<string> => {
    if (!user) return ''
    return uploadExpenseReceipt(user.uid, file)
  }

  // Filtered expenses
  const filteredExpenses = useMemo(() => {
    let result = expenses ?? []

    if (filterCategory) {
      result = result.filter(e => e.category === filterCategory)
    }

    if (filterStartDate) {
      const start = new Date(filterStartDate)
      start.setHours(0, 0, 0, 0)
      result = result.filter(e => {
        const eDate = e.expenseDate ? (typeof e.expenseDate === 'string' ? new Date(e.expenseDate) : (e.expenseDate as any).toDate ? (e.expenseDate as any).toDate() : new Date(e.expenseDate)) : new Date()
        return eDate >= start
      })
    }

    if (filterEndDate) {
      const end = new Date(filterEndDate)
      end.setHours(23, 59, 59, 999)
      result = result.filter(e => {
        const eDate = e.expenseDate ? (typeof e.expenseDate === 'string' ? new Date(e.expenseDate) : (e.expenseDate as any).toDate ? (e.expenseDate as any).toDate() : new Date(e.expenseDate)) : new Date()
        return eDate <= end
      })
    }

    return result
  }, [expenses, filterCategory, filterStartDate, filterEndDate])

  const columns: ColumnDef<Expense>[] = [
    {
      key: 'category',
      header: 'Category',
      render: (row) => {
        const cat = CATEGORY_OPTIONS.find(c => c.value === row.category)
        return <Badge variant="info">{cat?.label ?? row.category}</Badge>
      },
      sortable: true,
    },
    {
      key: 'description',
      header: 'Description',
      render: (row) => (
        <span className="text-sm text-gray-600 dark:text-gray-300 max-w-xs truncate block">{row.description}</span>
      ),
    },
    {
      key: 'expenseDate',
      header: 'Date',
      render: (row) => (
        <span>
          {row.expenseDate
            ? new Date((row.expenseDate as any)?.toDate ? (row.expenseDate as any).toDate() : row.expenseDate).toLocaleDateString('en-US', {
                month: 'short', day: 'numeric', year: 'numeric',
              })
            : '—'}
        </span>
      ),
      sortable: true,
    },
    {
      key: 'paymentMethod',
      header: 'Payment',
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
      header: 'Amount',
      render: (row) => (
        <span className="font-semibold text-gray-900 dark:text-gray-100">{formatINR(row.amount)}</span>
      ),
      sortable: true,
    },
    {
      key: 'receipt',
      header: 'Receipt',
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
      header: 'Actions',
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
      expenseDate: row.expenseDate ? new Date((row.expenseDate as any)?.toDate ? (row.expenseDate as any).toDate() : row.expenseDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
    })
    setReceiptImageURL(row.receiptImageURL || '')
    setEditId(row.id)
    setIsFormOpen(true)
  }

  const handleSave = () => {
    if (!form.amount || parseFloat(form.amount) <= 0) {
      toast.error('Please enter a valid amount')
      return
    }

    if (!form.expenseDate) {
      toast.error('Please select a date')
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
            toast.success('Expense updated')
            setIsFormOpen(false)
            resetForm()
          },
          onError: (error) => {
            console.error('Failed to update expense:', error)
            toast.error(`Failed to update expense: ${error instanceof Error ? error.message : 'Unknown error'}`)
          },
        }
      )
    } else {
      createExpense(payload, {
        onSuccess: () => {
          toast.success('Expense recorded')
          setIsFormOpen(false)
          resetForm()
        },
        onError: (error) => {
          console.error('Failed to create expense:', error)
          toast.error(`Failed to record expense: ${error instanceof Error ? error.message : 'Unknown error'}`)
        },
      })
    }
  }

  const handleDelete = (id: string) => {
    if (!confirm('Delete this expense?')) return
    deleteExpense(id, {
      onSuccess: () => toast.success('Expense deleted'),
      onError: () => toast.error('Failed to delete expense'),
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
          title="Expenses"
          onWatchTutorial={pageTutorial.openTutorial}
          action={
            <Button leftIcon={<Plus size={16} />} onClick={openCreate}>
              Add Expense
            </Button>
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
            Filters
            {hasActiveFilters && (
              <span className="w-2 h-2 rounded-full bg-blue-500" />
            )}
          </button>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              Clear All
            </Button>
          )}
        </div>

        {showFilters && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Select
              label="Category"
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
          emptyMessage="No expenses recorded yet"
        />
      </Card>

      {/* Expense Form Modal */}
      <Modal
        isOpen={isFormOpen}
        onClose={() => { setIsFormOpen(false); resetForm() }}
        title={editId ? 'Edit Expense' : 'Add Expense'}
        size="md"
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => { setIsFormOpen(false); resetForm() }}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              loading={isCreating || isUpdating}
              disabled={!form.amount || parseFloat(form.amount) <= 0}
            >
              {editId ? 'Update' : 'Record'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Select
            label="Category *"
            options={CATEGORY_OPTIONS}
            value={form.category}
            onChange={e => setForm(prev => ({ ...prev, category: e.target.value as Expense['category'] }))}
          />
          <Input
            label="Amount (₹) *"
            type="number"
            step="0.01"
            value={form.amount}
            onChange={e => setForm(prev => ({ ...prev, amount: e.target.value }))}
            placeholder="0.00"
            autoFocus
          />
          <Input
            label="Date *"
            type="date"
            value={form.expenseDate}
            onChange={e => setForm(prev => ({ ...prev, expenseDate: e.target.value }))}
          />
          <Input
            label="Description"
            value={form.description}
            onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
            placeholder="e.g. Monthly electricity bill"
          />
          <Select
            label="Payment Method"
            options={PAYMENT_OPTIONS}
            value={form.paymentMethod}
            onChange={e => setForm(prev => ({ ...prev, paymentMethod: e.target.value as Expense['paymentMethod'] }))}
          />
          <ImageUpload
            label="Receipt Image (optional)"
            value={receiptImageURL}
            onChange={setReceiptImageURL}
            onFileSelect={handleReceiptUpload}
            previewSize="sm"
          />
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
