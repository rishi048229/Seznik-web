import { fetchApi } from './api'
import type {
  CreateUtilityBillPayload,
  UtilityBill,
  UtilityBillExtractResult,
  UtilityBillListResponse,
  UtilityBillStats,
} from '@/types/utilityBill'

export const extractUtilityBill = async (imageBase64: string, mimeType: string): Promise<UtilityBillExtractResult> => {
  return await fetchApi('/utility-bills/extract', {
    method: 'POST',
    body: JSON.stringify({ imageBase64, mimeType }),
  })
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
  return await fetchApi(`/utility-bills?${qs}`)
}

export const getUtilityBillStats = async (): Promise<UtilityBillStats> => {
  return await fetchApi('/utility-bills/stats')
}

export const createUtilityBill = async (data: CreateUtilityBillPayload): Promise<UtilityBill> => {
  return await fetchApi('/utility-bills', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export const deleteUtilityBill = async (id: string): Promise<void> => {
  await fetchApi(`/utility-bills/${id}`, { method: 'DELETE' })
}
