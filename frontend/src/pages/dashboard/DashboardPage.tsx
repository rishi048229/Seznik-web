import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card } from '@/components/ui/Card'
import { Spinner } from '@/components/ui/Spinner'
import { Badge } from '@/components/ui/Badge'
import { useDashboardStats, useRevenueTrend, useTopCustomers } from '@/hooks/useReports'
import { useProducts } from '@/hooks/useProducts'
import { useSales } from '@/hooks/useSales'
import { formatINR } from '@/utils/currency'
import { ROUTES } from '@/constants/routes'
import {
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  AlertTriangle,
  DollarSign,
  ShoppingBag,
  Package,
  CreditCard,
  Users,
  Crown,
} from 'lucide-react'

export const DashboardPage = () => {
  const { data: stats, isLoading } = useDashboardStats()
  const { data: products } = useProducts()
  const { data: sales } = useSales()
  const navigate = useNavigate()
  const [chartPeriod, setChartPeriod] = useState<'daily' | 'weekly' | 'monthly'>('monthly')

  // Fetch real revenue trend data
  const daysForPeriod = chartPeriod === 'daily' ? 7 : chartPeriod === 'weekly' ? 28 : 90
  const { data: revenueTrend } = useRevenueTrend(daysForPeriod)

  // Fetch top customers
  const { data: topCustomers } = useTopCustomers(5)

  // Calculate actual gross profit from sales
  const grossProfit = useMemo(() => {
    if (!sales || sales.length === 0) return 0
    return sales.reduce((profit, sale) => profit + sale.grandTotal - sale.totalTax, 0)
  }, [sales])

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="lg" />
      </div>
    )
  }

  const lowStockProducts = products?.filter(p => p.currentStock <= p.lowStockThreshold).slice(0, 5) ?? []
  const recentSales = sales?.slice(0, 5) ?? []

  const totalRevenue = sales?.reduce((sum, s) => sum + s.grandTotal, 0) ?? 0
  const totalSales = sales?.length ?? 0
  const lowStockAlerts = lowStockProducts.length

  // Use real revenue data from the trend, or fallback to empty
  const chartData = revenueTrend?.revenue ?? []
  const chartLabels = revenueTrend?.labels ?? []
  const maxRevenue = chartData.length > 0 ? Math.max(...chartData, 1) : 1

  return (
    <div>
      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* Total Revenue */}
        <Card className="p-5 bg-white border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
              <DollarSign size={22} className="text-gray-600 dark:text-gray-300" />
            </div>
            <div className="flex items-center gap-1 text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
              <ArrowUpRight size={14} />
              +12.5%
            </div>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">Total Revenue</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
            {formatINR(totalRevenue)}
          </p>
        </Card>

        {/* Total Sales */}
        <Card className="p-5 bg-white border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
              <ShoppingBag size={22} className="text-gray-600 dark:text-gray-300" />
            </div>
            <div className="flex items-center gap-1 text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
              <ArrowUpRight size={14} />
              +8.2%
            </div>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">Total Sales</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
            {totalSales.toLocaleString()}
          </p>
        </Card>

        {/* Gross Profit */}
        <Card className="p-5 bg-white border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="w-12 h-12 rounded-xl bg-sky-100 dark:bg-sky-900/30 flex items-center justify-center">
              <CreditCard size={22} className="text-sky-600 dark:text-sky-400" />
            </div>
            <div className="flex items-center gap-1 text-xs font-medium text-red-600 bg-red-50 px-2 py-1 rounded-full">
              <ArrowDownRight size={14} />
              -2.4%
            </div>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">Gross Profit</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
            {formatINR(grossProfit)}
          </p>
        </Card>

        {/* Low Stock Alerts */}
        <Card className="p-5 bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-900/20 dark:to-orange-900/20 border border-red-100 dark:border-red-800">
          <div className="flex items-center justify-between mb-3">
            <div className="w-12 h-12 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
              <AlertTriangle size={22} className="text-red-600 dark:text-red-400" />
            </div>
            <button
              onClick={() => navigate(ROUTES.PRODUCTS)}
              className="text-xs font-medium text-red-600 hover:underline"
            >
              View Items
            </button>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-300">Low Stock Alerts</p>
          <p className="text-2xl font-bold text-red-600 dark:text-red-400 mt-1">
            {lowStockAlerts}
          </p>
        </Card>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Revenue Trends Chart */}
        <Card className="lg:col-span-2 p-6 bg-white border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Revenue Trends</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">Monthly overview of store performance</p>
            </div>
            <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
              {(['daily', 'weekly', 'monthly'] as const).map(period => (
                <button
                  key={period}
                  onClick={() => setChartPeriod(period)}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                    chartPeriod === period
                      ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow-sm'
                      : 'text-gray-500 dark:text-gray-400'
                  }`}
                >
                  {period.charAt(0).toUpperCase() + period.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Simple SVG Line Chart */}
          <div className="relative h-48">
            {chartData.length > 0 && chartData.some(v => v > 0) ? (
              <svg viewBox="0 0 600 200" className="w-full h-full">
                {/* Grid lines */}
                {[0, 1, 2, 3, 4].map(i => (
                  <line
                    key={i}
                    x1="0"
                    y1={i * 50}
                    x2="600"
                    y2={i * 50}
                    stroke="#e5e7eb"
                    strokeWidth="1"
                    strokeDasharray="4 4"
                  />
                ))}
                {/* Area fill */}
                <defs>
                  <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#4f46e5" stopOpacity="0.2" />
                    <stop offset="100%" stopColor="#4f46e5" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path
                  d={`${chartData.map((v, i) => {
                    const x = chartData.length > 1 ? (i / (chartData.length - 1)) * 600 : 300
                    const y = maxRevenue > 0 ? 200 - (v / maxRevenue) * 180 : 200
                    return `${i === 0 ? 'M' : 'L'}${x},${y}`
                  }).join(' ')}L${chartData.length > 1 ? 600 : 300},200L0,200Z`}
                  fill="url(#areaGrad)"
                />
                {/* Line */}
                <path
                  d={chartData.map((v, i) => {
                    const x = chartData.length > 1 ? (i / (chartData.length - 1)) * 600 : 300
                    const y = maxRevenue > 0 ? 200 - (v / maxRevenue) * 180 : 200
                    return `${i === 0 ? 'M' : 'L'}${x},${y}`
                  }).join(' ')}
                  fill="none"
                  stroke="#4f46e5"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {/* Dots — only show when ≤ 15 data points to avoid clutter */}
                {chartData.length <= 15 && chartData.map((v, i) => {
                  const x = chartData.length > 1 ? (i / (chartData.length - 1)) * 600 : 300
                  const y = maxRevenue > 0 ? 200 - (v / maxRevenue) * 180 : 200
                  return (
                    <g key={i}>
                      <circle cx={x} cy={y} r="3" fill="#4f46e5" />
                      <circle cx={x} cy={y} r="5" fill="none" stroke="#4f46e5" strokeWidth="2" opacity="0.3" />
                    </g>
                  )
                })}
              </svg>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400">
                <div className="text-center">
                  <TrendingUp size={32} className="mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No revenue data yet</p>
                  <p className="text-xs mt-1">Complete some sales to see trends</p>
                </div>
              </div>
            )}
            {/* X-axis labels — show every Nth label to avoid overlap */}
            <div className="flex justify-between mt-2 overflow-hidden">
              {chartLabels.length > 0 ? (() => {
                const step = Math.max(1, Math.floor(chartLabels.length / 8))
                return chartLabels.map((label, i) => (
                  <span
                    key={i}
                    className={`text-[10px] text-gray-400 ${i % step !== 0 ? 'invisible' : ''}`}
                    style={{ minWidth: 0 }}
                  >
                    {label}
                  </span>
                ))
              })() : (
                <span className="text-[10px] text-gray-400 w-full text-center">No data</span>
              )}
            </div>
          </div>
        </Card>

        {/* Low Stock Panel */}
        <Card className="p-6 bg-white border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Low Stock</h3>
            <Badge variant="danger">{lowStockAlerts} ALERTS</Badge>
          </div>

          <div className="space-y-4">
            {lowStockProducts.length > 0 ? lowStockProducts.map(product => (
              <div key={product.id} className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center overflow-hidden flex-shrink-0">
                  {product.imageURL ? (
                    <img src={product.imageURL} alt={product.name} className="w-full h-full object-cover" />
                  ) : (
                    <Package size={20} className="text-gray-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{product.name}</p>
                  <p className="text-xs text-gray-400">SKU: {product.sku}</p>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-semibold ${
                    product.currentStock <= 0 ? 'text-red-600' : product.currentStock <= product.lowStockThreshold ? 'text-amber-600' : 'text-emerald-600'
                  }`}>
                    {product.currentStock} Left
                  </p>
                  <div className="w-20 h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full mt-1">
                    <div
                      className={`h-full rounded-full ${
                        product.currentStock <= 0 ? 'bg-red-500' : product.currentStock <= product.lowStockThreshold ? 'bg-amber-500' : 'bg-emerald-500'
                      }`}
                      style={{ width: `${Math.min((product.currentStock / product.lowStockThreshold) * 100, 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            )) : (
              <p className="text-sm text-gray-400 text-center py-8">All stock levels are healthy</p>
            )}
          </div>

          {lowStockAlerts > 0 && (
            <button
              onClick={() => navigate(ROUTES.PRODUCTS)}
              className="w-full mt-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              Restock All
            </button>
          )}
        </Card>
      </div>

      {/* Recent Sales + Store Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Sales */}
        <Card className="lg:col-span-2 p-6 bg-white border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Recent Sales</h3>
            <button
              onClick={() => navigate(ROUTES.SALES)}
              className="text-sm font-medium text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
            >
              View History
              <TrendingUp size={14} />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  <th className="pb-3">Customer / Transaction</th>
                  <th className="pb-3">Date</th>
                  <th className="pb-3">Total</th>
                  <th className="pb-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                {recentSales.length > 0 ? recentSales.map(sale => {
                  const customerName = sale.customerId ? 'Customer' : 'Walk-in Customer'
                  const initials = customerName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
                  const colors = ['bg-sky-500', 'bg-indigo-500', 'bg-emerald-500', 'bg-purple-500', 'bg-pink-500']
                  const colorIndex = Math.abs(sale.grandTotal * 100) % colors.length
                  return (
                    <tr key={sale.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-full ${colors[colorIndex]} flex items-center justify-center text-white text-xs font-medium flex-shrink-0`}>
                            {initials}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{customerName}</p>
                            <p className="text-xs text-gray-400">{sale.invoiceNumber}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 pr-4">
                        <p className="text-sm text-gray-600 dark:text-gray-300">
                          {sale.createdAt?.toDate ? new Date(sale.createdAt.toDate()).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                        </p>
                      </td>
                      <td className="py-3 pr-4">
                        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{formatINR(sale.grandTotal)}</p>
                      </td>
                      <td className="py-3">
                        <Badge variant="success">PAID</Badge>
                      </td>
                    </tr>
                  )
                }) : (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-sm text-gray-400">No sales yet</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Top Customers */}
        <Card className="p-6 bg-white border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <Crown size={18} className="text-amber-500" />
              Top Customers
            </h3>
            <button
              onClick={() => navigate(ROUTES.CUSTOMERS)}
              className="text-sm font-medium text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
            >
              <Users size={14} />
              View All
            </button>
          </div>

          <div className="space-y-4">
            {topCustomers && topCustomers.length > 0 ? topCustomers.map((customer, index) => {
              const avatarColors = ['bg-amber-500', 'bg-indigo-500', 'bg-emerald-500', 'bg-purple-500', 'bg-pink-500']
              const initials = customer.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
              return (
                <div key={customer.id} className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full ${avatarColors[index % avatarColors.length]} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
                    {initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{customer.name}</p>
                    <p className="text-xs text-gray-400">{customer.invoiceCount} invoices</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{formatINR(customer.totalSpent)}</p>
                    <p className="text-[10px] text-gray-400">
                      {customer.lastPurchase ? new Date(customer.lastPurchase).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : '—'}
                    </p>
                  </div>
                </div>
              )
            }) : (
              <p className="text-sm text-gray-400 text-center py-8">No customer data yet</p>
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}
