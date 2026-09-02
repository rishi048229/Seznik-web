import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Crown, Package, TrendingUp, Users } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Spinner } from '@/components/ui/Spinner'
import { useSales } from '@/hooks/useSales'
import { useTopCustomers, useTopProducts } from '@/hooks/useReports'
import { ROUTES } from '@/constants/routes'
import { formatINR } from '@/utils/currency'

const startOfToday = () => {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

const saleDate = (value: Date | string | undefined) => {
  if (!value) return null
  const d = value instanceof Date ? value : new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

/** Today's customers + best-selling items when the KOT floor has nothing open yet. */
export const KotInsightsPanel = () => {
  const navigate = useNavigate()
  const { data: sales, isLoading: loadingSales } = useSales()
  const { data: topProducts, isLoading: loadingProducts } = useTopProducts(5)
  const { data: topCustomers, isLoading: loadingCustomers } = useTopCustomers(5)

  const today = useMemo(() => {
    const from = startOfToday()
    const todays = (sales ?? []).filter((sale) => {
      const d = saleDate(sale.createdAt)
      return d ? d >= from : false
    })
    const named = new Set(todays.filter((s) => s.customerId).map((s) => s.customerId as string))
    const walkIns = todays.filter((s) => !s.customerId).length
    return {
      bills: todays.length,
      customers: named.size + walkIns,
      revenue: todays.reduce((sum, s) => sum + (s.grandTotal || 0), 0),
    }
  }, [sales])

  const bestSeller = topProducts?.[0]
  const loading = loadingSales || loadingProducts || loadingCustomers

  return (
    <section className="mb-5">
      <div className="flex items-end justify-between gap-2 mb-3">
        <div>
          <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">Today at a glance</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">Useful while the floor is quiet.</p>
        </div>
        <button
          type="button"
          onClick={() => navigate(ROUTES.REPORTS_SALES)}
          className="text-xs font-semibold text-blue-600 hover:text-blue-700"
        >
          Full report
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Card className="p-4 bg-white border border-gray-100 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-8 h-8 rounded-lg bg-sky-50 dark:bg-sky-900/30 text-sky-600 flex items-center justify-center">
                <Users size={16} />
              </span>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Today’s customers</h3>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{today.customers}</p>
            <p className="text-xs text-gray-500 mt-1">
              {today.bills} bill{today.bills === 1 ? '' : 's'} · {formatINR(today.revenue)}
            </p>
          </Card>

          <Card className="p-4 bg-white border border-gray-100 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-900/30 text-amber-600 flex items-center justify-center">
                <TrendingUp size={16} />
              </span>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Selling the most</h3>
            </div>
            {bestSeller ? (
              <>
                <p className="text-base font-bold text-gray-900 dark:text-gray-100 truncate">{bestSeller.name}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {bestSeller.unitsSold} sold · {formatINR(bestSeller.revenue)}
                </p>
              </>
            ) : (
              <p className="text-sm text-gray-400">No sales yet — this fills in after the first bill.</p>
            )}
          </Card>

          <Card className="p-4 bg-white border border-gray-100 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 flex items-center justify-center">
                <Package size={16} />
              </span>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Product-wise</h3>
            </div>
            {topProducts && topProducts.length > 0 ? (
              <ul className="space-y-2">
                {topProducts.map((product, i) => (
                  <li key={product.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="truncate text-gray-700 dark:text-gray-200">
                      {i + 1}. {product.name}
                    </span>
                    <span className="shrink-0 font-semibold text-gray-900 dark:text-gray-100">{formatINR(product.revenue)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-400">Product ranking appears after items are billed.</p>
            )}
          </Card>
        </div>
      )}

      {topCustomers && topCustomers.length > 0 && (
        <Card className="mt-3 p-4 bg-white border border-gray-100 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <Crown size={16} className="text-amber-500" />
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Regulars</h3>
          </div>
          <div className="flex gap-3 overflow-x-auto no-scrollbar">
            {topCustomers.map((customer) => (
              <div key={customer.id} className="min-w-[140px] rounded-xl bg-gray-50 dark:bg-gray-800 px-3 py-2">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{customer.name}</p>
                <p className="text-xs text-gray-500">{formatINR(customer.totalSpent)}</p>
              </div>
            ))}
          </div>
        </Card>
      )}
    </section>
  )
}
