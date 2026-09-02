import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { toastError } from '@/utils/userMessage'
import { ChefHat, Check, Clock, CreditCard, LayoutGrid, MoreVertical, Plus, Receipt, Store, UtensilsCrossed } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Spinner } from '@/components/ui/Spinner'
import { DropdownMenu, DropdownMenuItem } from '@/components/ui/DropdownMenu'
import { ROUTES } from '@/constants/routes'
import { useRestaurantTables } from '@/hooks/useRestaurantTables'
import { useKotOrders } from '@/hooks/useKotOrders'
import { useSettings, useUpdateSettings, useCreateSettings } from '@/hooks/useSettings'
import { useLanguage } from '@/contexts/LanguageContext'
import { formatINR } from '@/utils/currency'
import { FloorStatsBar } from './components/FloorStatsBar'
import { TableCard } from './components/TableCard'
import { TableManageModal } from './components/TableManageModal'
import { KOTWorkspace } from './components/KOTWorkspace'
import { KOTSettingsModal, type KOTSettingsTab } from './components/KOTSettingsModal'
import { KotInsightsPanel } from './components/KotInsightsPanel'
import { mergeKotConfig, orderTypeLabel, tableNounLabel, VENUE_PRESETS } from './kotConfig'
import { venueIcon } from './components/VenueTypePicker'
import { formatElapsed } from './kotUtils'
import type { KOTOrder, KOTOrderType, RestaurantTable } from '@/types/kot.types'

type WorkspaceTarget =
  | { kind: 'table'; table: RestaurantTable }
  | { kind: 'walkin'; orderId?: string | null; orderType?: KOTOrderType }

export const KOTPage = () => {
  const { t } = useLanguage()
  const { data: settings } = useSettings()
  const { mutate: updateSettings } = useUpdateSettings()
  const { mutate: createSettings } = useCreateSettings()
  const kotCfg = mergeKotConfig(settings?.kotConfig)
  const venue = VENUE_PRESETS[kotCfg.venueType]
  const VenueIcon = venueIcon(kotCfg.venueType)
  const floorLabel = tableNounLabel(kotCfg.tableNoun)
  const floorSingular = tableNounLabel(kotCfg.tableNoun, false).toLowerCase()
  const { data: tables = [], isLoading } = useRestaurantTables({ refetchInterval: 10000 })
  const { data: runningOrders = [] } = useKotOrders({ status: 'running', refetchInterval: 10000 })
  const [manageOpen, setManageOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsTab, setSettingsTab] = useState<KOTSettingsTab>('business')
  const [workspace, setWorkspace] = useState<WorkspaceTarget | null>(null)

  const walkIns = useMemo(
    () => runningOrders.filter((order) => !order.tableId),
    [runningOrders]
  )

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
              <DropdownMenuItem onClick={() => openSettings('stores')}>
                <LayoutGrid size={14} />
                Franchises / stores
              </DropdownMenuItem>
            </DropdownMenu>
          </>
        }
      />

      <FloorStatsBar
        total={stats.total}
        occupied={stats.occupied}
        vacant={stats.vacant}
        revenue={stats.revenue}
        tableLabel={floorLabel}
        showFloor={kotCfg.showTables}
        openCount={walkIns.length}
      />

      {walkIns.length > 0 && (
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

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner size="lg" />
        </div>
      ) : !kotCfg.showTables ? (
        walkIns.length === 0 ? (
          <>
            <KotInsightsPanel />
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
          </>
        ) : null
      ) : tables.length === 0 ? (
        <>
          <KotInsightsPanel />
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
        </>
      ) : (
        <section>
          <h2 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">{floorLabel}</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5 sm:gap-4">
            {tables.map((table) => (
              <TableCard key={table.id} table={table} onClick={() => setWorkspace({ kind: 'table', table })} />
            ))}
          </div>
        </section>
      )}

      <TableManageModal isOpen={manageOpen} onClose={() => setManageOpen(false)} tables={tables} itemLabel={floorSingular} />
      <KOTSettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} initialTab={settingsTab} />

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
    <p className="pl-1 text-xs text-gray-500 dark:text-gray-400 mt-1">
      #{order.orderNumber} · {order.items?.length ?? 0} item{(order.items?.length ?? 0) === 1 ? '' : 's'}
    </p>
    <p className="pl-1 flex items-center gap-1 text-xs font-semibold text-amber-700 dark:text-amber-300 mt-2">
      <Clock size={12} />
      {formatElapsed(order.createdAt)}
    </p>
  </button>
)
