import { fetchApi } from './api'

export type PrintJobStatus =
  | 'queued'
  | 'delivered'
  | 'accepted'
  | 'rejected'
  | 'printer_connect_pending'
  | 'printing'
  | 'completed'
  | 'failed'
  | 'expired'
  | 'cancelled'

export interface PrintJobEvent {
  id: string
  status: PrintJobStatus
  note?: string | null
  createdAt: string
}

export interface PrintJob {
  id: string
  saleId?: string | null
  jobType?: 'receipt' | 'kot'
  kotOrderId?: string | null
  requestedById: string
  requestedByName: string
  targetAgentId?: string | null
  targetAgentName?: string | null
  targetLocationId?: string | null
  targetLocationName?: string | null
  paperWidth: '58mm' | '80mm'
  copies: number
  status: PrintJobStatus
  failureReason?: string | null
  acceptedByAgentId?: string | null
  acceptedByAgentName?: string | null
  expiresAt: string
  respondedAt?: string | null
  completedAt?: string | null
  createdAt: string
  updatedAt: string
  sale?: {
    id: string
    invoiceNumber: string
    grandTotal: number
    createdAt: string
    customer?: { name: string } | null
  } | null
  events?: PrintJobEvent[]
}

/** One person at this business who has a phone registered and can therefore receive a job. */
export interface BusinessDeviceEntry {
  actorId: string
  actorName: string
  actorIsManagedUser: boolean
  platform: string
  lastSeenAt: string
}

interface ApiEnvelope<T> {
  success: boolean
  data: T
  message?: string
}

export const createPrintJob = async (payload: {
  saleId?: string
  kotOrderId?: string
  jobType?: 'receipt' | 'kot'
  targetAgentId?: string
  targetLocationId?: string
  paperWidth?: '58mm' | '80mm'
  copies?: number
}): Promise<PrintJob> => {
  const res: ApiEnvelope<PrintJob> = await fetchApi('/print-jobs', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return res.data
}

export const listPrintJobs = async (params?: { status?: string; targetAgentId?: string }): Promise<PrintJob[]> => {
  const qs = new URLSearchParams()
  if (params?.status) qs.set('status', params.status)
  if (params?.targetAgentId) qs.set('targetAgentId', params.targetAgentId)
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const res: ApiEnvelope<PrintJob[]> = await fetchApi(`/print-jobs${suffix}`)
  return res.data
}

export const getPrintJob = async (id: string): Promise<PrintJob> => {
  const res: ApiEnvelope<PrintJob> = await fetchApi(`/print-jobs/${id}`)
  return res.data
}

export const cancelPrintJob = async (id: string): Promise<PrintJob> => {
  const res: ApiEnvelope<PrintJob> = await fetchApi(`/print-jobs/${id}/cancel`, { method: 'PATCH' })
  return res.data
}

export const listPendingPrintJobsForAgent = async (): Promise<PrintJob[]> => {
  const res: ApiEnvelope<PrintJob[]> = await fetchApi('/print-jobs/agent/pending')
  return res.data || []
}

export const updatePrintJobStatus = async (
  id: string,
  status: PrintJobStatus,
  failureReason?: string
): Promise<PrintJob> => {
  const res: ApiEnvelope<PrintJob> = await fetchApi(`/print-jobs/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status, failureReason }),
  })
  return res.data
}

export const reassignPrintJob = async (id: string, targetAgentId: string): Promise<PrintJob> => {
  const res: ApiEnvelope<PrintJob> = await fetchApi(`/print-jobs/${id}/reassign`, {
    method: 'POST',
    body: JSON.stringify({ targetAgentId }),
  })
  return res.data
}

export const listBusinessDevices = async (): Promise<BusinessDeviceEntry[]> => {
  const res: ApiEnvelope<BusinessDeviceEntry[]> = await fetchApi('/device-tokens')
  return res.data
}
