import { useState, useEffect } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { useCreateCustomer } from '@/hooks/useCustomers'
import toast from 'react-hot-toast'

interface QuickAddCustomerModalProps {
  isOpen: boolean
  onClose: () => void
  /** Fired with the new customer's id once created, so the checkout screen can auto-select them. */
  onCreated: (customerId: string) => void
  /** Pre-fills the name field — e.g. when opened from a search that found no match. */
  initialName?: string
}

// Trimmed-down version of the Customers page's "Add Customer" form (name, phone,
// email — no address) so staff can add a walk-in customer without leaving checkout.
export const QuickAddCustomerModal = ({ isOpen, onClose, onCreated, initialName }: QuickAddCustomerModalProps) => {
  const { mutate: createCustomer, isPending } = useCreateCustomer()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')

  useEffect(() => {
    if (isOpen && initialName) setName(initialName)
  }, [isOpen, initialName])

  const reset = () => {
    setName('')
    setPhone('')
    setEmail('')
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  const handleCreate = () => {
    if (!name.trim() || !phone.trim()) return
    createCustomer(
      { name: name.trim(), phone: phone.trim(), email: email.trim() || undefined },
      {
        onSuccess: (customerId) => {
          toast.success('Customer added')
          onCreated(customerId)
          reset()
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to add customer'),
      }
    )
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Add New Customer"
      size="sm"
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleCreate} loading={isPending} disabled={!name.trim() || !phone.trim()}>
            Add & Select
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Input
          label="Customer Name *"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="e.g. John Doe"
          autoFocus
          onKeyDown={e => { if (e.key === 'Enter') handleCreate() }}
        />
        <Input
          label="Phone *"
          value={phone}
          onChange={e => setPhone(e.target.value)}
          placeholder="e.g. +91 98765 43210"
          onKeyDown={e => { if (e.key === 'Enter') handleCreate() }}
        />
        <Input
          label="Email"
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="e.g. john@example.com"
          onKeyDown={e => { if (e.key === 'Enter') handleCreate() }}
        />
      </div>
    </Modal>
  )
}
