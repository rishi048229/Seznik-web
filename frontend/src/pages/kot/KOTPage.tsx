import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { toastError } from '@/utils/userMessage'
import {
  ChefHat,
  Check,
  Clock,
  CreditCard,
  LayoutGrid,
  ListOrdered,
  MoreVertical,
  Plus,
  Receipt,
  Search,
  Store,
  Truck,
  Utensils,
  UtensilsCrossed,
  ShoppingBag,
} from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Input } from '@/components/ui/Input'
import { Spinner } from '@/components/ui/Spinner'
import { DropdownMenu, DropdownMenuItem } from '@/components/ui/DropdownMenu'
import { ROUTES } from '@/constants/routes'
import { useRestaurantTables } from '@/hooks/useRestaurantTables'
import { useKotOrders } from '@/hooks/useKotOrders'
import { RUNNING_STATUS_QUERY } from '@/services/kotOrderService'
import { useSettings, useUpdateSettings, useCreateSettings } from '@/hooks/useSettings'
import { useLanguage } from '@/contexts/LanguageContext'
import { formatINR } from '@/utils/currency'
import { FloorStatsBar } from './components/FloorStatsBar'
import { TableCard } from './components/TableCard'
import { TableManageModal } from './components/TableManageModal'
import { mergeKotConfig, orderTypeLabel, tableNounLabel, VENUE_PRESETS } from './kotConfig'
import { venueIcon } from './components/VenueTypePicker'
import { formatElapsed, ticketLaneLabel } from './kotUtils'
import type { KOTOrder, KOTOrderType, RestaurantTable } from '@/types/kot.types'
import type { KOTSettingsTab } from './components/KOTSettingsModal'

const KOTWorkspace = lazy(() =>
  import('./components/KOTWorkspace').then((m) => ({ default: m.KOTWorkspace }))
)
const KOTSettingsModal = lazy(() =>
  import('./components/KOTSettingsModal').then((m) => ({ default: m.KOTSettingsModal }))
)
const KotInsightsPanel = lazy(() =>
  import('./components/KotInsightsPanel').then((m) => ({ default: m.KotInsightsPanel }))
)

type WorkspaceTarget =
  | { kind: 'table'; table: RestaurantTable }
  | { kind: 'walkin'; orderId?: string | null; orderType?: KOTOrderType }

type PageView = 'floor' | 'orders'
type StatusChip = 'active' | 'ready' | 'served' | 'history'

const TYPE_FILTERS: Array<{ id: KOTOrderType | 'all'; label: string; icon: typeof Utensils }> = [
  { id: 'all', label: 'All', icon: ListOrdered },
  { id: 'dine_in', label: 'Dine-In', icon: Utensils },
  { id: 'takeaway', label: 'Takeaway', icon: ShoppingBag },
  { id: 'delivery', label: 'Delivery', icon: Truck },
]

const STATUS_CHIPS: Array<{ id: StatusChip; label: string }> = [
  { id: 'active', label: 'Active' },
  { id: 'ready', label: 'Ready' },
  { id: 'served', label: 'Served' },
  { id: 'history', label: 'History' },
]

const statusQueryForChip = (chip: StatusChip): string => {
  if (chip === 'active') return RUNNING_STATUS_QUERY
  if (chip === 'ready') return 'ready'
  if (chip === 'served') return 'served'
  return 'billed,cancelled'
}

