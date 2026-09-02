import { Link } from 'react-router-dom'
import { ArrowLeft, Check, Clock, Flame } from 'lucide-react'
import toast from 'react-hot-toast'
import { toastError } from '@/utils/userMessage'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Spinner } from '@/components/ui/Spinner'
import { ROUTES } from '@/constants/routes'
import { useKotOrders, useUpdateKotStatus } from '@/hooks/useKotOrders'
import { RUNNING_STATUS_QUERY } from '@/services/kotOrderService'
import { formatElapsed } from './kotUtils'

export const KDSPage = () => {
  const { data: orders = [], isLoading } = useKotOrders({
    status: RUNNING_STATUS_QUERY,
    refetchInterval: 8000,
  })
  const { mutate: updateStatus, isPending, variables } = useUpdateKotStatus()

  const tickets = orders.filter((o) => o.status !== 'billed' && o.status !== 'cancelled')

  return (
    <div>
      <PageHeader
        title="Kitchen Display"
        breadcrumb={['KOT', 'Kitchen']}
        action={
          <Link to={ROUTES.KOT}>
            <Button variant="outline" leftIcon={<ArrowLeft size={16} />}>
              KOT
            </Button>
          </Link>
        }
      />

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner size="lg" />
        </div>
      ) : tickets.length === 0 ? (
        <EmptyState icon={<Flame size={40} />} title="No running tickets" description="New KOTs sent to the kitchen will appear here." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {tickets.map((order) => {
            const tableName = order.table?.name || order.partyLabel || 'Walk-in'
            const marking = isPending && variables?.id === order.id
            const isReady = order.status === 'ready' || order.status === 'served'
            return (
              <div
                key={order.id}
                className={`rounded-2xl border-2 bg-white dark:bg-gray-800 p-4 shadow-sm ${
                  order.priority === 'urgent'
                    ? 'border-red-400'
                    : isReady
                      ? 'border-emerald-400'
                      : 'border-amber-300 dark:border-amber-600'
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">KOT #{order.orderNumber}</p>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">{tableName}</h3>
                  </div>
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 dark:text-amber-300">
                    <Clock size={12} />
                    {formatElapsed(order.createdAt)}
                  </span>
                </div>
                {order.waiterName && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Waiter: {order.waiterName}</p>
                )}
                <ul className="space-y-1.5 mb-4">
                  {order.items.map((it) => (
                    <li key={it.id} className="text-sm">
                      <span className="font-semibold text-gray-900 dark:text-gray-100">
                        {it.quantity} × {it.productName}
                      </span>
                      {it.modifiers?.length > 0 && (
                        <span className="block text-[11px] italic text-gray-500">* {it.modifiers.join(', ')}</span>
                      )}
                      {it.notes && <span className="block text-[11px] italic text-red-600 dark:text-red-400">{it.notes}</span>}
                    </li>
                  ))}
                </ul>
                {!isReady && (
                  <Button
                    className="w-full"
                    loading={marking}
                    leftIcon={<Check size={16} />}
                    onClick={() =>
                      updateStatus(
                        { id: order.id, status: 'ready' },
                        {
                          onSuccess: () => toast.success(`KOT #${order.orderNumber} marked ready`),
                          onError: (err) => toastError(err, 'Could not update the ticket'),
                        }
                      )
                    }
                  >
                    Mark Ready
                  </Button>
                )}
                {isReady && (
                  <p className="text-center text-sm font-semibold text-emerald-600 dark:text-emerald-400">Ready to serve</p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
