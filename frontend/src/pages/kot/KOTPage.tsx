import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChefHat, Clock, CreditCard, LayoutGrid, MoreVertical, Plus, Receipt, Store, UtensilsCrossed } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Spinner } from '@/components/ui/Spinner'
import { DropdownMenu, DropdownMenuItem } from '@/components/ui/DropdownMenu'
import { ROUTES } from '@/constants/routes'
import { useRestaurantTables } from '@/hooks/useRestaurantTables'
import { useKotOrders } from '@/hooks/useKotOrders'
import { useSettings } from '@/hooks/useSettings'
import { useLanguage } from '@/contexts/LanguageContext'
import { formatINR } from '@/utils/currency'
import { FloorStatsBar } from './components/FloorStatsBar'
import { TableCard } from './components/TableCard'
import { TableManageModal } from './components/TableManageModal'
import { KOTWorkspace } from './components/KOTWorkspace'
import { KOTSettingsModal, type KOTSettingsTab } from './components/KOTSettingsModal'
import { mergeKotConfig, orderTypeLabel } from './kotConfig'
import { formatElapsed } from './kotUtils'
import type { KOTOrder, KOTOrderType, RestaurantTable } from '@/types/kot.types'

type WorkspaceTarget =
  | { kind: 'table'; table: RestaurantTable }
  | { kind: 'walkin'; orderId?: string | null; orderType?: KOTOrderType }

export const KOTPage = () => {
  const { t } = useLanguage()
  const { data: settings } = useSettings()
  const kotCfg = mergeKotConfig(settings?.kotConfig)
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
            <Link to={ROUTES.KOT_KDS}>
              <Button variant="outline" leftIcon={<ChefHat size={16} />}>
                Kitchen
              </Button>
            </Link>
            <Button variant="outline" leftIcon={<LayoutGrid size={16} />} onClick={() => setManageOpen(true)}>
              Tables
            </Button>
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
                KOT & charges
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => openSettings('stores')}>
                <LayoutGrid size={14} />
                Franchises / stores
              </DropdownMenuItem>
            </DropdownMenu>
          </>
        }
      />

      <FloorStatsBar total={stats.total} occupied={stats.occupied} vacant={stats.vacant} revenue={stats.revenue} />

      {walkIns.length > 0 && (
        <section className="mb-5">
          <h2 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Open takeaway / delivery bills</h2>
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
      ) : tables.length === 0 ? (
        <EmptyState
          icon={<UtensilsCrossed size={40} />}
          title="No dining tables yet"
          description="You can still take takeaway and delivery bills without tables. Add tables when you need dine-in."
          action={
            <div className="flex flex-col sm:flex-row gap-2">
              <Button onClick={openNewBill} leftIcon={<CreditCard size={16} />}>
                New Bill
              </Button>
              <Button variant="outline" onClick={() => setManageOpen(true)} leftIcon={<Plus size={16} />}>
                Add tables
              </Button>
            </div>
          }
        />
      ) : (
        <section>
          <h2 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Dining tables</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5 sm:gap-4">
            {tables.map((table) => (
              <TableCard key={table.id} table={table} onClick={() => setWorkspace({ kind: 'table', table })} />
            ))}
          </div>
        </section>
      )}

      <TableManageModal isOpen={manageOpen} onClose={() => setManageOpen(false)} tables={tables} />
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
    className="text-left rounded-2xl border-2 border-sky-400/80 bg-sky-50/80 dark:bg-sky-950/30 dark:border-sky-500/60 p-3 sm:p-4 transition-all duration-200 shadow-sm hover:shadow-md hover:-translate-y-0.5"
  >
    <div className="flex items-start justify-between gap-2 mb-2">
      <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-gray-100 truncate">
        {order.partyLabel || orderTypeLabel(order.orderType)}
      </h3>
      <span className="shrink-0 inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold bg-sky-100 text-sky-800 dark:bg-sky-900/70 dark:text-sky-200">
        {orderTypeLabel(order.orderType)}
      </span>
    </div>
    <p className="text-sm font-bold text-gray-900 dark:text-gray-100">{formatINR(order.grandTotal)}</p>
    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
      KOT #{order.orderNumber} · {order.items?.length ?? 0} item{(order.items?.length ?? 0) === 1 ? '' : 's'}
    </p>
    <p className="flex items-center gap-1 text-xs font-medium text-amber-700 dark:text-amber-300 mt-1">
      <Clock size={12} />
      {formatElapsed(order.createdAt)}
    </p>
  </button>
)