export const KOTPage = () => {
  const { t } = useLanguage()
  const [searchParams, setSearchParams] = useSearchParams()
  const { data: settings } = useSettings()
  const { mutate: updateSettings } = useUpdateSettings()
  const { mutate: createSettings } = useCreateSettings()
  const kotCfg = mergeKotConfig(settings?.kotConfig)
  const venue = VENUE_PRESETS[kotCfg.venueType]
  const VenueIcon = venueIcon(kotCfg.venueType)
  const floorLabel = tableNounLabel(kotCfg.tableNoun)
  const floorSingular = tableNounLabel(kotCfg.tableNoun, false).toLowerCase()
  const { data: tables = [], isLoading } = useRestaurantTables({
    refetchInterval: 10000,
  })
  const [pageView, setPageView] = useState<PageView>('floor')
  const [orderTypeFilter, setOrderTypeFilter] = useState<KOTOrderType | 'all'>('all')
  const [statusChip, setStatusChip] = useState<StatusChip>('active')
  const [orderSearch, setOrderSearch] = useState('')

  const boardStatusQuery = statusQueryForChip(statusChip)
  const { data: boardOrders = [], isLoading: boardLoading } = useKotOrders({
    status: boardStatusQuery,
    refetchInterval: 10000,
    staleTime: 10_000,
    enabled: pageView === 'orders',
  })
  const { data: runningOrders = [] } = useKotOrders({
    status: 'running',
    refetchInterval: 10000,
    staleTime: 10_000,
  })

  const [manageOpen, setManageOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsTab, setSettingsTab] = useState<KOTSettingsTab>('business')
  const [workspace, setWorkspace] = useState<WorkspaceTarget | null>(null)

  // Chrome "New Bill" lands on /kot?new=1 — open workspace immediately
  useEffect(() => {
    if (searchParams.get('new') !== '1') return
    setWorkspace({ kind: 'walkin', orderType: kotCfg.defaultOrderType })
    const next = new URLSearchParams(searchParams)
    next.delete('new')
    setSearchParams(next, { replace: true })
  }, [searchParams, setSearchParams, kotCfg.defaultOrderType])

  const walkIns = useMemo(
    () => runningOrders.filter((order) => !order.tableId),
    [runningOrders]
  )

  const busyTables = useMemo(
    () => tables.filter((tb) => tb.isOccupied && tb.activeOrder),
    [tables]
  )

  const filteredBoardOrders = useMemo(() => {
    const q = orderSearch.trim().toLowerCase()
    return boardOrders.filter((order) => {
      const matchesType = orderTypeFilter === 'all' || order.orderType === orderTypeFilter
      const hay = [
        String(order.orderNumber),
        order.partyLabel || '',
        order.table?.name || '',
        order.waiterName || '',
        order.customer?.name || '',
      ]
        .join(' ')
        .toLowerCase()
      const matchesSearch = !q || hay.includes(q)
      return matchesType && matchesSearch
    })
  }, [boardOrders, orderTypeFilter, orderSearch])

  const stats = useMemo(() => {
    const occupied = tables.filter((tb) => tb.isOccupied).length
    const tableRevenue = tables.reduce((sum, tb) => sum + (tb.activeOrder?.totalAmount ?? 0), 0)
    const walkInRevenue = walkIns.reduce((sum, order) => sum + (order.grandTotal ?? 0), 0)
    return {
      total: tables.length,
      occupied,
      vacant: tables.length - occupied,
      revenue: tableRevenue + walkInRevenue,
    }
  }, [tables, walkIns])

  const openSettings = (tab: KOTSettingsTab) => {
    setSettingsTab(tab)
    setSettingsOpen(true)
  }

  const openNewBill = () => {
    setWorkspace({ kind: 'walkin', orderType: kotCfg.defaultOrderType })
  }

  const openOrder = (order: KOTOrder) => {
    if (order.tableId) {
      const table = tables.find((tb) => tb.id === order.tableId)
      if (table) {
        setWorkspace({ kind: 'table', table })
        return
      }
    }
    setWorkspace({
      kind: 'walkin',
      orderId: order.id,
      orderType: (order.orderType as KOTOrderType) || 'takeaway',
    })
  }

  const toggleKitchenTickets = () => {
    const next = !kotCfg.kitchenTicketsEnabled
    const data = { kotConfig: { ...kotCfg, kitchenTicketsEnabled: next } }
    const onSuccess = () =>
      toast.success(next ? 'Kitchen tickets turned on' : 'Kitchen tickets turned off — bills only')
    const onError = (err: unknown) => toastError(err, 'Could not update kitchen tickets')
    if (settings?.id) {
      updateSettings({ settingsId: settings.id, data }, { onSuccess, onError })
      return
    }
    createSettings(data as Parameters<typeof createSettings>[0], { onSuccess, onError })
  }

  const activeTable =
    workspace?.kind === 'table'
      ? tables.find((tb) => tb.id === workspace.table.id) ?? workspace.table
      : null

  const showFloor = !workspace && pageView === 'floor'
  const showOrders = !workspace && pageView === 'orders'
  const showInsights = showFloor

  return (
    <div className="pb-4">
      <PageHeader
        title={t('nav.kot')}
        breadcrumb={[t('nav.kot')]}
        action={
          <>
            <Button leftIcon={<CreditCard size={16} />} onClick={openNewBill}>
              New Bill
            </Button>
            {kotCfg.kitchenTicketsEnabled && (
              <Link to={ROUTES.KOT_KDS}>
                <Button variant="outline" leftIcon={<ChefHat size={16} />}>
                  Kitchen
                </Button>
              </Link>
            )}
            {kotCfg.showTables && (
              <Button variant="outline" leftIcon={<LayoutGrid size={16} />} onClick={() => setManageOpen(true)}>
                {floorLabel}
              </Button>
            )}
            <button
              type="button"
              onClick={() => openSettings('kot')}
              title={venue.hint}
              className="inline-flex items-center gap-1.5 h-9 px-2.5 rounded-lg text-xs font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-800 dark:hover:text-gray-200 transition-colors duration-150"
            >
              <VenueIcon size={15} strokeWidth={1.75} />
              {venue.label}
            </button>
            <DropdownMenu
              trigger={
                <Button type="button" variant="outline" className="px-2.5" aria-label="Restaurant settings">
                  <MoreVertical size={16} />
                </Button>
              }
            >
              <DropdownMenuItem onClick={() => openSettings('business')}>
                <Store size={14} />
                Business profile
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => openSettings('bill')}>
                <Receipt size={14} />
                Customer bill
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => openSettings('kot')}>
                <UtensilsCrossed size={14} />
                Kitchen / store type
              </DropdownMenuItem>
              <DropdownMenuItem onClick={toggleKitchenTickets}>
                {kotCfg.kitchenTicketsEnabled ? <Check size={14} /> : <ChefHat size={14} />}
                {kotCfg.kitchenTicketsEnabled ? 'Kitchen tickets on' : 'Kitchen tickets off'}
              </DropdownMenuItem>
              {/* Multi-store implementation temporarily hidden
              <DropdownMenuItem onClick={() => openSettings('stores')}>
                <LayoutGrid size={14} />
                Franchises / stores
              </DropdownMenuItem> */}
            </DropdownMenu>
          </>
        }
      />

      {!workspace && (
        <div className="mb-4 inline-flex rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-1">
          <button
            type="button"
            onClick={() => setPageView('floor')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
              pageView === 'floor'
                ? 'bg-[#0a0a2e] text-white dark:bg-zinc-100 dark:text-zinc-900'
                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
            }`}
          >
            <LayoutGrid size={15} />
            Floor
          </button>
          <button
            type="button"
            onClick={() => setPageView('orders')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
              pageView === 'orders'
                ? 'bg-[#0a0a2e] text-white dark:bg-zinc-100 dark:text-zinc-900'
                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
            }`}
          >
            <ListOrdered size={15} />
            Orders
          </button>
        </div>
      )}

      {showFloor && (
        <FloorStatsBar
          total={stats.total}
          occupied={stats.occupied}
          vacant={stats.vacant}
          revenue={stats.revenue}
          tableLabel={floorLabel}
          showFloor={kotCfg.showTables}
          openCount={walkIns.length}
        />
      )}

      {showOrders && (
        <section className="space-y-4">
          {busyTables.length > 0 && (
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
              {busyTables.map((tb) => (
                <button
                  key={tb.id}
                  type="button"
                  onClick={() => setWorkspace({ kind: 'table', table: tb })}
                  className="shrink-0 rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/30 px-3 py-2 text-left min-w-[140px]"
                >
                  <p className="text-xs font-bold text-rose-700 dark:text-rose-300">{tb.name}</p>
                  <p className="text-sm font-extrabold text-gray-900 dark:text-gray-100">
                    {formatINR(tb.activeOrder?.totalAmount || 0)}
                  </p>
                  <p className="text-[10px] text-gray-500">#{tb.activeOrder?.orderNumber}</p>
                </button>
              ))}
            </div>
          )}

          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <Input
              placeholder="Search KOT #, table, waiter..."
              value={orderSearch}
              onChange={(e) => setOrderSearch(e.target.value)}
              className="pl-9 h-10"
            />
          </div>

          <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
            {TYPE_FILTERS.map((f) => {
              const Icon = f.icon
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setOrderTypeFilter(f.id)}
                  className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border ${
                    orderTypeFilter === f.id
                      ? 'bg-[#0a0a2e] text-white border-[#0a0a2e] dark:bg-zinc-100 dark:text-zinc-900 dark:border-zinc-100'
                      : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700'
                  }`}
                >
                  <Icon size={12} />
                  {f.label}
                </button>
              )
            })}
          </div>

          <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
            {STATUS_CHIPS.map((chip) => (
              <button
                key={chip.id}
                type="button"
                onClick={() => setStatusChip(chip.id)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border ${
                  statusChip === chip.id
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700'
                }`}
              >
                {chip.label}
              </button>
            ))}
          </div>

          {boardLoading ? (
            <div className="flex justify-center py-16">
              <Spinner size="lg" />
            </div>
          ) : filteredBoardOrders.length === 0 ? (
            <EmptyState
              icon={<ChefHat size={40} />}
              title="No orders here"
              description="Tap New Bill to start a takeaway, delivery, or dine-in ticket."
              action={
                <Button onClick={openNewBill} leftIcon={<Plus size={16} />}>
                  New Bill
                </Button>
              }
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {filteredBoardOrders.map((order) => (
                <OrderBoardCard key={order.id} order={order} onClick={() => openOrder(order)} />
              ))}
            </div>
          )}
        </section>
      )}

      {walkIns.length > 0 && showFloor && (
        <section className="mb-5">
          <h2 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
            {kotCfg.showTables ? 'Open takeaway / delivery bills' : 'Open bills'}
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2.5 sm:gap-4">
            {walkIns.map((order) => (
              <WalkInCard
                key={order.id}
                order={order}
                onClick={() =>
                  setWorkspace({
                    kind: 'walkin',
                    orderId: order.id,
                    orderType: (order.orderType as KOTOrderType) || 'takeaway',
                  })
                }
              />
            ))}
          </div>
        </section>
      )}

      {showFloor &&
        (isLoading ? (
          <div className="flex justify-center py-16">
            <Spinner size="lg" />
          </div>
        ) : !kotCfg.showTables ? (
          walkIns.length === 0 ? (
            <>
              <EmptyState
                icon={<CreditCard size={40} />}
                title="Ready for the next bill"
                description={`${venue.label} mode — tap New Bill for takeaway or delivery. No floor plan.`}
                action={
                  <Button onClick={openNewBill} leftIcon={<CreditCard size={16} />}>
                    New Bill
                  </Button>
                }
              />
              {showInsights && (
                <Suspense fallback={null}>
                  <KotInsightsPanel />
                </Suspense>
              )}
            </>
          ) : (
            showInsights && (
              <Suspense fallback={null}>
                <KotInsightsPanel />
              </Suspense>
            )
          )
        ) : tables.length === 0 ? (
          <>
            <EmptyState
              icon={<UtensilsCrossed size={40} />}
              title={`No ${floorLabel.toLowerCase()} yet`}
              description={`You can still take takeaway and delivery bills. Add ${floorLabel.toLowerCase()} when you need dine-in.`}
              action={
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button onClick={openNewBill} leftIcon={<CreditCard size={16} />}>
                    New Bill
                  </Button>
                  <Button variant="outline" onClick={() => setManageOpen(true)} leftIcon={<Plus size={16} />}>
                    Add {floorLabel.toLowerCase()}
                  </Button>
                </div>
              }
            />
            {showInsights && (
              <div className="mt-5">
                <Suspense fallback={null}>
                  <KotInsightsPanel />
                </Suspense>
              </div>
            )}
          </>
        ) : (
          <>
            <section className="mb-5">
              <h2 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">{floorLabel}</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5 sm:gap-4">
                {tables.map((table) => (
                  <TableCard key={table.id} table={table} onClick={() => setWorkspace({ kind: 'table', table })} />
                ))}
              </div>
            </section>
            {showInsights && (
              <Suspense fallback={null}>
                <KotInsightsPanel />
              </Suspense>
            )}
          </>
        ))}

      {manageOpen && (
        <TableManageModal isOpen={manageOpen} onClose={() => setManageOpen(false)} tables={tables} itemLabel={floorSingular} />
      )}
      {settingsOpen && (
        <Suspense fallback={null}>
          <KOTSettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} initialTab={settingsTab} />
        </Suspense>
      )}

      <Suspense
        fallback={
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40">
            <Spinner size="lg" />
          </div>
        }
      >
        {workspace?.kind === 'table' && activeTable && (
          <KOTWorkspace table={activeTable} onClose={() => setWorkspace(null)} />
        )}
        {workspace?.kind === 'walkin' && (
          <KOTWorkspace
            table={null}
            existingOrderId={workspace.orderId}
            initialOrderType={workspace.orderType}
            onClose={() => setWorkspace(null)}
          />
        )}
      </Suspense>
    </div>
  )
}

