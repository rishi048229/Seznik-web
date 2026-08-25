import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChefHat, LayoutGrid, Plus, UtensilsCrossed } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Spinner } from '@/components/ui/Spinner'
import { ROUTES } from '@/constants/routes'
import { useRestaurantTables } from '@/hooks/useRestaurantTables'
import { useLanguage } from '@/contexts/LanguageContext'
import { FloorStatsBar } from './components/FloorStatsBar'
import { TableCard } from './components/TableCard'
import { TableManageModal } from './components/TableManageModal'
import { KOTWorkspace } from './components/KOTWorkspace'
import type { RestaurantTable } from '@/types/kot.types'

export const KOTPage = () => {
  const { t } = useLanguage()
  const { data: tables = [], isLoading } = useRestaurantTables({ refetchInterval: 10000 })
  const [manageOpen, setManageOpen] = useState(false)
  const [activeTable, setActiveTable] = useState<RestaurantTable | null>(null)

  const stats = useMemo(() => {
    const occupied = tables.filter((tb) => tb.isOccupied).length
    const revenue = tables.reduce((sum, tb) => sum + (tb.activeOrder?.totalAmount ?? 0), 0)
    return {
      total: tables.length,
      occupied,
      vacant: tables.length - occupied,
      revenue,
    }
  }, [tables])

  const active = activeTable ? tables.find((tb) => tb.id === activeTable.id) ?? activeTable : null

  return (
    <div>
      <PageHeader
        title={t('nav.kot')}
        breadcrumb={[t('nav.kot')]}
        action={
          <>
            <Link to={ROUTES.KOT_KDS}>
              <Button variant="outline" leftIcon={<ChefHat size={16} />}>
                Kitchen Display
              </Button>
            </Link>
            <Button variant="outline" leftIcon={<LayoutGrid size={16} />} onClick={() => setManageOpen(true)}>
              Manage Tables
            </Button>
            <Button
              leftIcon={<Plus size={16} />}
              onClick={() => {
                setManageOpen(true)
              }}
            >
              Add Table
            </Button>
          </>
        }
      />

      <FloorStatsBar total={stats.total} occupied={stats.occupied} vacant={stats.vacant} revenue={stats.revenue} />

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner size="lg" />
        </div>
      ) : tables.length === 0 ? (
        <EmptyState
          icon={<UtensilsCrossed size={40} />}
          title="No dining tables yet"
          description="Add tables to start taking dine-in KOT orders."
          action={
            <Button onClick={() => setManageOpen(true)} leftIcon={<Plus size={16} />}>
              Add your first table
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
          {tables.map((table) => (
            <TableCard key={table.id} table={table} onClick={() => setActiveTable(table)} />
          ))}
        </div>
      )}

      <TableManageModal isOpen={manageOpen} onClose={() => setManageOpen(false)} tables={tables} />

      {active && <KOTWorkspace table={active} onClose={() => setActiveTable(null)} />}
    </div>
  )
}
