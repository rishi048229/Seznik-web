import { fetchApi } from './api'
import type {
  CreateKOTOrderPayload,
  KOTBillPayload,
  KOTBillResult,
  KOTOrder,
  SendToKitchenResult,
} from '@/types/kot.types'

export const RUNNING_STATUS_QUERY = 'open,sent_to_kitchen,preparing,ready,served'

export const getOrders = async (params?: {
  status?: string
  orderType?: string
  tableId?: string
}): Promise<KOTOrder[]> => {
  const search = new URLSearchParams()
  if (params?.status) search.set('status', params.status)
  if (params?.orderType) search.set('orderType', params.orderType)
  if (params?.tableId) search.set('tableId', params.tableId)
  const qs = search.toString()
  return await fetchApi(`/kot-orders${qs ? `?${qs}` : ''}`)
}

export const getOrderById = async (id: string): Promise<KOTOrder> => {
  return await fetchApi(`/kot-orders/${id}`)
}

export const createOrder = async (data: CreateKOTOrderPayload): Promise<KOTOrder> => {
  return await fetchApi('/kot-orders', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export const addItemsToOrder = async (
  id: string,
  items: CreateKOTOrderPayload['items']
): Promise<KOTOrder> => {
  return await fetchApi(`/kot-orders/${id}/items`, {
    method: 'POST',
    body: JSON.stringify({ items }),
  })
}

export const sendToKitchen = async (
  id: string,
  data?: { waiterName?: string; locationId?: string | null }
): Promise<SendToKitchenResult> => {
  return await fetchApi(`/kot-orders/${id}/send-to-kitchen`, {
    method: 'POST',
    body: JSON.stringify(data ?? {}),
  })
}

export const updateOrderStatus = async (
  id: string,
  data: { status?: string; priority?: string; notes?: string }
): Promise<KOTOrder> => {
  return await fetchApi(`/kot-orders/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

export const generateBill = async (id: string, data: KOTBillPayload): Promise<KOTBillResult> => {
  return await fetchApi(`/kot-orders/${id}/bill`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}
