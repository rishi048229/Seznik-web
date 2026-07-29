import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card } from '@/components/ui/Card'
import { Spinner } from '@/components/ui/Spinner'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { PageHeader } from '@/components/layout/PageHeader'
import { PageVideoTutorialModal } from '@/components/common/PageVideoTutorialModal'
import { InteractivePageTour } from '@/components/common/InteractivePageTour'
import { usePageTutorial } from '@/hooks/usePageTutorial'
import {
  useDashboardStats,
  useRevenueTrend,
  useTopCustomers,
  usePaymentModeBreakdown,
  useProfitBreakdown,
  useTopProducts,
  useTopCategories,
  useExpenseSummary,
} from '@/hooks/useReports'
import { useProducts } from '@/hooks/useProducts'
import { useSales } from '@/hooks/useSales'
import { useBlePrinter } from '@/hooks/useBlePrinter'
import { getBlePrinterState, getBluetoothUnsupportedReason } from '@/utils/blePrinter'
import { useLanguage } from '@/contexts/LanguageContext'
import { formatINR, formatINRCompact } from '@/utils/currency'
import { ROUTES } from '@/constants/routes'
import toast from 'react-hot-toast'
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
  Bluetooth,
  Compass,
  BluetoothConnected,
  Wallet,
  PieChart as PieChartIcon,
  Tag,
  ExternalLink,
} from 'lucide-react'

const PRINTER_STATUS_LABEL: Record<string, string> = {
  unsupported: 'Not supported in this browser',
  disconnected: 'Not connected',
  connecting: 'Connecting…',
  connected: 'Connected',
  printing: 'Printing…',
}

const PAYMENT_MODE_COLORS: Record<string, string> = {
  cash: '#2563eb',
  upi: '#10b981',
  card: '#f59e0b',
  credit: '#ef4444',
}

const PRODUCT_RANK_COLORS = ['bg-amber-500', 'bg-gray-400', 'bg-amber-700', 'bg-gray-300', 'bg-gray-300']

// Inline-SVG donut chart (no external chart lib). Renders each slice as a stroked
// circle arc via stroke-dasharray, matching the app's hand-rolled SVG chart style.
const DonutChart = ({ data, size = 180, thickness = 20 }: { data: { value: number; color: string }[]; size?: number; thickness?: number }) => {
  const radius = (size - thickness) / 2
  const circumference = 2 * Math.PI * radius
  const total = data.reduce((sum, d) => sum + d.value, 0)
  let offset = 0

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
        {total === 0 ? (
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#e5e7eb" strokeWidth={thickness} />
        ) : (
          data.map((slice, i) => {
            const fraction = slice.value / total
            const dash = fraction * circumference
            const gap = circumference - dash
            const el = (
              <circle
                key={i}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={slice.color}
                strokeWidth={thickness}
                strokeDasharray={`${dash} ${gap}`}
                strokeDashoffset={-offset}
              />
            )
            offset += dash
            return el
          })
        )}
      </g>
    </svg>
  )
}

const WidgetHeader = ({ icon, title, onView }: { icon: React.ReactNode; title: string; onView: () => void }) => (
  <div className="flex items-center justify-between mb-4">
    <h3 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
      {icon}
      {title}
    </h3>
    <button
      onClick={onView}
      className="text-sm font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1"
    >
      <ExternalLink size={14} />
      View
    </button>
  </div>
)

const ProgressRow = ({ left, right, sub, percent, badge }: { left: string; right: string; sub?: string; percent: number; badge?: React.ReactNode }) => (
  <div>
    <div className="flex items-start justify-between gap-2 mb-1">
      <div className="flex items-center gap-2 min-w-0">
        {badge}
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{left}</p>
      </div>
      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 whitespace-nowrap">{right}</p>
    </div>
    {sub && <p className="text-xs text-gray-400 mb-1.5">{sub}</p>}
    <div className="w-full h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden mt-1.5">
      <div className="h-full bg-blue-500 rounded-full" style={{ width: `${Math.min(percent, 100)}%` }} />
    </div>
  </div>
)

