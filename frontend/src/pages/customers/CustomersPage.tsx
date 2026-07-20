import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { Spinner } from '@/components/ui/Spinner'
import { useCustomers, useCreateCustomer, useUpdateCustomer, useDeleteCustomer } from '@/hooks/useCustomers'
import { useSales } from '@/hooks/useSales'
import { useCreditTransactions } from '@/hooks/useCustomers'
import { Plus, Pencil, Trash2, Search, UserPlus, Filter, ChevronLeft, ChevronRight, TrendingUp, Users, DollarSign, Calendar, MoreVertical, Eye, FileText, CreditCard } from 'lucide-react'
import { formatINR } from '@/utils/currency'
import { ROUTES } from '@/constants/routes'
import toast from 'react-hot-toast'
import type { Customer } from '@/types/customer.types'

const PAGE_SIZE = 10

export const CustomersPage = () => {
  const navigate = useNavigate()
  const { data: customers, isLoading } = useCustomers()
  const { data: sales } = useSales()
  const { data: transactions } = useCreditTransactions()
  const { mutate: createCustomer, isPending: isCreating } = useCreateCustomer()
  const { mutate: updateCustomer, isPending: isUpdating } = useUpdateCustomer()
  const { mutate: deleteCustomer } = useDeleteCustomer()

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'vip' | 'inactive'>('all')
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
  })

  const activeCustomers = (customers ?? []) as Customer[]

  // Calculate total spent per customer from sales
  const customerSpending = activeCustomers.reduce<Record<string, number>>((acc, c) => {
    acc[c.id] = sales?.filter(s => s.customerId === c.id).reduce((sum, s) => sum + s.grandTotal, 0) ?? 0
    return acc
  }, {})

  const filtered = activeCustomers.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.phone.includes(search) ||
      (c.email && c.email.toLowerCase().includes(search.toLowerCase()))
    const matchesStatus = statusFilter === 'all' ||
      (statusFilter === 'vip' && c.creditBalance > 1000) ||
      (statusFilter === 'inactive' && c.creditBalance === 0)
    return matchesSearch && matchesStatus
  })

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  // Stats
  const totalActive = activeCustomers.length
  const avgCLV = activeCustomers.length > 0
    ? Object.values(customerSpending).reduce((s, v) => s + v, 0) / activeCustomers.length
    : 0
  const newThisWeek = activeCustomers.filter(c => {
    const created = c.createdAt?.toDate ? new Date(c.createdAt.toDate()) : new Date()
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    return created >= weekAgo
  }).length

  const resetForm = () => {
    setForm({ name: '', phone: '', email: '', address: '' })
    setEditId(null)
  }

  const openCreate = () => {
    resetForm()
    setIsFormOpen(true)
  }

  const openEdit = (row: Customer) => {
    setForm({
      name: row.name,
      phone: row.phone,
      email: row.email ?? '',
      address: row.address ?? '',
    })
    setEditId(row.id)
    setIsFormOpen(true)
  }

  const handleSave = () => {
    if (!form.name.trim() || !form.phone.trim()) {
      toast.error('Please fill in name and phone')
      return
    }

    if (editId) {
      updateCustomer(
        { customerId: editId, data: form },
        {
          onSuccess: () => {
            toast.success('Customer updated')
            setIsFormOpen(false)
            resetForm()
          },
          onError: () => toast.error('Failed to update customer'),
        }
      )
    } else {
      createCustomer(form, {
        onSuccess: () => {
          toast.success('Customer created')
          setIsFormOpen(false)
          resetForm()
        },
        onError: () => toast.error('Failed to create customer'),
      })
    }
  }

  const handleDelete = (id: string, name: string) => {
    if (!confirm(`Delete customer "${name}"?`)) return
    deleteCustomer(id, {
      onSuccess: () => toast.success('Customer deleted'),
      onError: () => toast.error('Failed to delete customer'),
    })
  }

  // Recent activity from transactions
  const recentActivity = (transactions ?? []).slice(0, 5).map(tx => {
    const customer = activeCustomers.find(c => c.id === tx.customerId)
    return {
      ...tx,
      customerName: customer?.name ?? 'Unknown',
    }
  })

  return (
    <div className="p-6">
      <PageHeader
        title="Customer Directory"
        action={
          <Button leftIcon={<UserPlus size={16} />} onClick={openCreate}>
            Add Customer
          </Button>
        }
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card className="p-6 md:col-span-2 bg-gradient-to-br from-indigo-50 to-white dark:from-indigo-900/20 dark:to-gray-800 border-indigo-100 dark:border-indigo-800 relative overflow-hidden">
          <div className="relative z-10">
            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium mb-1">Total Active Customers</p>
            <p className="text-4xl font-black text-indigo-600">{totalActive.toLocaleString()}</p>
            <div className="mt-3 flex items-center gap-2 text-emerald-600 text-xs font-bold">
              <TrendingUp size={14} />
              12% Increase this month
            </div>
          </div>
          <div className="absolute -right-4 -bottom-4 opacity-10">
            <Users size={96} />
          </div>
        </Card>
        <Card className="p-6">
          <p className="text-sm text-gray-500 dark:text-gray-400 font-medium mb-1">Average CLV</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{formatINR(avgCLV)}</p>
        </Card>
        <Card className="p-6">
          <p className="text-sm text-gray-500 dark:text-gray-400 font-medium mb-1">New this Week</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{newThisWeek}</p>
        </Card>
      </div>

      {/* Customer Table */}
      <Card className="overflow-hidden">
        {/* Table Controls */}
        <div className="px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-4">
            <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
              {(['all', 'vip', 'inactive'] as const).map(status => (
                <button
                  key={status}
                  onClick={() => { setStatusFilter(status); setCurrentPage(1) }}
                  className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${
                    statusFilter === status
                      ? 'bg-white dark:bg-gray-700 shadow-sm text-indigo-600'
                      : 'text-gray-500 dark:text-gray-400'
                  }`}
                >
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </button>
              ))}
            </div>
            <Button variant="ghost" size="sm" leftIcon={<Filter size={14} />}>
              Filters
            </Button>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500 font-medium">Export:</span>
            <Button variant="ghost" size="sm"><FileText size={16} /></Button>
            <Button variant="ghost" size="sm"><Eye size={16} /></Button>
          </div>
        </div>

        {/* Search */}
        <div className="px-6 py-3 border-b border-gray-100 dark:border-gray-700">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <Input
              placeholder="Search customers, invoices..."
              value={search}
              onChange={e => { setSearch(e.target.value); setCurrentPage(1) }}
              className="pl-10"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12"><Spinner size="lg" /></div>
        ) : (
          <>
            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr className="text-xs font-bold uppercase tracking-wider text-gray-500">
                    <th className="px-6 py-4">Customer</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">Contact</th>
                    <th className="px-6 py-4">Last Visit</th>
                    <th className="px-6 py-4 text-right">Total Spent</th>
                    <th className="px-6 py-4"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {paginated.map(customer => {
                    const totalSpent = customerSpending[customer.id] ?? 0
                    const initials = customer.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
                    const colors = ['bg-sky-500', 'bg-indigo-500', 'bg-emerald-500', 'bg-purple-500', 'bg-pink-500', 'bg-amber-500']
                    const colorIndex = Math.abs(customer.id.charCodeAt(0)) % colors.length
                    const isVIP = totalSpent > 5000
                    const hasCredit = customer.creditBalance > 0

                    return (
                      <tr key={customer.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors group">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-full ${colors[colorIndex]} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
                              {initials}
                            </div>
                            <div>
                              <p className="font-bold text-sm text-gray-900 dark:text-gray-100">{customer.name}</p>
                              <p className="text-xs text-gray-400">ID: {customer.id.slice(0, 8).toUpperCase()}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <Badge variant={
                            isVIP ? 'info' :
                            hasCredit ? 'danger' :
                            'default'
                          }>
                            {isVIP ? 'VIP MEMBER' : hasCredit ? 'LOW CREDIT' : 'REGULAR'}
                          </Badge>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{customer.email || '—'}</p>
                          <p className="text-xs text-gray-400">{customer.phone}</p>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {customer.createdAt?.toDate
                            ? getTimeAgo(new Date(customer.createdAt.toDate()))
                            : '—'}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <p className="font-bold text-gray-900 dark:text-gray-100">{formatINR(totalSpent)}</p>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => navigate(`${ROUTES.CUSTOMERS}/${customer.id}`)}
                              className="p-2"
                            >
                              <Eye size={16} />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => openEdit(customer)} className="p-2">
                              <Pencil size={16} />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => handleDelete(customer.id, customer.name)} className="p-2">
                              <Trash2 size={16} className="text-red-500" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {filtered.length > 0 && (
              <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between">
                <p className="text-xs font-medium text-gray-500">
                  Showing <span className="text-gray-900 dark:text-gray-100">{paginated.length > 0 ? (currentPage - 1) * PAGE_SIZE + 1 : 0}-{Math.min(currentPage * PAGE_SIZE, filtered.length)}</span> of <span className="text-gray-900 dark:text-gray-100">{filtered.length}</span> customers
                </p>
                <div className="flex items-center gap-1">
                  <button
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(p => p - 1)}
                    className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400 disabled:opacity-30"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map(page => (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`w-8 h-8 rounded text-xs font-bold ${
                        currentPage === page
                          ? 'bg-[#0a0a2e] text-white'
                          : 'hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300'
                      }`}
                    >
                      {page}
                    </button>
                  ))}
                  <button
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage(p => p + 1)}
                    className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400 disabled:opacity-30"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}

            {!isLoading && filtered.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                <Users size={48} className="mb-4 opacity-30" />
                <p className="text-sm">{search ? 'No customers match your search' : 'No customers yet. Add your first customer!'}</p>
              </div>
            )}
          </>
        )}
      </Card>

      {/* Bottom Section: Retention Insights + Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
        {/* Retention Insights */}
        <Card className="lg:col-span-2 p-8 flex flex-col items-center justify-center min-h-[250px] relative overflow-hidden">
          <div className="text-center relative z-10">
            <div className="mb-4 inline-flex items-center justify-center w-16 h-16 rounded-full bg-indigo-100 dark:bg-indigo-900/30">
              <TrendingUp size={28} className="text-indigo-600" />
            </div>
            <h4 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2">Churn Risk Prediction</h4>
            <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm mx-auto">
              Monitor customer activity patterns to identify at-risk customers before they leave.
            </p>
            <button className="mt-4 text-indigo-600 font-bold text-sm hover:underline">
              View insights
            </button>
          </div>
          <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-indigo-50 dark:bg-indigo-900/10 rounded-full blur-3xl" />
        </Card>

        {/* Recent Activity */}
        <Card className="p-6">
          <h4 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">Recent Activity</h4>
          <div className="space-y-3">
            {recentActivity.length > 0 ? recentActivity.map((tx, i) => (
              <div key={tx.id || i} className="flex gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  tx.type === 'payment'
                    ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600'
                    : 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600'
                }`}>
                  {tx.type === 'payment' ? <CreditCard size={18} /> : <UserPlus size={18} />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-900 dark:text-gray-100 truncate">
                    {tx.type === 'payment' ? 'Payment from' : 'Credit for'} {tx.customerName}
                  </p>
                  <p className="text-xs text-gray-400">{formatINR(tx.amount)}</p>
                  <p className="text-[10px] mt-0.5 text-gray-400">
                    {tx.createdAt?.toDate ? getTimeAgo(new Date(tx.createdAt.toDate())) : 'Recently'}
                  </p>
                </div>
              </div>
            )) : (
              <p className="text-sm text-gray-400 text-center py-8">No recent activity</p>
            )}
          </div>
        </Card>
      </div>

      {/* Customer Form Modal */}
      <Modal
        isOpen={isFormOpen}
        onClose={() => { setIsFormOpen(false); resetForm() }}
        title={editId ? 'Edit Customer' : 'Add Customer'}
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
            label="Customer Name *"
            value={form.name}
            onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
            placeholder="e.g. John Doe"
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
            placeholder="e.g. john@example.com"
          />
          <Input
            label="Address"
            value={form.address}
            onChange={e => setForm(prev => ({ ...prev, address: e.target.value }))}
            placeholder="Full address"
          />
        </div>
      </Modal>
    </div>
  )
}

function getTimeAgo(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMins < 60) return `${diffMins} mins ago`
  if (diffHours < 24) return `${diffHours} hours ago`
  if (diffDays < 7) return `${diffDays} days ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
