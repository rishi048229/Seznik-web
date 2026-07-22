import { useNavigate, useParams } from 'react-router-dom'
import { useCustomers } from '@/hooks/useCustomers'
import { useSales } from '@/hooks/useSales'
import { useCreditTransactions } from '@/hooks/useCustomers'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Spinner } from '@/components/ui/Spinner'
import { ArrowLeft, Mail, Phone, MapPin, CreditCard, TrendingUp, ShoppingCart, Calendar, Wallet, ShoppingBag, PlusCircle } from 'lucide-react'
import { formatINR } from '@/utils/currency'
import { ROUTES } from '@/constants/routes'
import type { Customer } from '@/types/customer.types'

export const CustomerDetailPage = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: customers } = useCustomers()
  const { data: sales } = useSales()
  const { data: transactions } = useCreditTransactions()

  const customer = (customers ?? []).find(c => c.id === id) as Customer | undefined
  const customerSales = sales?.filter(s => s.customerId === id) ?? []
  const customerTransactions = transactions?.filter((t: any) => t.customerId === id) ?? []

  const totalSpent = customerSales.reduce((sum, s) => sum + s.grandTotal, 0)
  const avgOrderValue = customerSales.length > 0 ? totalSpent / customerSales.length : 0
  const createdDate = (customer?.createdAt as any)?.toDate
    ? (customer?.createdAt as any).toDate()
    : new Date(customer?.createdAt || Date.now())
  const accountAge = Math.round((Date.now() - createdDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000) * 10) / 10

  const initials = customer?.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() ?? ''

  if (!customer) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" onClick={() => navigate(ROUTES.CUSTOMERS)} className="p-2">
            <ArrowLeft size={20} />
          </Button>
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Customer Not Found</h2>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate(ROUTES.CUSTOMERS)} className="p-2">
            <ArrowLeft size={20} />
          </Button>
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Customer Detail</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">Viewing record for ID: #{customer.id.slice(0, 8).toUpperCase()}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => navigate(ROUTES.CUSTOMERS)}>
            Edit Profile
          </Button>
          <Button className="bg-[#0a0a2e] hover:bg-[#1a1555]">
            New Sale
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Left Sidebar - Customer Card + Credit Summary */}
        <div className="col-span-12 lg:col-span-4 space-y-6">
          {/* Customer Card */}
          <Card className="p-8 text-center relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 dark:bg-blue-900/20 rounded-full -mr-16 -mt-16 blur-3xl" />
            <div className="relative z-10">
              <div className="relative inline-block mb-4">
                <div className="w-24 h-24 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 text-2xl font-bold mx-auto">
                  {initials}
                </div>
                <span className="absolute bottom-1 right-1 w-5 h-5 bg-green-500 border-4 border-white dark:border-gray-800 rounded-full" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">{customer.name}</h3>
              <p className="text-sm font-medium text-blue-600">
                {customer.creditBalance > 1000 ? 'VIP Member' : 'Regular Customer'}
              </p>
            </div>

            <div className="mt-8 space-y-4 pt-6 border-t border-gray-100 dark:border-gray-700 text-left">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-500">
                  <Mail size={18} />
                </div>
                <div>
                  <p className="text-xs text-gray-400 font-medium">Email Address</p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{customer.email || '—'}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-500">
                  <Phone size={18} />
                </div>
                <div>
                  <p className="text-xs text-gray-400 font-medium">Phone Number</p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{customer.phone}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-500">
                  <MapPin size={18} />
                </div>
                <div>
                  <p className="text-xs text-gray-400 font-medium">Address</p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{customer.address || '—'}</p>
                </div>
              </div>
            </div>
          </Card>

          {/* Credit Summary Card */}
          <Card className="p-8 bg-gradient-to-br from-blue-800 to-sky-600 text-white relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-800/20 to-transparent" />
            <div className="relative z-10">
              <div className="flex justify-between items-start mb-6">
                <CreditCard size={28} />
                <span className="px-3 py-1 rounded-full bg-white/20 text-xs font-bold backdrop-blur-md">
                  ACTIVE LIMIT
                </span>
              </div>
              <p className="text-sm opacity-80 font-medium">Current Credit Balance</p>
              <h4 className="text-3xl font-extrabold mt-1">{formatINR(customer.creditBalance)}</h4>
              <div className="mt-6 w-full bg-white/20 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-white h-full rounded-full"
                  style={{ width: `${Math.min((customer.creditBalance / (customer.creditLimit || 10000)) * 100, 100)}%` }}
                />
              </div>
              <div className="flex justify-between mt-3 text-xs font-medium">
                <span>Used: {formatINR(customer.creditBalance)}</span>
                <span>Limit: {formatINR(customer.creditLimit || 10000)}</span>
              </div>
            </div>
          </Card>
        </div>

        {/* Right Side - Purchase History + Credit History */}
        <div className="col-span-12 lg:col-span-8 space-y-6">
          {/* Recent Purchases */}
          <Card className="overflow-hidden">
            <div className="px-8 py-6 flex justify-between items-center border-b border-gray-100 dark:border-gray-700">
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">Recent Purchases</h3>
              <button
                onClick={() => navigate(ROUTES.SALES)}
                className="text-sm font-semibold text-blue-600 hover:underline"
              >
                View All
              </button>
            </div>
            {customerSales.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-800">
                    <tr className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                      <th className="px-8 py-4">Transaction ID</th>
                      <th className="px-8 py-4">Items</th>
                      <th className="px-8 py-4">Date</th>
                      <th className="px-8 py-4 text-right">Amount</th>
                      <th className="px-8 py-4 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {customerSales.slice(0, 5).map(sale => (
                      <tr key={sale.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                        <td className="px-8 py-4 font-mono font-medium text-blue-600">
                          #{sale.invoiceNumber}
                        </td>
                        <td className="px-8 py-4">
                          <div className="flex items-center -space-x-2">
                            {sale.items?.slice(0, 2).map((item, i) => (
                              <div key={i} className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-600 border-2 border-white dark:border-gray-800 flex items-center justify-center text-[10px] font-bold">
                                {item.productName.split(' ').map(n => n[0]).join('').slice(0, 2)}
                              </div>
                            ))}
                            {sale.items && sale.items.length > 2 && (
                              <div className="w-8 h-8 rounded-full bg-blue-600 border-2 border-white dark:border-gray-800 flex items-center justify-center text-[10px] font-bold text-white">
                                +{sale.items.length - 2}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-8 py-4 text-gray-500">
                          {sale.createdAt
                            ? new Date((sale.createdAt as any)?.toDate ? (sale.createdAt as any).toDate() : sale.createdAt).toLocaleDateString('en-US', {
                                month: 'short', day: 'numeric', year: 'numeric',
                              })
                            : '—'}
                        </td>
                        <td className="px-8 py-4 font-bold text-right text-gray-900 dark:text-gray-100">
                          {formatINR(sale.grandTotal)}
                        </td>
                        <td className="px-8 py-4 text-center">
                          <Badge variant="success">COMPLETED</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="px-8 py-12 text-center text-gray-400">
                <ShoppingCart size={40} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm">No purchases yet</p>
              </div>
            )}
          </Card>

          {/* Credit History */}
          <Card className="overflow-hidden">
            <div className="px-8 py-6 border-b border-gray-100 dark:border-gray-700">
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">Credit History</h3>
            </div>
            <div className="p-8 space-y-4">
              {customerTransactions.length > 0 ? customerTransactions.map((tx: any) => (
                <div
                  key={tx.id}
                  className={`flex items-center justify-between p-5 rounded-xl transition-all border-l-4 border-transparent hover:border-blue-500 ${
                    tx.type === 'payment'
                      ? 'bg-emerald-50 dark:bg-emerald-900/10'
                      : 'bg-red-50 dark:bg-red-900/10'
                  }`}
                >
                  <div className="flex items-center gap-5">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                      tx.type === 'payment'
                        ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600'
                        : 'bg-red-100 dark:bg-red-900/30 text-red-600'
                    }`}>
                      {tx.type === 'payment' ? <PlusCircle size={22} /> : <ShoppingBag size={22} />}
                    </div>
                    <div>
                      <p className="font-bold text-gray-900 dark:text-gray-100">
                        {tx.type === 'payment' ? 'Payment Received' : 'Credit Purchase'}
                      </p>
                      <p className="text-xs text-gray-400">
                        {tx.notes || `Transaction #${tx.id?.slice(0, 8)}`}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-extrabold ${
                      tx.type === 'payment' ? 'text-emerald-600' : 'text-red-600'
                    }`}>
                      {tx.type === 'payment' ? '+' : '-'}{formatINR(tx.amount)}
                    </p>
                    <p className="text-[10px] font-bold text-gray-400 uppercase">
                      {tx.createdAt?.toDate
                        ? new Date(tx.createdAt.toDate()).toLocaleDateString('en-US', {
                            month: 'short', day: 'numeric', year: 'numeric',
                          })
                        : '—'}
                    </p>
                  </div>
                </div>
              )) : (
                <div className="text-center py-8 text-gray-400">
                  <CreditCard size={40} className="mx-auto mb-3 opacity-30" />
                  <p className="text-sm">No credit transactions</p>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Bottom Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-6 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600">
            <TrendingUp size={24} />
          </div>
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Avg. Order Value</p>
            <h5 className="text-xl font-bold text-gray-900 dark:text-gray-100">{formatINR(avgOrderValue)}</h5>
          </div>
        </Card>
        <Card className="p-6 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-sky-100 dark:bg-sky-900/30 flex items-center justify-center text-sky-600">
            <Wallet size={24} />
          </div>
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Total Orders</p>
            <h5 className="text-xl font-bold text-gray-900 dark:text-gray-100">{customerSales.length}</h5>
          </div>
        </Card>
        <Card className="p-6 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-600">
            <Calendar size={24} />
          </div>
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Account Age</p>
            <h5 className="text-xl font-bold text-gray-900 dark:text-gray-100">{accountAge} Years</h5>
          </div>
        </Card>
      </div>
    </div>
  )
}
