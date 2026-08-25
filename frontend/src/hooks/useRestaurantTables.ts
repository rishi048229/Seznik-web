import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/contexts/AuthContext'
import { QUERY_KEYS } from '@/constants/queryKeys'
import * as restaurantTableService from '@/services/restaurantTableService'

export const useRestaurantTables = (opts?: { refetchInterval?: number }) => {
  const { user } = useAuth()
  return useQuery({
    queryKey: [QUERY_KEYS.RESTAURANT_TABLES, user?.uid],
    queryFn: () => restaurantTableService.getTables(),
    enabled: !!user,
    staleTime: 0,
    refetchOnWindowFocus: false,
    refetchInterval: opts?.refetchInterval,
  })
}

export const useCreateRestaurantTable = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { name: string; capacity?: number | null; sortOrder?: number }) =>
      restaurantTableService.createTable(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEYS.RESTAURANT_TABLES] })
    },
  })
}

export const useUpdateRestaurantTable = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string
      data: { name?: string; capacity?: number | null; sortOrder?: number; isActive?: boolean }
    }) => restaurantTableService.updateTable(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEYS.RESTAURANT_TABLES] })
    },
  })
}

export const useDeleteRestaurantTable = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => restaurantTableService.deleteTable(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEYS.RESTAURANT_TABLES] })
    },
  })
}
