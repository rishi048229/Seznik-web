import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getNotificationFeed,
  triggerStockCheck,
  triggerCreditDueCheck,
  triggerSupplierDueCheck,
  type NotificationFeedResponse,
} from '@/services/notificationService'

export const NOTIFICATION_KEYS = {
  feed: ['notifications', 'feed'] as const,
}

export const useNotificationFeed = () => {
  return useQuery<NotificationFeedResponse>({
    queryKey: NOTIFICATION_KEYS.feed,
    queryFn: getNotificationFeed,
    refetchInterval: 30000, // Polling feed every 30s
    staleTime: 15000,
  })
}

export const useTriggerStockCheck = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: triggerStockCheck,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: NOTIFICATION_KEYS.feed })
    },
  })
}

export const useTriggerCreditDueCheck = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: triggerCreditDueCheck,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: NOTIFICATION_KEYS.feed })
    },
  })
}

export const useTriggerSupplierDueCheck = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: triggerSupplierDueCheck,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: NOTIFICATION_KEYS.feed })
    },
  })
}
