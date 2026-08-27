import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/contexts/AuthContext'
import { QUERY_KEYS } from '@/constants/queryKeys'
import * as kotOrderService from '@/services/kotOrderService'
import type { CreateKOTOrderPayload, KOTBillPayload } from '@/types/kot.types'

const invalidateKotAndTables = (qc: ReturnType<typeof useQueryClient>) => {
  qc.invalidateQueries({ queryKey: [QUERY_KEYS.KOT_ORDERS] })
  qc.invalidateQueries({ queryKey: [QUERY_KEYS.RESTAURANT_TABLES] })
}

export const useKotOrders = (params?: { status?: string; refetchInterval?: number }) => {
  const { user } = useAuth()
  return useQuery({
    queryKey: [QUERY_KEYS.KOT_ORDERS, user?.uid, params?.status ?? 'all'],
    queryFn: () => kotOrderService.getOrders({ status: params?.status }),
    enabled: !!user,
    staleTime: 0,
    refetchOnWindowFocus: false,
    refetchInterval: params?.refetchInterval,
  })
}

export const useKotOrder = (id: string | null) => {
  const { user } = useAuth()
  return useQuery({
    queryKey: [QUERY_KEYS.KOT_ORDERS, user?.uid, id],
    queryFn: () => kotOrderService.getOrderById(id!),
    enabled: !!user && !!id,
    staleTime: 0,
    refetchOnWindowFocus: false,
  })
}

export const useCreateKotOrder = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateKOTOrderPayload) => kotOrderService.createOrder(data),
    onSuccess: () => invalidateKotAndTables(qc),
  })
}

export const useAddKotItems = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, items }: { id: string; items: CreateKOTOrderPayload['items'] }) =>
      kotOrderService.addItemsToOrder(id, items),
    onSuccess: () => invalidateKotAndTables(qc),
  })
}

export const useSendKotToKitchen = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      waiterName,
      locationId,
    }: {
      id: string
      waiterName?: string
      locationId?: string | null
    }) => kotOrderService.sendToKitchen(id, { waiterName, locationId }),
    onSuccess: () => invalidateKotAndTables(qc),
  })
}

export const useUpdateKotStatus = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      kotOrderService.updateOrderStatus(id, { status }),
    onSuccess: () => invalidateKotAndTables(qc),
  })
}

export const useGenerateKotBill = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: KOTBillPayload }) =>
      kotOrderService.generateBill(id, data),
    onSuccess: async () => {
      await Promise.all([
        qc.refetchQueries({ queryKey: [QUERY_KEYS.KOT_ORDERS] }),
        qc.refetchQueries({ queryKey: [QUERY_KEYS.RESTAURANT_TABLES] }),
        qc.refetchQueries({ queryKey: [QUERY_KEYS.SALES] }),
        qc.refetchQueries({ queryKey: [QUERY_KEYS.PRODUCTS] }),
        qc.refetchQueries({ queryKey: [QUERY_KEYS.CUSTOMERS] }),
        qc.refetchQueries({ queryKey: [QUERY_KEYS.CREDITS] }),
      ])
    },
  })
}
