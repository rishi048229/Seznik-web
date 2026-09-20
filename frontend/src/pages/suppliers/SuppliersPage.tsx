import { useState, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { PageHeader } from '@/components/layout/PageHeader'
import { PageVideoTutorialModal } from '@/components/common/PageVideoTutorialModal'
import { InteractivePageTour } from '@/components/common/InteractivePageTour'
import { usePageTutorial } from '@/hooks/usePageTutorial'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { FieldInfo } from '@/components/ui/FieldInfo'
import { DataTable, type ColumnDef } from '@/components/data-display/DataTable'
import { Badge } from '@/components/ui/Badge'
import { 
  Pencil, 
  Trash2, 
  Plus, 
  Phone, 
  Mail, 
  MapPin, 
  ArrowUpRight, 
  CreditCard, 
  Users, 
  AlertCircle, 
  BookOpen 
} from 'lucide-react'

import { useSuppliers, useCreateSupplier, useUpdateSupplier, useDeleteSupplier } from '@/hooks/useSuppliers'
import { RecordPurchasePaymentModal } from '@/components/purchases/RecordPurchasePaymentModal'
import { formatINR } from '@/utils/currency'
import { ROUTES } from '@/constants/routes'
import toast from 'react-hot-toast'

import type { Supplier } from '@/services/supplierService'
import { useLanguage } from '@/contexts/LanguageContext'

export const SuppliersPage = () => {
  const { t } = useLanguage()
  const navigate = useNavigate()
  const pageTutorial = usePageTutorial('suppliers')
  const { data: suppliers, isLoading } = useSuppliers()
  const { mutate: createSupplier, isPending: isCreating } = useCreateSupplier()
  const { mutate: updateSupplier, isPending: isUpdating } = useUpdateSupplier()
  const { mutate: deleteSupplier } = useDeleteSupplier()
  
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [payingSupplier, setPayingSupplier] = useState<Supplier | null>(null)
  
  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    gstin: '',
  })

  // Summary Metrics
  const metrics = useMemo(() => {
    if (!suppliers || suppliers.length === 0) {
      return { total: 0, totalPayable: 0, suppliersWithDue: 0 }
    }
    const total = suppliers.length
    const totalPayable = suppliers.reduce((sum, s) => sum + (s.payableBalance && s.payableBalance > 0 ? s.payableBalance : 0), 0)
    const suppliersWithDue = suppliers.filter(s => (s.payableBalance || 0) > 0).length
    return { total, totalPayable, suppliersWithDue }
  }, [suppliers])

  const columns: ColumnDef<Supplier>[] = [
    {
      key: 'name',
      header: t('common.supplier'),
      render: (row) => (
        <div>
          <Link
            to={ROUTES.SUPPLIER_DETAIL(row.id)}
            className="font-semibold text-primary-600 dark:text-primary-400 hover:underline inline-flex items-center gap-1 group"
          >
            <span>{row.name}</span>
            <ArrowUpRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
          </Link>
          {row.gstin && <Badge variant="info" className="ml-2">{row.gstin}</Badge>}
        </div>
      ),
      sortable: true,
    },
    {
      key: 'phone',
      header: t('common.phone'),
      render: (row) => (
        <div className="flex items-center gap-1.5 text-sm">
          <Phone size={14} className="text-gray-400" />
          <span>{row.phone}</span>
        </div>
      ),
    },
    {
      key: 'payableBalance',
      header: 'Payable Balance',
      render: (row) => {
        const bal = row.payableBalance || 0
        if (bal > 0) {
          return (
            <div className="flex flex-col">
              <span className="font-semibold text-amber-700 dark:text-amber-400 font-mono text-sm">
                {formatINR(bal)}
              </span>
              <span className="text-[10px] text-amber-600 dark:text-amber-500 font-medium">
                To Pay (Pending)
              </span>
            </div>
          )
        }
        if (bal < 0) {
          return (
            <div className="flex flex-col">
              <span className="font-semibold text-emerald-700 dark:text-emerald-400 font-mono text-sm">
                {formatINR(Math.abs(bal))}
              </span>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-500 font-medium">
                Advance / Credit Note
              </span>
            </div>
          )
        }
        return (
          <span className="text-xs text-gray-400 font-mono">
            ₹0.00 (Settled)
          </span>
        )
      },
      sortable: true,
    },
    {
      key: 'address',
      header: t('common.address'),
      render: (row) => row.address ? (
        <div className="flex items-center gap-1.5 max-w-xs text-xs text-gray-600 dark:text-gray-300">
          <MapPin size={13} className="text-gray-400 flex-shrink-0" />
          <span className="truncate">{row.address}</span>
        </div>
      ) : <span className="text-gray-400 text-xs">—</span>,
    },
    {
      key: 'actions',
      header: t('common.actions'),
      render: (row) => (
        <div className="flex items-center gap-1.5">
          {(row.payableBalance || 0) > 0 && (
            <Button 
              variant="outline" 
              size="sm" 
              className="text-xs border-amber-300 text-amber-800 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800 hover:bg-amber-100 h-8 px-2.5"
              onClick={() => setPayingSupplier(row)}
            >
              <CreditCard size={13} className="mr-1" />
              Pay
            </Button>
          )}
          <Button 
            variant="ghost" 
            size="sm" 
            title="View Ledger / Statement"
            onClick={() => navigate(ROUTES.SUPPLIER_DETAIL(row.id))}
            className="h-8 px-2 text-gray-600 dark:text-gray-300"
          >
            <BookOpen size={15} />
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            title="Edit Supplier"
            onClick={() => openEdit(row)}
            className="h-8 px-2"
          >
            <Pencil size={15} />
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            title="Delete Supplier"
            onClick={() => handleDelete(row.id, row.name)}
            className="h-8 px-2 text-red-500 hover:text-red-700"
          >
            <Trash2 size={15} />
          </Button>
        </div>
      ),
    },
  ]

  const resetForm = () => {
    setForm({ name: '', phone: '', email: '', address: '', gstin: '' })
    setEditId(null)
  }

  const openCreate = () => {
    resetForm()
    setIsFormOpen(true)
  }

  const openEdit = (row: Supplier) => {
    setForm({
      name: row.name,
      phone: row.phone ?? '',
      email: row.email ?? '',
      address: row.address ?? '',
      gstin: row.gstin ?? '',
    })
    setEditId(row.id)
    setIsFormOpen(true)
  }

  const handleSave = () => {
    if (!form.name.trim() || !form.phone.trim()) return

    if (editId) {
      updateSupplier(
        { supplierId: editId, data: form },
        {
          onSuccess: () => {
            toast.success(t('suppliers.updatedSuccess'))
            setIsFormOpen(false)
            resetForm()
          },
          onError: () => toast.error(t('suppliers.errUpdateFailed')),
        }
      )
    } else {
      createSupplier(form, {
        onSuccess: () => {
          toast.success(t('suppliers.createdSuccess'))
          setIsFormOpen(false)
          resetForm()
        },
        onError: () => toast.error(t('suppliers.errCreateFailed')),
      })
    }
  }

  const handleDelete = (id: string, name: string) => {
    if (!confirm(`${t('suppliers.deleteConfirmPrefix')}${name}${t('suppliers.deleteConfirmSuffix')}`)) return
    deleteSupplier(id, {
      onSuccess: () => toast.success(t('suppliers.deletedSuccess')),
      onError: () => toast.error(t('suppliers.errDeleteFailed')),
    })
  }

  return (
    <div className="space-y-6">
      <div data-tour="suppliers-header">
        <PageHeader
          title={t('page.suppliers')}
          onWatchTutorial={pageTutorial.openTutorial}
          action={
            <Button data-tour="add-supplier-btn" leftIcon={<Plus size={16} />} onClick={openCreate}>
              {t('suppliers.addSupplier')}
            </Button>
          }
        />
      </div>

      {/* Overview Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4 border-l-4 border-l-primary-500 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Total Vendors
            </p>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
              {metrics.total}
            </p>
          </div>
          <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900/40 text-primary-600 dark:text-primary-400 flex items-center justify-center">
            <Users size={20} />
          </div>
        </Card>

        <Card className="p-4 border-l-4 border-l-amber-500 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Total Outstanding Payables
            </p>
            <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1 font-mono">
              {formatINR(metrics.totalPayable)}
            </p>
          </div>
          <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 flex items-center justify-center">
            <CreditCard size={20} />
          </div>
        </Card>

        <Card className="p-4 border-l-4 border-l-blue-500 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Vendors with Pending Dues
            </p>
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">
              {metrics.suppliersWithDue}
            </p>
          </div>
          <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center">
            <AlertCircle size={20} />
          </div>
        </Card>
      </div>

      <Card data-tour="suppliers-table" className="p-4">
        <DataTable
          data={suppliers ?? []}
          columns={columns}
          loading={isLoading}
          searchable
          pagination
          emptyMessage={t('suppliers.noSuppliersYet')}
        />
      </Card>

      <Modal
        isOpen={isFormOpen}
        onClose={() => { setIsFormOpen(false); resetForm() }}
        title={editId ? t('suppliers.editSupplier') : t('suppliers.addSupplier')}
        size="md"
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => { setIsFormOpen(false); resetForm() }}>
              {t('action.cancel')}
            </Button>
            <Button
              onClick={handleSave}
              loading={isCreating || isUpdating}
              disabled={!form.name.trim() || !form.phone.trim()}
            >
              {editId ? t('action.update') : t('action.create')}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('common.supplier')} {t('common.name')} *
              <FieldInfo textKey="tip.supplier.name" />
            </label>
            <Input
              value={form.name}
              onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
              placeholder={t('suppliers.namePlaceholder')}
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('common.phone')} *
              <FieldInfo textKey="tip.supplier.phone" />
            </label>
            <Input
              value={form.phone}
              onChange={e => setForm(prev => ({ ...prev, phone: e.target.value }))}
              placeholder={t('suppliers.phonePlaceholder')}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('common.email')}
              <FieldInfo textKey="tip.supplier.email" />
            </label>
            <Input
              type="email"
              value={form.email}
              onChange={e => setForm(prev => ({ ...prev, email: e.target.value }))}
              placeholder={t('suppliers.emailPlaceholder')}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('common.address')}
              <FieldInfo textKey="tip.supplier.address" />
            </label>
            <Input
              value={form.address}
              onChange={e => setForm(prev => ({ ...prev, address: e.target.value }))}
              placeholder={t('suppliers.addressPlaceholder')}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('suppliers.gstin')}
              <FieldInfo textKey="tip.supplier.gstin" />
            </label>
            <Input
              value={form.gstin}
              onChange={e => setForm(prev => ({ ...prev, gstin: e.target.value }))}
              placeholder={t('suppliers.gstinPlaceholder')}
            />
          </div>
        </div>
      </Modal>

      {/* Quick Pay Modal for Supplier */}
      {payingSupplier && (
        <RecordPurchasePaymentModal
          isOpen={!!payingSupplier}
          onClose={() => setPayingSupplier(null)}
          supplier={payingSupplier}
        />
      )}

      {/* Tutorial Video Modal & Guided Onboarding Tour */}
      <PageVideoTutorialModal
        isOpen={pageTutorial.isTutorialOpen}
        onClose={pageTutorial.closeTutorial}
        tutorial={pageTutorial.tutorialData}
        onStartTour={pageTutorial.startTour}
      />
      <InteractivePageTour
        pageKey="suppliers"
        steps={pageTutorial.tutorialData.tourSteps}
        isOpen={pageTutorial.isTourOpen}
        onClose={pageTutorial.closeTour}
      />
    </div>
  )
}