const WalkInCard = ({ order, onClick }: { order: KOTOrder; onClick: () => void }) => (
  <button
    type="button"
    onClick={onClick}
    className="relative text-left overflow-hidden rounded-2xl border border-sky-200 bg-gradient-to-br from-sky-50 via-white to-indigo-50 dark:from-sky-950/30 dark:via-gray-900 dark:to-indigo-950/20 dark:border-sky-800/50 p-4 min-h-[132px] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-sky-200/40 dark:hover:shadow-sky-950/40"
  >
    <div className="absolute top-0 left-0 w-1.5 h-full bg-sky-500" />
    <div className="flex items-start justify-between gap-2 pl-1 mb-3">
      <h3 className="text-lg font-extrabold tracking-tight text-gray-900 dark:text-gray-100 truncate">
        {order.partyLabel || orderTypeLabel(order.orderType)}
      </h3>
      <span className="shrink-0 inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-100 text-sky-800 dark:bg-sky-900/70 dark:text-sky-200">
        {orderTypeLabel(order.orderType)}
      </span>
    </div>
    <p className="pl-1 text-base font-bold text-gray-900 dark:text-gray-100">{formatINR(order.grandTotal)}</p>
    <div className="pl-1 mt-2 flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
      <span className="inline-flex items-center gap-1">
        <Clock size={12} /> {formatElapsed(order.createdAt)}
      </span>
      <span className="inline-flex items-center gap-1">
        <Check size={12} /> #{order.orderNumber}
      </span>
    </div>
  </button>
)

