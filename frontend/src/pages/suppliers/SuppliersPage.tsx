import { useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { PageVideoTutorialModal } from '@/components/common/PageVideoTutorialModal'
import { InteractivePageTour } from '@/components/common/InteractivePageTour'
import { usePageTutorial } from '@/hooks/usePageTutorial'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
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
      header: 'Supplier',
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
      header: 'Phone',
      render: (row) => (
        <div className="flex items-center gap-1.5">
          <Phone size={14} className="text-gray-400" />
          <span>{row.phone}</span>
        </div>
      ),
    },
    {
      key: 'email',
      header: 'Email',
      render: (row) => row.email ? (
        <div className="flex items-center gap-1.5">
          <Mail size={14} className="text-gray-400" />
          <span>{row.email}</span>
        </div>
      ) : <span className="text-gray-400">—</span>,
    },
    {
      key: 'address',
      header: 'Address',
      render: (row) => row.address ? (
        <div className="flex items-center gap-1.5 max-w-xs">
          <MapPin size={14} className="text-gray-400 flex-shrink-0" />
          <span className="truncate">{row.address}</span>
        </div>
      ) : <span className="text-gray-400">—</span>,
    },
    {
      key: 'actions',
      header: 'Actions',
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
            toast.success('Supplier updated')
            setIsFormOpen(false)
            resetForm()
          },
          onError: () => toast.error('Failed to update supplier'),
        }
      )
    } else {
      createSupplier(form, {
        onSuccess: () => {
          toast.success('Supplier created')
          setIsFormOpen(false)
          resetForm()
        },
        onError: () => toast.error('Failed to create supplier'),
      })
    }
  }

  const handleDelete = (id: string, name: string) => {
    if (!confirm(`Delete supplier "${name}"?`)) return
    deleteSupplier(id, {
      onSuccess: () => toast.success('Supplier deleted'),
      onError: () => toast.error('Failed to delete supplier'),
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
          emptyMessage="No suppliers found. Add your first supplier!"
        />
      </Card>

      <Modal
        isOpen={isFormOpen}
        onClose={() => { setIsFormOpen(false); resetForm() }}
        title={editId ? 'Edit Supplier' : t('suppliers.addSupplier')}
        size="md"
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => { setIsFormOpen(false); resetForm() }}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              loading={isCreating || isUpdating}
              disabled={!form.name.trim() || !form.phone.trim()}
            >
              {editId ? 'Update' : 'Create'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Input
            label="Supplier Name *"
            value={form.name}
            onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
            placeholder="e.g. ABC Distributors"
            autoFocus
          />
          <Input
            label="Phone *"
            value={form.phone}
            onChange={e => setForm(prev => ({ ...prev, phone: e.target.value }))}
            placeholder="e.g. +91 98765 43210"
          />
          <Input
            label="Email"
            type="email"
            value={form.email}
            onChange={e => setForm(prev => ({ ...prev, email: e.target.value }))}
            placeholder="e.g. contact@abc.com"
          />
          <Input
            label="Address"
            value={form.address}
            onChange={e => setForm(prev => ({ ...prev, address: e.target.value }))}
            placeholder="Full address"
          />
          <Input
            label="GSTIN"
            value={form.gstin}
            onChange={e => setForm(prev => ({ ...prev, gstin: e.target.value }))}
            placeholder="e.g. 22AAAAA0000A1Z5"
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
        pageKey="suppliers"
        steps={pageTutorial.tutorialData.tourSteps}
        isOpen={pageTutorial.isTourOpen}
        onClose={pageTutorial.closeTour}
      />
    </div>
  )
}
