import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { EmptyState } from '@/components/ui/EmptyState'
import { Pencil, Trash2, Plus, LayoutGrid } from 'lucide-react'
import toast from 'react-hot-toast'
import { toastError } from '@/utils/userMessage'
import {
  useCreateRestaurantTable,
  useUpdateRestaurantTable,
  useDeleteRestaurantTable,
} from '@/hooks/useRestaurantTables'
import type { RestaurantTable } from '@/types/kot.types'

interface TableManageModalProps {
  isOpen: boolean
  onClose: () => void
  tables: RestaurantTable[]
  itemLabel?: string
}

export const TableManageModal = ({ isOpen, onClose, tables, itemLabel = 'table' }: TableManageModalProps) => {
  const { mutate: createTable, isPending: isCreating } = useCreateRestaurantTable()
  const { mutate: updateTable, isPending: isUpdating } = useUpdateRestaurantTable()
  const { mutate: deleteTable, isPending: isDeleting } = useDeleteRestaurantTable()

  const [name, setName] = useState('')
  const [capacity, setCapacity] = useState('4')
  const [sortOrder, setSortOrder] = useState('0')
  const [editId, setEditId] = useState<string | null>(null)

  const resetForm = () => {
    setName('')
    setCapacity('4')
    setSortOrder(String(tables.length))
    setEditId(null)
  }

  const startEdit = (table: RestaurantTable) => {
    setEditId(table.id)
    setName(table.name)
    setCapacity(table.capacity != null ? String(table.capacity) : '')
    setSortOrder(String(table.sortOrder))
  }

  const handleSave = () => {
    const trimmed = name.trim()
    if (!trimmed) {
      toast.error(`${itemLabel.charAt(0).toUpperCase() + itemLabel.slice(1)} name is required`)
      return
    }
    const cap = capacity.trim() === '' ? null : Number(capacity)
    const sort = Number(sortOrder) || 0

    if (editId) {
      updateTable(
        { id: editId, data: { name: trimmed, capacity: cap, sortOrder: sort } },
        {
          onSuccess: () => {
            toast.success(`${itemLabel.charAt(0).toUpperCase() + itemLabel.slice(1)} updated`)
            resetForm()
          },
          onError: (err) => toastError(err, 'Could not update the table'),
        }
      )
    } else {
      createTable(
        { name: trimmed, capacity: cap, sortOrder: sort },
        {
          onSuccess: () => {
            toast.success(`${itemLabel.charAt(0).toUpperCase() + itemLabel.slice(1)} added`)
            resetForm()
          },
          onError: (err) => toastError(err, 'Could not add the table'),
        }
      )
    }
  }

  const handleDelete = (table: RestaurantTable) => {
    if (table.isOccupied) {
      toast.error('Cannot delete an occupied table. Settle the bill first.')
      return
    }
    if (!window.confirm(`Delete ${table.name}? This cannot be undone.`)) return
    deleteTable(table.id, {
      onSuccess: () => toast.success('Table deleted'),
      onError: (err) => toastError(err, 'Could not delete the table'),
    })
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        resetForm()
        onClose()
      }}
      title={`Manage ${itemLabel}s`}
      size="lg"
    >
      <div className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <Input
            placeholder={`Name (e.g. ${itemLabel.charAt(0).toUpperCase() + itemLabel.slice(1)} 1)`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="sm:col-span-2"
          />
          <Input
            type="number"
            min={1}
            placeholder="Seats"
            value={capacity}
            onChange={(e) => setCapacity(e.target.value)}
          />
          <Input
            type="number"
            min={0}
            placeholder="Sort"
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
          />
        </div>
        <div className="flex justify-end gap-2">
          {editId && (
            <Button variant="ghost" onClick={resetForm}>
              Cancel edit
            </Button>
          )}
          <Button onClick={handleSave} loading={isCreating || isUpdating} leftIcon={<Plus size={16} />}>
            {editId ? 'Save' : `Add ${itemLabel}`}
          </Button>
        </div>

        {tables.length === 0 ? (
          <EmptyState icon={<LayoutGrid size={36} />} title={`No ${itemLabel}s yet`} description="Add your first one above." />
        ) : (
          <ul className="divide-y divide-gray-200 dark:divide-gray-700 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            {tables.map((table) => (
              <li key={table.id} className="flex items-center gap-3 px-3 py-2.5 bg-white dark:bg-gray-800">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 dark:text-gray-100 truncate">{table.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {table.capacity ? `${table.capacity} seats` : 'No capacity'} · order {table.sortOrder}
                    {table.isOccupied ? ' · occupied' : ''}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => startEdit(table)}
                  className="p-2 rounded-lg text-gray-400 transition-colors duration-150 hover:text-blue-600"
                  aria-label="Edit table"
                >
                  <Pencil size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(table)}
                  disabled={isDeleting}
                  className="p-2 rounded-lg text-gray-400 transition-colors duration-150 hover:text-red-600"
                  aria-label="Delete table"
                >
                  <Trash2 size={16} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  )
}