export const DashboardPage = () => {
  const pageTutorial = usePageTutorial('dashboard')
  const { isLoading } = useDashboardStats()
  const { data: products } = useProducts()

  const { data: sales } = useSales()
  const navigate = useNavigate()
  const [chartPeriod, setChartPeriod] = useState<'daily' | 'weekly' | 'monthly'>('monthly')
  const printer = useBlePrinter()
  const { t } = useLanguage()
  const [isConnectingPrinter, setIsConnectingPrinter] = useState(false)

  const handleConnectPrinter = async () => {
    setIsConnectingPrinter(true)
    try {
      await printer.connect()
      toast.success(`Connected to ${getBlePrinterState().deviceName ?? 'printer'}`)
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to connect to printer'
      toast.error(msg)
    } finally {
      setIsConnectingPrinter(false)
    }
  }

  // Fetch real revenue trend data
  const daysForPeriod = chartPeriod === 'daily' ? 7 : chartPeriod === 'weekly' ? 28 : 90
  const { data: revenueTrend } = useRevenueTrend(daysForPeriod)

  // Fetch top customers
  const { data: topCustomers } = useTopCustomers(5)

  // Overview widgets data
  const { data: paymentModes, isLoading: loadingPaymentModes } = usePaymentModeBreakdown()
  const { data: profitBreakdown, isLoading: loadingProfitBreakdown } = useProfitBreakdown()
  const { data: topProducts, isLoading: loadingTopProducts } = useTopProducts(5)
  const { data: topCategories, isLoading: loadingTopCategories } = useTopCategories(3)
  const { data: expenseSummary, isLoading: loadingExpenseSummary } = useExpenseSummary()

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

  const profitPieData = profitBreakdown
    ? [
        { name: 'Profit', value: Math.max(profitBreakdown.profit, 0), color: '#10b981' },
        { name: 'Tax', value: Math.max(profitBreakdown.tax, 0), color: '#f59e0b' },
        { name: 'Cost', value: Math.max(profitBreakdown.cost, 0), color: '#2563eb' },
      ]
    : []

  const paymentPieData = (paymentModes?.modes ?? []).map(m => ({
    name: m.method,
    value: m.amount,
    color: PAYMENT_MODE_COLORS[m.method] ?? '#94a3b8',
  }))

  const maxProductRevenue = Math.max(...(topProducts ?? []).map(p => p.revenue), 1)
  const maxCategoryRevenue = Math.max(...(topCategories ?? []).map(c => c.revenue), 1)

  return (
    <div>
      <div data-tour="dashboard-title">
        <PageHeader
          title="Dashboard & Analytics"
          onWatchTutorial={pageTutorial.openTutorial}
          action={
            <Button data-tour="pos-shortcut" size="sm" onClick={() => navigate(ROUTES.POS)} leftIcon={<Compass size={16} />}>
              Open Scan To Bill
            </Button>
          }
        />
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* Total Revenue */}
        <Card data-tour="kpi-revenue" className="p-5 bg-white border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
              <DollarSign size={22} className="text-gray-600 dark:text-gray-300" />
            </div>
            <div className="flex items-center gap-1 text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
              <ArrowUpRight size={14} />
              +12.5%
            </div>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('dashboard.totalRevenue')}</p>
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
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('dashboard.totalSales')}</p>
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
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('dashboard.grossProfit')}</p>
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
          <p className="text-sm text-gray-600 dark:text-gray-300">{t('dashboard.lowStockAlerts')}</p>
          <p className="text-2xl font-bold text-red-600 dark:text-red-400 mt-1">
            {lowStockAlerts}
          </p>
        </Card>
      </div>

      {/* Receipt Printer */}
      <Card data-tour="printer-card" className="p-5 bg-white border border-gray-100 shadow-sm mb-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
              printer.status === 'connected' || printer.status === 'printing'
                ? 'bg-emerald-100 dark:bg-emerald-900/30'
                : 'bg-gray-100 dark:bg-gray-700'
            }`}>
              {printer.status === 'connected' || printer.status === 'printing' ? (
                <BluetoothConnected size={22} className="text-emerald-600 dark:text-emerald-400" />
              ) : (
                <Bluetooth size={22} className="text-gray-500 dark:text-gray-300" />
              )}
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{t('dashboard.receiptPrinter')}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <Badge variant={printer.status === 'connected' || printer.status === 'printing' ? 'success' : 'default'}>
                  {PRINTER_STATUS_LABEL[printer.status]}
                </Badge>
                {printer.deviceName && <span className="text-xs text-gray-400">{printer.deviceName}</span>}
              </div>
            </div>
          </div>

          {printer.isSupported ? (
            printer.status === 'connected' || printer.status === 'printing' ? (
              <Button variant="outline" size="sm" onClick={printer.disconnect}>
                {t('dashboard.disconnect')}
              </Button>
            ) : (
              <Button
                size="sm"
                loading={isConnectingPrinter}
                onClick={handleConnectPrinter}
                leftIcon={<Bluetooth size={14} />}
              >
                {t('dashboard.scanConnect')}
              </Button>
            )
          ) : (
            <p className="text-xs text-gray-500 dark:text-gray-400 max-w-xs text-left sm:text-right mt-1 sm:mt-0 leading-relaxed">
              {getBluetoothUnsupportedReason()}
            </p>
          )}
        </div>
      </Card>

      {/* Overview widgets: Payment Modes + Profit Breakdown */}
      <div data-tour="charts-section" className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        {/* Payment Modes */}
        <Card className="p-6 bg-white border border-gray-100 shadow-sm">
          <WidgetHeader icon={<Wallet size={18} className="text-blue-500" />} title={t('dashboard.paymentModes')} onView={() => navigate(ROUTES.REPORTS_SALES)} />
          {loadingPaymentModes ? (
            <div className="flex justify-center py-10"><Spinner /></div>
          ) : !paymentModes || paymentModes.modes.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-10">No sales yet</p>
          ) : (
            <>
              <div className="relative flex justify-center items-center mb-4" style={{ height: 180 }}>
                <DonutChart data={paymentPieData} />
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{formatINRCompact(paymentModes.totalSales)}</p>
                  <p className="text-xs text-gray-400">Total Sales</p>
                </div>
              </div>
              <div className="space-y-2">
                {paymentModes.modes.map(mode => (
                  <div key={mode.method} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: PAYMENT_MODE_COLORS[mode.method] ?? '#94a3b8' }} />
                      <span className="text-gray-600 dark:text-gray-300 uppercase text-xs font-medium">{mode.method}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-semibold text-gray-900 dark:text-gray-100">{formatINRCompact(mode.amount)}</span>
                      <span className="text-xs text-gray-400 w-8 text-right">{mode.percent}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </Card>

        {/* Profit Breakdown */}
        <Card className="p-6 bg-white border border-gray-100 shadow-sm">
          <WidgetHeader icon={<PieChartIcon size={18} className="text-emerald-500" />} title={t('dashboard.profitBreakdown')} onView={() => navigate(ROUTES.REPORTS_PL)} />
          {loadingProfitBreakdown ? (
            <div className="flex justify-center py-10"><Spinner /></div>
          ) : !profitBreakdown || profitBreakdown.revenue === 0 ? (
            <p className="text-sm text-gray-400 text-center py-10">No sales yet</p>
          ) : (
            <>
              <div className="relative flex justify-center items-center mb-4" style={{ height: 180 }}>
                <DonutChart data={profitPieData} />
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <p className="text-lg font-bold text-emerald-600">{profitBreakdown.marginPercent}%</p>
                  <p className="text-xs text-gray-400">Margin</p>
                </div>
              </div>
              <div className="space-y-2">
                {profitPieData.map(entry => (
                  <div key={entry.name} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                      <span className="text-gray-600 dark:text-gray-300">{entry.name}</span>
                    </div>
                    <span className="font-semibold text-gray-900 dark:text-gray-100">{formatINRCompact(entry.value)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </Card>
      </div>

      {/* Overview widgets: Top Products + Top Categories + Expense Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* Top Products */}
        <Card className="p-6 bg-white border border-gray-100 shadow-sm">
          <WidgetHeader icon={<Package size={18} className="text-amber-500" />} title={t('dashboard.topProducts')} onView={() => navigate(ROUTES.PRODUCTS)} />
          {loadingTopProducts ? (
            <div className="flex justify-center py-10"><Spinner /></div>
          ) : !topProducts || topProducts.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No sales yet</p>
          ) : (
            <div className="space-y-4">
              {topProducts.map((product, index) => (
                <ProgressRow
                  key={product.id}
                  badge={
                    <span className={`w-5 h-5 rounded flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0 ${PRODUCT_RANK_COLORS[index] ?? 'bg-gray-300'}`}>
                      {index + 1}
                    </span>
                  }
                  left={product.name}
                  right={formatINR(product.revenue)}
                  sub={`${product.unitsSold} sold`}
                  percent={(product.revenue / maxProductRevenue) * 100}
                />
              ))}
            </div>
          )}
        </Card>

        {/* Top Categories */}
        <Card className="p-6 bg-white border border-gray-100 shadow-sm">
          <WidgetHeader icon={<Tag size={18} className="text-purple-500" />} title={t('dashboard.topCategories')} onView={() => navigate(ROUTES.CATEGORIES)} />
          {loadingTopCategories ? (
            <div className="flex justify-center py-10"><Spinner /></div>
          ) : !topCategories || topCategories.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No sales yet</p>
          ) : (
            <div className="space-y-4">
              {topCategories.map(category => (
                <ProgressRow
                  key={category.name}
                  left={category.name}
                  right={formatINR(category.revenue)}
                  percent={(category.revenue / maxCategoryRevenue) * 100}
                />
              ))}
            </div>
          )}
        </Card>

        {/* Expense Summary */}
        <Card className="p-6 bg-white border border-gray-100 shadow-sm">
          <WidgetHeader icon={<DollarSign size={18} className="text-red-500" />} title={t('dashboard.expenseSummary')} onView={() => navigate(ROUTES.EXPENSES)} />
          {loadingExpenseSummary ? (
            <div className="flex justify-center py-10"><Spinner /></div>
          ) : !expenseSummary ? (
            <p className="text-sm text-gray-400 text-center py-8">No data yet</p>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-red-50 dark:bg-red-900/20">
                <span className="text-sm text-gray-600 dark:text-gray-300">Today</span>
                <span className="font-bold text-red-600">{formatINR(expenseSummary.today)}</span>
              </div>
              <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-orange-50 dark:bg-orange-900/20">
                <span className="text-sm text-gray-600 dark:text-gray-300">This Month</span>
                <span className="font-bold text-orange-600">{formatINR(expenseSummary.thisMonth)}</span>
              </div>
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-sm text-gray-600 dark:text-gray-300">Collections (non-credit)</span>
                <span className="font-bold text-emerald-600">{formatINR(expenseSummary.collectionsNonCredit)}</span>
              </div>
              <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-blue-50 dark:bg-blue-900/20">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-200">Net (Rev − Exp)</span>
                <span className="font-bold text-blue-600">{formatINR(expenseSummary.net)}</span>
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Revenue Trends Chart */}
        <Card className="lg:col-span-2 p-6 bg-white border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{t('dashboard.revenueTrends')}</h3>
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
                    <stop offset="0%" stopColor="#2563eb" stopOpacity="0.2" />
                    <stop offset="100%" stopColor="#2563eb" stopOpacity="0" />
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
                  stroke="#2563eb"
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
                      <circle cx={x} cy={y} r="3" fill="#2563eb" />
                      <circle cx={x} cy={y} r="5" fill="none" stroke="#2563eb" strokeWidth="2" opacity="0.3" />
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
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{t('dashboard.lowStock')}</h3>
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
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{t('dashboard.recentSales')}</h3>
            <button
              onClick={() => navigate(ROUTES.SALES)}
              className="text-sm font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1"
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
                  const colors = ['bg-sky-500', 'bg-blue-500', 'bg-emerald-500', 'bg-purple-500', 'bg-pink-500']
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
                          {(sale.createdAt as unknown as { toDate?: () => Date })?.toDate ? new Date((sale.createdAt as unknown as { toDate?: () => Date }).toDate!()).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : (sale.createdAt ? new Date(sale.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—')}
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
              {t('dashboard.topCustomers')}
            </h3>
            <button
              onClick={() => navigate(ROUTES.CUSTOMERS)}
              className="text-sm font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              <Users size={14} />
              View All
            </button>
          </div>

          <div className="space-y-4">
            {topCustomers && topCustomers.length > 0 ? topCustomers.map((customer, index) => {
              const avatarColors = ['bg-amber-500', 'bg-blue-500', 'bg-emerald-500', 'bg-purple-500', 'bg-pink-500']
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

      {/* Tutorial Video Modal & Guided Onboarding Tour */}
      <PageVideoTutorialModal
        isOpen={pageTutorial.isTutorialOpen}
        onClose={pageTutorial.closeTutorial}
        tutorial={pageTutorial.tutorialData}
        onStartTour={pageTutorial.startTour}
      />
      <InteractivePageTour
        pageKey="dashboard"
        steps={pageTutorial.tutorialData.tourSteps}
        isOpen={pageTutorial.isTourOpen}
        onClose={pageTutorial.closeTour}
      />
    </div>
  )
}