const OrderBoardCard = ({ order, onClick }: { order: KOTOrder; onClick: () => void }) => {
  const billed = order.status === 'billed' || order.status === 'cancelled'
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={billed}
      className={`text-left rounded-2xl border p-4 transition-all duration-150 ${
        billed
          ? 'border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/60 opacity-80 cursor-default'
          : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:-translate-y-0.5 hover:shadow-md'
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">
            #{order.orderNumber} · {orderTypeLabel(order.orderType)}
          </p>
          <h3 className="text-lg font-extrabold text-gray-900 dark:text-gray-100 truncate">
            {order.table?.name || order.partyLabel || orderTypeLabel(order.orderType)}
          </h3>
        </div>
        <span className="shrink-0 inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200">
          {ticketLaneLabel(order.status)}
        </span>
      </div>
      <p className="text-base font-bold text-gray-900 dark:text-gray-100">{formatINR(order.grandTotal)}</p>
      <div className="mt-2 flex items-center justify-between gap-2 text-xs text-gray-500 dark:text-gray-400">
        <span className="inline-flex items-center gap-1">
          <Clock size={12} /> {formatElapsed(order.createdAt)}
        </span>
        {!billed && <span className="font-semibold text-blue-600 dark:text-blue-400">View & Settle →</span>}
      </div>
    </button>
  )
}
