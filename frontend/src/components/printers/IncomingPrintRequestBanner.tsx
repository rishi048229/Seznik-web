import { useMemo, useState } from 'react'
import { Printer, X } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/contexts/AuthContext'
import { listPendingPrintJobsForAgent, type PrintJob } from '@/services/printJobService'
import { IncomingPrintJobModal } from './IncomingPrintJobModal'

const POLL_MS = 8000

export const IncomingPrintRequestBanner = () => {
  const { user } = useAuth()
  const actorId = user?.id || user?.uid
  const enabled = Boolean(actorId)

  const { data: jobs = [] } = useQuery({
    queryKey: ['printJobs', 'agentPending', actorId],
    queryFn: listPendingPrintJobsForAgent,
    enabled,
    refetchInterval: enabled ? POLL_MS : false,
    staleTime: 0,
  })

  const [dismissedIds, setDismissedIds] = useState<string[]>([])
  const [activeJob, setActiveJob] = useState<PrintJob | null>(null)

  const topJob = useMemo(
    () =>
      jobs.find(
        job =>
          (job.status === 'queued' || job.status === 'delivered' || job.status === 'accepted' || job.status === 'printer_connect_pending') &&
          !dismissedIds.includes(job.id)
      ),
    [jobs, dismissedIds, actorId]
  )

  if (!enabled || !topJob) return null

  return (
    <>
      <div className="fixed top-3 left-1/2 z-[80] w-[min(92vw,440px)] -translate-x-1/2 lg:left-auto lg:right-6 lg:translate-x-0">
        <button
          type="button"
          onClick={() => setActiveJob(topJob)}
          className="w-full flex items-center gap-3 rounded-2xl border-2 border-blue-500 bg-white dark:bg-dark-card px-4 py-3 shadow-xl text-left hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors"
        >
          <span className="w-9 h-9 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0">
            <Printer size={18} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-extrabold text-slate-900 dark:text-gray-100">New receipt to print</span>
            <span className="block text-xs text-slate-500 dark:text-gray-400 truncate">
              {topJob.requestedByName} sent invoice {topJob.sale?.invoiceNumber} · Tap to accept
            </span>
          </span>
          <span
            role="button"
            tabIndex={0}
            onClick={e => {
              e.stopPropagation()
              setDismissedIds(prev => [...prev, topJob.id])
            }}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.stopPropagation()
                setDismissedIds(prev => [...prev, topJob.id])
              }
            }}
            className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-gray-200"
          >
            <X size={16} />
          </span>
        </button>
      </div>

      <IncomingPrintJobModal
        job={activeJob}
        onClose={() => setActiveJob(null)}
        onHandled={jobId => {
          setDismissedIds(prev => [...prev, jobId])
          setActiveJob(null)
        }}
      />
    </>
  )
}
