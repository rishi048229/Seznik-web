import { fetchApi } from './api'
import type {
  CreateUtilityBillPayload,
  UtilityBill,
  UtilityBillExtractResult,
  UtilityBillListResponse,
  UtilityBillStats,
} from '@/types/utilityBill'

function unwrapData<T>(payload: any, fallback?: T): T {
  if (payload && typeof payload === 'object' && 'data' in payload && payload.data !== undefined) {
    return payload.data as T
  }
  return (payload ?? fallback) as T
}

export const extractUtilityBill = async (imageBase64: string, mimeType: string): Promise<UtilityBillExtractResult> => {
  const payload = await fetchApi('/utility-bills/extract', {
    method: 'POST',
    body: JSON.stringify({ imageBase64, mimeType }),
  })
  return unwrapData<UtilityBillExtractResult>(payload)
}

export const getUtilityBills = async (params?: {
  search?: string
  billType?: string
  page?: number
  limit?: number
}): Promise<UtilityBillListResponse> => {
  const query = new URLSearchParams()
  if (params?.search) query.set('search', params.search)
  if (params?.billType) query.set('billType', params.billType)
  query.set('page', String(params?.page || 1))
  query.set('limit', String(params?.limit || 50))
  const qs = query.toString()
  const payload = await fetchApi(`/utility-bills?${qs}`)
  if (payload && typeof payload === 'object' && Array.isArray((payload as any).bills)) {
    return payload as UtilityBillListResponse
  }
  const bills = unwrapData<UtilityBill[]>(payload, [])
  const pagination = (payload as any)?.pagination || {}
  return {
    bills: Array.isArray(bills) ? bills : [],
    total: Number(pagination.total || bills?.length || 0),
    page: Number(pagination.page || params?.page || 1),
    limit: Number(pagination.limit || params?.limit || 50),
  }
}

export const getUtilityBillStats = async (): Promise<UtilityBillStats> => {
  const payload = await fetchApi('/utility-bills/stats')
  return unwrapData<UtilityBillStats>(payload)
}

export const createUtilityBill = async (data: CreateUtilityBillPayload): Promise<UtilityBill> => {
  const payload = await fetchApi('/utility-bills', {
    method: 'POST',
    body: JSON.stringify(data),
  })
  return unwrapData<UtilityBill>(payload)
}

export const deleteUtilityBill = async (id: string): Promise<void> => {
  await fetchApi(`/utility-bills/${id}`, { method: 'DELETE' })
}
