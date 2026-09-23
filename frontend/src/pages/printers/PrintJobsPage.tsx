import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Inbox, Printer, RefreshCw } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { IncomingPrintJobModal } from '@/components/printers/IncomingPrintJobModal'
import { useAuth } from '@/contexts/AuthContext'
import { listPendingPrintJobsForAgent, listPrintJobs, type PrintJob, type PrintJobStatus } from '@/services/printJobService'
import { formatINR } from '@/utils/currency'
import { QUERY_KEYS } from '@/constants/queryKeys'

const STATUS_BADGE: Record<PrintJobStatus, { label: string; variant: 'default' | 'success' | 'warning' | 'danger' | 'info' }> = {
  queued: { label: 'Sending', variant: 'warning' },
  delivered: { label: 'Waiting', variant: 'info' },
  accepted: { label: 'Accepted', variant: 'success' },
  printer_connect_pending: { label: 'Connecting', variant: 'warning' },
  printing: { label: 'Printing', variant: 'info' },
  completed: { label: 'Printed', variant: 'success' },
  failed: { label: 'Failed', variant: 'danger' },
  rejected: { label: 'Declined', variant: 'default' },
  expired: { label: 'No response', variant: 'default' },
  cancelled: { label: 'Cancelled', variant: 'default' },
}

export const PrintJobsPage = () => {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const actorId = user?.id || user?.uid || ''
  const [tab, setTab] = useState<'incoming' | 'sent'>('incoming')
  const [activeJob, setActiveJob] = useState<PrintJob | null>(null)

  const incomingQuery = useQuery({
    queryKey: ['printJobs', 'incoming', actorId],
    queryFn: listPendingPrintJobsForAgent,
    enabled: Boolean(actorId),
    refetchInterval: 8000,
  })

  const sentQuery = useQuery({
    queryKey: ['printJobs', 'sent', actorId],
    queryFn: () => listPrintJobs(),
    enabled: Boolean(actorId),
    refetchInterval: 12000,
  })

  const incoming = incomingQuery.data || []
  const sent = useMemo(
    () => (sentQuery.data || []).filter(job => job.requestedById === actorId),
    [sentQuery.data, actorId]
  )
  const jobs = tab === 'incoming' ? incoming : sent
  const isLoading = tab === 'incoming' ? incomingQuery.isLoading : sentQuery.isLoading

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['printJobs'] })
    void queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.SALES] })
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Requests"
        breadcrumb={['Home', 'Requests']}
        action={
          <Button variant="ghost" onClick={refresh} leftIcon={<RefreshCw size={16} />}>
            Refresh
          </Button>
        }
      />

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setTab('incoming')}
          className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-colors ${
            tab === 'incoming'
              ? 'bg-blue-600 text-white border-blue-600'
              : 'bg-white dark:bg-dark-card text-slate-600 dark:text-gray-300 border-slate-200 dark:border-dark-border'
          }`}
        >
          Incoming
        </button>
        <button
          type="button"
          onClick={() => setTab('sent')}
          className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-colors ${
            tab === 'sent'
              ? 'bg-blue-600 text-white border-blue-600'
              : 'bg-white dark:bg-dark-card text-slate-600 dark:text-gray-300 border-slate-200 dark:border-dark-border'
          }`}
        >
          Sent
        </button>
      </div>

      <Card className="p-0 overflow-hidden">
        {isLoading ? (
          <p className="p-6 text-sm text-slate-500">Loading print requests…</p>
        ) : jobs.length === 0 ? (
          <div className="p-10 flex flex-col items-center text-center gap-2">
            <Inbox className="text-slate-400" size={32} />
            <p className="font-semibold text-slate-800 dark:text-gray-100">
              {tab === 'incoming' ? 'No incoming print requests' : 'No sent print requests'}
            </p>
            <p className="text-sm text-slate-500 dark:text-gray-400 max-w-md">
              {tab === 'incoming'
                ? 'When an admin sends a POS, KOT, or quick bill to this agent, it will show up here so you can accept or reject it.'
                : 'Receipts you send to another agent for remote printing will appear here.'}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-dark-border">
            {jobs.map(job => {
              const meta = STATUS_BADGE[job.status] || STATUS_BADGE.queued
              const needsAction = tab === 'incoming' && (job.status === 'delivered' || job.status === 'queued')
              return (
                <li key={job.id}>
                  <button
                    type="button"
                    onClick={() => {
                      if (tab === 'incoming' && ['queued', 'delivered', 'accepted', 'printer_connect_pending'].includes(job.status)) {
                        setActiveJob(job)
                      }
                    }}
                    className={`w-full text-left px-4 py-3.5 flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-dark-elevated transition-colors ${
                      needsAction ? 'bg-blue-50/70 dark:bg-blue-950/20' : ''
                    }`}
                  >
                    <span className="w-9 h-9 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0">
                      <Printer size={16} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-slate-900 dark:text-gray-100">
                          {job.sale?.invoiceNumber || 'Invoice'}
                        </span>
                        <Badge variant={meta.variant}>{meta.label}</Badge>
                      </span>
                      <span className="block text-xs text-slate-500 dark:text-gray-400 truncate">
                        {tab === 'incoming'
                          ? `From ${job.requestedByName}`
                          : `To ${job.acceptedByAgentName || job.targetAgentName || job.targetLocationName || 'Team'}`}
                        {' · '}
                        {new Date(job.createdAt).toLocaleString()}
                      </span>
                    </span>
                    <span className="font-semibold text-slate-900 dark:text-gray-100 shrink-0">
                      {formatINR(Number(job.sale?.grandTotal || 0))}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </Card>

      <IncomingPrintJobModal
        job={activeJob}
        onClose={() => setActiveJob(null)}
        onHandled={() => {
          setActiveJob(null)
          refresh()
        }}
      />
    </div>
  )
}
