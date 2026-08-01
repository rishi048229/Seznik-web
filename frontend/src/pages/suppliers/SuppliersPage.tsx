import { useState } from 'react'
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
import { Pencil, Trash2, Plus, Phone, Mail, MapPin } from 'lucide-react'

import { useSuppliers, useCreateSupplier, useUpdateSupplier, useDeleteSupplier } from '@/hooks/useSuppliers'
import toast from 'react-hot-toast'

import type { Supplier } from '@/services/supplierService'
import { useLanguage } from '@/contexts/LanguageContext'

export const SuppliersPage = () => {
  const { t } = useLanguage()
  const pageTutorial = usePageTutorial('suppliers')
  const { data: suppliers, isLoading } = useSuppliers()
  const { mutate: createSupplier, isPending: isCreating } = useCreateSupplier()
  const { mutate: updateSupplier, isPending: isUpdating } = useUpdateSupplier()
  const { mutate: deleteSupplier } = useDeleteSupplier()
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    gstin: '',
  })

  const columns: ColumnDef<Supplier>[] = [
    {
      key: 'name',
      header: t('common.supplier'),
      render: (row) => (
        <div>
          <span className="font-medium">{row.name}</span>
          {row.gstin && <Badge variant="info" className="ml-2">{row.gstin}</Badge>}
        </div>
      ),
      sortable: true,
    },
    {
      key: 'phone',
      header: t('common.phone'),
      render: (row) => (
        <div className="flex items-center gap-1.5">
          <Phone size={14} className="text-gray-400" />
          <span>{row.phone}</span>
        </div>
      ),
    },
    {
      key: 'email',
      header: t('common.email'),
      render: (row) => row.email ? (
        <div className="flex items-center gap-1.5">
          <Mail size={14} className="text-gray-400" />
          <span>{row.email}</span>
        </div>
      ) : <span className="text-gray-400">—</span>,
    },
    {
      key: 'address',
      header: t('common.address'),
      render: (row) => row.address ? (
        <div className="flex items-center gap-1.5 max-w-xs">
          <MapPin size={14} className="text-gray-400 flex-shrink-0" />
          <span className="truncate">{row.address}</span>
        </div>
      ) : <span className="text-gray-400">—</span>,
    },
    {
      key: 'actions',
      header: t('common.actions'),
      render: (row) => (
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={() => openEdit(row)}>
            <Pencil size={16} />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => handleDelete(row.id, row.name)}>
            <Trash2 size={16} className="text-red-500" />
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
    <div>
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
